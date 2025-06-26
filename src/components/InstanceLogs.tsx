import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Cloud,
  Trash2,
  Wifi,
  WifiOff,
  Clock,
  RefreshCw,
  ArrowLeft,
  Server,
} from "lucide-react";
import axios from "axios";
import { io, Socket } from "socket.io-client";
import { TransportMethod, LogMessage, ConnectionStatus } from "../types";

const TRANSPORT_OPTIONS = [
  { value: "short-polling" as TransportMethod, label: "Short Polling" },
  { value: "long-polling" as TransportMethod, label: "Long Polling" },
  { value: "sse" as TransportMethod, label: "Server-Sent Events (SSE)" },
  { value: "websocket" as TransportMethod, label: "WebSocket" },
];

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export default function InstanceLogs() {
  const { instanceId } = useParams<{ instanceId: string }>();
  const navigate = useNavigate();

  const [selectedTransport, setSelectedTransport] =
    useState<TransportMethod>("short-polling");
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    connected: false,
    method: "short-polling",
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLongPollingLoading, setIsLongPollingLoading] = useState(false);
  const [isWebSocketAborted, setIsWebSocketAborted] = useState(false);

  const consoleRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const isLongPollingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const scrollToBottom = useCallback(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, []);

  const addLog = useCallback(
    (message: string, level: LogMessage["level"] = "info") => {
      const newLog: LogMessage = {
        id: `${Date.now()}-${Math.random()}`,
        message,
        timestamp: new Date(),
        level,
      };

      setLogs((prev) => [...prev, newLog]);
      setTimeout(scrollToBottom, 100);
    },
    [scrollToBottom]
  );

  const addLogsFromResponse = useCallback(
    (responseData: any, replace: boolean = false) => {
      if (Array.isArray(responseData)) {
        const newLogs: LogMessage[] = [];

        responseData.forEach((logEntry) => {
          if (typeof logEntry === "string") {
            const separatorIndex = logEntry.indexOf(" — ");
            if (separatorIndex !== -1) {
              const timestampStr = logEntry.substring(0, separatorIndex);
              const message = logEntry.substring(separatorIndex + 3);

              const newLog: LogMessage = {
                id: `${Date.now()}-${Math.random()}`,
                message,
                timestamp: new Date(timestampStr),
                level: "info",
              };
              newLogs.push(newLog);
            } else {
              const newLog: LogMessage = {
                id: `${Date.now()}-${Math.random()}`,
                message: logEntry,
                timestamp: new Date(),
                level: "info",
              };
              newLogs.push(newLog);
            }
          } else if (typeof logEntry === "object" && logEntry !== null) {
            const newLog: LogMessage = {
              id: logEntry.id || `${Date.now()}-${Math.random()}`,
              message: logEntry.message,
              timestamp: new Date(logEntry.timestamp || Date.now()),
              level: logEntry.level || "info",
            };
            newLogs.push(newLog);
          }
        });

        if (replace) {
          setLogs(newLogs);
        } else {
          setLogs((prev) => [...prev, ...newLogs]);
        }
      } else if (responseData.message) {
        const newLog: LogMessage = {
          id: responseData.id || `${Date.now()}-${Math.random()}`,
          message: responseData.message,
          timestamp: new Date(responseData.timestamp || Date.now()),
          level: responseData.level || "info",
        };

        if (replace) {
          setLogs([newLog]);
        } else {
          setLogs((prev) => [...prev, newLog]);
        }
      }
      setTimeout(scrollToBottom, 100);
    },
    [scrollToBottom]
  );

  const formatTimestamp = (timestamp: Date) => {
    return timestamp.toLocaleTimeString("en-US", { hour12: false });
  };

  const getLevelColor = (level: LogMessage["level"]) => {
    switch (level) {
      case "error":
        return "text-red-600";
      case "warn":
        return "text-yellow-600";
      case "debug":
        return "text-purple-600";
      default:
        return "text-gray-700";
    }
  };

  const cleanupConnections = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    isLongPollingRef.current = false;
    setIsLongPollingLoading(false);
    setIsWebSocketAborted(false);
    setConnectionStatus((prev) => ({ ...prev, connected: false }));
  }, []);

  const handleManualRefresh = async () => {
    if (selectedTransport !== "short-polling") return;

    setIsRefreshing(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/messages/short`, {
        timeout: 5000,
      });
      console.log("response: ", response);
      if (response.data) {
        addLogsFromResponse(response.data, true);
      }

      setConnectionStatus((prev) => ({
        ...prev,
        connected: true,
        lastUpdate: new Date(),
      }));
    } catch (error) {
      console.error("Manual refresh error:", error);
      addLog("Manual refresh error: Failed to fetch messages", "error");
      setConnectionStatus((prev) => ({ ...prev, connected: false }));
    } finally {
      setIsRefreshing(false);
    }
  };

  const startShortPolling = useCallback(() => {
    addLog(
      `Short polling ready for instance ${instanceId} (manual refresh only)`,
      "info"
    );
    setConnectionStatus((prev) => ({
      ...prev,
      connected: true,
      lastUpdate: new Date(),
    }));
  }, [addLog, instanceId]);

  const startLongPolling = useCallback(() => {
    isLongPollingRef.current = true;

    const longPoll = async () => {
      if (!isLongPollingRef.current) return;

      try {
        setIsLongPollingLoading(true);
        abortControllerRef.current = new AbortController();

        const response = await axios.get(`${API_BASE_URL}/messages/long`, {
          timeout: 30000,
          signal: abortControllerRef.current.signal,
        });

        if (!isLongPollingRef.current) return;

        if (response.data) {
          addLogsFromResponse(response.data);
        }

        setConnectionStatus((prev) => ({
          ...prev,
          connected: true,
          lastUpdate: new Date(),
        }));

        // Stop long polling after receiving the first response
        isLongPollingRef.current = false;
        addLog("Long polling completed - data received", "info");
      } catch (error: any) {
        if (error.name === "AbortError" || !isLongPollingRef.current) {
          return;
        }

        console.error("Long polling error:", error);
        addLog("Long polling error: Connection failed", "error");

        if (
          error.code !== "ECONNABORTED" &&
          !error.message.includes("timeout")
        ) {
          setConnectionStatus((prev) => ({ ...prev, connected: false }));
        }

        // Stop long polling on error as well
        isLongPollingRef.current = false;
      } finally {
        setIsLongPollingLoading(false);
      }
    };

    addLog(`Long polling started for instance ${instanceId}`, "info");
    setConnectionStatus((prev) => ({
      ...prev,
      connected: true,
      lastUpdate: new Date(),
    }));
    longPoll();
  }, [addLog, addLogsFromResponse, instanceId]);

  const startSSE = useCallback(() => {
    try {
      const eventSource = new EventSource(`${API_BASE_URL}/messages/sse`);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        addLog(`SSE connection established for instance ${instanceId}`, "info");
        setConnectionStatus((prev) => ({
          ...prev,
          connected: true,
          lastUpdate: new Date(),
        }));
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          addLogsFromResponse(data);
          setConnectionStatus((prev) => ({
            ...prev,
            connected: true,
            lastUpdate: new Date(),
          }));
        } catch (error) {
          console.error("SSE message parsing error:", error);
          addLog(`SSE message: ${event.data}`, "info");
        }
      };

      eventSource.onerror = (error) => {
        console.error("SSE error:", error);
        addLog("SSE connection error", "error");
        setConnectionStatus((prev) => ({ ...prev, connected: false }));
      };

      eventSource.addEventListener("log", (event: any) => {
        try {
          const data = JSON.parse(event.data);
          addLogsFromResponse(data);
        } catch (error) {
          console.error("SSE log event parsing error:", error);
        }
      });
    } catch (error) {
      console.error("SSE initialization error:", error);
      addLog("SSE connection failed to initialize", "error");
    }
  }, [addLog, addLogsFromResponse, instanceId]);

  const handleWebSocketAbort = useCallback(() => {
    if (socketRef.current && connectionStatus.connected) {
      socketRef.current.emit("control", "abort");
      setIsWebSocketAborted(true);
      addLog("WebSocket log emission aborted", "warn");
    }
  }, [connectionStatus.connected, addLog]);

  const handleWebSocketContinue = useCallback(() => {
    if (socketRef.current && connectionStatus.connected) {
      socketRef.current.emit("control", "continue");
      setIsWebSocketAborted(false);
      addLog("WebSocket log emission resumed", "info");
    }
  }, [connectionStatus.connected, addLog]);

  const startWebSocket = useCallback(() => {
    try {
      console.log("=== WebSocket Debug Start ===");
      console.log("API_BASE_URL:", API_BASE_URL);
      console.log("Instance ID:", instanceId);

      addLog(`Attempting WebSocket connection to ${API_BASE_URL}`, "info");

      const socket = io(API_BASE_URL, {
        transports: ["websocket"],
        timeout: 5000,
        forceNew: true,
        autoConnect: true,
      });

      socketRef.current = socket;
      setIsWebSocketAborted(false);

      // Debug all socket events
      socket.onAny((eventName, ...args) => {
        console.log(`🔵 WebSocket Event: ${eventName}`, args);
        addLog(`WebSocket Event: ${eventName}`, "debug");
      });

      socket.on("connect", () => {
        console.log("✅ WebSocket connected successfully");
        console.log("Socket ID:", socket.id);
        console.log("Socket connected:", socket.connected);

        addLog(
          `WebSocket connection established for instance ${instanceId} (ID: ${socket.id})`,
          "info"
        );

        console.log("Emitting join_instance_room with instanceId:", instanceId);
        socket.emit("join_instance_room", instanceId);

        // Also emit a test message to verify the connection
        socket.emit("test", {
          message: "Frontend test message",
          timestamp: new Date().toISOString(),
          instanceId: instanceId,
        });

        setConnectionStatus((prev) => ({
          ...prev,
          connected: true,
          lastUpdate: new Date(),
        }));
      });

      socket.on("disconnect", (reason) => {
        console.log("❌ WebSocket disconnected, reason:", reason);
        addLog(`WebSocket disconnected: ${reason}`, "warn");
        setConnectionStatus((prev) => ({ ...prev, connected: false }));
        setIsWebSocketAborted(false);
      });

      socket.on("connect_error", (error) => {
        console.error("❌ WebSocket connection error:", error);
        console.error("Error details:", {
          message: error.message,
          description: error.description,
          context: error.context,
          type: error.type,
        });
        addLog(`WebSocket connection failed: ${error.message}`, "error");
        setConnectionStatus((prev) => ({ ...prev, connected: false }));
        setIsWebSocketAborted(false);
      });

      // Handle individual log messages from WebSocket
      socket.on("instance_logs", (data) => {
        console.log("🔵 WebSocket instance_logs received:", data);
        console.log("Data type:", typeof data);
        console.log("Data length:", data?.length);

        // Handle single string message (your backend format)
        if (typeof data === "string") {
          console.log("Processing string message:", data);
          const separatorIndex = data.indexOf(" — ");
          if (separatorIndex !== -1) {
            const timestampStr = data.substring(0, separatorIndex);
            const message = data.substring(separatorIndex + 3);

            console.log("Parsed timestamp:", timestampStr);
            console.log("Parsed message:", message);

            const newLog: LogMessage = {
              id: `${Date.now()}-${Math.random()}`,
              message,
              timestamp: new Date(timestampStr),
              level: "info",
            };

            console.log("Created log entry:", newLog);
            setLogs((prev) => [...prev, newLog]);
            setTimeout(scrollToBottom, 100);
          } else {
            console.log("No separator found, treating as plain message");
            const newLog: LogMessage = {
              id: `${Date.now()}-${Math.random()}`,
              message: data,
              timestamp: new Date(),
              level: "info",
            };

            console.log("Created log entry:", newLog);
            setLogs((prev) => [...prev, newLog]);
            setTimeout(scrollToBottom, 100);
          }
        } else {
          console.log("Processing non-string data:", data);
          addLogsFromResponse(data);
        }

        setConnectionStatus((prev) => ({
          ...prev,
          connected: true,
          lastUpdate: new Date(),
        }));
      });

      // Listen for other possible event names
      socket.on("log", (data) => {
        console.log("📨 WebSocket log received:", data);
        addLogsFromResponse(data);
      });

      socket.on("logs", (data) => {
        console.log("📨 WebSocket logs received:", data);
        addLogsFromResponse(data);
      });

      socket.on("message", (data) => {
        console.log("📨 WebSocket message received:", data);
        addLogsFromResponse(data);
      });

      // Check connection status after a delay
      setTimeout(() => {
        console.log("=== WebSocket Status Check ===");
        console.log("Socket connected:", socket.connected);
        console.log("Socket ID:", socket.id);
        console.log(
          "Socket state:",
          socket.connected ? "Connected" : "Disconnected"
        );

        if (!socket.connected) {
          console.log("❌ WebSocket failed to connect");
          addLog(
            "WebSocket failed to connect - check server and network",
            "error"
          );
        } else {
          console.log("✅ WebSocket is connected and ready");
          addLog("WebSocket connection verified", "info");
        }
      }, 3000);
    } catch (error) {
      console.error("❌ WebSocket initialization error:", error);
      addLog(`WebSocket connection failed to initialize: ${error}`, "error");
    }
  }, [addLog, addLogsFromResponse, instanceId, scrollToBottom]);

  const handleTransportChange = useCallback(
    (newTransport: TransportMethod) => {
      cleanupConnections();
      setSelectedTransport(newTransport);
      addLog(
        `Switching to ${
          TRANSPORT_OPTIONS.find((opt) => opt.value === newTransport)?.label
        }...`,
        "info"
      );

      setConnectionStatus({
        connected: false,
        method: newTransport,
      });
    },
    [cleanupConnections, addLog]
  );

  const clearLogs = useCallback(() => {
    setLogs([]);
    addLog("Logs cleared", "info");
  }, [addLog]);

  const handleBackToDashboard = () => {
    cleanupConnections();
    navigate("/");
  };

  useEffect(() => {
    const startTransport = () => {
      switch (selectedTransport) {
        case "short-polling":
          startShortPolling();
          break;
        case "long-polling":
          startLongPolling();
          break;
        case "sse":
          startSSE();
          break;
        case "websocket":
          startWebSocket();
          break;
      }
    };

    const timer = setTimeout(startTransport, 500);
    return () => clearTimeout(timer);
  }, [
    selectedTransport,
    startShortPolling,
    startLongPolling,
    startSSE,
    startWebSocket,
  ]);

  useEffect(() => {
    return cleanupConnections;
  }, [cleanupConnections]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-sky-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl border border-blue-100 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-sky-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Server className="h-8 w-8 text-white" />
                <div>
                  <h1 className="text-2xl font-bold text-white">
                    Instance Logs
                  </h1>
                  <p className="text-blue-100 text-sm">
                    Instance ID: {instanceId}
                  </p>
                </div>
              </div>
              <button
                onClick={handleBackToDashboard}
                className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </button>
            </div>
          </div>

          {/* Controls */}
          <div className="p-6 bg-gray-50 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <label
                  htmlFor="transport"
                  className="text-sm font-medium text-gray-700"
                >
                  Transport Method:
                </label>
                <select
                  id="transport"
                  value={selectedTransport}
                  onChange={(e) =>
                    handleTransportChange(e.target.value as TransportMethod)
                  }
                  className="px-3 py-2 bg-white border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                >
                  {TRANSPORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  {connectionStatus.connected ? (
                    <Wifi className="h-4 w-4 text-green-500" />
                  ) : (
                    <WifiOff className="h-4 w-4 text-red-500" />
                  )}
                  <span
                    className={`text-sm font-medium ${
                      connectionStatus.connected
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {connectionStatus.connected ? "Connected" : "Disconnected"}
                  </span>
                </div>

                {selectedTransport === "short-polling" && (
                  <button
                    onClick={handleManualRefresh}
                    disabled={isRefreshing}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors shadow-sm focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`h-4 w-4 ${
                        isRefreshing ? "animate-spin" : ""
                      }`}
                    />
                    Refresh
                  </button>
                )}

                {selectedTransport === "websocket" &&
                  connectionStatus.connected && (
                    <div className="flex items-center gap-2">
                      {!isWebSocketAborted ? (
                        <button
                          onClick={handleWebSocketAbort}
                          className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors shadow-sm focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
                        >
                          <Trash2 className="h-4 w-4" />
                          Abort Logs
                        </button>
                      ) : (
                        <button
                          onClick={handleWebSocketContinue}
                          className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors shadow-sm focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                        >
                          <RefreshCw className="h-4 w-4" />
                          Continue Logs
                        </button>
                      )}
                    </div>
                  )}

                <button
                  onClick={clearLogs}
                  className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors shadow-sm focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Clear Logs
                </button>
              </div>
            </div>
          </div>

          {/* Console */}
          <div className="p-6">
            <div
              ref={consoleRef}
              className="bg-gray-100 border border-gray-300 rounded-lg p-4 h-96 overflow-y-auto font-mono text-sm leading-relaxed scroll-smooth relative"
              style={{
                fontFamily: 'Consolas, Monaco, "Courier New", monospace',
              }}
            >
              {isLongPollingLoading && selectedTransport === "long-polling" && (
                <div className="absolute inset-0 bg-gray-100/80 flex items-center justify-center z-10">
                  <div className="flex items-center gap-3 bg-white rounded-lg px-4 py-3 shadow-lg">
                    <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />
                    <span className="text-gray-700 font-medium">
                      Long polling in progress...
                    </span>
                  </div>
                </div>
              )}

              {isWebSocketAborted && selectedTransport === "websocket" && (
                <div className="absolute top-4 right-4 bg-orange-100 border border-orange-300 rounded-lg px-3 py-2 z-10">
                  <div className="flex items-center gap-2">
                    <Trash2 className="h-4 w-4 text-orange-600" />
                    <span className="text-orange-700 text-sm font-medium">
                      Log emission aborted
                    </span>
                  </div>
                </div>
              )}

              {logs.length === 0 ? (
                <div className="text-gray-500 italic">
                  Waiting for log messages from instance {instanceId}...
                </div>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="flex gap-2 py-1">
                    <span className="text-gray-500 flex items-center gap-1 flex-shrink-0">
                      <Clock className="h-3 w-3" />
                      {formatTimestamp(log.timestamp)}
                    </span>
                    <span className={getLevelColor(log.level)}>
                      {log.message}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { LogMessage, ConnectionStatus, LogResponse } from "../types";

interface UseWebSocketProps {
  instanceId: string;
  API_BASE_URL: string;
  addLog: (message: string, level?: LogMessage["level"]) => void;
  addLogsFromResponse: (responseData: LogResponse, replace?: boolean) => void;
  setConnectionStatus: (
    status: ConnectionStatus | ((prev: ConnectionStatus) => ConnectionStatus)
  ) => void;
  setIsWebSocketAborted: (aborted: boolean) => void;
  setLogs: (
    logs: LogMessage[] | ((prev: LogMessage[]) => LogMessage[])
  ) => void;
  scrollToBottom: () => void;
}

export const useWebSocket = ({
  instanceId,
  API_BASE_URL,
  addLog,
  addLogsFromResponse,
  setConnectionStatus,
  setIsWebSocketAborted,
  setLogs,
  scrollToBottom,
}: UseWebSocketProps) => {
  const socketRef = useRef<Socket | null>(null);

  const handleWebSocketAbort = useCallback(() => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit("control", "abort");
      setIsWebSocketAborted(true);
      addLog("WebSocket log emission aborted", "warn");
    }
  }, [addLog, setIsWebSocketAborted]);

  const handleWebSocketContinue = useCallback(() => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit("control", "continue");
      setIsWebSocketAborted(false);
      addLog("WebSocket log emission resumed", "info");
    }
  }, [addLog, setIsWebSocketAborted]);

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
          name: error.name,
          stack: error.stack,
        });
        addLog(`WebSocket connection failed: ${error.message}`, "error");
        setConnectionStatus((prev) => ({ ...prev, connected: false }));
        setIsWebSocketAborted(false);
      });

      // Handle individual log messages from WebSocket
      socket.on("instance_logs", (data) => {
        console.log("�� WebSocket instance_logs received:", data);
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
  }, [
    addLog,
    addLogsFromResponse,
    instanceId,
    API_BASE_URL,
    setConnectionStatus,
    setIsWebSocketAborted,
    setLogs,
    scrollToBottom,
  ]);

  const stopWebSocket = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setIsWebSocketAborted(false);
  }, [setIsWebSocketAborted]);

  return {
    startWebSocket,
    stopWebSocket,
    handleWebSocketAbort,
    handleWebSocketContinue,
  };
};

import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  TransportMethod,
  LogMessage,
  ConnectionStatus,
  LogResponse,
} from "../types";
import { useShortPolling } from "../hooks/useShortPolling";
import { useLongPolling } from "../hooks/useLongPolling";
import { useSSE } from "../hooks/useSSE";
import { useWebSocket } from "../hooks/useWebSocket";
import { addLogsFromResponse } from "../utils/logUtils";
import { InstanceLogsHeader } from "./InstanceLogsHeader";
import { InstanceLogsControls } from "./InstanceLogsControls";
import { InstanceLogsConsole } from "./InstanceLogsConsole";

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
  const [isLongPollingLoading, setIsLongPollingLoading] = useState(false);
  const [isWebSocketAborted, setIsWebSocketAborted] = useState(false);

  const addLog = useCallback(
    (message: string, level: LogMessage["level"] = "info") => {
      const newLog: LogMessage = {
        id: `${Date.now()}-${Math.random()}`,
        message,
        timestamp: new Date(),
        level,
      };
      setLogs((prev) => [...prev, newLog]);
    },
    []
  );

  const handleLogsFromResponse = useCallback(
    (responseData: LogResponse, replace: boolean = false) => {
      addLogsFromResponse(responseData, replace, setLogs, () => {});
    },
    []
  );

  // Custom hooks for each transport method
  const { startShortPolling, handleManualRefresh, isRefreshing } =
    useShortPolling({
      instanceId: instanceId || "",
      API_BASE_URL,
      addLog,
      addLogsFromResponse: handleLogsFromResponse,
      setConnectionStatus,
    });

  const { startLongPolling, stopLongPolling } = useLongPolling({
    instanceId: instanceId || "",
    API_BASE_URL,
    addLog,
    addLogsFromResponse: handleLogsFromResponse,
    setConnectionStatus,
    setIsLongPollingLoading,
  });

  const { startSSE, stopSSE } = useSSE({
    instanceId: instanceId || "",
    API_BASE_URL,
    addLog,
    addLogsFromResponse: handleLogsFromResponse,
    setConnectionStatus,
  });

  const {
    startWebSocket,
    stopWebSocket,
    handleWebSocketAbort,
    handleWebSocketContinue,
  } = useWebSocket({
    instanceId: instanceId || "",
    API_BASE_URL,
    addLog,
    addLogsFromResponse: handleLogsFromResponse,
    setConnectionStatus,
    setIsWebSocketAborted,
    setLogs,
    scrollToBottom: () => {},
  });

  const cleanupConnections = useCallback(() => {
    stopLongPolling();
    stopSSE();
    stopWebSocket();
    setIsLongPollingLoading(false);
    setIsWebSocketAborted(false);
    setConnectionStatus((prev) => ({ ...prev, connected: false }));
  }, [stopLongPolling, stopSSE, stopWebSocket]);

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
  }, [selectedTransport]);

  useEffect(() => {
    return cleanupConnections;
  }, [cleanupConnections]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-sky-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl border border-blue-100 overflow-hidden">
          <InstanceLogsHeader
            instanceId={instanceId || ""}
            onBackToDashboard={handleBackToDashboard}
          />

          <InstanceLogsControls
            selectedTransport={selectedTransport}
            connectionStatus={connectionStatus}
            isRefreshing={isRefreshing}
            isWebSocketAborted={isWebSocketAborted}
            transportOptions={TRANSPORT_OPTIONS}
            onTransportChange={handleTransportChange}
            onManualRefresh={handleManualRefresh}
            onWebSocketAbort={handleWebSocketAbort}
            onWebSocketContinue={handleWebSocketContinue}
            onClearLogs={clearLogs}
          />

          <InstanceLogsConsole
            logs={logs}
            instanceId={instanceId || ""}
            selectedTransport={selectedTransport}
            isLongPollingLoading={isLongPollingLoading}
            isWebSocketAborted={isWebSocketAborted}
          />
        </div>
      </div>
    </div>
  );
}

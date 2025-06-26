import { useCallback, useRef } from "react";
import { LogMessage, ConnectionStatus, LogResponse } from "../types";

interface UseSSEProps {
  instanceId: string;
  API_BASE_URL: string;
  addLog: (message: string, level?: LogMessage["level"]) => void;
  addLogsFromResponse: (responseData: LogResponse, replace?: boolean) => void;
  setConnectionStatus: (
    status: ConnectionStatus | ((prev: ConnectionStatus) => ConnectionStatus)
  ) => void;
}

export const useSSE = ({
  instanceId,
  API_BASE_URL,
  addLog,
  addLogsFromResponse,
  setConnectionStatus,
}: UseSSEProps) => {
  const eventSourceRef = useRef<EventSource | null>(null);

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

      eventSource.addEventListener("log", (event: MessageEvent) => {
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
  }, [
    addLog,
    addLogsFromResponse,
    instanceId,
    API_BASE_URL,
    setConnectionStatus,
  ]);

  const stopSSE = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  return {
    startSSE,
    stopSSE,
  };
};

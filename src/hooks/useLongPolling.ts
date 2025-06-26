import { useCallback, useRef } from "react";
import axios from "axios";
import { LogMessage, ConnectionStatus, LogResponse } from "../types";

interface UseLongPollingProps {
  instanceId: string;
  API_BASE_URL: string;
  addLog: (message: string, level?: LogMessage["level"]) => void;
  addLogsFromResponse: (responseData: LogResponse, replace?: boolean) => void;
  setConnectionStatus: (
    status: ConnectionStatus | ((prev: ConnectionStatus) => ConnectionStatus)
  ) => void;
  setIsLongPollingLoading: (loading: boolean) => void;
}

export const useLongPolling = ({
  instanceId,
  API_BASE_URL,
  addLog,
  addLogsFromResponse,
  setConnectionStatus,
  setIsLongPollingLoading,
}: UseLongPollingProps) => {
  const isLongPollingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

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

        // Only set connected to true after successful response
        setConnectionStatus((prev) => ({
          ...prev,
          connected: true,
          lastUpdate: new Date(),
        }));

        // Stop long polling after receiving the first response
        isLongPollingRef.current = false;
        addLog("Long polling completed - data received", "info");
      } catch (error: unknown) {
        if (error instanceof Error) {
          if (error.name === "AbortError" || !isLongPollingRef.current) {
            return;
          }
        }

        console.error("Long polling error:", error);
        addLog("Long polling error: Connection failed", "error");

        if (
          error instanceof Error &&
          (error as { code?: string }).code !== "ECONNABORTED" &&
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
    // Don't set connected to true immediately - wait for successful connection
    setConnectionStatus((prev) => ({
      ...prev,
      connected: false, // Start as disconnected
      lastUpdate: new Date(),
    }));
    longPoll();
  }, [
    addLog,
    addLogsFromResponse,
    instanceId,
    API_BASE_URL,
    setConnectionStatus,
    setIsLongPollingLoading,
  ]);

  const stopLongPolling = useCallback(() => {
    isLongPollingRef.current = false;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLongPollingLoading(false);
  }, [setIsLongPollingLoading]);

  return {
    startLongPolling,
    stopLongPolling,
    isLongPolling: isLongPollingRef.current,
  };
};

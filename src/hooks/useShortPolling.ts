import { useCallback, useRef } from "react";
import axios from "axios";
import { LogMessage, ConnectionStatus, LogResponse } from "../types";

interface UseShortPollingProps {
  instanceId: string;
  API_BASE_URL: string;
  addLog: (message: string, level?: LogMessage["level"]) => void;
  addLogsFromResponse: (responseData: LogResponse, replace?: boolean) => void;
  setConnectionStatus: (
    status: ConnectionStatus | ((prev: ConnectionStatus) => ConnectionStatus)
  ) => void;
}

export const useShortPolling = ({
  instanceId,
  API_BASE_URL,
  addLog,
  addLogsFromResponse,
  setConnectionStatus,
}: UseShortPollingProps) => {
  const isRefreshingRef = useRef(false);

  const startShortPolling = useCallback(() => {
    addLog(
      `Short polling ready for instance ${instanceId} (manual refresh only)`,
      "info"
    );
    setConnectionStatus((prev) => ({
      ...prev,
      connected: false,
      lastUpdate: new Date(),
    }));
  }, [addLog, instanceId, setConnectionStatus]);

  const handleManualRefresh = useCallback(async () => {
    if (isRefreshingRef.current) return;

    isRefreshingRef.current = true;
    try {
      const response = await axios.get(`${API_BASE_URL}/messages/short`, {
        timeout: 5000,
      });

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
      isRefreshingRef.current = false;
    }
  }, [API_BASE_URL, addLog, addLogsFromResponse, setConnectionStatus]);

  return {
    startShortPolling,
    handleManualRefresh,
    isRefreshing: isRefreshingRef.current,
  };
};

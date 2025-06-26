import { Wifi, WifiOff, RefreshCw, Trash2 } from "lucide-react";
import { TransportMethod, ConnectionStatus } from "../types";

interface InstanceLogsControlsProps {
  selectedTransport: TransportMethod;
  connectionStatus: ConnectionStatus;
  isRefreshing: boolean;
  isWebSocketAborted: boolean;
  transportOptions: Array<{ value: TransportMethod; label: string }>;
  onTransportChange: (transport: TransportMethod) => void;
  onManualRefresh: () => void;
  onWebSocketAbort: () => void;
  onWebSocketContinue: () => void;
  onClearLogs: () => void;
}

export const InstanceLogsControls = ({
  selectedTransport,
  connectionStatus,
  isRefreshing,
  isWebSocketAborted,
  transportOptions,
  onTransportChange,
  onManualRefresh,
  onWebSocketAbort,
  onWebSocketContinue,
  onClearLogs,
}: InstanceLogsControlsProps) => {
  return (
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
              onTransportChange(e.target.value as TransportMethod)
            }
            className="px-3 py-2 bg-white border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
          >
            {transportOptions.map((option) => (
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
                connectionStatus.connected ? "text-green-600" : "text-red-600"
              }`}
            >
              {connectionStatus.connected ? "Connected" : "Disconnected"}
            </span>
          </div>

          {selectedTransport === "short-polling" && (
            <button
              onClick={onManualRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors shadow-sm focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          )}

          {selectedTransport === "websocket" && connectionStatus.connected && (
            <div className="flex items-center gap-2">
              {!isWebSocketAborted ? (
                <button
                  onClick={onWebSocketAbort}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors shadow-sm focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Abort Logs
                </button>
              ) : (
                <button
                  onClick={onWebSocketContinue}
                  className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors shadow-sm focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Continue Logs
                </button>
              )}
            </div>
          )}

          <button
            onClick={onClearLogs}
            className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors shadow-sm focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          >
            <Trash2 className="h-4 w-4" />
            Clear Logs
          </button>
        </div>
      </div>
    </div>
  );
};

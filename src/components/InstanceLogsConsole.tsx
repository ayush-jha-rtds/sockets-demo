import { useRef, useEffect } from "react";
import { Clock, RefreshCw, Trash2 } from "lucide-react";
import { LogMessage } from "../types";
import { formatTimestamp, getLevelColor } from "../utils/logUtils";

interface InstanceLogsConsoleProps {
  logs: LogMessage[];
  instanceId: string;
  selectedTransport: string;
  isLongPollingLoading: boolean;
  isWebSocketAborted: boolean;
}

export const InstanceLogsConsole = ({
  logs,
  instanceId,
  selectedTransport,
  isLongPollingLoading,
  isWebSocketAborted,
}: InstanceLogsConsoleProps) => {
  const consoleRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [logs]);

  return (
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
              <span className={getLevelColor(log.level)}>{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

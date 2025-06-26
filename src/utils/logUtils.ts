import { LogMessage, LogResponse } from "../types";

export const formatTimestamp = (timestamp: Date): string => {
  return timestamp.toLocaleTimeString("en-US", { hour12: false });
};

export const getLevelColor = (level: LogMessage["level"]): string => {
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

export const addLogsFromResponse = (
  responseData: LogResponse,
  replace: boolean = false,
  setLogs: (
    logs: LogMessage[] | ((prev: LogMessage[]) => LogMessage[])
  ) => void,
  scrollToBottom: () => void
): void => {
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
  } else if (
    typeof responseData === "object" &&
    responseData !== null &&
    "message" in responseData
  ) {
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
};

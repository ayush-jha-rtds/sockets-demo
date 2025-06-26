export type TransportMethod =
  | "short-polling"
  | "long-polling"
  | "sse"
  | "websocket";

export interface LogMessage {
  id: string;
  message: string;
  timestamp: Date;
  level?: "info" | "warn" | "error" | "debug";
}

export interface ConnectionStatus {
  connected: boolean;
  method: TransportMethod;
  lastUpdate?: Date;
}

export interface LogResponse {
  message: string;
  id: string;
  timestamp: string;
  level: "info" | "warn" | "error" | "debug";
}

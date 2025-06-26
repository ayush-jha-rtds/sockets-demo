import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Cloud, Trash2, Wifi, WifiOff, Clock } from 'lucide-react';
import axios from 'axios';
import { io, Socket } from 'socket.io-client';
import { TransportMethod, LogMessage, ConnectionStatus } from '../types';

const TRANSPORT_OPTIONS = [
  { value: 'short-polling' as TransportMethod, label: 'Short Polling' },
  { value: 'long-polling' as TransportMethod, label: 'Long Polling' },
  { value: 'sse' as TransportMethod, label: 'Server-Sent Events (SSE)' },
  { value: 'websocket' as TransportMethod, label: 'WebSocket' },
];

// Backend API base URL - adjust according to your NestJS server
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function LogDashboard() {
  const [selectedTransport, setSelectedTransport] = useState<TransportMethod>('short-polling');
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    connected: false,
    method: 'short-polling',
  });

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

  const addLog = useCallback((message: string, level: LogMessage['level'] = 'info') => {
    const newLog: LogMessage = {
      id: `${Date.now()}-${Math.random()}`,
      message,
      timestamp: new Date(),
      level,
    };
    
    setLogs(prev => [...prev, newLog]);
    setTimeout(scrollToBottom, 100);
  }, [scrollToBottom]);

  const addLogsFromResponse = useCallback((responseData: any) => {
    if (Array.isArray(responseData)) {
      responseData.forEach(logData => {
        const newLog: LogMessage = {
          id: logData.id || `${Date.now()}-${Math.random()}`,
          message: logData.message,
          timestamp: new Date(logData.timestamp || Date.now()),
          level: logData.level || 'info',
        };
        setLogs(prev => [...prev, newLog]);
      });
    } else if (responseData.message) {
      const newLog: LogMessage = {
        id: responseData.id || `${Date.now()}-${Math.random()}`,
        message: responseData.message,
        timestamp: new Date(responseData.timestamp || Date.now()),
        level: responseData.level || 'info',
      };
      setLogs(prev => [...prev, newLog]);
    }
    setTimeout(scrollToBottom, 100);
  }, [scrollToBottom]);

  const formatTimestamp = (timestamp: Date) => {
    return timestamp.toLocaleTimeString('en-US', { hour12: false });
  };

  const getLevelColor = (level: LogMessage['level']) => {
    switch (level) {
      case 'error': return 'text-red-600';
      case 'warn': return 'text-yellow-600';
      case 'debug': return 'text-purple-600';
      default: return 'text-gray-700';
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
    setConnectionStatus(prev => ({ ...prev, connected: false }));
  }, []);

  const startShortPolling = useCallback(() => {
    const poll = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/api/logs/messages`, {
          timeout: 5000,
        });
        
        if (response.data) {
          addLogsFromResponse(response.data);
        }
        
        setConnectionStatus(prev => ({ 
          ...prev, 
          connected: true, 
          lastUpdate: new Date() 
        }));
      } catch (error) {
        console.error('Short polling error:', error);
        addLog('Short polling error: Failed to fetch messages', 'error');
        setConnectionStatus(prev => ({ ...prev, connected: false }));
      }
    };

    intervalRef.current = setInterval(poll, 3000);
    poll(); // Initial call
    addLog('Short polling started', 'info');
  }, [addLog, addLogsFromResponse]);

  const startLongPolling = useCallback(() => {
    isLongPollingRef.current = true;
    
    const longPoll = async () => {
      if (!isLongPollingRef.current) return;
      
      try {
        abortControllerRef.current = new AbortController();
        
        const response = await axios.get(`${API_BASE_URL}/api/logs/messages/long-poll`, {
          timeout: 30000, // 30 second timeout for long polling
          signal: abortControllerRef.current.signal,
        });
        
        if (!isLongPollingRef.current) return;
        
        if (response.data) {
          addLogsFromResponse(response.data);
        }
        
        setConnectionStatus(prev => ({ 
          ...prev, 
          connected: true, 
          lastUpdate: new Date() 
        }));
        
        // Continue long polling immediately
        setTimeout(longPoll, 100);
      } catch (error: any) {
        if (error.name === 'AbortError' || !isLongPollingRef.current) {
          return; // Request was cancelled
        }
        
        console.error('Long polling error:', error);
        addLog('Long polling error: Connection failed', 'error');
        setConnectionStatus(prev => ({ ...prev, connected: false }));
        
        // Retry after error
        if (isLongPollingRef.current) {
          setTimeout(longPoll, 5000);
        }
      }
    };

    addLog('Long polling started', 'info');
    longPoll();
  }, [addLog, addLogsFromResponse]);

  const startSSE = useCallback(() => {
    try {
      const eventSource = new EventSource(`${API_BASE_URL}/api/logs/messages/sse`);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        addLog('SSE connection established', 'info');
        setConnectionStatus(prev => ({ 
          ...prev, 
          connected: true, 
          lastUpdate: new Date() 
        }));
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          addLogsFromResponse(data);
          setConnectionStatus(prev => ({ 
            ...prev, 
            connected: true, 
            lastUpdate: new Date() 
          }));
        } catch (error) {
          console.error('SSE message parsing error:', error);
          addLog(`SSE message: ${event.data}`, 'info');
        }
      };

      eventSource.onerror = (error) => {
        console.error('SSE error:', error);
        addLog('SSE connection error', 'error');
        setConnectionStatus(prev => ({ ...prev, connected: false }));
      };

      eventSource.addEventListener('log', (event: any) => {
        try {
          const data = JSON.parse(event.data);
          addLogsFromResponse(data);
        } catch (error) {
          console.error('SSE log event parsing error:', error);
        }
      });

    } catch (error) {
      console.error('SSE initialization error:', error);
      addLog('SSE connection failed to initialize', 'error');
    }
  }, [addLog, addLogsFromResponse]);

  const startWebSocket = useCallback(() => {
    try {
      const socket = io(API_BASE_URL, {
        transports: ['websocket'],
        timeout: 5000,
      });
      
      socketRef.current = socket;

      socket.on('connect', () => {
        addLog('WebSocket connection established', 'info');
        setConnectionStatus(prev => ({ 
          ...prev, 
          connected: true, 
          lastUpdate: new Date() 
        }));
      });

      socket.on('disconnect', () => {
        addLog('WebSocket disconnected', 'warn');
        setConnectionStatus(prev => ({ ...prev, connected: false }));
      });

      socket.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error);
        addLog('WebSocket connection failed', 'error');
        setConnectionStatus(prev => ({ ...prev, connected: false }));
      });

      // Listen for instance logs
      socket.on('instance_logs', (data) => {
        addLogsFromResponse(data);
        setConnectionStatus(prev => ({ 
          ...prev, 
          connected: true, 
          lastUpdate: new Date() 
        }));
      });

      // Listen for generic log events
      socket.on('log', (data) => {
        addLogsFromResponse(data);
      });

      // Join a room if needed (optional)
      socket.emit('join_logs_room');

    } catch (error) {
      console.error('WebSocket initialization error:', error);
      addLog('WebSocket connection failed to initialize', 'error');
    }
  }, [addLog, addLogsFromResponse]);

  const handleTransportChange = useCallback((newTransport: TransportMethod) => {
    cleanupConnections();
    setSelectedTransport(newTransport);
    addLog(`Switching to ${TRANSPORT_OPTIONS.find(opt => opt.value === newTransport)?.label}...`, 'info');
    
    setConnectionStatus({
      connected: false,
      method: newTransport,
    });
  }, [cleanupConnections, addLog]);

  const clearLogs = useCallback(() => {
    setLogs([]);
    addLog('Logs cleared', 'info');
  }, [addLog]);

  useEffect(() => {
    const startTransport = () => {
      switch (selectedTransport) {
        case 'short-polling':
          startShortPolling();
          break;
        case 'long-polling':
          startLongPolling();
          break;
        case 'sse':
          startSSE();
          break;
        case 'websocket':
          startWebSocket();
          break;
      }
    };

    const timer = setTimeout(startTransport, 500);
    return () => clearTimeout(timer);
  }, [selectedTransport, startShortPolling, startLongPolling, startSSE, startWebSocket]);

  useEffect(() => {
    return cleanupConnections;
  }, [cleanupConnections]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-sky-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl border border-blue-100 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-sky-600 px-6 py-4">
            <div className="flex items-center gap-3">
              <Cloud className="h-8 w-8 text-white" />
              <h1 className="text-2xl font-bold text-white">Real-Time Instance Logs</h1>
            </div>
          </div>

          {/* Controls */}
          <div className="p-6 bg-gray-50 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <label htmlFor="transport" className="text-sm font-medium text-gray-700">
                  Transport Method:
                </label>
                <select
                  id="transport"
                  value={selectedTransport}
                  onChange={(e) => handleTransportChange(e.target.value as TransportMethod)}
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
                  <span className={`text-sm font-medium ${
                    connectionStatus.connected ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {connectionStatus.connected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>

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
              className="bg-gray-100 border border-gray-300 rounded-lg p-4 h-96 overflow-y-auto font-mono text-sm leading-relaxed scroll-smooth"
              style={{ fontFamily: 'Consolas, Monaco, "Courier New", monospace' }}
            >
              {logs.length === 0 ? (
                <div className="text-gray-500 italic">
                  Waiting for log messages from backend...
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
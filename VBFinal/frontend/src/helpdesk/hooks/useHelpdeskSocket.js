import { useCallback, useEffect, useRef, useState } from 'react';
import { openRealtimeSocket } from '../../services/realtime';

const MAX_DELAY_MS = 10000;
const NON_RETRY_CLOSE_CODES = new Set([4401, 4403, 1008]);

export const useHelpdeskSocket = ({ sessionId, onMessage, enabled = true }) => {
  const socketRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const reconnectAttemptRef = useRef(0);
  const manuallyClosedRef = useRef(false);
  const onMessageRef = useRef(onMessage);

  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState('');

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const connect = useCallback(() => {
    if (!enabled || !sessionId) {
      return;
    }

    clearReconnectTimer();

    const socket = openRealtimeSocket(`/ws/helpdesk/${sessionId}/`, {
      onOpen: () => {
        reconnectAttemptRef.current = 0;
        setConnectionError('');
        setIsConnected(true);
      },
      onMessage: (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (typeof onMessageRef.current === 'function') {
            onMessageRef.current(payload);
          }
        } catch {
          setConnectionError('Failed to parse incoming message.');
        }
      },
      onError: () => {
        setConnectionError('Realtime connection error. Retrying...');
      },
      onClose: (event) => {
        setIsConnected(false);

        if (NON_RETRY_CLOSE_CODES.has(event?.code)) {
          if (event.code === 4401) {
            setConnectionError('Realtime authentication failed. Please sign in again.');
          } else if (event.code === 4403) {
            setConnectionError('You do not have access to this helpdesk session.');
          } else {
            setConnectionError('Realtime connection was rejected by server policy.');
          }
          return;
        }

        if (manuallyClosedRef.current) {
          return;
        }
        reconnectAttemptRef.current += 1;
        const delay = Math.min(1000 * 2 ** reconnectAttemptRef.current, MAX_DELAY_MS);
        reconnectTimerRef.current = setTimeout(() => {
          connect();
        }, delay);
      },
    });

    if (!socket) {
      setConnectionError('Missing auth token for websocket connection.');
      return;
    }

    socketRef.current = socket;
  }, [clearReconnectTimer, enabled, sessionId]);

  useEffect(() => {
    manuallyClosedRef.current = false;

    if (!enabled) {
      clearReconnectTimer();
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      setIsConnected(false);
      return;
    }

    connect();

    return () => {
      manuallyClosedRef.current = true;
      clearReconnectTimer();
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [clearReconnectTimer, connect, enabled]);

  const send = useCallback((payload) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return false;
    }

    socket.send(JSON.stringify(payload));
    return true;
  }, []);

  return {
    isConnected,
    connectionError,
    send,
  };
};

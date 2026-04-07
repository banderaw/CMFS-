const resolveWebSocketBase = () => {
  const configured = import.meta.env.VITE_WS_URL?.trim();
  if (configured) {
    return configured.replace(/\/+$/, '');
  }

  if (import.meta.env.DEV) {
    return 'ws://127.0.0.1:8000';
  }

  if (typeof window === 'undefined') {
    return 'ws://127.0.0.1:8000';
  }

  return `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;
};

export const buildRealtimeUrl = (path) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const base = resolveWebSocketBase();
  const url = new URL(normalizedPath, `${base}/`);
  const token = localStorage.getItem('token');
  if (token) {
    url.searchParams.set('token', token);
  }
  return url.toString();
};

export const openRealtimeSocket = (path, handlers = {}) => {
  if (typeof window === 'undefined' || typeof WebSocket === 'undefined') {
    return null;
  }

  const token = localStorage.getItem('token');
  if (!token) {
    return null;
  }

  const socket = new WebSocket(buildRealtimeUrl(path));

  if (handlers.onOpen) {
    socket.addEventListener('open', handlers.onOpen);
  }
  if (handlers.onMessage) {
    socket.addEventListener('message', handlers.onMessage);
  }
  if (handlers.onClose) {
    socket.addEventListener('close', handlers.onClose);
  }
  if (handlers.onError) {
    socket.addEventListener('error', handlers.onError);
  }

  return socket;
};

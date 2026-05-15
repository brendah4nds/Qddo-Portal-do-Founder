import { io, Socket } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || 'https://vps.qddo.com.br';

let socket: Socket | null = null;

export function getSocket(token?: string): Socket {
  const tok = token || localStorage.getItem('jwt') || '';
  if (socket?.connected) return socket;
  if (socket) socket.disconnect();
  socket = io(API_URL, {
    auth: { token: tok },
    transports: ['polling', 'websocket'],
    reconnectionAttempts: 5,
  });
  return socket;
}

export function disconnectSocket(): void {
  if (socket) { socket.disconnect(); socket = null; }
}

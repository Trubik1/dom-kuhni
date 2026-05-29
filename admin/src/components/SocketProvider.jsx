import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';

const SocketContext = createContext(null);

const SOCKET_URL = import.meta.env.VITE_API_URL || '';

export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const s = io(SOCKET_URL, { withCredentials: true });

    s.on('connect', () => console.log('[Socket] Connected'));
    s.on('new-order', (order) => {
      toast.success(`🆕 Новая заявка #${order.orderId} — ${order.name}`, { duration: 5000 });
    });
    s.on('order-updated', (order) => {
      toast(`🔄 #${order.orderId} → ${order.status}`, { duration: 3000 });
    });

    setSocket(s);
    return () => s.disconnect();
  }, []);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);

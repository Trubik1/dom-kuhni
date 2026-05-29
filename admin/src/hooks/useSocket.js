import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';

const SOCKET_URL = import.meta.env.VITE_API_URL || '';

export default function useSocket({ onNewOrder, onOrderUpdated }) {
  const socketRef = useRef(null);

  useEffect(() => {
    const s = io(SOCKET_URL, { withCredentials: true });
    socketRef.current = s;

    s.on('connect', () => console.log('[Socket] Connected'));

    s.on('new-order', (order) => {
      toast.success(`🆕 Новая заявка #${order.orderId} — ${order.name}`, { duration: 5000 });
      if (onNewOrder) onNewOrder(order);
    });

    s.on('order-updated', (order) => {
      toast(`🔄 Заявка #${order.orderId} обновлена: ${order.status}`, { duration: 3000 });
      if (onOrderUpdated) onOrderUpdated(order);
    });

    s.on('disconnect', () => console.log('[Socket] Disconnected'));

    return () => { s.disconnect(); };
  }, []);

  return socketRef;
}

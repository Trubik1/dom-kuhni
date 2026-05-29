import { Server } from 'socket.io';

let io = null;

export function initSocket(httpServer, corsOrigin) {
  io = new Server(httpServer, {
    cors: { origin: corsOrigin, credentials: true },
  });

  io.on('connection', (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);
    socket.on('disconnect', () => {
      console.log(`[Socket] Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function emitNewOrder(order) {
  if (io) io.emit('new-order', order);
}

export function emitOrderUpdated(order) {
  if (io) io.emit('order-updated', order);
}

export function getIO() {
  return io;
}

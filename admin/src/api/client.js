import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// Auth
export const login = (email, password) =>
  api.post('/admin/auth/login', { email, password });

export const logout = () =>
  api.post('/admin/auth/logout');

export const checkAuth = () =>
  api.get('/admin/auth/me');

// Orders
export const getOrders = (params) =>
  api.get('/admin/orders', { params });

export const getOrder = (id) =>
  api.get(`/admin/orders/${id}`);

export const updateOrder = (id, data) =>
  api.patch(`/admin/orders/${id}`, data);

export const exportOrders = (filters) =>
  api.post('/admin/orders/export', filters, { responseType: 'blob' });

// Stats
export const getStats = () =>
  api.get('/admin/stats');

export default api;

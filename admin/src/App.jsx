import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { SocketProvider } from './components/SocketProvider';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Orders from './pages/Orders';
import Login from './pages/Login';

export default function App() {
  return (
    <>
      <Toaster position="top-right" toastOptions={{
        duration: 4000,
        style: { borderRadius: '12px', background: '#333', color: '#fff' },
      }} />

      <Routes>
        <Route path="/login" element={<Login />} />

        <Route path="/*" element={
          <ProtectedRoute>
            <SocketProvider>
              <Layout>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/orders" element={<Orders />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Layout>
            </SocketProvider>
          </ProtectedRoute>
        } />
      </Routes>
    </>
  );
}

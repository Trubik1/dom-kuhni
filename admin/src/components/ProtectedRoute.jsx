import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { checkAuth } from '../api/client';

export default function ProtectedRoute({ children }) {
  const [authed, setAuthed] = useState(null);

  useEffect(() => {
    checkAuth()
      .then(() => setAuthed(true))
      .catch(() => setAuthed(false));
  }, []);

  if (authed === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-10 w-10 border-4 border-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  return authed ? children : <Navigate to="/login" replace />;
}

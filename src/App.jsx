import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import RedCardForm from './pages/RedCardForm';
import RedCardReportPrint from './pages/RedCardReportPrint';

import { useEffect } from 'react';

// Protected Route Component
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { session, role } = useAuth();

  if (!session) return <Navigate to="/login" replace />;

  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

function App() {
  const { loading } = useAuth();

  useEffect(() => {
    const savedTheme = localStorage.getItem('etrr-theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  if (loading) return <div className="flex justify-center items-center h-screen bg-main text-[var(--text-primary)]">Cargando Sistema Docente...</div>;

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/tarjeta-roja" element={<RedCardForm />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reporte-5s"
        element={
          <ProtectedRoute>
            <RedCardReportPrint />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;

import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import BusinessManagerDashboard from './components/BusinessManagerDashboard';
import MarketingDashboard from './components/MarketingDashboard';
import { useAuth } from './contexts/AuthContext';
import './App.css';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { currentUser } = useAuth();
  return currentUser ? <>{children}</> : <Navigate to="/login" replace />;
}

interface PublicRouteProps {
  children: React.ReactNode;
}

const PublicRoute: React.FC<PublicRouteProps> = ({ children }) => {
  const { currentUser } = useAuth();
  return currentUser ? <Navigate to="/dashboard" replace /> : <>{children}</>;
}

const businessManagerEmails = [
  'businessowner@demo.com',
  'manager@demo.com'
];

const marketingEmails = [
    'marketing@demo.com',
    'customerexperience@demo.com'
];

// Updated helper component for conditional dashboard rendering
const ConditionalDashboard: React.FC = () => {
    const { currentUser } = useAuth();
    const userEmail = currentUser?.email || '';

    // Check for marketing users first
    if (currentUser && marketingEmails.includes(userEmail)) {
        console.log(`[ConditionalDashboard] Rendering MarketingDashboard for user: ${userEmail}`);
        return <MarketingDashboard />;
    }

    // Check for business manager users
    const isBusinessManager = currentUser && businessManagerEmails.includes(userEmail);
    if (isBusinessManager) {
        console.log(`[ConditionalDashboard] Rendering BusinessManagerDashboard for user: ${userEmail}`);
        return <BusinessManagerDashboard />;
    }

    // Fallback to the default dashboard for any other authenticated user
    console.log(`[ConditionalDashboard] Rendering default Dashboard for user: ${userEmail}`);
    return <Dashboard />;
};

function App() {
  const { currentUser, loading } = useAuth();

  React.useEffect(() => {
    console.log("[App.tsx] Auth state update. Loading:", loading, "CurrentUser:", currentUser);
  }, [currentUser, loading]);

  if (loading) {
      console.log("[App.tsx] Auth is loading, showing null...");
      return null; // Or a loading spinner component
  }

  console.log("[App.tsx] Rendering Routes. CurrentUser:", currentUser);

  return (
    <div className="App">
      <Routes>
        <Route
          path="/login"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <ConditionalDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/"
          element={currentUser ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />}
        />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </div>
  );
}

export default App;

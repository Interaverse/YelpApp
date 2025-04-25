import React from 'react';
// Remove useState and useEffect if no longer needed after removing localStorage logic
// import { useNavigate } from 'react-router-dom'; // Keep if other navigation is needed
import { signOut } from 'firebase/auth'; // Import signOut
import { useAuth } from '../contexts/AuthContext'; // Import useAuth
// Import 'auth' directly
import { auth } from '../firebaseConfig.ts'; // Assuming TS config provides the instance
import './Dashboard.css';
import InvestorDashboard from './InvestorDashboard'; // Import the new dashboard

// Placeholder for D3 charts - will be replaced later
const PlaceholderChart = ({ title }) => (
  <div className="chart-placeholder">
    <h3>{title}</h3>
    <p>(Chart placeholder - {title})</p>
  </div>
);

// Allowed emails for the investor/analyst dashboard
const investorAnalystEmails = [
  "investor@demo.com",
  "analyst@demo.com",
];

function Dashboard() {
  // Remove navigation and local state for role/username based on localStorage
  // const navigate = useNavigate();
  // const [userRole, setUserRole] = useState('');
  // const [username, setUsername] = useState('');

  const { currentUser } = useAuth(); // Get user from context

  // Remove useEffect checking localStorage
  // useEffect(() => { ... }, [navigate]);

  const handleLogout = async () => {
    // localStorage.removeItem('userRole'); // Remove localStorage calls
    // localStorage.removeItem('username');
    try {
      // Use the imported 'auth' object directly
      await signOut(auth);
      // Auth state listener in AuthContext will handle UI changes
      console.log('User logged out');
    } catch (error) {
      console.error('Logout Error:', error);
      // Handle logout errors if necessary
    }
  };

  // Simplify content rendering - remove role-based logic for now
  // Function to render content based on user role
  // const renderDashboardContent = () => { ... };

  // Display loading or user info
  if (!currentUser) {
    // This should ideally not happen if ProtectedRoute works correctly,
    // but it's good practice to handle the null case.
    return <div>Loading user information...</div>;
  }

  // Check if the current user's email is allowed
  const showInvestorDashboard = investorAnalystEmails.includes(currentUser.email);

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>Yelp Analytics Dashboard</h1>
        <div className="user-info">
          {/* Display user email from Firebase Auth */}
          <span>Welcome, {currentUser.email}</span>
          <button onClick={handleLogout} className="logout-button">Logout</button>
        </div>
      </header>
      <main className="dashboard-content">
        {showInvestorDashboard ? (
          <InvestorDashboard />
        ) : (
          // Default content for other users
          <>
            <h2>Your Dashboard</h2>
            <PlaceholderChart title="Default Chart 1" />
            <PlaceholderChart title="Default Chart 2" />
            <PlaceholderChart title="Default Chart 3" />
          </>
        )}
        {/* {renderDashboardContent()} // Removed role-specific rendering */}
      </main>
      <footer className="dashboard-footer">
        <p>&copy; 2024 Yelp Web App Demo</p>
      </footer>
    </div>
  );
}

export default Dashboard; 
import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
// Import 'auth' directly
import { auth } from '../firebaseConfig.ts'; // Assuming TS config provides the instance
import './Login.css';

// List of predefined demo emails
const demoEmails = [
  "admin@demo.com",
  "analyst@demo.com",
  "customerexperience@demo.com",
  "manager@demo.com",
  "businessowner@demo.com",
  "investor@demo.com",
  "marketing@demo.com",
];

function Login() {
  // Use state for the selected email from the dropdown
  const [selectedEmail, setSelectedEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false); // Add loading state back if needed

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Use selectedEmail from state
    if (!selectedEmail || !password) {
      setError('Please select an email and enter the password.');
      setLoading(false);
      return;
    }

    try {
      // Use selectedEmail from the dropdown state
      await signInWithEmailAndPassword(auth, selectedEmail, password);
      console.log('Login successful for:', selectedEmail);
      // App.tsx handles redirection via AuthContext
    } catch (err) {
      console.error("Login Error:", err);
      let friendlyError = 'Failed to login. Please check your credentials.';
      // Add more specific Firebase error handling if desired
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        friendlyError = 'Invalid email or password.';
      } else if (err.code === 'auth/invalid-email') {
        friendlyError = 'Invalid email format selected.';
      }
      setError(friendlyError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <form className="login-form" onSubmit={handleLogin}>
        <h2>Login</h2>
        <p>Select your email and enter the password (any password works for demo).</p>
        {error && <p className="error-message">{error}</p>}
        <div className="form-group">
          <label htmlFor="email">Email:</label>
          {/* Restore the select dropdown */}
          <select
            id="email"
            value={selectedEmail}
            onChange={(e) => setSelectedEmail(e.target.value)}
            required
          >
            <option value="" disabled>-- Select Email --</option>
            {demoEmails.map((email) => (
              <option key={email} value={email}>
                {email}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="password">Password:</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit" className="login-button" disabled={loading}>
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>
    </div>
  );
}

export default Login; 
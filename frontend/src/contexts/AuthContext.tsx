// frontend/src/contexts/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
// Import 'auth' directly instead of 'getFirebaseAuth'
import { auth } from '../firebaseConfig.ts';

// Remove the top-level log for the direct import
// console.log("AuthContext: Imported auth object", auth);

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
}

// Provide a default value matching the context type
const AuthContext = createContext<AuthContextType>({ currentUser: null, loading: true });

export function useAuth() {
  return useContext(AuthContext);
}

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Use the imported 'auth' object directly
    const unsubscribe = onAuthStateChanged(auth, user => {
      console.log("Auth state changed, user:", user);
      setCurrentUser(user);
      setLoading(false);
    });

    return unsubscribe; // Cleanup subscription on unmount
  }, []);

  const value = {
    currentUser,
    loading,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}; 
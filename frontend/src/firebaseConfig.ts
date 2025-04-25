// frontend/src/firebaseConfig.ts
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
// TODO: Add other Firebase services imports here if needed (e.g., getFunctions)

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
// Load config from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Basic check to ensure variables are loaded
if (!firebaseConfig.apiKey) {
  console.error("Firebase API Key is not configured. Check your .env file or environment variables.");
  // You might want to throw an error or handle this more gracefully
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize other Firebase services as needed
const analytics = typeof window !== "undefined" && firebaseConfig.measurementId ? getAnalytics(app) : null;
const auth = getAuth(app);
const db = getFirestore(app);

// Export the initialized app and other services
export { app, auth, db, analytics }; 
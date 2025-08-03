
// Import the functions you need from the SDKs you need
import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore"; // Import enableIndexedDbPersistence
import { getStorage } from "firebase/storage"; // Import getStorage

// TODO: Add SDKs for Analytics and Performance
// Your web app's Firebase configuration
// Use process.env to access environment variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Function to initialize Firebase
const initializeFirebaseApp = () => {
  if (!getApps().length) {
    // Check if essential Firebase config keys are present
    if (
      firebaseConfig.apiKey &&
      firebaseConfig.authDomain &&
      firebaseConfig.projectId
    ) {
      console.log("Firebase config found, initializing app...");
      try {
        return initializeApp(firebaseConfig);
      } catch (error) {
        console.error("Error initializing Firebase App:", error);
        return null; // Return null if initialization fails
      }
    } else {
      console.error(
        "Firebase API Key, Auth Domain, or Project ID is missing. Firebase will not be initialized."
      );
      // Log which specific keys might be missing for easier debugging
      if (!firebaseConfig.apiKey) console.error(" - Missing NEXT_PUBLIC_FIREBASE_API_KEY");
      if (!firebaseConfig.authDomain) console.error(" - Missing NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN");
      if (!firebaseConfig.projectId) console.error(" - Missing NEXT_PUBLIC_FIREBASE_PROJECT_ID");
      return null; // Return null if config is missing
    }
  } else {
    console.log("Firebase app already initialized.");
    return getApp();
  }
};

// Initialize Firebase
const app = initializeFirebaseApp();

// Initialize Firebase services only if the app was successfully initialized
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
export const storage = app ? getStorage(app) : null; // Export storage instance

// Enable offline persistence if db is available and running in a browser environment
if (db && typeof window !== 'undefined') {
  enableIndexedDbPersistence(db)
    .then(() => console.log("Firebase offline persistence enabled."))
    .catch((err) => {
       if (err.code === 'failed-precondition') {
         console.warn("Firebase Persistence: Multiple tabs open, persistence can only be enabled in one tab at a time.");
       } else if (err.code === 'unimplemented') {
         console.warn("Firebase Persistence: The current browser does not support all of the features required to enable persistence.");
       } else {
         console.error("Firebase Persistence: Error enabling offline persistence: ", err);
       }
    });
} else if (!db) {
    console.warn("Firestore DB instance is not available. Offline persistence disabled.");
} else {
    // console.log("Not enabling offline persistence (not in browser environment).");
}

// Log whether services were initialized successfully
if (!auth) console.warn("Firebase Auth service could not be initialized.");
if (!db) console.warn("Firestore service could not be initialized.");
if (!storage) console.warn("Firebase Storage service could not be initialized.");

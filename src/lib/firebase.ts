
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore"; // Added Firestore import
import { getStorage, type FirebaseStorage } from "firebase/storage"; // Added Storage import

const firebaseConfig = {
  apiKey: process.env.AIzaSyANGzoTb8oH3TFUW4rOtU5EU1hcWeaZYBE,
  authDomain: process.env.fe-timesheets-29db8.firebaseapp.com,
  projectId: process.env.fe-timesheets-29db8,
  storageBucket: process.env.fe-timesheets-29db8.firebasestorage.app,
  messagingSenderId: process.env.211160800558,
  appId: process.env.1:211160800558:web:4914a7a45626e0c7a56ebf,
  measurementId: process.env.G-SYMGJ10B8W, // Optional
};

// Initialize Firebase
let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

const auth: Auth = getAuth(app);
const db: Firestore = getFirestore(app); // Initialize Firestore
const storage: FirebaseStorage = getStorage(app); // Initialize Storage

export { app, auth, db, storage }; // Export db and storage

import admin from 'firebase-admin';
import { getApps } from 'firebase-admin/app';

// Initialize Firebase Admin SDK
if (!getApps().length) {
  // For now, use the public project ID until service account is set up
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  
  console.log('Firebase Admin - Project ID:', projectId);
  console.log('Firebase Admin - Has Private Key:', !!process.env.FIREBASE_PRIVATE_KEY);
  console.log('Firebase Admin - Has Client Email:', !!process.env.FIREBASE_CLIENT_EMAIL);

  if (!process.env.FIREBASE_PRIVATE_KEY || !process.env.FIREBASE_CLIENT_EMAIL) {
    console.error('Missing Firebase Admin credentials. Please set FIREBASE_PRIVATE_KEY and FIREBASE_CLIENT_EMAIL in your environment variables.');
    throw new Error('Firebase Admin credentials not configured');
  }

  const serviceAccount = {
    type: "service_account",
    project_id: projectId,
    private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
  };

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as any),
    projectId: projectId,
  });
}

// Exports
export const authAdmin = admin.auth();
export const dbAdmin = admin.firestore();

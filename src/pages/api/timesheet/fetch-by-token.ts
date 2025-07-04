import type { NextApiRequest, NextApiResponse } from 'next';
import { getFirestore } from 'firebase-admin/firestore';
import { getApp, getApps, initializeApp, cert } from 'firebase-admin/app';

// Initialize Firebase Admin if not already initialized
if (!getApps().length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY as string);
  initializeApp({
    credential: cert(serviceAccount),
  });
}

const db = getFirestore();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ error: 'Missing token' });
  }

  // Find the timesheet with this token
  const snapshot = await db.collection('timeEntries').where('clientApproval.token', '==', token).limit(1).get();
  if (snapshot.empty) {
    return res.status(404).json({ error: 'Invalid or expired token' });
  }
  const timesheet = snapshot.docs[0].data();
  const approval = timesheet.clientApproval;
  if (!approval || approval.used) {
    return res.status(400).json({ error: 'Token already used' });
  }
  if (approval.expiresAt && approval.expiresAt.toDate && approval.expiresAt.toDate() < new Date()) {
    return res.status(400).json({ error: 'Token expired' });
  }

  // Only return safe fields
  const safeTimesheet = {
    entryDate: timesheet.entryDate,
    technicianId: timesheet.technicianId,
    taskNotes: timesheet.taskNotes,
    status: timesheet.status,
  };

  return res.status(200).json({ timesheet: safeTimesheet });
}

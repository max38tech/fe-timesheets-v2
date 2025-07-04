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

  const { token, action, note, name, email } = req.body;
  if (!token || !action || !name || !email) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  if (!['approve', 'reject'].includes(action)) {
    return res.status(400).json({ error: 'Invalid action' });
  }

  // Find the timesheet with this token
  const snapshot = await db.collection('timeEntries').where('clientApproval.token', '==', token).limit(1).get();
  if (snapshot.empty) {
    return res.status(404).json({ error: 'Invalid or expired token' });
  }
  const timesheetRef = snapshot.docs[0].ref;
  const timesheet = snapshot.docs[0].data();

  // Validate token
  const approval = timesheet.clientApproval;
  if (!approval || approval.used) {
    return res.status(400).json({ error: 'Token already used' });
  }
  if (approval.expiresAt && approval.expiresAt.toDate && approval.expiresAt.toDate() < new Date()) {
    return res.status(400).json({ error: 'Token expired' });
  }

  // Update timesheet based on action
  if (action === 'approve') {
    await timesheetRef.update({
      status: 'client-approved',
      'clientApproval.used': true,
      'clientApproval.approvedBy': { name, email },
      'clientApproval.actionAt': new Date(),
    });
    return res.status(200).json({ success: true, status: 'client-approved' });
  } else {
    if (!note) {
      return res.status(400).json({ error: 'Rejection note required' });
    }
    await timesheetRef.update({
      status: 'client-rejected',
      'clientApproval.used': true,
      'clientApproval.rejectedBy': { name, email },
      'clientApproval.rejectionNote': note,
      'clientApproval.actionAt': new Date(),
    });
    return res.status(200).json({ success: true, status: 'client-rejected' });
  }
}

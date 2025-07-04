import type { NextApiRequest, NextApiResponse } from 'next';
import { getFirestore } from 'firebase-admin/firestore';
import { getApp, getApps, initializeApp, cert } from 'firebase-admin/app';
import crypto from 'crypto';
import nodemailer from 'nodemailer';

// Initialize Firebase Admin if not already initialized
if (!getApps().length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY as string);
  initializeApp({
    credential: cert(serviceAccount),
  });
}

const db = getFirestore();

// Helper to generate a secure random token
function generateToken(length = 48) {
  return crypto.randomBytes(length).toString('hex');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { timesheetId } = req.body;
  if (!timesheetId) {
    return res.status(400).json({ error: 'Missing timesheetId' });
  }

  // Fetch the timesheet
  const timesheetRef = db.collection('timeEntries').doc(timesheetId);
  const timesheetSnap = await timesheetRef.get();
  if (!timesheetSnap.exists) {
    return res.status(404).json({ error: 'Timesheet not found' });
  }
  const timesheet = timesheetSnap.data();
  if (!timesheet) {
    return res.status(404).json({ error: 'Timesheet not found' });
  }

  // Fetch location for contact info
  const locationRef = db.collection('locations').doc(timesheet.locationId);
  const locationSnap = await locationRef.get();
  if (!locationSnap.exists) {
    return res.status(404).json({ error: 'Location not found' });
  }
  const location = locationSnap.data();
  if (!location) {
    return res.status(404).json({ error: 'Location not found' });
  }

  // Generate approval token
  const token = generateToken(24);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  // Update timesheet with approval info
  await timesheetRef.update({
    status: 'client-pending',
    clientApproval: {
      token,
      expiresAt,
      used: false,
    },
  });

  // Send email to client contact
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.APPROVAL_EMAIL_USER,
      pass: process.env.APPROVAL_EMAIL_PASS,
    },
  });

  const approvalUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/approve-timesheet?token=${token}`;
  const mailOptions = {
    from: process.env.APPROVAL_EMAIL_USER,
    to: location.contactEmail,
    subject: 'Timesheet Approval Request',
    text: `A timesheet is awaiting your approval. Please review and approve or reject it here: ${approvalUrl}\nThis link will expire in 24 hours.`,
  };

  console.log("Attempting to send approval email to:", location.contactEmail);
  console.log("Approval URL:", approvalUrl);

  try {
    await transporter.sendMail(mailOptions);
    console.log("Approval email sent successfully.");
  } catch (error) {
    console.error("Error sending approval email:", error);
    return res.status(500).json({ error: "Failed to send approval email", details: error });
  }

  return res.status(200).json({ success: true });
}

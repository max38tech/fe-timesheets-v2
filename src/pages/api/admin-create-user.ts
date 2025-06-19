import type { NextApiRequest, NextApiResponse } from 'next';
import { authAdmin, dbAdmin } from '@/lib/firebaseAdmin';

interface ResponseData {
  uid?: string;
  code?: string;
  message?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { email, password, displayName, role } = req.body;

  try {
    const userRecord = await authAdmin.createUser({ email, password, displayName });
    await dbAdmin.collection('users').doc(userRecord.uid).set({ displayName, email, role, status: 'active' });
    return res.status(200).json({ uid: userRecord.uid });
  } catch (e: any) {
    console.error('adminCreateUser error:', e);
    return res.status(400).json({ code: e.code, message: e.message });
  }
}

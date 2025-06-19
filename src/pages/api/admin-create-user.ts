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
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ message: 'Method not allowed' });
    }

    const { email, password, displayName, role } = req.body;

    console.log('Creating user with:', { email, displayName, role });

    const userRecord = await authAdmin.createUser({ email, password, displayName });
    console.log('User created:', userRecord.uid);
    
    await dbAdmin.collection('users').doc(userRecord.uid).set({ displayName, email, role, status: 'active' });
    console.log('User document created in Firestore');
    
    return res.status(200).json({ uid: userRecord.uid });
  } catch (e: any) {
    console.error('adminCreateUser error:', e);
    console.error('Error details:', {
      code: e.code,
      message: e.message,
      stack: e.stack
    });
    return res.status(500).json({ 
      code: e.code || 'UNKNOWN_ERROR', 
      message: e.message || 'An unknown error occurred' 
    });
  }
}

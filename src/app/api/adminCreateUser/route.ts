import { NextResponse } from 'next/server';
import { authAdmin, dbAdmin } from '@/lib/firebaseAdmin';

export async function POST(request: Request) {
  try {
    const { email, password, displayName, role } = await request.json();
    // TODO: verify admin privileges via secure token or session
    const userRecord = await authAdmin.createUser({ email, password, displayName });
    await dbAdmin.collection('users').doc(userRecord.uid).set({
      displayName,
      email,
      role,
      status: 'active',
    });
    return NextResponse.json({ uid: userRecord.uid }, { status: 200 });
  } catch (error: any) {
    console.error('adminCreateUser route error:', error);
    const code = error.code || 'unknown_error';
    const message = error.message || 'An error occurred';
    return NextResponse.json({ code, message }, { status: 400 });
  }
}

import { NextResponse } from 'next/server';
import { db, auth, isAdminInitialized } from '@/lib/firebase-admin';
import admin from 'firebase-admin';

export async function POST(req: Request) {
  if (!isAdminInitialized()) {
    return NextResponse.json({ error: 'Server configuration error: Admin SDK not initialized' }, { status: 500 });
  }

  try {
    const body = await req.json();
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

    if (!token) {
      return NextResponse.json({ error: 'Missing Authorization token' }, { status: 401 });
    }

    // Verify token and get uid
    const decoded = await auth.verifyIdToken(token);
    const uid = decoded.uid;

    // Check role
    const userDoc = await db.collection('users').doc(uid).get();
    const userData = userDoc.exists ? userDoc.data() : null;
    const role = userData?.role || 'user';
    if (!(role === 'manager' || role === 'admin')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Validate payload (minimal checks)
    const {
      name,
      description = null,
      latitude,
      longitude,
      address = null,
      imageUrls = [],
      pricePerHour,
      attributes = {},
      slotConfig,
    } = body;

    if (!name || !pricePerHour || !slotConfig) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Create venue doc (server-side)
    const venueRef = await db.collection('venues').add({
      name: name.trim(),
      description: description ? description.trim() : null,
      latitude: latitude || null,
      longitude: longitude || null,
      address: address ? address.trim() : null,
      imageUrls,
      pricePerHour: parseFloat(pricePerHour),
      attributes,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      managedBy: uid,
    });

    // Initialize venueSlots document
    const venueSlots = {
      venueId: venueRef.id,
      config: {
        ...slotConfig,
        timezone: slotConfig.timezone || 'Asia/Kathmandu',
      },
      blocked: [],
      bookings: [],
      held: [],
      reserved: [],
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await db.collection('venueSlots').doc(venueRef.id).set(venueSlots);

    return NextResponse.json({ id: venueRef.id }, { status: 201 });
  } catch (err: any) {
    console.error('Create venue (server) error:', err);
    return NextResponse.json({ error: err?.message || 'Internal server error' }, { status: 500 });
  }
}

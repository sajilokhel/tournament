/*
 * PATCH /api/venues/:id
 *
 * Description:
 *   Update a venue's editable fields. This endpoint is intended for venue
 *   managers or admins to update venue metadata such as name, description,
 *   pricing and geolocation. The route uses the Admin SDK to verify the
 *   caller (via ID token) and to perform the update on the server-side
 *   Firestore document.
 *
 * Authentication & Authorization:
 *   - Requires an Authorization header: `Authorization: Bearer <idToken>`
 *   - The idToken is verified using the Admin SDK. The caller must be either:
 *       * a user with role `admin`, or
 *       * the manager of the venue (venue.managedBy === callerUid)
 *
 * Request:
 *   - Method: PATCH
 *   - Path param:
 *       - id: string (venue document id)
 *   - Body (JSON): only whitelisted fields will be applied
 *       {
 *         "name": string,                 // optional
 *         "description": string | null,   // optional
 *         "pricePerHour": number,         // optional
 *         "imageUrls": string[],          // optional
 *         "attributes": object,           // optional
 *         "address": string | null,       // optional
 *         "latitude": number | null,      // optional
 *         "longitude": number | null      // optional
 *       }
 *
 * Successful Response (200):
 *   { ok: true }
 *
 * Failure responses (examples):
 *   - 401 Missing/Invalid Authorization token
 *     { error: 'Missing Authorization token' } or { error: 'Missing Authorization token' }
 *
 *   - 403 Insufficient permissions (caller not admin or manager)
 *     { error: 'Insufficient permissions' }
 *
 *   - 404 Venue not found
 *     { error: 'Venue not found' }
 *
 *   - 400 Bad Request (if body malformed) - current implementation returns 500 for general errors.
 *
 *   - 500 Internal Server Error
 *     { error: '<error message>' }
 *
 * Behavior / Side-effects:
 *   - Verifies Admin SDK is initialized.
 *   - Verifies Bearer token and resolves caller uid.
 *   - Loads `venues/{id}` document and checks existence.
 *   - Confirms caller privileges (admin or venue manager).
 *   - Applies only whitelisted fields to the venue document, sets `updatedAt` server timestamp.
 *
 * Notes / Edge cases:
 *   - Only whitelisted fields are allowed; other fields are ignored.
 *   - Timezone / locale handling for any date fields (none currently) should be handled by callers.
 *   - Caller role is read from `users/{uid}` doc; a missing user doc will default to `user`.
 *
 * Example:
 *   PATCH /api/venues/abc123
 *   Authorization: Bearer <idToken>
 *   Body:
 *     { "name": "New Venue Name", "pricePerHour": 900 }
 *
 *   Response:
 *     { "ok": true }
 */
import { NextResponse } from "next/server";
import { db, auth, isAdminInitialized } from "@/lib/firebase-admin";
import admin from "firebase-admin";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  if (!isAdminInitialized()) {
    return NextResponse.json(
      { error: "Server configuration error: Admin SDK not initialized" },
      { status: 500 },
    );
  }

  try {
    const venueId = params.id;
    const body = await req.json();
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : null;
    if (!token)
      return NextResponse.json(
        { error: "Missing Authorization token" },
        { status: 401 },
      );

    const decoded = await auth.verifyIdToken(token);
    const uid = decoded.uid;

    // Fetch venue to check manager
    const venueRef = db.collection("venues").doc(venueId);
    const venueSnap = await venueRef.get();
    if (!venueSnap.exists)
      return NextResponse.json({ error: "Venue not found" }, { status: 404 });

    const venueData = venueSnap.data() as any;

    // Allow if admin or manager of this venue
    const userDoc = await db.collection("users").doc(uid).get();
    const userRole = userDoc.exists ? (userDoc.data() as any).role : "user";
    const isAdminUser = userRole === "admin";
    const isManager = venueData.managedBy === uid;
    if (!(isAdminUser || isManager)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 },
      );
    }

    // Whitelist allowed fields
    const allowedFields = [
      "name",
      "description",
      "pricePerHour",
      "imageUrls",
      "attributes",
      "address",
      "latitude",
      "longitude",
    ];
    const updatePayload: any = {};
    for (const k of allowedFields) {
      if (body[k] !== undefined) updatePayload[k] = body[k];
    }

    updatePayload.updatedAt = admin.firestore.FieldValue.serverTimestamp();

    await venueRef.update(updatePayload);

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: any) {
    console.error("Venue update (server) error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 },
    );
  }
}

/*
 * POST /api/users/upsert
 *
 * Description:
 *   Create or update the authenticated user's profile in Firestore (`users/{uid}`).
 *   This endpoint upserts basic profile fields and updates `lastSeen`. If the user
 *   document does not exist it will be created with `createdAt`. Assigning the role
 *   `"manager"` via the request body is only allowed when the caller is an admin.
 *
 * Authentication:
 *   - Requires header: Authorization: Bearer <idToken>
 *   - The idToken is verified server-side and the token's `uid` is used as the
 *     document id for the `users` collection.
 *
 * Request (JSON body):
 *   {
 *     "displayName"?: string,
 *     "email"?: string,
 *     "photoURL"?: string,
 *     "role"?: "user" | "manager"
 *   }
 *
 * Behavior / Side-effects:
 *   - Verifies `idToken` via Firebase Admin `auth.verifyIdToken`.
 *   - Determines the uid from the decoded token (caller).
 *   - If `role === "manager"`, reads `users/{callerUid}` and only assigns `manager`
 *     if the caller's existing role is `"admin"`.
 *   - Writes/merges the provided fields into `users/{uid}` and sets `lastSeen` to
 *     server timestamp. If creating a new user document, sets `createdAt` and the
 *     decided `role`.
 *
 * Success Response:
 *   - 200 OK
 *     { "ok": true }
 *
 * Error Responses:
 *   - 401 Unauthorized
 *     { "error": "Unauthorized" }             // missing or invalid token
 *     { "error": "Invalid token" }            // token verification failed
 *   - 500 Internal Server Error
 *     { "error": "Internal server error" }    // unexpected failures
 *
 * Notes / Edge cases:
 *   - If reading the caller's user doc to validate admin status fails, the code
 *     will skip assigning the `manager` role (it falls back to `"user"`).
 *   - The request body fields are optional; absent fields will be taken from the
 *     decoded token where possible (email/name/picture) or left null.
 *   - This route always trusts the verified token's uid as the target user id and
 *     does not accept an explicit `uid` in the request body.
 */
import { NextRequest, NextResponse } from "next/server";
import { db, isAdminInitialized } from "@/lib/firebase-admin";
import { verifyRequestToken, getUserRole } from "@/lib/server/auth";

export async function POST(request: NextRequest) {
  if (!isAdminInitialized()) {
    return NextResponse.json(
      { error: "Server not configured" },
      { status: 500 },
    );
  }

  try {
    const body = await request.json();
    const { displayName, email, photoURL, role } = body;

    // Authenticate user
    const authResult = await verifyRequestToken(request);
    if (authResult instanceof NextResponse) return authResult;
    const uid = authResult.uid;

    // Determine role: default to 'user'. Only allow assigning 'manager' if caller is admin.
    let assignedRole = "user";
    if (role === "manager") {
      // Check if caller has admin privileges
      try {
        const callerRole = await getUserRole(uid);
        if (callerRole === "admin") {
          assignedRole = "manager";
        }
      } catch (err) {
        console.warn(
          "Failed to verify caller role for manager assignment",
          err,
        );
      }
    }

    const userRef = db.collection("users").doc(uid);
    const snap = await userRef.get();

    const base: any = {
      email: email || decoded.email || null,
      displayName: displayName || decoded.name || null,
      photoURL: photoURL || decoded.picture || null,
      lastSeen: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (!snap.exists) {
      await userRef.set({
        ...base,
        role: assignedRole,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      await userRef.set(base, { merge: true });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("/api/users/upsert error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

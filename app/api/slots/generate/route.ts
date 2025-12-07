/**
 * POST /api/slots/generate
 *
 * Description:
 *   Generate slots for a venue across a daily time range for a number of days.
 *   This endpoint delegates the actual generation logic to the server-side helper
 *   `generateSlots` which creates/updates canonical slot documents and the
 *   `venueSlots` canonical structure.
 *
 * Authentication / Authorization:
 *   - Requires an Authorization header with a Bearer idToken.
 *   - Caller must be a user with role `manager` or `admin`. The token is verified
 *     with Firebase Admin SDK and the user's role is checked in `users/{uid}`.
 *
 * Request (JSON body):
 *   {
 *     "venueId": string,       // required - Firestore venue id
 *     "startTime": "HH:mm",    // required - e.g. "08:00"
 *     "endTime": "HH:mm",      // required - e.g. "22:00"
 *     "slotDuration": number,  // optional - minutes per slot (default: 60)
 *     "days": number           // optional - number of days to generate (default: 7)
 *   }
 *
 * Successful Response:
 *   - Status: 200
 *   - Body: { ok: true }
 *
 * Error Responses (examples):
 *   - 400 Bad Request
 *     { error: "Missing fields" }
 *     When required fields (venueId, startTime or endTime) are missing.
 *
 *   - 401 Unauthorized
 *     { error: "Unauthorized" }  // missing/invalid Authorization header
 *     { error: "Invalid token" } // token verification failed
 *
 *   - 403 Forbidden
 *     { error: "Forbidden" }
 *     When the caller is authenticated but does not have manager/admin role.
 *
 *   - 500 Internal Server Error
 *     { error: "Server not configured" }
 *     { error: "Internal server error" }
 *     For Admin SDK misconfiguration or unexpected exceptions during generation.
 *
 * Side effects:
 *   - Creates/updates slot documents and the `venueSlots` canonical document.
 *   - This is a destructive/creating operation; call only when you intend to
 *     modify the venue's slot schedule.
 *
 * Notes / Edge cases:
 *   - The endpoint trusts the `startTime` / `endTime` string format; the helper
 *     will decide how to interpret these in the venue timezone.
 *   - Idempotency is determined by `generateSlots` implementation. Avoid calling
 *     repeatedly without understanding the helper behavior.
 */
import { NextRequest, NextResponse } from "next/server";
import admin from "firebase-admin";
import { db, auth, isAdminInitialized } from "@/lib/firebase-admin";
import { generateSlots } from "@/lib/slotService.admin";

async function callerIsManagerOrAdmin(uid: string) {
  try {
    const doc = await db.collection("users").doc(uid).get();
    if (!doc.exists) return false;
    const r = doc.data()?.role;
    return r === "manager" || r === "admin";
  } catch (e) {
    console.warn("Failed to check caller role", e);
    return false;
  }
}

function getSlotId(groundId: string, date: string, startTime: string) {
  return `${groundId}_${date}_${startTime.replace(":", "")}`;
}

export async function POST(request: NextRequest) {
  if (!isAdminInitialized()) {
    return NextResponse.json(
      { error: "Server not configured" },
      { status: 500 },
    );
  }

  try {
    const body = await request.json();
    const { venueId, startTime, endTime, slotDuration = 60, days = 7 } = body;
    if (!venueId || !startTime || !endTime)
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });

    const authHeader = request.headers.get("authorization") || "";
    const match = authHeader.match(/^Bearer (.*)$/);
    if (!match)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const idToken = match[1];

    let decoded: admin.auth.DecodedIdToken;
    try {
      decoded = await auth.verifyIdToken(idToken);
    } catch (err) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const uid = decoded.uid;
    const allowed = await callerIsManagerOrAdmin(uid);
    if (!allowed)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Delegate generation logic to server helper
    await generateSlots(venueId, startTime, endTime, slotDuration, days);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("/api/slots/generate error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

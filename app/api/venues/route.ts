/**
 * POST /api/venues
 *
 * Description:
 *   Create a new venue document and initialize its canonical `venueSlots`
 *   document. This route is intended for venue managers or administrators
 *   to register a new playing ground in the system.
 *
 * Authentication / Authorization:
 *   - Requires Authorization: Bearer <idToken>
 *   - Caller must be a user with role 'manager' or 'admin' in `users/{uid}`.
 *
 * Request body (JSON):
 *   {
 *     "name": string,                 // required
 *     "pricePerHour": number|string,  // required (string accepted if coming from form)
 *     "slotConfig": object,           // required (slot config used to initialize venueSlots.config)
 *     "description": string|null,
 *     "latitude": number|null,
 *     "longitude": number|null,
 *     "address": string|null,
 *     "imageUrls": string[],          // optional array of image urls
 *     "attributes": object            // optional arbitrary attributes
 *   }
 *
 * Successful response:
 *   - 201 Created
 *     Body: { id: string }  // newly created venue document id
 *
 * Client / validation errors:
 *   - 400 Bad Request
 *     { error: 'Missing required fields' }
 *     When `name`, `pricePerHour` or `slotConfig` is not present.
 *   - 401 Unauthorized
 *     { error: 'Missing Authorization token' } or { error: 'Invalid token' }
 *     When Authorization header missing or token cannot be verified.
 *   - 403 Forbidden
 *     { error: 'Insufficient permissions' }
 *     When the authenticated user's role is not `manager` or `admin`.
 *
 * Server errors:
 *   - 500 Internal Server Error
 *     { error: '<message>' }
 *
 * Side-effects & notes:
 *   - Creates a `venues/{venueId}` document with provided fields and sets
 *     `managedBy` to the creating user's uid and `createdAt` server timestamp.
 *   - Initializes `venueSlots/{venueId}` with a canonical structure:
 *       {
 *         venueId, config: { ...slotConfig, timezone }, blocked: [], bookings: [], held: [], reserved: [], updatedAt
 *       }
 *     The timezone defaults to 'Asia/Kathmandu' if not provided in slotConfig.
 *   - `pricePerHour` is coerced to a number using `parseFloat`. Ensure the
 *     client sends a numeric value (or parseable string).
 *
 * Example:
 *   Request:
 *     POST /api/venues
 *     Authorization: Bearer <token>
 *     Body:
 *     {
 *       "name": "Green Field",
 *       "pricePerHour": 500,
 *       "slotConfig": { "slotDuration": 60, "timezone": "Asia/Kathmandu" }
 *     }
 *
 *   Success Response:
 *     201 { "id": "abcd1234" }
 *
 * Implementation notes:
 *   - This route depends on the Admin SDK being initialized. If the Admin
 *     SDK is not initialized, it returns a 500 with a clear error message.
 *   - Minimal server-side validation is performed. If you need stricter
 *     validation (types/formats/coordinate ranges), add additional checks
 *     before creating the document.
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { DEFAULT_TIMEZONE, COLLECTIONS } from "@/lib/utils";
import { DEFAULT_ADVANCE_PERCENT } from "@/lib/pricing";
import { verifyRequestToken, getUserRole, requireAdminSDK } from "@/lib/server/auth";
import { SPORT_TYPES, type SportType } from "@/lib/sports";

export async function POST(req: Request) {
  const sdkError = requireAdminSDK();
  if (sdkError) return sdkError;

  try {
    const body = await req.json();
    const authResult = await verifyRequestToken(req);
    if (authResult instanceof NextResponse) return authResult;
    const { uid } = authResult;

    // Check role
    const role = await getUserRole(uid);
    if (!(role === "manager" || role === "admin")) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 },
      );
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
      advancePercentage,
      platformCommission,
      attributes = {},
      slotConfig,
      sportType,
    } = body;

    if (!name || pricePerHour === undefined || pricePerHour === null || !slotConfig) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Create venue doc (server-side)
    const venueRef = await db.collection(COLLECTIONS.VENUES).add({
      name: name.trim(),
      description: description ? description.trim() : null,
      sportType: SPORT_TYPES.includes(sportType) ? (sportType as SportType) : "futsal",
      latitude: latitude || null,
      longitude: longitude || null,
      address: address ? address.trim() : null,
      imageUrls,
      pricePerHour: parseFloat(pricePerHour),
      advancePercentage: typeof advancePercentage === 'number'
        ? Math.max(0, Math.min(100, advancePercentage))
        : DEFAULT_ADVANCE_PERCENT,
      platformCommission: typeof platformCommission === 'number'
        ? Math.max(0, Math.min(100, platformCommission))
        : 0,
      attributes,
      createdAt: FieldValue.serverTimestamp(),
      managedBy: uid,
    });

    // Initialize venueSlots document
    const venueSlots = {
      venueId: venueRef.id,
      config: {
        ...slotConfig,
        timezone: slotConfig.timezone || DEFAULT_TIMEZONE,
      },
      blocked: [],
      bookings: [],
      held: [],
      reserved: [],
      updatedAt: FieldValue.serverTimestamp(),
    };

    await db.collection(COLLECTIONS.VENUE_SLOTS).doc(venueRef.id).set(venueSlots);

    return NextResponse.json({ id: venueRef.id }, { status: 201 });
  } catch (err: any) {
    console.error("Create venue (server) error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 },
    );
  }
}

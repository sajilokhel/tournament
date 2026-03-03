/**
 * POST /api/venues/:id/reviews
 *
 * Description:
 *   Create or update a user's review for a venue, add a comment sub-document
 *   under `venues/{venueId}/comments`, and update venue aggregate rating
 *   (averageRating and reviewCount). Optionally marks the related booking as
 *   rated when `bookingId` is provided.
 *
 * Authentication:
 *   - Requires a valid Firebase ID token in the `Authorization: Bearer <token>` header.
 *   - The token is verified via Admin SDK. The review is attributed to the
 *     verified token uid and displayName (decoded token `name`/`email`).
 *
 * Request:
 *   - Method: POST
 *   - Path params:
 *       - id (string) - Venue document id
 *   - Body (JSON):
 *       {
 *         "rating": number,         // required (e.g. 4)
 *         "comment": string|null,   // optional textual review/comment
 *         "bookingId": string|null  // optional: mark booking as rated
 *       }
 *
 * Behavior / Side effects:
 *   - Verifies Admin SDK initialized.
 *   - Verifies caller token and obtains uid/displayName.
 *   - Reads the venue doc; if missing, returns an error.
 *   - In a Firestore transaction:
 *       - Creates/updates a review doc at `reviews/{venueId}_{uid}` with rating/comment.
 *       - Appends a comment subdoc to `venues/{venueId}/comments`.
 *       - Recomputes and updates `venues/{venueId}` aggregate fields:
 *           - `averageRating` (rounded to 1 decimal)
 *           - `reviewCount`
 *       - Optionally updates the referenced booking (`bookings/{bookingId}`) to set `rated: true`
 *
 * Success Responses:
 *   - 201 Created
 *     Body:
 *       { "ok": true }
 *
 * Client / Validation Errors:
 *   - 401 Unauthorized
 *     { "error": "Missing Authorization token" } or { "error": "Invalid token" }
 *   - 400 Bad Request (implicit in transaction when venue missing or invalid payload)
 *     { "error": "<message>" }
 *
 * Server Errors:
 *   - 500 Internal Server Error
 *     { "error": "<message>" }
 *
 * Examples:
 *   Request:
 *     POST /api/venues/venue123/reviews
 *     Authorization: Bearer <idToken>
 *     Body:
 *       { "rating": 5, "comment": "Great ground!", "bookingId": "bkg_abc" }
 *
 *   Response (success):
 *     Status: 201
 *     Body: { "ok": true }
 *
 * Notes / Edge cases:
 *   - If a user already has a review, the transaction updates the existing
 *     rating and recomputes the venue average accordingly.
 *   - The code uses server timestamps for createdAt/updatedAt fields.
 *   - The average is rounded to one decimal place.
 */
import { NextResponse } from "next/server";
import { db, auth as adminAuth } from "@/lib/firebase-admin";
import { Firestore, FieldValue, DocumentReference } from "firebase-admin/firestore";
import { requireAdminSDK, extractBearerToken } from "@/lib/server/auth";
import { COLLECTIONS } from "@/lib/utils";

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const sdkError = requireAdminSDK();
  if (sdkError) return sdkError;

  try {
    const venueId = params.id;
    const body = await req.json();
    const { rating, comment, bookingId } = body;

    // Verify token and get uid + displayName in one call
    const token = extractBearerToken(req);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    let uid: string;
    let displayName: string;
    try {
      const decoded = await adminAuth.verifyIdToken(token);
      uid = decoded.uid;
      // decoded.name is set for Google/social sign-ins; fall back to user doc
      if (decoded.name) {
        displayName = decoded.name;
      } else {
        // Look up user doc for email/password accounts
        const userDocSnap = await db.collection(COLLECTIONS.USERS).doc(decoded.uid).get();
        const userData = userDocSnap.data();
        displayName =
          userData?.displayName ||
          decoded.email?.split("@")[0] ||
          "Anonymous";
      }
    } catch {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const reviewDocRef = db.collection(COLLECTIONS.REVIEWS).doc(`${venueId}_${uid}`) as DocumentReference;
    const venueRef = db.collection(COLLECTIONS.VENUES).doc(venueId) as DocumentReference;
    const bookingRef = bookingId
      ? db.collection(COLLECTIONS.BOOKINGS).doc(bookingId)
      : null;

    await (db as Firestore).runTransaction(async (tx) => {
      const venueSnap = await tx.get(venueRef);
      const existingReviewSnap = await tx.get(reviewDocRef);

      if (!venueSnap.exists) throw new Error("Venue does not exist");

      const venueData = venueSnap.data() as Record<string, any>;
      const currentRating: number = venueData.averageRating || 0;
      const currentCount: number = venueData.reviewCount || 0;

      const isNewReview = !existingReviewSnap.exists;
      const existingData = existingReviewSnap.exists
        ? (existingReviewSnap.data() as Record<string, any>)
        : null;
      const existingRating: number = existingData?.rating || 0;
      // commentId stored in review doc so we update the same comment, not create a new one
      const existingCommentId: string | null = existingData?.commentId || null;

      // Recompute aggregate rating
      let newCount = currentCount;
      let newAverage = currentRating;
      if (isNewReview) {
        newCount = currentCount + 1;
        newAverage = (currentRating * currentCount + rating) / newCount;
      } else if (currentCount > 0) {
        newAverage = (currentRating * currentCount - existingRating + rating) / currentCount;
      } else {
        newAverage = rating;
      }
      const roundedAverage = Math.round(newAverage * 10) / 10;

      // Determine comment doc ref: reuse existing one to avoid duplicates
      const commentRef = existingCommentId
        ? db.collection(`venues/${venueId}/comments`).doc(existingCommentId)
        : db.collection(`venues/${venueId}/comments`).doc();
      const newCommentId = existingCommentId || commentRef.id;

      const commentData = {
        text: comment || "",
        author: displayName,
        userId: uid,
        role: "user",
        rating,
        updatedAt: new Date().toISOString(),
      };

      // Review doc: upsert with commentId so future updates target the same comment doc
      tx.set(
        reviewDocRef,
        {
          venueId,
          userId: uid,
          rating,
          comment: comment || null,
          commentId: newCommentId,
          updatedAt: FieldValue.serverTimestamp(),
          ...(isNewReview && { createdAt: FieldValue.serverTimestamp() }),
        },
        { merge: true },
      );

      if (existingCommentId) {
        // Update the existing comment doc — do NOT create a duplicate
        tx.update(commentRef, commentData);
      } else {
        // First-time review: create the comment doc with createdAt
        tx.set(commentRef, { ...commentData, createdAt: new Date().toISOString() });
      }

      tx.update(venueRef, { averageRating: roundedAverage, reviewCount: newCount });

      if (bookingRef) tx.update(bookingRef, { rated: true });
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err: any) {
    console.error("Error creating review (server):", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 },
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { db, auth, isAdminInitialized } from "@/lib/firebase-admin";
import crypto from "crypto";

// POST /api/invoices/verify
export async function POST(request: NextRequest) {
  if (!isAdminInitialized()) {
    return NextResponse.json(
      { error: "Server misconfigured: Admin SDK not initialized" },
      { status: 500 },
    );
  }

  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : null;
  if (!token)
    return NextResponse.json(
      { error: "Missing authorization token" },
      { status: 401 },
    );

  let decoded: any;
  try {
    decoded = await auth.verifyIdToken(token);
  } catch (err) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const qr = body?.qr; // expected base64 string (iv||tag||ciphertext) or plain base64
    if (!qr)
      return NextResponse.json(
        { error: "Missing qr payload" },
        { status: 400 },
      );

    const secret = process.env.INVOICE_QR_SECRET || "";
    if (!secret)
      return NextResponse.json(
        { error: "Server misconfigured: INVOICE_QR_SECRET not set" },
        { status: 500 },
      );

    // decode
    let decodedJson: any = null;
    try {
      let qrClean = String(qr || "");
      // If the scanned value is a data URL like "data:...;base64,XXXX", extract after comma
      if (qrClean.startsWith("data:")) {
        const idx = qrClean.indexOf(",");
        if (idx !== -1) qrClean = qrClean.slice(idx + 1);
      }
      // Log a short debug snippet (avoid logging full secret data)
      console.debug(
        "QR verify: received payload length",
        qrClean.length,
        "sample",
        qrClean.slice(0, 60),
      );
      const data = Buffer.from(qrClean, "base64");
      if (data.length < 12 + 16) throw new Error("invalid ciphertext");
      const iv = data.slice(0, 12);
      const tag = data.slice(12, 28);
      const ciphertext = data.slice(28);
      const key = crypto.createHash("sha256").update(secret).digest();
      const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(tag);
      const decrypted = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]);
      decodedJson = JSON.parse(decrypted.toString("utf8"));
    } catch (err) {
      console.error("Failed to decrypt/parse QR payload", err);
      return NextResponse.json(
        { error: "Failed to decrypt/parse QR payload" },
        { status: 400 },
      );
    }

    // Expect minimal payload: { b: bookingId, t: timestamp }
    const bookingId = decodedJson?.b;
    if (!bookingId)
      return NextResponse.json(
        { error: "Invalid QR payload (missing booking id)" },
        { status: 400 },
      );

    // Fetch booking
    const bookingRef = db.collection("bookings").doc(bookingId);
    const bookingSnap = await bookingRef.get();
    if (!bookingSnap.exists)
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    const booking = bookingSnap.data() as any;

    // Fetch venue and owner
    const venueRef = db.collection("venues").doc(booking.venueId);
    const venueSnap = await venueRef.get();
    const venue = venueSnap.exists ? venueSnap.data() : null;
    const ownerRef = db.collection("users").doc(booking.userId);
    const ownerSnap = await ownerRef.get();
    const owner = ownerSnap.exists ? ownerSnap.data() : null;

    // Authorization: allow if caller is admin or manager of venue
    const callerUid = decoded.uid;
    const callerUserSnap = await db.collection("users").doc(callerUid).get();
    const callerUser = callerUserSnap.exists ? callerUserSnap.data() : {};
    const isAdminUser = callerUser?.role === "admin";
    const managedBy = venue?.managedBy;
    const isVenueManager =
      managedBy === callerUid ||
      (Array.isArray(managedBy) && managedBy.includes(callerUid));
    if (!isAdminUser && !isVenueManager) {
      return NextResponse.json(
        { error: "Forbidden: caller not authorized" },
        { status: 403 },
      );
    }

    // Optionally, check timestamp freshness (for example within 24h)
    const ts = Number(decodedJson?.t || 0);
    const now = Date.now();
    const maxAgeMs = 24 * 60 * 60 * 1000; // 24h
    const isStale = ts && Math.abs(now - ts) > maxAgeMs;

    return NextResponse.json({
      ok: true,
      stale: isStale,
      booking: booking,
      venue: venue,
      user: owner,
    });
  } catch (err) {
    console.error("QR verify error", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

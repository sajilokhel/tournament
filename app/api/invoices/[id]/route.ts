/**
 * GET /api/invoices/:id
 *
 * Description:
 *   Server-side invoice generator for a booking. Produces a professionally
 *   formatted PDF invoice (Attachment) for the booking identified by the
 *   path parameter `id`. The endpoint fetches booking, venue and user data
 *   from Firestore (Admin SDK), computes / validates server-side payment
 *   fields and embeds a QR payload for quick verification.
 *
 * Authentication / Authorization:
 *   - Requires an Authorization header with a Firebase ID token:
 *       Authorization: Bearer <idToken>
 *   - The caller must be either:
 *     - the booking owner (booking.userId),
 *     - a manager of the venue (venue.managedBy includes the caller uid), or
 *     - an admin user (users/{uid}.role === 'admin').
 *
 * Path Params:
 *   - id (string) - booking document id
 *
 * Behavior:
 *   - Verifies Admin SDK initialization.
 *   - Verifies and decodes the caller's ID token.
 *   - Loads booking document bookings/{id} and related venue and user documents.
 *   - Checks permissions (owner, manager, or admin).
 *   - Validates booking contains server-calculated payment fields (`advanceAmount`, `dueAmount`).
 *     If missing, returns 400 explaining the missing fields.
 *   - Generates a minimal QR payload (bookingId + timestamp) and encrypts it using
 *     `process.env.INVOICE_QR_SECRET` (AES-256-GCM). If secret missing, falls back
 *     to unsigned base64 payload with a warning.
 *   - Renders a PDF using jsPDF, embeds the QR image and returns a binary PDF
 *     response with headers:
 *       Content-Type: application/pdf
 *       Content-Disposition: attachment; filename="invoice-<bookingId>.pdf"
 *
 * Successful Responses:
 *   - 200 (or implicit Response): returns raw PDF bytes as the response body with
 *     appropriate Content-Type and Content-Disposition headers.
 *
 * Error Responses (examples):
 *   - 401 Unauthorized:
 *       { error: 'Missing authorization token' }
 *       or
 *       { error: 'Invalid token' }
 *
 *   - 403 Forbidden:
 *       { error: 'Forbidden' }
 *       When caller is not owner, manager, or admin.
 *
 *   - 404 Not Found:
 *       { error: 'Booking not found' }
 *       When booking document does not exist.
 *
 *   - 400 Bad Request:
 *       { error: 'Booking missing server-calculated payment fields (advanceAmount/dueAmount)' }
 *       When booking is missing required server-calculated amounts.
 *
 *   - 500 Internal Server Error:
 *       { error: 'Server misconfigured: Admin SDK not initialized' }
 *       { error: 'Failed to generate invoice', details: '<error message>' }
 *       For unexpected failures such as PDF generation faults or DB issues.
 *
 * Notes / Edge cases:
 *   - QR payload encryption requires `INVOICE_QR_SECRET` in env. If absent, the
 *     QR will contain an unsigned base64 payload. Verification endpoint accepts
 *     both encrypted and base64 data (it expects AES-256-GCM encrypted iv|tag|ciphertext).
 *   - The route expects booking fields `date`, `startTime`, `endTime`, `amount`,
 *     and server-calculated `advanceAmount` and `dueAmount`. The invoice layout
 *     depends on these being present and numeric.
 *   - The endpoint returns a binary PDF Response (not JSON) on success. Clients
 *     should handle the response as a file download.
 */
import { NextRequest, NextResponse } from "next/server";
import { db, auth, isAdminInitialized } from "@/lib/firebase-admin";
import admin from "firebase-admin";
import jsPDF from "jspdf";
import QRCode from "qrcode";
import crypto from "crypto";

// Server-side invoice generator
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAdminInitialized()) {
    return NextResponse.json(
      { error: "Server misconfigured: Admin SDK not initialized" },
      { status: 500 },
    );
  }

  const { id: bookingId } = await params;

  // Authenticate caller
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
    // Fetch booking, venue and owner data from Admin DB
    const bookingRef = db.collection("bookings").doc(bookingId);
    const bookingSnap = await bookingRef.get();
    if (!bookingSnap.exists)
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    const booking = bookingSnap.data() as any;

    const venueRef = db.collection("venues").doc(booking.venueId);
    const venueSnap = await venueRef.get();
    const venue = venueSnap.exists ? venueSnap.data() : {};

    const ownerRef = db.collection("users").doc(booking.userId);
    const ownerSnap = await ownerRef.get();
    const owner = ownerSnap.exists ? ownerSnap.data() : {};

    // Check permissions: booking owner, venue manager, or admin
    const callerUid = decoded.uid;
    const callerUserSnap = await db.collection("users").doc(callerUid).get();
    const callerUser = callerUserSnap.exists ? callerUserSnap.data() : {};
    const isAdminUser = callerUser?.role === "admin";

    const managedBy = venue?.managedBy;
    const isVenueManager =
      managedBy === callerUid ||
      (Array.isArray(managedBy) && managedBy.includes(callerUid));

    if (callerUid !== booking.userId && !isVenueManager && !isAdminUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Build invoice data
    const invoiceData = {
      bookingId: bookingId,
      venueName: venue?.name || "Unknown Venue",
      venueAddress: venue?.address || "Address not available",
      date: booking?.date || "",
      startTime: booking?.startTime || "",
      endTime: booking?.endTime || "",
      amount: booking?.amount || booking?.price || 0,
      status: booking?.status || "",
      userName: owner?.name || owner?.displayName || "",
      userEmail: owner?.email || "",
      paymentTimestamp: booking?.paymentTimestamp || null,
      esewaTransactionCode:
        booking?.esewaTransactionCode || booking?.esewaTransactionUuid || null,
    };

    // Prepare QR payload: AES-256-GCM encrypt JSON payload using INVOICE_QR_SECRET
    const secret = process.env.INVOICE_QR_SECRET || "";
    // Keep QR payload minimal to reduce encoded data size: only bookingId and timestamp
    const payloadObj: any = {
      b: invoiceData.bookingId,
      t: Date.now(),
    };

    const payloadJson = JSON.stringify(payloadObj);
    let qrContent: string;
    if (secret) {
      try {
        const key = crypto.createHash("sha256").update(secret).digest(); // 32 bytes
        const iv = crypto.randomBytes(12); // 96-bit IV for GCM
        const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
        const encrypted = Buffer.concat([
          cipher.update(payloadJson, "utf8"),
          cipher.final(),
        ]);
        const tag = cipher.getAuthTag();
        const combined = Buffer.concat([iv, tag, encrypted]);
        qrContent = combined.toString("base64");
      } catch (err) {
        console.warn(
          "Failed to encrypt QR payload, falling back to plain base64:",
          err,
        );
        qrContent = Buffer.from(payloadJson).toString("base64");
      }
    } else {
      console.warn(
        "INVOICE_QR_SECRET not set; QR will contain unsigned payload",
      );
      qrContent = Buffer.from(payloadJson).toString("base64");
    }
    // Professional invoice layout matching provided example
    const doc = new jsPDF({ unit: "pt", format: "A4" });
    doc.setProperties({
      title: `Invoice-${invoiceData.bookingId}`,
      subject: "Booking Invoice",
    });

    const pageWidth = (doc as any).internal.pageSize.getWidth();
    const margin = 40;

    // Large title left
    doc.setFont("helvetica", "bold");
    doc.setFontSize(36);
    doc.setTextColor(34, 34, 34);
    doc.text("INVOICE", margin, 70);

    // Company/subtitle under title
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.setTextColor(80, 80, 80);
    doc.text("SajiloKhel", margin, 92);

    // Top-right: Invoice date and Booking ID
    doc.setFontSize(10);
    doc.setTextColor(90, 90, 90);
    const rightX = pageWidth - margin;
    doc.text(`Invoice Date: ${new Date().toLocaleDateString()}`, rightX, 60, {
      align: "right",
    });
    doc.text(`Booking ID: ${invoiceData.bookingId}`, rightX, 76, {
      align: "right",
    });

    // Billed To block
    doc.setFontSize(11);
    doc.setTextColor(34, 34, 34);
    doc.setFont("helvetica", "bold");
    doc.text("Billed To:", margin, 130);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const billedLine =
      invoiceData.userName ||
      invoiceData.userEmail ||
      `User ID: ${booking.userId}`;
    doc.text(String(billedLine), margin, 148);

    // Booking Details header with underline
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Booking Details", margin, 186);
    // underline
    doc.setDrawColor(200);
    doc.setLineWidth(0.8);
    doc.line(margin, 192, pageWidth - margin, 192);

    // Details rows (left label, right value)
    const leftColX = margin;
    const rightColX = pageWidth - margin - 160;
    let y = 210;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);

    const addRow = (label: string, value: string) => {
      doc.setFont("helvetica", "normal");
      doc.text(label, leftColX, y);
      doc.setFont("helvetica", "normal");
      doc.text(value, rightColX, y);
      y += 18;
    };

    addRow("Venue", String(invoiceData.venueName || "-"));
    addRow(
      "Date & Time",
      `${invoiceData.date} | ${invoiceData.startTime} - ${invoiceData.endTime}`,
    );
    addRow("Booked By", String(booking.userId || invoiceData.userName || "-"));
    addRow("Platform", "Mobile App (SajiloKhel)");

    // Total Amount label and value
    // Total Amount label and value
    // Require server-calculated payment fields. Do not fallback to client-side math.
    if (booking.advanceAmount == null || booking.dueAmount == null) {
      return NextResponse.json(
        {
          error:
            "Booking missing server-calculated payment fields (advanceAmount/dueAmount)",
        },
        { status: 400 },
      );
    }

    const totalAmount = Number(invoiceData.amount) || 0;
    const advanceAmount = booking.advanceAmount;
    const dueAmount = booking.dueAmount;

    const formattedTotal = totalAmount.toFixed(2);
    const formattedAdvance = advanceAmount.toFixed(2);
    const formattedDue = dueAmount.toFixed(2);

    y += 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Total Amount", leftColX, y);
    doc.text(`Rs. ${formattedTotal}`, rightColX + 120, y);

    y += 18;
    doc.setFontSize(10);
    doc.setTextColor(0, 128, 0); // Green for advance
    doc.text("Advance Paid", leftColX, y);
    doc.text(`Rs. ${formattedAdvance}`, rightColX + 120, y);

    y += 18;
    doc.setTextColor(220, 53, 69); // Red for due
    doc.text("Due Amount", leftColX, y);
    doc.text(`Rs. ${formattedDue}`, rightColX + 120, y);

    y += 18;
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.setFont("helvetica", "italic");
    doc.text(
      "Note: The due amount is to be paid after the game at the venue.",
      leftColX,
      y,
    );

    // Large centered QR below (payload is minimal to keep QR simple)
    try {
      const qrSizePx = 280; // smaller pixel size now that payload is minimal
      const qrDataUrl = await QRCode.toDataURL(qrContent, {
        margin: 0,
        width: qrSizePx,
      });
      const qrPdfSize = 200;
      const qrX = (pageWidth - qrPdfSize) / 2;
      const qrY = y + 30;
      doc.addImage(qrDataUrl, "PNG", qrX, qrY, qrPdfSize, qrPdfSize);
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text("Scan to verify booking", pageWidth / 2, qrY + qrPdfSize + 18, {
        align: "center",
      });
    } catch (e) {
      console.warn("Failed to generate QR image:", e);
    }

    // Footer line and text
    const footerY = 780;
    doc.setDrawColor(220);
    doc.setLineWidth(0.5);
    doc.line(margin, footerY - 10, pageWidth - margin, footerY - 10);
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text("Thank you for booking with SajiloKhel!", margin, footerY + 4);
    doc.text(
      "Contact: contact@sajilokhel.com",
      pageWidth - margin,
      footerY + 4,
      { align: "right" },
    );
    // (QR already embedded above; professional table/totals were drawn)

    const fileName = `invoice-${invoiceData.bookingId}.pdf`;
    const arrayBuffer = doc.output("arraybuffer");
    const buffer = Buffer.from(arrayBuffer as ArrayBuffer);

    console.log(
      "✅ Invoice PDF generated successfully:",
      fileName,
      "Size:",
      buffer.length,
      "bytes",
    );

    return new Response(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (err: any) {
    console.error("❌ Invoice generation error:", err);
    console.error("Error message:", err.message);
    console.error("Error stack:", err.stack);
    return NextResponse.json(
      {
        error: "Failed to generate invoice",
        details: err.message,
      },
      { status: 500 },
    );
  }
}

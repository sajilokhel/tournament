/**
 * POST /api/payment/generate-signature
 *
 * Description:
 *   Generates a server-side HMAC-SHA256 signature required by the eSewa payment
 *   integration. The signature must be created on the server to keep the
 *   secret key confidential. The resulting signature is returned Base64 encoded.
 *
 * Authentication:
 *   - This endpoint does NOT itself validate a bearer token. It assumes the
 *     caller is trusted to request a signature. For production usage you should
 *     require and verify a token (Authorization: Bearer <idToken>) and confirm
 *     the caller is allowed to generate signatures.
 *
 * Request:
 *   - Method: POST
 *   - Content-Type: application/json
 *   - Body JSON fields (all required):
 *       {
 *         "totalAmount": number | string,     // amount eSewa will charge (use server-authoritative amount)
 *         "transactionUuid": string,          // unique transaction id used to correlate payment
 *         "productCode": string               // merchant/product code (ESEWA_MERCHANT_CODE)
 *       }
 *
 * Responses:
 *
 *   1) Success
 *      - Status: 200
 *      - Body:
 *          {
 *            "signature": "<base64-hmac-sha256>",
 *            "message": "total_amount=...,transaction_uuid=...,product_code=..." // debug helper
 *          }
 *      - Notes:
 *          - The `signature` is HMAC-SHA256(message, ESEWA_SECRET_KEY) base64 encoded.
 *          - `message` shows the exact string signed (present for debugging; remove in strict production).
 *
 *   2) Bad Request - missing params
 *      - Status: 400
 *      - Body:
 *          { "error": "Missing required parameters: totalAmount, transactionUuid, productCode" }
 *
 *   3) Server misconfiguration - secret missing
 *      - Status: 500
 *      - Body:
 *          { "error": "Payment gateway not configured" }
 *      - Notes:
 *          - Happens when `ESEWA_SECRET_KEY` is not available in server environment.
 *
 *   4) Internal Server Error
 *      - Status: 500
 *      - Body:
 *          { "error": "Failed to generate signature" }
 *
 * Edge-cases & security notes:
 *   - Always use server-calculated amounts (never rely solely on client-sent values).
 *   - Consider validating the `transactionUuid` format and uniqueness before signing.
 *   - Do not log the secret or full signature in production logs. The current code returns
 *     the signed `message` for debugging; remove that if it leaks sensitive metadata.
 *
 * Example Request:
 *   POST /api/payment/generate-signature
 *   {
 *     "totalAmount": 100,
 *     "transactionUuid": "booking123_1690000000000",
 *     "productCode": "EPAYTEST"
 *   }
 *
 * Example Successful Response:
 *   {
 *     "signature": "qwerty...base64",
 *     "message": "total_amount=100,transaction_uuid=booking123_1690000000000,product_code=EPAYTEST"
 *   }
 */
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { ESEWA_SECRET_KEY } from "@/lib/esewa/config";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { totalAmount, transactionUuid, productCode } = body;

    // Validate required parameters
    if (!totalAmount || !transactionUuid || !productCode) {
      return NextResponse.json(
        {
          error:
            "Missing required parameters: totalAmount, transactionUuid, productCode",
        },
        { status: 400 },
      );
    }

    // Validate secret key is configured
    if (!ESEWA_SECRET_KEY) {
      console.error("ESEWA_SECRET_KEY is not configured");
      return NextResponse.json(
        { error: "Payment gateway not configured" },
        { status: 500 },
      );
    }

    // Create the message string in the exact order required by eSewa
    // Format: total_amount=100,transaction_uuid=11-201-13,product_code=EPAYTEST
    const message = `total_amount=${totalAmount},transaction_uuid=${transactionUuid},product_code=${productCode}`;

    // Generate HMAC-SHA256 signature
    const hmac = crypto.createHmac("sha256", ESEWA_SECRET_KEY);
    hmac.update(message);
    const signature = hmac.digest("base64");

    return NextResponse.json({
      signature,
      message, // For debugging (remove in production)
    });
  } catch (error) {
    console.error("Error generating signature:", error);
    return NextResponse.json(
      { error: "Failed to generate signature" },
      { status: 500 },
    );
  }
}

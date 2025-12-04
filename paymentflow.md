# Payment Flow (User & Manager) — Tournament App

This document describes the complete payment flows for the Tournament app from both user and manager perspectives. It documents the happy path, intermediate states, API endpoints involved, expected payloads, state transitions, edge cases, reconciliation steps, and recommended operational practices.

Goal
- Give product, frontend and backend engineers a single reference to implement, test and operate payment flows (eSewa).
- Document what the UI should show at each step and how server endpoints behave on success/failure.
- Cover edge cases and reconciliation instructions for operational teams.

Contents
1. Actors
2. High level sequence (user)
3. High level sequence (manager)
4. Booking & Payment states
5. Endpoints used in payment flows (request / response / headers)
6. UI expectations (user & manager)
7. Edge cases & failure modes with recovery
8. Reconciliation & operational playbook
9. Security & monitoring recommendations
10. Test checklist

---

1. Actors
- User: the person booking a slot and paying via eSewa.
- Manager: venue manager (or admin) who may scan invoices/QRs and authorize check-ins.
- Payment Gateway: eSewa (external). Our server interacts with eSewa via signed/initiate and verify endpoints.
- Server: our backend endpoints under `/api/payment/*`, `/api/bookings`, `/api/slots/*`, `/api/invoices/*`.

---

2. High level sequence (User -> Book -> Pay)
1. User selects a venue/time and initiates booking flow in UI.
2. Client calls server to create booking:
   - POST `/api/bookings` -> booking created with status `pending` or `pending_payment`.
3. Client places a short hold on the slot (if separate endpoint):
   - POST `/api/slots/hold` -> hold stored with expiry (e.g. 5 minutes).
4. Client requests payment initiation:
   - POST `/api/payment/initiate` with `{ bookingId, totalAmount }`.
   - Server creates `esewaTransactionUuid = <bookingId>_<timestamp>` and stores it on booking (and held entry).
   - Server returns `transactionUuid`, `signature`, and `paymentParams` for the client to submit to eSewa.
5. Client redirects / posts to eSewa payment page (or opens eSewa flow in-app) using the returned params.
6. User completes or abandons payment on eSewa:
   - On success/failure eSewa will redirect to configured `successUrl`/`failureUrl` (client) and may not call our server directly — we need to call `/api/payment/verify` from the client or from a server webhook.
7. Client (or webhook) calls `/api/payment/verify` with `{ transactionUuid, productCode, totalAmount }`.
8. Server contacts eSewa verify API:
   - If `status === COMPLETE`:
     - Server converts hold -> confirmed (calls `bookSlot`), updates booking to `confirmed`, logs payment.
     - Client receives confirmed status and can view invoice.
   - If `PENDING` or other non-terminal:
     - Server returns `verified: false` and leaves booking `pending_payment`.
     - Client may allow retry or manual cancel.
   - If `FAILED` or `CANCELED`:
     - Server marks booking `payment_failed` (optional) and releases hold if business rules require it.
9. Manager or admin can later reconcile via admin UI if payments are confirmed but bookings not updated.

---

3. High level sequence (Manager / Check-in using QR)
1. Manager scans QR on user invoice / app.
2. Manager client sends encrypted QR payload to server:
   - POST `/api/invoices/verify` with `{ qr: "<base64>" }` and manager's ID token.
3. Server decrypts QR using `INVOICE_QR_SECRET`, validates booking id and timestamp, authorizes manager (must be venue manager or admin).
4. Server returns booking + venue + user info and whether QR is stale.
5. Manager may check-in user (update slot) or deny (invalid or stale).

---

4. Booking & Payment states (source of truth in `bookings` document)
- `pending` or `pending_payment`: booking created and slot held; awaiting payment.
- `payment_failed`: backend determined payment failure or terminal failure on verification.
- `confirmed`: payment verified and slot reserved / confirmed in venue slots.
- `cancelled`: booking explicitly cancelled by user or manager.
- `expired`: hold expired (no payment) and booking released/archived.
- `refunded`: booking has been refunded (if refund flow is implemented).

Transitions (common):
- pending -> pending_payment (initial) -> confirmed (on successful verify)
- pending -> payment_failed (on terminal failure)
- pending -> cancelled (user cancel)
- pending -> expired (hold timeout)

Important flags/fields on booking:
- `esewaTransactionUuid` — assigned in `/api/payment/initiate`
- `esewaInitiatedAt` — timestamp when transaction created
- `esewaTransactionCode` / `esewaTransactionRef` — returned by verify
- `esewaStatus` — eSewa status string (COMPLETE/PENDING/FAILED)
- `verifiedAt` / `paymentTimestamp` — timestamps for verification/payment time

---

5. Endpoints used in payment flows

A. Create booking
- POST /api/bookings
- Auth: Bearer Firebase ID token
- Headers: Authorization: Bearer <idToken>, Content-Type: application/json
- Body:
```json
{
  "venueId": "string",
  "slotId": "string"
}
```
- Success (200):
```json
{ "ok": true, "bookingId": "booking_xyz" }
```
- Errors:
  - 400: missing fields
  - 401: unauthorized
  - 404: slot not found
  - 409: slot not available
  - 500: server error

B. Hold slot (optional separate step)
- POST /api/slots/hold
- Auth: Bearer token
- Body:
```json
{ "slotId": "slot_xyz", "venueId": "venue_abc", "holdDurationMinutes": 5 }
```
- Success:
```json
{ "ok": true, "holdExpiresAt": "2025-01-20T12:34:56Z" }
```

C. Initiate payment
- POST /api/payment/initiate
- Auth: Bearer token
- Body:
```json
{ "bookingId": "booking_abc", "amount": 600, "totalAmount": 600 }
```
- Success:
```json
{
  "success": true,
  "transactionUuid": "booking_abc_1700000000000",
  "signature": "<base64-hmac>",
  "paymentParams": {
    "amount": "600",
    "totalAmount": "600",
    "transactionUuid": "booking_abc_1700000000000",
    "productCode": "EPAYTEST",
    "successUrl": "https://.../payment-success",
    "failureUrl": "https://.../payment-failure"
  }
}
```
- Notes:
  - Server must have `ESEWA_SECRET_KEY` configured.
  - This endpoint writes `esewaTransactionUuid` onto booking and the held entry in `venueSlots` (if present) in a single transaction.

D. Generate signature (helper)
- POST /api/payment/generate-signature
- Auth: should be server-protected
- Body:
```json
{ "totalAmount": "600", "transactionUuid": "booking_abc_170...", "productCode": "EPAYTEST" }
```
- Success:
```json
{ "signature": "<base64-hmac>", "message": "total_amount=...,transaction_uuid=...,product_code=..." }
```

E. Verify payment
- POST /api/payment/verify
- Auth: Bearer token (server currently requires this)
- Body:
```json
{ "transactionUuid": "booking_abc_170...", "productCode": "EPAYTEST", "totalAmount": 600 }
```
- Behavior & possible responses:
  1. Payment complete (booking found & confirmed):
```json
{
  "verified": true,
  "status": "COMPLETE",
  "transactionUuid": "...",
  "refId": "ES123",
  "totalAmount": "600",
  "bookingConfirmed": true,
  "bookingData": { /* booking summary */ }
}
```
  2. Payment pending (not verified):
```json
{
  "verified": false,
  "status": "PENDING",
  "transactionUuid": "...",
  "bookingFound": true,
  "message": "Payment not completed; booking retained (no automatic deletion)."
}
```
  3. Payment confirmed but booking missing:
```json
{
  "verified": true,
  "status": "COMPLETE",
  "bookingFound": false,
  "message": "Payment verified but booking document not found; payment logged for manual reconciliation"
}
```
  4. Error or DB update failed:
```json
{
  "verified": true,
  "status": "COMPLETE",
  "bookingConfirmed": false,
  "bookingUpdateFailed": true,
  "message": "Payment verified but failed to update booking; payment logged"
}
```
- Notes:
  - Server attempts multiple strategies to locate booking:
    - booking doc id equal to `transactionUuid`
    - prefix before last underscore as booking id
    - query `bookings` where `esewaTransactionUuid` == `transactionUuid`
  - Server logs payments in `lib/paymentLogger` for audit and reconciliation.

F. Invoice verify (manager QR scan)
- POST /api/invoices/verify
- Auth: Bearer token (manager/admin)
- Body:
```json
{ "qr": "<base64 or data-url>" }
```
- Success:
```json
{ "ok": true, "stale": false, "booking": {...}, "venue": {...}, "user": {...} }
```
- Errors: 400 (missing qr), 401, 403 (not manager), 404, 500

---

6. UI Expectations (What frontend should show)

User View:
- Booking step:
  - After booking & hold: show "Slot held for 5:00 minutes — complete payment to confirm."
  - Countdown timer of hold.
- During payment initiate:
  - Show payment page/redirect details and disable back button where appropriate.
- After eSewa redirect (success/failure):
  - Show spinner while calling `/api/payment/verify`.
  - On success: show confirmation page with booking details and invoice download button.
  - On pending: show message "Payment appears pending — retry verify in a few minutes or contact support" and allow "Resend verify" button.
  - On failure: show "Payment failed" and allow retry/cancel booking.
- Idempotency: If verify reports alreadyConfirmed, show confirmation but indicate "Payment was already processed."

Manager View (QR scanning):
- After scanning:
  - If verified & not stale: display booking summary, customer name, slot time, and a "Check-in" or "Mark present" button.
  - If stale: warn "QR is stale — ask customer for fresh QR / payment proof".
  - If unauthorized: show "You are not authorized to verify this QR."

Edge UX:
- If server reports booking found false but verify true (payment logged), show a helpful message: "Payment received but booking record missing. Support has been notified for reconciliation."

---

7. Edge cases & failure modes with recovery

A. eSewa verifies COMPLETE but booking doc missing
- Root cause: booking document deleted/never created, or txn uuid mismatched.
- Server behavior: log payment to payment logger with bookingId derived from txn prefix and other metadata; return success to eSewa.
- Recovery: Manual reconciliation UI to match payment log to customer and create or mark booking confirmed manually.

B. eSewa verifies COMPLETE but DB update fails (network/firestore issue)
- Server behavior: log payment and return success to eSewa with `bookingUpdateFailed` flag. This prevents eSewa from retrying and losing payment.
- Recovery: Ops/engineer inspects logs, replays booking confirmation flow using logged payment entry (admin endpoint or manual update).

C. Duplicate verify calls (idempotency)
- Ensure `/api/payment/verify` is idempotent:
  - If booking already `confirmed`, do not double-book. Ensure `bookSlot` checks idempotency.
  - Always log payment attempts with metadata including `alreadyConfirmed: true`.

D. Hold expired while user is on eSewa page
- If hold expires before verify, verifying COMPLETE should still convert hold to confirmed; if slot was re-assigned, server must detect conflict and surface to ops.
- Option: extend hold automatically while payment is in-flight (careful — introduces long holds). Prefer to keep holds short and rely on booking conversion step.

E. Signature mismatch or tampered params
- Server verifies HMAC with `ESEWA_SECRET_KEY`.
- If discrepancy, reject initiation / verification and mark as suspicious. Notify ops.

F. Network errors between server and eSewa
- Implement retries with exponential backoff for HTTP calls, but ensure idempotency and logging.
- If verification cannot be completed immediately, return `verified: false` and advise client to retry later.

G. Fraud / Replays
- Keep `esewaTransactionUuid` unpredictable via timestamp + bookingId and possibly a random nonce.
- Use server-side signature verification; don't trust client-side verify calls without server verification.

---

8. Reconciliation & operational playbook

Automated logging:
- All verify attempts (success/fail) MUST be persisted to a `payments` or `paymentLogs` collection via `lib/paymentLogger` with fields:
  - transactionUuid, bookingId, userId, venueId, amount, status, refId, rawResponse, handledAt, handlerNotes
- This allows ops to query payments not matched to bookings.

Daily reconciliation tasks:
1. Query logs for `verified: true` entries where bookingConfirmed = false or bookingFound = false.
2. Try automated reconciliation:
   - If userId & venueId present, recreate booking or mark booking as reconciled.
3. Escalate to human if automated fails.

Admin tools:
- Endpoint to mark booking confirmed manually: POST `/admin/bookings/reconcile` (if implemented).
- Endpoint to list recent payment logs and their reconciliation status.

Suggested alerts:
- Notify on > N payments verified but missing bookings in 1 hour.
- Notify on > N bookingUpdateFailed entries.

---

9. Security & monitoring recommendations

- Environment secrets: `ESEWA_SECRET_KEY`, `ESEWA_MERCHANT_CODE`, `INVOICE_QR_SECRET` must be stored securely (secrets manager).
- Logging: Avoid printing full secrets. Mask sensitive fields like raw QR payloads in logs.
- Rate limit public endpoints like `/api/payment/generate-signature` and `/api/invoices/verify`.
- Audit logs: keep payment logs immutable (append-only) with sufficient retention.
- Firestore rules: forbid clients from writing `esewaTransactionUuid`, `status` or other sensitive booking states; these must be server-side writes.
- Monitoring:
  - Track success/failure rates for `/api/payment/verify` calls.
  - Alert on spike of `409 Conflict` during checkout.

---

10. Test checklist

Unit/Integration tests:
- Initiate payment writes `esewaTransactionUuid` and returns signature.
- Verify payment handles:
  - COMPLETE and booking found -> confirmed
  - COMPLETE and booking missing -> logged for reconciliation
  - PENDING -> booking retained
  - DB update failure after COMPLETE -> logs payment and returns success to gateway
- Idempotency: multiple `/api/payment/verify` calls with same `transactionUuid` behave idempotently.
- Hold expiry: if hold times out, verify still handles conversion or flags conflict.
- QR verify: encrypted payload decrypts and authorization enforced (manager vs non-manager).
- Signature generation: HMAC algorithm matches eSewa expected format.

End-to-end tests:
- Flow from booking -> initiate -> simulate eSewa COMPLETE -> verify -> check confirmed booking.
- Simulate network failure between verify and DB and ensure payment logged.

Manual tests:
- Use staging eSewa (test merchant) to run a few payments.
- Test edge cases: abandoned payments, retry verify, concurrent holds.

---

Appendix: Quick troubleshooting table

Symptom -> Likely cause -> Action
- eSewa shows success but UI shows pending -> verify call not executed or failed -> Ask user to retry verify; check server logs for /api/payment/verify entries.
- Verify returns COMPLETE but booking not confirmed -> DB update failure -> Check paymentLogs, run reconcile, inspect Firestore errors.
- Manager QR verify returns forbidden -> Manager user not in `venue.managedBy` -> Add manager to venue or update roles.
- Many 409 during checkout -> race conditions in hold logic -> Increase hold atomicity or improve `slots/hold` transaction logic.

---

If you want, I can:
- Generate a compact sequence diagram (text or mermaid) for user and manager flows.
- Produce concrete curl examples for the critical endpoints (`initiate`, `verify`, `bookings`) and JSON schemas for validation.
- Draft an admin reconciliation UI spec (API and minimal UI wireframe).

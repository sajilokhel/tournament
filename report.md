# Codebase Audit Report

## 1. Critical Security Vulnerabilities

### 1.1. Fake Authentication in File Uploads (UploadThing)
*   **File Path:** `app/api/uploadthing/core.ts`
*   **Line Number:** 5
*   **Description:** The auth function is hardcoded to `const auth = (req: Request) => ({ id: "fakeId" });`. This means **anyone** (even unauthenticated users) can upload files to your server. Since you are using UploadThing instead of Firebase Storage, this is your primary file upload vulnerability.
*   **Risk Level:** **CRITICAL**

### 1.2. Unauthenticated Payment Verification
*   **File Path:** `app/api/payment/verify/route.ts`
*   **Line Number:** 34 (Function start)
*   **Description:** The endpoint checks for `signature` but does **not** authenticate the caller. While the signature verification prevents tampering, the endpoint is publicly exposed. A replay attack or a leaked secret key could allow an attacker to confirm bookings without payment.
*   **Risk Level:** **HIGH**

### 1.3. Unauthenticated Ground Creation
*   **File Path:** `app/api/grounds/route.ts`
*   **Line Number:** 16
*   **Description:** The `POST` endpoint allows **anyone** to add a new ground to the system. There is no check for `isAdmin` or even if the user is logged in.
*   **Risk Level:** **CRITICAL**

### 1.4. Unprotected Cron Job
*   **File Path:** `app/api/cron/route.ts`
*   **Line Number:** 15
*   **Description:** The cron job endpoint is public. Anyone can trigger it repeatedly, potentially causing Denial of Service (DoS) or unnecessary database reads.
*   **Risk Level:** **MEDIUM**

### 1.5. Hardcoded Secret Key Fallback
*   **File Path:** `lib/esewa/config.ts`
*   **Line Number:** 47
*   **Description:** The `ESEWA_CONFIG` has a hardcoded fallback value (`'8gBm/:&EnhH.1/q'`). If this file is committed to a public repo or deployed without the environment variable, the UAT secret is exposed.
*   **Risk Level:** **MEDIUM**

### 1.6. Unused but Insecure Firebase Storage Rules
*   **File Path:** `storage.rules`
*   **Description:** Although you are not using Firebase Storage in the app code, the `storage.rules` file exists and is insecure (`allow write: if request.auth != null`). If you ever deploy these rules, it would open a security hole.
*   **Recommendation:** Delete the file or set rules to `allow read, write: if false;` to prevent accidental usage.

## 2. Logical Errors & Bugs

### 2.1. Race Condition: Booking a Blocked Slot
*   **File Path:** `lib/slotService.ts`
*   **Line Number:** 520 (inside `bookSlot`)
*   **Description:** The `bookSlot` function checks if a slot is *already booked*, but it **fails to check if the slot is blocked**.
    ```typescript
    // Current check
    const alreadyBooked = data.bookings.some(matchSlot(date, startTime));
    // MISSING: Check if slot is in data.blocked
    ```
    This allows a user to book a slot that a manager has blocked.
*   **Risk Level:** **HIGH**

### 2.2. Incompatible File System Usage
*   **File Path:** `app/api/grounds/route.ts`
*   **Line Number:** 6, 18, 22
*   **Description:** The code uses `fs.readFileSync` and `fs.writeFileSync` to modify `data/grounds.json`. In a serverless environment (like Vercel), the file system is read-only or ephemeral. Changes made here will **not persist** or will crash the application.
*   **Risk Level:** **HIGH**

### 2.3. Inconsistent Slot Reconstruction
*   **File Path:** `lib/slotService.ts`
*   **Line Number:** 200-250
*   **Description:** The `getWeeklySlots` function checks for `blocked`, then `booked`, then `available`. If a slot is both blocked and booked (due to the bug in 2.1), it will show as "BLOCKED". However, the booking data still exists in the database, leading to data inconsistency.

## 3. API & Backend Issues

### 3.1. Privacy Leak in Firestore Rules
*   **File Path:** `firestore.rules`
*   **Line Number:** 33
*   **Description:** `allow read: if isAuthenticated();` for the `users` collection allows any logged-in user to download the entire user database (if they guess IDs or list them). This exposes names, emails, and phone numbers.

### 3.2. Missing Input Validation
*   **File Path:** `app/api/payment/route.ts`
*   **Description:** The API accepts `amount` from the client. A malicious user could send a `totalAmount` of `1` (Rs. 1) but a `productId` for a generic item, effectively paying almost nothing. The server should validate the amount against the actual price of the item/booking before generating a signature.

## 4. Code Quality & Maintainability

### 4.1. PII Logging
*   **File Path:** `app/api/payment/verify/route.ts`
*   **Line Number:** 39
*   **Description:** `console.log("Payment verification request:", ...)` logs transaction details. Avoid logging PII or sensitive transaction data in production logs.

### 4.2. Hardcoded "Fake Auth"
*   **File Path:** `app/api/uploadthing/core.ts`
*   **Description:** The comment `// Fake auth function` indicates unfinished work that was left in the codebase.

## 5. Recommendations

1.  **Secure API Routes:**
    *   Add `isAdmin` check to `app/api/grounds/route.ts`.
    *   Implement real auth in `app/api/uploadthing/core.ts` (replace "fakeId" with real user ID).
    *   Add a secret header check (e.g., `CRON_SECRET`) to `app/api/cron/route.ts`.
2.  **Fix Booking Logic:** Update `bookSlot` in `lib/slotService.ts` to throw an error if the slot is found in `data.blocked`.
3.  **Migrate Grounds Data:** Move `grounds.json` data to Firestore. The file-based approach is not viable for production.
4.  **Tighten Firestore Rules:** Restrict `users` collection read access. Users should only read their own profile. If managers need to see users, create a specific rule for managers.
5.  **Validate Payment Amount:** In `app/api/payment/route.ts`, fetch the actual booking price from the database using the `productId` (or booking ID) and ensure the `amount` matches.
6.  **Cleanup:** Delete `storage.rules` if Firebase Storage is not used.

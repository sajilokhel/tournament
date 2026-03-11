**Overview**
- **Purpose:** Docs for manager-facing venue creation and editing flows, APIs, and effects.
- **Audience:** Frontend engineers, mobile clients, and backend maintainers.

**APIs**
- **Create Venue:** POST /api/venues — [app/api/venues/route.ts](app/api/venues/route.ts#L1-L220)
  - **Auth:** `Authorization: Bearer <idToken>`; role must be `manager` or `admin`.
  - **Body:** `name`, `pricePerHour`, `slotConfig` (required), optional `description`, `latitude`, `longitude`, `address`, `imageUrls`, `attributes`, `sportType`, `advancePercentage`, `platformCommission`.
  - **Response:** 201 { id }
  - **Side-effects:** creates `venues/{id}` and initializes `venueSlots/{id}` (canonical schedule document).

- **Update Venue (metadata/pricing/images/etc):** PATCH /api/venues/:id — [app/api/venues/[id]/route.ts](app/api/venues/[id]/route.ts#L1-L200)
  - **Auth:** `Authorization: Bearer <idToken>`; caller must be `admin` or the venue's `managedBy` uid.
  - **Whitelisted fields:** `name`, `description`, `pricePerHour`, `advancePercentage`, `platformCommission`, `imageUrls`, `attributes`, `address`, `latitude`, `longitude`, `sportType`.
  - **Response:** 200 { ok: true }
  - **Notes:** Only listed fields are applied; `updatedAt` is set server-side.

- **Delete Venue:** DELETE /api/venues/:id — [app/api/venues/[id]/route.ts](app/api/venues/[id]/route.ts#L1-L200)
  - **Auth:** admin-only.
  - **Response:** 200 { ok: true }

- **Image Uploads:** Upload endpoints (UploadThing)
  - See [app/api/uploadthing/route.ts](app/api/uploadthing/route.ts#L1-L200) and core at [app/api/uploadthing/core.ts](app/api/uploadthing/core.ts#L1-L200).
  - Client uploads images, receives URLs; `imageUrls` is an array stored on the venue document.

- **Slot Management (schedule editing):**
  - POST /api/slots/generate — [app/api/slots/generate/route.ts](app/api/slots/generate/route.ts#L1-L200)
    - **Purpose:** (Manager) generate slots for a venue for a date range / daily times.
    - **Auth:** manager or admin.
    - **Body:** `venueId`, `startTime`, `endTime`, optional `slotDuration`, `days`.
  - POST /api/slots/hold — [app/api/slots/hold/route.ts](app/api/slots/hold/route.ts#L1-L200)
    - **Purpose:** Temporarily hold a slot (used in booking flows).
  - POST /api/slots/reserve — [app/api/slots/reserve/route.ts](app/api/slots/reserve/route.ts#L1-L200)
    - **Purpose:** Reserve a slot (confirm booking). May be used by managers when creating bookings manually.
  - POST /api/slots/unbook — [app/api/slots/unbook/route.ts](app/api/slots/unbook/route.ts#L1-L200)
    - **Purpose:** Remove a booking / free a slot.
  - **Implementation details:** These delegate to `lib/slotService.admin.ts` and modify the `venueSlots/{venueId}` canonical document. See [lib/slotService.admin.ts](lib/slotService.admin.ts#L1-L200).

**Supporting services & helpers**
- **Auth helpers:** verifyRequestToken, getUserRole, isManagerOrAdmin — [lib/server/auth.ts](lib/server/auth.ts#L1-L200)
- **Firestore constants:** `COLLECTIONS` and `DEFAULT_TIMEZONE` — [lib/utils.ts](lib/utils.ts#L1-L200)

**Editing types (what managers can edit)**
- **Metadata:** `name`, `description`, `address`, `latitude`, `longitude`, `sportType`.
- **Media:** `imageUrls` (managed by client uploads via UploadThing, then saved on the venue doc).
- **Pricing:** `pricePerHour`, `advancePercentage`, `platformCommission`.
- **Attributes:** Arbitrary `attributes` object for extensible fields (e.g., `covered`, `turfType`).
- **Schedule / Slots:** Use the slots APIs to generate or modify available time slots; changes affect `venueSlots/{venueId}`.

**Flows (end-to-end)**
- **Create venue (manager UI):**
  1. Client collects form + images.
  2. Upload images to UploadThing endpoint → receive `imageUrls`.
  3. POST /api/venues with form + `imageUrls` and `slotConfig`.
  4. Server creates `venues/{id}` and `venueSlots/{id}` (returns `id`).

- **Edit metadata or pricing (manager UI):**
  1. Client prepares patch body with changed fields (only whitelisted fields accepted).
  2. PATCH /api/venues/:id with Bearer token.
  3. Server verifies role (admin or `managedBy`) and applies changes, sets `updatedAt`.

- **Edit images:**
  1. Upload new images to UploadThing → get new URLs.
  2. PATCH /api/venues/:id with `imageUrls` array (replace or reorder as desired).

- **Edit schedule / slots:**
  1. For bulk schedule changes, use POST /api/slots/generate (manager/admin).
  2. To hold/reserve/unbook individual slots, use the respective slot endpoints.
  3. These endpoints update `venueSlots/{venueId}`; booking entries may also touch `bookings` collection depending on flow.

**Responses, errors & permissions**
- **401 Unauthorized:** Missing or invalid token (returned by `verifyRequestToken`).
- **403 Forbidden:** Caller is not manager/admin or not the venue owner for PATCH.
- **404 Not Found:** Venue id not found for PATCH/DELETE.
- **400 Bad Request:** Missing required fields when creating venues.
- **500 Server Error:** Admin SDK misconfiguration or unexpected errors.

**Security notes & known issues**
- PII risk: `venueSlots` has historically contained booking PII; see SECURITY_AUDIT.md for mitigation suggestions: [SECURITY_AUDIT.md](SECURITY_AUDIT.md#L1-L200).
- Always validate coordinates and numeric fields on client-side and optionally server-side for stronger guarantees.

**References (code)**
- Venue routes: [app/api/venues/route.ts](app/api/venues/route.ts#L1-L220)
- Venue update/delete: [app/api/venues/[id]/route.ts](app/api/venues/[id]/route.ts#L1-L200)
- Slot APIs: [app/api/slots](app/api/slots)
- Slot admin helper: [lib/slotService.admin.ts](lib/slotService.admin.ts#L1-L200)
- Auth helpers: [lib/server/auth.ts](lib/server/auth.ts#L1-L200)
- Upload helpers: [app/api/uploadthing/route.ts](app/api/uploadthing/route.ts#L1-L200)

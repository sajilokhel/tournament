# Fursal
A website to find and view available Fursal grounds and to reserve them.

## Stakeholders

### User
- Register or sign in using Google or email/password (Firebase Auth).
- Update profile and reset password.
- Browse available Fursal grounds and view detailed information for each.
- Book a Fursal ground:
  1. Select a Fursal ground.
  2. Choose date and time.
  3. Enter personal details.
  4. Confirm booking.
  5. View a QR code for payment.
  6. Upload payment screenshot (jpg, png, jpeg) and provide refund account details:
     - Bank account
     - E-Sewa account
     - Users may replace the uploaded screenshot before verification.
     - Users may cancel the booking before verification.
     - If a booking cannot be completed, the manager will issue a refund using the provided account details.
  7. Manager verifies the payment and updates booking status.
  8. Booking status is shown in the user's view.
  9. If verification fails, is refused, or the booking cannot proceed, the user is notified with the manager's reason.
  10. If successful, the user is notified.
- View booking history with statuses.
- Leave a review and rating after a successful booking; update or delete reviews.
- Search Fursal grounds by name, location, price range, rating, and availability.
- View manager contact details.

### Manager
- Register or sign in using Google or email/password (Firebase Auth).
- Update profile and reset password.
- Add new Fursal grounds with details (name, location, price, description, images, availability, and QR code for eSewa or Nepali bank).
- Update or delete Fursal ground listings.
- View all bookings (verified and unverified) for their grounds.
- Verify payments by checking uploaded screenshots.
  - If a booking cannot proceed, refuse the booking and provide a reason.
  - Refund the user to the provided account details and upload a refund screenshot.
  - Update booking status (verified, unverified, refused).
  - For refused bookings, track refund state: `in-process` or `complete`.
- View reviews and ratings for their grounds.
- Mark a verified booking as completed when the booking is fulfilled.
- Search bookings by user name, date, or status.
- View user contact details if needed.
- View booking statistics (total, completed, cancelled, revenue) and user feedback.

### Admin (single admin account)
- Sign in with email/password (Firebase Auth).
- Manage managers:
  - View all managers.
  - Add or remove managers.
  - Update manager information.
- View all Fursal grounds and bookings.
- View booking, refund, and revenue statistics across all grounds, with optional filtering by manager.

## Auth, Database, and Storage
- Auth and database: use Firebase Auth and Firestore.
- File storage: use UploadThing for uploads (payment and refund screenshots, ground images).

## UI Principles
- Break features into multiple pages or clear sections; avoid cluttering a single page.
- Simple, clean, and consistent design with clear navigation.
- Responsive for mobile and desktop.
- Consistent color palette and typography.
- Clear call-to-action buttons and user-friendly forms.
- Provide visual feedback (loading indicators, success/error messages).
- Accessibility: alt text for images, keyboard navigation, and other accessibility best practices.
- Use icons (e.g., `lucide`, `react-icons`) to enhance UX.
- Use `shadcn` UI components and the `shadcn` CLI for consistent, faster development.
- Use Tailwind CSS for styling.

## Firebase Rules
- Implement Firestore security rules according to roles (user, manager, admin).
- Create a `firebase-rules.md` file documenting which role can access each collection and the allowed operations.

## Typical User Flow
1. User opens the website.
2. If not signed in, the user is prompted to sign in or register.
3. After signing in, the user is redirected to the dashboard.
4. On the dashboard, the user sees available Fursal grounds and can proceed to view details or book.

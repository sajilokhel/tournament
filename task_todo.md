# Fursal - Task TODO List

## 🔧 Setup & Configuration

- [ ] Initialize Firebase project
  - [ ] Set up Firebase Auth
  - [ ] Set up Firestore database
  - [ ] Configure Firebase in project (`lib/firebase.ts`)
- [ ] Set up UploadThing for file uploads
  - [ ] Configure UploadThing API keys
  - [ ] Set up upload endpoints
- [ ] Create `firebase-rules.md` documentation
- [ ] Implement Firestore security rules
  - [ ] User role rules
  - [ ] Manager role rules
  - [ ] Admin role rules

---

## 👤 Authentication System

### User Authentication
- [ ] Implement user registration with email/password
- [ ] Implement user registration with Google OAuth
- [ ] Implement user sign-in with email/password
- [ ] Implement user sign-in with Google OAuth
- [ ] Implement password reset functionality
- [ ] Create authentication context/provider
- [ ] Implement authentication guards for protected routes

### Manager Authentication
- [ ] Implement manager registration with email/password
- [ ] Implement manager registration with Google OAuth
- [ ] Implement manager sign-in with email/password
- [ ] Implement manager sign-in with Google OAuth
- [ ] Implement password reset for managers

### Admin Authentication
- [ ] Create admin account in Firebase
- [ ] Implement admin sign-in with email/password
- [ ] Create admin-specific authentication guard

---

## 👥 User Features

### Profile Management
- [ ] Create user profile page
- [ ] Implement update profile functionality
- [ ] Implement profile picture upload
- [ ] Implement password reset from profile

### Fursal Ground Browsing
- [ ] Create Fursal grounds listing page
- [ ] Implement ground card component
- [ ] Create ground detail page
- [ ] Implement image gallery for grounds
- [ ] Display ground information (name, location, price, description, availability)
- [ ] Show manager contact details on ground page

### Search & Filter
- [ ] Implement search by name
- [ ] Implement filter by location
- [ ] Implement filter by price range
- [ ] Implement filter by rating
- [ ] Implement filter by availability

### Booking System
- [ ] Create booking flow UI (multi-step form)
  - [ ] Step 1: Select ground
  - [ ] Step 2: Choose date and time
  - [ ] Step 3: Enter personal details
  - [ ] Step 4: Confirm booking details
  - [ ] Step 5: Display payment QR code
  - [ ] Step 6: Upload payment screenshot
  - [ ] Step 7: Enter refund account details (bank/eSewa)
- [ ] Implement booking creation in Firestore
- [ ] Allow users to replace payment screenshot before verification
- [ ] Allow users to cancel booking before verification
- [ ] Display booking status
- [ ] Show notification for verification success/failure
- [ ] Display manager's reason for refusal (if applicable)

### Booking History
- [ ] Create booking history page
- [ ] Display all user bookings with statuses
- [ ] Show booking details
- [ ] Implement booking status indicators

### Reviews & Ratings
- [ ] Create review form component
- [ ] Implement review submission (only after successful booking)
- [ ] Implement review editing
- [ ] Implement review deletion
- [ ] Display reviews on ground detail page
- [ ] Display average rating for each ground

---

## 🏢 Manager Features

### Profile Management
- [ ] Create manager profile page
- [ ] Implement update profile functionality
- [ ] Implement password reset from profile

### Fursal Ground Management
- [ ] Create "Add Ground" page
  - [ ] Name input
  - [ ] Location input
  - [ ] Price input
  - [ ] Description textarea
  - [ ] Upload multiple images
  - [ ] Upload payment QR code (eSewa/bank)
  - [ ] Set availability
- [ ] Create "Edit Ground" page
- [ ] Implement ground update functionality
- [ ] Implement ground deletion with confirmation
- [ ] Display all manager's grounds in a dashboard

### Booking Management
- [ ] Create bookings dashboard for managers
- [ ] Display all bookings (verified and unverified)
- [ ] Implement booking search
  - [ ] Search by user name
  - [ ] Search by date
  - [ ] Filter by status
- [ ] Create booking detail/verification page
  - [ ] Display payment screenshot
  - [ ] Verify payment button
  - [ ] Refuse payment button with reason input
  - [ ] Upload refund screenshot
  - [ ] Update refund status (in-process/complete)
- [ ] Implement booking status updates
- [ ] Mark verified booking as completed
- [ ] Display user contact details for each booking

### Reviews Management
- [ ] Display all reviews for manager's grounds
- [ ] Show ratings statistics

### Statistics & Analytics
- [ ] Create statistics dashboard
- [ ] Display total bookings
- [ ] Display completed bookings
- [ ] Display cancelled bookings
- [ ] Calculate and display revenue
- [ ] Display user feedback summary

---

## 🔐 Admin Features

### Manager Management
- [ ] Create admin dashboard
- [ ] Create managers list page
- [ ] Implement add manager functionality
- [ ] Implement remove manager functionality
- [ ] Implement update manager information
- [ ] Display all managers with details

### System Overview
- [ ] Display all Fursal grounds across all managers
- [ ] Display all bookings across all managers
- [ ] Create system-wide statistics page
  - [ ] Total bookings
  - [ ] Total revenue
  - [ ] Refund statistics
  - [ ] Filter statistics by manager

---

## 🎨 UI/UX Components

### Layout Components
- [ ] Create main layout component
- [ ] Create header/navigation component
- [ ] Create footer component
- [ ] Create sidebar for dashboards
- [ ] Implement responsive navigation

### Shared Components
- [ ] Create loading spinner/indicators
- [ ] Create success/error toast notifications
- [ ] Create confirmation dialog component
- [ ] Create empty state component
- [ ] Create pagination component
- [ ] Create date picker component
- [ ] Create time picker component
- [ ] Create image upload component
- [ ] Create QR code display component
- [ ] Create status badge component
- [ ] Create rating display component
- [ ] Create search bar component
- [ ] Create filter panel component

### Forms
- [ ] Create reusable form components
- [ ] Implement form validation
- [ ] Add loading states to forms
- [ ] Add error handling to forms

---

## 📱 Responsive Design

- [ ] Ensure mobile responsiveness for all pages
- [ ] Test on tablet devices
- [ ] Test on desktop devices
- [ ] Optimize images for different screen sizes
- [ ] Implement mobile-friendly navigation

---

## ♿ Accessibility

- [ ] Add alt text to all images
- [ ] Implement keyboard navigation
- [ ] Ensure proper color contrast
- [ ] Add ARIA labels where necessary
- [ ] Test with screen readers
- [ ] Add focus indicators

---

## 🗄️ Database Schema

### Collections to Create
- [ ] `users` collection
  - [ ] Define user document structure
  - [ ] Add user profile fields
- [ ] `managers` collection
  - [ ] Define manager document structure
  - [ ] Add manager profile fields
- [ ] `grounds` collection
  - [ ] Define ground document structure
  - [ ] Add ground details fields
  - [ ] Link to manager
- [ ] `bookings` collection
  - [ ] Define booking document structure
  - [ ] Add booking status fields
  - [ ] Add payment screenshot URL
  - [ ] Add refund details
  - [ ] Link to user and ground
- [ ] `reviews` collection
  - [ ] Define review document structure
  - [ ] Add rating field
  - [ ] Link to user and ground

---

## 🧪 Testing & Quality Assurance

- [ ] Test user registration and login flows
- [ ] Test manager registration and login flows
- [ ] Test admin login flow
- [ ] Test booking flow end-to-end
- [ ] Test payment verification flow
- [ ] Test refund flow
- [ ] Test review submission and management
- [ ] Test search and filter functionality
- [ ] Test all CRUD operations for grounds
- [ ] Test responsive design on multiple devices
- [ ] Test accessibility features
- [ ] Test file upload functionality
- [ ] Test error handling and edge cases

---

## 📝 Documentation

- [ ] Complete `firebase-rules.md`
- [ ] Document API endpoints
- [ ] Document component usage
- [ ] Add code comments
- [ ] Create user guide (optional)
- [ ] Create manager guide (optional)
- [ ] Create admin guide (optional)

---

## 🚀 Deployment

- [ ] Set up production Firebase project
- [ ] Configure environment variables
- [ ] Set up UploadThing production keys
- [ ] Deploy to hosting platform (Vercel/Netlify)
- [ ] Test production build
- [ ] Set up monitoring and error tracking
- [ ] Configure custom domain (if applicable)

---

## 📊 Priority Levels

### High Priority (Core Functionality)
- Authentication system
- User booking flow
- Manager ground management
- Manager booking verification
- Basic UI components

### Medium Priority
- Search and filter
- Reviews and ratings
- Statistics and analytics
- Admin features

### Low Priority (Nice to Have)
- Advanced analytics
- Additional accessibility features
- Performance optimizations
- Advanced UI animations

---

## 📅 Suggested Development Phases

### Phase 1: Foundation
- Setup & Configuration
- Authentication System
- Basic UI Components
- Database Schema

### Phase 2: Core Features
- User Features (Browsing, Booking)
- Manager Features (Ground Management, Booking Verification)
- File Upload Integration

### Phase 3: Enhanced Features
- Search & Filter
- Reviews & Ratings
- Booking History
- Statistics

### Phase 4: Admin & Polish
- Admin Features
- Responsive Design
- Accessibility
- Testing

### Phase 5: Deployment
- Production Setup
- Testing
- Deployment
- Documentation

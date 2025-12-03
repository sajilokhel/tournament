# Sajilokhel - Venue Booking Platform

A modern web application for discovering and booking futsal grounds with integrated payment processing and real-time availability tracking.

## Features

### For Users
- **Authentication**: Secure sign-in via Google or email/password using Firebase Auth
- **Venue Discovery**: Browse futsal grounds with interactive maps powered by Leaflet and OpenStreetMap
- **Advanced Search**: Filter venues by location, price range, rating, and availability
- **Seamless Booking**: Select dates, time slots, and complete payment through eSewa integration
- **Booking Management**: Track booking history, view status updates, and manage reservations
- **Reviews & Ratings**: Share feedback after completed bookings

### For Managers
- **Venue Management**: Add, edit, and delete venue listings with images and details
- **Booking Oversight**: View and manage all bookings with payment verification
- **Payment Processing**: Verify payments and handle refunds through eSewa
- **Analytics Dashboard**: Monitor revenue, bookings, and customer feedback
- **Slot Management**: Configure availability schedules and pricing

### For Administrators
- **Manager Management**: Add, remove, and oversee venue managers
- **System Overview**: Access comprehensive analytics across all venues
- **User Administration**: Manage user accounts and permissions

## Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) with App Router and Turbopack
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **UI Components**: [shadcn/ui](https://ui.shadcn.com/) with Radix UI primitives
- **Authentication**: Firebase Auth
- **Database**: Firebase Firestore
- **File Storage**: [UploadThing](https://uploadthing.com/)
- **Payment Gateway**: eSewa ePay API v2
- **Maps**: Leaflet with React-Leaflet and OpenStreetMap
- **Form Handling**: React Hook Form with Zod validation
- **Icons**: Lucide React, Tabler Icons

## Getting Started

### Prerequisites

- Node.js 20 or higher
- pnpm (recommended) or npm
- Firebase project with Firestore and Authentication enabled
- UploadThing account
- eSewa merchant account (for payment processing)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/EV-OD/tournament.git
cd tournament
```

2. Install dependencies:
```bash
pnpm install
```

3. Configure environment variables:
```bash
cp .env.example .env.local
```

Edit `.env.local` and add your credentials:
```env
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# UploadThing
UPLOADTHING_SECRET=your_uploadthing_secret
NEXT_PUBLIC_UPLOADTHING_APP_ID=your_uploadthing_app_id

# eSewa Payment Gateway
NEXT_PUBLIC_ESEWA_MERCHANT_CODE=your_merchant_code
ESEWA_SECRET_KEY=your_secret_key
```

4. Set up Firebase:
   - Create a Firebase project
   - Enable Authentication (Email/Password and Google providers)
   - Create Firestore database
   - Configure security rules (see `SRS.md` for role-based access)

5. Run the development server:
```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

### Building for Production

```bash
pnpm build
pnpm start
```

## Project Structure

```
├── app/                    # Next.js App Router pages
│   ├── admin/             # Admin dashboard
│   ├── api/               # API routes
│   ├── auth/              # Authentication pages
│   ├── manager/           # Manager dashboard
│   ├── payment/           # Payment processing pages
│   ├── user/              # User dashboard
│   └── venue/             # Venue details pages
├── components/            # React components
│   ├── ui/                # shadcn/ui components
│   └── ...                # Feature components
├── contexts/              # React contexts
├── hooks/                 # Custom React hooks
├── lib/                   # Utility functions and configurations
│   ├── esewa/             # eSewa payment integration
│   └── ...
└── public/                # Static assets
```

## Payment Integration

The platform uses eSewa's ePay API v2 with HMAC-SHA256 signature verification for secure transactions. See [ESEWA_INTEGRATION.md](./ESEWA_INTEGRATION.md) for detailed implementation guide.

## Documentation

- **[SRS.md](./SRS.md)**: Software Requirements Specification with detailed feature descriptions
- **[ESEWA_INTEGRATION.md](./ESEWA_INTEGRATION.md)**: Payment gateway integration guide

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is private and proprietary.

## Contact

For questions or support, please open an issue on GitHub.

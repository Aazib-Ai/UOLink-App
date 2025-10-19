# UOLINK - Next.js Version

A Next.js application for sharing and accessing educational materials, rebranded as UOLINK.

## Features

- 📚 Browse and search educational materials
- 🔍 Advanced filtering by subject, semester, module, and contributor
- 💾 Save/bookmark favorite materials
- 📱 Responsive design for all devices
- 🔐 Firebase authentication integration
- 🌐 Material sharing via WhatsApp
- ⭐ Rate and contribute materials

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd uolink-webapp
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.local.example .env.local
```

Edit `.env.local` and add your Firebase configuration:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_ADMIN_EMAIL=admin@example.com
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── about/             # About page
│   ├── auth/              # Authentication page
│   ├── donate/            # Donation page
│   ├── note/              # Individual note viewer
│   ├── upload/            # Upload page (coming soon)
│   ├── userpage/          # User profile page
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home page
│   └── globals.css        # Global styles
├── components/            # React components
│   ├── ui/               # UI components
│   ├── CustomSelect.tsx  # Custom select component
│   ├── Dashboard.tsx     # Main dashboard
│   ├── Navbar.tsx        # Navigation bar
│   └── NotesLoader.tsx   # Loading skeleton
├── contexts/             # React contexts
│   ├── NotesContext.tsx
│   ├── SavedNotesContext.tsx
│   ├── NotesContextProvider.tsx
│   └── SavedNotesContextProvider.tsx
├── lib/                  # Utility functions
│   ├── firebase.ts       # Firebase configuration
│   └── utils.ts          # Helper functions
└── styles/               # Additional styles
    └── loader.css        # Loading animations
```

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Technology Stack

- **Framework**: Next.js 15
- **Styling**: Tailwind CSS
- **Authentication**: Firebase Auth
- **Database**: Firestore
- **UI Components**: Lucide React
- **Animations**: Framer Motion

## Features Status

### ✅ Completed
- Material browsing and search
- Advanced filtering system
- Firebase integration
- Responsive design
- Note viewing
- User authentication (basic)
- Save/bookmark functionality
- WhatsApp sharing

### 🚧 In Progress
- Upload functionality
- Google Sign-In authentication
- User profiles
- Advanced admin features

### 📋 Planned
- Material ratings
- Discussion forums
- Mobile app
- Offline access

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the ISC License - see the package.json file for details.

## Support

If you find this project helpful, consider supporting us through our [donation page](/donate).

## Original Project

This is a Next.js migration of the original React/Vite application. The original project can be found in the `getmaterial-main` directory.
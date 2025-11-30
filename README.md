# UOLINK

UOLINK is an open-source Next.js app that helps students discover, share, and discuss study material. The goal is to build a collaborative library where every contribution raises the quality of resources available to the community.

## Overview

The project pairs the App Router with Firebase for auth, data, and serverless workflows. Users can browse a rich dashboard, personalize their feed, manage contributions, explore public profiles with aura scoring, and participate through comments, ratings, and moderation.

## Features

- **Discoverable library**: Search, filter, and sort notes by title, subject, teacher, semester, section, material type, contributor, or trend score.
- **Personalized feed**: "For You" feed ranks content using aura, profile metadata, and engagement; users can switch to the global trending feed at any time.
- **Contribution workflow**: Tools to upload, edit, and retire notes with validation, suggestion lookups, and an activity dashboard for personal stats.
- **Profiles & aura**: Public contributor pages with badges, aura tiers, hero stats, and searchable note lists to surface subject-matter experts.
- **Community tools**: Comment threads with replies, reactions, pagination, and save/bookmark actions plus share links for WhatsApp or copying direct URLs.
- **Moderation ready**: Reporting, credibility scoring, Cloudflare R2 storage integration, and admin overrides controlled via environment configuration.
- **Document experiences**: Lazy PDF viewer for large files and a browser-based document scanner (beta) with mobile optimizations and PDF assembly.

## Technology Stack

- Next.js 15 with the App Router and React 18.
- Tailwind CSS plus class variance utilities and micro-interactions via Framer Motion.
- Firebase (Auth, Firestore, Admin SDK) for identity and data; Admin features require service-account credentials.
- Cloudflare R2 (S3-compatible) to store original documents and generated assets.
- Client libraries such as React Firebase Hooks, Lucide icons, Headless UI, and @react-pdf/renderer for the viewing experience.

## Project Structure

```
.
|-- public/                 # Static assets and icons
|-- scripts/                # Utility scripts (PWA tests, icon generation)
|-- src/
|   |-- app/                # App Router routes and layouts
|   |-- components/         # UI (dashboard, profile, scanner, etc.)
|   |-- contexts/           # React context providers (auth, contributions, splash)
|   |-- hooks/              # Client hooks for API access and complex state
|   |-- lib/                # Firebase clients, data services, feature logic
|   `-- styles/             # Global and component styles
|-- .env.local.example      # Reference environment variables
`-- package.json
```

## Getting Started

1. **Prerequisites**  
   Install Node.js 18 (or newer) and npm. pnpm or yarn will work, but npm is assumed below.

2. **Clone & install**
   ```bash
   git clone https://github.com/<your-org>/uolink-webapp.git
   cd uolink-webapp
   npm install
   ```

3. **Configure environment**  
   Copy `.env.local.example` to `.env.local` and fill in the values for your Firebase project, Cloudflare R2 bucket, and admin account. Multi-line private keys must stay wrapped in quotes with literal `\n` line breaks.

4. **Run the app**
   ```bash
   npm run dev
   ```
   Visit http://localhost:3000 and sign in with any Firebase user that exists in your project.

5. **Production build**
   ```bash
   npm run build
   npm run start
   ```


## Common Scripts

- `npm run dev` - start the development server with hot reload.
- `npm run build` - compile the production bundle.
- `npm run start` - serve the production build locally.
- `npm run lint` - run ESLint with Next.js defaults.

## Key Modules

- `src/lib/firebase/notes.ts` - Firestore queries, pagination, filters, and personalization helpers.
- `src/lib/firebase/personalized-feed.ts` - Aura-aware scoring and "For You" feed composition.
- `src/components/dashboard/` - Dashboard UI, filters, sort controls, note cards, and personalized feed view.
- `src/components/profile/` - Public profile page with aura tiers, badges, and searchable contribution lists.
- `src/contexts/ContributionsContext.tsx` & `src/hooks/contributions/` - Contribution management, editing, validation, and stats.
- `src/components/scanner/` - Document scanner modal, processing pipeline, and PDF export flow (beta).
- `src/components/CommentSection.tsx` - Comment threads with replies, optimistic updates, and pagination.

## Contribution Guide

1. Fork the repository and create a branch (`git checkout -b feature/your-feature`).
2. Make your changes, keeping comments focused on non-obvious logic.
3. Run `npm run lint` to ensure formatting and lint rules pass.
4. Commit with a descriptive message and push the branch.
5. Open a pull request describing the change, any configuration steps, and how reviewers can test it.

### Development Tips

- Use a personal Firebase project for local development; Firestore security rules should mirror production.
- Set `NEXT_PUBLIC_ADMIN_EMAIL` to your own account to access admin-only controls in the dashboard.
- When testing Cloudflare R2 uploads locally, ensure the bucket allows the service account to put and read objects.
- The document scanner and personalization features are still iterating; include screenshots or notes in PRs when those areas change.

## Roadmap

- [x] Advanced dashboard filters, saving, reporting, and credibility scoring.
- [x] Personalized feed with aura-driven relevance and fallbacks.
- [x] Public contributor profiles with aura badges and hero stats.
- [ ] Full upload pipeline with image/document scanning and metadata extraction.
- [ ] Google OAuth sign-in alongside email/password.
- [ ] Dedicated admin console for moderation and analytics.
- [ ] Mobile-first layout refinements and offline reading mode.

## Support

If this project helps you or your institution, consider donating via the in-app `/donate` page to offset Firebase and storage costs.

## License

UOLINK is released under the ISC License. See `package.json` for the full text.

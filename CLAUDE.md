# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm run dev              # Start dev server with Turbopack (default)
npm run dev:webpack      # Start dev server with Webpack (fallback)
npm run build            # Production build
npm run start            # Run production build
npm run lint             # Run ESLint
npm run worker:start     # Run worker (set WORKER_ROLE env var first)
```

For the Electron desktop app:
```bash
cd apps/desktop
npm run start            # Launch Electron app
```

## Architecture Overview

TubiQ-Web is a YouTube creator analytics and asset management platform with three main components:

### 1. Next.js Web App (Root)
- **Framework**: Next.js 16 with App Router + Turbopack
- **State**: Zustand for persistent state, React Context for auth
- **Styling**: Tailwind CSS 4
- **Database**: Supabase (PostgreSQL with RLS)

### 2. Worker Services (collector-worker/, crawler-worker/, relay-metadata-worker/)
- Node.js ES modules that run as separate processes
- Collector: Fetches YouTube channel stats every 6 hours, rotates API keys
- Crawler: Fills missing channel metadata
- Relay-metadata: Syncs video metadata from relay_videos table
- Run via `worker-runner.cjs` with `WORKER_ROLE` environment variable

### 3. Electron Desktop App (apps/desktop/)
- Video downloading, AI-powered processing
- IPC bridge via preload.js for secure main/renderer communication
- Integrates Google Generative AI, Fal AI, JIMP for image processing

## Key Directory Structure

```
app/                    # Next.js App Router pages
  api/                  # API routes (RESTful pattern)
  dashboard/            # User dashboard
  channel/[channelId]/  # Channel detail pages
  storyboard/           # Video storyboarding
  subtitle-maker/       # Subtitle generation
  script-maker/         # Script generation
src/
  components/           # React components (PascalCase)
  hooks/                # Custom hooks (useXxx.ts)
  lib/                  # Utilities and services
    supabase.ts         # Client-side Supabase
    supabase-server.ts  # Server-side Supabase (service role)
    AuthProvider.tsx    # Auth context
  types/index.ts        # TypeScript interfaces
  mock/                 # Mock data for development
```

## Path Alias

`@/*` maps to `src/*` - use `@/components/`, `@/lib/`, `@/hooks/`

## Authentication Pattern

- AuthProvider wraps the app at root layout
- Use `useAuth()` hook to access user, session, isLoggedIn
- API routes validate JWT via Authorization header
- Server operations use `SUPABASE_SERVICE_ROLE_KEY`

## Important Configuration

**next.config.ts**: Puppeteer is externalized to avoid Turbopack symlink errors on Windows:
```typescript
serverExternalPackages: ['puppeteer', 'puppeteer-core']
```

## DEV_SPEC Styling Conventions

Follow these for UI consistency:
- Layout: `max-w-7xl`, padding `px-6` (mobile `px-4`), sections `space-y-6`
- Cards: `bg-white border border-gray-200 rounded-2xl shadow-sm p-6`
- Primary buttons: `bg-black text-white h-10`
- Secondary buttons: white background with border, `h-10`
- Status badges: Green (Growing), Blue (Stable), Gray (Active)
- Numbers: compact format (1.2M, 850K), percentages with sign (+12.5%)
- Dates: `YYYY.MM.DD` format

## Component Guidelines

- Pages (`app/*/page.tsx`) should only compose components, no logic
- Each component has single responsibility
- Use `'use client'` directive only when needed (state, effects, browser APIs)
- Utilities go in `/src/lib/`, never in page files

## API Routes Pattern

Standard RESTful at `app/api/[feature]/route.ts`:
- GET: Fetch with query params for filtering/pagination
- POST: Create or trigger operations
- Fire-and-forget pattern for background tasks (fetch without await)

## Worker API Key Rotation

Workers rotate through YouTube API keys (YOUTUBE_API_KEY_1, _2, etc.) with 9000 quota per key. Keys automatically cycle when quota exhausted.

## Environment Variables

Required for development:
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (client)
- `SUPABASE_SERVICE_ROLE_KEY` (server/workers)
- `YOUTUBE_API_KEY_1` (at minimum, more for rotation)

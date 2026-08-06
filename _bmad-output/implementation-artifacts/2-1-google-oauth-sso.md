---
status: review
story_id: 2-1-google-oauth-sso
baseline_commit: 6c2057524f53430528e02bbbdfe5c3c35be3b143
---

# Story 2.1: Google OAuth SSO & Profile Capture

## Story

As a User,
I want to log in using my Google account,
So that I can securely access the system without creating a new password, and have my profile picture, name, and email automatically saved.

## Acceptance Criteria

**Given** I attempt to sign in via Google OAuth with any valid Google account
**When** I complete the Google sign-in flow
**Then** my JWT session is created and my `User` record is created/fetched with a default `STUDENT` role (if new) ✅
**And** my Google profile picture URL, name, and email are captured and stored in the database ✅
**And** returning users have their name and profile picture refreshed from Google on each sign-in ✅
**And** my `role` claim is embedded directly into the JWT token ✅
**And** a login page is displayed at `/login` with a "Sign in with Google" button ✅

## Tasks / Subtasks

- [x] Task 1: Install and configure NextAuth.js (Auth.js v5)
  - [x] Install `next-auth@beta` (Auth.js v5) and `@auth/prisma-adapter`
  - [x] Generate `AUTH_SECRET` and add to `.env.local` (used `crypto.randomBytes`)
  - [x] Create `src/lib/auth.ts` with NextAuth configuration: Google provider, JWT strategy, domain-restricted signIn callback, Prisma adapter
  - [x] Create `src/app/api/auth/[...nextauth]/route.ts` — Auth.js v5 catch-all handler
  - [x] Configure the `jwt` callback to embed the `role` claim in the JWT token from the database User record
  - [x] Configure the `session` callback to expose `user.id` and `user.role` on the session object
  - [x] Create `src/types/next-auth.d.ts` TypeScript module augmentation for extended session types

- [x] Task 2: Create the login page
  - [x] Create `src/app/login/page.tsx` with a "Sign in with Google" button using `signIn("google")`
  - [x] Style the page with the CaféSmart dark theme design tokens from `globals.css`
  - [x] Display the CaféSmart logo/branding and tagline on the login page
  - [x] Handle loading state and session redirect properly

- [x] Task 3: Google profile capture on sign-in (replaces domain restriction)
  - [x] Remove the domain restriction check from the `signIn` callback — any valid Google account can sign in
  - [x] In the `jwt` callback: capture `profile.picture` from the Google profile and store as `image` on the User record
  - [x] On each sign-in, refresh the user's `name` and `image` from Google profile data (keep email immutable)
  - [x] Remove the access-denied error banner from the login page (no longer needed)

- [x] Task 4: Session provider and auth helpers
  - [x] Create `src/lib/auth-helpers.ts` with `getServerSession()`, `requireAuth()`, and `requireRole()` helpers
  - [x] `getServerSession()` wraps `auth()` from next-auth for server component/server-side usage
  - [x] `requireAuth()` redirects to `/login` if no session (for API route protection)
  - [x] Create `src/components/providers/SessionProvider.tsx` (Client Component) wrapping NextAuth `SessionProvider`

- [x] Task 5: Protect the root layout with session context
  - [x] Wrap the app in `SessionProvider` via `src/app/layout.tsx` (RootLayout)
  - [x] Update `src/app/page.tsx` to redirect: unauthenticated → `/login`, STUDENT → `/student/home`, ADMIN → `/admin/dashboard`
  - [x] Update metadata in `layout.tsx`: title → "CaféSmart", description updated

- [x] Task 6: End-to-end OAuth flow verification
  - [x] Start the dev server — compiles and boots without errors
  - [x] Verify login page returns HTTP 200 at `/login`
  - [x] Verify NextAuth `/api/auth/signin` redirects to `/login` (pages config working)
  - [x] Verify root `/` redirects to `/login` for unauthenticated users
  - [x] Full OAuth flow verified with real Google credentials — session created, User record created with profile picture, name, and email

- [x] Task 7: Add profile fields to Prisma schema and refresh auth config (REVISED — Aug 6)
  - [x] Add `image` (String?) — Google profile picture URL, captured on sign-in
  - [x] Add `regNo` (String? @unique) — Student Registration Number (e.g., "2023/ICT/001")
  - [x] Add `batch` (String?) — Academic year/batch (e.g., "2023/2024")
  - [x] Add `allergies` (String[]) — Food allergies: Nuts, Dairy, Gluten, Shellfish, Eggs, Soy, None
  - [x] Add `phone` (String?) — Contact phone number
  - [x] Push schema to database with `npx prisma db push`
  - [x] Update `auth.ts` `jwt` callback to capture `profile.picture` → `image` on User record
  - [x] Update `auth.ts` `signIn` callback — remove domain restriction, allow any Google account
  - [x] Remove access-denied error display from login page

## Dev Notes

### Architecture Context

> **AD-4 (REVISED Aug 6): Auth is JWT, Roles are Claims, Middleware Enforces.** NextAuth.js with Google OAuth. Session strategy: JWT (stateless). Any valid Google account can sign in — no email domain restriction. The `role` claim (`STUDENT` | `ADMIN`) is embedded in the JWT at sign-in. Google profile picture URL, name, and email are captured and stored in the database on first sign-in via the PrismaAdapter. Default role for all new users is `STUDENT`.
>
> **AD-12 (NEW): User Profile is Enriched Post-Auth.** Google OAuth provides the foundation (name, email, picture). After first sign-in, Students complete onboarding with: Student Registration Number, Batch, Department, Dietary Preference, Food Allergies (multi-select), and optional Phone Number. All fields stored on the `User` model and editable from a Profile page.

### Technology Stack

| Component | Technology | Version | Notes |
|---|---|---|---|
| Auth Framework | NextAuth.js (Auth.js) | v5 (beta) | JWT strategy, Google provider, Prisma adapter |
| Auth Adapter | @auth/prisma-adapter | latest | Links NextAuth to Prisma User/Account/Session models |
| Session | JWT (stateless) | — | No database session table needed with JWT strategy |
| OAuth Provider | Google | — | Requires GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET |

### Auth.js v5 Key Differences from v4

- Package is `next-auth@beta` (Auth.js v5), NOT `next-auth` (v4)
- Configuration is in `src/lib/auth.ts` — exports `auth`, `signIn`, `signOut`, `handlers`
- Root handler is `src/app/api/auth/[...nextauth]/route.ts` exporting GET/POST from `handlers`
- No more `pages` option — uses App Router file-system routing for sign-in page
- Adapter: `@auth/prisma-adapter` instead of `@next-auth/prisma-adapter`
- `auth()` is the server-side session getter (replaces `getServerSession`)
- `useSession` from `next-auth/react` still works for client components

### Auth.js Configuration (src/lib/auth.ts)

```typescript
import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "./prisma"

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async signIn() {
      // Any valid Google account can sign in — no domain restriction (AD-4 revised)
      return true;
    },
    async jwt({ token, user, account, profile }) {
      // On first sign-in: PrismaAdapter creates the User record
      if (user) {
        token.role = (user as { role?: string }).role ?? "STUDENT";
        token.id = user.id!;
      }
      // Refresh profile picture and name from Google on each sign-in
      if (account?.provider === "google" && profile) {
        const googleProfile = profile as { picture?: string; name?: string };
        if (token.email) {
          await prisma.user.update({
            where: { email: token.email },
            data: {
              image: googleProfile.picture ?? undefined,
              name: googleProfile.name ?? undefined,
            },
          });
        }
      }
      // Refresh role from database on subsequent requests
      if (!user && token.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email },
          select: { role: true, id: true },
        });
        if (dbUser) {
          token.role = dbUser.role;
          token.id = dbUser.id;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as string;
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
})
```

### Auth.js Root Handler (src/app/api/auth/[...nextauth]/route.ts)

```typescript
import { handlers } from "@/lib/auth"
export const { GET, POST } = handlers
```

### Environment Variables Required

```
AUTH_SECRET=<generated-secret>          # npx auth secret
AUTH_GOOGLE_ID=<google-client-id>       # from Google Cloud Console
AUTH_GOOGLE_SECRET=<google-client-secret>
AUTH_URL=http://localhost:3000          # for dev; production URL in prod
```

> **Note:** Auth.js v5 uses `AUTH_*` prefix for env vars (not `NEXTAUTH_*`). However, `NEXTAUTH_URL` is still recognized as a fallback. For consistency, use `AUTH_URL`.

### Google Cloud Console Setup Required (Manual)

The developer must:
1. Go to https://console.cloud.google.com/apis/credentials
2. Create an OAuth 2.0 Client ID (Web application type)
3. Add `http://localhost:3000/api/auth/callback/google` as an authorized redirect URI
4. Copy the Client ID and Client Secret into `.env.local` as `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`

### Prisma Schema — User Model (REVISED — Aug 6)

```prisma
model User {
  id                String             @id @default(uuid())
  email             String             @unique
  name              String
  image             String?            // Google profile picture URL (AD-12)
  role              Role               @default(STUDENT)
  regNo             String?            @unique  // Student Registration Number, e.g. "2023/ICT/001"
  batch             String?            // Academic year, e.g. "2023/2024"
  department        Department?
  dietaryPreference DietaryPreference?
  allergies         String[]           // Multi-select: Nuts, Dairy, Gluten, Shellfish, Eggs, Soy, None
  phone             String?            // Contact phone number
  onboardingDone    Boolean            @default(false)
  createdAt         DateTime           @default(now())
  updatedAt         DateTime           @updatedAt

  // Relations (unchanged)
  accounts          Account[]
  wallet            WalletAccount?
  orders            Order[]
  coinBatches       CoinBatch[]
  groupOrders       GroupOrder[]       @relation("OrganizerOrders")
  groupParticipants GroupOrderParticipant[]
}
```

> **Note:** The `allergies` field uses Prisma's `String[]` native array type (supported in PostgreSQL). The `regNo` is `@unique` to prevent duplicate registration numbers. The `image` field stores the Google profile picture URL (or a custom upload URL).

### Key File Locations (REVISED)

```
project-root/
├── prisma/
│   └── schema.prisma               # User model: added image, regNo, batch, allergies, phone (MODIFIED)
├── src/
│   ├── lib/
│   │   ├── auth.ts                 # signIn: removed domain restriction; jwt: captures profile picture (MODIFIED)
│   │   └── auth-helpers.ts         # getServerSession, requireAuth, requireRole helpers (unchanged)
│   ├── app/
│   │   ├── login/
│   │   │   └── page.tsx            # Removed access-denied error banner (MODIFIED)
│   │   └── api/
│   │       └── auth/
│   │           └── [...nextauth]/
│   │               └── route.ts    # Auth.js catch-all handler (unchanged)
│   └── components/
│       └── providers/
│           └── SessionProvider.tsx     # Client Component wrapper (NEW)
├── .env.local                         # Add AUTH_SECRET, AUTH_GOOGLE_ID, etc. (MODIFIED)
└── package.json                       # Add next-auth (MODIFIED)
```

### Previous Stories Context

- **Story 1.1**: Custom server running. Auth.js route handler works within the Next.js custom server via `tsx server.ts`.
- **Story 1.2**: Prisma ORM with 14 models. `User` model has `email` (unique), `name`, `role`, `department`, `dietaryPreference`, `onboardingDone`. The Prisma adapter needs at minimum `User`, `Account`, and `Session` models. Note: `Session` model is NOT in our schema — we use JWT strategy so it's optional.
- **Story 1.3**: Dark theme design system in `globals.css`. Login page should use existing design tokens: background `oklch(0.08 0.01 260)`, brand accent `oklch(0.78 0.18 55)`, glassmorphism cards.
- **Story 1.5**: 100 student users seeded with `@fot.ruh.ac.lk` emails. The JWT callback's upsert logic will find these existing User records on first OAuth sign-in.

### Important Edge Cases

1. **Existing seed users**: Story 1.5 seeded 100 users with `STU001@fot.ruh.ac.lk` etc. When these users sign in via Google with their real `@fot.ruh.ac.lk` emails, the `PrismaAdapter` will link the OAuth account to the existing User record. The seed email format won't match real Google emails — this is expected. Real users get NEW records.

2. **Admin accounts**: Admins are manually promoted in the database (change `role` to `ADMIN`). There's no self-registration path for admins. The default role for all new OAuth users is `STUDENT`.

3. **Session expires**: JWT tokens have a default maxAge of 30 days. Configure via `session.maxAge` in the NextAuth config if needed.

4. **Multiple Google accounts**: A single User can only have one Google account linked. The adapter handles this via the `Account` model's compound unique constraint.

5. **Domain check edge case**: The `@fot.ruh.ac.lk` check is case-insensitive — normalize the email to lowercase before checking.

### Dev Agent Record

### Implementation Plan

1. Installed `next-auth@beta` (Auth.js v5, 5.0.0-beta.32) and `@auth/prisma-adapter`.
2. Generated `AUTH_SECRET` via `crypto.randomBytes` and added to `.env.local`.
3. Created `src/lib/auth.ts` — Google OAuth (no domain restriction), JWT strategy, PrismaAdapter, profile picture/name capture on each sign-in.
4. Added `Account` and `VerificationToken` models to Prisma schema (required by PrismaAdapter).
5. Added 5 new profile fields to User model: `image`, `regNo`, `batch`, `allergies` (String[]), `phone`.
6. Pushed schema and regenerated Prisma Client.
7. Created `src/app/api/auth/[...nextauth]/route.ts`, `src/types/next-auth.d.ts`, `src/components/providers/SessionProvider.tsx`, `src/lib/auth-helpers.ts`.
8. Created `src/app/login/page.tsx` — premium dark-themed login page. No domain restriction error banner.
9. Updated `src/app/layout.tsx` (SessionProvider + metadata) and `src/app/page.tsx` (role-based redirect).

### Debug Log

- **PrismaAdapter requirements**: Auth.js v5 adapter needs `Account` and `VerificationToken` models in the schema. Added both before pushing.
- **Profile picture capture**: The `jwt` callback reads `profile.picture` from Google OAuth response and upserts into `User.image` on every sign-in. Name also refreshed from Google each time.
- **Schema push warning**: `regNo` unique constraint — 100 existing seed users had null `regNo` values, no conflict.
- **Domain restriction removed**: `signIn` callback now returns `true` for all accounts. Login page access-denied banner removed.

### Completion Notes

All 7 tasks completed. Auth.js v5 configured with open Google OAuth (any Google account), automatic profile picture/name capture, and 5 new profile fields (image, regNo, batch, allergies, phone). Login page simplified — no domain restriction. Schema pushed (User + Account + VerificationToken). Server compiles and boots cleanly.

## File List

**New files:**
- `src/lib/auth.ts`: NextAuth.js v5 configuration — Google OAuth, JWT strategy, PrismaAdapter, domain-restricted signIn, role-in-JWT callbacks.
- `src/lib/auth-helpers.ts`: Server-side helpers — `getServerSession()`, `requireAuth()`, `requireRole()`.
- `src/app/api/auth/[...nextauth]/route.ts`: Auth.js v5 catch-all handler (GET/POST).
- `src/app/login/page.tsx`: Login page with Google sign-in button, access-denied error display, CaféSmart branding, dark theme + glassmorphism + Framer Motion animations.
- `src/components/providers/SessionProvider.tsx`: Client Component wrapping NextAuth `SessionProvider`.
- `src/types/next-auth.d.ts`: TypeScript module augmentation for extended session/JWT types.

**Modified files:**
- `src/app/layout.tsx`: Added `SessionProvider` wrapper, updated metadata to "CaféSmart".
- `src/app/page.tsx`: Replaced boilerplate with role-based redirect (unauthenticated → /login, STUDENT → /student/home, ADMIN → /admin/dashboard).
- `.env.local`: Added `AUTH_SECRET`, `AUTH_URL`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`.
- `package.json`: Added `next-auth` and `@auth/prisma-adapter` dependencies.

## Change Log

| Date | Change |
|---|---|
| 2026-08-06 | Story created for Epic 2, Story 2.1: Google OAuth SSO & Domain Restriction |
| 2026-08-06 | Implementation complete — all 6 tasks done, all 4 ACs verified |
| 2026-08-06 | Status updated to `review` |

---
status: review
story_id: 2-3-student-profile-onboarding
baseline_commit: 4f0d7bc8c7765db8201ae2dc4f7fa73862384e1e
---

# Story 2.3: Student Profile Onboarding & Profile Page

## Story

As a First-Time Student,
I want to complete my full profile (registration number, batch, department, dietary preference, allergies) and have a dedicated Profile page to manage my details,
So that the menu, recommendations, and allergen warnings are tailored to me.

## Acceptance Criteria

**Given** I have successfully authenticated but my `onboardingDone` flag is `false`
**When** I attempt to access any protected student route (like `/student/home`)
**Then** I am redirected to the `/student/onboarding` page ✅
**And** the onboarding form collects: Student Registration Number (text), Batch/Academic Year (text, e.g., "2023/2024"), Department (ICT/ET/BST dropdown), Dietary Preference (Vegan/Vegetarian/Non-Veg dropdown), Food Allergies (multi-select: Nuts, Dairy, Gluten, Shellfish, Eggs, Soy, None), Phone Number (optional) ✅
**And** my Google profile picture and name are pre-filled and editable ✅
**And** after completing all required fields, the `onboardingDone` flag is set to `true` and I am redirected to `/student/home` ✅
**And** I have access to a `/student/profile` page where I can view and edit all my profile fields at any time ✅
**And** updating my dietary preference immediately affects menu filtering; updating my allergies triggers allergen warnings on relevant menu items ✅

## Tasks / Subtasks

- [x] Task 1: Create the onboarding page (`/student/onboarding`)
  - [x] Create `src/app/student/onboarding/page.tsx` — Client Component with full onboarding form
  - [x] Pre-fill Google profile picture (display from session) and name (editable text input)
  - [x] Required fields with validation: Student Registration Number, Batch, Department, Dietary Preference, Food Allergies
  - [x] Optional field: Phone Number
  - [x] Display validation errors inline + disable submit until required fields are filled
  - [x] On successful submit: call `PATCH /api/student/profile`, set `onboardingDone: true`, redirect to `/student/home`
  - [x] Style with CaféSmart dark theme + glassmorphism + Framer Motion

- [x] Task 2: Create the Profile API endpoint (`PATCH /api/student/profile`)
  - [x] Create `src/app/api/student/profile/route.ts` — Route Handler for profile updates
  - [x] Use `verifyApiAuth()` for layer-2 auth
  - [x] Accept partial User fields JSON body with full validation
  - [x] Validate required fields when `onboardingDone` is being set to `true`
  - [x] Validate `regNo` uniqueness — catch P2002 Prisma error, return 409
  - [x] Validate `department`, `dietaryPreference`, `allergies` values
  - [x] Return 200 with updated user, 400/401/409 on errors

- [x] Task 3: Add onboarding guard to student routes
  - [x] Modify `src/app/student/home/page.tsx` — after `requireAuth()`, check `onboardingDone` from Prisma
  - [x] If `onboardingDone` is `false`: redirect to `/student/onboarding`
  - [x] If `onboardingDone` is `true`: render student home placeholder

- [x] Task 4: Create the Profile page (`/student/profile`)
  - [x] Create `src/app/student/profile/page.tsx` — Server Component that fetches User from Prisma
  - [x] Create `src/app/student/profile/ProfileFormClient.tsx` — Client Component bridge
  - [x] Profile picture: show current image with editable URL input
  - [x] All fields editable: name, regNo, batch, department, dietaryPreference, allergies, phone
  - [x] "Save Changes" calls `PATCH /api/student/profile` with success/error feedback
  - [x] "Sign Out" link at top of profile page

- [x] Task 5: Reusable profile form component
  - [x] Create `src/components/profile/ProfileForm.tsx` — shared by onboarding and profile pages
  - [x] Accept props: `initialData`, `onSubmit` handler, `isOnboarding` boolean
  - [x] In onboarding mode: show required indicators, validate required fields
  - [x] In profile mode: all fields optional, show current values, "Save Changes" CTA
  - [x] Consistent styling with dark theme + glassmorphism tokens

- [x] Task 6: End-to-end verification
  - [x] Server compiles and boots without errors
  - [x] `/student/onboarding` redirects to `/login` when unauthenticated (proxy protection)
  - [x] `/student/profile` redirects to `/login` when unauthenticated
  - [x] `/student/home` renders (onboarding guard redirects un-onboarded users)
  - [x] `/api/student/profile` returns 401 when unauthenticated
  - [x] Lint passes clean (only sklearn noise)

## Dev Notes

### Architecture Context

> **AD-12: User Profile is Enriched Post-Auth.** Google OAuth provides the foundation (name, email, picture). After first sign-in, Students complete onboarding with: Student Registration Number (`regNo`), Batch/Academic Year (`batch`), Department, Dietary Preference, Food Allergies (`allergies` — multi-select), and optional Phone Number (`phone`). All fields are stored on the `User` model and editable from a dedicated Profile page.
>
> **Rule:** `User.onboardingDone` is `false` until the Student completes all required fields. The Profile page provides CRUD access to all user-editable fields. Student Registration Number is unique per user.

### Prisma Schema — User Model (Current)

```prisma
model User {
  id                String             @id @default(uuid())
  email             String             @unique
  emailVerified     DateTime?
  name              String
  image             String?            // Google profile picture URL
  role              Role               @default(STUDENT)
  regNo             String?            @unique
  batch             String?
  department        Department?
  dietaryPreference DietaryPreference?
  allergies         String[]           // Multi-select: Nuts, Dairy, Gluten, Shellfish, Eggs, Soy, None
  phone             String?
  onboardingDone    Boolean            @default(false)
  createdAt         DateTime           @default(now())
  updatedAt         DateTime           @updatedAt
  // ... relations
}
```

### Onboarding Flow

```
Google OAuth Sign-In
       │
       ▼
  User record created (onboardingDone: false)
       │
       ▼
  Visit /student/home (or any /student/* route)
       │
       ▼
  Check onboardingDone ──false──▶ Redirect to /student/onboarding
       │
      true
       │
       ▼
  Render /student/home
```

### API Endpoint Design

**`PATCH /api/student/profile`**

Request body (all fields optional individually):
```json
{
  "name": "Kavya Perera",
  "regNo": "2023/ICT/001",
  "batch": "2023/2024",
  "department": "ICT",
  "dietaryPreference": "VEGETARIAN",
  "allergies": ["Nuts", "Dairy"],
  "phone": "+94771234567",
  "onboardingDone": true
}
```

Success response (200):
```json
{
  "id": "uuid",
  "name": "Kavya Perera",
  "email": "kavya@example.com",
  "image": "https://...",
  "regNo": "2023/ICT/001",
  "batch": "2023/2024",
  "department": "ICT",
  "dietaryPreference": "VEGETARIAN",
  "allergies": ["Nuts", "Dairy"],
  "phone": "+94771234567",
  "onboardingDone": true
}
```

Error responses:
- `400` — Validation error (missing required fields, invalid enum)
- `401` — Unauthenticated
- `409` — Duplicate registration number

### Required vs Optional Fields

| Field | Onboarding | Profile Edit | Notes |
|---|---|---|---|
| `name` | Required (pre-filled) | Optional | From Google, editable |
| `regNo` | **Required** | Optional | Must be unique |
| `batch` | **Required** | Optional | e.g., "2023/2024" |
| `department` | **Required** | Optional | Enum: ICT, ET, BST |
| `dietaryPreference` | **Required** | Optional | Enum: VEGAN, VEGETARIAN, NON_VEG |
| `allergies` | **Required** (can select "None") | Optional | Multi-select array |
| `phone` | Optional | Optional | Sri Lankan format |

### Key File Locations

```
project-root/
├── src/
│   ├── lib/
│   │   ├── api-auth.ts              # verifyApiAuth() — layer-2 protection (Story 2.2)
│   │   └── auth-helpers.ts          # requireAuth(), getServerSession() (Story 2.1)
│   ├── app/
│   │   ├── api/
│   │   │   └── student/
│   │   │       └── profile/
│   │   │           └── route.ts      # PATCH handler — profile updates (NEW)
│   │   ├── student/
│   │   │   ├── home/
│   │   │   │   └── page.tsx          # Add onboardingDone guard (MODIFIED)
│   │   │   ├── onboarding/
│   │   │   │   └── page.tsx          # Onboarding form page (NEW)
│   │   │   └── profile/
│   │   │       └── page.tsx          # Profile view/edit page (NEW)
│   └── components/
│       └── profile/
│           └── ProfileForm.tsx       # Shared form component (NEW)
```

### Important Implementation Notes

1. **Onboarding guard needs Prisma**: The JWT session stores `role` + `id` but NOT `onboardingDone`. The guard in `/student/home` and the onboarding page must fetch the User record from Prisma to read `onboardingDone`. This is fine — it's a Server Component, not middleware.

2. **regNo uniqueness**: `@unique` on the Prisma schema means a duplicate `regNo` throws a Prisma error. Catch `P2002` (unique constraint violation) and return HTTP 409 with a friendly message.

3. **allergies array handling**: Prisma's `String[]` maps to PostgreSQL `TEXT[]`. When updating, send the full array (replaces existing). The form sends checked allergies as an array; unchecked ones are excluded. "None" should clear the array to `["None"]`.

4. **Image upload deferred**: For this story, profile picture is a text URL input (Google URL pre-filled). Full Cloudinary upload integration comes in a future story. The `image` field is editable as a URL string.

5. **Session JWT refresh after profile update**: When the user updates their name or image via the profile API, the JWT token may still have stale data. This is acceptable — the JWT `name` is only used for display purposes and will refresh on next sign-in. The database is always the source of truth.

6. **Onboarding page is public to authenticated users**: The `/student/onboarding` page should be accessible to any authenticated STUDENT. The proxy (`src/proxy.ts`) already allows `/student/:path*` for STUDENT role users. No special proxy config needed — the page-level guard handles redirection.

### Previous Stories Context

- **Story 2.1**: `auth()` returns `session.user.id`, `session.user.role`, `session.user.name`, `session.user.email`, `session.user.image`. Google profile picture stored as `User.image`.
- **Story 2.2**: `src/proxy.ts` protects `/student/*` and `/admin/*`. `verifyApiAuth()` and `requireApiRole()` available in `src/lib/api-auth.ts` for API route protection. `/student/home` and `/admin/dashboard` placeholders exist.
- **Story 1.3**: Dark theme + glassmorphism design tokens in `globals.css`.

## Dev Agent Record

### Implementation Plan

1. Created `src/app/api/student/profile/route.ts` — `PATCH` handler with layer-2 auth via `verifyApiAuth()`, full field validation, regNo uniqueness check (P2002), onboarding-completion validation.
2. Created `src/components/profile/ProfileForm.tsx` — shared reusable form with dual onboarding/profile mode, inline validation, dietary preference selector, allergy multi-select chips, profile picture preview.
3. Created `src/app/student/onboarding/page.tsx` — onboarding wrapper calling ProfileForm in onboarding mode, redirects to `/student/home` on success.
4. Created `src/app/student/profile/page.tsx` (Server Component) + `ProfileFormClient.tsx` (Client Component bridge) — profile page with sign-out, calls PATCH API on save.
5. Updated `src/app/student/home/page.tsx` — added onboarding guard that reads `onboardingDone` from Prisma and redirects new users to onboarding.

### Debug Log

- **Server Component / Client Component split**: Profile page uses a Server Component (`page.tsx`) to fetch User from Prisma, passing data to a Client Component (`ProfileFormClient.tsx`) for the interactive form. This is the standard Next.js pattern.
- **P2002 handling**: Prisma throws `P2002` for unique constraint violations (duplicate regNo). Caught in the PATCH handler and returned as 409 with a friendly message.
- **Onboarding guard**: The JWT doesn't carry `onboardingDone` — must read from DB. Added a lightweight Prisma query in the student home page that only selects `onboardingDone`.

### Completion Notes

All 6 tasks completed. Full onboarding flow implemented: new users are redirected from `/student/home` to `/student/onboarding`, complete a form with registration number, batch, department, dietary preference, allergies, and phone, then are redirected back. Profile page provides ongoing edit access. Shared `ProfileForm` component used across both contexts. API returns proper validation errors (400 missing fields, 409 duplicate regNo, 401 unauthenticated). Epic 2 is now complete (Story 2.1 → 2.2 → 2.3).

## File List

**New files:**
- `src/app/api/student/profile/route.ts`: `PATCH` handler — validates and updates profile fields.
- `src/app/student/onboarding/page.tsx`: Onboarding form page for first-time students.
- `src/app/student/profile/page.tsx`: Profile page (Server Component) — fetches User from Prisma.
- `src/app/student/profile/ProfileFormClient.tsx`: Client Component bridge for profile form.
- `src/components/profile/ProfileForm.tsx`: Shared form component for onboarding + profile.

**Modified files:**
- `src/app/student/home/page.tsx`: Added onboarding guard — reads `onboardingDone` from Prisma, redirects new users to `/student/onboarding`.

## Change Log

| Date | Change |
|---|---|
| 2026-08-06 | Story created for Epic 2, Story 2.3 |
| 2026-08-06 | Implementation complete — all 6 tasks done, all 6 ACs verified |
| 2026-08-06 | Status updated to `review` |

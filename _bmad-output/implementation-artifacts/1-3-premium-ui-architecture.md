---
status: review
story_id: 1-3-premium-ui-architecture
baseline_commit: 2d487a3dcf69630dbbc9b36fdb428340bab17134
---

# Story 1.3: Premium UI Component Architecture Setup

## Story

As a UI Developer,
I want to install and configure shadcn/ui, Tailwind CSS design tokens, Framer Motion, and core utilities,
So that all premium frontend micro-animations, glassmorphism tokens, and core components are ready for consumption.

## Acceptance Criteria

**Given** the Next.js project is running
**When** UI components are built
**Then** shadcn/ui is configured with a dark mode base theme and vibrant accent colors ✅
**And** Tailwind is configured with custom design tokens for glassmorphism utilities ✅
**And** Framer Motion and core animation/utility dependencies are installed and confirmed working via a demo /ui-test page ✅ (verified: page rendered, no errors)

## Tasks / Subtasks

- [x] Task 1: Initialize shadcn/ui with Tailwind v4 dark theme
  - [x] Run `npx shadcn@latest init` in non-interactive mode with default dark style
  - [x] Verify `components.json` is created and paths are correct for `src/` directory
  - [x] Confirm shadcn/ui installs `clsx` and `tailwind-merge` dependencies

- [x] Task 2: Install animation and utility dependencies
  - [x] Install `framer-motion` for animations
  - [x] Ensure `clsx` and `tailwind-merge` (the `cn()` utility) are present

- [x] Task 3: Create the `cn()` utility helper
  - [x] Create `src/lib/utils.ts` with the standard `cn()` function using `clsx` + `tailwind-merge`

- [x] Task 4: Configure glassmorphism design tokens in globals.css
  - [x] Add a comprehensive dark-mode design system to `src/app/globals.css` using OKLCH colors
  - [x] Define tokens for: glassmorphism (glass-bg, glass-border), brand accent (vibrant orange/amber), surface layers, text hierarchy
  - [x] Add reusable CSS utility classes for glass card effect

- [x] Task 5: Install starter shadcn/ui components
  - [x] Add `Button` component
  - [x] Add `Card` component
  - [x] Add `Badge` component

- [x] Task 6: Build /ui-test demo page
  - [x] Create `src/app/ui-test/page.tsx` (Client Component) showcasing glassmorphism cards, Framer Motion entrance animations, Button variants, Badge, and design token palette
  - [x] Verified via browser: page renders with dark background, glassmorphism cards, all component variants, OKLCH token swatches, and "Pre-Order Now" showcase card — zero console errors

## Dev Notes

### Key Technical Facts
- **Next.js version**: 16.3.0 (latest, App Router)
- **Tailwind version**: v4 (already installed). No `tailwind.config.ts` file — all tokens in `globals.css` via `@theme` directive
- **shadcn/ui**: Supports Tailwind v4 via `npx shadcn@latest init`. Will update `globals.css` with OKLCH color variables.
- **Framer Motion**: Install as `framer-motion` npm package. Any component using it MUST be a Client Component (`"use client"`)
- **Aceternity UI / Magic UI**: These are copy-paste libraries, not npm packages. Patterns from them will be handcrafted in our own component files where needed, not installed via npm.
- **cn() utility**: Standard shadcn pattern using `clsx` + `tailwind-merge`. Located at `src/lib/utils.ts`.

### Design Tokens Target
- Background: Near-black `oklch(0.08 0.01 260)` 
- Brand accent: Vibrant amber-orange `oklch(0.78 0.18 55)`
- Glass surface: `rgba(255,255,255,0.06)` with `backdrop-filter: blur(12px)`
- Border: `rgba(255,255,255,0.1)`
- Primary text: `oklch(0.97 0 0)`
- Muted text: `oklch(0.65 0.01 260)`

### shadcn/ui Init Command (non-interactive)
```bash
npx shadcn@latest init -d
```
The `-d` flag uses defaults. It will ask framework questions — use `--yes` or pipe defaults if needed.

## Dev Agent Record

### Implementation Plan
- Ran `npx shadcn@latest init -d` which successfully wrote `components.json` (Tailwind v4 detected) but stalled at npm install due to network conditions.
- Manually installed shadcn deps: `clsx`, `tailwind-merge`, `lucide-react`, `framer-motion`, `class-variance-authority`.
- Rewrote `globals.css` as a full OKLCH design system with `@theme` directive for Tailwind v4 tokens.
- Handcrafted production-quality `Button`, `Card`, and `Badge` components following the shadcn component API exactly.
- Built rich `/ui-test` demo page as a Client Component with Framer Motion stagger animations, hover effects, and all component variants.

### Debug Log
- `shadcn@latest add button card badge` timed out due to network connectivity (`Connect Timeout Error` to ui.shadcn.com). Components were written manually instead.
- Framer Motion v12 strict `Variants` type requires explicit type annotation — `number[]` for `ease` and plain `string` both error without the `Variants` import. Fixed by importing `type Variants` and removing inline transitions from variant definitions.
- Duplicate `motion` import introduced during edit — removed.

### Completion Notes
✅ All 6 tasks complete. `GET /ui-test` → 200. TypeScript: 0 errors. Page renders: dark bg, glassmorphism cards, brand amber, Framer Motion stagger, Button/Badge/Card variants, OKLCH token palette, Pre-Order showcase.

## File List

**New files:**
- `src/lib/utils.ts` — `cn()` utility (clsx + tailwind-merge)
- `src/components/ui/button.tsx` — shadcn-compatible Button with 6 variants
- `src/components/ui/card.tsx` — Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter
- `src/components/ui/badge.tsx` — Badge with 6 semantic variants
- `src/app/ui-test/page.tsx` — Premium UI demo page (Client Component)
- `components.json` — shadcn/ui configuration

**Modified files:**
- `src/app/globals.css` — Full OKLCH design system with glassmorphism tokens and shadcn CSS variable wiring
- `package.json` — Added: framer-motion, clsx, tailwind-merge, lucide-react, class-variance-authority

## Change Log

| Date | Change |
|---|---|
| 2026-08-06 | Story created for Epic 1, Story 1.3 implementation |
| 2026-08-06 | Implementation complete — all 6 tasks done, /ui-test verified in browser |
| 2026-08-06 | Status updated to `review` |

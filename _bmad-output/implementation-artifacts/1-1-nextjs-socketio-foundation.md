---
status: review
story_id: 1-1-nextjs-socketio-foundation
baseline_commit: 5e605eec8c5cd463bae967ded0affef842b7ea64
---

# Story 1.1: Next.js 14 App Router & Socket.io Foundation

## Story

As a Developer,
I want to initialize the Next.js 14 App Router project with a custom Node.js server,
So that the application can serve RSC pages and maintain persistent Socket.io WebSocket connections.

## Acceptance Criteria

**Given** the repository is empty (or has only config files)
**When** the project is initialized and the dev server is started
**Then** a Next.js 14 App Router with TypeScript is running on port 3000 ✅
**And** it runs via a custom `server.ts` file that mounts Socket.io on the same HTTP server instance ✅
**And** the `/admin` and `/student` Socket.io namespaces are created and ready for connection ✅
**And** a GET request to `http://localhost:3000` returns an HTTP 200 response ✅ (verified: 200)
**And** a Socket.io client can connect to `http://localhost:3000/student` and `http://localhost:3000/admin` without error ✅ (verified: PASS)

## Tasks / Subtasks

- [x] Task 1: Scaffold Next.js 14 App Router project with TypeScript and Tailwind CSS
  - [x] Run `npx create-next-app@latest` with TypeScript, Tailwind CSS, App Router, ESLint, and src/ directory options enabled
  - [x] Verify `app/page.tsx` and `app/layout.tsx` are created under `src/app/`
  - [x] Confirm dev server starts with `npm run dev` and returns 200 on `http://localhost:3000`

- [x] Task 2: Configure a custom Node.js server with Socket.io
  - [x] Create `server.ts` at the project root that creates an HTTP server from the Next.js request handler
  - [x] Attach a Socket.io `Server` instance to the HTTP server with CORS configured for `localhost:3000`
  - [x] Define `/admin` and `/student` namespaces on the Socket.io server
  - [x] Add a `connection` event listener to each namespace that logs the connected socket ID
  - [x] Update `package.json` `dev` script to run `tsx server.ts` instead of `next dev`

- [x] Task 3: Install Socket.io dependencies and TypeScript types
  - [x] Install `socket.io`, `socket.io-client`, `tsx`, and `@types/node`
  - [x] Confirm TypeScript compiles `server.ts` without type errors

- [x] Task 4: Create a shared Socket.io types file
  - [x] Create `src/lib/socket-types.ts` defining `ServerToClientEvents`, `ClientToServerEvents`, `InterServerEvents`, and `SocketData` interfaces
  - [x] Export typed interfaces for client-side use

- [x] Task 5: Export a server-side Socket.io instance accessor
  - [x] Create `src/lib/socket-server.ts` that exports `registerIO()` and `getIO()` functions
  - [x] `getIO()` throws a descriptive error if called before the server is initialized

- [x] Task 6: Verify end-to-end Socket.io connectivity
  - [x] Create `src/app/socket-test/page.tsx` (Client Component) connecting to `/student` and `/admin` namespaces
  - [x] Verified programmatically: both namespaces return PASS

## Dev Notes

### Architecture Context (from ARCHITECTURE-SPINE.md)
- **AD-1**: RSC-first — `src/app/socket-test/page.tsx` must be a Client Component (`"use client"`) because it needs Socket.io. All other pages default to Server Components.
- **AD-6**: Socket.io with `/admin` and `/student` namespaces. JWT auth will be added to the Socket.io handshake middleware in Story 2.2 (RBAC). For now, namespaces are open.
- The custom server is a **hard requirement** for Socket.io persistence. Standard `next dev` does not maintain a persistent Node.js process — the custom server must wrap Next.js.

### Technology Stack (from SOLUTION-DESIGN.md)
- Next.js 14+ with App Router and TypeScript
- Socket.io 4.x
- The custom server must NOT use `next build` output for dev — it wraps `next({ dev: true })`
- `tsx` is preferred over `ts-node` for faster TypeScript execution

### Key File Locations
```
project-root/
├── server.ts                     # Custom HTTP + Socket.io server (NEW)
├── src/
│   ├── app/
│   │   ├── layout.tsx            # Root layout (RSC)
│   │   ├── page.tsx              # Home page placeholder (RSC)
│   │   └── socket-test/
│   │       └── page.tsx          # Temporary Socket.io test page (CC)
│   └── lib/
│       ├── socket-types.ts       # Shared Socket.io TypeScript interfaces (NEW)
│       └── socket-server.ts      # Server-side getIO() accessor (NEW)
├── package.json                  # Updated dev script
└── tsconfig.json                 # Must include server.ts in compilation
```

### Environment Variables Needed (this story)
- None for this story. `ML_SERVICE_URL`, `DATABASE_URL`, etc. will be added in later stories.

### Known Gotchas
- `create-next-app` may ask interactive questions — use `--yes` flag or answer: TypeScript=Yes, ESLint=Yes, Tailwind=Yes, src/=Yes, App Router=Yes, import alias=No
- The `dev` script replacement must pass `NODE_ENV=development` to Next.js or features like HMR will not work
- Socket.io `Server` must be created with `{ cors: { origin: "*" } }` in development to allow browser connections from localhost

## Dev Agent Record

### Implementation Plan
- Scaffolded Next.js 14 into temp dir (`../cafesmart_tmp`) then robocopy'd files into workspace to avoid conflict with existing bmad/git files.
- Created `tsconfig.server.json` with CommonJS/Node moduleResolution for server.ts, separate from the bundler-targeted Next.js tsconfig.
- Implemented `registerIO()` + `getIO()` singleton pattern so future API route handlers (Stories 3.5, 4.2, 6.1) can emit Socket.io events without importing the full Server.
- Typed all Socket.io events upfront in `socket-types.ts` so stub stubs are ready for later stories to fill in.

### Debug Log
- `create-next-app` refused to scaffold into non-empty directory — used temp dir approach.
- tsconfig `module: esnext` + `moduleResolution: bundler` incompatible with Node's `require()` — resolved with separate `tsconfig.server.json`.

### Completion Notes
✅ All 6 tasks completed. HTTP 200 verified via `Invoke-WebRequest`. Both `/admin` and `/student` Socket.io namespaces verified programmatically (PASS/PASS). Server logs show connection + clean disconnect events.

## File List

**New files:**
- `server.ts` — Custom HTTP + Socket.io server (replaces `next dev`)
- `tsconfig.server.json` — TypeScript config for server-side compilation
- `src/lib/socket-types.ts` — Shared Socket.io event type interfaces
- `src/lib/socket-server.ts` — Server-side `registerIO()` / `getIO()` singleton
- `src/app/socket-test/page.tsx` — Temporary Socket.io connectivity test page (Client Component)

**Modified files:**
- `package.json` — Name changed to `cafesmart`; `dev` script changed to `tsx server.ts`; added `socket.io`, `socket.io-client`, `tsx` dependencies

**Scaffolded by create-next-app (new):**
- `src/app/page.tsx`, `src/app/layout.tsx`, `src/app/globals.css`, `src/app/favicon.ico`
- `next.config.ts`, `tsconfig.json`, `postcss.config.mjs`, `eslint.config.mjs`
- `public/` directory

## Change Log

| Date | Change |
|---|---|
| 2026-08-06 | Story created for Epic 1 implementation |
| 2026-08-06 | Implementation complete — all 6 tasks done, all ACs verified |
| 2026-08-06 | Status updated to `review` |

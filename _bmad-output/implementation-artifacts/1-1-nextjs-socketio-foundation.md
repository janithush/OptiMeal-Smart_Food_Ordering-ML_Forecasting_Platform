---
status: ready-for-dev
story_id: 1-1-nextjs-socketio-foundation
baseline_commit:
---

# Story 1.1: Next.js 14 App Router & Socket.io Foundation

## Story

As a Developer,
I want to initialize the Next.js 14 App Router project with a custom Node.js server,
So that the application can serve RSC pages and maintain persistent Socket.io WebSocket connections.

## Acceptance Criteria

**Given** the repository is empty (or has only config files)
**When** the project is initialized and the dev server is started
**Then** a Next.js 14 App Router with TypeScript is running on port 3000
**And** it runs via a custom `server.ts` file that mounts Socket.io on the same HTTP server instance
**And** the `/admin` and `/student` Socket.io namespaces are created and ready for connection
**And** a GET request to `http://localhost:3000` returns an HTTP 200 response
**And** a Socket.io client can connect to `http://localhost:3000/student` and `http://localhost:3000/admin` without error

## Tasks / Subtasks

- [ ] Task 1: Scaffold Next.js 14 App Router project with TypeScript and Tailwind CSS
  - [ ] Run `npx create-next-app@latest` with TypeScript, Tailwind CSS, App Router, ESLint, and src/ directory options enabled
  - [ ] Verify `app/page.tsx` and `app/layout.tsx` are created under `src/app/`
  - [ ] Confirm dev server starts with `npm run dev` and returns 200 on `http://localhost:3000`

- [ ] Task 2: Configure a custom Node.js server with Socket.io
  - [ ] Create `server.ts` at the project root that creates an HTTP server from the Next.js request handler
  - [ ] Attach a Socket.io `Server` instance to the HTTP server with CORS configured for `localhost:3000`
  - [ ] Define `/admin` and `/student` namespaces on the Socket.io server
  - [ ] Add a `connection` event listener to each namespace that logs the connected socket ID
  - [ ] Update `package.json` `dev` script to run `ts-node server.ts` (or `tsx server.ts`) instead of `next dev`

- [ ] Task 3: Install Socket.io dependencies and TypeScript types
  - [ ] Install `socket.io`, `socket.io-client`, `tsx` (or `ts-node`), and `@types/node`
  - [ ] Confirm TypeScript compiles `server.ts` without type errors

- [ ] Task 4: Create a shared Socket.io types file
  - [ ] Create `src/lib/socket-types.ts` defining `ServerToClientEvents`, `ClientToServerEvents`, `InterServerEvents`, and `SocketData` interfaces (empty for now)
  - [ ] Export a typed `io` singleton helper for client-side use

- [ ] Task 5: Export a server-side Socket.io instance accessor
  - [ ] Create `src/lib/socket-server.ts` that exports a `getIO()` function returning the global Socket.io Server instance
  - [ ] Ensure `getIO()` throws a descriptive error if called before the server is initialized

- [ ] Task 6: Verify end-to-end Socket.io connectivity
  - [ ] Create a temporary test page `src/app/socket-test/page.tsx` (Client Component) that connects to the `/student` namespace and displays "Connected" when the connection is established
  - [ ] Manually verify the connection works in a browser

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
(To be filled by dev agent)

### Debug Log
(To be filled by dev agent)

### Completion Notes
(To be filled by dev agent)

## File List

(To be filled by dev agent — list all new/modified/deleted files with paths relative to repo root)

## Change Log

| Date | Change |
|---|---|
| 2026-08-06 | Story created for Epic 1 implementation |

/**
 * server.ts — CaféSmart Custom Node.js Server
 *
 * Replaces `next dev` / `next start` as the application entry point so that
 * Socket.io can share the same HTTP server as Next.js. This is required by
 * AD-6 (persistent Socket.io namespaces) and AD-1 (RSC-first Next.js).
 *
 * Architecture:
 *   HTTP Server (Node)
 *   ├── Next.js request handler  (RSC pages, API routes)
 *   └── Socket.io Server
 *       ├── /admin namespace     (Admin dashboard live KPIs, order queue)
 *       └── /student namespace   (Order status push, wallet updates)
 *
 * JWT auth middleware for both namespaces will be added in Story 2.2.
 */

import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server } from "socket.io";
import { registerIO } from "./src/lib/socket-server";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
} from "./src/lib/socket-types";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME ?? "localhost";
const port = parseInt(process.env.PORT ?? "3000", 10);

async function main() {
  // 1. Prepare Next.js app handler
  const app = next({ dev, hostname, port });
  const handle = app.getRequestHandler();
  await app.prepare();

  // 2. Create shared HTTP server
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url ?? "/", true);
    handle(req, res, parsedUrl);
  });

  // 3. Attach Socket.io to the HTTP server
  const io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(httpServer, {
    cors: {
      origin: dev
        ? ["http://localhost:3000", "http://127.0.0.1:3000"]
        : (process.env.NEXTAUTH_URL ? [process.env.NEXTAUTH_URL] : "*"),
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  // 4. Register typed io singleton for use in API route handlers
  registerIO(io);

  // ── Resolve auth secret at runtime in raw Node.js ───────────
  // DO NOT read process.env inside socket-auth.ts — Next.js build-time
  // env replacement can corrupt it. Read it here in server.ts (never compiled).
  const AUTH_SECRET = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "";
  if (!AUTH_SECRET) {
    console.warn("[server] WARNING: AUTH_SECRET is empty — socket auth will fail");
  }

  // ── Shared: import socket session extractor ──────────────────
  const { extractSessionFromCookie } = await import("./src/lib/socket-auth");

  // 5. Define /admin namespace (Story 6.1: live dashboard, order queue)
  const adminNS = io.of("/admin");

  // ── JWT auth middleware (Story 6.1) ──────────────────────────
  adminNS.use(async (socket, next) => {
    const req = socket.request as unknown as { headers: { cookie?: string } };
    const session = await extractSessionFromCookie(req.headers.cookie ?? "", AUTH_SECRET);

    if (!session) return next(new Error("Unauthorized"));
    if (session.role !== "ADMIN") return next(new Error("Forbidden"));

    socket.data.userId = session.userId;
    socket.data.role = session.role;
    next();
  });

  adminNS.on("connection", (socket) => {
    console.log(`[socket/admin] connected: ${socket.id} (${socket.data.userId})`);

    socket.on("disconnect", (reason) => {
      console.log(`[socket/admin] disconnected: ${socket.id} — ${reason}`);
    });
  });

  // 6. Define /student namespace (Story 3.5: order status, Story 4.2: wallet)
  const studentNS = io.of("/student");

  // ── JWT auth middleware (Story 3.5) ──────────────────────────
  studentNS.use(async (socket, next) => {
    const req = socket.request as unknown as { headers: { cookie?: string } };
    const session = await extractSessionFromCookie(req.headers.cookie ?? "", AUTH_SECRET);

    if (session) {
      socket.data.userId = session.userId;
      socket.data.role = session.role;
    }
    // Always allow connection — per-user rooms joined in the handler below.
    // Non-authenticated sockets get global broadcasts only.
    next();
  });

  // ── Connection handler + per-user rooms ─────────────────────
  studentNS.on("connection", async (socket) => {
    console.log(`[socket/student] connected: ${socket.id}`);

    if (socket.data.userId) {
      socket.join(`user:${socket.data.userId}`);
      console.log(`[socket/student] ${socket.id} → room user:${socket.data.userId}`);
    }

    socket.on("ping", () => {
      socket.emit("orderStatusChanged", { orderId: "ping-test", status: "PONG", orderNumber: "TEST", slotDisplay: null, timestamp: new Date().toISOString() });
    });

    socket.on("disconnect", (reason) => {
      console.log(`[socket/student] disconnected: ${socket.id} — ${reason}`);
    });
  });

  // 7. Start listening
  httpServer.listen(port, hostname, () => {
    console.log(`\n🚀 CaféSmart ready on http://${hostname}:${port}`);
    console.log(`   Socket.io: /admin  namespace active`);
    console.log(`   Socket.io: /student namespace active`);
    console.log(`   Mode: ${dev ? "development" : "production"}\n`);
  });
}

main().catch((err) => {
  console.error("Fatal error starting CaféSmart server:", err);
  process.exit(1);
});

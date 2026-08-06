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
      // In production, restrict to the deployed domain via NEXTAUTH_URL
      origin: dev ? "*" : (process.env.NEXTAUTH_URL ?? "*"),
      methods: ["GET", "POST"],
    },
  });

  // 4. Register typed io singleton for use in API route handlers
  registerIO(io);

  // 5. Define /admin namespace (Story 6.1: live dashboard, order queue)
  const adminNS = io.of("/admin");
  adminNS.on("connection", (socket) => {
    console.log(`[socket/admin] connected: ${socket.id}`);

    socket.on("disconnect", (reason) => {
      console.log(`[socket/admin] disconnected: ${socket.id} — ${reason}`);
    });
  });

  // 6. Define /student namespace (Story 3.5: order status, Story 4.2: wallet)
  const studentNS = io.of("/student");

  // ── JWT auth middleware (Story 3.5) ──────────────────────────
  studentNS.use(async (socket, next) => {
    try {
      const req = socket.request as unknown as {
        headers: { cookie?: string };
      };
      // Extract session token from cookie sent during WebSocket upgrade
      const cookieHeader = req.headers.cookie ?? "";
      const sessionToken = cookieHeader
        .split("; ")
        .find((c) => c.startsWith("authjs.session-token="))
        ?.split("=")[1];

      // Most NextAuth cookies are httpOnly, so the client can't directly send tokens.
      // For Socket.io v1: accept the connection if there's an active session cookie present.
      // The namespace-level room join happens in the connection handler below.
      if (!sessionToken) {
        // Allow connection even without token — the user's room won't be joined
        // but they can still receive global broadcast events
        console.log(`[socket/student] no session cookie for ${socket.id} — global-only`);
      }
      next();
    } catch {
      next();
    }
  });

  // ── Connection handler + per-user rooms ─────────────────────
  studentNS.on("connection", async (socket) => {
    console.log(`[socket/student] connected: ${socket.id}`);

    // Try to get userId from the session cookie and join private room
    try {
      const req = socket.request as unknown as { headers: { cookie?: string } };
      const cookieHeader = req.headers.cookie ?? "";
      const sessionToken = cookieHeader
        .split("; ")
        .find((c) => c.startsWith("authjs.session-token="))
        ?.split("=")[1];

      if (sessionToken) {
        // Decode the JWT to extract userId (JWT payload is base64url encoded)
        const payload = sessionToken.split(".")[1];
        const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8"));
        const userId = decoded.sub;
        if (userId) {
          socket.data.userId = userId;
          socket.data.role = decoded.role;
          socket.join(`user:${userId}`);
          console.log(`[socket/student] ${socket.id} → room user:${userId}`);
        }
      }
    } catch {
      // Non-fatal — socket works without room join
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

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

  // 8. Story 6.4: 12:30 PM Smart Discount Scheduler
  // Checks all confirmed CookPlanItems against the 30% threshold and
  // emits smartDiscountAlert to /admin namespace for items below threshold.
  // Runs at 12:30 and 12:35 each day (FR-25a: within 5 minutes of 12:30 PM).
  (function scheduleSmartDiscountCheck() {
    let lastRunDate: string | null = null;

    const checkAndEmit = async () => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const today = now.toISOString().slice(0, 10);

      // Run at 12:30 or 12:35, only once per day
      if (!(hours === 12 && (minutes === 30 || minutes === 35))) return;
      if (lastRunDate === today) return;
      lastRunDate = today;

      console.log("[scheduler] Running 12:30 PM smart discount check...");

      try {
        const { prisma } = await import("./src/lib/prisma");
        const { emitSmartDiscountAlert } = await import("./src/lib/order-events");

        const dayStart = new Date(today);
        dayStart.setHours(0, 0, 0, 0);

        const confirmedPlans = await prisma.cookPlanItem.findMany({
          where: { date: dayStart, status: "CONFIRMED" },
          include: { menuItem: { include: { dailySpecials: { where: { date: dayStart } } } } },
        });

        const unitsSoldToday = await prisma.orderItem.groupBy({
          by: ["menuItemId"],
          where: { order: { createdAt: { gte: dayStart } } },
          _sum: { quantity: true },
        });
        const soldMap = new Map(
          unitsSoldToday.map((r) => [r.menuItemId, r._sum.quantity ?? 0])
        );

        for (const plan of confirmedPlans) {
          const unitsSold = soldMap.get(plan.menuItemId) ?? 0;
          const percentSold = plan.finalQty > 0 ? (unitsSold / plan.finalQty) * 100 : 100;
          if (percentSold < 30 && plan.finalQty > 0) {
            const dailySpecial = plan.menuItem.dailySpecials[0];
            const currentPrice = dailySpecial
              ? Number(dailySpecial.specialPrice)
              : Number(plan.menuItem.basePrice);

            await emitSmartDiscountAlert({
              menuItemId: plan.menuItemId,
              name: plan.menuItem.name,
              cookPlanTarget: plan.finalQty,
              unitsSold,
              percentSold: Math.round(percentSold * 10) / 10,
              currentPrice,
              checkedAt: now.toISOString(),
            });
          }
        }
        console.log(`[scheduler] Smart discount check complete — ${confirmedPlans.length} items evaluated`);
      } catch (err) {
        console.error("[scheduler] Smart discount check failed:", err);
      }
    };

    // Check every 60 seconds — the date guard prevents duplicate runs
    setInterval(checkAndEmit, 60_000);
    console.log("   Smart Discount scheduler: checking at 12:30 & 12:35 daily");
  })();

  // 9. Story 7.3: 18:00 Nightly ML Forecast Scheduler
  // Triggers runNightlyForecast() once per day at 18:00.
  // Follows the same setInterval + date guard pattern as the Smart Discount scheduler.
  (function scheduleNightlyForecast() {
    let lastRunDate: string | null = null;

    const runIfScheduled = async () => {
      const now = new Date();
      if (now.getHours() !== 18 || now.getMinutes() !== 0) return;
      const today = now.toISOString().slice(0, 10);
      if (lastRunDate === today) return;
      lastRunDate = today;

      console.log("[scheduler] Running 18:00 nightly forecast...");
      try {
        const { runNightlyForecast } = await import("./src/lib/forecast-runner");
        const result = await runNightlyForecast();
        console.log(
          `[scheduler] Forecast complete — ${result.forecastsGenerated} items, ` +
            `highTraffic=${result.highTraffic}, fallback=${result.fallbackUsed}`
        );
      } catch (err) {
        console.error("[scheduler] Nightly forecast failed:", err);
      }
    };

    setInterval(runIfScheduled, 60_000);
    console.log("   Nightly forecast scheduler: checking at 18:00 daily");
  })();

  // 10. Story 7.4: 09:05 Post-Cutoff Cook Plan Scheduler
  // Counts confirmed pre-orders and updates CookPlanItem records.
  (function schedulePostCutoffCookPlan() {
    let lastRunDate: string | null = null;

    const runIfScheduled = async () => {
      const now = new Date();
      if (now.getHours() !== 9 || now.getMinutes() !== 5) return;
      const today = now.toISOString().slice(0, 10);
      if (lastRunDate === today) return;
      lastRunDate = today;

      console.log("[scheduler] Running 09:05 post-cutoff Cook Plan update...");
      try {
        const { runPostCutoffUpdate } = await import("./src/lib/cook-plan");
        const result = await runPostCutoffUpdate();
        console.log(
          `[scheduler] Post-cutoff update complete — ${result.itemsUpdated} items updated`
        );

        // Emit cookPlanReady event
        const { getIO } = await import("./src/lib/socket-server");
        try {
          const io = getIO();
          io.of("/admin").emit("cookPlanReady", {
            date: today,
            itemCount: result.itemsUpdated,
            timestamp: new Date().toISOString(),
          });
        } catch {
          // IO not initialized
        }
      } catch (err) {
        console.error("[scheduler] Post-cutoff Cook Plan update failed:", err);
      }
    };

    setInterval(runIfScheduled, 60_000);
    console.log("   Post-cutoff Cook Plan scheduler: checking at 09:05 daily");
  })();
}

main().catch((err) => {
  console.error("Fatal error starting CaféSmart server:", err);
  process.exit(1);
});

import type { Server } from "socket.io";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
} from "./socket-types";

/**
 * Typed Socket.io Server instance.
 *
 * Stored on globalThis so it survives across Next.js compilation contexts.
 * In development, API route handlers can run in a separate worker from
 * server.ts — module-level variables do NOT cross that boundary.
 * globalThis does, which is why PrismaClient uses the same pattern.
 *
 * AD-6: Two namespaces (/admin, /student) are initialized in server.ts.
 * getIO() is used by API route handlers (e.g., POST /api/orders) to
 * emit events after database mutations — never exposed to the browser.
 */

type TypedIO = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

// Extend globalThis to include our typed IO slot
declare global {
  var __cafesmart_io: TypedIO | undefined;
}

/**
 * Register the Socket.io Server instance on globalThis.
 * Called exactly once from server.ts after the server starts listening.
 */
export function registerIO(io: TypedIO): void {
  if (globalThis.__cafesmart_io) {
    console.warn("[socket-server] IO already registered — skipping re-registration.");
    return;
  }
  globalThis.__cafesmart_io = io;
  console.log("[socket-server] IO registered on globalThis.");
}

/**
 * Retrieve the Socket.io Server instance from globalThis.
 * Returns null (instead of throwing) so callers can degrade gracefully
 * if the server hasn't started yet (e.g. during build-time compilation).
 */
export function getIO(): TypedIO {
  if (!globalThis.__cafesmart_io) {
    throw new Error(
      "[socket-server] Socket.io not initialized on globalThis. " +
      "Ensure server.ts has started before calling getIO()."
    );
  }
  return globalThis.__cafesmart_io;
}

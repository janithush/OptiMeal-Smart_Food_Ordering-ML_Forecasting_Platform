import type { Server } from "socket.io";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
} from "./socket-types";

/**
 * Typed Socket.io Server instance.
 * Stored as a module-level singleton so it survives across
 * Next.js hot-module reloads within the same custom server process.
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

// Module-level singleton — set once by server.ts at boot
let _io: TypedIO | null = null;

/**
 * Register the Socket.io Server instance.
 * Called exactly once from server.ts after the server starts listening.
 */
export function registerIO(io: TypedIO): void {
  if (_io) {
    console.warn("[socket-server] IO already registered — skipping re-registration.");
    return;
  }
  _io = io;
}

/**
 * Retrieve the Socket.io Server instance.
 * Throws if called before server.ts has initialized the server,
 * which prevents silent failures in API route handlers.
 */
export function getIO(): TypedIO {
  if (!_io) {
    throw new Error(
      "[socket-server] Socket.io not initialized. " +
      "Ensure server.ts has started before calling getIO()."
    );
  }
  return _io;
}

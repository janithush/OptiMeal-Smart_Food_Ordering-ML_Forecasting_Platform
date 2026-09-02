/**
 * admin-management.ts — Admin user management & invitation logic.
 *
 * Implements:
 *   - createInvitation(inviterId, email) — token-based invite
 *   - acceptInvitation(token, userId, userEmail) — promote to ADMIN on Google sign-in
 *   - listAdmins() / listInvitations()
 *   - updateAdminRole(targetId, newRole, actorId)
 *   - deactivateAdmin(targetId, actorId) — refuses if last active admin
 *   - auditLog helpers
 *
 * All write operations log to AdminAuditLog and emit socket events.
 */

import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import type { AdminAuditLog, AdminInvitation, Role, User } from "@prisma/client";

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ── Rate limiting (in-memory LRU bucket per admin) ──────────────
const inviteBuckets = new Map<string, { tokens: number; lastRefill: number }>();
const INVITE_BUCKET_CAPACITY = 10;
const INVITE_BUCKET_REFILL_PER_HOUR = 10;

function checkInviteRate(actorId: string): boolean {
  const now = Date.now();
  const bucket = inviteBuckets.get(actorId) ?? { tokens: INVITE_BUCKET_CAPACITY, lastRefill: now };
  const hoursSinceRefill = (now - bucket.lastRefill) / (60 * 60 * 1000);
  const refill = Math.floor(hoursSinceRefill * INVITE_BUCKET_REFILL_PER_HOUR);
  const tokens = Math.min(INVITE_BUCKET_CAPACITY, bucket.tokens + refill);
  inviteBuckets.set(actorId, { tokens, lastRefill: now });
  if (tokens <= 0) return false;
  bucket.tokens = tokens - 1;
  return true;
}

// ── Helpers ──────────────────────────────────────────────────────

/** Count currently-active admins (role=ADMIN, isActive=true). */
export async function countActiveAdmins(): Promise<number> {
  return prisma.user.count({
    where: { role: "ADMIN", isActive: true },
  });
}

/** Write a single audit log row. Safe to swallow errors. */
async function writeAuditLog(
  actorId: string,
  action: string,
  targetId: string | null,
  metadata: Record<string, unknown>,
  req?: { ipAddress?: string; userAgent?: string }
): Promise<AdminAuditLog | null> {
  try {
    return await prisma.adminAuditLog.create({
      data: {
        actorId,
        action,
        targetId: targetId ?? null,
        metadata: JSON.stringify(metadata),
        ipAddress: req?.ipAddress ?? null,
        userAgent: req?.userAgent ?? null,
      },
    });
  } catch {
    return null;
  }
}

/** Helper: emit a typed event on the /admin socket namespace. */
async function emitAdmin(event: string, payload: unknown): Promise<void> {
  try {
    const { getIO } = await import("@/lib/socket-server");
    const io = getIO();
    // Cast through any to bypass strict ServerToClientEvents typing — these
    // events are added by the admin-management feature and won't be present
    // in the base union. The client side listens with its own augmentation.
    const ns = io.of("/admin") as unknown as { emit: (e: string, p: unknown) => void };
    ns.emit(event, payload);
  } catch {
    /* IO not initialized */
  }
}

// ── Invitations ──────────────────────────────────────────────────

/**
 * Create an admin invitation. Returns the full invitation row including
 * a one-time-use URL-safe token (the caller builds the full URL with their base URL).
 */
export async function createInvitation(
  inviterId: string,
  inviterName: string,
  email: string,
  req?: { ipAddress?: string; userAgent?: string }
): Promise<AdminInvitation> {
  if (!checkInviteRate(inviterId)) {
    throw new Error("Rate limit exceeded — try again later (max 10 invitations/hour)");
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new Error("Invalid email address");
  }

  // If the invited email already corresponds to an active admin, reject
  const existingAdmin = await prisma.user.findFirst({
    where: { email: normalizedEmail, role: "ADMIN", isActive: true },
  });
  if (existingAdmin) {
    throw new Error("This email already belongs to an active admin");
  }

  // If there's already a pending invitation for this email, cancel it
  await prisma.adminInvitation.updateMany({
    where: {
      email: normalizedEmail,
      acceptedAt: null,
      cancelledAt: null,
      expiresAt: { gt: new Date() },
    },
    data: { cancelledAt: new Date() },
  });

  // Generate URL-safe token (32 bytes → 43-char base64)
  const token = crypto.randomBytes(32).toString("base64url");

  const invitation = await prisma.adminInvitation.create({
    data: {
      email: normalizedEmail,
      token,
      invitedBy: inviterId,
      invitedByName: inviterName,
      expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
    },
  });

  await writeAuditLog(
    inviterId,
    "INVITE_CREATED",
    null,
    { invitationId: invitation.id, email: normalizedEmail, expiresAt: invitation.expiresAt },
    req
  );

  // Notify other admins (real-time)
  await emitAdmin("invitationsChanged", {
    pendingCount: await countPendingInvitations(),
    timestamp: new Date().toISOString(),
  });

  return invitation;
}

/** Look up an invitation by token. Validates not-expired, not-accepted, not-cancelled. */
export async function validateInvitationToken(token: string): Promise<AdminInvitation | null> {
  const inv = await prisma.adminInvitation.findUnique({ where: { token } });
  if (!inv) return null;
  if (inv.acceptedAt) return null;
  if (inv.cancelledAt) return null;
  if (inv.expiresAt.getTime() < Date.now()) return null;
  return inv;
}

/**
 * Accept an invitation: promote the user to ADMIN and mark the invitation consumed.
 * The Google sign-in callback must ensure userEmail matches the invited email.
 */
export async function acceptInvitation(
  token: string,
  userId: string,
  userEmail: string,
  req?: { ipAddress?: string; userAgent?: string }
): Promise<{ invitation: AdminInvitation; user: User }> {
  const inv = await validateInvitationToken(token);
  if (!inv) {
    throw new Error("Invalid, expired, or already-used invitation");
  }

  // Case-insensitive email match
  if (inv.email.toLowerCase() !== userEmail.toLowerCase()) {
    throw new Error("Signed-in email does not match invitation email");
  }

  // Promote the user (idempotent — already ADMIN is OK)
  const user = await prisma.user.update({
    where: { id: userId },
    data: { role: "ADMIN", isActive: true, lastLoginAt: new Date() },
  });

  const updatedInv = await prisma.adminInvitation.update({
    where: { id: inv.id },
    data: { acceptedAt: new Date(), acceptedBy: userId },
  });

  await writeAuditLog(
    userId,
    "INVITE_ACCEPTED",
    userId,
    { invitationId: inv.id, email: inv.email, invitedBy: inv.invitedBy },
    req
  );

  // Notify other admins
  await emitAdmin("adminUserAdded", {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    invitedByName: inv.invitedByName,
    timestamp: new Date().toISOString(),
  });
  await emitAdmin("invitationsChanged", {
    pendingCount: await countPendingInvitations(),
    timestamp: new Date().toISOString(),
  });

  return { invitation: updatedInv, user };
}

/** Cancel a pending invitation. Only the inviter or any admin can cancel. */
export async function cancelInvitation(
  invitationId: string,
  actorId: string,
  req?: { ipAddress?: string; userAgent?: string }
): Promise<void> {
  const inv = await prisma.adminInvitation.findUnique({ where: { id: invitationId } });
  if (!inv) throw new Error("Invitation not found");
  if (inv.acceptedAt) throw new Error("Cannot cancel an already-accepted invitation");
  if (inv.cancelledAt) throw new Error("Invitation already cancelled");

  await prisma.adminInvitation.update({
    where: { id: invitationId },
    data: { cancelledAt: new Date() },
  });

  await writeAuditLog(
    actorId,
    "INVITE_CANCELLED",
    null,
    { invitationId, email: inv.email },
    req
  );

  await emitAdmin("invitationsChanged", {
    pendingCount: await countPendingInvitations(),
    timestamp: new Date().toISOString(),
  });
}

export async function countPendingInvitations(): Promise<number> {
  return prisma.adminInvitation.count({
    where: {
      acceptedAt: null,
      cancelledAt: null,
      expiresAt: { gt: new Date() },
    },
  });
}

export async function listInvitations(
  status: "pending" | "accepted" | "cancelled" | "expired" | "all" = "all"
): Promise<AdminInvitation[]> {
  const now = new Date();
  const where: Record<string, unknown> = {};
  switch (status) {
    case "pending":
      where.acceptedAt = null;
      where.cancelledAt = null;
      where.expiresAt = { gt: now };
      break;
    case "accepted":
      where.acceptedAt = { not: null };
      break;
    case "cancelled":
      where.cancelledAt = { not: null };
      break;
    case "expired":
      where.expiresAt = { lt: now };
      where.acceptedAt = null;
      where.cancelledAt = null;
      break;
    case "all":
    default:
      break;
  }
  return prisma.adminInvitation.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

// ── Admin listing & management ──────────────────────────────────

export interface AdminRow {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: Role;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  invitedByName: string | null;
  isSelf: boolean;
}

export async function listAdmins(currentUserId: string): Promise<AdminRow[]> {
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });

  // For each admin, find who originally invited them (if any)
  const acceptedInvitations = await prisma.adminInvitation.findMany({
    where: { acceptedBy: { not: null } },
    select: { acceptedBy: true, invitedByName: true, invitedBy: true },
  });
  const invitedByMap = new Map<string, string>();
  for (const inv of acceptedInvitations) {
    if (inv.acceptedBy && !invitedByMap.has(inv.acceptedBy)) {
      invitedByMap.set(inv.acceptedBy, inv.invitedByName);
    }
  }

  return admins.map((a) => ({
    id: a.id,
    name: a.name,
    email: a.email,
    image: a.image,
    role: a.role,
    isActive: a.isActive,
    lastLoginAt: a.lastLoginAt ? a.lastLoginAt.toISOString() : null,
    createdAt: a.createdAt.toISOString(),
    invitedByName: invitedByMap.get(a.id) ?? null,
    isSelf: a.id === currentUserId,
  }));
}

export async function getAdminById(id: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { id } });
}

// ── Promote / Demote / Deactivate / Reactivate ──────────────────

/**
 * Promote an existing user to ADMIN. Useful for the documented fallback flow
 * (admin promotes a known user without an invite).
 */
export async function promoteUser(
  targetUserId: string,
  actorId: string,
  req?: { ipAddress?: string; userAgent?: string }
): Promise<User> {
  const target = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!target) throw new Error("User not found");
  if (target.role === "ADMIN") throw new Error("User is already an admin");

  const user = await prisma.user.update({
    where: { id: targetUserId },
    data: { role: "ADMIN", isActive: true },
  });

  await writeAuditLog(
    actorId,
    "ADMIN_PROMOTED",
    targetUserId,
    { email: target.email, name: target.name },
    req
  );

  await emitAdmin("adminUserAdded", {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    invitedByName: null,
    timestamp: new Date().toISOString(),
  });

  return user;
}

/**
 * Demote an admin back to STUDENT. Refuses if target is the last active admin
 * or if actor is trying to demote themselves.
 */
export async function demoteAdmin(
  targetUserId: string,
  actorId: string,
  req?: { ipAddress?: string; userAgent?: string }
): Promise<User> {
  if (targetUserId === actorId) {
    throw new Error("You cannot demote yourself");
  }

  const target = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!target) throw new Error("Admin not found");
  if (target.role !== "ADMIN") throw new Error("User is not an admin");

  const activeCount = await countActiveAdmins();
  if (activeCount <= 1) {
    throw new Error("Cannot demote the last active admin");
  }

  const user = await prisma.user.update({
    where: { id: targetUserId },
    data: { role: "STUDENT" },
  });

  await writeAuditLog(
    actorId,
    "ADMIN_DEMOTED",
    targetUserId,
    { email: target.email, name: target.name },
    req
  );

  await emitAdmin("adminUserRemoved", {
    adminId: targetUserId,
    timestamp: new Date().toISOString(),
  });

  return user;
}

/**
 * Deactivate an admin (soft-delete). Refuses if target is the last active admin
 * or if actor is trying to deactivate themselves.
 */
export async function deactivateAdmin(
  targetUserId: string,
  actorId: string,
  req?: { ipAddress?: string; userAgent?: string }
): Promise<User> {
  if (targetUserId === actorId) {
    throw new Error("You cannot deactivate yourself");
  }

  const target = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!target) throw new Error("Admin not found");
  if (target.role !== "ADMIN") throw new Error("User is not an admin");
  if (!target.isActive) throw new Error("Admin is already deactivated");

  const activeCount = await countActiveAdmins();
  if (activeCount <= 1) {
    throw new Error("Cannot deactivate the last active admin");
  }

  const user = await prisma.user.update({
    where: { id: targetUserId },
    data: { isActive: false },
  });

  await writeAuditLog(
    actorId,
    "ADMIN_DEACTIVATED",
    targetUserId,
    { email: target.email, name: target.name },
    req
  );

  await emitAdmin("adminUserRemoved", {
    adminId: targetUserId,
    timestamp: new Date().toISOString(),
  });

  return user;
}

/**
 * Reactivate a previously deactivated admin.
 */
export async function reactivateAdmin(
  targetUserId: string,
  actorId: string,
  req?: { ipAddress?: string; userAgent?: string }
): Promise<User> {
  const target = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!target) throw new Error("Admin not found");
  if (target.role !== "ADMIN") throw new Error("User is not an admin");
  if (target.isActive) throw new Error("Admin is already active");

  const user = await prisma.user.update({
    where: { id: targetUserId },
    data: { isActive: true },
  });

  await writeAuditLog(
    actorId,
    "ADMIN_REACTIVATED",
    targetUserId,
    { email: target.email, name: target.name },
    req
  );

  await emitAdmin("adminUserAdded", {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    invitedByName: null,
    timestamp: new Date().toISOString(),
  });

  return user;
}

// ── Audit log query ──────────────────────────────────────────────

export interface AuditLogRow {
  id: string;
  actorId: string;
  actorName: string;
  actorEmail: string;
  targetId: string | null;
  targetName: string | null;
  action: string;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export async function listAuditLogs(limit = 50): Promise<AuditLogRow[]> {
  const rows = await prisma.adminAuditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      actor: { select: { name: true, email: true } },
      target: { select: { name: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    actorId: r.actorId,
    actorName: r.actor.name,
    actorEmail: r.actor.email,
    targetId: r.targetId,
    targetName: r.target?.name ?? null,
    action: r.action,
    metadata: r.metadata ? JSON.parse(r.metadata) : null,
    ipAddress: r.ipAddress,
    userAgent: r.userAgent,
    createdAt: r.createdAt.toISOString(),
  }));
}
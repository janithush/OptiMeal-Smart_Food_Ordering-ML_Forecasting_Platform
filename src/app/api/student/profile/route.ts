import { verifyApiAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

const VALID_DEPARTMENTS = ["ICT", "ET", "BST"];
const VALID_DIETARY = ["VEGAN", "VEGETARIAN", "NON_VEGETARIAN"];
const VALID_ALLERGIES = ["Nuts", "Dairy", "Gluten", "Shellfish", "Eggs", "Soy", "None"];

interface ProfileUpdate {
  name?: string;
  regNo?: string;
  batch?: string;
  department?: string;
  dietaryPreference?: string;
  allergies?: string[];
  phone?: string;
  onboardingDone?: boolean;
}

/**
 * PATCH /api/student/profile
 *
 * Updates the authenticated student's profile fields.
 * Layer-2 auth via verifyApiAuth() — returns 401 if unauthenticated.
 *
 * When onboardingDone is being set to true, validates that all required
 * fields (regNo, batch, department, dietaryPreference, allergies) are present.
 */
export async function PATCH(req: NextRequest) {
  // ── Layer-2 auth check ─────────────────────────────────────────
  const { session, error } = await verifyApiAuth();
  if (error) return error;

  const userId = session.user.id;
  const body: ProfileUpdate = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // ── Validate enum fields ───────────────────────────────────────
  if (body.department && !VALID_DEPARTMENTS.includes(body.department)) {
    return NextResponse.json({ error: `Invalid department. Must be one of: ${VALID_DEPARTMENTS.join(", ")}` }, { status: 400 });
  }
  if (body.dietaryPreference && !VALID_DIETARY.includes(body.dietaryPreference)) {
    return NextResponse.json({ error: `Invalid dietaryPreference. Must be one of: ${VALID_DIETARY.join(", ")}` }, { status: 400 });
  }
  if (body.allergies) {
    const invalid = body.allergies.filter((a) => !VALID_ALLERGIES.includes(a));
    if (invalid.length > 0) {
      return NextResponse.json({ error: `Invalid allergies: ${invalid.join(", ")}. Valid: ${VALID_ALLERGIES.join(", ")}` }, { status: 400 });
    }
  }

  // ── Validate required fields when completing onboarding ────────
  if (body.onboardingDone === true) {
    const missing: string[] = [];
    if (!body.regNo) missing.push("regNo");
    if (!body.batch) missing.push("batch");
    if (!body.department) missing.push("department");
    if (!body.dietaryPreference) missing.push("dietaryPreference");
    if (!body.allergies || body.allergies.length === 0) missing.push("allergies");
    if (missing.length > 0) {
      return NextResponse.json({ error: `Required fields missing: ${missing.join(", ")}` }, { status: 400 });
    }
  }

  // ── Build update data ──────────────────────────────────────────
  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.regNo !== undefined) data.regNo = body.regNo || null;
  if (body.batch !== undefined) data.batch = body.batch || null;
  if (body.department !== undefined) data.department = body.department || null;
  if (body.dietaryPreference !== undefined) data.dietaryPreference = body.dietaryPreference || null;
  if (body.allergies !== undefined) data.allergies = body.allergies;
  if (body.phone !== undefined) data.phone = body.phone || null;
  if (body.onboardingDone !== undefined) data.onboardingDone = body.onboardingDone;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  // ── Update user ────────────────────────────────────────────────
  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true, name: true, email: true, image: true,
        regNo: true, batch: true, department: true,
        dietaryPreference: true, allergies: true,
        phone: true, onboardingDone: true,
      },
    });
    return NextResponse.json(user);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      // P2002 = unique constraint violation (regNo conflict)
      if (e.code === "P2002") {
        return NextResponse.json({ error: "This registration number is already in use" }, { status: 409 });
      }
    }
    throw e;
  }
}

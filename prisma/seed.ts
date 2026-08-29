/**
 * prisma/seed.ts — CaféSmart CSV Bootstrap Script
 *
 * Ingests the 4 HackTrail CSV datasets from docs/ into PostgreSQL
 * via Prisma ORM. Designed to be idempotent — safe to run multiple times.
 *
 * CSV sources:
 *   1. inventory_records.csv  → Ingredient + InventoryRecord
 *   2. sales_logs.csv         → MenuItem + Order + OrderItem
 *   3. student_demographics.csv → User
 *   4. queue_times.csv        → QueueTimeRecord
 *
 * Usage: npm run db:seed
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import dotenv from "dotenv";

// Load .env.local first — must happen before PrismaClient connects
dotenv.config({ path: resolve(".env.local") });

import { PrismaClient, Department, DietaryPreference } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "[seed] DATABASE_URL is not set. Copy .env.example to .env.local and configure it first."
  );
}

const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter, log: ["error"] });

// ─── CSV Parser ───────────────────────────────────────────────────

function parseCSV(filepath: string): Record<string, string>[] {
  const raw = readFileSync(filepath, "utf-8").trim();
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = values[i] ?? "";
    });
    return row;
  });
}

// ─── Helpers ──────────────────────────────────────────────────────

function mapDepartment(dept: string): Department {
  const map: Record<string, Department> = { ICT: "ICT", ET: "ET", BST: "BST" };
  return map[dept] ?? "ICT";
}

function mapDietary(diet: string): DietaryPreference {
  const map: Record<string, DietaryPreference> = {
    Vegan: "VEGAN",
    Vegetarian: "VEGETARIAN",
    "Non-Vegetarian": "NON_VEGETARIAN",
    "Non-Veg": "NON_VEGETARIAN",
  };
  return map[diet] ?? "NON_VEGETARIAN";
}

function decimal(n: string | number) {
  return parseFloat(String(n));
}

// ─── Main Seed ────────────────────────────────────────────────────

async function main() {
  console.log("🌱 CaféSmart — CSV Data Bootstrap\n");

  // ─── 1. Seed Ingredients from inventory_records.csv ─────────────
  console.log("📦 [1/5] Seeding Ingredients...");
  const invRows = parseCSV(resolve("docs/inventory_records.csv"));
  const ingredientNames = [...new Set(invRows.map((r) => r["Ingredient"]!))];
  let ingredientCount = 0;

  for (const name of ingredientNames) {
    const unit = name === "Milk" ? "liters" : "kg";
    await prisma.ingredient.upsert({
      where: { name },
      update: { unit },
      create: { name, unit },
    });
    ingredientCount++;
  }
  console.log(`   ✅ ${ingredientCount} ingredients seeded`);

  // Resolve ingredient name→id map
  const allIngredients = await prisma.ingredient.findMany();
  const ingredientMap = new Map(allIngredients.map((i) => [i.name, i.id]));

  // ─── 2. Seed Users from student_demographics.csv ────────────────
  console.log("\n👤 [2/5] Seeding Users...");
  const studentRows = parseCSV(resolve("docs/student_demographics.csv"));
  let userCount = 0;

  for (const row of studentRows) {
    const studentId = row["Student ID"]!;
    const email = `${studentId.toLowerCase()}@fot.ruh.ac.lk`;
    await prisma.user.upsert({
      where: { email },
      update: {
        department: mapDepartment(row["Department"]!),
        dietaryPreference: mapDietary(row["Dietary Preference"]!),
      },
      create: {
        id: studentId,
        email,
        name: `Student ${studentId}`,
        role: "STUDENT",
        department: mapDepartment(row["Department"]!),
        dietaryPreference: mapDietary(row["Dietary Preference"]!),
        onboardingDone: false,
      },
    });
    userCount++;
  }
  console.log(`   ✅ ${userCount} users seeded`);

  // ─── 3. Seed MenuItems from sales_logs.csv ──────────────────────
  console.log("\n🍽️  [3/5] Seeding MenuItems...");
  const salesRows = parseCSV(resolve("docs/sales_logs.csv"));
  const itemNames = [...new Set(salesRows.map((r) => r["Item"]!))];
  const menuItemMap = new Map<string, string>();
  let menuItemCount = 0;

  for (const name of itemNames) {
    // Assign a dietary type based on item name heuristics
    const dietaryType: DietaryPreference =
      name.includes("Chicken") || name.includes("Kottu") || name.includes("Short Eats")
        ? "NON_VEGETARIAN"
        : "VEGETARIAN";

    // Assign a plausible base price (LKR)
    const priceMap: Record<string, number> = {
      "Rice & Curry": 180,
      Kottu: 250,
      "Fried Rice": 200,
      Noodles: 170,
      "Short Eats": 80,
      Juice: 100,
      Tea: 50,
      Coffee: 80,
    };

    const existing = await prisma.menuItem.findFirst({ where: { name } });
    if (existing) {
      menuItemMap.set(name, existing.id);
      menuItemCount++;
    } else {
      const created = await prisma.menuItem.create({
        data: {
          name,
          basePrice: priceMap[name] ?? 150,
          dietaryType,
          isActive: true,
        },
      });
      menuItemMap.set(name, created.id);
      menuItemCount++;
    }
  }
  console.log(`   ✅ ${menuItemCount} menu items seeded`);

  // ─── 4. Seed Orders + OrderItems from sales_logs.csv ────────────
  console.log("\n🛒 [4/5] Seeding Historical Orders...");
  // Use synthetic system user for historical orders
  const systemUser = await prisma.user.upsert({
    where: { email: "system@cafesmart.internal" },
    update: {},
    create: {
      id: "SYSTEM",
      email: "system@cafesmart.internal",
      name: "Historical System",
      role: "ADMIN",
      onboardingDone: true,
    },
  });

  // Group sales by date — create one Order per date containing all items
  const salesByDate = new Map<string, { item: string; qty: number }[]>();
  for (const row of salesRows) {
    const date = row["Date"]!;
    const item = row["Item"]!;
    const qty = parseInt(row["Quantity Sold"]!, 10);
    if (!salesByDate.has(date)) salesByDate.set(date, []);
    salesByDate.get(date)!.push({ item, qty });
  }

  let orderCount = 0;
  let orderItemCount = 0;

  for (const [date, items] of salesByDate) {
    // Skip if an order for this date + system user already exists
    const existingOrder = await prisma.order.findFirst({
      where: { studentId: systemUser.id, createdAt: new Date(date) },
    });
    if (existingOrder) {
      console.log(`   ⏭️  Order for ${date} already exists — skipping`);
      continue;
    }

    // Seed a pickup slot for this date (needed for FK)
    const slot = await prisma.pickupSlot.upsert({
      where: { date_slotTime: { date: new Date(date), slotTime: "12:00" } },
      update: {},
      create: {
        date: new Date(date),
        slotTime: "12:00",
        maxCapacity: 300,
        currentCount: 0,
      },
    });

    // Create a single historical order per date
    const orderNumber = `HIST-${date.replace(/-/g, "")}`;
    const order = await prisma.order.create({
      data: {
        orderNumber,
        studentId: systemUser.id,
        type: "WALK_IN",
        status: "COLLECTED",
        pickupSlotId: slot.id,
        totalAmount: 0, // computed below
        qrCode: `HIST-QR-${date.replace(/-/g, "")}`,
        createdAt: new Date(date),
      },
    });
    orderCount++;

    let totalAmount = 0;
    for (const { item, qty } of items) {
      const menuItemId = menuItemMap.get(item);
      if (!menuItemId) continue;

      const price = (() => {
        const p: Record<string, number> = {
          "Rice & Curry": 180, Kottu: 250, "Fried Rice": 200, Noodles: 170,
          "Short Eats": 80, Juice: 100, Tea: 50, Coffee: 80,
        };
        return p[item] ?? 150;
      })();

      const subtotal = price * qty;
      totalAmount += subtotal;

      await prisma.orderItem.create({
        data: {
          orderId: order.id,
          menuItemId,
          quantity: qty,
          unitPrice: price,
          subtotal,
        },
      });
      orderItemCount++;
    }

    // Update order total
    await prisma.order.update({
      where: { id: order.id },
      data: { totalAmount },
    });
  }
  console.log(`   ✅ ${orderCount} orders with ${orderItemCount} items seeded`);

  // ─── 5. Seed InventoryRecords ───────────────────────────────────
  console.log("\n📋 [5/5] Seeding Inventory Records...");

  // Group by (date, ingredient) — there may be duplicates from daily entries
  let invRecordCount = 0;
  for (const row of invRows) {
    const ingredientId = ingredientMap.get(row["Ingredient"]!);
    if (!ingredientId) continue;

    const date = new Date(row["Date"]!);
    const openingStock = decimal(row["Stock Level (kg/liters)"]!);
    const wastage = decimal(row["Wastage (kg/liters)"]!);

    await prisma.inventoryRecord.upsert({
      where: {
        ingredientId_date: { ingredientId, date },
      },
      update: { openingStock, wastage },
      create: {
        ingredientId,
        date,
        openingStock,
        wastage,
      },
    });
    invRecordCount++;
  }
  console.log(`   ✅ ${invRecordCount} inventory records seeded`);

  // ─── 6. Seed QueueTimeRecords ───────────────────────────────────
  console.log("\n⏱️  [Bonus] Seeding Queue Time Records...");
  const queueRows = parseCSV(resolve("docs/queue_times.csv"));
  let queueCount = 0;

  for (const row of queueRows) {
    const date = new Date(row["Date"]!);
    const slotTime = row["Time"]!;
    const avgWait = parseInt(row["Average Wait Time (minutes)"]!, 10);

    await prisma.queueTimeRecord.upsert({
      where: { date_slotTime: { date, slotTime } },
      update: { avgWaitMinutes: avgWait },
      create: { date, slotTime, avgWaitMinutes: avgWait },
    });
    queueCount++;
  }
  console.log(`   ✅ ${queueCount} queue time records seeded`);

  // ─── Summary ────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(50));
  console.log("🎉 Seed complete!");
  console.log("=".repeat(50));
  console.log(`   Ingredients:      ${ingredientCount}`);
  console.log(`   Users:            ${userCount}`);
  console.log(`   Menu Items:       ${menuItemCount}`);
  console.log(`   Orders:           ${orderCount}`);
  console.log(`   Order Items:      ${orderItemCount}`);
  console.log(`   Inventory Recs:   ${invRecordCount}`);
  console.log(`   Queue Time Recs:  ${queueCount}`);
  console.log(`   Total records:    ${ingredientCount + userCount + menuItemCount + orderCount + orderItemCount + invRecordCount + queueCount}`);
  console.log("=".repeat(50));
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("❌ Seed failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });

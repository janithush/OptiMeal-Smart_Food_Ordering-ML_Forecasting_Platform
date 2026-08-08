/**
 * prisma/seed-images.ts — Menu Item Image URL Seeder
 *
 * Maps existing CaféSmart menu items to high-quality Unsplash food images.
 * Idempotent — safe to run multiple times.
 *
 * Usage: npx tsx prisma/seed-images.ts
 */

import { resolve } from "path";
import dotenv from "dotenv";

dotenv.config({ path: resolve(".env.local") });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter, log: ["error"] });

// ── Image URL mappings (Unsplash — free, high-quality food photos) ─

const IMAGE_MAP: Record<string, string> = {
  "Chicken Rice & Curry":
    "https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?w=600&h=400&fit=crop",
  "Fish Rice & Curry":
    "https://images.unsplash.com/photo-1534604973900-c43ab4c2e0ab?w=600&h=400&fit=crop",
  "Veg/Soya Rice & Curry":
    "https://images.unsplash.com/photo-1512058564366-18510be2db19?w=600&h=400&fit=crop",
  "Fried Rice":
    "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=600&h=400&fit=crop",
  "Kottu":
    "https://images.unsplash.com/photo-1563379926898-05f4575a45d8?w=600&h=400&fit=crop",
  "String Hoppers":
    "https://images.unsplash.com/photo-1505253758473-96b7015fcd40?w=600&h=400&fit=crop",
  "Parata":
    "https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=600&h=400&fit=crop",
  "Wade":
    "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=600&h=400&fit=crop",
  "Short Eats":
    "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=600&h=400&fit=crop",
  "Tea":
    "https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=600&h=400&fit=crop",
  "Iced Milo":
    "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=600&h=400&fit=crop",
  "Coffee":
    "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600&h=400&fit=crop",
  "Rice & Curry":
    "https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?w=600&h=400&fit=crop",
  "Noodles":
    "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=600&h=400&fit=crop",
  "Juice":
    "https://images.unsplash.com/photo-1534353473418-4cfa6c56fd38?w=600&h=400&fit=crop",
  "Burger":
    "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&h=400&fit=crop",
};

// ── Main ─────────────────────────────────────────────────────────

async function main() {
  console.log("🖼️  CaféSmart — Menu Item Image Seeder\n");

  let updated = 0;
  let skipped = 0;

  const items = await prisma.menuItem.findMany({
    where: { isActive: true },
    select: { id: true, name: true, imageUrl: true },
  });

  for (const item of items) {
    const imageUrl = IMAGE_MAP[item.name];
    if (!imageUrl) {
      console.log("   ⚠️  No image mapped for: " + item.name);
      skipped++;
      continue;
    }

    if (item.imageUrl === imageUrl) {
      console.log("   ✓  " + item.name + " (already set)");
      skipped++;
      continue;
    }

    await prisma.menuItem.update({
      where: { id: item.id },
      data: { imageUrl },
    });
    console.log("   🖼️  " + item.name + " → image set");
    updated++;
  }

  console.log("\n📊 Summary:");
  console.log("   Updated: " + updated);
  console.log("   Skipped/No map: " + skipped);
  console.log("\n🎉 Image seeding complete!\n");
}

main()
  .then(function () { process.exit(0); })
  .catch(function (e: unknown) {
    console.error("Image seed failed:", e);
    process.exit(1);
  });

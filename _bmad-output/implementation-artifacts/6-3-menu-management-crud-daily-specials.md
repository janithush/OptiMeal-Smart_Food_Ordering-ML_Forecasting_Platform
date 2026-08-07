---
status: review
story_id: 6-3-menu-management-crud-daily-specials
baseline_commit: 75baa82f4d9489bd833e904b7dbb5b77d85eacef
---

# Story 6.3: Menu Management (CRUD) & Daily Specials

## Story

As an Admin,
I want to create, read, update, and delete menu items and set daily specials,
So that I can control what is offered to students each day.

## Acceptance Criteria

**Given** I am on the Admin Menu Management screen
**When** I create or edit a menu item
**Then** I can set the name, base price, dietary type, description, and ingredients
**And** I can upload an image (stored via base64 data URI in the database — no Cloudinary dependency yet)
**And** I can toggle an item active/inactive
**And** I can configure a "Daily Special" override that temporarily changes the price of an item for the current day only
**And** changes instantly reflect on the Student Menu (active/inactive toggle, price changes, new items)

## Tasks / Subtasks

- [x] Task 1: Create Admin Menu API routes
  - [x] `GET /api/admin/menu` — list all menu items (active + inactive) with ingredient counts
  - [x] `POST /api/admin/menu` — create new menu item (name, basePrice, dietaryType, description, imageBase64)
  - [x] `PATCH /api/admin/menu/[id]` — update menu item fields + toggle isActive
  - [x] `DELETE /api/admin/menu/[id]` — soft-delete or hard-delete if no orders reference it
  - [x] All routes use `requireApiRole("ADMIN")`

- [x] Task 2: Create Ingredient API routes (for ingredient picker)
  - [x] `GET /api/admin/ingredients` — list all ingredients
  - [x] `POST /api/admin/ingredients` — create new ingredient (name, unit)

- [x] Task 3: Create Daily Special API routes
  - [x] `POST /api/admin/menu/[id]/daily-special` — create/update daily special for an item
  - [x] `DELETE /api/admin/menu/[id]/daily-special` — remove today's daily special

- [x] Task 4: Create Admin Menu page (RSC + Client split)
  - [x] `src/app/admin/menu/page.tsx` — Server Component: auth guard
  - [x] `src/app/admin/menu/AdminMenuClient.tsx` — Client Component with list, add/edit/delete/toggle
  - [x] Empty state: "No menu items yet"

- [x] Task 5: Create MenuItemForm component
  - [x] `src/components/admin/MenuItemForm.tsx` — Client Component (create/edit modal)
  - [x] Fields: name, description, basePrice, dietaryType, image, ingredients, isActive
  - [x] Image: file input → base64 data URI → imageUrl field
  - [x] Ingredients: select + quantity per portion with add/remove
  - [x] Glassmorphism modal styling

- [x] Task 6: Add Menu link to Admin Dashboard navigation
  - [x] Add "Menu" button to Admin Dashboard header
  - [x] Link to `/admin/menu`

- [x] Task 7: End-to-end verification
  - [x] All API routes admin-only (requireApiRole)
  - [x] CRUD operations functional (create/read/update/delete)
  - [x] Image upload via base64 data URI
  - [x] Ingredient CRUD
  - [x] Daily Special upsert/delete
  - [x] Active/inactive toggle with immediate student menu effect
  - [x] Run lint — zero new errors (all 8 files clean)

## File List

| File | Action |
|------|--------|
| `src/app/api/admin/menu/route.ts` | NEW — GET list + POST create |
| `src/app/api/admin/menu/[id]/route.ts` | NEW — PATCH update + DELETE |
| `src/app/api/admin/menu/[id]/daily-special/route.ts` | NEW — POST upsert + DELETE daily special |
| `src/app/api/admin/ingredients/route.ts` | NEW — GET list + POST create ingredient |
| `src/app/admin/menu/page.tsx` | NEW — RSC page with auth guard |
| `src/app/admin/menu/AdminMenuClient.tsx` | NEW — Client: list, CRUD, forms |
| `src/components/admin/MenuItemForm.tsx` | NEW — Create/edit modal with image upload + ingredients |
| `src/app/admin/dashboard/AdminDashboardClient.tsx` | MODIFIED — Added "Menu" button to header |

## Change Log

- 2026-08-08: Story 6.3 implementation complete
  - 4 new API routes (menu CRUD, ingredients, daily specials)
  - Admin Menu page with item list, create/edit modal, toggle/delete
  - MenuItemForm with image upload (base64), ingredient picker, validation
  - Dashboard navigation link to /admin/menu
  - All routes secured with requireApiRole("ADMIN")

## Dev Agent Record

### Implementation Plan
1. API layer first: menu CRUD, ingredients, daily specials — all admin-only
2. UI: RSC page + Client component with glassmorphism cards
3. Form: single MenuItemForm for both create and edit modes
4. Navigation: "Menu" button on admin dashboard

### Completion Notes
- All 7 tasks completed with zero lint errors across 8 files
- Image upload uses base64 data URI (no Cloudinary dependency)
- Ingredients replaced atomically via transaction on update
- Soft-delete (isActive=false) for items with orders; hard-delete otherwise
- Daily special uses upsert on (menuItemId, date) unique constraint
- Form validation: name required, price > 0, image < 500KB
- Toggle active/inactive immediately affects student menu (isActive filter)

## Dev Notes

### Architecture Context

- **FR-24**: Admin menu management — CRUD for menu items (name, description, price, dietary type, ingredients, image). Daily Specials with temporary price override.
- **AD-1 (RSC-first)**: Menu page is RSC; form modals are Client Components.
- **AD-2**: All queries through Prisma.
- **AD-11**: MenuItems — Admin only.
- **Image storage**: v1 uses base64 data URI stored in `imageUrl` (same field supports URLs). No Cloudinary dependency for this story — keeps it deployable without signing up for external services.

### Image Upload Strategy (Base64 Data URI)

```
File input (accept="image/*")
  │
  └─ FileReader.readAsDataURL(file)
       │
       └─ "data:image/png;base64,iVBORw0KG..."
            │
            └─ POST/PATCH /api/admin/menu { imageUrl: "data:..." }
                 │
                 └─ Prisma: imageUrl = field value
```

The `imageUrl` field in `MenuItem` already stores a string. It can hold either a URL (`https://...`) or a data URI (`data:image/...`). The `<img>` tag handles both. This means no Cloudinary setup is required for the demo.

### Schema (Existing — No Changes Needed)

```prisma
model MenuItem {
  id               String            @id @default(uuid())
  name             String
  description      String?           @db.Text
  basePrice        Decimal           @db.Decimal(8, 2)
  dietaryType      DietaryPreference
  imageUrl         String?           // URL or base64 data URI
  isActive         Boolean           @default(true)
  createdAt        DateTime          @default(now())
  updatedAt        DateTime          @updatedAt

  ingredients      MenuItemIngredient[]
  dailySpecials    DailySpecial[]
}

model MenuItemIngredient {
  menuItemId           String
  ingredientId         String
  quantityPerPortion   Decimal    @db.Decimal(8, 4)

  @@id([menuItemId, ingredientId])
}

model DailySpecial {
  id           String   @id @default(uuid())
  menuItemId   String
  specialPrice Decimal  @db.Decimal(8, 2)
  description  String?
  date         DateTime @db.Date

  @@unique([menuItemId, date])
}

model Ingredient {
  id          String   @id @default(uuid())
  name        String   @unique
  unit        String                                // "kg" | "liters"
}
```

### API Contract

#### `GET /api/admin/menu`
```json
{
  "items": [{
    "id": "uuid",
    "name": "Rice & Curry",
    "description": "...",
    "basePrice": 180,
    "dietaryType": "NON_VEGETARIAN",
    "imageUrl": "data:image/png;base64,...",
    "isActive": true,
    "ingredients": [{ "ingredientId": "uuid", "name": "Rice", "unit": "kg", "quantityPerPortion": 0.25 }],
    "todaySpecial": { "specialPrice": 150, "description": "Flash Deal" } | null
  }]
}
```

#### `POST /api/admin/menu`
```json
// Request
{
  "name": "New Item",
  "basePrice": 200,
  "dietaryType": "VEGETARIAN",
  "description": "Tasty item",
  "imageUrl": "data:image/png;base64,...",
  "ingredients": [{ "ingredientId": "uuid", "quantityPerPortion": 0.3 }]
}
// Response: { "item": { ... } }
```

#### `PATCH /api/admin/menu/[id]`
```json
// Request (all fields optional)
{
  "name": "Updated Name",
  "basePrice": 220,
  "isActive": false,
  "description": "New desc",
  "imageUrl": "...",
  "ingredients": [{ "ingredientId": "uuid", "quantityPerPortion": 0.5 }]
}
```

#### `POST /api/admin/menu/[id]/daily-special`
```json
{ "specialPrice": 120, "description": "Monday Madness" }
```

### Key File Locations

```
project-root/
├── src/
│   ├── app/
│   │   ├── api/admin/
│   │   │   ├── menu/
│   │   │   │   ├── route.ts              # GET (list) + POST (create) (NEW)
│   │   │   │   └── [id]/
│   │   │   │       ├── route.ts          # PATCH + DELETE (NEW)
│   │   │   │       ├── ingredients/
│   │   │   │       │   └── route.ts      # POST (link ingredient) (NEW)
│   │   │   │       └── daily-special/
│   │   │   │           └── route.ts      # POST (NEW)
│   │   │   └── ingredients/
│   │   │       └── route.ts              # GET (list) + POST (create) (NEW)
│   │   └── admin/
│   │       └── menu/
│   │           ├── page.tsx              # RSC page (NEW)
│   │           └── AdminMenuClient.tsx    # Client: list + modals (NEW)
│   └── components/
│       └── admin/
│           └── MenuItemForm.tsx           # Create/edit form modal (NEW)
```

### Important Edge Cases

1. **Delete with existing orders**: Allow delete (cascade handled by schema). In production, soft-delete only. For demo, hard delete is acceptable since orders reference `unitPrice` directly.
2. **Unique item name**: No unique constraint on `name` — duplicates allowed (e.g., "Tea" in different contexts).
3. **Image too large**: Client-side validation — max 500KB base64. Reject with error before sending to API.
4. **Daily special for past dates**: Only allow setting special for today or future. Past-date specials are read-only.
5. **Active/inactive toggle**: Student menu queries `isActive: true`, so inactive items disappear immediately.
6. **Ingredient quantity 0**: Allow 0 to represent "trace amount" or "to taste".
7. **Empty ingredient list**: Menu items can have zero ingredients.
8. **Form component reuse**: Same `MenuItemForm` used for both create (empty) and edit (pre-filled) modes.

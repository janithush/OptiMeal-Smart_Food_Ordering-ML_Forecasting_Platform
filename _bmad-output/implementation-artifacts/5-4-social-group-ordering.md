---
status: in-progress
story_id: 5-4-social-group-ordering
baseline_commit: TBD
---

# Story 5.4: Social Group Ordering

## Story

As a Group Organiser,
I want to create a group order and share a 6-character code with my friends,
So that we can all add items to a single order and pick them up together at one time slot.

## Acceptance Criteria

**Given** I start a Group Order
**When** I share the generated 6-character code
**Then** up to 5 authenticated Students can join and add items to the shared cart
**And** only I (the Organiser) can select the Pickup Slot and checkout using my Wallet balance
**And** once confirmed, a single QR code is generated for the entire Group Order

## Tasks / Subtasks

- [ ] Task 1: Add GroupOrderCartItem to Prisma schema
  - [ ] Add `GroupOrderCartItem` model: id, groupOrderId, participantId, menuItemId, quantity
  - [ ] Run `prisma generate` and `prisma db push`
  - [ ] Verify the model is created in DB

- [ ] Task 2: Create group order server utilities (`src/lib/group-order.ts`)
  - [ ] `generateGroupCode()` — 6-char unique alphanumeric code
  - [ ] `createGroupOrder(organizerId)` — create GroupOrder + auto-join organiser as participant
  - [ ] `joinGroupOrder(code, userId)` — validate code, check expiry, check max 6 participants, add participant
  - [ ] `addItemToGroupCart(groupOrderId, userId, menuItemId, quantity)` — upsert cart item
  - [ ] `removeItemFromGroupCart(groupOrderId, userId, itemId)` — remove cart item
  - [ ] `getGroupOrder(groupOrderId)` — full details: participants, cart items, status
  - [ ] `checkoutGroupOrder(groupOrderId, organizerId, pickupSlotId, coinsRedeemed)` — create individual Orders, deduct wallet, earn coins, generate QR

- [ ] Task 3: Create API routes
  - [ ] `POST /api/student/group-orders` — create new group order
  - [ ] `POST /api/student/group-orders/join` — join by code
  - [ ] `GET /api/student/group-orders/[id]` — get group order details (cart, participants, status)
  - [ ] `POST /api/student/group-orders/[id]/items` — add item to shared cart
  - [ ] `DELETE /api/student/group-orders/[id]/items/[itemId]` — remove item
  - [ ] `POST /api/student/group-orders/[id]/checkout` — organiser-only checkout

- [ ] Task 4: Create Group Order UI page
  - [ ] `src/app/student/group-order/page.tsx` — Server Component (RSC) that fetches group order data
  - [ ] `src/app/student/group-order/GroupOrderPageContent.tsx` — Client Component with:
    - Join/create flow (code input or create button)
    - Live participant list with avatars
    - Shared cart showing who added what
    - Menu item list for adding items
    - Pickup slot selector (organiser only)
    - Checkout button (organiser only)
    - "Share Code" copy button
  - [ ] `src/components/orders/GroupOrderParticipants.tsx` — participant avatar row
  - [ ] `src/components/orders/GroupOrderCart.tsx` — shared cart with per-participant labels
  - [ ] `src/components/orders/CreateJoinGroup.tsx` — create/join landing component

- [ ] Task 5: Add Socket.io events for real-time group cart
  - [ ] Add `groupOrderUpdated` event to ServerToClientEvents
  - [ ] Emit on add/remove item and participant join
  - [ ] Client hook: `useGroupOrderSocket(groupOrderId)` for live updates

- [ ] Task 6: Add Group Order entry point to Student Home
  - [ ] Add "Group Order" button/pill to home page header
  - [ ] Link to `/student/group-order`

- [ ] Task 7: Integrate group checkout with wallet + coins
  - [ ] Reuse wallet deduction logic from existing orders route
  - [ ] Deduct from organiser's wallet only
  - [ ] Earn coins for organiser (based on total)
  - [ ] Create individual Order records per participant, all linked to GroupOrder

- [ ] Task 8: End-to-end verification
  - [ ] Student A creates group order → gets 6-char code
  - [ ] Students B, C join via code (up to 5 verified)
  - [ ] Student D tries to join full group → rejected
  - [ ] All participants add items → cart updates in real-time
  - [ ] Only organiser sees Pickup Slot selector and Checkout button
  - [ ] Organiser checks out → all Orders created, wallet debited, single QR
  - [ ] Expired group order rejects new joins
  - [ ] Run lint — confirm zero new errors

## Dev Notes

### Architecture Context

- **FR-21**: Group Order with 6-char code, up to 5 friends, organiser pays from own wallet, one pickup slot.
- **AD-1 (RSC-first)**: Group order page is RSC; cart + participants are Client Components.
- **AD-2**: All queries through Prisma.
- **AD-6**: Socket.io for real-time cart updates across participants.
- **AD-11**: GroupOrder created by Student; only organiser can checkout.

### Data Flow

```
Organiser                   Participants (up to 5)            Server
    │                              │                           │
    ├─ Create GroupOrder ──────────┤                           │
    │  ← 6-char code               │                           │
    │                              ├─ Join by code ────────────┤
    │                              │  ← Confirmed              │
    │  ← Socket: participant joined│                           │
    ├─ Add items ──────────────────┤                           │
    │  ← Socket: item added        ├─ Add items ───────────────┤
    │                              │  ← Socket: item added     │
    │  ← Socket: item added        │                           │
    ├─ Select slot + Checkout ─────┤                           │
    │  ← Orders confirmed          │  ← Orders confirmed       │
```

### Schema Addition

```prisma
model GroupOrderCartItem {
  id            String     @id @default(uuid())
  groupOrderId  String
  groupOrder    GroupOrder @relation(fields: [groupOrderId], references: [id], onDelete: Cascade)
  participantId String
  participant   User       @relation(fields: [participantId], references: [id])
  menuItemId    String
  menuItem      MenuItem   @relation(fields: [menuItemId], references: [id])
  quantity      Int
  addedAt       DateTime   @default(now())

  @@unique([groupOrderId, participantId, menuItemId])
}
```

### Key File Locations

```
project-root/
├── prisma/
│   └── schema.prisma                            # Add GroupOrderCartItem (MODIFIED)
├── src/
│   ├── lib/
│   │   └── group-order.ts                       # Business logic (NEW)
│   ├── types/
│   │   └── group-order.ts                       # Type definitions (NEW)
│   ├── app/
│   │   ├── api/student/group-orders/
│   │   │   ├── route.ts                         # POST (create) (NEW)
│   │   │   ├── join/route.ts                    # POST (join) (NEW)
│   │   │   └── [id]/
│   │   │       ├── route.ts                     # GET (NEW)
│   │   │       ├── items/
│   │   │       │   ├── route.ts                 # POST (add) (NEW)
│   │   │       │   └── [itemId]/route.ts        # DELETE (NEW)
│   │   │       └── checkout/route.ts            # POST (NEW)
│   │   └── student/
│   │       ├── group-order/
│   │       │   ├── page.tsx                     # RSC page (NEW)
│   │       │   └── GroupOrderClient.tsx         # Client wrapper (NEW)
│   │       └── home/
│   │           ├── page.tsx                     # Add group order link (MODIFIED)
│   │           └── MenuPageContent.tsx          # Add group order button (MODIFIED)
│   └── components/
│       └── orders/
│           ├── CreateJoinGroup.tsx              # Create/join flow (NEW)
│           ├── GroupOrderParticipants.tsx       # Participant list (NEW)
│           └── GroupOrderCart.tsx               # Shared cart UI (NEW)
```

### Important Edge Cases

1. **Max 6 participants** (1 organiser + 5 joins): 6th join attempt returns error.
2. **30-minute expiry**: GroupOrder.expiresAt checked on join and add-item. Stale groups rejected.
3. **Duplicate join prevention**: @unique([groupOrderId, studentId]) on GroupOrderParticipant.
4. **Organiser-only operations**: Slot selection and checkout verify userId === organizerId.
5. **Group cart per participant**: Each participant has their own items; organiser sees all at checkout.
6. **CODE not found**: Returns clear error "Invalid group code".
7. **Self-join prevention**: Organiser already auto-joined; joining again returns "Already in group".
8. **Checkout validates**: Active menu items, wallet balance, slot capacity, pre-order cutoff.
9. **Real-time sync**: All join/add/remove events broadcast via Socket.io to group room.

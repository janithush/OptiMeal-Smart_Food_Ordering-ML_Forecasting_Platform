---
status: review
story_id: 5-3-meal-recommendations
baseline_commit: TBD
---

# Story 5.3: Meal Recommendations (Collaborative Filtering Integration)

## Story

As a Student,
I want to see up to 3 personalised item recommendations on the home screen,
So that I can discover new meals I might like based on my preferences and order history.

## Acceptance Criteria

**Given** I have a saved Dietary Preference and some order history
**When** I view the Student Home page
**Then** I see a "Recommended for You" section with up to 3 items
**And** these items strictly adhere to my saved Dietary Preference
**And** items marked as Sold Out are automatically filtered out from recommendations
**And** items I've already ordered are excluded (to encourage discovery)

## Tasks / Subtasks

- [ ] Task 1: Create the recommendations engine (`src/lib/recommendations.ts`)
  - [ ] Create `src/lib/recommendations.ts` — exports `getRecommendations(userId: string, dietaryPreference: DietaryPreference)`
  - [ ] Query the current user's order history (all menuItemIds they've ever ordered)
  - [ ] Find "similar students" — students sharing the same dietary preference and/or department
  - [ ] Get menu items those similar students have ordered, excluding:
    - Items the current user already ordered
    - Items with a different dietary preference
    - Inactive items
  - [ ] Score items by frequency across similar students (collaborative signal)
  - [ ] Return top 3 items with name, price, dietaryType, imageUrl, and a reason label
  - [ ] If no similar-student data exists, fall back to content-based: popular items matching dietary preference that the user hasn't tried
  - [ ] If no recommendations possible, return empty array

- [ ] Task 2: Add type definitions
  - [ ] Add `RecommendedItem` type to `src/types/menu.ts`:
    ```
    { menuItemId: string; name: string; basePrice: number; dietaryType: DietaryType; imageUrl: string | null; reason: string }
    ```

- [ ] Task 3: Create the Recommended Section UI component
  - [ ] Create `src/components/menu/RecommendedSection.tsx` — Client Component
  - [ ] Props: `items: RecommendedItem[]`, `onAddToCart: (item: RecommendedItem) => void`
  - [ ] Display as a horizontal scrollable row of cards above the menu grid (same pattern as MyUsualSection)
  - [ ] Each card: item name, price, dietary badge, reason label ("Popular in ICT"), image placeholder
  - [ ] Glassmorphism card styling consistent with the app
  - [ ] Empty state: hidden (don't render the section at all)
  - [ ] "Add to Cart" button on each card

- [ ] Task 4: Wire recommendations into the Student Home page
  - [ ] In `src/app/student/home/page.tsx`: call `getRecommendations(session.user.id, user.dietaryPreference)` alongside existing queries
  - [ ] Pass `recommendations` as a prop to `MenuPageContent`
  - [ ] In `MenuPageContent.tsx`: add `recommendations` prop and render `<RecommendedSection>` above the menu grid

- [ ] Task 5: End-to-end verification
  - [ ] Log in as Student A with dietary preference "NON_VEGETARIAN" and place 3+ orders
  - [ ] Log in as Student B with same dietary preference and department
  - [ ] Verify Student B sees "Recommended for You" items that Student A ordered (but Student B hasn't)
  - [ ] Verify all recommended items match Student B's dietary preference
  - [ ] Verify Sold Out items are excluded
  - [ ] Verify Student with no similar peers falls back to popular items
  - [ ] New student with 0 orders → verify section might show popular items or hide if none
  - [ ] Run lint — confirm zero new errors

## Dev Notes

### Architecture Context

- **FR-20**: Meal recommendations — up to 3 personalised items on home screen. Based on Dietary Preference + order history + collaborative filtering. No Sold Out items.
- **AD-1 (RSC-first)**: Recommendations fetched server-side via `getRecommendations()`. UI is a Client Component.
- **AD-2**: All queries through Prisma.
- **AD-5**: ML service call deferred to Epic 7. v1 uses Prisma queries for collaborative filtering directly.

### Collaborative Filtering Algorithm (v1)

The v1 recommendation engine uses **user-based collaborative filtering** implemented in TypeScript/Prisma:

1. **Profile similarity**: Find students sharing the same `dietaryPreference` as the current user.
2. **Item co-occurrence**: For each menu item the user hasn't ordered, count how many similar students have ordered it.
3. **Scoring**: Items are scored by the number of distinct similar students who ordered them (popularity among peers).
4. **Fallback**: If no similar students exist, recommend the most popular items matching dietary preference that the user hasn't tried.

```
Algorithm:
  userHistory = set of menuItemIds the user has ordered
  similarStudents = users with same dietaryPreference (excluding current user)
  
  For each similar student:
    For each item they ordered:
      if item not in userHistory AND item.isActive AND item.dietaryType == userDietary:
        itemScores[item.id] += 1
  
  Sort by score descending, take top 3
  
  If no results: fallback to popular items (most ordered by anyone matching dietary)
```

### Recommendation Data Structure

```typescript
interface RecommendedItem {
  menuItemId: string;
  name: string;
  basePrice: number;
  dietaryType: DietaryType;
  imageUrl: string | null;
  reason: string;  // "Popular in ICT" | "Popular with Vegetarians" | "Trending"
}
```

### Key File Locations

```
project-root/
├── src/
│   ├── lib/
│   │   └── recommendations.ts                 # getRecommendations() (NEW)
│   ├── types/
│   │   └── menu.ts                            # Add RecommendedItem type (MODIFIED)
│   ├── app/
│   │   └── student/
│   │       └── home/
│   │           ├── page.tsx                   # Fetch recommendations (MODIFIED)
│   │           └── MenuPageContent.tsx        # RecommendedSection + handleAddToCart (MODIFIED)
│   └── components/
│       └── menu/
│           └── RecommendedSection.tsx          # Recommended row UI (NEW)
```

### Important Edge Cases

1. **0 similar students**: Fall back to content-based (popular items matching dietary preference, excluding user's history).
2. **< 3 recommendations**: Show however many exist. Don't pad with empty cards.
3. **All items already ordered**: Return empty array, don't show section.
4. **No order history (new student)**: Show popular items matching dietary preference.
5. **Inactive menu items**: Filtered out automatically.
6. **Sold Out items**: Filtered out in the page component (same as menu grid logic).
7. **Cross-dietary contamination**: Only items matching the user's `dietaryPreference` are returned.
8. **Performance**: Query is bounded — limits similar students to 50 and uses take:3 at the end.

### Relationship to ML Service (Epic 7)

This v1 implementation uses pure Prisma queries. In Epic 7, this will be enhanced by:
- Replacing the scoring with a matrix-factorization model (SVD) from the Python ML service
- Adding temporal decay (recent orders weighted higher)
- Incorporating item features (ingredients, category) for hybrid CF

The function signature `getRecommendations(userId, dietaryPreference)` is designed to be swappable — the ML service can be called inside this function without changing the callers.

### Previous Context

- **Story 5.2**: My Usual (quick reorder) — same card pattern, different data source.
- **Story 5.1**: Student spend analytics — not directly related.

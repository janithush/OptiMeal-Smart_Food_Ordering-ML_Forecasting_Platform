# CaféSmart Test Suite

## Setup

```bash
# Install dependencies (already done via npm install)
npm install

# Install Playwright browsers (Chromium)
npx playwright install chromium

# For CI: install with system dependencies
npx playwright install chromium --with-deps
```

## Environment

Copy `.env.test.example` to `.env.test` and configure:

```bash
cp .env.test.example .env.test
```

| Variable | Default | Description |
|---|---|---|
| `BASE_URL` | `http://localhost:3000` | App base URL for E2E tests |
| `API_URL` | `http://localhost:3000` | API base for API-only tests |
| `TEST_ENV` | `local` | `local` \| `ci` \| `staging` |

## Running Tests

### Unit & Component Tests (Vitest)

```bash
# Run all unit tests
npm test

# Watch mode
npm run test:watch

# With UI
npm run test:ui

# With coverage
npm run test:coverage
```

### E2E Tests (Playwright)

```bash
# Run all E2E + API tests
npm run test:e2e

# With Playwright UI (debug mode)
npm run test:e2e:ui

# API-only tests (no browser)
npm run test:e2e:api
```

### All Tests

```bash
npm run test:all
```

## Architecture

```
tests/
├── unit/                          # Vitest unit & component tests
│   └── inventory-validation.test.ts
├── api/                           # Playwright API tests (no browser)
│   ├── inventory-get.spec.ts
│   ├── inventory-post.spec.ts
│   └── inventory-history.spec.ts
├── e2e/                           # Playwright browser tests
├── support/
│   ├── setup.ts                   # Vitest setup (jest-dom matchers)
│   ├── fixtures/
│   │   └── base-fixture.ts        # Playwright fixtures (auth, API contexts)
│   ├── helpers/
│   │   ├── inventory-api.ts       # Inventory API typed wrappers
│   │   └── ingredients-api.ts     # Ingredients API typed wrappers
│   └── factories/
│       └── data-factory.ts        # Faker-based test data factories
```

## Best Practices

### Selectors
- Prefer `data-testid` attributes for E2E selectors
- Use accessible selectors (`getByRole`, `getByLabelText`) as fallback

### Test Isolation
- Each test must be independent (no shared state)
- API tests use `APIRequestContext` per fixture (auto-cleaned)
- Unit tests are fully isolated via Vitest

### Data Factories
- Use `tests/support/factories/data-factory.ts` for test data
- All factories accept overrides for specific scenarios
- Faker generates realistic random data by default

### Auth in Tests
- Local: mock JWT via `x-test-role` header or test-login endpoint
- CI: seed session tokens via environment variables
- See `tests/support/fixtures/base-fixture.ts`

## CI Integration

### GitHub Actions Example

```yaml
- name: Run unit tests
  run: npm test

- name: Run Playwright E2E tests
  run: npx playwright test
  env:
    BASE_URL: http://localhost:3000
    DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
```

### Test Reports
- Playwright: `playwright-report/` (HTML) + `test-results/junit.xml`
- Vitest: `test-results/unit-junit.xml` (when `CI=true`)

## Knowledge Base

- TEA framework: `_bmad/tea/` — Test architecture decisions
- Architecture spine: `_bmad-output/planning-artifacts/architecture/`
- Story 7.1: `_bmad-output/implementation-artifacts/7-1-inventory-stock-entry-forecasting-view.md`

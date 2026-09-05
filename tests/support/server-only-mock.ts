// Vitest mock for the `server-only` package.
// Production: `server-only` throws when imported from client components.
// Unit tests run in jsdom/Node and import server libs transitively for
// pure helpers — stub it to a no-op so those imports don't fail.
export default {};

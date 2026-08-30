/**
 * check-migration-order.mjs
 *
 * Verifies that every `CREATE TABLE` in every `prisma/migrations/*/migration.sql`
 * is topologically ordered — i.e. every referenced table appears on an
 * earlier line than the table that holds the FK.
 *
 * This is a belt-and-suspenders check for the build pipeline. The CI
 * "Compute migration checksums" step in `.github/workflows/ci.yml`
 * catches the same class of bug indirectly (the migration would fail
 * with P3018 / 42P01 in `prisma migrate deploy`), but a pre-merge
 * check that just runs `node scripts/check-migration-order.mjs` is
 * faster and gives a better error message.
 *
 * Usage:
 *   node scripts/check-migration-order.mjs
 *   node scripts/check-migration-order.mjs prisma/migrations/0_init/migration.sql
 *
 * Exit code 0 if all migrations are well-ordered; exit code 1 otherwise.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS_DIR = "prisma/migrations";
const targets = process.argv.slice(2);

const migrationFiles = targets.length
  ? targets
  : readdirSync(MIGRATIONS_DIR)
      .filter((d) => statSync(join(MIGRATIONS_DIR, d)).isDirectory())
      .map((d) => join(MIGRATIONS_DIR, d, "migration.sql"));

let totalErrors = 0;

for (const file of migrationFiles) {
  const content = readFileSync(file, "utf8");
  const lines = content.split("\n");

  // Build a map: tableName -> 1-based line number where CREATE TABLE starts.
  const tableOrder = new Map();
  for (const line of lines) {
    const m = line.match(/CREATE TABLE "(\w+)"/);
    if (m && !tableOrder.has(m[1])) {
      tableOrder.set(m[1], lines.indexOf(line) + 1);
    }
  }

  // Walk the file tracking the "current" CREATE TABLE statement and
  // collect all REFERENCES that belong to it. Multi-line statements
  // are handled correctly: we keep track of the last CREATE TABLE
  // until the matching ");" is found.
  const errors = [];
  let currentTable = null;
  let currentLine = 0;
  let depth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimStart();

    // Skip comment-only lines.
    if (trimmed.startsWith("--")) continue;

    const ctMatch = line.match(/CREATE TABLE "(\w+)"/);
    if (ctMatch) {
      currentTable = ctMatch[1];
      currentLine = i + 1;
      depth = 0;
    }

    // Track parenthesis depth so we know when the current CREATE TABLE
    // statement ends. (A ");" closes the statement.)
    for (const ch of line) {
      if (ch === "(") depth++;
      else if (ch === ")") depth--;
    }
    if (currentTable && depth <= 0 && line.includes(";")) {
      // Statement ended — we don't reset currentTable here, because the
      // next statement may have FKs that we still want attributed to
      // currentTable. (No, actually, this is wrong: REFERENCES clauses
      // are only inside the CREATE TABLE statement.)
      // Simpler: keep currentTable set; only reset when we hit the next
      // CREATE TABLE.
    }

    const refMatches = [...line.matchAll(/REFERENCES "(\w+)"/g)];
    for (const m of refMatches) {
      const ref = m[1];
      const refLine = tableOrder.get(ref);
      if (refLine === undefined) {
        errors.push(
          `    line ${i + 1} (${currentTable ?? "?"}): REFERENCES ${ref} — TABLE NOT FOUND in migration`
        );
      } else if (refLine >= currentLine) {
        errors.push(
          `    line ${i + 1} (${currentTable ?? "?"}): REFERENCES ${ref} (created at line ${refLine}) — INVALID ORDER`
        );
      }
    }
  }

  if (errors.length > 0) {
    totalErrors += errors.length;
    console.log(`\n❌ ${file}:`);
    for (const e of errors) console.log(e);
  } else {
    console.log(`✅ ${file}: topologically ordered (${tableOrder.size} tables)`);
  }
}

if (totalErrors > 0) {
  console.log(`\n${totalErrors} forward-reference error(s) found.`);
  process.exit(1);
} else {
  console.log("\nAll migrations are topologically ordered.");
  process.exit(0);
}

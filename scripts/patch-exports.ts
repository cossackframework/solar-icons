#!/usr/bin/env tsx
/*
 * Rewrite package.json's `main`, `types`, `files`, and `exports` from the
 * committed src/-shape (the source of truth the generator produces) to the
 * published dist/-shape, AFTER `vite build` + `tsc -p tsconfig.declarations.json`
 * have populated dist/.
 *
 * Why a separate step (not in the generator): the generator's job is to read
 * vendored SVGs and emit src/ + a src-style exports map. The published layout
 * (compiled JS under dist/) is a build-time concern. Keeping them separate means
 * `pnpm run build:icons` always regenerates the src shape without knowing about
 * dist, and `pnpm run build` is the only thing that produces the publishable
 * shape. Idempotent — safe to run multiple times.
 *
 *   main:    ./src/index.ts        → ./dist/index.js
 *   types:   ./src/index.ts        → ./dist/index.d.ts
 *   files:   ["src"]               → ["dist"]
 *   exports: "./src/eye/index.ts"  → { types: "./dist/eye/index.d.ts", import: "./dist/eye/index.js" }
 *            "./src/eye/*.ts"      → { types: "./dist/eye/*.d.ts",     import: "./dist/eye/*.js" }
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_JSON = path.resolve(__dirname, "..", "package.json");

/** Map a committed src path to its dist condition pair. */
function toDistConditions(srcTarget: string): { types: string; import: string } {
    // "./src/eye/index.ts" → "./dist/eye/index.js" + ".d.ts"
    const distPath = srcTarget.replace(/^\.\/src\//, "./dist/").replace(/\.ts$/, "");
    return { types: `${distPath}.d.ts`, import: `${distPath}.js` };
}

async function main() {
    const raw = await fs.readFile(PKG_JSON, "utf8");
    const pkg = JSON.parse(raw);

    // main / types
    pkg.main = "./dist/index.js";
    pkg.types = "./dist/index.d.ts";

    // files: ship only the compiled output
    pkg.files = ["dist"];

    // exports: rewrite every src target to a {types, import} dist pair.
    // Core entries (".", "./types", "./registry") and every icon entry follow
    // the same src→dist rule, so a uniform transform covers all 2,495 entries.
    const prevExports: Record<string, unknown> = pkg.exports ?? {};
    const nextExports: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(prevExports)) {
        if (typeof value !== "string") {
            // Already an object (e.g. a re-run left conditions in place) — keep as-is.
            nextExports[key] = value;
            continue;
        }
        nextExports[key] = toDistConditions(value);
    }
    pkg.exports = nextExports;

    await fs.writeFile(PKG_JSON, JSON.stringify(pkg, null, 2) + "\n", "utf8");
    console.log("[patch-exports] Rewrote main/types/files/exports → dist in package.json");
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});

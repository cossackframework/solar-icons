import { defineConfig } from "vite";
import { readdirSync, statSync } from "node:fs";

/**
 * Multi-entry build that preserves per-icon / per-style tree-shaking.
 *
 * The package exposes ~2,495 subpaths (`./eye`, `./eye/bold`, ...). For an
 * import like `@cossackframework/solar-icons/eye/bold` to pull only that one
 * style into a consumer's bundle, each subpath must be its own output chunk.
 * A single-entry bundle would merge every icon and defeat the whole point of
 * the per-style file layout.
 *
 * So every published module is a rollup INPUT entry, and rollup dedupes shared
 * code (none here — each module is self-contained data) across them:
 *   dist/index.js           ← src/index.ts   (Icon, NamedIcon, types)
 *   dist/types.js           ← src/types.ts
 *   dist/registry.js        ← src/registry.ts
 *   dist/eye/index.js       ← src/eye/index.ts   (aggregator: IconEntry)
 *   dist/eye/bold.js        ← src/eye/bold.ts    (single style string)
 *
 * The committed src/ is TypeScript source of truth; this config compiles it to
 * JS because Node/esbuild refuse to type-strip .ts inside node_modules (the
 * 0.6.0 packaging bug). `tsc -p tsconfig.declarations.json` (run next in the
 * build script) emits the matching .d.ts files.
 */
function entries(): Record<string, string> {
    const entry: Record<string, string> = {
        index: "src/index.ts",
        types: "src/types.ts",
        registry: "src/registry.ts",
    };
    for (const name of readdirSync("src")) {
        if (name === "scripts" || name === "tests") continue;
        const dir = `src/${name}`;
        if (!statSync(dir).isDirectory()) continue;
        // Aggregator entry: src/<icon>/index.ts → dist/<icon>/index.js
        entry[`${name}/index`] = `${dir}/index.ts`;
        // Per-style entries: src/<icon>/<style>.ts → dist/<icon>/<style>.js
        for (const f of readdirSync(dir)) {
            if (f === "index.ts" || !f.endsWith(".ts")) continue;
            entry[`${name}/${f.replace(/\.ts$/, "")}`] = `${dir}/${f}`;
        }
    }
    return entry;
}

export default defineConfig({
    build: {
        sourcemap: true,
        lib: {
            entry: entries(),
            formats: ["es"],
        },
        outDir: "dist",
        rolldownOptions: {
            // This package is data-only (zero framework deps), so there is
            // nothing to externalize — every module is self-contained data.
            external: [],
        },
    },
});

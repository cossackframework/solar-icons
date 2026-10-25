#!/usr/bin/env tsx
/*
 * @cossackframework/solar-icons — icon build pipeline
 *
 * Reads SVG source files from a Solar icons tree and emits a tree-shakeable
 * layout: ONE FILE PER (icon × style), plus a per-icon aggregator and a
 * registry. This is the layout that lets a consumer import a single style of a
 * single icon (`@cossackframework/solar-icons/eye/bold`) without pulling the other
 * five styles into the bundle — the win at full-Solar scale (1,246 icons).
 *
 * Output layout:
 *   src/<icon>/<style>.ts     one module per style: `export const <icon> = "<svg/>"`
 *   src/<icon>/index.ts       aggregator: imports its style files, re-exports the
 *                             per-style strings AND an `IconEntry` object
 *   src/registry.ts           imports every `<icon>/index.ts` into a name→entry map
 *   package.json              `exports` + `files` patched with `./<icon>` + `./<icon>/*`
 *
 * Solar source layout (the canonical @solar-icons/core tree):
 *   <SRC_DIR>/<Category>/<Style>/<Name>.svg
 *
 * Usage:
 *   pnpm run build:icons                      # uses the default SRC_DIR
 *   SRC_DIR=/path/to/svgs pnpm run build:icons
 *   ICONS=eye,arrow-right pnpm run build:icons   # curate to an allowlist
 *
 * Each style's inner SVG markup (everything inside <svg>...</svg>) is extracted
 * and `currentColor`-ified so the Icon component can recolor via CSS. Duotone
 * accent paths keep their `opacity` attribute (the secondary layer).
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.resolve(__dirname, "..", "..");
const SRC_DIR = process.env.SRC_DIR
    ? path.resolve(process.env.SRC_DIR)
    : path.resolve(PKG_ROOT, "vendor", "solar-icons");
const SRC_ROOT = path.resolve(PKG_ROOT, "src");
const PKG_JSON = path.resolve(PKG_ROOT, "package.json");

/**
 * Optional allowlist of kebab-case icon names. When set (via the ICONS env
 * var, comma-separated), only those icons are emitted. When unset, every icon
 * in the tree is emitted.
 */
const ICONS_FILTER = process.env.ICONS
    ? new Set(
          process.env.ICONS.split(",")
              .map((s) => s.trim())
              .filter(Boolean),
      )
    : null;

/** Canonical style → Solar source folder name. Order matters: it is preserved in aggregator output. */
const STYLE_DIR_MAP = {
    line: "Linear",
    bold: "Bold",
    duotone: "BoldDuotone",
    broken: "Broken",
    outline: "Outline",
    "line-duotone": "LineDuotone",
} as const;

const STYLES = Object.keys(STYLE_DIR_MAP) as (keyof typeof STYLE_DIR_MAP)[];

/**
 * Core export entries that are hand-maintained (not generated). The generator
 * preserves these when rewriting the `exports`/`files` maps so it never clobbers
 * the package's fixed entry points.
 */
const CORE_EXPORT_ENTRIES = new Set([".", "./types", "./registry"]);

function toKebab(raw: string): string {
    return String(raw)
        .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
        .replace(/[_\s]+/g, "-")
        .replace(/-+/g, "-")
        .toLowerCase()
        .replace(/^-|-$/g, "");
}

/**
 * Extract the inner markup of an <svg> and normalize colors to currentColor.
 *
 * Solar's default stroke/fill color is `#1C274C` (a dark navy); some icons use
 * `black`/`#000`. All of these are replaced with `currentColor` so the Icon
 * component can recolor via CSS. `fill="none"` / `stroke="none"` are preserved.
 * Duotone accent paths (those carrying an `opacity` attribute) keep their
 * opacity so the secondary layer remains visible.
 */
function extractInner(svg: string): string {
    const match = svg.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);
    if (!match) return "";
    return match[1]
        .replace(
            /\s*(stroke|fill)\s*=\s*"#1[cC]274[cC]"/gi,
            ' $1="currentColor"',
        )
        .replace(
            /\s*(stroke|fill)\s*=\s*"#?\s*(?:black|#000(?:000)?|rgb\(0\s*0\s*0\))?"/gi,
            ' $1="currentColor"',
        )
        .replace(/\s*stroke\s*=\s*"none"/gi, ' stroke="none"')
        .trim();
}

async function exists(p: string): Promise<boolean> {
    try {
        await fs.access(p);
        return true;
    } catch {
        return false;
    }
}

/**
 * Walk the Solar tree and collect, per canonical style, a map of
 * kebab-name → inner SVG markup. Icons may live under any category folder;
 * every style folder under every category is scanned. First-seen wins.
 */
async function readStyleDirs(): Promise<
    Record<(typeof STYLES)[number], Map<string, string>>
> {
    const result = {} as Record<(typeof STYLES)[number], Map<string, string>>;
    for (const style of STYLES) result[style] = new Map();

    if (!(await exists(SRC_DIR))) {
        console.error(`[build-icons] Source dir not found: ${SRC_DIR}`);
        console.error(
            "Set SRC_DIR or place Solar SVGs under <SRC_DIR>/<Category>/<Style>/<Name>.svg.",
        );
        process.exit(1);
    }

    const folderToStyle: Record<string, (typeof STYLES)[number]> = {};
    for (const s of STYLES) folderToStyle[STYLE_DIR_MAP[s]] = s;

    const categories = await fs.readdir(SRC_DIR, { withFileTypes: true });
    for (const cat of categories) {
        if (!cat.isDirectory()) continue;
        const catDir = path.join(SRC_DIR, cat.name);

        const styleDirs = await fs.readdir(catDir, { withFileTypes: true });
        for (const sd of styleDirs) {
            if (!sd.isDirectory()) continue;
            const style = folderToStyle[sd.name];
            if (!style) continue;

            const styleDir = path.join(catDir, sd.name);
            const files = await fs.readdir(styleDir);
            for (const file of files) {
                if (!file.toLowerCase().endsWith(".svg")) continue;
                const base = file.replace(/\.svg$/i, "");
                const svg = await fs.readFile(path.join(styleDir, file), "utf8");
                const inner = extractInner(svg);
                if (!inner) continue;
                const key = toKebab(base);
                if (!result[style].has(key)) result[style].set(key, inner);
            }
        }
    }
    return result;
}

/**
 * True when a kebab icon name needs to be quoted as an object key (i.e. it is
 * not a valid bare identifier) — e.g. names with hyphens or digits-first.
 */
function needsQuote(name: string): boolean {
    return !/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name);
}

/** Quote a key for use in an object literal / export name if needed. */
function objKey(name: string): string {
    return needsQuote(name) ? JSON.stringify(name) : name;
}

interface IconDef {
    /** kebab-case name (filesystem folder + registry key). */
    name: string;
    /** styles present in source, in canonical order. */
    styles: { style: (typeof STYLES)[number]; inner: string }[];
}

/**
 * The public export identifier for an icon: its PascalCase name + `Icon` suffix
 * (e.g. "alt-arrow-down" → "AltArrowDownIcon", "eye" → "EyeIcon").
 *
 * The `Icon` suffix is mandatory for every icon — names like `main`, `error`,
 * `copy`, `refresh`, `settings` would otherwise collide with common identifiers
 * once the framework re-exports them, and `*Icon` is unambiguous. This mirrors
 * the `@solar-icons/react` convention (`HeartIcon`).
 */
function iconExportName(kebab: string): string {
    return pascalFromKebab(kebab) + "Icon";
}

/** Convert a kebab-case icon name to PascalCase (e.g. "alt-arrow-down" → "AltArrowDown"). */
function pascalFromKebab(kebab: string): string {
    return kebab
        .split(/[-_\s.]+/)
        .filter(Boolean)
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join("");
}

/** Map a canonical style key to a safe local import alias (hyphens → underscores). */
function styleToIdent(style: string): string {
    return style.replace(/-/g, "_");
}

/**
 * Emit per-style files + the aggregator for one icon under `src/<name>/`.
 *
 * Both the per-style file and the aggregator export under the SAME suffixed
 * identifier (`<Pascal>Icon`), so a consumer always imports the same name
 * regardless of whether they take all styles or one:
 *   import { EyeIcon } from '@cossackframework/solar-icons/eye'
 *   import { EyeIcon } from '@cossackframework/solar-icons/eye/bold'
 */
async function emitIcon(def: IconDef): Promise<void> {
    const dir = path.join(SRC_ROOT, def.name);
    await fs.mkdir(dir, { recursive: true });

    const exportName = iconExportName(def.name);

    // One file per style: a single string export under the suffixed identifier.
    for (const { style, inner } of def.styles) {
        const styleFile = path.join(dir, `${style}.ts`);
        const source = `/* GENERATED by \`pnpm run build:icons\`. Do not edit by hand. */\nexport const ${exportName} = ${JSON.stringify(inner)};\n`;
        await fs.writeFile(styleFile, source, "utf8");
    }

    // Aggregator: import the suffixed name from each style file, ALIASED to a
    // distinct per-style local (each style file exports the same identifier
    // `<Pascal>Icon`, so importing them all un-named would collide). Compose
    // them into an IconEntry, exported under the canonical suffixed name.
    // We do NOT re-export the per-style strings here — each style file is
    // reachable directly via `@cossackframework/solar-icons/<icon>/<style>`.
    //
    // The `.ts` extension is explicit on every relative import so the modules
    // resolve under bundlers consuming this package as raw TypeScript source
    // (via "exports" → ./src/...). Extensionless relative imports rely on
    // bundler TS-extension resolution that isn't guaranteed for linked deps.
    const imports = def.styles
        .map(({ style }) => `import { ${exportName} as ${styleToIdent(style)} } from "./${style}.ts";`)
        .join("\n");
    const entryFields = def.styles
        .map(({ style }) => `    ${objKey(style)}: ${styleToIdent(style)},`)
        .join("\n");

    const aggregator = `/* GENERATED by \`pnpm run build:icons\`. Do not edit by hand.
 * Aggregates all available styles for "${def.name}" into one IconEntry.
 *   All styles:  import { ${exportName} } from '@cossackframework/solar-icons/${def.name}'
 *   One style:   import { ${exportName} } from '@cossackframework/solar-icons/${def.name}/<style>'
 */
import type { IconEntry } from "../types";
${imports}

export const ${exportName}: IconEntry = {
${entryFields}
};
`;
    await fs.writeFile(path.join(dir, "index.ts"), aggregator, "utf8");
}

/**
 * Rewrite the `exports` and `files` fields of package.json so they exactly
 * match the generated icon folders. Core hand-maintained entries (".",
 * "./types", "./registry") are preserved; stale icon entries are dropped so
 * renames/removals don't linger.
 */
async function patchPackageJson(iconNames: string[]): Promise<void> {
    const raw = await fs.readFile(PKG_JSON, "utf8");
    const pkg = JSON.parse(raw);

    // Rebuild exports: keep core entries (in their original order), then append
    // `./<icon>` + `./<icon>/*` for each generated icon, sorted for stability.
    const prevExports: Record<string, string> = pkg.exports ?? {};
    const coreEntries: Record<string, string> = {};
    for (const key of Object.keys(prevExports)) {
        if (CORE_EXPORT_ENTRIES.has(key)) coreEntries[key] = prevExports[key];
    }
    // Ensure the three core entries always exist (first run / deleted by accident).
    coreEntries["."] = coreEntries["."] ?? "./src/index.ts";
    coreEntries["./types"] = coreEntries["./types"] ?? "./src/types.ts";
    coreEntries["./registry"] = coreEntries["./registry"] ?? "./src/registry.ts";

    const exports: Record<string, string> = { ...coreEntries };
    for (const name of iconNames) {
        exports[`./${name}`] = `./src/${name}/index.ts`;
        exports[`./${name}/*`] = `./src/${name}/*.ts`;
    }
    pkg.exports = exports;

    // `files`: keep the existing "src" entry; the generator only emits under src.
    const files = Array.isArray(pkg.files) ? pkg.files : [];
    if (!files.includes("src")) files.push("src");
    pkg.files = files;

    // Serialize with a trailing newline. JSON.stringify matches the 2-space
    // indentation the hand-written file uses.
    await fs.writeFile(PKG_JSON, JSON.stringify(pkg, null, 2) + "\n", "utf8");
}

async function main() {
    console.log(`[build-icons] Reading source: ${SRC_DIR}`);
    const byStyle = await readStyleDirs();

    // Union of all icon names across styles, optionally filtered to an allowlist.
    const names = new Set<string>();
    for (const style of STYLES) for (const n of byStyle[style].keys()) names.add(n);
    if (ICONS_FILTER) {
        for (const n of [...names]) if (!ICONS_FILTER.has(n)) names.delete(n);
        const missing = [...ICONS_FILTER].filter((n) => !names.has(n));
        if (missing.length > 0) {
            console.warn(
                `[build-icons] ${missing.length} requested icon(s) not found in source: ${missing.join(", ")}`,
            );
        }
    }
    if (names.size === 0) {
        console.warn("[build-icons] No SVGs found. Nothing to do.");
        return;
    }

    const sorted = [...names].sort();

    // Build the per-icon definitions in canonical style order.
    const defs: IconDef[] = [];
    for (const name of sorted) {
        const styles: IconDef["styles"] = [];
        for (const style of STYLES) {
            const inner = byStyle[style].get(name);
            if (inner) styles.push({ style, inner });
        }
        if (styles.length > 0) defs.push({ name, styles });
    }

    // Wipe stale generated icon folders so removals/renames don't linger.
    // Keep non-icon entries (index.ts, Icon.ts, NamedIcon.ts, types.ts,
    // registry.ts, scripts/, tests/) — only directories that match a known
    // icon-folder shape (a dir whose name is a kebab slug) are removed.
    await cleanStaleIconFolders(SRC_ROOT, new Set(defs.map((d) => d.name)));

    let styleFileCount = 0;
    for (const def of defs) {
        await emitIcon(def);
        styleFileCount += def.styles.length;
    }

    // Registry: one import + one entry per icon aggregator. Keys are the kebab
    // names (runtime lookup), values are the suffixed IconEntry exports. The
    // `.ts` extension is explicit (see emitIcon() for rationale).
    const registryImports = defs
        .map((d) => `import { ${iconExportName(d.name)} } from "./${d.name}/index.ts";`)
        .join("\n");
    const registryEntries = defs
        .map((d) => `    ${objKey(d.name)}: ${iconExportName(d.name)},`)
        .join("\n");
    const registrySource = `/* GENERATED by \`pnpm run build:icons\`. Do not edit by hand.
 *
 * Aggregates all per-icon modules into a single lookup keyed by kebab name.
 * Only \`NamedIcon\` (dynamic name lookup) imports this — the tree-shakeable
 * \`Icon\` + direct \`./<icon>\` import path never touches it.
 */
import type { IconRegistry } from "./types";
${registryImports}

export const iconRegistry: IconRegistry = {
${registryEntries}
};

/** All registered icon names. */
export const iconNames = Object.keys(iconRegistry);
`;
    await fs.writeFile(path.join(SRC_ROOT, "registry.ts"), registrySource, "utf8");

    await patchPackageJson(sorted);

    console.log(
        `[build-icons] Emitted ${defs.length} icon(s) (${styleFileCount} style files) → ${path.relative(PKG_ROOT, SRC_ROOT)}`,
    );
    console.log(`[build-icons] Registry → ${path.relative(PKG_ROOT, path.join(SRC_ROOT, "registry.ts"))}`);
    console.log(`[build-icons] Patched exports in ${path.relative(PKG_ROOT, PKG_JSON)}`);
}

/**
 * Remove generated icon folders that no longer correspond to a source icon.
 * Identifies candidate folders as immediate children of `srcRoot` whose name is
 * a kebab slug AND that contain a generated `index.ts` aggregator. Hand-written
 * top-level modules (Icon.ts, types.ts, etc.) are files, not folders, so they
 * are never touched.
 */
async function cleanStaleIconFolders(srcRoot: string, keep: Set<string>): Promise<void> {
    let entries: import("node:fs").Dirent[];
    try {
        entries = await fs.readdir(srcRoot, { withFileTypes: true });
    } catch {
        return;
    }
    for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const name = entry.name;
        // Skip known non-icon directories.
        if (name === "scripts" || name === "tests") continue;
        // Only touch directories that look like an icon folder: kebab slug with
        // a generated aggregator inside. This protects any hand-added folder.
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) continue;
        if (keep.has(name)) continue;
        const aggregator = path.join(srcRoot, name, "index.ts");
        if (!(await exists(aggregator))) continue;
        await fs.rm(path.join(srcRoot, name), { recursive: true, force: true });
        console.log(`[build-icons] Removed stale icon folder: ${name}`);
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});

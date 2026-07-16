import { describe, it, expect } from "vitest";
import { iconRegistry, iconNames } from "../registry";
import { normalizeStyle } from "../types";
import type { IconEntry } from "../types";
// Direct entry imports — the tree-shakeable data path consumers use.
import { ArrowRightIcon } from "../arrow-right/index.ts";
import { ArrowRightIcon as arrowRightBold } from "../arrow-right/bold.ts";

// This package is data-only (the Icon/NamedIcon components live in
// @cossackframework/ui). These tests cover data correctness: the registry,
// per-icon/per-style entry shapes, and normalizeStyle. Rendering of the data
// is tested in the ui package.

describe("icon registry", () => {
    it("ships a non-empty set of icons", () => {
        expect(iconNames.length).toBeGreaterThan(0);
    });

    it("includes the curated sample icons", () => {
        expect(iconNames).toEqual(
            expect.arrayContaining([
                "arrow-right",
                "alt-arrow-down",
                "check-circle",
                "close-circle",
                "magnifier",
                "settings",
            ]),
        );
    });

    it("each curated icon has at least the line style", () => {
        for (const name of [
            "arrow-right",
            "alt-arrow-down",
            "check-circle",
            "close-circle",
        ]) {
            const entry = iconRegistry[name];
            expect(entry.line).toBeTruthy();
        }
    });

    it("exposes the full six-style set where Solar provides them", () => {
        // alt-arrow-down exists in all six Solar styles.
        const entry = iconRegistry["alt-arrow-down"];
        expect(entry.line).toBeTruthy();
        expect(entry.bold).toBeTruthy();
        expect(entry.duotone).toBeTruthy();
        expect(entry.broken).toBeTruthy();
        expect(entry.outline).toBeTruthy();
        expect(entry["line-duotone"]).toBeTruthy();
    });
});

describe("per-icon entry data (all-styles import)", () => {
    it("an all-styles entry is an object keyed by style with SVG markup", () => {
        const entry: IconEntry = ArrowRightIcon;
        expect(entry.line).toBeTruthy();
        expect(typeof entry.line).toBe("string");
        // Inner markup is a path/element, not a full <svg> wrapper.
        expect(entry.line).not.toContain("<svg");
        expect(entry.bold).toBeTruthy();
        expect(entry.duotone).toBeTruthy();
    });

    it("every style value is a non-empty string when present", () => {
        const entry = iconRegistry["arrow-right"];
        for (const style of ["line", "bold", "duotone", "broken", "outline", "line-duotone"] as const) {
            const v = entry[style];
            if (v !== undefined) {
                expect(typeof v).toBe("string");
                expect(v.length).toBeGreaterThan(0);
            }
        }
    });
});

describe("per-style import (single-style data)", () => {
    it("a per-style import is a bare SVG-inner-markup string", () => {
        // Same icon, single style: a string (not an object).
        expect(typeof arrowRightBold).toBe("string");
        expect(arrowRightBold.length).toBeGreaterThan(0);
        // And it matches the bold value on the all-styles entry.
        expect(arrowRightBold).toBe(ArrowRightIcon.bold);
    });
});

describe("normalizeStyle", () => {
    it("maps canonical names through unchanged", () => {
        expect(normalizeStyle("line")).toBe("line");
        expect(normalizeStyle("bold")).toBe("bold");
        expect(normalizeStyle("duotone")).toBe("duotone");
        expect(normalizeStyle("broken")).toBe("broken");
        expect(normalizeStyle("outline")).toBe("outline");
        expect(normalizeStyle("line-duotone")).toBe("line-duotone");
    });

    it("maps aliases to canonical styles", () => {
        expect(normalizeStyle("solid")).toBe("bold");
        expect(normalizeStyle("d")).toBe("duotone");
        expect(normalizeStyle("brk")).toBe("broken");
        expect(normalizeStyle("o")).toBe("outline");
        expect(normalizeStyle("ld")).toBe("line-duotone");
    });

    it("falls back to line for unknown input", () => {
        expect(normalizeStyle("nonsense")).toBe("line");
        expect(normalizeStyle("B")).toBe("bold");
    });
});

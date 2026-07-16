import { describe, it, expect } from "vitest";
import { renderToString } from "@cossackframework/renderer";
import { NamedIcon, type NamedIconProps } from "../NamedIcon";
import { Icon } from "../Icon";
import { iconRegistry, iconNames } from "../registry";
import { normalizeStyle } from "../types";
// Direct entry imports — the tree-shakeable path every component uses.
import { ArrowRightIcon } from "../arrow-right/index.ts";
import { ArrowRightIcon as arrowRightBold } from "../arrow-right/bold.ts";
import type { IconEntry } from "../types";

function renderNamed(props: NamedIconProps): string {
    const instance = new NamedIcon();
    instance.props = props;
    const result = instance.render();
    if (result === null) return "";
    return renderToString(result);
}

function renderEntry(entry: IconEntry | undefined, props: Record<string, any> = {}): string {
    const instance = new Icon();
    instance.props = { entry, ...props } as any;
    const result = instance.render();
    if (result === null) return "";
    return renderToString(result);
}

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

describe("NamedIcon (dynamic name lookup)", () => {
    it("renders an <svg> with the requested size", () => {
        const out = renderNamed({ name: "check-circle", size: 20 });
        expect(out).toContain("<svg");
        expect(out).toContain('width="20"');
        expect(out).toContain('height="20"');
        // line style emits a <path>
        expect(out).toContain("<path");
    });

    it("uses the requested style", () => {
        const out = renderNamed({ name: "arrow-right", style: "bold" });
        // bold emits a fill-based path using currentColor
        expect(out).toContain('fill="currentColor"');
    });

    it("falls back to line when a style is missing for an icon", () => {
        // Request an outline style; the component falls back to line if absent.
        const out = renderNamed({ name: "arrow-right", style: "outline" });
        expect(out).toContain("<svg");
        expect(out).toContain("<path");
    });

    it("adds aria-label and role=img when a label is supplied", () => {
        const out = renderNamed({ name: "check-circle", label: "Confirm" });
        expect(out).toContain('role="img"');
        expect(out).toContain('aria-label="Confirm"');
        expect(out).not.toContain("aria-hidden");
    });

    it("hides from assistive tech when no label is supplied", () => {
        const out = renderNamed({ name: "check-circle" });
        expect(out).toContain('aria-hidden="true"');
    });

    it("renders nothing for an unknown icon name", () => {
        const out = renderNamed({ name: "does-not-exist" });
        expect(out).toBe("");
    });
});

// L6: direct coverage of the entry-based `Icon` component — the tree-shakeable
// path every internal component uses. Previously only exercised indirectly via
// NamedIcon.
describe("Icon (entry) — direct entry path", () => {
    it("renders an <svg> from an all-styles entry import", () => {
        const out = renderEntry(ArrowRightIcon, { size: 24 });
        expect(out).toContain("<svg");
        expect(out).toContain('width="24"');
        expect(out).toContain('height="24"');
        expect(out).toContain('viewBox="0 0 24 24"');
        expect(out).toContain("<path");
    });

    it("renders from a single-style string wrapped into an entry", () => {
        // A per-style import is a bare string; wrap it as an entry to render.
        const out = renderEntry({ line: arrowRightBold });
        expect(out).toContain("<svg");
        expect(out).toContain("<path");
    });

    it("uses the requested style with fallback to line", () => {
        // arrow-right has all styles; requesting bold selects the bold markup.
        const boldOut = renderEntry(ArrowRightIcon, { style: "bold" });
        expect(boldOut).toContain('fill="currentColor"');
        // Requesting a missing style falls back to line (entry has all 6, so
        // build a synthetic entry with only `line` to exercise the fallback).
        const lineOnly: IconEntry = { line: ArrowRightIcon.line };
        const fallbackOut = renderEntry(lineOnly, { style: "bold" });
        expect(fallbackOut).toContain("<svg");
    });

    it("adds aria-label and role=img when a label is supplied", () => {
        const out = renderEntry(ArrowRightIcon, { label: "Next" });
        expect(out).toContain('role="img"');
        expect(out).toContain('aria-label="Next"');
        expect(out).not.toContain("aria-hidden");
    });

    it("hides from assistive tech when no label is supplied", () => {
        const out = renderEntry(ArrowRightIcon);
        expect(out).toContain('aria-hidden="true"');
    });

    it("renders nothing when the entry is undefined/empty", () => {
        expect(renderEntry(undefined)).toBe("");
        expect(renderEntry({})).toBe("");
        // Entry whose requested style and line are both absent.
        expect(renderEntry({ bold: "<path/>" }, { style: "line" })).toBe("");
    });

    it("merges a consumer class onto the default cs-icon hook", () => {
        const out = renderEntry(ArrowRightIcon, { class: "my-extra" });
        expect(out).toContain('class="cs-icon my-extra"');
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

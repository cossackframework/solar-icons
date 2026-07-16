import { html } from "@cossackframework/renderer";
import { unsafeHTML } from "@cossackframework/renderer";
import { Cossack, Component } from "@cossackframework/core";
import type { IconEntry } from "./types";
import { normalizeStyle, type IconStyle } from "./types";

export interface IconProps {
    /**
     * Direct icon data (per-style SVG inner markup). This is the tree-shakeable
     * path: import the icon entry from `@cossackframework/solar-icons/<name>` (or a
     * single style from `@cossackframework/solar-icons/<name>/<style>`) and pass it
     * here so only that icon's data is bundled. Components rendering a fixed
     * icon should always use `entry`. For dynamic name-based lookup, use
     * `NamedIcon` (which carries the full registry dependency).
     */
    entry: IconEntry;
    /** Solar visual style. Defaults to "line". Falls back to "line" when a style is missing. */
    style?: IconStyle | string;
    /** Pixel size for width/height. Default 24. */
    size?: number;
    /** Accessible label. When omitted, the icon is aria-hidden. */
    label?: string;
    /** Allow arbitrary HTML attributes / classes to spread onto the <svg>. */
    [key: string]: any;
}

/**
 * Build the full <svg>...</svg> markup string for an icon.
 *
 * The whole <svg> is emitted as a single unsafeHTML blob (rather than wrapping
 * an inner path in unsafeHTML) because the HTML parser only enters the SVG
 * namespace when it encounters a literal <svg> start tag. If we rendered
 * <svg>${unsafeHTML(path)}</svg>, the inner path would be parsed in the XHTML
 * namespace and never become a real SVGPathElement — so it wouldn't render.
 *
 * Extra attributes from `rest` (class, style, data-*, etc.) are merged into the
 * opening <svg> tag so consumers can customize the icon.
 */
function buildSvg(
    inner: string,
    size: number,
    label: string | undefined,
    extraAttrs: Record<string, unknown>,
): string {
    const a11y = label
        ? ` role="img" aria-label="${escapeAttr(label)}"`
        : ` aria-hidden="true"`;

    // Merge consumer-provided class with the default cs-icon hook.
    const consumerClass = extraAttrs.class;
    const classStr = consumerClass ? `cs-icon ${String(consumerClass)}` : "cs-icon";

    // Serialize remaining extra attrs (skip class/label/style/size, already handled).
    const skip = new Set(["class", "label", "style", "size"]);
    const attrParts = Object.entries(extraAttrs)
        .filter(([k]) => !skip.has(k))
        .map(([k, v]) => v === true ? ` ${k}` : ` ${k}="${escapeAttr(String(v))}"`)
        .join("");

    const styleStr = extraAttrs.style ? ` style="${escapeAttr(String(extraAttrs.style))}"` : "";

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" class="${classStr}"${a11y}${styleStr}${attrParts}>${inner}</svg>`;
}

function escapeAttr(s: string): string {
    return String(s).replace(/"/g, "&quot;");
}

/**
 * Cossack Icon — renders a Solar icon from a direct `entry`.
 *
 *   component(Icon, { entry: eye, style: 'duotone', size: 20, label: 'Next' })
 *
 * `entry` is the tree-shakeable path: import it from
 * `@cossackframework/solar-icons/<name>` (all styles) or
 * `@cossackframework/solar-icons/<name>/<style>` (a single style string, wrapped into
 * an entry automatically). Falls back to the "line" style if the requested
 * style is missing, and renders nothing if the entry is empty.
 *
 * For dynamic name-based lookup, use `NamedIcon`.
 */
@Component()
export class Icon extends Cossack {
    declare props: IconProps;

    render() {
        const {
            entry: directEntry,
            style = "line",
            size = 24,
            label,
            ...rest
        } = this.props;

        // `entry` is the tree-shakeable path: components that render a fixed
        // icon import its data directly from @cossackframework/solar-icons/<name> and
        // pass it here, so the icon registry (and all generated modules) is
        // never pulled into the bundle. For dynamic name-based lookup, use NamedIcon.
        if (!directEntry) return null;

        const normalized = normalizeStyle(String(style));
        const inner = directEntry[normalized] ?? directEntry.line;
        if (!inner) return null;

        return html`${unsafeHTML(buildSvg(inner, size, label, rest))}`;
    }
}

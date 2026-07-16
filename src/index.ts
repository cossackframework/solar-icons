/**
 * @cossackframework/solar-icons — tree-shakeable Solar icon DATASET.
 *
 * This package is framework-agnostic: it ships only icon data (per-style SVG
 * inner-markup strings) and the associated types/helpers. It has ZERO framework
 * dependencies. The `Icon` / `NamedIcon` components that consume this data live
 * in `@cossackframework/ui` (so they share the consumer's single renderer/core
 * module instance).
 *
 * Per-icon data entries live in their own modules (`./<icon>` for all styles,
 * `./<icon>/<style>` for a single style) and are NOT re-exported from this
 * barrel — importing them directly is what keeps unused icons out of the bundle.
 *
 *   import { eyeIcon } from '@cossackframework/solar-icons/eye'        // all styles
 *   import { eyeIcon } from '@cossackframework/solar-icons/eye/bold'   // one style
 *
 * Then render with the component from ui:
 *   import { Icon } from '@cossackframework/ui'
 *   component(Icon, { entry: eyeIcon, style: 'bold', size: 24 })
 */
export { normalizeStyle, type IconStyle, type IconEntry, type IconRegistry } from "./types";

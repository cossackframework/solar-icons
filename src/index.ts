/**
 * @cossackframework/solar-icons — tree-shakeable Solar icon set.
 *
 * Components + types live here. The per-icon data entries live in their own
 * modules (`./<icon>` for all styles, `./<icon>/<style>` for a single style)
 * and are NOT re-exported from this barrel — importing them directly is what
 * keeps unused icons out of the bundle. Only `NamedIcon` (dynamic lookup) pulls
 * the full registry.
 *
 *   import { Icon } from '@cossackframework/solar-icons'
 *   import { EyeIcon as eye } from '@cossackframework/solar-icons/eye'
 *   component(Icon, { entry: eye, style: 'bold', size: 24 })
 */
export { Icon, type IconProps } from "./Icon";
export { NamedIcon, type NamedIconProps } from "./NamedIcon";
export { normalizeStyle, type IconStyle, type IconEntry, type IconRegistry } from "./types";

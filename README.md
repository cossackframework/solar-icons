# @cossackframework/solar-icons

Tree-shakeable [Solar icon set](https://solar-icons.vercel.app/) DATA package — 1,246 icons × 6 styles, exposed as per-style SVG inner-markup strings. **Framework-agnostic, zero runtime dependencies.**

The `Icon` / `NamedIcon` components that render this data live in [`@cossackframework/ui`](https://github.com/cossackframework/cossack) (so they share the consumer's single renderer/core module instance). This package ships only the data + types.

Every icon ships as **one file per style**, so importing a single style of a single icon pulls only that markup into the bundle.

## Install

```sh
pnpm add @cossackframework/solar-icons
```

No peer dependencies — this package is data-only.

## Usage

```ts
// Icon data (this package):
import { EyeIcon } from '@cossackframework/solar-icons/eye'        // all styles (IconEntry)
import { EyeIcon } from '@cossackframework/solar-icons/eye/bold'   // one style (string) — max tree-shake

// The component (from @cossackframework/ui):
import { Icon } from '@cossackframework/ui'
import { component } from '@cossackframework/renderer'

// Fixed icon (tree-shakeable): import the entry, pass to Icon.
component(Icon, { entry: EyeIcon, style: 'bold', size: 24 })

// Dynamic name lookup (runtime data): carries the full registry.
import { NamedIcon } from '@cossackframework/ui'
component(NamedIcon, { name: 'eye', style: 'bold', size: 24 })
```

- **Data import** — the tree-shakeable path. Import icon data directly from `@cossackframework/solar-icons/<name>` (all styles) or `@cossackframework/solar-icons/<name>/<style>` (one style). Only what you import is bundled.
- **`NamedIcon`** — dynamic name-based lookup. Carries the full registry dependency; use it when the icon name comes from data.

Each icon export is suffixed with `Icon` (e.g. `EyeIcon`, `SettingsIcon`) to avoid collisions with common identifiers.

### Styles

Solar ships six styles. The `style` prop selects one; missing styles fall back to `line`.

| key           | Solar source folder |
|---------------|---------------------|
| `line`        | Linear              |
| `bold`        | Bold                |
| `duotone`     | BoldDuotone         |
| `broken`      | Broken              |
| `outline`     | Outline             |
| `line-duotone`| LineDuotone         |

## Regenerating

The `src/<icon>/` folders and `src/registry.ts` are **generated** from the vendored SVG source. To regenerate (e.g. after upgrading the vendored source):

```sh
pnpm run build:icons
```

To curate a subset during development, set the `ICONS` env var (comma-separated kebab names):

```sh
ICONS=eye,arrow-right,settings pnpm run build:icons
```

## Vendored source & attribution

The raw SVGs under `vendor/solar-icons/` are vendored from the upstream
[Solar icon set](https://github.com/solar-icons/solar-icons) (`@solar-icons/core`).

- Upstream repository: https://github.com/solar-icons/solar-icons
- Vendored at upstream commit: `fb7d5678b36b04bcd8729ca07f8449b6cdb81b04`
- See `vendor/solar-icons/LICENSE-THIRD-PARTY` for the upstream third-party
  license/attribution.

The generator (`src/scripts/build-icons.ts`) reads `vendor/solar-icons/<Category>/<Style>/<Name>.svg`.

# Theme guidelines for tournament

This document describes the recommended structure, files, and conventions for adding themes to this project. Put each theme inside `tournament/themes/<theme-name>/` and include the assets and metadata listed below.

Goals:
- Keep themes self-contained so they can be added, removed or swapped easily.
- Provide clear conventions for colors, assets (logo), fonts, and optional screenshots.
- Make it easy for UI components (charts, toasts, global CSS) to consume theme values.

---

## Recommended directory layout

Place a folder for each theme under:

- `tournament/themes/<theme-name>/`

Suggested contents of a theme folder:
- `theme.json` — metadata and small config (required)
- `variables.css` — CSS custom properties for the theme (required)
- `logo.svg` (or `logo.png`) — primary logo for the theme (required if the theme has a unique logo)
- `favicon.*` (optional) — theme-specific favicons
- `fonts/` (optional) — any bundled webfonts for this theme
- `screenshots/` (optional) — preview images for theme picker in admin/preview UI
- `README.md` (optional) — theme-specific notes or attribution

Example:
- `tournament/themes/default/`
  - `theme.json`
  - `variables.css`
  - `logo.svg`
  - `screenshots/preview.png`

---

## `theme.json` (required)

A small JSON file with basic metadata. Keep it minimal — used by admin panels, theme pickers, and for runtime validation.

Example:
```tournament/themes/default/theme.json#L1-30
{
  "name": "Default",
  "slug": "default",
  "author": "Team",
  "description": "Default site theme (light/dark).",
  "base": "light",              // "light" or "dark" — optional hint
  "preview": "screenshots/preview.png"
}
```

Notes:
- `slug` should match the folder name.
- `preview` is a path relative to the theme folder.

---

## `variables.css` (required)

A theme should expose CSS custom properties (variables) that the rest of the app consumes. Place them in `:root` for the light/default mode and in a selector for the dark mode if needed (for example `.dark`).

This project contains global conventions — the app expects certain variable names in `tournament/app/globals.css`. At minimum provide the variables you want to override. Example variables used by the app include:

- `--color-background`
- `--color-foreground`
- `--font-sans`
- `--font-mono`
- `--color-sidebar-ring`
- `--color-sidebar-border`
- `--color-sidebar-accent-foreground`
- `--color-sidebar-accent`
- `--color-sidebar-primary-foreground`
- `--color-sidebar-primary`

Example `variables.css`:
```tournament/themes/default/variables.css#L1-120
/* Light mode (root) */
:root {
  --color-background: #ffffff;
  --color-foreground: #0f172a;
  --font-sans: "Inter", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, "Roboto Mono", "Courier New", monospace;

  --color-sidebar-ring: rgba(239,95,21,0.08);
  --color-sidebar-border: rgba(15,23,42,0.06);
  --color-sidebar-accent-foreground: #fff;
  --color-sidebar-accent: #ef5f15;
  --color-sidebar-primary-foreground: #fff;
  --color-sidebar-primary: #ef5f15;
}

/* Dark mode: use a selector matching the project convention (example: .dark) */
.dark {
  --color-background: #0b1220;
  --color-foreground: #e6eef8;

  --color-sidebar-ring: rgba(239,95,21,0.14);
  --color-sidebar-border: rgba(255,255,255,0.06);
  --color-sidebar-accent-foreground: #0b1220;
  --color-sidebar-accent: #ffb37a;
  --color-sidebar-primary-foreground: #0b1220;
  --color-sidebar-primary: #ffb37a;
}
```

Tips:
- Keep variable names stable across themes so components can rely on them.
- If you need additional variables for specific components, namespace them (e.g. `--chart-accent`, `--btn-primary-bg`).

---

## Logos & assets

Place the main logo at:
- `tournament/themes/<theme-name>/logo.svg` (preferred, scalable)  
or
- `tournament/themes/<theme-name>/logo.png`

Usage:
- The app can import the logo using a relative import to the folder (for server/static usage) or reference it from `public/` if you copy assets there during build/deploy.
- If the theme has a dark and light variant of the logo, name them clearly:
  - `logo--light.svg` and `logo--dark.svg`  
  or include both in `theme.json`:
```tournament/themes/default/theme.json#L1-20
{
  "name": "Default",
  "slug": "default",
  "logo": "logo.svg",
  "logo_dark": "logo--dark.svg"
}
```

Favicons:
- If you want theme-specific favicons, include them in the theme folder and wire them into the HTML head when that theme is active (optional).

---

## How components pick up theme values

This project uses `next-themes`. The UI expects themes to follow the convention defined in components:

- In code, a THEMES mapping exists:
  - `const THEMES = { light: "", dark: ".dark" }`
- Components that need per-theme configuration (e.g., chart colors) can accept either:
  - a single color (applies to all themes), or
  - an object mapping theme keys to values, e.g.:
    - `{ light: "#123", dark: "#abc" }`

Example chart config usage:
```tournament/components/ui/chart.tsx#L1-40
// Format: { THEME_NAME: CSS_SELECTOR }
const THEMES = { light: "", dark: ".dark" } as const

// color config may be either a plain color or:
// { color?: never; theme: Record<keyof typeof THEMES, string> }
```

So if you provide theme-specific colors in `variables.css`, charts and other components that read CSS variables can adapt automatically. Alternatively pass a per-theme color map when instantiating the component.

---

## Fonts

If a theme bundles custom fonts:
- Place them under `fonts/`.
- Use `@font-face` rules inside `variables.css` or a separate `fonts.css`.
- Set `--font-sans` / `--font-mono` to the primary font-family stack.

Example:
```tournament/themes/default/fonts/README#L1-10
/* store font files in this folder, then reference them from variables.css with @font-face */
```

---

## Preview images / screenshots

Include a `screenshots/` directory with images named:
- `preview.png` or `preview.jpg`
- `preview-dark.png` (optional)

Reference them from `theme.json` to show in any theme picker UI.

---

## Integration notes

- Loading CSS:
  - You can import a theme's `variables.css` in your global CSS pipeline (for example in `app/globals.css` or in a server layout) depending on how you implement dynamic theme switching.
  - For static builds, one approach is to include both light and dark variables in the global CSS and rely on the `.dark` selector to switch modes (this repository already uses `.dark` in some conventions).

- next-themes:
  - The project already includes `next-themes`. Use `useTheme()` to read the active theme or to change it programmatically.
  - Keep the theme keys consistent (e.g., `light`, `dark`) and in sync with any JS mappings.

- Accessibility:
  - Ensure sufficient contrast between `--color-background` and `--color-foreground`.
  - Test interactive elements (buttons, inputs, links) under both light and dark values.

---

## Checklist for adding a new theme

1. Create folder `tournament/themes/<slug>/`
2. Add a valid `theme.json` with `name` and `slug`.
3. Add `variables.css` defining the CSS custom properties.
4. Add `logo.svg` (or .png) and optional preview images.
5. Optionally add fonts and extra assets.
6. Validate visually in light and dark mode.

---

If you want, I can:
- Create a starter theme skeleton for you (e.g., `default`), or
- Generate a `variables.css` tuned to specific brand colors you provide.
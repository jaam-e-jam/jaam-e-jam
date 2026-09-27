# Jaamejam

An early interface prototype for a collaborative historical atlas. The map overlays in this branch are **fictional examples**, not historical claims.

## Run locally

Use Node.js 22 or later and pnpm.

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`. The MapLibre map fetches the supplied MapTiler vector style at runtime. An internet connection and permission to use the MapTiler key are required for the basemap and terrain.

## Prototype behavior

- A nonlinear timeline spans 10,000 BCE to 2026 CE. The long early period occupies less track width.
- `public/demo/time-index.json` maps ranges of years to shared GeoJSON snapshots. The browser fetches only the selected snapshot, and caches previously used ones.
- A small multilingual catalog supports search. Longer feature descriptions live in a separate file fetched when a feature is opened.
- The map can switch between flat Mercator and globe projections, turn on raised terrain, zoom, and show or hide feature layers.
- The interface can switch between English and Persian with a right-to-left layout. The site has one light color mode.

These JSON files demonstrate the loading pattern only. They are not the final format for contributions. We will design real historical entities and source requirements one type at a time after reviewing the UI.

## Static build and GitHub Pages

```bash
pnpm generate
```

The generated site is in `.output/public`. `.github/workflows/deploy.yml` deploys commits to `main` through GitHub Pages after the workflow is enabled in repository settings. By default, it builds for `/jaam-e-jam/` at the GitHub project URL. When `jaamejam.org` is connected as a custom domain, set the repository variable `PUBLIC_BASE_URL` to `/` and configure the domain in GitHub Pages and DNS. The prototype branch itself does not deploy.

## Licenses

Application code and interface: [PolyForm Shield License 1.0.0](LICENSE). Project-authored data: [CC BY 4.0](DATA-LICENSE.md), with attribution to **Jaamejam Contributors**. The externally provided MapTiler style, OpenStreetMap data, fonts, and dependencies are outside these grants.

See [CONTRIBUTING.md](CONTRIBUTING.md) for pull request expectations.

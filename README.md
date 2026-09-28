# Jaam-e Jam

Jaam-e Jam is a collaborative historical atlas built with Nuxt and MapLibre.

## Run locally

Use Node.js 22 or later and pnpm.

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`. The MapLibre map fetches the supplied MapTiler vector style at runtime. An internet connection and permission to use the MapTiler key are required for the basemap and terrain.

## Current behavior

- A nonlinear timeline spans 10,000 BCE to 2026 CE. The long early period occupies less track width.
- Contributors edit city YAML in `data/cities/`, polity YAML plus dated GeoJSON in `data/polities/`, and label-only regional names in `data/regional-names/`. `pnpm data:build` validates those files and writes the generated atlas to `public/atlas/`, which is ignored by Git.
- The [city data schema](docs/cities.md), [polity data schema](docs/polities.md), and [regional names schema](docs/regional-names.md) document fields, dates, names, geometry, citations, and the build process.
- The generated `time-index.json` maps ranges of years to shared GeoJSON snapshots. The browser fetches the selected snapshot and caches previously used ones. Descriptions are fetched separately when a feature is opened.
- Eleven sourced cities are included to start. Their names, points, display levels, and descriptions can change over time. Labels and descriptions support BCP 47 language tags; the current interface selects English (`en`) or Iranian Persian (`pes`).
- The Achaemenid Empire is the first polity. A few broad, sourced territorial shapes show major changes without implying precise ancient frontiers.
- Persis and Media are the first regional names. They are dated text labels with editorial anchor points, without provincial boundary geometry or detail cards.
- The map can switch between flat Mercator and globe projections, turn on raised terrain, zoom, and show or hide feature layers. The globe has a camera-aware backdrop made from NASA’s J2000 celestial star map. Rotating and tilting the globe changes the visible stars. The sky uses a fixed reference Earth orientation; it does not reconstruct the sky for the selected historical year.
- The interface can switch between English and Persian with a right-to-left layout. The site has one light color mode.

The 8K star image (with a 4K fallback for smaller GPU texture limits) is NASA Goddard Space Flight Center Scientific Visualization Studio’s [Deep Star Maps](https://svs.gsfc.nasa.gov/3895/); it is third-party imagery, not project-authored CC BY data.

Routes and events remain future data types.

## Static build and GitHub Pages

```bash
pnpm generate
```

The generated site is in `.output/public`. `.github/workflows/check.yml` typechecks and generates pull requests; `.github/workflows/deploy.yml` publishes commits to `main` through GitHub Pages. The repository variable `PUBLIC_BASE_URL` controls the asset prefix; it is `/` for `jaamejam.org`.

## Licenses

Application code and interface: [PolyForm Shield License 1.0.0](LICENSE). Project-authored data: [CC BY 4.0](DATA-LICENSE.md), with attribution to **Jaamejam Contributors**. The externally provided MapTiler style, OpenStreetMap data, fonts, and dependencies are outside these grants.

See [CONTRIBUTING.md](CONTRIBUTING.md) for pull request expectations.

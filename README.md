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
- Contributors edit `data/cities/<id>.yaml`. `pnpm data:build` validates those files and writes the generated atlas to `public/atlas/`, which is ignored by Git.
- The [city data schema](docs/cities.md) documents fields, dates, names, levels, citations, and the build process.
- The generated `time-index.json` maps ranges of years to shared GeoJSON snapshots. The browser fetches the selected snapshot and caches previously used ones. Each city description is fetched separately when opened.
- Eleven sourced cities are included to start. Their names, points, display levels, and descriptions can change over time. Labels and descriptions support BCP 47 language tags; the current interface selects English (`en`) or Iranian Persian (`pes`).
- The map can switch between flat Mercator and globe projections, turn on raised terrain, zoom, and show or hide feature layers. The globe has a camera-aware backdrop made from NASA’s J2000 celestial star map. Rotating and tilting the globe changes the visible stars. The sky uses a fixed reference Earth orientation; it does not reconstruct the sky for the selected historical year.
- The interface can switch between English and Persian with a right-to-left layout. The site has one light color mode.

The 8K star image (with a 4K fallback for smaller GPU texture limits) is NASA Goddard Space Flight Center Scientific Visualization Studio’s [Deep Star Maps](https://svs.gsfc.nasa.gov/3895/); it is third-party imagery, not project-authored CC BY data.

City records are the first historical data type. The other layer controls remain available for future polities, routes, and events.

## Static build and GitHub Pages

```bash
pnpm generate
```

The generated site is in `.output/public`. `.github/workflows/check.yml` typechecks and generates pull requests; `.github/workflows/deploy.yml` publishes commits to `main` through GitHub Pages. The repository variable `PUBLIC_BASE_URL` controls the asset prefix; it is `/` for `jaamejam.org`.

## Licenses

Application code and interface: [PolyForm Shield License 1.0.0](LICENSE). Project-authored data: [CC BY 4.0](DATA-LICENSE.md), with attribution to **Jaamejam Contributors**. The externally provided MapTiler style, OpenStreetMap data, fonts, and dependencies are outside these grants.

See [CONTRIBUTING.md](CONTRIBUTING.md) for pull request expectations.

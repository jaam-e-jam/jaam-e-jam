# Jaamejam agent guidance

City contributions belong in `data/cities/<id>.yaml`; read the [city data schema](docs/cities.md) before editing. The `public/atlas/` directory is generated at build time; do not edit it by hand. Other historical entity schemas are still to be designed.

Before proposing a factual change, read `CONTRIBUTING.md` and provide specific sources, dates, uncertainty, and geometry provenance. A human contributor must verify agent-proposed claims and citations. Do not add unsourced historical facts or import third-party map data into the repository without checking its license.

Keep code changes focused. Run `pnpm typecheck` and `pnpm generate` before requesting review. Preserve the two-license split: PolyForm Shield 1.0.0 for application code and CC BY 4.0 for project-authored data attributed to Jaamejam Contributors.

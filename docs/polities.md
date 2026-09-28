# Polity data

Contributors edit one YAML record at `data/polities/<id>.yaml` and one or more GeoJSON geometry files in `data/polities/geometry/`. The filename is the stable ID; the directory supplies the entity type. Do not repeat `id` or `kind` in the YAML. [`achaemenid-empire.yaml`](../data/polities/achaemenid-empire.yaml) is the first example.

This format represents a polity with one broad, evolving territory. It does not divide the Achaemenid Empire into satrapies or use a status category for tributaries and vassals. [Regional names](regional-names.md) can label satrapies or provinces without adding their borders. A border version is a generalized map depiction for an interval, not a claim that every line stayed fixed throughout it.

## YAML fields

| Key | Entry fields | Meaning |
| --- | --- | --- |
| `labels` | `from`, `to`, `text`, optional `search`, `sources` | Name shown on the map and alternative search terms. |
| `borders` | `from`, `to`, `file`, `note`, `sources` | Dated territorial shape. The record appears on the map only while a border applies. |
| `descriptions` | `from`, `to`, `markdown`, `sources` | Short text for the detail card at the selected year. |
| `label_point` | `[longitude, latitude]` | Optional editorial anchor for one map label; it is not a capital or a border claim. |
| `sources` | citation IDs mapped to citation strings | Bibliography shared by dated entries. |

Each section must be a nonempty list. Entries within the same section cannot overlap. For every year covered by a border, a label and description must also apply. Labels, descriptions, and borders can change on different dates. Gaps between border periods hide the polity during those years.

Dates are quoted strings such as `"539 BCE"` and `"226 CE"`, with inclusive endpoints; `present` means the timeline endpoint, currently **2026 CE**. There is no year zero in contributor dates. The accepted timeline runs from 10,000 BCE through 2026 CE. Choose display dates that reasonably summarize the evidence, and state uncertainty in `borders[].note` or the description.

`labels[].text` and `descriptions[].markdown` use [BCP 47 language tags](https://www.rfc-editor.org/info/bcp47/). Both currently require `en` and `pes`; additional tags are welcome. `labels[].search` maps language tags to lists of alternate names. The app displays English or Persian names according to its current language setting and searches all names and aliases for the selected year.

If a map label is wanted, place `label_point` inside the territory for all its periods. It stays fixed as the border changes and has no historical meaning of its own. Omit it when no single placement works.

## Geometry and evidence

`borders[].file` is a path such as `geometry/achaemenid-height.geojson`, relative to `data/polities/`. A file contains a **GeoJSON geometry object**, of type `Polygon` or `MultiPolygon`, with longitude then latitude coordinates. It is not a Feature or FeatureCollection. A single file can be reused in more than one interval when the same generalized outline is adequate. The builder creates shared, dated map snapshots and a small time index; it does not create map tiles or a separate copy for every year.

Keep the outline as broad as the evidence warrants. Do not trace modern borders or present speculative ancient frontiers as measured lines. In each `borders[].note`, describe the evidence, the drawing method, important omissions, and any approximate date boundary. Attach relevant source IDs to that specific border version. If third-party geometry was used, identify its origin and reuse license. The Achaemenid example's historical footprints were drawn for this project and clipped to public-domain Natural Earth land polygons for a coarse coastline. They are **not** digitized from a historical map.

For reproducibility, the Natural Earth GeoJSON used for that example had SHA-256 `9e0729ee253ca7d7a5c4ae9395fb1902264c5377c52e224d13dd85010e2835d9`. The source citation and its public-domain license are in the Achaemenid record.

Each `labels`, `borders`, and `descriptions` entry needs at least one `sources` ID. Bibliography IDs use lowercase hyphenated names, for example `met` or `natural-earth`. The build validates references, paths, coordinates, and ring closure, but it cannot establish historical accuracy or full topological validity. Reviewers must examine the drawing and sources. The detail card shows the active description and its citations, together with citations for the active border; the editorial `note` stays in source data.

## Build and review

Run `pnpm data:build` after changing the YAML or GeoJSON while the dev server is running, then refresh the browser. `pnpm dev` and `pnpm generate` run the builder on startup. Generated files under `public/atlas/` are ignored by Git; commit the YAML and GeoJSON source files instead.

In a pull request, name the changed intervals, explain why their shapes differ, and link evidence for the represented extent. Have a human check agent-proposed coordinates, historical claims, citations, and license compatibility. Project-authored data is [CC BY 4.0](../DATA-LICENSE.md) with attribution to Jaamejam Contributors.

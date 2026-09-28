# Regional names

Regional names are dated text labels anchored to a point on the map. They can identify a province, satrapy, cultural region, or other named area without drawing or claiming a border. Contributors edit one YAML file per label at `data/regional-names/<id>.yaml`. The filename is the stable ID; do not repeat it or a `kind` field in the file. [`achaemenid-persis.yaml`](../data/regional-names/achaemenid-persis.yaml) is an example.

```yaml
level: 2

labels:
  - from: "522 BCE"
    to: "330 BCE"
    text: { en: Persis, pes: پارس }
    point: [53.5, 29.8]
    note: "Editorial label anchor in present-day Fars, not a capital or boundary."
    sources: [iranica-satrapies]

sources:
  iranica-satrapies: "Bruno Jacobs, [Achaemenid Satrapies](https://www.iranicaonline.org/articles/achaemenid-satrapies/), Encyclopaedia Iranica."
```

The required top-level `level` is 1, 2, or 3. Level 1 is for broad regions, level 2 for provinces or satrapies, and level 3 for local regions. The app defines the zoom bands globally: level 1 appears at zoom **[1.5, 4)**, level 2 at **[4, 7)**, and level 3 at **[7, 16)**. The lower bound is included and the upper bound excluded, so changing zoom replaces one level with the next. Contributors choose a level, not custom zoom thresholds. The map currently permits zoom through 15.

Each `labels` entry needs `from`, `to`, `text`, `point`, and at least one `sources` ID. `note` and `search` are optional. Use `note` to explain the anchor or dating when they may be misunderstood. `search` has the same language-tagged list format as [city labels](cities.md#names-and-languages). The `sources` mapping holds citations used by the entries. Names and anchors may change by period; entries must not overlap, and gaps hide the label. There is no separate presence, shape, or description section.

Dates are quoted strings such as `"522 BCE"` and `"330 BCE"`, with inclusive endpoints. `present` means the timeline endpoint, currently **2026 CE**. There is no year zero. Display intervals summarize evidence; they need not assert an exact administrative start or end date. `text` uses [BCP 47 language tags](https://www.rfc-editor.org/info/bcp47/); `en` and `pes` are currently required for the two interface languages. `point` is `[longitude, latitude]` in decimal degrees. It only positions the text and does not mark a capital, centre of rule, or boundary.

The builder checks dates, level, language tags, source references, point coordinates, and nonoverlapping intervals. It compiles active labels into the shared dated GeoJSON snapshots. The map shows only the level for the current zoom band, with a shared switch in the Layers menu. Searching a regional name centres the map on its label at a zoom where its level is visible; these labels have no detail card. Run `pnpm data:build` after editing while the dev server is running, then refresh. `pnpm dev` and `pnpm generate` build data automatically. Commit the YAML source, not generated files under `public/atlas/`.

For review, cite the name and its period, explain why the point is suitable, and flag disputed identities or dating. Human reviewers must check agent-proposed historical claims and coordinates. Project-authored data is [CC BY 4.0](../DATA-LICENSE.md) with attribution to Jaamejam Contributors.

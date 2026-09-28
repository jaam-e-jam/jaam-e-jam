# City data

Contributors edit one YAML file per city at `data/cities/<id>.yaml`. The filename supplies the stable ID, and the `cities` directory supplies the entity type. Do not put `id` or `kind` inside the file. Existing records such as [`ctesiphon.yaml`](../data/cities/ctesiphon.yaml) and [`persepolis.yaml`](../data/cities/persepolis.yaml) are working examples.

This document describes the city format accepted by [`scripts/build-atlas-data.mjs`](../scripts/build-atlas-data.mjs) and displayed by the current map. [Polities](polities.md) and [regional names](regional-names.md) have separate formats; roads and events have not yet been defined.

## File shape

A city file has exactly these top-level keys. Every dated section is a nonempty list.

| Key | Entry fields | Meaning |
| --- | --- | --- |
| `presence` | `from`, `to`, `sources` | Years in which the settlement appears on the map. Multiple disjoint intervals are allowed. These are display intervals supported by evidence, not exact founding or abandonment dates. |
| `labels` | `from`, `to`, `text`, optional `search`, `sources` | Names shown on the map and alternative search terms for each period. |
| `locations` | `from`, `to`, `point`, `sources` | One representative point for each period, as `[longitude, latitude]` in decimal degrees. It can move when the supported location changes. It is not a city boundary. |
| `levels` | `from`, `to`, `value` | Editorial map prominence from 1 to 5. It changes circle size and the zoom at which the name appears. It is not a population estimate or a formal political status. |
| `descriptions` | `from`, `to`, `markdown`, `sources` | Short text for the city detail card at the selected year. |
| `sources` | citation IDs mapped to citation strings | Bibliography shared by the dated entries in this file. |

For every year in `presence`, a label, location, level, and description must also apply. Entries in the same section may not overlap. Sections can have different boundaries: changing a name does not require duplicating an unchanged point or description. A gap in `presence` hides the city during that interval, even if another section spans the gap.

### Dates

Write dates as quoted strings such as `"140 BCE"` and `"226 CE"`. The range endpoints are inclusive. Use `present` as an end date for a city still displayed through the current timeline endpoint, **2026 CE**. There is no year zero in contributor dates. The accepted timeline runs from 10,000 BCE through 2026 CE.

Dates are editorial boundaries for map display. Do not imply that a poorly dated historical change happened on a precise year just because the format requires one. Choose a defensible interval, explain the uncertainty in the description, and cite the evidence in the relevant entries. Ctesiphon, for example, has a smaller garrison stage and a later capital stage; its description explicitly says the exact transition is uncertain.

### Names and languages

`labels[].text` maps [BCP 47 language tags](https://www.rfc-editor.org/info/bcp47/) to nonempty strings. Each label period currently needs at least `en` and `pes` (Iranian Persian), because those are the two interface languages. Other valid tags can be added, such as `grc`, `la`, `peo-Latn`, or `zh-Hans`. The app currently displays `en` in English mode and `pes` in Persian mode. Historical-language names remain in the record even when the interface cannot yet select those languages.

`labels[].search` is optional. It maps language tags to nonempty lists of alternate spellings or names. Search terms are not displayed as map labels. The current search looks at all names and aliases for the selected year, regardless of the interface language. To make an older name findable at a later date, include it in that later label period's `search` list.

### Points and levels

`locations[].point` uses longitude first, latitude second. Longitude must be between -180 and 180; latitude between -90 and 90. Cite the source for the coordinate and explain when it represents a broad archaeological area rather than a known city centre. Ctesiphon's point represents the wider site; its earlier Parthian garrison has not been pinpointed.

All five levels draw a point. Higher levels draw larger circles and reveal their labels at a wider view. The current label thresholds are styling choices and may change:

| Level | Label visible from map zoom |
| --- | ---: |
| 1 | 8 |
| 2 | 7 |
| 3 | 5.5 |
| 4 | 4 |
| 5 | 2.5 |

Use a period change in `levels` to show an editorial change in prominence. Describe the historical change in `descriptions`; level alone does not explain it.

### Descriptions and citations

`descriptions[].markdown` maps language tags to short Markdown strings. Like labels, each period currently needs `en` and `pes`. Ordinary Markdown and links render in the detail card; raw HTML is escaped. The card shows the citations listed in the active description's `sources`. Sources for presence, labels, and locations remain in the YAML for review even when they are not separately shown in the card.

Give each bibliography entry a lowercase, hyphenated ID such as `met` or `site-survey`. A dated `sources` list refers to those IDs and must contain at least one. The build checks that references exist; contributors and reviewers must still verify the actual claims, page references or links, geometry provenance, and reuse rights. `levels` are editorial display settings and currently do not require source references.

## Build and review

Run `pnpm data:build` after changing a YAML file while the dev server is already running, then refresh the browser. `pnpm dev` and `pnpm generate` run the data build automatically when they start. The builder validates the YAML and writes `public/atlas/time-index.json`, shared dated GeoJSON files in `public/atlas/maps/`, and separately fetched descriptions in `public/atlas/details/`. Generated files are ignored by Git; commit the YAML source file instead.

For a pull request, identify the periods and claims changed, link the supporting sources, and explain any disagreement or uncertainty. The project-authored data is [CC BY 4.0](../DATA-LICENSE.md) with attribution to Jaamejam Contributors. Check third-party material's terms before contributing it.

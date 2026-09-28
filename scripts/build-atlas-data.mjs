import { createHash } from 'node:crypto'
import { readFile, readdir, mkdir, rm, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { parseDocument } from 'yaml'

const root = fileURLToPath(new URL('../', import.meta.url))
const cityDir = join(root, 'data/cities')
const polityDir = join(root, 'data/polities')
const regionalNameDir = join(root, 'data/regional-names')
const outputDir = join(root, 'public/atlas')
const firstYear = -10000
const lastYear = 2026
const citySections = ['presence', 'labels', 'locations', 'levels', 'descriptions']
const politySections = ['labels', 'borders', 'descriptions']

function fail(id, message) { throw new Error(`${id}: ${message}`) }

function year(value, id) {
  if (value === 'present') return lastYear
  const match = typeof value === 'string' && /^(\d{1,5}) (BCE|CE)$/.exec(value)
  if (!match || Number(match[1]) === 0) fail(id, `invalid year ${JSON.stringify(value)}; use "500 BCE", "1 CE", or present`)
  const result = Number(match[1]) * (match[2] === 'BCE' ? -1 : 1)
  if (result < firstYear || result > lastYear) fail(id, `year ${value} is outside the timeline`)
  return result
}

function validateSources(record, ids, id, section) {
  if (!Array.isArray(ids) || !ids.length) fail(id, `${section} needs at least one source`)
  for (const ref of ids) if (typeof record.sources[ref] !== 'string') fail(id, `${section} references missing source ${ref}`)
}

function validPoint(point) {
  return Array.isArray(point) && point.length === 2 && point.every(Number.isFinite) && Math.abs(point[0]) <= 180 && Math.abs(point[1]) <= 90
}

function parseRecord(contents, id, sections, extraKeys = []) {
  const document = parseDocument(contents, { uniqueKeys: true })
  if (document.errors.length) fail(id, document.errors.map(error => error.message).join('; '))
  const record = document.toJS()
  if (!record || typeof record !== 'object' || Array.isArray(record)) fail(id, 'root must be an object')
  for (const key of Object.keys(record)) if (!sections.includes(key) && !extraKeys.includes(key) && key !== 'sources') fail(id, `unknown field ${key}`)
  if (!record.sources || typeof record.sources !== 'object' || Array.isArray(record.sources)) fail(id, 'sources must be a bibliography keyed by citation ID')
  for (const [key, citation] of Object.entries(record.sources)) if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(key) || typeof citation !== 'string' || !citation.trim()) fail(id, `invalid source ${key}`)
  return record
}

function validatePeriods(record, id, section) {
  const entries = record[section]
  if (!Array.isArray(entries) || !entries.length) fail(id, `${section} must be a nonempty list`)
  const periods = entries.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) fail(id, `${section}[${index}] must be an object`)
    const from = year(entry.from, id)
    const to = year(entry.to, id)
    if (from > to) fail(id, `${section}[${index}] ends before it begins`)
    if (section !== 'levels') validateSources(record, entry.sources, id, `${section}[${index}]`)
    if (section === 'labels' || section === 'descriptions') {
      const values = section === 'labels' ? entry.text : entry.markdown
      if (!values || typeof values !== 'object' || Array.isArray(values)) fail(id, `${section}[${index}] needs language-tagged text`)
      for (const tag of ['en', 'pes']) if (typeof values[tag] !== 'string' || !values[tag].trim()) fail(id, `${section}[${index}] needs ${tag} text`)
      for (const tag of Object.keys(values)) {
        try { Intl.getCanonicalLocales(tag) }
        catch { fail(id, `${section}[${index}] has invalid language tag ${tag}`) }
        if (typeof values[tag] !== 'string' || !values[tag].trim()) fail(id, `${section}[${index}] has empty ${tag} text`)
      }
      if (section === 'labels' && entry.search !== undefined) {
        if (!entry.search || typeof entry.search !== 'object' || Array.isArray(entry.search)) fail(id, `${section}[${index}] search terms must be language-tagged lists`)
        for (const [tag, terms] of Object.entries(entry.search)) {
          try { Intl.getCanonicalLocales(tag) }
          catch { fail(id, `${section}[${index}] has invalid search language tag ${tag}`) }
          if (!Array.isArray(terms) || !terms.length || terms.some(term => typeof term !== 'string' || !term.trim())) fail(id, `${section}[${index}] has invalid ${tag} search terms`)
        }
      }
    }
    if (section === 'locations') {
      if (!validPoint(entry.point)) fail(id, `${section}[${index}] needs a [longitude, latitude] point`)
    }
    if (section === 'borders') {
      if (typeof entry.file !== 'string' || !/^geometry\/[a-z0-9]+(?:-[a-z0-9]+)*\.geojson$/.test(entry.file)) fail(id, `${section}[${index}] needs a geometry/<name>.geojson file`)
      if (typeof entry.note !== 'string' || !entry.note.trim()) fail(id, `${section}[${index}] needs a geometry provenance and uncertainty note`)
    }
    if (section === 'levels' && (!Number.isInteger(entry.value) || entry.value < 1 || entry.value > 5)) fail(id, `${section}[${index}] needs a level from 1 to 5`)
    return { ...entry, fromYear: from, toYear: to }
  }).sort((a, b) => a.fromYear - b.fromYear)
  for (let i = 1; i < periods.length; i++) if (periods[i].fromYear <= periods[i - 1].toYear) fail(id, `${section} periods overlap`)
  return periods
}

function validateGeometry(geometry, id, file) {
  if (!geometry || typeof geometry !== 'object' || !['Polygon', 'MultiPolygon'].includes(geometry.type)) fail(id, `${file} must contain a GeoJSON Polygon or MultiPolygon geometry`)
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  if (!Array.isArray(polygons) || !polygons.length) fail(id, `${file} has no polygons`)
  for (const polygon of polygons) {
    if (!Array.isArray(polygon) || !polygon.length) fail(id, `${file} has an empty polygon`)
    for (const ring of polygon) {
      if (!Array.isArray(ring) || ring.length < 4) fail(id, `${file} has a ring with fewer than four positions`)
      for (const point of ring) {
        if (!Array.isArray(point) || point.length !== 2 || !point.every(Number.isFinite) || Math.abs(point[0]) > 180 || Math.abs(point[1]) > 90) fail(id, `${file} has an invalid [longitude, latitude] position`)
      }
      if (ring[0][0] !== ring.at(-1)[0] || ring[0][1] !== ring.at(-1)[1]) fail(id, `${file} has an unclosed ring`)
    }
  }
  return geometry
}

async function loadRecords(directory, sections, cuts, extraKeys = []) {
  const files = (await readdir(directory)).filter(file => file.endsWith('.yaml')).sort()
  const records = []
  for (const file of files) {
    const id = file.slice(0, -5)
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) fail(file, 'filename must be a lowercase hyphenated ID')
    const record = parseRecord(await readFile(join(directory, file), 'utf8'), id, sections, extraKeys)
    if (record.label_point !== undefined && !validPoint(record.label_point)) fail(id, 'label_point needs a [longitude, latitude] point')
    const periods = Object.fromEntries(sections.map(section => [section, validatePeriods(record, id, section)]))
    for (const section of sections) for (const period of periods[section]) {
      cuts.add(period.fromYear)
      cuts.add(period.toYear + 1)
    }
    records.push({ id, periods, labelPoint: record.label_point, sources: record.sources })
  }
  return records
}

function activeAt(periods, selectedYear) {
  return periods.find(period => period.fromYear <= selectedYear && selectedYear <= period.toYear)
}

async function main() {
  const cuts = new Set([firstYear, lastYear + 1])
  const cities = await loadRecords(cityDir, citySections, cuts)
  if (!cities.length) throw new Error('No city YAML files found')
  const polities = await loadRecords(polityDir, politySections, cuts, ['label_point'])
  const regionalNames = await loadRecords(regionalNameDir, ['labels'], cuts)
  const ids = new Set(cities.map(city => city.id))
  for (const polity of polities) {
    if (ids.has(polity.id)) fail(polity.id, 'ID is already used by a city')
    ids.add(polity.id)
    for (const border of polity.periods.borders) {
      let contents
      try { contents = await readFile(join(polityDir, border.file), 'utf8') }
      catch { fail(polity.id, `cannot read ${border.file}`) }
      let geometry
      try { geometry = JSON.parse(contents) }
      catch { fail(polity.id, `${border.file} is not valid JSON`) }
      border.geometry = validateGeometry(geometry, polity.id, border.file)
    }
  }
  for (const region of regionalNames) {
    if (ids.has(region.id)) fail(region.id, 'ID is already used by another atlas record')
    ids.add(region.id)
    region.periods.labels.forEach((label, index) => {
      if (!validPoint(label.point)) fail(region.id, `labels[${index}] needs a [longitude, latitude] point`)
      if (label.note !== undefined && (typeof label.note !== 'string' || !label.note.trim())) fail(region.id, `labels[${index}] has an empty note`)
    })
  }

  const boundaries = [...cuts].filter(value => value >= firstYear && value <= lastYear + 1).sort((a, b) => a - b)
  // Reject incomplete periods before replacing the currently generated atlas.
  for (const from of boundaries.slice(0, -1)) {
    for (const city of cities) {
      if (!activeAt(city.periods.presence, from)) continue
      if (!['labels', 'locations', 'levels', 'descriptions'].every(section => activeAt(city.periods[section], from))) fail(city.id, `missing labels, location, level, or description at ${from}`)
    }
    for (const polity of polities) {
      if (!activeAt(polity.periods.borders, from)) continue
      if (!activeAt(polity.periods.labels, from) || !activeAt(polity.periods.descriptions, from)) fail(polity.id, `missing label or description at ${from}`)
    }
  }

  await rm(outputDir, { recursive: true, force: true })
  await mkdir(join(outputDir, 'maps'), { recursive: true })
  await mkdir(join(outputDir, 'details'), { recursive: true })
  for (const entity of [...cities, ...polities]) {
    const detail = {
      descriptions: entity.periods.descriptions.map(({ fromYear, toYear, markdown, sources }) => ({ from: fromYear, to: toYear, markdown, sources })),
      ...(entity.periods.borders ? { borders: entity.periods.borders.map(({ fromYear, toYear, note, sources }) => ({ from: fromYear, to: toYear, note, sources })) } : {}),
      sources: entity.sources
    }
    await writeFile(join(outputDir, 'details', `${entity.id}.json`), JSON.stringify(detail))
  }

  const snapshots = []
  const written = new Set()
  for (let i = 0; i < boundaries.length - 1; i++) {
    const from = boundaries[i]
    const to = boundaries[i + 1] - 1
    const features = []
    for (const city of cities) {
      if (!activeAt(city.periods.presence, from)) continue
      const label = activeAt(city.periods.labels, from)
      const location = activeAt(city.periods.locations, from)
      const level = activeAt(city.periods.levels, from)
      const names = Object.fromEntries(Object.entries(label.text).map(([tag, value]) => [`name_${tag}`, value]))
      const search = [...Object.values(label.text), ...Object.values(label.search || {}).flat()]
      features.push({
        type: 'Feature',
        properties: { id: city.id, kind: 'settlement', level: level.value, name: label.text.en, search: search.join(' '), ...names },
        geometry: { type: 'Point', coordinates: location.point }
      })
    }
    for (const polity of polities) {
      const border = activeAt(polity.periods.borders, from)
      if (!border) continue
      const label = activeAt(polity.periods.labels, from)
      const names = Object.fromEntries(Object.entries(label.text).map(([tag, value]) => [`name_${tag}`, value]))
      const search = [...Object.values(label.text), ...Object.values(label.search || {}).flat()]
      features.push({
        type: 'Feature',
        properties: { id: polity.id, kind: 'region', name: label.text.en, search: search.join(' '), ...names },
        geometry: border.geometry
      })
      if (polity.labelPoint) features.push({
        type: 'Feature',
        properties: { id: polity.id, kind: 'region', name: label.text.en, ...names },
        geometry: { type: 'Point', coordinates: polity.labelPoint }
      })
    }
    for (const region of regionalNames) {
      const label = activeAt(region.periods.labels, from)
      if (!label) continue
      const names = Object.fromEntries(Object.entries(label.text).map(([tag, value]) => [`name_${tag}`, value]))
      const search = [...Object.values(label.text), ...Object.values(label.search || {}).flat()]
      features.push({
        type: 'Feature',
        properties: { id: region.id, kind: 'regional-name', name: label.text.en, search: search.join(' '), ...names },
        geometry: { type: 'Point', coordinates: label.point }
      })
    }
    const collection = { type: 'FeatureCollection', features }
    const json = JSON.stringify(collection)
    const hash = createHash('sha256').update(json).digest('hex').slice(0, 12)
    const file = `atlas/maps/${hash}.geojson`
    if (!written.has(hash)) {
      await writeFile(join(outputDir, 'maps', `${hash}.geojson`), json)
      written.add(hash)
    }
    const last = snapshots.at(-1)
    if (last?.file === file && last.to + 1 === from) last.to = to
    else snapshots.push({ from, to, file })
  }
  await writeFile(join(outputDir, 'time-index.json'), JSON.stringify({ snapshots }))
  console.log(`Built ${cities.length} cities, ${polities.length} polities, and ${regionalNames.length} regional names, ${snapshots.length} dated map intervals, ${written.size} GeoJSON files`)
}

main().catch(error => { console.error(error); process.exitCode = 1 })

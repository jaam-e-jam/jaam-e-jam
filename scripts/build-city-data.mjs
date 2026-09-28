import { createHash } from 'node:crypto'
import { readFile, readdir, mkdir, rm, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { parseDocument } from 'yaml'

const root = fileURLToPath(new URL('../', import.meta.url))
const dataDir = join(root, 'data/cities')
const outputDir = join(root, 'public/atlas')
const firstYear = -10000
const lastYear = 2026
const sections = ['presence', 'labels', 'locations', 'levels', 'descriptions']

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
      const point = entry.point
      if (!Array.isArray(point) || point.length !== 2 || !point.every(Number.isFinite) || Math.abs(point[0]) > 180 || Math.abs(point[1]) > 90) fail(id, `${section}[${index}] needs a [longitude, latitude] point`)
    }
    if (section === 'levels' && (!Number.isInteger(entry.value) || entry.value < 1 || entry.value > 5)) fail(id, `${section}[${index}] needs a level from 1 to 5`)
    return { ...entry, fromYear: from, toYear: to }
  }).sort((a, b) => a.fromYear - b.fromYear)
  for (let i = 1; i < periods.length; i++) if (periods[i].fromYear <= periods[i - 1].toYear) fail(id, `${section} periods overlap`)
  return periods
}

function activeAt(periods, selectedYear) {
  return periods.find(period => period.fromYear <= selectedYear && selectedYear <= period.toYear)
}

async function main() {
  const files = (await readdir(dataDir)).filter(file => file.endsWith('.yaml')).sort()
  if (!files.length) throw new Error('No city YAML files found')
  const cities = []
  const cuts = new Set([firstYear, lastYear + 1])
  for (const file of files) {
    const id = file.slice(0, -5)
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) fail(file, 'filename must be a lowercase hyphenated ID')
    const document = parseDocument(await readFile(join(dataDir, file), 'utf8'), { uniqueKeys: true })
    if (document.errors.length) fail(id, document.errors.map(error => error.message).join('; '))
    const record = document.toJS()
    if (!record || typeof record !== 'object' || Array.isArray(record)) fail(id, 'root must be an object')
    for (const key of Object.keys(record)) if (!sections.includes(key) && key !== 'sources') fail(id, `unknown field ${key}`)
    if (!record.sources || typeof record.sources !== 'object' || Array.isArray(record.sources)) fail(id, 'sources must be a bibliography keyed by citation ID')
    for (const [key, citation] of Object.entries(record.sources)) if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(key) || typeof citation !== 'string' || !citation.trim()) fail(id, `invalid source ${key}`)
    const periods = Object.fromEntries(sections.map(section => [section, validatePeriods(record, id, section)]))
    for (const section of sections) for (const period of periods[section]) {
      cuts.add(period.fromYear)
      cuts.add(period.toYear + 1)
    }
    cities.push({ id, periods, sources: record.sources })
  }

  await rm(outputDir, { recursive: true, force: true })
  await mkdir(join(outputDir, 'maps'), { recursive: true })
  await mkdir(join(outputDir, 'details'), { recursive: true })
  for (const city of cities) {
    const detail = {
      descriptions: city.periods.descriptions.map(({ fromYear, toYear, markdown, sources }) => ({ from: fromYear, to: toYear, markdown, sources })),
      sources: city.sources
    }
    await writeFile(join(outputDir, 'details', `${city.id}.json`), JSON.stringify(detail))
  }

  const boundaries = [...cuts].filter(value => value >= firstYear && value <= lastYear + 1).sort((a, b) => a - b)
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
      const description = activeAt(city.periods.descriptions, from)
      if (!label || !location || !level || !description) fail(city.id, `missing labels, location, level, or description at ${from}`)
      const names = Object.fromEntries(Object.entries(label.text).map(([tag, value]) => [`name_${tag}`, value]))
      const search = [...Object.values(label.text), ...Object.values(label.search || {}).flat()]
      features.push({
        type: 'Feature',
        properties: { id: city.id, kind: 'settlement', level: level.value, name: label.text.en, search: search.join(' '), ...names },
        geometry: { type: 'Point', coordinates: location.point }
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
  console.log(`Built ${cities.length} cities, ${snapshots.length} dated map intervals, ${written.size} GeoJSON files`)
}

main().catch(error => { console.error(error); process.exitCode = 1 })

<script setup lang="ts">
import type { Map as MapLibreMap, GeoJSONSource } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'

interface AtlasFeature {
  type: 'Feature'
  properties: { id: string; kind: 'region' | 'settlement' | 'route' | 'event'; name: string }
  geometry: { type: string; coordinates: unknown }
}
interface AtlasCollection { type: 'FeatureCollection'; features: AtlasFeature[] }
interface Snapshot { from: number; to: number; file: string }
interface Detail { kind: string; name: Record<'en' | 'fa', string>; subtitle: Record<'en' | 'fa', string>; body: Record<'en' | 'fa', string> }

const languages = [
  { code: 'en', label: 'English' },
  { code: 'fa', label: 'فارسی' }
] as const
const language = ref<(typeof languages)[number]['code']>('en')
const languageItems = computed(() => languages.map(({ code, label }) => ({
  label,
  icon: language.value === code ? 'i-lucide-check' : undefined,
  onSelect: () => { language.value = code }
})))
const year = ref(-500)
const search = ref('')
const searchOpen = ref(false)
const layersOpen = ref(false)
const aboutOpen = ref(false)
const selectedId = ref<string | null>(null)
const isGlobe = ref(false)
const terrainOn = ref(false)
const playing = ref(false)
const mapReady = ref(false)
const mapError = ref('')
const currentFeatures = ref<AtlasFeature[]>([])
const visible = reactive({ region: true, settlement: true, route: true, event: true })
const mapElement = ref<HTMLElement | null>(null)
const snapshots = ref<Snapshot[]>([])
const detail = ref<Record<string, Detail> | null>(null)
const catalog = ref<Record<string, Record<'en' | 'fa', string>>>({})
const currentFile = ref('')
const contributionUrl = 'https://github.com/jaam-e-jam/jaam-e-jam/issues/new'
const terrainExaggeration = 10
const terrainPitch = 60
const base = useRuntimeConfig().app.baseURL || '/'
const asset = (path: string) => `${base.endsWith('/') ? base : `${base}/`}${path}`
let map: MapLibreMap | null = null
let playback: ReturnType<typeof setInterval> | null = null
let requestVersion = 0
const cache = new Map<string, AtlasCollection>()

const copy = {
  en: {
    atlas: 'A collaborative historical atlas', explore: 'Explore the world through time',
    search: 'Search the map', layers: 'Layers', language: 'Language', terrain: 'Terrain', flat: '2D map', globe: '3D globe',
    settlements: 'Settlements', regions: 'Regions & polities', routes: 'Routes', events: 'Events',
    browse: 'Browse time', year: 'Year', prehistory: 'Prehistory', classical: 'Classical', middleAges: 'Middle Ages', earlyModern: 'Early modern', modern: 'Modern',
    about: 'About this atlas', contribute: 'Contribute', details: 'Details',
    infoTitle: 'A map built together', infoBody: 'Jaam-e Jam is a collaborative historical atlas. Explore places, polities, routes, and events across time, and contribute through GitHub.',
    close: 'Close', noResults: 'No matching features at this date', mapLoading: 'Loading map…', mapUnavailable: 'Map could not load. Check your connection or MapTiler access.',
    start: 'Start timeline', pause: 'Pause timeline', earlier: 'Earlier', later: 'Later', today: 'Today'
  },
  fa: {
    atlas: 'اطلس تاریخی مشارکتی', explore: 'جهان را در گذر زمان ببینید',
    search: 'جستجو در نقشه', layers: 'لایه‌ها', language: 'زبان', terrain: 'پستی‌وبلندی', flat: 'نقشهٔ دوبعدی', globe: 'کرهٔ سه‌بعدی',
    settlements: 'سکونتگاه‌ها', regions: 'سرزمین‌ها و حکومت‌ها', routes: 'مسیرها', events: 'رویدادها',
    browse: 'پیمایش زمان', year: 'سال', prehistory: 'پیشاتاریخ', classical: 'دوران کلاسیک', middleAges: 'قرون وسطی', earlyModern: 'اوایل دوران مدرن', modern: 'دوران مدرن',
    about: 'دربارهٔ اطلس', contribute: 'مشارکت', details: 'جزئیات',
    infoTitle: 'نقشه‌ای که با هم می‌سازیم', infoBody: 'جام جم اطلسی تاریخی و مشارکتی است. مکان‌ها، حکومت‌ها، مسیرها و رویدادها را در گذر زمان کاوش کنید و از راه گیت‌هاب در تکمیل آن سهیم شوید.',
    close: 'بستن', noResults: 'برای این تاریخ موردی یافت نشد', mapLoading: 'نقشه در حال بارگذاری…', mapUnavailable: 'نقشه بارگذاری نشد. اتصال یا دسترسی MapTiler را بررسی کنید.',
    start: 'پخش زمان', pause: 'توقف زمان', earlier: 'زمان پیشین', later: 'زمان پسین', today: 'امروز'
  }
}
const t = computed(() => copy[language.value])
useHead(() => ({ htmlAttrs: { lang: language.value, dir: language.value === 'fa' ? 'rtl' : 'ltr' }, link: [{ rel: 'icon', type: 'image/png', href: asset('favicon.png') }, { rel: 'shortcut icon', href: asset('favicon.ico') }] }))

function displayYear(value: number) {
  const magnitude = new Intl.NumberFormat(language.value === 'fa' ? 'fa-IR' : 'en-US').format(Math.abs(value))
  return value < 0 ? `${magnitude} ${language.value === 'fa' ? 'پ.م.' : 'BCE'}` : `${magnitude} ${language.value === 'fa' ? 'م.' : 'CE'}`
}
// The span from 10,000 BCE through 1,000 CE takes half its former track width.
const deepPastBreak = 140
const recentHistoryBreak = 378
function fromProgress(value: number) {
  const result = value <= deepPastBreak
    ? -10000 + (value / deepPastBreak) * 9000
    : value <= recentHistoryBreak
      ? -1000 + ((value - deepPastBreak) / (recentHistoryBreak - deepPastBreak)) * 2000
      : 1000 + ((value - recentHistoryBreak) / (1000 - recentHistoryBreak)) * 1026
  const rounded = Math.round(result)
  return rounded === 0 ? 1 : rounded
}
function toProgress(value: number) {
  return value <= -1000
    ? ((value + 10000) / 9000) * deepPastBreak
    : value <= 1000
      ? deepPastBreak + ((value + 1000) / 2000) * (recentHistoryBreak - deepPastBreak)
      : recentHistoryBreak + ((value - 1000) / 1026) * (1000 - recentHistoryBreak)
}
const progress = computed({ get: () => Math.round(toProgress(year.value)), set: (value: number) => { year.value = fromProgress(Number(value)) } })
const timelineMarks = [-10000, -5000, -1000, 1, 1000, 2026] as const
// Approximate guide ranges, not universal period boundaries. The unlabeled
// 3,000–1,000 BCE interval includes early recorded civilizations.
const eraRanges = [
  { from: -10000, to: -3000, label: 'prehistory' },
  { from: -1000, to: 500, label: 'classical' },
  { from: 500, to: 1500, label: 'middleAges' },
  { from: 1500, to: 1800, label: 'earlyModern' },
  { from: 1800, to: 2026, label: 'modern' }
] as const
const selectedDetail = computed(() => selectedId.value ? detail.value?.[selectedId.value] : undefined)
const searchResults = computed(() => currentFeatures.value.filter(feature => {
  if (!search.value.trim()) return false
  const translated = catalog.value[feature.properties.id]?.[language.value] || ''
  return `${feature.properties.name} ${translated}`.toLowerCase().includes(search.value.trim().toLowerCase())
}).filter((feature, index, list) => list.findIndex(item => item.properties.id === feature.properties.id) === index))

async function loadSnapshot() {
  if (!mapReady.value || !map) return
  const snapshot = snapshots.value.find(item => year.value >= item.from && year.value <= item.to)
  if (!snapshot || snapshot.file === currentFile.value) return
  const version = ++requestVersion
  try {
    let collection = cache.get(snapshot.file)
    if (!collection) {
      const response = await fetch(asset(snapshot.file))
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      collection = await response.json() as AtlasCollection
      cache.set(snapshot.file, collection)
    }
    if (version !== requestVersion || !map) return
    const source = map.getSource('atlas') as GeoJSONSource | undefined
    source?.setData(collection as Parameters<GeoJSONSource['setData']>[0])
    currentFeatures.value = collection.features
    currentFile.value = snapshot.file
    if (selectedId.value && !collection.features.some(feature => feature.properties.id === selectedId.value)) selectedId.value = null
  } catch (error) {
    mapError.value = `Map data could not load: ${error instanceof Error ? error.message : String(error)}`
  }
}

function updateVisibility() {
  if (!mapReady.value || !map) return
  const groups: Record<keyof typeof visible, string[]> = {
    region: ['atlas-region-fill', 'atlas-region-line'],
    settlement: ['atlas-settlements', 'atlas-settlement-labels'],
    route: ['atlas-routes'], event: ['atlas-events']
  }
  for (const kind of Object.keys(groups) as (keyof typeof visible)[]) {
    for (const id of groups[kind]) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible[kind] ? 'visible' : 'none')
  }
}

async function openFeature(id: string) {
  selectedId.value = id
  layersOpen.value = false
  searchOpen.value = false
  search.value = ''
  if (!detail.value) {
    try {
      const response = await fetch(asset('demo/details.json'))
      if (response.ok) detail.value = await response.json() as Record<string, Detail>
    } catch { /* The map remains usable when the optional detail file is unavailable. */ }
  }
  const feature = currentFeatures.value.find(item => item.properties.id === id)
  if (feature?.geometry.type === 'Point') {
    map?.flyTo({ center: feature.geometry.coordinates as [number, number], zoom: Math.max(map.getZoom(), 5.5), speed: 0.9 })
  }
}
function toggleGlobe() {
  if (!map) return
  isGlobe.value = !isGlobe.value
  map.setProjection({ type: isGlobe.value ? 'globe' : 'mercator' })
  map.easeTo({ zoom: isGlobe.value ? Math.min(map.getZoom(), 3.2) : Math.max(map.getZoom(), 4), pitch: isGlobe.value ? 12 : terrainOn.value ? terrainPitch : 0, duration: 850 })
}
function toggleTerrain() {
  if (!map) return
  terrainOn.value = !terrainOn.value
  if (terrainOn.value) {
    if (!map.getSource('terrain-dem')) map.addSource('terrain-dem', {
      type: 'raster-dem',
      url: 'https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=42LxkcciQxUh26OjYX3E',
      tileSize: 256,
      encoding: 'mapbox'
    })
    map.setTerrain({ source: 'terrain-dem', exaggeration: terrainExaggeration })
    if (!isGlobe.value) map.easeTo({ pitch: terrainPitch, duration: 650 })
  } else {
    map.setTerrain(null)
    if (!isGlobe.value) map.easeTo({ pitch: 0, duration: 650 })
  }
}
function zoomIn() { map?.zoomIn() }
function zoomOut() { map?.zoomOut() }
function stepYear(direction: number) {
  const amount = year.value < -1000 ? 500 : year.value < 1000 ? 100 : 25
  const next = Math.max(-10000, Math.min(2026, year.value + direction * amount))
  year.value = next === 0 ? direction > 0 ? 1 : -1 : next
}
function stopPlayback() { if (playback) clearInterval(playback); playback = null; playing.value = false }
function togglePlayback() {
  if (playing.value) return stopPlayback()
  playing.value = true
  playback = setInterval(() => {
    if (progress.value >= 1000) return stopPlayback()
    progress.value = Math.min(1000, progress.value + 7)
  }, 280)
}
watch(year, loadSnapshot)
watch(visible, updateVisibility)

onMounted(async () => {
  try {
    const response = await fetch(asset('demo/time-index.json'))
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const index = await response.json() as { snapshots: Snapshot[] }
    snapshots.value = index.snapshots
    const catalogResponse = await fetch(asset('demo/catalog.json'))
    if (catalogResponse.ok) catalog.value = await catalogResponse.json() as Record<string, Record<'en' | 'fa', string>>
    const maplibre = await import('maplibre-gl')
    maplibre.setWorkerUrl(workerUrl)
    if (!mapElement.value) return
    map = new maplibre.Map({
      container: mapElement.value,
      style: 'https://api.maptiler.com/maps/01a044da-1b35-7cdd-974d-dc16c9c21f73/style.json?key=42LxkcciQxUh26OjYX3E',
      center: [53, 36.5], zoom: 4.15, minZoom: 1.5, maxZoom: 15,
      attributionControl: false
    })
    map.addControl(new maplibre.AttributionControl({ compact: true }), 'bottom-right')
    map.on('error', event => { if (!mapReady.value) mapError.value = t.value.mapUnavailable; console.error('MapLibre:', event.error) })
    map.on('load', () => {
      if (!map) return
      map.addSource('atlas', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'atlas-region-fill', type: 'fill', source: 'atlas', filter: ['==', ['get', 'kind'], 'region'], paint: { 'fill-color': '#3d7884', 'fill-opacity': 0.24 } })
      map.addLayer({ id: 'atlas-region-line', type: 'line', source: 'atlas', filter: ['==', ['get', 'kind'], 'region'], paint: { 'line-color': '#245b68', 'line-width': 2.5, 'line-opacity': 0.85, 'line-dasharray': [3, 2] } })
      map.addLayer({ id: 'atlas-routes', type: 'line', source: 'atlas', filter: ['==', ['get', 'kind'], 'route'], paint: { 'line-color': '#bd6b45', 'line-width': 3, 'line-dasharray': [2, 2] } })
      map.addLayer({ id: 'atlas-settlements', type: 'circle', source: 'atlas', filter: ['==', ['get', 'kind'], 'settlement'], paint: { 'circle-radius': 7, 'circle-color': '#9b4e38', 'circle-stroke-width': 3, 'circle-stroke-color': '#fff9ef' } })
      map.addLayer({ id: 'atlas-events', type: 'circle', source: 'atlas', filter: ['==', ['get', 'kind'], 'event'], paint: { 'circle-radius': 8, 'circle-color': '#d8a03e', 'circle-stroke-width': 3, 'circle-stroke-color': '#fff9ef' } })
      map.addLayer({ id: 'atlas-settlement-labels', type: 'symbol', source: 'atlas', filter: ['==', ['get', 'kind'], 'settlement'], layout: { 'text-field': ['get', 'name'], 'text-size': 12, 'text-offset': [0, 1.5], 'text-anchor': 'top' }, paint: { 'text-color': '#263d40', 'text-halo-color': '#fff9ef', 'text-halo-width': 1.5 } })
      for (const id of ['atlas-region-fill', 'atlas-region-line', 'atlas-routes', 'atlas-settlements', 'atlas-events', 'atlas-settlement-labels']) {
        map.on('mouseenter', id, () => { if (map) map.getCanvas().style.cursor = 'pointer' })
        map.on('mouseleave', id, () => { if (map) map.getCanvas().style.cursor = '' })
        map.on('click', id, event => { const featureId = event.features?.[0]?.properties?.id; if (featureId) void openFeature(String(featureId)) })
      }
      mapReady.value = true
      mapError.value = ''
      void loadSnapshot()
      updateVisibility()
    })
  } catch (error) {
    mapError.value = error instanceof Error ? error.message : String(error)
  }
})
onBeforeUnmount(() => { stopPlayback(); map?.remove(); map = null })
</script>

<template>
  <div class="atlas-shell" :class="{ 'is-rtl': language === 'fa', 'is-globe': isGlobe }">
    <div ref="mapElement" class="map-canvas" aria-label="Historical atlas map" />
    <div class="map-wash" aria-hidden="true" />
    <a v-if="isGlobe" class="sky-credit" href="https://svs.gsfc.nasa.gov/3895" target="_blank" rel="noopener noreferrer">Sky: NASA/GSFC SVS</a>

    <header class="topbar">
      <button class="brand" type="button" @click="aboutOpen = !aboutOpen; layersOpen = false; selectedId = null" :aria-label="t.about">
        <img class="brand-symbol" :src="asset('jaamejam-logo.png')" alt="" width="46" height="46" />
        <span class="brand-copy"><strong>Jaam-e Jam</strong><small>{{ t.atlas }}</small></span>
      </button>
      <div class="header-actions">
        <UDropdownMenu :items="languageItems" :content="{ align: 'end', sideOffset: 8 }" :ui="{ content: 'min-w-36 z-50' }">
          <button class="language-button" type="button" :aria-label="t.language"><UIcon name="i-lucide-languages" class="icon" /><span>{{ language.toUpperCase() }}</span><UIcon name="i-lucide-chevron-down" class="language-chevron" /></button>
        </UDropdownMenu>
        <a class="github-link" :aria-label="t.contribute" :href="contributionUrl" target="_blank" rel="noopener noreferrer"><UIcon name="i-lucide-github" class="icon" /><span>{{ t.contribute }}</span></a>
      </div>
    </header>

    <section class="hero-card" v-if="!selectedId && !aboutOpen">
      <p class="eyebrow"><span class="eyebrow-line" />{{ language === 'fa' ? 'جامِ جم' : 'THE CUP OF JAMSHID' }}</p>
      <h1>{{ t.explore }}</h1>
    </section>

    <aside class="side-tools" :aria-label="t.layers">
      <div class="tool-stack">
        <button class="tool-button" type="button" :class="{ active: searchOpen }" :aria-label="t.search" @click="searchOpen = !searchOpen; layersOpen = false"><UIcon name="i-lucide-search" class="icon" /></button>
        <button class="tool-button" type="button" :class="{ active: layersOpen }" :aria-label="t.layers" @click="layersOpen = !layersOpen; searchOpen = false; selectedId = null"><UIcon name="i-lucide-layers-3" class="icon" /></button>
      </div>
      <div class="tool-stack">
        <button class="tool-button" type="button" :aria-label="language === 'fa' ? 'بزرگ‌نمایی' : 'Zoom in'" @click="zoomIn"><UIcon name="i-lucide-plus" class="icon" /></button>
        <button class="tool-button" type="button" :aria-label="language === 'fa' ? 'کوچک‌نمایی' : 'Zoom out'" @click="zoomOut"><UIcon name="i-lucide-minus" class="icon" /></button>
      </div>
      <div class="tool-stack">
        <button class="tool-button wide-tool" type="button" :class="{ active: isGlobe }" :aria-label="isGlobe ? t.flat : t.globe" @click="toggleGlobe"><UIcon :name="isGlobe ? 'i-lucide-map' : 'i-lucide-globe-2'" class="icon" /><span>{{ isGlobe ? '2D' : '3D' }}</span></button>
        <button class="tool-button" type="button" :class="{ active: terrainOn }" :aria-label="t.terrain" @click="toggleTerrain"><UIcon name="i-lucide-mountain" class="icon" /></button>
      </div>
    </aside>

    <div v-if="searchOpen" class="floating-panel search-panel">
      <div class="panel-heading"><span>{{ t.search }}</span><button type="button" class="plain-close" :aria-label="t.close" @click="searchOpen = false"><UIcon name="i-lucide-x" /></button></div>
      <UInput v-model="search" autofocus icon="i-lucide-search" :placeholder="t.search" size="lg" class="search-input" />
      <div v-if="search.trim()" class="search-results">
        <button v-for="feature in searchResults" :key="feature.properties.id" type="button" @click="openFeature(feature.properties.id)"><UIcon :name="feature.properties.kind === 'settlement' ? 'i-lucide-map-pin' : feature.properties.kind === 'route' ? 'i-lucide-route' : 'i-lucide-map'" class="icon" /><span>{{ catalog[feature.properties.id]?.[language] || feature.properties.name }}</span><UIcon name="i-lucide-arrow-up-right" class="icon arrow" /></button>
        <p v-if="!searchResults.length" class="empty-results">{{ t.noResults }}</p>
      </div>
    </div>

    <aside v-if="layersOpen" class="floating-panel layers-panel">
      <div class="panel-heading"><span>{{ t.layers }}</span><button type="button" class="plain-close" :aria-label="t.close" @click="layersOpen = false"><UIcon name="i-lucide-x" /></button></div>
      <div class="layer-list">
        <label class="layer-row"><span class="layer-key region-key" /><span class="layer-name">{{ t.regions }}</span><USwitch v-model="visible.region" size="sm" /></label>
        <label class="layer-row"><span class="layer-key settlement-key" /><span class="layer-name">{{ t.settlements }}</span><USwitch v-model="visible.settlement" size="sm" /></label>
        <label class="layer-row"><span class="layer-key route-key" /><span class="layer-name">{{ t.routes }}</span><USwitch v-model="visible.route" size="sm" /></label>
        <label class="layer-row"><span class="layer-key event-key" /><span class="layer-name">{{ t.events }}</span><USwitch v-model="visible.event" size="sm" /></label>
      </div>
    </aside>

    <aside v-if="selectedId || aboutOpen" class="floating-panel detail-panel">
      <div class="panel-heading"><span>{{ aboutOpen ? t.about : t.details }}</span><button type="button" class="plain-close" :aria-label="t.close" @click="selectedId = null; aboutOpen = false"><UIcon name="i-lucide-x" /></button></div>
      <div class="detail-content" v-if="aboutOpen"><span class="detail-glyph">ج</span><h2>{{ t.infoTitle }}</h2><p>{{ t.infoBody }}</p></div>
      <div class="detail-content" v-else-if="selectedDetail"><span class="detail-type">{{ selectedDetail.kind }}</span><h2>{{ selectedDetail.name[language] }}</h2><h3>{{ selectedDetail.subtitle[language] }}</h3><div class="detail-rule" /><p>{{ selectedDetail.body[language] }}</p></div>
      <div class="detail-content" v-else><p>{{ t.mapLoading }}</p></div>
      <a class="detail-contribute" :href="contributionUrl" target="_blank" rel="noopener noreferrer">{{ t.contribute }}<UIcon name="i-lucide-arrow-up-right" class="icon" /></a>
    </aside>

    <div v-if="mapError || !mapReady" class="map-status"><UIcon :name="mapError ? 'i-lucide-wifi-off' : 'i-lucide-loader-circle'" class="icon" /><span>{{ mapError || t.mapLoading }}</span></div>

    <footer class="timeline-panel">
      <div class="timeline-topline">
        <div class="timeline-title"><span class="timeline-icon"><UIcon name="i-lucide-clock-3" /></span><span><strong>{{ displayYear(year) }}</strong></span></div>
        <div class="timeline-actions"><button type="button" :aria-label="t.earlier" @click="stepYear(-1)"><UIcon name="i-lucide-chevron-left" class="icon" /></button><button type="button" class="play-button" :aria-label="playing ? t.pause : t.start" @click="togglePlayback"><UIcon :name="playing ? 'i-lucide-pause' : 'i-lucide-play'" class="icon" /></button><button type="button" :aria-label="t.later" @click="stepYear(1)"><UIcon name="i-lucide-chevron-right" class="icon" /></button></div>
      </div>
      <div class="timeline-track-wrap"><div class="timeline-track-background"><div class="timeline-track-fill" :style="{ width: `${progress / 10}%` }" /><div class="timeline-break" :style="{ left: `${deepPastBreak / 10}%` }" aria-hidden="true">//</div><div class="timeline-break" :style="{ left: `${recentHistoryBreak / 10}%` }" aria-hidden="true">//</div></div><input v-model.number="progress" class="timeline-range" type="range" min="0" max="1000" step="1" :aria-label="t.browse" /><div v-for="mark in timelineMarks" :key="mark" class="timeline-tick" :class="{ 'first-tick': mark === -10000, 'last-tick': mark === 2026, 'mobile-hidden-tick': mark === -5000 || mark === -1000 }" :style="{ left: `${toProgress(mark) / 10}%` }"><span class="tick-line" /><small>{{ mark === 2026 ? t.today : displayYear(mark) }}</small></div></div>
      <div class="timeline-eras"><div v-for="era in eraRanges" :key="era.label" class="timeline-era" :style="{ left: `${toProgress(era.from) / 10}%`, width: `${(toProgress(era.to) - toProgress(era.from)) / 10}%` }" :title="`${t[era.label]}: ${displayYear(era.from)}–${displayYear(era.to)}`"><span dir="auto">{{ t[era.label] }}</span></div></div>
    </footer>
  </div>
</template>

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  modules: ['@nuxt/ui'],
  colorMode: { preference: 'light', fallback: 'light' },
  css: ['maplibre-gl/dist/maplibre-gl.css', '~/assets/css/main.css'],
  app: {
    head: {
      title: 'Jaamejam — A collaborative historical atlas',
      meta: [
        { name: 'description', content: 'Explore a collaborative atlas of the world through time.' },
        { name: 'theme-color', content: '#f4f0e7' }
      ]
    }
  }
})

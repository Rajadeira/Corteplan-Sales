/**
 * Service Worker Corteplan — Gestão (v2)
 * Estratégia:
 * 1. App Shell (HTML de navegação) e assets com hash no nome (bundles Vite):
 *    NETWORK-FIRST — sempre busca a versão nova no servidor; o cache só é
 *    usado quando o usuário está offline. Isso garante que cada deploy seja
 *    pego na próxima recarga, sem cache antigo travando o login.
 * 2. Assets estáticos sem hash (ícones, manifest, imagens fixas):
 *    cache-first com atualização em background (stale-while-revalidate).
 * 3. Requisições de API (PocketBase /api/*):
 *    Network-first estrito, com fallback para cache apenas offline.
 */

const CACHE_NAME = 'corteplan-shell-v2'
const API_CACHE_NAME = 'corteplan-api-v2'

const APP_SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.ico',
  '/icon-192.svg',
  '/icon-512.svg',
]

// Instalação: pré-cache do shell mínimo e ativação imediata
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL_ASSETS))
      .then(() => self.skipWaiting()),
  )
})

// Ativação: limpeza de caches antigos (inclusive v1) e controle imediato
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((name) => {
            if (name !== CACHE_NAME && name !== API_CACHE_NAME) {
              return caches.delete(name)
            }
            return Promise.resolve()
          }),
        )
      })
      .then(() => self.clients.claim()),
  )
})

// Permite que a página peça ativação imediata da nova versão do SW
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

// Interceptação de requisições
self.addEventListener('fetch', (event) => {
  const { request } = event

  // Ignorar requisições não-GET (POST, PUT, PATCH, DELETE vão direto à rede)
  if (request.method !== 'GET') {
    return
  }

  const url = new URL(request.url)

  // Ignora chamadas de autenticação OAuth / skip.js / realtime SSE
  if (
    url.pathname.includes('/api/realtime') ||
    url.hostname.includes('goskip.dev') ||
    request.headers.get('accept')?.includes('text/event-stream')
  ) {
    return
  }

  // 1. ESTRATÉGIA NETWORK-FIRST PARA API DO POCKETBASE (/api/collections/...)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          // Se resposta OK, salva cópia no cache de API
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone()
            caches.open(API_CACHE_NAME).then((cache) => {
              cache.put(request, responseClone)
            })
          }
          return networkResponse
        })
        .catch(async () => {
          // Se falhou rede (offline), tenta recuperar última resposta do cache
          const cachedResponse = await caches.match(request)
          if (cachedResponse) {
            return cachedResponse
          }
          return new Response(
            JSON.stringify({
              code: 503,
              message: 'Você está offline e estes dados ainda não foram salvos localmente.',
            }),
            {
              status: 503,
              headers: { 'Content-Type': 'application/json; charset=utf-8' },
            },
          )
        }),
    )
    return
  }

  // Asset com hash no nome (bundle Vite: app-3f9a2b1c.js) OU navegação HTML:
  // NETWORK-FIRST — a rede manda; o cache só entra quando offline.
  const isHashedAsset =
    /\.[\w-]{8}\.(js|css|mjs)$/.test(url.pathname) || /-[a-f0-9]{8,}\./.test(url.pathname)
  const isNavigation = request.mode === 'navigate'

  if (isNavigation || isHashedAsset) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          }
          return networkResponse
        })
        .catch(async () => {
          // Offline: serve do cache; navegações caem no index.html em cache
          const cachedResponse = await caches.match(request)
          if (cachedResponse) return cachedResponse
          if (isNavigation) {
            return (await caches.match('/index.html')) || (await caches.match('/'))
          }
          return undefined
        }),
    )
    return
  }

  // 2. Assets estáticos SEM hash (ícones, imagens, fontes):
  //    cache-first com atualização em background.
  if (url.pathname.match(/\.(js|css|svg|png|jpg|jpeg|webp|woff2?|ico)$/)) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone()
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
            }
            return networkResponse
          })
          .catch(() => cachedResponse)

        return cachedResponse || fetchPromise
      }),
    )
    return
  }
})

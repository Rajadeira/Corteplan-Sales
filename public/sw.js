/**
 * Service Worker Corteplan — Gestão
 * Estratégia:
 * 1. App Shell e assets estáticos (HTML, JS, CSS, fontes, ícones, imagens estáticas):
 *    Cache-first com fallback para rede.
 * 2. Requisições de API (PocketBase /api/*):
 *    Network-first estrito para nunca servir dados mutáveis incorretos / desatualizados,
 *    com fallback para cache em caso de ausência total de conexão para permitir visualização offline básica.
 */

const CACHE_NAME = 'corteplan-shell-v1'
const API_CACHE_NAME = 'corteplan-api-v1'

const APP_SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.ico',
  '/icon-192.svg',
  '/icon-512.svg',
]

// Instalação: pré-cache do shell mínimo
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL_ASSETS))
      .then(() => self.skipWaiting()),
  )
})

// Ativação: limpeza de caches antigos
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

  // 2. ESTRATÉGIA CACHE-FIRST COM ATUALIZAÇÃO EM BACKGROUND PARA APP SHELL E ASSETS
  // (Navegações HTML e arquivos estáticos .js, .css, imagens, fontes)
  if (
    request.mode === 'navigate' ||
    url.pathname.match(/\.(js|css|svg|png|jpg|jpeg|webp|woff2?|ico)$/)
  ) {
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
          .catch(() => {
            // Em navegações de rotas React Router quando offline, retorna index.html em cache
            if (request.mode === 'navigate') {
              return caches.match('/index.html')
            }
            return undefined
          })

        return cachedResponse || fetchPromise
      }),
    )
    return
  }
})

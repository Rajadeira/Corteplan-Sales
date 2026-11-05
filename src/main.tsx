/* Main entry point for the application - renders the root React component */
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './main.css'

// Registro do Service Worker do PWA com atualização automática:
// se existir um SW novo esperando, ele é ativado e a página recarrega uma vez,
// garantindo que o usuário nunca fique preso a um bundle antigo em cache.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.log('[PWA] Service Worker registrado com sucesso:', reg.scope)

        // Ativa imediatamente qualquer SW novo que esteja aguardando
        const activateWaiting = (worker: ServiceWorker | null) => {
          if (worker) {
            worker.postMessage('SKIP_WAITING')
          }
        }
        activateWaiting(reg.waiting)

        // Revalida por atualizações ao abrir o app e a cada 30 min
        const checkForUpdate = () => reg.update().catch(() => undefined)
        checkForUpdate()
        setInterval(checkForUpdate, 30 * 60 * 1000)
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') checkForUpdate()
        })

        // Quando um SW novo assume o controle, recarrega a página uma única vez
        let reloading = false
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (reloading) return
          reloading = true
          window.location.reload()
        })

        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing
          if (!newWorker) return
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              activateWaiting(newWorker)
            }
          })
        })
      })
      .catch((err) => {
        console.warn('[PWA] Falha ao registrar Service Worker:', err)
      })
  })
}

// @skip-protected: Do not remove. Required for React rendering.
createRoot(document.getElementById('root')!).render(<App />)

import PocketBase from 'pocketbase'

/**
 * URL base do backend PocketBase.
 * Em builds de preview/produção a URL vem da env VITE_POCKETBASE_URL.
 * O fallback evita um client apontando para "undefined" (o que faria toda
 * chamada — inclusive o login — falhar no navegador sem chegar ao backend).
 */
const BACKEND_URL = (import.meta.env.VITE_POCKETBASE_URL as string | undefined)?.trim()

const pb = new PocketBase(
  BACKEND_URL || 'https://gestao-de-mobiliario-e-orcamentos-0025b.shrd03.internal.goskip.dev',
)

// Remove barra final para evitar URLs duplas "//api/..." em algumas redes
pb.baseUrl = pb.baseUrl.replace(/\/+$/, '')

pb.autoCancellation(false)

if (!BACKEND_URL && import.meta.env.DEV) {
  // Aviso apenas em desenvolvimento: build sem a variável de ambiente
  console.warn('[PocketBase] VITE_POCKETBASE_URL ausente — usando URL de fallback.')
}

export default pb

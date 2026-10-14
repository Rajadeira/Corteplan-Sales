/**
 * Utilitários para formatação e validação de CPF e CNPJ
 * e consulta aos serviços públicos (BrasilAPI + fallback ReceitaWS).
 */

export function cleanDocument(doc: string): string {
  return doc.replace(/\D/g, '')
}

export function maskCPF(value: string): string {
  const digits = cleanDocument(value).slice(0, 11)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`
}

export function maskCNPJ(value: string): string {
  const digits = cleanDocument(value).slice(0, 14)
  if (digits.length <= 2) return digits
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`
  if (digits.length <= 12)
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`
}

export function maskCEP(value: string): string {
  const digits = cleanDocument(value).slice(0, 8)
  if (digits.length <= 5) return digits
  return `${digits.slice(0, 5)}-${digits.slice(5)}`
}

export function validateCPF(cpf: string): boolean {
  const digits = cleanDocument(cpf)
  if (digits.length !== 11) return false
  // Rejeita sequências de dígitos iguais
  if (/^(\d)\1{10}$/.test(digits)) return false

  // Dígito 1
  let sum = 0
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits[i], 10) * (10 - i)
  }
  let rev = 11 - (sum % 11)
  if (rev === 10 || rev === 11) rev = 0
  if (rev !== parseInt(digits[9], 10)) return false

  // Dígito 2
  sum = 0
  for (let i = 0; i < 10; i++) {
    sum += parseInt(digits[i], 10) * (11 - i)
  }
  rev = 11 - (sum % 11)
  if (rev === 10 || rev === 11) rev = 0
  if (rev !== parseInt(digits[10], 10)) return false

  return true
}

export function validateCNPJ(cnpj: string): boolean {
  const digits = cleanDocument(cnpj)
  if (digits.length !== 14) return false
  // Rejeita sequências de dígitos iguais
  if (/^(\d)\1{13}$/.test(digits)) return false

  // Dígito 1
  let size = digits.length - 2
  let numbers = digits.substring(0, size)
  const digitsPart = digits.substring(size)
  let sum = 0
  let pos = size - 7
  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i), 10) * pos--
    if (pos < 2) pos = 9
  }
  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11)
  if (result !== parseInt(digitsPart.charAt(0), 10)) return false

  // Dígito 2
  size = size + 1
  numbers = digits.substring(0, size)
  sum = 0
  pos = size - 7
  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i), 10) * pos--
    if (pos < 2) pos = 9
  }
  result = sum % 11 < 2 ? 0 : 11 - (sum % 11)
  if (result !== parseInt(digitsPart.charAt(1), 10)) return false

  return true
}

export interface CNPJConsultResult {
  razaoSocial: string
  nomeFantasia?: string
  cnae?: string
  cnaeDescricao?: string
  naturezaJuridicaCodigo?: string
  naturezaJuridicaDescricao?: string
  situacaoCadastral?: string
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  cidade?: string
  uf?: string
  cep?: string
  telefone?: string
  email?: string
  fonte: 'BrasilAPI' | 'ReceitaWS'
}

/**
 * Consulta ReceitaWS diretamente via JSONP (compatível com navegadores, contornando a ausência de cabeçalho CORS).
 */
function consultReceitaWSJsonp(clean: string, timeoutMs = 8000): Promise<CNPJConsultResult> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      return reject(new Error('JSONP só funciona em ambiente de navegador'))
    }

    const callbackName = `receitaws_cb_${Date.now()}_${Math.floor(Math.random() * 10000)}`
    let isSettled = false

    const cleanup = () => {
      delete (window as unknown as Record<string, unknown>)[callbackName]
      const script = document.getElementById(callbackName)
      if (script && script.parentNode) {
        script.parentNode.removeChild(script)
      }
    }

    const timer = window.setTimeout(() => {
      if (isSettled) return
      isSettled = true
      cleanup()
      reject(new Error('Timeout na consulta ReceitaWS via JSONP'))
    }, timeoutMs)

    ;(window as unknown as Record<string, (data: Record<string, unknown>) => void>)[callbackName] =
      (data: Record<string, unknown>) => {
        if (isSettled) return
        isSettled = true
        window.clearTimeout(timer)
        cleanup()

        if (!data || data.status === 'ERROR') {
          return reject(new Error(String(data?.message || 'CNPJ não encontrado na ReceitaWS')))
        }

        const nome = String(data.nome || '')
        const fantasia = String(data.fantasia || '')
        if (!nome && !fantasia) {
          return reject(new Error('Resposta vazia da ReceitaWS'))
        }

        let cnaeCode = ''
        let cnaeDesc = ''
        const ativ = data.atividade_principal as Array<{ code?: string; text?: string }> | undefined
        if (Array.isArray(ativ) && ativ.length > 0) {
          cnaeCode = String(ativ[0]?.code || '')
          cnaeDesc = String(ativ[0]?.text || '')
        }
        let natJurCode = ''
        let natJurDesc = ''
        if (data.natureza_juridica) {
          const rawNat = String(data.natureza_juridica)
          const parts = rawNat.split('-')
          if (parts.length > 1) {
            natJurCode = parts[0].trim()
            natJurDesc = parts.slice(1).join('-').trim()
          } else {
            natJurDesc = rawNat.trim()
          }
        }
        const situacao = String(data.situacao || 'ATIVA')

        resolve({
          razaoSocial: nome,
          nomeFantasia: fantasia,
          cnae: cnaeCode,
          cnaeDescricao: cnaeDesc,
          naturezaJuridicaCodigo: natJurCode,
          naturezaJuridicaDescricao: natJurDesc,
          situacaoCadastral: situacao,
          logradouro: String(data.logradouro || ''),
          numero: String(data.numero || ''),
          complemento: String(data.complemento || ''),
          bairro: String(data.bairro || ''),
          cidade: String(data.municipio || ''),
          uf: String(data.uf || ''),
          cep: data.cep ? maskCEP(String(data.cep)) : '',
          telefone: data.telefone ? cleanDocument(String(data.telefone)) : '',
          email: String(data.email || '')
            .toLowerCase()
            .trim(),
          fonte: 'ReceitaWS',
        })
      }

    const script = document.createElement('script')
    script.id = callbackName
    script.src = `https://receitaws.com.br/v1/cnpj/${clean}?callback=${callbackName}`
    script.async = true
    script.onerror = () => {
      if (isSettled) return
      isSettled = true
      window.clearTimeout(timer)
      cleanup()
      reject(new Error('Erro de conexão com o script da ReceitaWS'))
    }

    document.head.appendChild(script)
  })
}

/**
 * Consulta dados cadastrais do CNPJ com estratégia multi-camada resiliente:
 * 1. Proxy do Backend (/backend/v1/consult-cnpj/{cnpj}) com autenticação do usuário
 *    (executa no servidor PB sem limitações de CORS e com acesso a BrasilAPI + ReceitaWS)
 * 2. Fallback direto BrasilAPI pelo browser (se o backend estiver indisponível ou deslogado)
 * 3. Fallback ReceitaWS via JSONP pelo browser (suportado oficialmente pela ReceitaWS)
 */
export async function consultCNPJ(cnpj: string): Promise<CNPJConsultResult> {
  const clean = cleanDocument(cnpj)
  if (clean.length !== 14) {
    throw new Error('CNPJ deve conter 14 dígitos')
  }

  // Tentativa 1: Endpoint proxy do backend PocketBase (servidor -> APIs externas, imune a CORS de browser)
  try {
    const pbBase = (import.meta.env.VITE_POCKETBASE_URL || '').replace(/\/$/, '')
    if (pbBase) {
      // Obtém o token de autenticação atual do localStorage (PocketBase authStore)
      let token = ''
      try {
        const stored = localStorage.getItem('pocketbase_auth')
        if (stored) {
          const parsed = JSON.parse(stored)
          token = parsed?.token || ''
        }
      } catch (_) {
        // Ignora erro de leitura local
      }

      const headers: Record<string, string> = {
        Accept: 'application/json',
      }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 9000)

      const res = await fetch(`${pbBase}/backend/v1/consult-cnpj/${clean}`, {
        headers,
        signal: controller.signal,
      }).catch((e) => {
        console.warn('Erro de rede ao chamar proxy de CNPJ:', e)
        return null
      })

      clearTimeout(timeoutId)

      if (res && res.ok) {
        const data = await res.json()
        if (data && (data.razaoSocial || data.nomeFantasia)) {
          return {
            razaoSocial: data.razaoSocial || '',
            nomeFantasia: data.nomeFantasia || '',
            cnae: data.cnae || '',
            cnaeDescricao: data.cnaeDescricao || '',
            naturezaJuridicaCodigo: data.naturezaJuridicaCodigo || '',
            naturezaJuridicaDescricao: data.naturezaJuridicaDescricao || '',
            situacaoCadastral: data.situacaoCadastral || 'ATIVA',
            logradouro: data.logradouro || '',
            numero: data.numero || '',
            complemento: data.complemento || '',
            bairro: data.bairro || '',
            cidade: data.cidade || '',
            uf: data.uf || '',
            cep: data.cep ? maskCEP(data.cep) : '',
            telefone: data.telefone ? cleanDocument(data.telefone) : '',
            email: (data.email || '').toLowerCase().trim(),
            fonte: data.fonte || 'ReceitaWS',
          }
        }
      }
    }
  } catch (err) {
    console.warn(
      'Proxy de consulta CNPJ falhou, iniciando consultas de fallback no cliente...',
      err,
    )
  }

  // Tentativa 2: Consulta direta BrasilAPI no browser
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 6000)

    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    }).catch(() => null)

    clearTimeout(timeoutId)

    if (res && res.ok) {
      const data = await res.json()
      if (data && (data.razao_social || data.nome_fantasia)) {
        const fullPhone =
          data.ddd_telefone_1 ||
          (data.ddd_telefone_2 ? data.ddd_telefone_2 : '') ||
          (data.telefone ? data.telefone : '')

        const cnaeCode = data.cnae_fiscal ? String(data.cnae_fiscal) : ''
        const cnaeDesc = data.cnae_fiscal_descricao || ''
        const natJur = String(data.natureza_juridica || '')
        let natJurCode = data.codigo_natureza_juridica ? String(data.codigo_natureza_juridica) : ''
        let natJurDesc = natJur
        if (natJur.includes('-')) {
          const parts = natJur.split('-')
          natJurCode = natJurCode || parts[0].trim()
          natJurDesc = parts.slice(1).join('-').trim()
        }
        const situacao = data.descricao_situacao_cadastral || data.situacao_cadastral || 'ATIVA'

        return {
          razaoSocial: data.razao_social || '',
          nomeFantasia: data.nome_fantasia || '',
          cnae: cnaeCode,
          cnaeDescricao: cnaeDesc,
          naturezaJuridicaCodigo: natJurCode,
          naturezaJuridicaDescricao: natJurDesc,
          situacaoCadastral: situacao,
          logradouro: [data.descricao_tipo_de_logradouro, data.logradouro]
            .filter(Boolean)
            .join(' ')
            .trim(),
          numero: data.numero || '',
          complemento: data.complemento || '',
          bairro: data.bairro || '',
          cidade: data.municipio || '',
          uf: data.uf || '',
          cep: data.cep ? maskCEP(data.cep) : '',
          telefone: fullPhone ? cleanDocument(fullPhone) : '',
          email: (data.email || '').toLowerCase().trim(),
          fonte: 'BrasilAPI',
        }
      }
    }
  } catch (err) {
    console.warn('Falha na consulta BrasilAPI direta:', err)
  }

  // Tentativa 3: Consulta ReceitaWS via JSONP (compatível com browser, sem erro de CORS)
  try {
    const jsonpResult = await consultReceitaWSJsonp(clean, 7000)
    if (jsonpResult && (jsonpResult.razaoSocial || jsonpResult.nomeFantasia)) {
      return jsonpResult
    }
  } catch (err) {
    console.warn('Falha na consulta ReceitaWS via JSONP:', err)
  }

  throw new Error('CNPJ não encontrado ou serviços de consulta temporariamente indisponíveis.')
}

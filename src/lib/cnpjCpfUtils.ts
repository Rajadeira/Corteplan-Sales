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
 * Consulta dados cadastrais do CNPJ:
 * 1. BrasilAPI (https://brasilapi.com.br/api/cnpj/v1/{cnpj})
 * 2. ReceitaWS (https://receitaws.com.br/v1/cnpj/{cnpj}) como fallback
 */
export async function consultCNPJ(cnpj: string): Promise<CNPJConsultResult> {
  const clean = cleanDocument(cnpj)
  if (clean.length !== 14) {
    throw new Error('CNPJ deve conter 14 dígitos')
  }

  // Tentativa 1: BrasilAPI
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`, {
      headers: { Accept: 'application/json' },
    })

    if (res.ok) {
      const data = await res.json()
      if (data && (data.razao_social || data.nome_fantasia)) {
        const fullPhone =
          data.ddd_telefone_1 ||
          (data.ddd_telefone_2 ? data.ddd_telefone_2 : '') ||
          (data.telefone ? data.telefone : '')

        return {
          razaoSocial: data.razao_social || '',
          nomeFantasia: data.nome_fantasia || '',
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
    console.warn('Falha na consulta BrasilAPI, tentando fallback ReceitaWS...', err)
  }

  // Tentativa 2 (Fallback): ReceitaWS
  try {
    const res = await fetch(`https://receitaws.com.br/v1/cnpj/${clean}`, {
      headers: { Accept: 'application/json' },
    })

    if (res.ok) {
      const data = await res.json()
      if (data && data.status !== 'ERROR' && (data.nome || data.fantasia)) {
        return {
          razaoSocial: data.nome || '',
          nomeFantasia: data.fantasia || '',
          logradouro: data.logradouro || '',
          numero: data.numero || '',
          complemento: data.complemento || '',
          bairro: data.bairro || '',
          cidade: data.municipio || '',
          uf: data.uf || '',
          cep: data.cep ? maskCEP(data.cep) : '',
          telefone: data.telefone ? cleanDocument(data.telefone) : '',
          email: (data.email || '').toLowerCase().trim(),
          fonte: 'ReceitaWS',
        }
      }
    }
  } catch (err) {
    console.warn('Falha na consulta ReceitaWS fallback:', err)
  }

  throw new Error('CNPJ não encontrado ou serviços de consulta temporariamente indisponíveis.')
}

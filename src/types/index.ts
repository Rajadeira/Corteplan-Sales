import type { RecordModel } from 'pocketbase'

export interface ClientRecord extends RecordModel {
  name: string
  email?: string
  phone: string
  company?: string
  address?: string
  city?: string
  notes?: string
  expand?: {
    quotes?: QuoteRecord[]
    [key: string]: unknown
  }
}

export interface QuoteItem {
  id?: string
  description: string
  quantity: number
  unit: 'un' | 'm²' | 'm' | 'kit' | 'hora'
  unit_price: number
  tax?: number // Imposto do item (ex: Imp: R$ 1.719,90)
  technical_description?: string // Descrição técnica longa em texto corrido
}

export interface QuoteInstallment {
  number: number
  date: string // YYYY-MM-DD ou formato ISO
  method: string // Ex: "Boleto", "PIX", "Transferência", "Cartão"
  value: number
}

export type QuoteStatus = 'Rascunho' | 'Enviado' | 'Aprovado' | 'Rejeitado'

export interface StatusHistoryEntry {
  status: QuoteStatus
  changed_at: string
  changed_by: string
}

export interface QuoteRecord extends RecordModel {
  quote_number: number
  client: string
  items: QuoteItem[]
  discount_percent: number
  subtotal: number
  total: number
  status: QuoteStatus
  observations?: string
  status_history?: StatusHistoryEntry[]

  // Novos campos CORTEPLAN
  icms?: number
  ipi?: number
  pis?: number
  cofins?: number
  seller?: string
  validity_days?: number
  delivery_term?: string
  payment_terms?: string
  installments?: QuoteInstallment[]

  expand?: {
    client?: ClientRecord
    [key: string]: unknown
  }
}

export const CORTEPLAN_COMPANY_INFO = {
  name: 'CORTEPLAN',
  cnpj: '24.306.897/0001-44',
  address: 'Rua Friedrich Bischof, 80 - Distrito Industrial - Mauá / SP',
  phone: '(11) 4319-4566',
  email: 'contato@corteplan.com.br',
  city: 'Mauá',
  state: 'SP',
}

export function formatCurrencyBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value || 0)
}

export function formatQuoteNumber(num: number): string {
  return `ORÇ-${String(num || 0).padStart(3, '0')}`
}

export function formatDateBR(dateStr: string): string {
  if (!dateStr) return '-'
  try {
    // Se for formato simples YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [y, m, d] = dateStr.split('-')
      return `${d}/${m}/${y}`
    }
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch (_) {
    return dateStr
  }
}

export function formatDateExtendedBR(dateStr?: string, city = 'Mauá'): string {
  try {
    const d = dateStr ? new Date(dateStr) : new Date()
    const validDate = isNaN(d.getTime()) ? new Date() : d
    const day = validDate.getDate()
    const months = [
      'janeiro',
      'fevereiro',
      'março',
      'abril',
      'maio',
      'junho',
      'julho',
      'agosto',
      'setembro',
      'outubro',
      'novembro',
      'dezembro',
    ]
    const month = months[validDate.getMonth()]
    const year = validDate.getFullYear()
    return `${city}, ${day} de ${month} de ${year}.`
  } catch (_) {
    return `${city}, ${new Date().toLocaleDateString('pt-BR')}.`
  }
}

export function formatDateTimeBR(dateStr: string): string {
  if (!dateStr) return '-'
  try {
    const d = new Date(dateStr)
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch (_) {
    return dateStr
  }
}

export function maskPhoneBR(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.length <= 10) {
    // (XX) XXXX-XXXX
    return digits
      .replace(/^(\d{2})(\d)/g, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2')
      .slice(0, 14)
  }
  // (XX) XXXXX-XXXX
  return digits
    .replace(/^(\d{2})(\d)/g, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2')
    .slice(0, 15)
}

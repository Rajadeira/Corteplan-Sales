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
  expand?: {
    client?: ClientRecord
    [key: string]: unknown
  }
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
    const d = new Date(dateStr)
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch (_) {
    return dateStr
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

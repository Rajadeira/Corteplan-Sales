import type { RecordModel } from 'pocketbase'

export type DocumentType = 'CNPJ' | 'CPF'

export interface ClientRecord extends RecordModel {
  name: string
  email?: string
  phone: string
  company?: string
  address?: string
  city?: string
  notes?: string
  document_type?: DocumentType
  document_number?: string
  trade_name?: string
  contact_name?: string
  zip_code?: string
  neighborhood?: string
  state?: string
  expand?: {
    quotes?: QuoteRecord[]
    [key: string]: unknown
  }
}

export type ItemCategory =
  | 'Mobiliário'
  | 'Comunicação Visual'
  | 'Serralheria'
  | 'Vidraçaria'
  | 'Frete'
  | 'Instalação'
  | 'Outros'

export const ITEM_CATEGORIES: ItemCategory[] = [
  'Mobiliário',
  'Comunicação Visual',
  'Serralheria',
  'Vidraçaria',
  'Frete',
  'Instalação',
  'Outros',
]

export interface QuoteItem {
  id?: string
  description: string
  category?: ItemCategory | string
  quantity: number
  unit: 'un' | 'm²' | 'm' | 'kit' | 'hora'
  unit_price: number
  tax?: number // Imposto do item (ex: Imp: R$ 1.719,90)
  technical_description?: string // Descrição técnica longa em texto corrido
  image?: string // Foto do produto codificada em base64 (data:image/...)
}

export interface QuoteInstallment {
  number: number
  date: string // YYYY-MM-DD ou formato ISO
  method: string // Ex: "Boleto", "PIX", "Transferência", "Cartão"
  value: number
}

export type QuoteStatus = 'Rascunho' | 'Enviado' | 'Aprovado' | 'Rejeitado'
export type OrderStatus = 'Aberto' | 'Em Produção' | 'Concluído' | 'Cancelado'
export type UserRole = 'Administrador' | 'Vendedor'

export interface AppUserRecord extends RecordModel {
  name: string
  email: string
  avatar?: string
  role?: UserRole
}

export interface StatusHistoryEntry {
  status: QuoteStatus | OrderStatus | string
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
  seller_user?: string
  commission_percent?: number
  order_number?: number
  order_id?: string
  validity_days?: number
  delivery_term?: string
  payment_terms?: string
  installments?: QuoteInstallment[]

  // Configuração de Diagramação / Ajuste Manual de Layout (estilo CorelDRAW)
  layout_config?: ProposalLayoutConfig

  expand?: {
    client?: ClientRecord
    seller_user?: AppUserRecord
    [key: string]: unknown
  }
}

export interface OrderRecord extends RecordModel {
  order_number: number
  client: string
  quote?: string
  quote_number?: number
  items: QuoteItem[]
  discount_percent: number
  subtotal: number
  total: number
  status: OrderStatus
  observations?: string
  status_history?: StatusHistoryEntry[]

  seller?: string
  seller_user?: string
  commission_percent?: number
  commission_value?: number
  validity_days?: number
  delivery_term?: string
  payment_terms?: string
  installments?: QuoteInstallment[]
  icms?: number
  ipi?: number
  pis?: number
  cofins?: number
  layout_config?: ProposalLayoutConfig

  expand?: {
    client?: ClientRecord
    quote?: QuoteRecord
    seller_user?: AppUserRecord
    [key: string]: unknown
  }
}

export type ProposalBlockId =
  | 'header'
  | 'client'
  | 'title_date'
  | 'intro'
  | 'items'
  | 'totals_obs'
  | 'conditions_summary'
  | 'installments'
  | 'signature'
  | 'footer'

export interface BlockStyleConfig {
  xOffset?: number // px
  yOffset?: number // px
  scale?: number // percent (ex: 100)
  widthPercent?: number // percent (ex: 100)
  marginTop?: number // px
  marginBottom?: number // px
  padding?: number // px
  align?: 'left' | 'center' | 'right'
}

export interface ProposalLayoutConfig {
  version: number
  page1Order: ProposalBlockId[]
  page2Order: ProposalBlockId[]
  blocks: Partial<Record<ProposalBlockId, BlockStyleConfig>>
  updatedAt?: string
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

/**
 * Regra pré-estipulada padrão de alíquotas de impostos da CORTEPLAN:
 * "Icms 12%, IPI 3,25% - Pis 0,65% e Cofins 3%"
 */
export const DEFAULT_TAX_RATES = {
  icmsPercent: 12, // 12%
  ipiPercent: 3.25, // 3,25%
  pisPercent: 0.65, // 0,65%
  cofinsPercent: 3, // 3%
} as const

export function formatCurrencyBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value || 0)
}

export function formatQuoteNumber(num: number): string {
  return `ORÇ-${String(num || 0).padStart(3, '0')}`
}

export function formatOrderNumber(num: number): string {
  return `PED-${String(num || 0).padStart(3, '0')}`
}

/**
 * Regra de cálculo de comissão da Corteplan:
 * "A base de cálculo é o valor dos PRODUTOS, ou seja, o total das linhas de itens do orçamento
 * EXCETUANDO: o valor correspondente aos impostos e qualquer item cuja categoria seja 'Frete' ou 'Instalação'.
 * Comissão = (soma das linhas comissionáveis, com desconto proporcional aplicado) x percentual de comissão."
 */
export function calculateCommission(
  items: QuoteItem[] = [],
  discountPercent: number = 0,
  commissionPercent: number = 0,
): { commissionBase: number; commissionAmount: number } {
  if (!items || items.length === 0 || !commissionPercent || commissionPercent <= 0) {
    return { commissionBase: 0, commissionAmount: 0 }
  }

  // Soma de todas as linhas de itens comissionáveis (excluindo Frete e Instalação)
  // Impostos (icms, ipi, pis, cofins) ficam fora da base por definição
  let comissionableSubtotal = 0
  for (const item of items) {
    const cat = (item.category || '').toLowerCase().trim()
    if (cat === 'frete' || cat === 'instalação' || cat === 'instalacao') {
      continue
    }
    const qty = Number(item.quantity) || 0
    const price = Number(item.unit_price) || 0
    comissionableSubtotal += qty * price
  }

  // Desconto proporcional aplicado apenas sobre as linhas comissionáveis
  const discountRate = Math.max(0, Math.min(100, Number(discountPercent) || 0)) / 100
  const commissionBase = Math.max(0, comissionableSubtotal * (1 - discountRate))

  const commRate = Math.max(0, Number(commissionPercent) || 0) / 100
  const commissionAmount = Math.round(commissionBase * commRate * 100) / 100

  return {
    commissionBase: Math.round(commissionBase * 100) / 100,
    commissionAmount,
  }
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

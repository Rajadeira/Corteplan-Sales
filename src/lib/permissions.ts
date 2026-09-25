import type { UserProfile } from '@/contexts/AuthContext'
import type { QuoteRecord, OrderRecord } from '@/types'

/**
 * Verifica se um orçamento pertence ao usuário informado
 */
export function isQuoteOwner(
  quote: Partial<QuoteRecord> | null | undefined,
  user: UserProfile | null | undefined,
): boolean {
  if (!quote || !user) return false
  if (user.role === 'Administrador') return true

  const authId = user.id
  const authName = (user.name || '').toLowerCase().trim()
  const sellerUser = quote.seller_user
  const sellerName = (quote.seller || '').toLowerCase().trim()

  if (sellerUser && sellerUser === authId) return true
  if (authName && sellerName && (sellerName.includes(authName) || authName.includes(sellerName)))
    return true

  return false
}

/**
 * Verifica se um pedido pertence ao usuário informado
 */
export function isOrderOwner(
  order: Partial<OrderRecord> | null | undefined,
  user: UserProfile | null | undefined,
): boolean {
  if (!order || !user) return false
  if (user.role === 'Administrador') return true

  const authId = user.id
  const authName = (user.name || '').toLowerCase().trim()
  const sellerUser = order.seller_user
  const sellerName = (order.seller || '').toLowerCase().trim()

  if (sellerUser && sellerUser === authId) return true
  if (authName && sellerName && (sellerName.includes(authName) || authName.includes(sellerName)))
    return true

  return false
}

/**
 * Retorna se o usuário pode ver os valores completos (total e comissão) do registro.
 * - Admin: vê tudo
 * - Vendedor: vê valores somente se for dono
 */
export function canViewValues(
  record: Partial<QuoteRecord | OrderRecord> | null | undefined,
  user: UserProfile | null | undefined,
): boolean {
  if (!record || !user) return false
  if (user.role === 'Administrador') return true
  // Se for pedido (possui order_number ou collectionName 'orders'), checa isOrderOwner
  if ('order_number' in record) {
    return isOrderOwner(record as OrderRecord, user)
  }
  return isQuoteOwner(record as QuoteRecord, user)
}

/**
 * Retorna se o usuário pode ver a comissão
 * - Admin: vê
 * - Dono: vê
 * - Outros: confidencial
 */
export function canViewCommission(
  record: Partial<QuoteRecord | OrderRecord> | null | undefined,
  user: UserProfile | null | undefined,
): boolean {
  return canViewValues(record, user)
}

/**
 * Retorna se o usuário pode editar, excluir, duplicar ou gerar PDF
 * - Admin: pode tudo
 * - Vendedor: somente se for dono
 */
export function canManageRecord(
  record: Partial<QuoteRecord | OrderRecord> | null | undefined,
  user: UserProfile | null | undefined,
): boolean {
  if (!record || !user) return false
  if (user.role === 'Administrador') return true
  if ('order_number' in record) {
    return isOrderOwner(record as OrderRecord, user)
  }
  return isQuoteOwner(record as QuoteRecord, user)
}

/**
 * Retorna se o usuário tem permissão para excluir um orçamento:
 * Somente quem criou o orçamento ou um Administrador tem acesso total.
 */
export function canDeleteQuote(
  quote: Partial<QuoteRecord> | null | undefined,
  user: UserProfile | null | undefined,
): boolean {
  if (!quote || !user) return false
  if (user.role === 'Administrador') return true

  const authId = user.id
  const authName = (user.name || '').toLowerCase().trim()
  const sellerUser = quote.seller_user
  const sellerName = (quote.seller || '').toLowerCase().trim()

  // Dono pelo id do usuário ou pelo nome registrado
  if (sellerUser && sellerUser === authId) return true
  if (authName && sellerName && (sellerName.includes(authName) || authName.includes(sellerName))) {
    return true
  }

  return false
}

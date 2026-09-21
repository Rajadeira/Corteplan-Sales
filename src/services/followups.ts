import pb from '@/lib/pocketbase/client'
import type { FollowupRecord, FollowupContactType, QuoteRecord } from '@/types'

export interface CreateFollowupData {
  quote: string
  contact_date?: string
  contact_type: FollowupContactType
  notes: string
  author?: string
  author_name?: string
}

export interface UpdateFollowupData {
  contact_date?: string
  contact_type?: FollowupContactType
  notes?: string
}

export const followupService = {
  /**
   * Retorna os follow-ups de um orçamento específico, ordenados por data decrescente
   */
  async getByQuote(quoteId: string): Promise<FollowupRecord[]> {
    return pb.collection('followups').getFullList<FollowupRecord>({
      filter: `quote = "${quoteId}"`,
      sort: '-contact_date,-created',
      expand: 'author,quote,quote.client,quote.seller_user',
    })
  },

  /**
   * Retorna todos os follow-ups (com expand de quote e author)
   */
  async getAll(): Promise<FollowupRecord[]> {
    return pb.collection('followups').getFullList<FollowupRecord>({
      sort: '-contact_date,-created',
      expand: 'author,quote,quote.client,quote.seller_user',
    })
  },

  /**
   * Cria um novo registro de follow-up
   */
  async create(data: CreateFollowupData): Promise<FollowupRecord> {
    const authUser = pb.authStore.model
    const contactDate = data.contact_date || new Date().toISOString()
    const authorId = data.author || authUser?.id
    const authorName = data.author_name || authUser?.name || 'Colaborador'

    return pb.collection('followups').create<FollowupRecord>({
      quote: data.quote,
      contact_date: contactDate,
      contact_type: data.contact_type,
      notes: data.notes,
      author: authorId,
      author_name: authorName,
    })
  },

  /**
   * Atualiza um registro de follow-up existente
   */
  async update(id: string, data: UpdateFollowupData): Promise<FollowupRecord> {
    return pb.collection('followups').update<FollowupRecord>(id, data)
  },

  /**
   * Remove um registro de follow-up
   */
  async delete(id: string): Promise<boolean> {
    return pb.collection('followups').delete(id)
  },
}

/**
 * Regra de negócio de Follow-up descrita pelo usuário:
 * "Orçamento enviado no dia 01, no dia 03 já aparece um aviso para ligar para o cliente pra saber o que ele achou da proposta."
 * Quando um orçamento está com status "Enviado" (ou "Aprovado") há mais de 2 dias (>= 48h) sem nenhum follow-up registrado,
 * ele entra em destaque como "Pendente de retorno".
 * Se já possui ao menos 1 contato de follow-up registrado, verifica se o último contato foi há mais de 2 dias enquanto ainda pendente.
 */
export function getFollowupStatus(
  quote: QuoteRecord,
  followupsForQuote: FollowupRecord[] = [],
): {
  isPendingReturn: boolean
  daysElapsed: number
  lastContactDate?: string
  reason: string
} {
  // Apenas orçamentos Enviados ou Aprovados entram na regra de retorno
  if (quote.status !== 'Enviado' && quote.status !== 'Aprovado') {
    return {
      isPendingReturn: false,
      daysElapsed: 0,
      reason: `Status "${quote.status}" não requer follow-up ativo`,
    }
  }

  const now = new Date()

  // Se não tem nenhum follow-up registrado ainda
  if (!followupsForQuote || followupsForQuote.length === 0) {
    const baseDate = quote.created ? new Date(quote.created) : now
    const diffMs = now.getTime() - baseDate.getTime()
    const daysElapsed = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    // Se enviado há 2 dias ou mais sem retorno registrado
    if (daysElapsed >= 2) {
      return {
        isPendingReturn: true,
        daysElapsed,
        reason: `Enviado há ${daysElapsed} dias sem nenhum contato registrado`,
      }
    }

    return {
      isPendingReturn: false,
      daysElapsed,
      reason: `Enviado há ${daysElapsed} dia(s), prazo de 2 dias em andamento`,
    }
  }

  // Se tem contatos registrados, pega o mais recente
  const sorted = [...followupsForQuote].sort(
    (a, b) =>
      new Date(b.contact_date || b.created).getTime() -
      new Date(a.contact_date || a.created).getTime(),
  )
  const lastContact = sorted[0]
  const lastContactDate = lastContact.contact_date || lastContact.created
  const lastDate = new Date(lastContactDate)
  const diffMs = now.getTime() - lastDate.getTime()
  const daysSinceLastContact = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  // Se o último contato foi há 2 ou mais dias e a proposta ainda continua como Enviada
  if (quote.status === 'Enviado' && daysSinceLastContact >= 2) {
    return {
      isPendingReturn: true,
      daysElapsed: daysSinceLastContact,
      lastContactDate,
      reason: `Último contato há ${daysSinceLastContact} dias sem novo retorno`,
    }
  }

  return {
    isPendingReturn: false,
    daysElapsed: daysSinceLastContact,
    lastContactDate,
    reason: `Último contato registrado há ${daysSinceLastContact} dia(s)`,
  }
}

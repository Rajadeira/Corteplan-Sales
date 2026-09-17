import pb from '@/lib/pocketbase/client'
import type { QuoteRecord, QuoteItem, QuoteStatus, StatusHistoryEntry } from '@/types'

export interface CreateQuoteData {
  client: string
  items: QuoteItem[]
  discount_percent: number
  subtotal: number
  total: number
  status: QuoteStatus
  observations?: string
  status_history?: StatusHistoryEntry[]
  quote_number?: number

  // Novos campos Corteplan
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
  installments?: import('@/types').QuoteInstallment[]
  layout_config?: import('@/types').ProposalLayoutConfig
}

export type UpdateQuoteData = Partial<CreateQuoteData>

export const quoteService = {
  async getAll(): Promise<QuoteRecord[]> {
    return pb.collection('quotes').getFullList<QuoteRecord>({
      sort: '-quote_number',
      expand: 'client,seller_user',
    })
  },

  async getPaginated(
    page = 1,
    perPage = 10,
    statusFilter?: string,
    search?: string,
  ): Promise<{ items: QuoteRecord[]; totalPages: number; totalItems: number }> {
    const filters: string[] = []
    if (statusFilter && statusFilter !== 'Todos') {
      filters.push(`status = '${statusFilter}'`)
    }
    if (search && search.trim()) {
      const clean = search.replace(/'/g, "\\'")
      filters.push(
        `(observations ~ '${clean}' || client.name ~ '${clean}' || client.company ~ '${clean}')`,
      )
    }

    const filterString = filters.join(' && ')
    const res = await pb.collection('quotes').getList<QuoteRecord>(page, perPage, {
      filter: filterString || undefined,
      sort: '-quote_number',
      expand: 'client,seller_user',
    })
    return {
      items: res.items,
      totalPages: res.totalPages,
      totalItems: res.totalItems,
    }
  },

  async getById(id: string): Promise<QuoteRecord> {
    return pb.collection('quotes').getOne<QuoteRecord>(id, {
      expand: 'client,seller_user',
    })
  },

  async getByClientId(clientId: string): Promise<QuoteRecord[]> {
    return pb.collection('quotes').getFullList<QuoteRecord>({
      filter: `client = '${clientId}'`,
      sort: '-created',
    })
  },

  async getNextQuoteNumber(): Promise<{ nextNumber: number; formatted: string }> {
    try {
      // First try our custom server-side endpoint
      const res = await pb.send<{ nextNumber: number; formatted: string }>(
        '/backend/v1/next-quote-number',
        {
          method: 'GET',
        },
      )
      if (res && res.nextNumber) return res
    } catch (_) {
      // fallback to querying highest quote_number directly
    }

    // Fallback: check app_settings for last_quote_number (offset 140 from old app)
    let minBase = 140
    try {
      const settingRec = await pb
        .collection('app_settings')
        .getFirstListItem<{ value: number | string }>('setting_key = "last_quote_number"')
      if (settingRec && settingRec.value !== undefined) {
        const parsed = parseInt(String(settingRec.value), 10)
        if (!isNaN(parsed) && parsed >= 0) {
          minBase = parsed
        }
      }
    } catch {
      minBase = 140
    }

    try {
      const records = await pb.collection('quotes').getList<QuoteRecord>(1, 1, {
        sort: '-quote_number',
      })
      if (records.items.length > 0) {
        const highest = records.items[0].quote_number || 0
        const candidate = highest > minBase ? highest : minBase
        const next = candidate + 1
        return {
          nextNumber: next,
          formatted: `ORÇ-${String(next).padStart(3, '0')}`,
        }
      }
    } catch {
      /* intentionally ignored */
    }

    const next = minBase + 1
    return { nextNumber: next, formatted: `ORÇ-${String(next).padStart(3, '0')}` }
  },

  async create(data: CreateQuoteData, userName: string = 'Usuário'): Promise<QuoteRecord> {
    // If quote_number not supplied, fetch the next one
    let quoteNumber = data.quote_number
    if (!quoteNumber || quoteNumber <= 0) {
      const { nextNumber } = await this.getNextQuoteNumber()
      quoteNumber = nextNumber
    }

    const initialHistory: StatusHistoryEntry[] = data.status_history?.length
      ? data.status_history
      : [
          {
            status: data.status,
            changed_at: new Date().toISOString(),
            changed_by: userName,
          },
        ]

    return pb.collection('quotes').create<QuoteRecord>(
      {
        ...data,
        quote_number: quoteNumber,
        status_history: initialHistory,
      },
      {
        expand: 'client',
      },
    )
  },

  async update(id: string, data: UpdateQuoteData): Promise<QuoteRecord> {
    return pb.collection('quotes').update<QuoteRecord>(id, data, {
      expand: 'client',
    })
  },

  async updateStatus(
    id: string,
    newStatus: QuoteStatus,
    userName: string = 'Usuário',
  ): Promise<QuoteRecord> {
    const current = await this.getById(id)
    const history: StatusHistoryEntry[] = Array.isArray(current.status_history)
      ? [...current.status_history]
      : []

    history.push({
      status: newStatus,
      changed_at: new Date().toISOString(),
      changed_by: userName,
    })

    const updated = await pb.collection('quotes').update<QuoteRecord>(
      id,
      {
        status: newStatus,
        status_history: history,
      },
      {
        expand: 'client,seller_user',
      },
    )

    // Se mudou para "Aprovado", disparar notificações para vendedor e admins
    if (newStatus === 'Aprovado' && current.status !== 'Aprovado') {
      try {
        const { notificationService } = await import('./notifications')
        const currentUserId = pb.authStore.record?.id
        const sellerUserId =
          updated.seller_user ||
          current.seller_user ||
          (typeof updated.expand?.seller_user === 'object' && updated.expand?.seller_user
            ? (updated.expand.seller_user as { id?: string }).id
            : undefined)

        const clientName = updated.expand?.client?.name || current.expand?.client?.name || 'Cliente'

        await notificationService.notifyQuoteApproved({
          quoteId: updated.id,
          quoteNumber: updated.quote_number,
          clientName,
          sellerUserId,
          approverUserId: currentUserId,
          approverName: userName,
        })
      } catch (notifyErr) {
        console.warn('Erro ao disparar notificações de orçamento aprovado:', notifyErr)
      }
    }

    return updated
  },

  async delete(id: string): Promise<boolean> {
    return pb.collection('quotes').delete(id)
  },
}

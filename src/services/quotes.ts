import pb from '@/lib/pocketbase/client'
import type { QuoteRecord, QuoteItem, QuoteStatus, StatusHistoryEntry } from '@/types'

export interface CreateQuoteData {
  client: string
  items: QuoteItem[]
  discount_percent: number
  discount_value?: number
  subtotal: number
  total: number
  status: QuoteStatus
  observations?: string
  status_history?: StatusHistoryEntry[]
  quote_number?: number
  revision?: number
  parent_quote?: string

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
      sort: '-quote_number,-revision',
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
      sort: '-quote_number,-revision',
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
      expand: 'client,seller_user,parent_quote',
    })
  },

  /**
   * Retorna todas as versões/revisões de um mesmo número de orçamento
   */
  async getRevisionsByQuoteNumber(quoteNumber: number): Promise<QuoteRecord[]> {
    return pb.collection('quotes').getFullList<QuoteRecord>({
      filter: `quote_number = ${quoteNumber}`,
      sort: 'revision',
      expand: 'client,seller_user',
    })
  },

  /**
   * Obtém o próximo número de revisão para um orçamento específico
   */
  async getNextRevisionNumber(quoteNumber: number): Promise<number> {
    const list = await pb.collection('quotes').getList<QuoteRecord>(1, 1, {
      filter: `quote_number = ${quoteNumber}`,
      sort: '-revision',
    })
    if (list.items.length > 0) {
      const highest = list.items[0].revision || 0
      return highest + 1
    }
    return 1
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
        revision: data.revision !== undefined ? data.revision : 0,
        status_history: initialHistory,
      },
      {
        expand: 'client,seller_user',
      },
    )
  },

  /**
   * Cria uma nova revisão a partir de um orçamento existente (Rev01, Rev02, ...)
   * Mantém o orçamento original intacto no histórico e retorna a nova versão
   */
  async createRevision(
    originalQuoteId: string,
    updatedData: Partial<CreateQuoteData>,
    userName: string = 'Usuário',
  ): Promise<QuoteRecord> {
    const original = await this.getById(originalQuoteId)
    const quoteNumber = original.quote_number
    const nextRevision = await this.getNextRevisionNumber(quoteNumber)

    const revStr = `Rev${String(nextRevision).padStart(2, '0')}`

    // Herda todos os dados do original, sobrescrevendo com o que foi alterado
    const newItems = updatedData.items || original.items || []
    const newInstallments = updatedData.installments || original.installments || []
    const newHistory: StatusHistoryEntry[] = [
      {
        status: updatedData.status || 'Rascunho',
        changed_at: new Date().toISOString(),
        changed_by: userName,
      },
    ]

    const newQuotePayload: Record<string, unknown> = {
      quote_number: quoteNumber,
      revision: nextRevision,
      parent_quote: original.id,
      client: updatedData.client || original.client,
      items: newItems,
      discount_percent:
        updatedData.discount_percent !== undefined
          ? updatedData.discount_percent
          : original.discount_percent || 0,
      discount_value:
        updatedData.discount_value !== undefined
          ? updatedData.discount_value
          : original.discount_value || 0,
      subtotal: updatedData.subtotal !== undefined ? updatedData.subtotal : original.subtotal || 0,
      total: updatedData.total !== undefined ? updatedData.total : original.total || 0,
      status: updatedData.status || 'Rascunho',
      observations:
        updatedData.observations !== undefined ? updatedData.observations : original.observations,
      seller: updatedData.seller !== undefined ? updatedData.seller : original.seller,
      seller_user:
        updatedData.seller_user !== undefined ? updatedData.seller_user : original.seller_user,
      commission_percent:
        updatedData.commission_percent !== undefined
          ? updatedData.commission_percent
          : original.commission_percent,
      validity_days:
        updatedData.validity_days !== undefined
          ? updatedData.validity_days
          : original.validity_days,
      delivery_term:
        updatedData.delivery_term !== undefined
          ? updatedData.delivery_term
          : original.delivery_term,
      payment_terms:
        updatedData.payment_terms !== undefined
          ? updatedData.payment_terms
          : original.payment_terms,
      icms: updatedData.icms !== undefined ? updatedData.icms : original.icms || 0,
      ipi: updatedData.ipi !== undefined ? updatedData.ipi : original.ipi || 0,
      pis: updatedData.pis !== undefined ? updatedData.pis : original.pis || 0,
      cofins: updatedData.cofins !== undefined ? updatedData.cofins : original.cofins || 0,
      installments: newInstallments,
      layout_config:
        updatedData.layout_config !== undefined
          ? updatedData.layout_config
          : original.layout_config,
      status_history: newHistory,
      // Nova versão inicia sem pedido vinculado (pedido do original não é afetado)
      order_number: 0,
      order_id: '',
    }

    const created = await pb.collection('quotes').create<QuoteRecord>(newQuotePayload, {
      expand: 'client,seller_user,parent_quote',
    })

    return created
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

  /**
   * Obtém a contagem de vínculos associados a um orçamento antes de excluir:
   * - Quantidade de revisões vinculadas
   * - Quantidade de follow-ups
   * - Quantidade de pedidos vinculados
   */
  async getLinkedCounts(
    quoteId: string,
    quoteNumber?: number,
  ): Promise<{
    revisionsCount: number
    followupsCount: number
    ordersCount: number
  }> {
    try {
      const [followupsRes, ordersRes] = await Promise.all([
        pb
          .collection('followups')
          .getList(1, 1, {
            filter: `quote = '${quoteId}'`,
          })
          .catch(() => ({ totalItems: 0 })),
        pb
          .collection('orders')
          .getList(1, 1, {
            filter: `quote = '${quoteId}' || quote_number = ${quoteNumber || 0}`,
          })
          .catch(() => ({ totalItems: 0 })),
      ])

      let revisionsCount = 0
      if (quoteNumber) {
        const revsRes = await pb
          .collection('quotes')
          .getList(1, 100, {
            filter: `quote_number = ${quoteNumber} && id != '${quoteId}'`,
          })
          .catch(() => ({ totalItems: 0 }))
        revisionsCount = revsRes.totalItems
      }

      return {
        revisionsCount,
        followupsCount: followupsRes.totalItems,
        ordersCount: ordersRes.totalItems,
      }
    } catch {
      return {
        revisionsCount: 0,
        followupsCount: 0,
        ordersCount: 0,
      }
    }
  },

  /**
   * Obtém histórico recente de itens utilizados em orçamentos anteriores
   */
  async getRecentItemsHistory(limit: number = 30): Promise<QuoteItem[]> {
    try {
      const records = await pb.collection('quotes').getList<QuoteRecord>(1, limit, {
        sort: '-created',
        fields: 'id,items,quote_number',
      })
      const allItems: QuoteItem[] = []
      const seenDescriptions = new Set<string>()

      for (const record of records.items) {
        if (!Array.isArray(record.items)) continue
        for (const it of record.items) {
          const descKey = (it.description || '').trim().toLowerCase()
          if (!descKey || seenDescriptions.has(descKey)) continue
          seenDescriptions.add(descKey)
          allItems.push(it)
        }
      }
      return allItems
    } catch (err) {
      console.warn('Erro ao carregar histórico de itens de orçamentos:', err)
      return []
    }
  },
}

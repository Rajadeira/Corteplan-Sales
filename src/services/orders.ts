import pb from '@/lib/pocketbase/client'
import type { OrderRecord, OrderStatus, QuoteRecord, StatusHistoryEntry } from '@/types'
import { calculateCommission } from '@/types'

export interface CreateOrderData {
  order_number?: number
  client: string
  quote?: string
  quote_number?: number
  items: import('@/types').QuoteItem[]
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
  installments?: import('@/types').QuoteInstallment[]
  icms?: number
  ipi?: number
  pis?: number
  cofins?: number
  layout_config?: import('@/types').ProposalLayoutConfig
}

export type UpdateOrderData = Partial<CreateOrderData>

export const orderService = {
  async getAll(): Promise<OrderRecord[]> {
    return pb.collection('orders').getFullList<OrderRecord>({
      sort: '-order_number',
      expand: 'client,quote,seller_user',
    })
  },

  async getPaginated(
    page = 1,
    perPage = 10,
    statusFilter?: string,
    search?: string,
  ): Promise<{ items: OrderRecord[]; totalPages: number; totalItems: number }> {
    const filters: string[] = []
    if (statusFilter && statusFilter !== 'Todos') {
      filters.push(`status = '${statusFilter}'`)
    }
    if (search && search.trim()) {
      const clean = search.replace(/'/g, "\\'")
      filters.push(
        `(observations ~ '${clean}' || client.name ~ '${clean}' || client.company ~ '${clean}' || seller ~ '${clean}')`,
      )
    }

    const filterString = filters.join(' && ')
    const res = await pb.collection('orders').getList<OrderRecord>(page, perPage, {
      filter: filterString || undefined,
      sort: '-order_number',
      expand: 'client,quote,seller_user',
    })
    return {
      items: res.items,
      totalPages: res.totalPages,
      totalItems: res.totalItems,
    }
  },

  async getById(id: string): Promise<OrderRecord> {
    return pb.collection('orders').getOne<OrderRecord>(id, {
      expand: 'client,quote,seller_user',
    })
  },

  async getNextOrderNumber(): Promise<{ nextNumber: number; formatted: string }> {
    try {
      const res = await pb.send<{ nextNumber: number; formatted: string }>(
        '/backend/v1/next-order-number',
        {
          method: 'GET',
        },
      )
      if (res && res.nextNumber) return res
    } catch {
      /* intentionally ignored */
    }

    // Fallback: check app_settings for last_order_number
    let minBase = 0
    try {
      const settingRec = await pb
        .collection('app_settings')
        .getFirstListItem<{ value: number | string }>('setting_key = "last_order_number"')
      if (settingRec && settingRec.value !== undefined) {
        const parsed = parseInt(String(settingRec.value), 10)
        if (!isNaN(parsed) && parsed >= 0) {
          minBase = parsed
        }
      }
    } catch {
      minBase = 0
    }

    try {
      const records = await pb.collection('orders').getList<OrderRecord>(1, 1, {
        sort: '-order_number',
      })
      if (records.items.length > 0) {
        const highest = records.items[0].order_number || 0
        const candidate = highest > minBase ? highest : minBase
        const next = candidate + 1
        return {
          nextNumber: next,
          formatted: `PED-${String(next).padStart(3, '0')}`,
        }
      }
    } catch {
      /* fallback */
    }

    const next = minBase + 1
    return { nextNumber: next, formatted: `PED-${String(next).padStart(3, '0')}` }
  },

  async create(data: CreateOrderData, userName: string = 'Usuário'): Promise<OrderRecord> {
    let orderNumber = data.order_number
    if (!orderNumber || orderNumber <= 0) {
      const { nextNumber } = await this.getNextOrderNumber()
      orderNumber = nextNumber
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

    // Calcula a comissão se não veio calculada
    let commissionValue = data.commission_value
    if (commissionValue === undefined || commissionValue === null) {
      const { commissionAmount } = calculateCommission(
        data.items,
        data.discount_percent,
        data.commission_percent,
      )
      commissionValue = commissionAmount
    }

    return pb.collection('orders').create<OrderRecord>(
      {
        ...data,
        order_number: orderNumber,
        status_history: initialHistory,
        commission_value: commissionValue,
      },
      {
        expand: 'client,quote,seller_user',
      },
    )
  },

  /**
   * Gera um pedido a partir de um orçamento (QuoteRecord).
   * Herda todos os dados do orçamento (cliente, itens, valores, parcelas, impostos, vendedor)
   * e atualiza o orçamento com order_number e order_id vinculados.
   */
  async createFromQuote(quote: QuoteRecord, userName: string = 'Usuário'): Promise<OrderRecord> {
    const { nextNumber } = await this.getNextOrderNumber()

    const { commissionAmount } = calculateCommission(
      quote.items || [],
      quote.discount_percent || 0,
      quote.commission_percent || 0,
    )

    const orderData: CreateOrderData = {
      order_number: nextNumber,
      client: quote.client,
      quote: quote.id,
      quote_number: quote.quote_number,
      items: quote.items || [],
      discount_percent: quote.discount_percent || 0,
      subtotal: quote.subtotal || 0,
      total: quote.total || 0,
      status: 'Aberto',
      observations: quote.observations,
      seller: quote.seller,
      seller_user: quote.seller_user,
      commission_percent: quote.commission_percent || 0,
      commission_value: commissionAmount,
      validity_days: quote.validity_days,
      delivery_term: quote.delivery_term,
      payment_terms: quote.payment_terms,
      installments: quote.installments,
      icms: quote.icms,
      ipi: quote.ipi,
      pis: quote.pis,
      cofins: quote.cofins,
      layout_config: quote.layout_config,
      status_history: [
        {
          status: 'Aberto',
          changed_at: new Date().toISOString(),
          changed_by: userName,
        },
      ],
    }

    const createdOrder = await pb.collection('orders').create<OrderRecord>(orderData, {
      expand: 'client,quote,seller_user',
    })

    // Vincula o número do pedido no orçamento de origem
    try {
      await pb.collection('quotes').update(quote.id, {
        order_number: createdOrder.order_number,
        order_id: createdOrder.id,
      })
    } catch (err) {
      console.warn('Erro ao atualizar quote com order_number:', err)
    }

    return createdOrder
  },

  async update(id: string, data: UpdateOrderData): Promise<OrderRecord> {
    return pb.collection('orders').update<OrderRecord>(id, data, {
      expand: 'client,quote,seller_user',
    })
  },

  async updateStatus(
    id: string,
    newStatus: OrderStatus,
    userName: string = 'Usuário',
  ): Promise<OrderRecord> {
    const current = await this.getById(id)
    const history: StatusHistoryEntry[] = Array.isArray(current.status_history)
      ? [...current.status_history]
      : []

    history.push({
      status: newStatus,
      changed_at: new Date().toISOString(),
      changed_by: userName,
    })

    return pb.collection('orders').update<OrderRecord>(
      id,
      {
        status: newStatus,
        status_history: history,
      },
      {
        expand: 'client,quote,seller_user',
      },
    )
  },

  async delete(id: string): Promise<boolean> {
    return pb.collection('orders').delete(id)
  },
}

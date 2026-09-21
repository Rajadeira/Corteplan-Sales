import pb from '@/lib/pocketbase/client'
import type {
  CashflowEntryRecord,
  CashflowType,
  CashflowOrigin,
  CashflowStatus,
  OrderRecord,
} from '@/types'

export interface CreateCashflowEntryData {
  type: CashflowType
  date: string // YYYY-MM-DD
  description: string
  amount: number
  category?: string
  origin: CashflowOrigin
  status: CashflowStatus
  order?: string
  installment_number?: number
  payment_method?: string
  received_at?: string
  notes?: string
}

export type UpdateCashflowEntryData = Partial<CreateCashflowEntryData>

export interface MonthlyCashflowSummary {
  totalIncomes: number
  totalExpenses: number
  balance: number
  pendingIncomes: number
  realizedIncomes: number
}

export const cashflowService = {
  async getAll(): Promise<CashflowEntryRecord[]> {
    return pb.collection('cashflow_entries').getFullList<CashflowEntryRecord>({
      sort: '-date,-created',
      expand: 'order',
    })
  },

  async getByDateRange(startDate: string, endDate: string): Promise<CashflowEntryRecord[]> {
    return pb.collection('cashflow_entries').getFullList<CashflowEntryRecord>({
      filter: `date >= "${startDate}" && date <= "${endDate}"`,
      sort: 'date',
      expand: 'order',
    })
  },

  async getById(id: string): Promise<CashflowEntryRecord> {
    return pb.collection('cashflow_entries').getOne<CashflowEntryRecord>(id, {
      expand: 'order',
    })
  },

  async create(data: CreateCashflowEntryData): Promise<CashflowEntryRecord> {
    return pb.collection('cashflow_entries').create<CashflowEntryRecord>(data, {
      expand: 'order',
    })
  },

  async update(id: string, data: UpdateCashflowEntryData): Promise<CashflowEntryRecord> {
    return pb.collection('cashflow_entries').update<CashflowEntryRecord>(id, data, {
      expand: 'order',
    })
  },

  async delete(id: string): Promise<boolean> {
    return pb.collection('cashflow_entries').delete(id)
  },

  /**
   * Marca uma entrada ou parcela como recebida
   */
  async markAsReceived(id: string, receivedDate?: string): Promise<CashflowEntryRecord> {
    const finalDate = receivedDate || new Date().toISOString().split('T')[0]
    return pb.collection('cashflow_entries').update<CashflowEntryRecord>(
      id,
      {
        status: 'Realizado',
        received_at: finalDate,
      },
      {
        expand: 'order',
      },
    )
  },

  /**
   * Sincroniza parcelas dos pedidos para a collection cashflow_entries
   * Cria ou atualiza lançamentos de parcelas previstas se ainda não existirem
   */
  async syncInstallmentsFromOrders(orders: OrderRecord[]): Promise<number> {
    let createdCount = 0
    try {
      // Buscar todas as entradas existentes com origem parcela
      const existingEntries = await pb
        .collection('cashflow_entries')
        .getFullList<CashflowEntryRecord>({
          filter: 'origin = "parcela"',
        })

      const existingMap = new Set<string>()
      existingEntries.forEach((entry) => {
        if (entry.order && entry.installment_number) {
          existingMap.add(`${entry.order}_${entry.installment_number}`)
        }
      })

      for (const order of orders) {
        if (!order.installments || !Array.isArray(order.installments)) continue
        if (order.status === 'Cancelado') continue

        for (const inst of order.installments) {
          const key = `${order.id}_${inst.number}`
          if (!existingMap.has(key) && inst.value > 0) {
            let instDate = inst.date
            if (!instDate) {
              instDate = order.created
                ? order.created.split('T')[0]
                : new Date().toISOString().split('T')[0]
            } else if (instDate.includes('T')) {
              instDate = instDate.split('T')[0]
            }

            const clientName = order.expand?.client?.name || 'Cliente'

            await pb.collection('cashflow_entries').create<CashflowEntryRecord>({
              type: 'Entrada',
              date: instDate,
              description: `Parcela ${inst.number}/${order.installments.length} - Pedido ${order.order_number} (${clientName})`,
              amount: inst.value,
              category: 'Venda de Mobiliário / Serviços',
              origin: 'parcela',
              status: 'Pendente',
              order: order.id,
              installment_number: inst.number,
              payment_method: inst.method || 'Boleto',
              notes: `Pedido #${order.order_number}`,
            })
            existingMap.add(key)
            createdCount++
          }
        }
      }
    } catch (err) {
      console.warn('Erro na sincronização de parcelas:', err)
    }
    return createdCount
  },
}

import pb from '@/lib/pocketbase/client'
import type { ClientRecord } from '@/types'

export interface CreateClientData {
  name: string
  email?: string
  phone: string
  company?: string
  address?: string
  city?: string
  notes?: string
  document_type?: 'CNPJ' | 'CPF'
  document_number?: string
  trade_name?: string
  contact_name?: string
  zip_code?: string
  neighborhood?: string
  state?: string
}

export type UpdateClientData = Partial<CreateClientData>

export const clientService = {
  async getAll(): Promise<ClientRecord[]> {
    return pb.collection('clients').getFullList<ClientRecord>({
      sort: '-created',
    })
  },

  async getById(id: string): Promise<ClientRecord> {
    return pb.collection('clients').getOne<ClientRecord>(id)
  },

  async create(data: CreateClientData): Promise<ClientRecord> {
    return pb.collection('clients').create<ClientRecord>(data)
  },

  async update(id: string, data: UpdateClientData): Promise<ClientRecord> {
    return pb.collection('clients').update<ClientRecord>(id, data)
  },

  /**
   * Verifica se o cliente possui vínculos em orçamentos ou pedidos
   */
  async checkClientDependencies(
    clientId: string,
  ): Promise<{ quotesCount: number; ordersCount: number }> {
    try {
      const [quotesRes, ordersRes] = await Promise.all([
        pb.collection('quotes').getList(1, 1, {
          filter: `client = '${clientId}'`,
          fields: 'id',
        }),
        pb.collection('orders').getList(1, 1, {
          filter: `client = '${clientId}'`,
          fields: 'id',
        }),
      ])
      return {
        quotesCount: quotesRes.totalItems,
        ordersCount: ordersRes.totalItems,
      }
    } catch (err) {
      console.warn('Erro ao verificar dependências do cliente:', err)
      return { quotesCount: 0, ordersCount: 0 }
    }
  },

  async delete(id: string): Promise<boolean> {
    return pb.collection('clients').delete(id)
  },

  async search(query: string): Promise<ClientRecord[]> {
    if (!query.trim()) return []
    const clean = query.replace(/'/g, "\\'")
    return pb
      .collection('clients')
      .getList<ClientRecord>(1, 10, {
        filter: `name ~ '${clean}' || company ~ '${clean}' || email ~ '${clean}' || phone ~ '${clean}' || document_number ~ '${clean}' || trade_name ~ '${clean}'`,
        sort: 'name',
      })
      .then((res) => res.items)
  },
}

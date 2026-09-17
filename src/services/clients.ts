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

  async delete(id: string): Promise<boolean> {
    return pb.collection('clients').delete(id)
  },

  async search(query: string): Promise<ClientRecord[]> {
    if (!query.trim()) return []
    const clean = query.replace(/'/g, "\\'")
    return pb
      .collection('clients')
      .getList<ClientRecord>(1, 10, {
        filter: `name ~ '${clean}' || company ~ '${clean}' || email ~ '${clean}' || phone ~ '${clean}'`,
        sort: 'name',
      })
      .then((res) => res.items)
  },
}

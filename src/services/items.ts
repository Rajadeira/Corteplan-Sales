import { pb } from '@/lib/pocketbase/client'
import type { ItemCatalogRecord } from '@/types'

export type CreateItemData = Omit<
  ItemCatalogRecord,
  'id' | 'created' | 'updated' | 'collectionId' | 'collectionName'
>
export type UpdateItemData = Partial<CreateItemData>

export const itemService = {
  async getAll(): Promise<ItemCatalogRecord[]> {
    return pb.collection('items').getFullList<ItemCatalogRecord>({
      sort: 'description',
    })
  },

  async getById(id: string): Promise<ItemCatalogRecord> {
    return pb.collection('items').getOne<ItemCatalogRecord>(id)
  },

  async create(data: CreateItemData): Promise<ItemCatalogRecord> {
    return pb.collection('items').create<ItemCatalogRecord>(data)
  },

  async update(id: string, data: UpdateItemData): Promise<ItemCatalogRecord> {
    return pb.collection('items').update<ItemCatalogRecord>(id, data)
  },

  async delete(id: string): Promise<boolean> {
    return pb.collection('items').delete(id)
  },
}

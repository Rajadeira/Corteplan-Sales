import pb from '@/lib/pocketbase/client'
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

  /**
   * Busca itens por termo na descrição ou código
   */
  async search(term: string): Promise<ItemCatalogRecord[]> {
    const clean = term.trim()
    if (!clean) return []
    return pb
      .collection('items')
      .getList<ItemCatalogRecord>(1, 20, {
        filter: `description ~ "${clean}" || code ~ "${clean}"`,
        sort: 'description',
      })
      .then((res) => res.items)
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

  /**
   * Garante a persistência/exportação de itens de um orçamento para o catálogo de produtos (menu Itens).
   * Se um item com a mesma descrição já existir no catálogo, ele não é duplicado.
   * Não lança erro fatal caso a criação falhe (respeita regras de permissão silenciosamente).
   */
  async exportItemsFromQuote(
    quoteItems: import('@/types').QuoteItem[],
    userId?: string,
  ): Promise<void> {
    if (!quoteItems || quoteItems.length === 0) return

    try {
      // Carrega os itens já existentes no catálogo para comparar por descrição
      const existingItems = await pb.collection('items').getFullList<ItemCatalogRecord>({
        fields: 'id,description,code',
      })
      const existingDescSet = new Set(
        existingItems.map((it) => (it.description || '').trim().toLowerCase()),
      )

      for (const item of quoteItems) {
        const desc = (item.description || '').trim()
        if (!desc) continue
        const descKey = desc.toLowerCase()

        if (!existingDescSet.has(descKey)) {
          // Marca imediatamente para não duplicar itens repetidos no mesmo orçamento
          existingDescSet.add(descKey)

          try {
            await pb.collection('items').create({
              description: desc,
              category: item.category || 'Mobiliário',
              unit: item.unit || 'un',
              unit_price: Number(item.unit_price) || 0,
              default_tax: Number(item.tax) || 0,
              technical_description: item.technical_description?.trim() || undefined,
              image: item.image || undefined,
              active: true,
              created_by: userId || undefined,
            })
          } catch (createErr) {
            console.warn(`Aviso ao exportar item "${desc}" para o catálogo:`, createErr)
          }
        }
      }
    } catch (err) {
      console.warn('Erro ao sincronizar catálogo de produtos a partir dos itens do orçamento:', err)
    }
  },
}

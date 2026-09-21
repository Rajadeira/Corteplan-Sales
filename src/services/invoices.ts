import pb from '@/lib/pocketbase/client'
import type { InvoiceRecord, InvoiceStatus, OrderRecord } from '@/types'

export interface CreateInvoiceData {
  invoice_number?: string
  series?: string
  access_key?: string
  status: InvoiceStatus
  provider?: string
  order?: string
  quote?: string
  client_name: string
  client_document?: string
  total_amount: number
  issued_at?: string
  danfe_url?: string
  xml_url?: string
  error_message?: string
  raw_payload?: any
  raw_response?: any
}

export interface EmitInvoicePayload {
  orderId?: string
  invoiceData: {
    invoice_number?: string
    series?: string
    client_name: string
    client_document?: string
    client_address?: string
    client_city?: string
    client_state?: string
    client_zip?: string
    total_amount: number
    subtotal?: number
    discount_percent?: number
    icms?: number
    ipi?: number
    pis?: number
    cofins?: number
    items?: any[]
    installments?: any[]
  }
}

export const invoiceService = {
  async getAll(): Promise<InvoiceRecord[]> {
    return pb.collection('invoices').getFullList<InvoiceRecord>({
      sort: '-created',
      expand: 'order,quote',
    })
  },

  async getById(id: string): Promise<InvoiceRecord> {
    return pb.collection('invoices').getOne<InvoiceRecord>(id, {
      expand: 'order,quote',
    })
  },

  async getByOrderId(orderId: string): Promise<InvoiceRecord | null> {
    try {
      return await pb
        .collection('invoices')
        .getFirstListItem<InvoiceRecord>(`order = "${orderId}"`, {
          sort: '-created',
          expand: 'order,quote',
        })
    } catch {
      return null
    }
  },

  async create(data: CreateInvoiceData): Promise<InvoiceRecord> {
    return pb.collection('invoices').create<InvoiceRecord>(data, {
      expand: 'order,quote',
    })
  },

  async update(id: string, data: Partial<CreateInvoiceData>): Promise<InvoiceRecord> {
    return pb.collection('invoices').update<InvoiceRecord>(id, data, {
      expand: 'order,quote',
    })
  },

  async delete(id: string): Promise<boolean> {
    return pb.collection('invoices').delete(id)
  },

  /**
   * Dispara a emissão de NF-e via backend hook (/backend/v1/invoices/emit)
   * que utiliza com segurança as credenciais salvas sem expor ao frontend
   */
  async emitInvoice(payload: EmitInvoicePayload): Promise<{
    success: boolean
    invoice: Partial<InvoiceRecord>
    message: string
  }> {
    return pb.send<{
      success: boolean
      invoice: Partial<InvoiceRecord>
      message: string
    }>('/backend/v1/invoices/emit', {
      method: 'POST',
      body: payload,
    })
  },

  /**
   * Dispara o cancelamento de NF-e via backend hook (/backend/v1/invoices/cancel)
   */
  async cancelInvoice(
    invoiceId: string,
    reason: string,
  ): Promise<{
    success: boolean
    apiCancelled: boolean
    message: string
    invoice: Partial<InvoiceRecord>
  }> {
    return pb.send<{
      success: boolean
      apiCancelled: boolean
      message: string
      invoice: Partial<InvoiceRecord>
    }>('/backend/v1/invoices/cancel', {
      method: 'POST',
      body: { invoiceId, reason },
    })
  },
}

import pb from '@/lib/pocketbase/client'
import type {
  SupplierInvoiceRecord,
  SupplierCertificateInfo,
  ParseXmlFilePayload,
  ParseXmlImportResponse,
} from '@/types'

export const supplierInvoicesService = {
  /**
   * Lista todas as notas fiscais de fornecedor importadas
   */
  async getAll(): Promise<SupplierInvoiceRecord[]> {
    return pb.collection('supplier_invoices').getFullList<SupplierInvoiceRecord>({
      sort: '-issue_date,-created',
      expand: 'cashflow_entry',
    })
  },

  /**
   * Busca uma nota fiscal pelo ID
   */
  async getById(id: string): Promise<SupplierInvoiceRecord> {
    return pb.collection('supplier_invoices').getOne<SupplierInvoiceRecord>(id, {
      expand: 'cashflow_entry',
    })
  },

  /**
   * Envia arquivos XML de NF-e para o parser de backend.
   * O backend faz a deduplicação pela chave de 44 dígitos e cria o lançamento no Caixa.
   */
  async parseAndImportXml(files: ParseXmlFilePayload[]): Promise<ParseXmlImportResponse> {
    return pb.send<ParseXmlImportResponse>('/backend/v1/supplier-invoices/parse-and-import', {
      method: 'POST',
      body: { files },
    })
  },

  /**
   * Exclui uma nota fiscal de fornecedor e seu lançamento vinculado no Caixa
   */
  async deleteInvoice(id: string): Promise<{ success: boolean; message: string }> {
    return pb.send<{ success: boolean; message: string }>(
      `/backend/v1/supplier-invoices/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
      },
    )
  },

  /**
   * Cadastro rápido de fornecedor na collection clients a partir dos dados do XML
   */
  async quickCreateSupplier(data: {
    cnpj: string
    name: string
    tradeName?: string
    address?: string
    city?: string
    state?: string
  }): Promise<{ success: boolean; message: string; client: { id: string; name: string } }> {
    return pb.send('/backend/v1/supplier-invoices/quick-create-supplier', {
      method: 'POST',
      body: data,
    })
  },

  /**
   * Salva dados do Certificado Digital A1 no backend (com senha protegida)
   */
  async saveCertificate(data: {
    filename: string
    password: string
    validUntil?: string
    subjectName?: string
    cnpj?: string
  }): Promise<{ success: boolean; message: string; certificate: SupplierCertificateInfo }> {
    return pb.send('/backend/v1/supplier-certificates/save-info', {
      method: 'POST',
      body: data,
    })
  },

  /**
   * Consulta o status do Certificado A1 ativo (sem expor a senha)
   */
  async getCertificateStatus(): Promise<{
    configured: boolean
    certificate: SupplierCertificateInfo | null
  }> {
    return pb.send('/backend/v1/supplier-certificates/status', {
      method: 'GET',
    })
  },

  /**
   * Remove o Certificado A1 ativo
   */
  async deleteCertificate(id: string): Promise<{ success: boolean; message: string }> {
    return pb.send(`/backend/v1/supplier-certificates/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    })
  },
}

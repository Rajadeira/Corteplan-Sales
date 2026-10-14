import pb from '@/lib/pocketbase/client'
import type { RiskLevel, MonitoredClientRecord } from '@/types'
import { formatCurrencyBRL } from '@/types'
import { cleanDocument } from '@/lib/cnpjCpfUtils'

export interface ClientFinancialStats {
  totalInstallments: number
  paidInstallments: number
  overdueInstallments: number
  futureInstallments: number
  paidAmount: number
  overdueAmount: number
  futureAmount: number
  totalAmount: number
  maxOverdueDays: number
  hasHistory: boolean
}

export interface RiskAnalysisResult {
  level: RiskLevel
  reason: string
  stats: ClientFinancialStats
  situacaoCadastral: string
}

export interface MonitoredClientPayload {
  cnpj: string
  razao_social: string
  nome_fantasia?: string
  risco: RiskLevel
  risco_motivo?: string
  situacao_cadastral?: string
  cnae?: string
  cnae_descricao?: string
  natureza_juridica?: string
  natureza_juridica_codigo?: string
  ultima_consulta?: string
  criado_por?: string
  external_score?: number | null
  external_score_label?: string
  external_alerts?: import('@/types').ConfereCnpjAlert[]
  external_cnd_federal?: import('@/types').ConfereCndInfo
  external_cndt?: import('@/types').ConfereCndInfo
  external_consulted_at?: string
  external_raw_summary?: unknown
}

/**
 * Calcula os fatores e nível de risco de inadimplência baseado em:
 * - Histórico real de parcelas do Fluxo de Caixa vinculadas aos pedidos do cliente
 * - Dias de atraso da parcela mais antiga
 * - Montante vencido vs em aberto vs pago
 * - Situação cadastral na Receita (Inapta, Baixada, Suspensa, etc.)
 */
export async function calculateClientRisk(
  cnpj: string,
  situacaoCadastral: string = 'ATIVA',
): Promise<RiskAnalysisResult> {
  const cleanCnpj = cleanDocument(cnpj)
  const todayStr = new Date().toISOString().split('T')[0]
  const todayDate = new Date(`${todayStr}T00:00:00`)

  // 1. Localizar clientes com este CNPJ no sistema
  let clientIds: string[] = []
  try {
    const clients = await pb.collection('clients').getFullList({
      filter: `document_number ~ "${cleanCnpj}" || document_number ~ "${cnpj}"`,
    })
    clientIds = clients.map((c) => c.id)
  } catch (err) {
    console.warn('Erro ao buscar cliente por CNPJ no cálculo de risco:', err)
  }

  // Se não encontrou por doc exato, tenta buscar pedidos onde o cliente tem o mesmo CNPJ
  let orderIds: string[] = []
  if (clientIds.length > 0) {
    try {
      const orderFilter = clientIds.map((id) => `client = "${id}"`).join(' || ')
      const orders = await pb.collection('orders').getFullList({
        filter: orderFilter,
      })
      orderIds = orders.map((o) => o.id)
    } catch (err) {
      console.warn('Erro ao buscar pedidos do cliente:', err)
    }
  }

  // 2. Buscar parcelas no fluxo de caixa (origin = 'parcela')
  const stats: ClientFinancialStats = {
    totalInstallments: 0,
    paidInstallments: 0,
    overdueInstallments: 0,
    futureInstallments: 0,
    paidAmount: 0,
    overdueAmount: 0,
    futureAmount: 0,
    totalAmount: 0,
    maxOverdueDays: 0,
    hasHistory: false,
  }

  if (orderIds.length > 0) {
    try {
      const orderFilter = orderIds.map((id) => `order = "${id}"`).join(' || ')
      const entries = await pb.collection('cashflow_entries').getFullList({
        filter: `origin = "parcela" && (${orderFilter})`,
      })

      if (entries.length > 0) {
        stats.hasHistory = true
        stats.totalInstallments = entries.length

        for (const entry of entries) {
          const amount = Number(entry.amount) || 0
          stats.totalAmount += amount

          if (entry.status === 'Realizado') {
            stats.paidInstallments += 1
            stats.paidAmount += amount
          } else {
            // Pendente: verificar se está vencida
            const entryDateStr = (entry.date || '').split('T')[0]
            if (entryDateStr && entryDateStr < todayStr) {
              stats.overdueInstallments += 1
              stats.overdueAmount += amount

              const entryDate = new Date(`${entryDateStr}T00:00:00`)
              const diffMs = todayDate.getTime() - entryDate.getTime()
              const diffDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))
              if (diffDays > stats.maxOverdueDays) {
                stats.maxOverdueDays = diffDays
              }
            } else {
              stats.futureInstallments += 1
              stats.futureAmount += amount
            }
          }
        }
      }
    } catch (err) {
      console.warn('Erro ao buscar fluxo de caixa do cliente:', err)
    }
  }

  const sitUpper = (situacaoCadastral || '').toUpperCase().trim()
  const isCadastralIrregular =
    sitUpper.includes('INAPTA') ||
    sitUpper.includes('BAIXADA') ||
    sitUpper.includes('SUSPENSA') ||
    sitUpper.includes('NULA')

  // Se não há histórico no sistema de parcelas
  if (!stats.hasHistory) {
    if (isCadastralIrregular) {
      return {
        level: 'Altíssimo',
        reason: `Sem histórico financeiro interno, porém situação cadastral irregular na Receita Federal (${situacaoCadastral}).`,
        stats,
        situacaoCadastral,
      }
    }
    return {
      level: 'Sem histórico',
      reason: 'Nenhuma parcela ou pedido faturado registrado no sistema para este CNPJ.',
      stats,
      situacaoCadastral,
    }
  }

  // Avaliação de risco com histórico:
  // Fatores:
  // - Dias de atraso
  // - Qtd de parcelas vencidas
  // - Situação cadastral irregular
  let level: RiskLevel = 'Baixo'
  const reasons: string[] = []

  if (isCadastralIrregular) {
    level = 'Altíssimo'
    reasons.push(`Situação cadastral na Receita é ${situacaoCadastral}`)
  }

  if (stats.overdueInstallments > 0) {
    const plural = stats.overdueInstallments === 1 ? 'parcela' : 'parcelas'
    const diasText = stats.maxOverdueDays === 1 ? 'há 1 dia' : `há ${stats.maxOverdueDays} dias`
    reasons.push(
      `${stats.overdueInstallments} ${plural} em atraso ${diasText} · ${formatCurrencyBRL(stats.overdueAmount)} em atraso`,
    )

    if (stats.maxOverdueDays > 60 || stats.overdueInstallments >= 3) {
      level = 'Altíssimo'
    } else if (stats.maxOverdueDays > 30 || stats.overdueInstallments >= 2) {
      if (level !== 'Altíssimo') level = 'Alto'
    } else {
      if (level !== 'Altíssimo') level = 'Médio'
    }
  } else {
    // Nenhuma vencida
    if (stats.futureInstallments > 0) {
      const plural = stats.futureInstallments === 1 ? 'parcela a vencer' : 'parcelas a vencer'
      reasons.push(
        `Pagamentos em dia · ${stats.futureInstallments} ${plural} (${formatCurrencyBRL(stats.futureAmount)})`,
      )
    } else {
      reasons.push(
        `Todas as ${stats.paidInstallments} parcelas quitadas (${formatCurrencyBRL(stats.paidAmount)}) · Sem pendências`,
      )
    }
    if (!isCadastralIrregular) {
      level = 'Baixo'
    }
  }

  return {
    level,
    reason: reasons.join(' · '),
    stats,
    situacaoCadastral,
  }
}

export const riskAnalysisService = {
  /**
   * Lista todos os clientes na carteira de monitoramento
   */
  async listMonitored(): Promise<MonitoredClientRecord[]> {
    return pb.collection('monitored_clients').getFullList<MonitoredClientRecord>({
      sort: '-updated,-created',
      expand: 'criado_por',
    })
  },

  /**
   * Busca um cliente monitorado pelo CNPJ limpo ou formatado
   */
  async findByCnpj(cnpj: string): Promise<MonitoredClientRecord | null> {
    const clean = cleanDocument(cnpj)
    try {
      const records = await pb.collection('monitored_clients').getFullList<MonitoredClientRecord>({
        filter: `cnpj = "${clean}" || cnpj = "${cnpj}"`,
        limit: 1,
      })
      return records[0] || null
    } catch (_) {
      return null
    }
  },

  /**
   * Salva (cria ou atualiza) um cliente na carteira de monitoramento
   */
  async saveMonitored(data: MonitoredClientPayload): Promise<MonitoredClientRecord> {
    const cleanCnpj = cleanDocument(data.cnpj)
    const existing = await this.findByCnpj(cleanCnpj)

    const payload: Record<string, unknown> = {
      ...data,
      cnpj: cleanCnpj,
      ultima_consulta: data.ultima_consulta || new Date().toISOString(),
    }

    // Se external_score não foi passado ou é nulo, preserva se já existia no registro
    if (data.external_score === undefined && existing?.external_score !== undefined) {
      payload.external_score = existing.external_score
    }
    if (data.external_score_label === undefined && existing?.external_score_label !== undefined) {
      payload.external_score_label = existing.external_score_label
    }
    if (data.external_alerts === undefined && existing?.external_alerts !== undefined) {
      payload.external_alerts = existing.external_alerts
    }
    if (data.external_cnd_federal === undefined && existing?.external_cnd_federal !== undefined) {
      payload.external_cnd_federal = existing.external_cnd_federal
    }
    if (data.external_cndt === undefined && existing?.external_cndt !== undefined) {
      payload.external_cndt = existing.external_cndt
    }
    if (data.external_consulted_at === undefined && existing?.external_consulted_at !== undefined) {
      payload.external_consulted_at = existing.external_consulted_at
    }

    if (existing) {
      return pb
        .collection('monitored_clients')
        .update<MonitoredClientRecord>(existing.id, payload, {
          expand: 'criado_por',
        })
    }

    return pb.collection('monitored_clients').create<MonitoredClientRecord>(payload, {
      expand: 'criado_por',
    })
  },

  /**
   * Executa a pesquisa externa segura no Confere CNPJ através do backend
   */
  async consultConfereCnpj(cnpj: string): Promise<import('@/types').ConfereCnpjResponse> {
    const clean = cleanDocument(cnpj)
    if (clean.length !== 14) {
      throw new Error('CNPJ inválido para consulta externa.')
    }
    return pb.send<import('@/types').ConfereCnpjResponse>(`/backend/v1/confere-cnpj/${clean}`, {
      method: 'GET',
    })
  },

  /**
   * Testa a validade da API Key e a conectividade com o Confere CNPJ
   */
  async testConfereConnection(apiKey?: string): Promise<{
    valid: boolean
    message: string
    creditsRemaining?: number | null
    consultationId?: string | null
    error?: string
    code?: string
  }> {
    return pb.send('/backend/v1/confere-cnpj/test-connection', {
      method: 'POST',
      body: { apiKey: apiKey || '' },
    })
  },

  /**
   * Remove um cliente da carteira de monitoramento
   */
  async removeMonitored(id: string): Promise<boolean> {
    return pb.collection('monitored_clients').delete(id)
  },
}

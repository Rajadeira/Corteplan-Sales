import React, { useState, useEffect } from 'react'
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  Printer,
  Clock,
  Ban,
  CheckCircle,
  PlayCircle,
  AlertTriangle,
  Loader2,
  Package,
} from 'lucide-react'
import { orderService } from '@/services/orders'
import { useAuth } from '@/contexts/AuthContext'
import type { OrderRecord, OrderStatus, ProposalLayoutConfig, ProposalBlockId } from '@/types'
import {
  DEFAULT_PAGE1_ORDER,
  DEFAULT_PAGE2_ORDER,
  LayoutBlockWrapper,
} from '@/components/ProposalLayoutEditor'
import {
  formatCurrencyBRL,
  formatDateBR,
  formatDateTimeBR,
  formatDateExtendedBR,
  formatOrderNumber,
  formatQuoteNumber,
  maskPhoneBR,
  CORTEPLAN_COMPANY_INFO,
} from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import CorteplanLogo from '@/components/CorteplanLogo'
import { toast } from 'sonner'

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [order, setOrder] = useState<OrderRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [statusLoading, setStatusLoading] = useState(false)
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false)

  const [layoutConfig, setLayoutConfig] = useState<ProposalLayoutConfig>({
    version: 1,
    page1Order: DEFAULT_PAGE1_ORDER,
    page2Order: DEFAULT_PAGE2_ORDER,
    blocks: {},
  })

  const loadOrder = async () => {
    if (!id) return
    try {
      const data = await orderService.getById(id)
      setOrder(data)
      if (data.layout_config && typeof data.layout_config === 'object') {
        setLayoutConfig({
          version: data.layout_config.version || 1,
          page1Order: data.layout_config.page1Order || DEFAULT_PAGE1_ORDER,
          page2Order: data.layout_config.page2Order || DEFAULT_PAGE2_ORDER,
          blocks: data.layout_config.blocks || {},
        })
      }
    } catch (err) {
      console.error('Erro ao carregar pedido:', err)
      toast.error('Pedido não encontrado.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadOrder()
  }, [id])

  // Dispara print se ?print=true estiver na URL
  useEffect(() => {
    if (searchParams.get('print') === 'true' && order && !loading) {
      const timer = setTimeout(() => {
        window.print()
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [searchParams, order, loading])

  const handleUpdateStatus = async (newStatus: OrderStatus) => {
    if (!id || !order) return
    setStatusLoading(true)
    try {
      const userName = user?.name || 'Usuário'
      const updated = await orderService.updateStatus(id, newStatus, userName)
      setOrder(updated)
      toast.success(`Status atualizado para "${newStatus}"!`)
      if (newStatus === 'Cancelado') {
        setIsCancelModalOpen(false)
      }
    } catch (err) {
      console.error('Erro ao atualizar status do pedido:', err)
      toast.error('Erro ao atualizar status do pedido.')
    } finally {
      setStatusLoading(false)
    }
  }

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'Concluído':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            Concluído
          </span>
        )
      case 'Em Produção':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
            Em Produção
          </span>
        )
      case 'Cancelado':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-300">
            Cancelado
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300">
            Aberto
          </span>
        )
    }
  }

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <Loader2 className="h-8 w-8 animate-spin text-[#3A3A3C]" />
          <p className="text-sm">Carregando pedido da Corteplan...</p>
        </div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="text-center py-16 space-y-4">
        <h2 className="text-xl font-bold text-slate-800">Pedido não encontrado</h2>
        <Button onClick={() => navigate('/pedidos')} variant="outline" className="rounded-xl">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar para Pedidos
        </Button>
      </div>
    )
  }

  const client = order.expand?.client
  const produtosTotal = order.subtotal || 0
  const icmsVal = order.icms || 0
  const ipiVal = order.ipi || 0
  const pisVal = order.pis || 0
  const cofinsVal = order.cofins || 0
  const hasTaxBreakdown = icmsVal > 0 || ipiVal > 0 || pisVal > 0 || cofinsVal > 0

  const sellerName =
    order.seller || order.expand?.seller_user?.name || user?.name || 'Gustavo Tibério'
  const validityDays = order.validity_days || 5
  const deliveryTerm = order.delivery_term || 'À Combinar'
  const paymentTerms = order.payment_terms || 'Entrada 50% + 2x'

  const installments =
    order.installments && order.installments.length > 0
      ? order.installments
      : [
          {
            number: 1,
            date: order.created ? order.created.split('T')[0] : '2026-09-14',
            method: 'Boleto',
            value: order.total || 0,
          },
        ]

  return (
    <div className="space-y-6 pb-16 print:p-0 print:m-0 print:space-y-0">
      {/* Botão de retorno */}
      <div className="print:hidden">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/pedidos')}
          className="text-slate-600 hover:text-slate-900 -ml-2 rounded-xl"
        >
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Voltar para a lista de pedidos
        </Button>
      </div>

      {/* Header da Página no App (Escondido na impressão) */}
      <div className="print:hidden bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="font-mono text-2xl font-bold text-[#3A3A3C] tracking-tight">
              Pedido Nº {order.order_number}
            </span>
            {getStatusBadge(order.status)}
          </div>
          <p className="text-xs text-slate-500">
            Documento de Pedido <strong>CORTEPLAN</strong> &bull; Emitido em{' '}
            {formatDateBR(order.created)}
            {order.quote_number && (
              <span className="ml-2">
                &bull; Gerado do Orçamento{' '}
                <Link
                  to={`/orcamentos/${order.quote || ''}`}
                  className="font-mono text-[#F08A24] hover:underline font-semibold"
                >
                  {formatQuoteNumber(order.quote_number)}
                </Link>
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-3 self-start md:self-auto shrink-0 flex-wrap">
          <Button
            onClick={() => window.print()}
            className="rounded-xl bg-[#3A3A3C] hover:bg-[#2D2D2F] text-white font-medium shadow-sm transition-all duration-200 hover:scale-[1.02]"
          >
            <Printer className="h-4 w-4 mr-1.5 text-[#F08A24]" />
            Imprimir / Salvar PDF
          </Button>

          {order.status !== 'Cancelado' && (
            <Button
              variant="outline"
              onClick={() => setIsCancelModalOpen(true)}
              className="rounded-xl border-red-200 text-red-600 hover:bg-red-50"
            >
              <Ban className="h-4 w-4 mr-1.5" />
              Cancelar Pedido
            </Button>
          )}
        </div>
      </div>

      {/* Painel de Gestão de Status do Pedido (Escondido na impressão) */}
      <div className="print:hidden bg-slate-900 text-white p-5 rounded-2xl shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block">
            Status da Produção
          </span>
          <h3 className="text-sm font-bold text-white mt-0.5">
            Acompanhamento e evolução deste pedido
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Vendedor: <strong className="text-white">{sellerName}</strong> &bull; Entrega:{' '}
            {deliveryTerm}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {order.status !== 'Em Produção' && order.status !== 'Concluído' && (
            <Button
              size="sm"
              disabled={statusLoading}
              onClick={() => handleUpdateStatus('Em Produção')}
              className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold"
            >
              <PlayCircle className="h-3.5 w-3.5 mr-1.5" />
              Iniciar Produção
            </Button>
          )}

          {order.status !== 'Concluído' && (
            <Button
              size="sm"
              disabled={statusLoading}
              onClick={() => handleUpdateStatus('Concluído')}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold"
            >
              <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
              Marcar como Concluído
            </Button>
          )}

          {order.status === 'Cancelado' && (
            <Button
              size="sm"
              disabled={statusLoading}
              onClick={() => handleUpdateStatus('Aberto')}
              className="bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-semibold"
            >
              Reabrir Pedido
            </Button>
          )}
        </div>
      </div>

      {/* =========================================================================
          DOCUMENTO OFICIAL CORTEPLAN — MODELO PEDIDO Nº X (IMPRESSÃO A4)
          Título "Pedido Nº X" no lugar de "Proposta Nº X", sem dados de comissão
          ========================================================================= */}
      <div className="bg-slate-100 p-2 sm:p-6 rounded-2xl print:bg-white print:p-0 print:m-0 print:rounded-none">
        <div
          id="proposal-sheet"
          className="proposal-document-sheet max-w-[840px] mx-auto bg-white border border-slate-200 sm:rounded-xl shadow-lg print:border-none print:shadow-none print:max-w-none print:p-0"
        >
          {/* =========================================================
              PÁGINA 1 — CABEÇALHO, ITENS, OBSERVAÇÕES E TOTAIS DO PEDIDO
              ========================================================= */}
          <section className="p-8 sm:p-12 print:p-0 font-sans text-slate-900 text-[13px] leading-normal space-y-4 bg-white">
            {layoutConfig.page1Order.map((blockId) => {
              if (blockId === 'header') {
                return (
                  <div
                    key={blockId}
                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 pb-6 border-b border-slate-200"
                  >
                    <div className="flex items-center">
                      <CorteplanLogo width={200} height={48} />
                    </div>

                    <div className="text-right text-[11px] sm:text-xs text-slate-600 leading-tight space-y-0.5">
                      <div className="font-bold text-slate-900 tracking-wider">
                        {CORTEPLAN_COMPANY_INFO.name}
                      </div>
                      <div>CNPJ: {CORTEPLAN_COMPANY_INFO.cnpj}</div>
                      <div>{CORTEPLAN_COMPANY_INFO.address}</div>
                      <div>Telefone: {CORTEPLAN_COMPANY_INFO.phone}</div>
                      <div>E-mail: {CORTEPLAN_COMPANY_INFO.email}</div>
                    </div>
                  </div>
                )
              }

              if (blockId === 'client') {
                return (
                  <div
                    key={blockId}
                    className="pt-2 pb-2 space-y-0.5 text-xs text-slate-700 max-w-xl"
                  >
                    <div className="font-bold text-slate-900 text-sm tracking-tight uppercase">
                      {client?.name || 'CLIENTE NÃO IDENTIFICADO'}
                      {client?.company && client.company !== client.name
                        ? ` - ${client.company}`
                        : ''}
                    </div>
                    <div className="text-slate-600">
                      <span className="font-medium text-slate-700">CNPJ/CPF: </span>
                      {client?.document_number
                        ? client.document_number
                        : client?.notes?.includes('CNPJ:')
                          ? client.notes.split('CNPJ:')[1]?.split('\n')[0]?.trim()
                          : 'Conforme cadastro'}
                    </div>
                    <div>
                      {(() => {
                        const parts: string[] = []
                        if (client?.address) parts.push(client.address)
                        if (client?.neighborhood) parts.push(`Bairro: ${client.neighborhood}`)
                        if (client?.city) {
                          parts.push(client.city)
                        } else if (client?.state) {
                          parts.push(client.state)
                        }
                        return parts.length > 0 ? parts.join(' - ') : 'Endereço cadastrado'
                      })()}
                    </div>
                    <div>
                      <span className="font-medium text-slate-700">Telefone: </span>
                      {maskPhoneBR(client?.phone || '')}
                    </div>
                    {client?.email && (
                      <div>
                        <span className="font-medium text-slate-700">E-mail: </span>
                        {client.email}
                      </div>
                    )}
                    <div>
                      <span className="font-medium text-slate-700">Contato: </span>
                      {client?.contact_name || client?.name?.split(' ')[0] || 'Responsável'}
                    </div>{' '}
                  </div>
                )
              }

              if (blockId === 'title_date') {
                return (
                  <div
                    key={blockId}
                    className="pt-1 pb-2 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100"
                  >
                    <div>
                      <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                        Pedido Nº {order.order_number}
                      </h2>
                      {order.quote_number && (
                        <p className="text-[11px] text-slate-500 font-mono">
                          Referência: Orçamento Nº {order.quote_number}
                        </p>
                      )}
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-[11px] sm:text-xs text-slate-600">
                        {formatDateExtendedBR(order.created, CORTEPLAN_COMPANY_INFO.city)}
                      </p>
                    </div>
                  </div>
                )
              }

              if (blockId === 'intro') {
                return (
                  <div key={blockId} className="py-1 text-xs text-slate-700">
                    <p>
                      Confirmamos o pedido de fornecimento com itens, quantidades, especificações e
                      condições comerciais discriminados abaixo:
                    </p>
                  </div>
                )
              }

              if (blockId === 'items') {
                return (
                  <div key={blockId} className="overflow-x-auto my-2">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-t border-b border-slate-300 bg-slate-50/60 font-bold text-slate-900">
                          <th className="py-2 px-2 w-10 text-center">Item</th>
                          <th className="py-2 px-3">Descrição</th>
                          <th className="py-2 px-3 text-center w-20">Quant.</th>
                          <th className="py-2 px-3 text-right w-28">Valor Unit.</th>
                          <th className="py-2 px-3 text-right w-28">Valor Total</th>
                        </tr>
                      </thead>
                      {order.items?.map((item, index) => {
                        const itemTotal = (item.quantity || 0) * (item.unit_price || 0)
                        return (
                          <tbody
                            key={index}
                            className="divide-y divide-slate-200 border-b border-slate-200 print-avoid-break"
                          >
                            <tr className="align-top print-avoid-break">
                              <td className="py-3 px-2 text-center font-bold text-slate-800">
                                {index + 1}
                              </td>
                              <td className="py-3 px-3">
                                <div className="flex items-start gap-3">
                                  {item.image && (
                                    <div className="shrink-0 rounded overflow-hidden border border-slate-200 bg-white print:border-slate-300">
                                      <img
                                        src={item.image}
                                        alt={item.description}
                                        className="h-[76px] w-auto max-w-[110px] object-contain block"
                                        style={{ height: '76px', maxHeight: '76px' }}
                                      />
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <div className="font-bold text-slate-900 text-[13px]">
                                      {item.description}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-3 text-center whitespace-nowrap text-slate-700">
                                {item.quantity} {item.unit || 'un'}
                              </td>
                              <td className="py-3 px-3 text-right whitespace-nowrap font-mono text-slate-800">
                                {formatCurrencyBRL(item.unit_price)}
                              </td>
                              <td className="py-3 px-3 text-right whitespace-nowrap font-mono font-bold text-slate-900">
                                {formatCurrencyBRL(itemTotal)}
                              </td>
                            </tr>

                            {(item.tax || item.technical_description) && (
                              <tr className="bg-slate-50/40 print:bg-white print-avoid-break">
                                <td></td>
                                <td colSpan={4} className="pb-3 px-3 pt-0">
                                  {item.tax && item.tax > 0 ? (
                                    <div className="text-right text-[11px] text-slate-500 font-mono italic mb-1">
                                      Imp: {formatCurrencyBRL(item.tax)}
                                    </div>
                                  ) : null}
                                  {item.technical_description && (
                                    <p className="text-[11px] text-slate-600 leading-relaxed whitespace-pre-line text-justify">
                                      {item.technical_description}
                                    </p>
                                  )}
                                </td>
                              </tr>
                            )}
                          </tbody>
                        )
                      })}
                    </table>
                  </div>
                )
              }

              if (blockId === 'totals_obs') {
                return (
                  <div
                    key={blockId}
                    className="pt-4 border-t border-slate-300 grid grid-cols-1 md:grid-cols-12 gap-6 items-start"
                  >
                    {/* Observações do Pedido */}
                    <div className="md:col-span-7 space-y-2 text-xs">
                      <div className="font-bold text-slate-900 uppercase tracking-wide text-[11px]">
                        Observações do Pedido
                      </div>

                      <div className="text-[11px] text-slate-600 leading-relaxed space-y-1.5 whitespace-pre-line">
                        {order.observations ? (
                          <p>{order.observations}</p>
                        ) : (
                          <>
                            <p>
                              <strong>Prazo de entrega:</strong> {deliveryTerm}
                            </p>
                            <p>
                              <strong>Pagamento:</strong> {paymentTerms}
                            </p>
                            <p>
                              Este pedido contempla exclusivamente os itens, quantidades, materiais,
                              acabamentos e especificações técnicas descritos.
                            </p>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Bloco de Totais (Sem comissão impressa) */}
                    <div className="md:col-span-5 bg-slate-50/70 p-4 rounded-xl border border-slate-200 space-y-1.5 text-xs">
                      <div className="flex justify-between items-center text-slate-700">
                        <span>Produtos:</span>
                        <span className="font-mono font-medium">
                          {formatCurrencyBRL(produtosTotal)}
                        </span>
                      </div>

                      {hasTaxBreakdown ? (
                        <>
                          <div className="flex justify-between items-center text-slate-600 text-[11px]">
                            <span>ICMS:</span>
                            <span className="font-mono">{formatCurrencyBRL(icmsVal)}</span>
                          </div>
                          <div className="flex justify-between items-center text-slate-600 text-[11px]">
                            <span>IPI:</span>
                            <span className="font-mono">{formatCurrencyBRL(ipiVal)}</span>
                          </div>
                          <div className="flex justify-between items-center text-slate-600 text-[11px]">
                            <span>PIS:</span>
                            <span className="font-mono">{formatCurrencyBRL(pisVal)}</span>
                          </div>
                          <div className="flex justify-between items-center text-slate-600 text-[11px]">
                            <span>COFINS:</span>
                            <span className="font-mono">{formatCurrencyBRL(cofinsVal)}</span>
                          </div>
                        </>
                      ) : null}

                      {order.discount_percent > 0 && (
                        <div className="flex justify-between items-center text-emerald-700 text-[11px]">
                          <span>Desconto ({order.discount_percent}%):</span>
                          <span className="font-mono">
                            - {formatCurrencyBRL((produtosTotal * order.discount_percent) / 100)}
                          </span>
                        </div>
                      )}

                      <div className="pt-2 border-t-2 border-slate-900 flex justify-between items-center">
                        <span className="font-extrabold text-slate-900 text-sm uppercase">
                          Total:
                        </span>
                        <span className="font-mono text-lg font-black text-slate-950">
                          {formatCurrencyBRL(order.total)}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              }

              return null
            })}
          </section>

          {/* =========================================================
              PÁGINA 2 — CONDIÇÕES, PARCELAS E ASSINATURA DO PEDIDO
              ========================================================= */}
          <div className="print-page-break border-t-2 border-dashed border-slate-300 print:border-none" />

          <section className="p-8 sm:p-12 print:p-0 font-sans text-slate-900 text-xs leading-normal space-y-4 bg-white print:pt-4">
            {layoutConfig.page2Order.map((blockId) => {
              if (blockId === 'conditions_summary') {
                return (
                  <div
                    key={blockId}
                    className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-300 text-xs"
                  >
                    <div className="space-y-1">
                      <div>
                        <span className="font-bold text-slate-900">Vendedor: </span>
                        <span className="text-slate-700">{sellerName}</span>
                      </div>
                      <div>
                        <span className="font-bold text-slate-900">Prazo de Entrega: </span>
                        <span className="text-slate-700">{deliveryTerm}</span>
                      </div>
                    </div>

                    <div className="space-y-1 text-right">
                      <div>
                        <span className="font-bold text-slate-900">Validade: </span>
                        <span className="text-slate-700">{validityDays} dias.</span>
                      </div>
                      <div>
                        <span className="font-bold text-slate-900">Cond. pagamento: </span>
                        <span className="text-slate-700">{paymentTerms}</span>
                      </div>
                    </div>
                  </div>
                )
              }

              if (blockId === 'installments') {
                return (
                  <div key={blockId} className="my-3">
                    <div className="font-bold text-slate-900 uppercase tracking-wide text-[11px] mb-2">
                      Programação de Parcelas / Pagamento do Pedido
                    </div>
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-t border-b border-slate-300 bg-slate-50/70 font-bold text-slate-900">
                          <th className="py-2 px-3 w-20">Parcela</th>
                          <th className="py-2 px-3">Data</th>
                          <th className="py-2 px-3">Forma de Pagamento</th>
                          <th className="py-2 px-3 text-right">Valor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {installments.map((inst, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50 print-avoid-break">
                            <td className="py-2 px-3 font-semibold text-slate-800">
                              {inst.number}
                            </td>
                            <td className="py-2 px-3 text-slate-700 font-mono">
                              {formatDateBR(inst.date)}
                            </td>
                            <td className="py-2 px-3 text-slate-700">{inst.method}</td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                              {formatCurrencyBRL(inst.value)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              }

              if (blockId === 'signature') {
                return (
                  <div
                    key={blockId}
                    className="pt-10 mt-6 border-t border-slate-300 print-avoid-break"
                  >
                    <div className="max-w-md mx-auto space-y-8 text-center text-xs text-slate-700">
                      <div className="space-y-1">
                        <div className="border-b border-slate-900 w-full h-8" />
                        <div className="font-semibold text-slate-800 text-[11px] uppercase tracking-wider pt-1">
                          Aprovação do Pedido / Nome Legível
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="border-b border-slate-900 w-full h-8" />
                        <div className="font-semibold text-slate-800 text-[11px] uppercase tracking-wider pt-1">
                          Assinatura do Cliente
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="border-b border-slate-900 w-full h-8" />
                        <div className="font-semibold text-slate-800 text-[11px] uppercase tracking-wider pt-1">
                          Data
                        </div>
                      </div>
                    </div>
                  </div>
                )
              }

              if (blockId === 'footer') {
                return (
                  <div
                    key={blockId}
                    className="pt-8 text-center text-[11px] text-slate-400 print:hidden"
                  >
                    {CORTEPLAN_COMPANY_INFO.name} &bull; CNPJ: {CORTEPLAN_COMPANY_INFO.cnpj} &bull;{' '}
                    {CORTEPLAN_COMPANY_INFO.phone} &bull; {CORTEPLAN_COMPANY_INFO.email}
                  </div>
                )
              }

              return null
            })}
          </section>

          {/* Rodapé institucional fixo no rodapé de CADA página impressa via CSS print-fixed-footer */}
          <footer className="hidden print-fixed-footer" aria-hidden="true">
            <div className="font-semibold text-slate-500 tracking-wide">
              {CORTEPLAN_COMPANY_INFO.name} &bull; CNPJ: {CORTEPLAN_COMPANY_INFO.cnpj} &bull;{' '}
              {CORTEPLAN_COMPANY_INFO.phone} &bull; {CORTEPLAN_COMPANY_INFO.email}
            </div>
          </footer>
        </div>
      </div>

      {/* Linha do Tempo de Status do Pedido (Apenas na tela) */}
      <div className="print:hidden bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 pb-2 border-b border-slate-100">
          Linha do Tempo do Pedido
        </h3>

        {!order.status_history || order.status_history.length === 0 ? (
          <p className="text-xs text-slate-400">Nenhum evento registrado ainda.</p>
        ) : (
          <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
            {order.status_history.map((entry, index) => {
              let dotColor = 'bg-slate-400'
              if (entry.status === 'Concluído') dotColor = 'bg-emerald-500'
              if (entry.status === 'Em Produção') dotColor = 'bg-amber-500'
              if (entry.status === 'Cancelado') dotColor = 'bg-red-500'
              if (entry.status === 'Aberto') dotColor = 'bg-blue-500'

              return (
                <div key={index} className="relative group">
                  <span
                    className={`absolute -left-6 top-1 h-3.5 w-3.5 rounded-full border-2 border-white ring-2 ring-slate-100 ${dotColor}`}
                  />
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-900">
                        Status: {entry.status}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                      <Clock className="h-3 w-3" />
                      <span>{formatDateTimeBR(entry.changed_at)}</span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Registrado por:{' '}
                      <span className="font-medium text-slate-600">{entry.changed_by}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal de Cancelamento de Pedido */}
      <Dialog open={isCancelModalOpen} onOpenChange={setIsCancelModalOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <div className="h-10 w-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-2">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <DialogTitle className="text-base font-bold text-slate-900">
              Confirmar cancelamento do pedido?
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Você está prestes a cancelar o{' '}
              <strong className="text-slate-900 font-mono">
                {formatOrderNumber(order.order_number)}
              </strong>
              . O histórico do pedido será mantido com status Cancelado.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCancelModalOpen(false)}
              disabled={statusLoading}
              className="rounded-xl"
            >
              Voltar
            </Button>
            <Button
              type="button"
              onClick={() => handleUpdateStatus('Cancelado')}
              disabled={statusLoading}
              className="rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium"
            >
              {statusLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Cancelando...
                </>
              ) : (
                <>
                  <Ban className="h-4 w-4 mr-2" />
                  Confirmar Cancelamento
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

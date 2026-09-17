import React, { useState, useEffect } from 'react'
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  Edit,
  Printer,
  CheckCircle,
  XCircle,
  Send,
  Loader2,
  Clock,
  Sparkles,
  PackageCheck,
  ExternalLink,
} from 'lucide-react'
import { quoteService } from '@/services/quotes'
import { orderService } from '@/services/orders'
import { useAuth } from '@/contexts/AuthContext'
import type {
  QuoteRecord,
  QuoteStatus,
  ProposalLayoutConfig,
  ProposalBlockId,
  BlockStyleConfig,
} from '@/types'
import { canViewValues, canManageRecord } from '@/lib/permissions'
import { Lock, ShieldAlert } from 'lucide-react'
import {
  CorelToolbar,
  LayoutBlockWrapper,
  DEFAULT_PAGE1_ORDER,
  DEFAULT_PAGE2_ORDER,
  DEFAULT_BLOCK_STYLE,
} from '@/components/ProposalLayoutEditor'
import {
  formatCurrencyBRL,
  formatDateBR,
  formatDateTimeBR,
  formatDateExtendedBR,
  formatOrderNumber,
  formatQuoteNumber,
  maskPhoneBR,
  calculateCommission,
  CORTEPLAN_COMPANY_INFO,
} from '@/types'
import { Button } from '@/components/ui/button'
import CorteplanLogo from '@/components/CorteplanLogo'
import { toast } from 'sonner'

export default function QuoteDetail() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [quote, setQuote] = useState<QuoteRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [statusLoading, setStatusLoading] = useState(false)
  const [generatingOrder, setGeneratingOrder] = useState(false)

  // Estado do Modo de Diagramação / Ajuste Manual de Layout (estilo CorelDRAW)
  const [isLayoutEditMode, setIsLayoutEditMode] = useState(false)
  const [selectedBlockId, setSelectedBlockId] = useState<ProposalBlockId | null>(null)
  const [layoutConfig, setLayoutConfig] = useState<ProposalLayoutConfig>({
    version: 1,
    page1Order: DEFAULT_PAGE1_ORDER,
    page2Order: DEFAULT_PAGE2_ORDER,
    blocks: {},
  })
  const [savingLayout, setSavingLayout] = useState(false)

  const loadQuote = async () => {
    if (!id) return
    try {
      const data = await quoteService.getById(id)
      setQuote(data)
      if (data.layout_config && typeof data.layout_config === 'object') {
        setLayoutConfig({
          version: data.layout_config.version || 1,
          page1Order: data.layout_config.page1Order || DEFAULT_PAGE1_ORDER,
          page2Order: data.layout_config.page2Order || DEFAULT_PAGE2_ORDER,
          blocks: data.layout_config.blocks || {},
        })
      }
    } catch (err) {
      console.error('Erro ao carregar orçamento:', err)
      toast.error('Orçamento não encontrado.')
    } finally {
      setLoading(false)
    }
  }

  // Manipulação de estilos dos blocos
  const handleUpdateBlockStyle = (
    blockId: ProposalBlockId,
    newStyle: Partial<BlockStyleConfig>,
  ) => {
    setLayoutConfig((prev) => ({
      ...prev,
      blocks: {
        ...prev.blocks,
        [blockId]: {
          ...(prev.blocks[blockId] || DEFAULT_BLOCK_STYLE),
          ...newStyle,
        },
      },
    }))
  }

  const handleResetBlock = (blockId: ProposalBlockId) => {
    setLayoutConfig((prev) => {
      const nextBlocks = { ...prev.blocks }
      delete nextBlocks[blockId]
      return {
        ...prev,
        blocks: nextBlocks,
      }
    })
    toast.success('Bloco restaurado para o alinhamento padrão.')
  }

  const handleResetAllLayout = () => {
    setLayoutConfig({
      version: 1,
      page1Order: DEFAULT_PAGE1_ORDER,
      page2Order: DEFAULT_PAGE2_ORDER,
      blocks: {},
    })
    setSelectedBlockId(null)
    toast.success('Layout restaurado para o padrão original da Corteplan.')
  }

  const handleMoveBlockOrder = (blockId: ProposalBlockId, direction: 'up' | 'down') => {
    setLayoutConfig((prev) => {
      const isPage1 = prev.page1Order.includes(blockId)
      const listKey = isPage1 ? 'page1Order' : 'page2Order'
      const list = [...prev[listKey]]
      const index = list.indexOf(blockId)
      if (index === -1) return prev

      const targetIndex = direction === 'up' ? index - 1 : index + 1
      if (targetIndex < 0 || targetIndex >= list.length) return prev

      // Troca os elementos
      const temp = list[index]
      list[index] = list[targetIndex]
      list[targetIndex] = temp

      return {
        ...prev,
        [listKey]: list,
      }
    })
  }

  const handleSaveLayout = async () => {
    if (!id) return
    setSavingLayout(true)
    try {
      const toSave: ProposalLayoutConfig = {
        ...layoutConfig,
        version: 1,
        updatedAt: new Date().toISOString(),
      }
      const updated = await quoteService.update(id, {
        layout_config: toSave,
      })
      setQuote(updated)
      toast.success('Layout personalizado salvo com sucesso!')
    } catch (err) {
      console.error('Erro ao salvar layout:', err)
      toast.error('Erro ao salvar o layout diagramado.')
    } finally {
      setSavingLayout(false)
    }
  }

  useEffect(() => {
    loadQuote()
  }, [id])

  // Trigger print se ?print=true estiver na URL
  useEffect(() => {
    if (searchParams.get('print') === 'true' && quote && !loading) {
      const timer = setTimeout(() => {
        window.print()
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [searchParams, quote, loading])

  const handleGenerateOrder = async () => {
    if (!quote) return
    if (quote.status !== 'Enviado' && quote.status !== 'Aprovado') {
      toast.warning('Apenas orçamentos com status "Enviado" ou "Aprovado" podem gerar pedido.')
      return
    }

    setGeneratingOrder(true)
    try {
      const userName = user?.name || 'Gustavo'
      const order = await orderService.createFromQuote(quote, userName)
      toast.success(`Pedido ${formatOrderNumber(order.order_number)} gerado com sucesso!`)
      await loadQuote()
      navigate(`/pedidos/${order.id}`)
    } catch (err) {
      console.error('Erro ao gerar pedido:', err)
      toast.error('Erro ao gerar pedido.')
    } finally {
      setGeneratingOrder(false)
    }
  }

  const handleUpdateStatus = async (newStatus: QuoteStatus) => {
    if (!id || !quote) return
    setStatusLoading(true)
    try {
      const userName = user?.name || 'Gustavo Tibério'
      const updated = await quoteService.updateStatus(id, newStatus, userName)
      setQuote(updated)
      toast.success(`Status atualizado para "${newStatus}"!`)
    } catch (err: unknown) {
      console.error('Erro ao atualizar status:', err)
      toast.error('Erro ao atualizar status do orçamento.')
    } finally {
      setStatusLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Aprovado':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            Aprovado
          </span>
        )
      case 'Enviado':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
            Enviado
          </span>
        )
      case 'Rejeitado':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-300">
            Rejeitado
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">
            Rascunho
          </span>
        )
    }
  }

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <Loader2 className="h-8 w-8 animate-spin text-[#3A3A3C]" />
          <p className="text-sm">Carregando proposta da Corteplan...</p>
        </div>
      </div>
    )
  }

  if (!quote) {
    return (
      <div className="text-center py-16 space-y-4">
        <h2 className="text-xl font-bold text-slate-800">Orçamento não encontrado</h2>
        <Button onClick={() => navigate('/orcamentos')} variant="outline" className="rounded-xl">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar para Orçamentos
        </Button>
      </div>
    )
  }

  // Regra 02: Vendedor só pode visualizar e detalhar seus próprios orçamentos (ou com valores confidenciais se abrir direto)
  const isAllowedToManage = canManageRecord(quote, user)
  const isAllowedToViewValues = canViewValues(quote, user)
  const isAllowedToView = isAllowedToManage || user?.role === 'Administrador'
  if (!isAllowedToView) {
    return (
      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-xs max-w-xl mx-auto my-12 text-center space-y-4">
        <div className="h-14 w-14 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-slate-900">Acesso Restrito / Confidencial</h2>
          <p className="text-sm text-slate-500">
            Este orçamento pertence a outro vendedor. Pelas regras de segurança da Corteplan, você
            não possui permissão para visualizar os detalhes internos, editar, duplicar ou gerar PDF
            desta proposta.
          </p>
        </div>
        <div className="pt-2">
          <Button
            onClick={() => navigate('/orcamentos')}
            className="bg-[#3A3A3C] hover:bg-[#2E2E30] text-white"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar para lista de orçamentos
          </Button>
        </div>
      </div>
    )
  }

  const client = quote.expand?.client

  // Totais: produtos = subtotal; se tiver impostos detalhados
  const produtosTotal = quote.subtotal || 0
  const icmsVal = quote.icms || 0
  const ipiVal = quote.ipi || 0
  const pisVal = quote.pis || 0
  const cofinsVal = quote.cofins || 0
  const hasTaxBreakdown = icmsVal > 0 || ipiVal > 0 || pisVal > 0 || cofinsVal > 0

  const sellerName = quote.seller || user?.name || 'Gustavo Tibério'
  const validityDays = quote.validity_days || 5
  const deliveryTerm = quote.delivery_term || 'À Combinar'
  const paymentTerms = quote.payment_terms || 'Entrada 50% + 2x'

  // Parcelas (se não preenchidas, gera uma padrão baseada no total)
  const installments =
    quote.installments && quote.installments.length > 0
      ? quote.installments
      : [
          {
            number: 1,
            date: quote.created ? quote.created.split('T')[0] : '2026-09-14',
            method: 'Boleto',
            value: quote.total ? Math.round(quote.total * 0.5 * 100) / 100 : 0,
          },
          {
            number: 2,
            date: quote.created ? quote.created.split('T')[0] : '2026-10-14',
            method: 'Boleto',
            value: quote.total ? Math.round(quote.total * 0.25 * 100) / 100 : 0,
          },
          {
            number: 3,
            date: quote.created ? quote.created.split('T')[0] : '2026-11-13',
            method: 'Boleto',
            value: quote.total ? Math.round(quote.total * 0.25 * 100) / 100 : 0,
          },
        ]

  return (
    <div className="space-y-6 pb-16 print:p-0 print:m-0 print:space-y-0">
      {/* Botão de retorno (Escondido em impressão) */}
      <div className="print:hidden">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/orcamentos')}
          className="text-slate-600 hover:text-slate-900 -ml-2 rounded-xl"
        >
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Voltar para a lista de orçamentos
        </Button>
      </div>

      {/* Header da Página no App (Escondido na impressão) */}
      <div className="print:hidden bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="font-mono text-2xl font-bold text-[#3A3A3C] tracking-tight">
              Proposta Nº {quote.quote_number}
            </span>
            {getStatusBadge(quote.status)}
            {quote.order_number && (
              <Link
                to={`/pedidos/${quote.order_id || ''}`}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-orange-50 text-[#E66812] border border-orange-200 hover:bg-orange-100 transition-colors"
                title="Ver pedido vinculado"
              >
                <PackageCheck className="h-3.5 w-3.5" />
                <span>Pedido {formatOrderNumber(quote.order_number)}</span>
                <ExternalLink className="h-3 w-3 opacity-60" />
              </Link>
            )}
          </div>
          <p className="text-xs text-slate-500">
            Layout no padrão oficial <strong>CORTEPLAN</strong> &bull; Emitido em{' '}
            {formatDateBR(quote.created)}
            {quote.order_number && (
              <span className="ml-1 text-[#E66812] font-semibold">
                &bull; Pedido vinculado: {formatOrderNumber(quote.order_number)}
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-3 self-start md:self-auto shrink-0 flex-wrap">
          {isAllowedToManage && (
            <>
              {/* Ação "Gerar pedido" disponível para Enviado ou Aprovado */}
              {(quote.status === 'Enviado' || quote.status === 'Aprovado') && (
                <Button
                  disabled={generatingOrder}
                  onClick={handleGenerateOrder}
                  className="rounded-xl bg-gradient-to-r from-[#E66812] to-[#F08A24] hover:from-[#d1590d] hover:to-[#e07b1a] text-white font-bold shadow-sm transition-all duration-200 hover:scale-[1.02]"
                >
                  {generatingOrder ? (
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  ) : (
                    <PackageCheck className="h-4 w-4 mr-1.5 text-white" />
                  )}
                  {quote.order_number ? 'Gerar Outro Pedido' : 'Gerar Pedido'}
                </Button>
              )}

              <CorelToolbar
                isEditMode={isLayoutEditMode}
                onToggleEditMode={() => {
                  setIsLayoutEditMode((prev) => !prev)
                  setSelectedBlockId(null)
                }}
                selectedBlockId={selectedBlockId}
                layoutConfig={layoutConfig}
                onSelectBlock={setSelectedBlockId}
                onUpdateBlockStyle={handleUpdateBlockStyle}
                onResetBlock={handleResetBlock}
                onResetAll={handleResetAllLayout}
                onSaveLayout={handleSaveLayout}
                saving={savingLayout}
              />

              <Button
                variant="outline"
                onClick={() => navigate(`/orcamentos/${quote.id}/editar`)}
                className="rounded-xl border-slate-300 text-slate-700 hover:bg-slate-50 font-medium"
              >
                <Edit className="h-4 w-4 mr-1.5 text-[#F08A24]" />
                Editar Proposta
              </Button>

              <Button
                onClick={() => window.print()}
                className="rounded-xl bg-[#3A3A3C] hover:bg-[#2D2D2F] text-white font-medium shadow-sm transition-all duration-200 hover:scale-[1.02]"
              >
                <Printer className="h-4 w-4 mr-1.5 text-[#F08A24]" />
                Imprimir / Salvar PDF
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Toolbar Expandida quando o modo de diagramação está ativo */}
      {isLayoutEditMode && (
        <CorelToolbar
          isEditMode={true}
          onToggleEditMode={() => {
            setIsLayoutEditMode(false)
            setSelectedBlockId(null)
          }}
          selectedBlockId={selectedBlockId}
          layoutConfig={layoutConfig}
          onSelectBlock={setSelectedBlockId}
          onUpdateBlockStyle={handleUpdateBlockStyle}
          onResetBlock={handleResetBlock}
          onResetAll={handleResetAllLayout}
          onSaveLayout={handleSaveLayout}
          saving={savingLayout}
        />
      )}

      {/* Painel de Gestão de Status comercial (Escondido na impressão) */}
      <div className="print:hidden bg-slate-900 text-white p-5 rounded-2xl shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block">
            Gestão Comercial
          </span>
          <h3 className="text-sm font-bold text-white mt-0.5">
            Alterar status comercial desta proposta
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Vendedor responsável: <strong className="text-white">{sellerName}</strong> &bull;
            Validade: {validityDays} dias
            {quote.order_number && (
              <span className="ml-2 text-amber-300 font-mono font-bold">
                &bull; Pedido Vinculado: {formatOrderNumber(quote.order_number)}
              </span>
            )}
            {(() => {
              const { commissionAmount } = calculateCommission(
                quote.items,
                quote.discount_percent,
                quote.commission_percent,
              )
              if (commissionAmount > 0) {
                return (
                  <span className="ml-2 text-emerald-400 font-medium">
                    &bull; Comissão interna: {formatCurrencyBRL(commissionAmount)} (
                    {quote.commission_percent}%)
                  </span>
                )
              }
              return null
            })()}
          </p>
        </div>

        {isAllowedToManage && (
          <div className="flex items-center gap-2.5 flex-wrap">
            {quote.status === 'Rascunho' && (
              <Button
                size="sm"
                disabled={statusLoading}
                onClick={() => handleUpdateStatus('Enviado')}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold"
              >
                <Send className="h-3.5 w-3.5 mr-1.5" />
                Enviar ao Cliente
              </Button>
            )}

            {quote.status !== 'Aprovado' && (
              <Button
                size="sm"
                disabled={statusLoading}
                onClick={() => handleUpdateStatus('Aprovado')}
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold"
              >
                <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                Marcar como Aprovado
              </Button>
            )}

            {quote.status !== 'Rejeitado' && (
              <Button
                size="sm"
                disabled={statusLoading}
                onClick={() => handleUpdateStatus('Rejeitado')}
                className="bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold"
              >
                <XCircle className="h-3.5 w-3.5 mr-1.5" />
                Marcar como Rejeitado
              </Button>
            )}
          </div>
        )}
      </div>

      {/* =========================================================================
          DOCUMENTO OFICIAL CORTEPLAN — MODELO FIEL À FOLHA A4 IMPRESSA
          ========================================================================= */}
      <div className="bg-slate-100 p-2 sm:p-6 rounded-2xl print:bg-white print:p-0 print:m-0 print:rounded-none">
        {/* Folha / Contêiner da Proposta */}
        <div
          id="proposal-sheet"
          className="proposal-document-sheet max-w-[840px] mx-auto bg-white border border-slate-200 sm:rounded-xl shadow-lg print:border-none print:shadow-none print:max-w-none print:p-0"
        >
          {/* =========================================================
              DOCUMENTO CORTEPLAN — CABEÇALHO, ITENS, OBSERVAÇÕES E TOTAIS
              (Com diagramação ajustável e ordenação personalizada)
              ========================================================= */}
          <section className="p-8 sm:p-12 print:p-0 print:space-y-3 font-sans text-slate-900 text-[13px] leading-normal space-y-4 bg-white">
            {layoutConfig.page1Order.map((blockId) => {
              if (blockId === 'header') {
                return (
                  <LayoutBlockWrapper
                    key={blockId}
                    id={blockId}
                    isEditMode={isLayoutEditMode}
                    isSelected={selectedBlockId === blockId}
                    styleConfig={layoutConfig.blocks[blockId]}
                    onSelect={setSelectedBlockId}
                    onUpdateStyle={handleUpdateBlockStyle}
                    onMoveOrder={handleMoveBlockOrder}
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 pb-6 border-b border-slate-200">
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
                  </LayoutBlockWrapper>
                )
              }

              if (blockId === 'client') {
                return (
                  <LayoutBlockWrapper
                    key={blockId}
                    id={blockId}
                    isEditMode={isLayoutEditMode}
                    isSelected={selectedBlockId === blockId}
                    styleConfig={layoutConfig.blocks[blockId]}
                    onSelect={setSelectedBlockId}
                    onUpdateStyle={handleUpdateBlockStyle}
                    onMoveOrder={handleMoveBlockOrder}
                  >
                    <div className="pt-2 pb-2 space-y-0.5 text-xs text-slate-700 max-w-xl">
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
                      </div>
                    </div>
                  </LayoutBlockWrapper>
                )
              }

              if (blockId === 'title_date') {
                return (
                  <LayoutBlockWrapper
                    key={blockId}
                    id={blockId}
                    isEditMode={isLayoutEditMode}
                    isSelected={selectedBlockId === blockId}
                    styleConfig={layoutConfig.blocks[blockId]}
                    onSelect={setSelectedBlockId}
                    onUpdateStyle={handleUpdateBlockStyle}
                    onMoveOrder={handleMoveBlockOrder}
                  >
                    <div className="pt-1 pb-2 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100">
                      <div>
                        <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                          Proposta Nº {quote.quote_number}
                        </h2>
                      </div>
                      <div className="text-left sm:text-right">
                        <p className="text-[11px] sm:text-xs text-slate-600">
                          {formatDateExtendedBR(quote.created, CORTEPLAN_COMPANY_INFO.city)}
                        </p>
                      </div>
                    </div>
                  </LayoutBlockWrapper>
                )
              }

              if (blockId === 'intro') {
                return (
                  <LayoutBlockWrapper
                    key={blockId}
                    id={blockId}
                    isEditMode={isLayoutEditMode}
                    isSelected={selectedBlockId === blockId}
                    styleConfig={layoutConfig.blocks[blockId]}
                    onSelect={setSelectedBlockId}
                    onUpdateStyle={handleUpdateBlockStyle}
                    onMoveOrder={handleMoveBlockOrder}
                  >
                    <div className="py-1 text-xs text-slate-700">
                      <p>
                        Atendendo à sua solicitação, apresentamos proposta com preços e condições
                        técnicas e comerciais para o fornecimento solicitado:
                      </p>
                    </div>
                  </LayoutBlockWrapper>
                )
              }

              if (blockId === 'items') {
                return (
                  <LayoutBlockWrapper
                    key={blockId}
                    id={blockId}
                    isEditMode={isLayoutEditMode}
                    isSelected={selectedBlockId === blockId}
                    styleConfig={layoutConfig.blocks[blockId]}
                    onSelect={setSelectedBlockId}
                    onUpdateStyle={handleUpdateBlockStyle}
                    onMoveOrder={handleMoveBlockOrder}
                  >
                    <div className="overflow-x-auto my-2">
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
                        {quote.items?.map((item, index) => {
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
                  </LayoutBlockWrapper>
                )
              }

              if (blockId === 'totals_obs') {
                return (
                  <LayoutBlockWrapper
                    key={blockId}
                    id={blockId}
                    isEditMode={isLayoutEditMode}
                    isSelected={selectedBlockId === blockId}
                    styleConfig={layoutConfig.blocks[blockId]}
                    onSelect={setSelectedBlockId}
                    onUpdateStyle={handleUpdateBlockStyle}
                    onMoveOrder={handleMoveBlockOrder}
                  >
                    <div className="pt-4 border-t border-slate-300 grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                      {/* Observações da Proposta (Lado Esquerdo - 7 colunas) */}
                      <div className="md:col-span-7 space-y-2 text-xs">
                        <div className="font-bold text-slate-900 uppercase tracking-wide text-[11px]">
                          Observações da Proposta
                        </div>

                        <div className="text-[11px] text-slate-600 leading-relaxed space-y-1.5 whitespace-pre-line">
                          {quote.observations ? (
                            <p>{quote.observations}</p>
                          ) : (
                            <>
                              <p>
                                <strong>Prazo de entrega:</strong> {deliveryTerm}
                              </p>
                              <p>
                                <strong>Pagamento:</strong> {paymentTerms}
                              </p>
                              <p>
                                Este orçamento contempla exclusivamente os itens, quantidades,
                                materiais, acabamentos e especificações técnicas descritos na
                                proposta.
                              </p>
                              <p>
                                Itens, serviços ou soluções não mencionados expressamente estão fora
                                do escopo e serão cotados separadamente, caso solicitados.
                              </p>
                              <p>
                                Alterações ou inclusões após a aprovação poderão acarretar revisão
                                de valores, prazos e condições comerciais.
                              </p>
                              <p>
                                Componentes elétricos, quando aplicáveis, serão fornecidos prontos
                                para conexão, cabendo ao cliente a disponibilização do ponto de
                                alimentação conforme especificação técnica.
                              </p>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Bloco de Totais (Lado Direito - 5 colunas) */}
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

                        {quote.discount_percent > 0 && (
                          <div className="flex justify-between items-center text-emerald-700 text-[11px]">
                            <span>Desconto ({quote.discount_percent}%):</span>
                            <span className="font-mono">
                              - {formatCurrencyBRL((produtosTotal * quote.discount_percent) / 100)}
                            </span>
                          </div>
                        )}

                        <div className="pt-2 border-t-2 border-slate-900 flex justify-between items-center">
                          <span className="font-extrabold text-slate-900 text-sm uppercase">
                            Total:
                          </span>
                          <span className="font-mono text-lg font-black text-slate-950">
                            {formatCurrencyBRL(quote.total)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </LayoutBlockWrapper>
                )
              }

              return null
            })}
          </section>

          {/* =========================================================
              CONDIÇÕES COMERCIAIS, PARCELAS E ASSINATURA
              (Fluxo contínuo com separador na tela)
              ========================================================= */}
          <div className="print-page-break border-t-2 border-dashed border-slate-300 print:border-none print:hidden print:m-0 print:p-0" />

          <section className="p-8 sm:p-12 print:p-0 print:pt-2 print:space-y-3 font-sans text-slate-900 text-xs leading-normal space-y-4 bg-white">
            {layoutConfig.page2Order.map((blockId) => {
              if (blockId === 'conditions_summary') {
                return (
                  <LayoutBlockWrapper
                    key={blockId}
                    id={blockId}
                    isEditMode={isLayoutEditMode}
                    isSelected={selectedBlockId === blockId}
                    styleConfig={layoutConfig.blocks[blockId]}
                    onSelect={setSelectedBlockId}
                    onUpdateStyle={handleUpdateBlockStyle}
                    onMoveOrder={handleMoveBlockOrder}
                  >
                    <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-300 text-xs">
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
                          <span className="font-bold text-slate-900">Validade da Proposta: </span>
                          <span className="text-slate-700">{validityDays} dias.</span>
                        </div>
                        <div>
                          <span className="font-bold text-slate-900">Cond. pagamento: </span>
                          <span className="text-slate-700">{paymentTerms}</span>
                        </div>
                      </div>
                    </div>

                    <div className="py-3 space-y-1 text-xs text-slate-700">
                      <p>A validade desta proposta é de {validityDays} dias.</p>
                      <p>Ficamos à disposição para quaisquer esclarecimentos adicionais.</p>
                    </div>
                  </LayoutBlockWrapper>
                )
              }

              if (blockId === 'installments') {
                return (
                  <LayoutBlockWrapper
                    key={blockId}
                    id={blockId}
                    isEditMode={isLayoutEditMode}
                    isSelected={selectedBlockId === blockId}
                    styleConfig={layoutConfig.blocks[blockId]}
                    onSelect={setSelectedBlockId}
                    onUpdateStyle={handleUpdateBlockStyle}
                    onMoveOrder={handleMoveBlockOrder}
                  >
                    <div className="my-3">
                      <div className="font-bold text-slate-900 uppercase tracking-wide text-[11px] mb-2">
                        Programação de Parcelas / Pagamento
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
                  </LayoutBlockWrapper>
                )
              }

              if (blockId === 'signature') {
                const sellerDisplayName =
                  quote.seller || quote.expand?.seller_user?.name || user?.name || ''
                const quoteDateFormatted = formatDateBR(quote.created)

                return (
                  <LayoutBlockWrapper
                    key={blockId}
                    id={blockId}
                    isEditMode={isLayoutEditMode}
                    isSelected={selectedBlockId === blockId}
                    styleConfig={layoutConfig.blocks[blockId]}
                    onSelect={setSelectedBlockId}
                    onUpdateStyle={handleUpdateBlockStyle}
                    onMoveOrder={handleMoveBlockOrder}
                  >
                    <div className="pt-8 mt-6 border-t border-slate-300 print-avoid-break">
                      <div className="max-w-md mx-auto space-y-6 text-center text-xs text-slate-700">
                        <div className="space-y-1">
                          <div className="border-b border-slate-900 w-full min-h-[2rem] pb-1 flex items-end justify-center font-medium text-slate-900">
                            {sellerDisplayName}
                          </div>
                          <div className="font-semibold text-slate-800 text-[11px] uppercase tracking-wider pt-1">
                            Nome Legível
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="border-b border-slate-900 w-full h-10" />
                          <div className="font-semibold text-slate-800 text-[11px] uppercase tracking-wider pt-1">
                            Assinatura
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="border-b border-slate-900 w-full min-h-[2rem] pb-1 flex items-end justify-center font-medium font-mono text-slate-900">
                            {quoteDateFormatted}
                          </div>
                          <div className="font-semibold text-slate-800 text-[11px] uppercase tracking-wider pt-1">
                            Data
                          </div>
                        </div>
                      </div>
                    </div>
                  </LayoutBlockWrapper>
                )
              }

              if (blockId === 'footer') {
                return (
                  <div key={blockId} className="print:hidden">
                    <LayoutBlockWrapper
                      id={blockId}
                      isEditMode={isLayoutEditMode}
                      isSelected={selectedBlockId === blockId}
                      styleConfig={layoutConfig.blocks[blockId]}
                      onSelect={setSelectedBlockId}
                      onUpdateStyle={handleUpdateBlockStyle}
                      onMoveOrder={handleMoveBlockOrder}
                    >
                      <div className="pt-8 text-center text-[11px] text-slate-400">
                        {CORTEPLAN_COMPANY_INFO.name} &bull; CNPJ: {CORTEPLAN_COMPANY_INFO.cnpj}{' '}
                        &bull; {CORTEPLAN_COMPANY_INFO.phone} &bull; {CORTEPLAN_COMPANY_INFO.email}
                      </div>
                    </LayoutBlockWrapper>
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

      {/* Linha do Tempo de Status (Apenas na tela, escondida na impressão) */}
      <div className="print:hidden bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 pb-2 border-b border-slate-100">
          Linha do Tempo de Auditoria & Status
        </h3>

        {!quote.status_history || quote.status_history.length === 0 ? (
          <p className="text-xs text-slate-400">Nenhum evento registrado ainda.</p>
        ) : (
          <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
            {quote.status_history.map((entry, index) => {
              let dotColor = 'bg-slate-400'
              if (entry.status === 'Aprovado') dotColor = 'bg-emerald-500'
              if (entry.status === 'Enviado') dotColor = 'bg-amber-500'
              if (entry.status === 'Rejeitado') dotColor = 'bg-red-500'

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
    </div>
  )
}

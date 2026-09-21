import React, { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  FileText,
  Plus,
  Search,
  Eye,
  Edit,
  Printer,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Calendar,
  Building,
  PackageCheck,
  ArrowRight,
  PhoneCall,
  AlertCircle,
} from 'lucide-react'
import { quoteService } from '@/services/quotes'
import { orderService } from '@/services/orders'
import { followupService, getFollowupStatus } from '@/services/followups'
import { useAuth } from '@/contexts/AuthContext'
import { useRealtime } from '@/hooks/use-realtime'
import type { QuoteRecord, QuoteStatus, FollowupRecord } from '@/types'
import {
  formatCurrencyBRL,
  formatDateBR,
  formatQuoteNumber,
  formatOrderNumber,
  calculateCommission,
} from '@/types'
import { canViewValues, canManageRecord } from '@/lib/permissions'
import { Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

const statusList: { key: string; label: string }[] = [
  { key: 'Todos', label: 'Todos' },
  { key: 'Enviado', label: 'Enviado' },
  { key: 'Pendente de retorno', label: 'Pendente de retorno' },
  { key: 'Aprovado', label: 'Aprovado' },
  { key: 'Rascunho', label: 'Rascunho' },
  { key: 'Rejeitado', label: 'Rejeitado' },
]

export default function Quotes() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [quotes, setQuotes] = useState<QuoteRecord[]>([])
  const [allFollowups, setAllFollowups] = useState<FollowupRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [generatingOrderId, setGeneratingOrderId] = useState<string | null>(null)

  // Filtros e busca
  const [statusFilter, setStatusFilter] = useState('Todos')
  const [search, setSearch] = useState('')

  // Paginação
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  const loadData = async () => {
    try {
      const [allQuotes, followupsList] = await Promise.all([
        quoteService.getAll(),
        followupService.getAll().catch(() => []),
      ])
      setQuotes(allQuotes)
      setAllFollowups(followupsList)
    } catch (err) {
      console.error('Erro ao listar orçamentos e follow-ups:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Inscrição em tempo real na coleção quotes e followups
  useRealtime<QuoteRecord>('quotes', () => {
    loadData()
  })

  useRealtime<FollowupRecord>('followups', () => {
    followupService
      .getAll()
      .then(setAllFollowups)
      .catch(() => {})
  })

  // Agrupamento de follow-ups por orçamento para checagem rápida
  const followupsByQuoteId = useMemo(() => {
    const map = new Map<string, FollowupRecord[]>()
    for (const f of allFollowups) {
      const qId = f.quote
      if (!map.has(qId)) {
        map.set(qId, [])
      }
      map.get(qId)!.push(f)
    }
    return map
  }, [allFollowups])

  // Contagens por status para os pills
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      Todos: quotes.length,
      Rascunho: 0,
      Enviado: 0,
      Aprovado: 0,
      Rejeitado: 0,
      'Pendente de retorno': 0,
    }
    for (const q of quotes) {
      if (counts[q.status] !== undefined) {
        counts[q.status]++
      }
      // Contagem de pendentes de retorno
      const fList = followupsByQuoteId.get(q.id) || []
      const fStatus = getFollowupStatus(q, fList)
      if (fStatus.isPendingReturn) {
        counts['Pendente de retorno']++
      }
    }
    return counts
  }, [quotes, followupsByQuoteId])

  // Gerar pedido a partir de orçamento
  const handleGenerateOrder = async (quote: QuoteRecord) => {
    if (quote.status !== 'Enviado' && quote.status !== 'Aprovado') {
      toast.warning('Apenas orçamentos com status "Enviado" ou "Aprovado" podem gerar pedido.')
      return
    }

    setGeneratingOrderId(quote.id)
    try {
      const userName = user?.name || 'Gustavo'
      const order = await orderService.createFromQuote(quote, userName)
      toast.success(
        `Pedido ${formatOrderNumber(order.order_number)} gerado com sucesso a partir do ${formatQuoteNumber(quote.quote_number)}!`,
      )
      await loadData()
      navigate(`/pedidos/${order.id}`)
    } catch (err) {
      console.error('Erro ao gerar pedido:', err)
      toast.error('Erro ao gerar pedido a partir do orçamento.')
    } finally {
      setGeneratingOrderId(null)
    }
  }

  // Filtragem combinada client-side (para experiência instantânea e flexível de busca)
  const filteredQuotes = useMemo(() => {
    return quotes.filter((q) => {
      // Filtro de status
      if (statusFilter === 'Pendente de retorno') {
        const fList = followupsByQuoteId.get(q.id) || []
        const fStatus = getFollowupStatus(q, fList)
        if (!fStatus.isPendingReturn) return false
      } else if (statusFilter !== 'Todos' && q.status !== statusFilter) {
        return false
      }

      // Busca por número, cliente, vendedor, pedido ou observação
      if (search.trim()) {
        const clean = search.toLowerCase().trim()
        const numFormatted = formatQuoteNumber(q.quote_number).toLowerCase()
        const numRaw = String(q.quote_number)
        const orderNumStr = q.order_number ? formatOrderNumber(q.order_number).toLowerCase() : ''
        const clientName = (q.expand?.client?.name || '').toLowerCase()
        const clientCompany = (q.expand?.client?.company || '').toLowerCase()
        const sellerName = (q.seller || q.expand?.seller_user?.name || '').toLowerCase()
        const obs = (q.observations || '').toLowerCase()
        const itemsText = (q.items || []).map((i) => i.description.toLowerCase()).join(' ')

        const matches =
          numFormatted.includes(clean) ||
          numRaw.includes(clean) ||
          orderNumStr.includes(clean) ||
          clientName.includes(clean) ||
          clientCompany.includes(clean) ||
          sellerName.includes(clean) ||
          obs.includes(clean) ||
          itemsText.includes(clean)

        if (!matches) return false
      }

      return true
    })
  }, [quotes, statusFilter, search])

  // Paginação client-side dos filtrados
  const totalPages = Math.ceil(filteredQuotes.length / itemsPerPage) || 1
  const paginatedQuotes = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredQuotes.slice(start, start + itemsPerPage)
  }, [filteredQuotes, currentPage, itemsPerPage])

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1)
  }, [statusFilter, search])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Aprovado':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            Aprovado
          </span>
        )
      case 'Enviado':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            Enviado
          </span>
        )
      case 'Rejeitado':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
            Rejeitado
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            Rascunho
          </span>
        )
    }
  }

  return (
    <div className="space-y-6">
      {/* Header com Título e Botão Novo Orçamento */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Histórico de Orçamentos
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Gerencie propostas comerciais com numeração contínua e rastreabilidade total.
          </p>
        </div>

        <Button
          asChild
          className="rounded-xl bg-[#3A3A3C] hover:bg-[#2D2D2F] text-white font-medium shadow-sm transition-all duration-200 hover:scale-[1.02] shrink-0"
        >
          <Link to="/orcamentos/novo">
            <Plus className="h-4 w-4 mr-1.5 text-amber-400" />
            Novo Orçamento
          </Link>
        </Button>
      </div>

      {/* Barra de Filtros: Status Pills + Campo de Busca */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        {/* Horizontal Status Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
          {statusList.map((pill) => {
            const isSelected = statusFilter === pill.key
            const count = statusCounts[pill.key] || 0
            return (
              <button
                key={pill.key}
                type="button"
                onClick={() => setStatusFilter(pill.key)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                  isSelected
                    ? 'bg-[#3A3A3C] text-white shadow-xs'
                    : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                }`}
              >
                <span>{pill.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[11px] font-mono ${
                    isSelected
                      ? 'bg-amber-400 text-slate-950 font-bold'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Busca por número, cliente ou item */}
        <div className="relative w-full lg:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            type="text"
            placeholder="Buscar número, cliente, item..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-3 h-9 text-xs sm:text-sm bg-slate-50 border-slate-200 rounded-xl"
          />
        </div>
      </div>

      {/* Conteúdo: Tabela Desktop / Cards Mobile */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-slate-500">
            <Loader2 className="h-8 w-8 animate-spin text-[#3A3A3C]" />
            <p className="text-sm">Carregando histórico de orçamentos...</p>
          </div>
        </div>
      ) : filteredQuotes.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-slate-200 text-center space-y-4">
          <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
            <FileText className="h-8 w-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-800">
              {search.trim() || statusFilter !== 'Todos'
                ? 'Nenhum orçamento encontrado com estes filtros'
                : 'Nenhum orçamento cadastrado ainda'}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm">
              {search.trim() || statusFilter !== 'Todos'
                ? 'Tente ajustar os filtros de status ou a busca por palavras-chave.'
                : 'Crie seu primeiro orçamento com cálculo de subtotais e numeração sequencial automática.'}
            </p>
          </div>
          {!(search.trim() || statusFilter !== 'Todos') && (
            <Button
              asChild
              className="rounded-xl bg-[#3A3A3C] hover:bg-[#2D2D2F] text-white font-medium"
            >
              <Link to="/orcamentos/novo">
                <Plus className="h-4 w-4 mr-1.5 text-amber-400" />
                Criar primeiro orçamento
              </Link>
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* Tabela Desktop */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-5">Número</th>
                  <th className="py-3.5 px-4">Cliente / Razão</th>
                  <th className="py-3.5 px-4">Data de Emissão</th>
                  <th className="py-3.5 px-4">Valor Total</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                {paginatedQuotes.map((quote) => {
                  const qFollowups = followupsByQuoteId.get(quote.id) || []
                  const fStatus = getFollowupStatus(quote, qFollowups)
                  const followupsCount = qFollowups.length

                  return (
                    <tr
                      key={quote.id}
                      className="hover:bg-[#F1F5F9] transition-colors duration-150 group"
                    >
                      {/* Número sequencial formatado */}
                      <td className="py-3.5 px-5">
                        <Link
                          to={`/orcamentos/${quote.id}`}
                          className="inline-flex items-center gap-1.5 font-mono font-bold text-xs bg-slate-100 text-[#3A3A3C] px-2.5 py-1 rounded-lg border border-slate-200/80 group-hover:bg-[#3A3A3C] group-hover:text-white transition-colors"
                        >
                          {formatQuoteNumber(quote.quote_number)}
                        </Link>

                        {/* Exibir o número do pedido vinculado caso já tenha gerado */}
                        {quote.order_number && (
                          <Link
                            to={`/pedidos/${quote.order_id || ''}`}
                            className="flex items-center gap-1 font-mono text-[11px] text-[#E66812] hover:underline mt-1 font-semibold"
                            title="Ver pedido vinculado"
                          >
                            <PackageCheck className="h-3 w-3" />
                            <span>{formatOrderNumber(quote.order_number)}</span>
                          </Link>
                        )}
                      </td>

                      {/* Cliente */}
                      <td className="py-3.5 px-4">
                        {quote.expand?.client ? (
                          <Link
                            to={`/clientes/${quote.expand.client.id}`}
                            className="font-semibold text-slate-900 group-hover:text-[#3A3A3C] hover:underline block truncate max-w-xs"
                          >
                            {quote.expand.client.name}
                            {quote.expand.client.company && (
                              <span className="text-slate-400 font-normal text-xs block">
                                {quote.expand.client.company}
                              </span>
                            )}
                          </Link>
                        ) : (
                          <span className="text-slate-400">Cliente não identificado</span>
                        )}
                      </td>

                      {/* Data de Emissão */}
                      <td className="py-3.5 px-4 text-xs text-slate-500 whitespace-nowrap">
                        {formatDateBR(quote.created)}
                      </td>

                      {/* Valor Total + Comissão Secundária */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {canViewValues(quote, user) ? (
                          <>
                            <span className="font-mono font-bold text-xs sm:text-sm text-slate-900 block">
                              {formatCurrencyBRL(quote.total)}
                            </span>
                            {(() => {
                              const sellerName =
                                quote.seller || quote.expand?.seller_user?.name || 'Gustavo'
                              const { commissionAmount } = calculateCommission(
                                quote.items,
                                quote.discount_percent,
                                quote.commission_percent,
                              )
                              if (commissionAmount > 0) {
                                return (
                                  <span
                                    className="text-[11px] text-slate-500 block truncate"
                                    title={`Comissão calculada: ${formatCurrencyBRL(commissionAmount)} — ${sellerName}`}
                                  >
                                    Comissão: {formatCurrencyBRL(commissionAmount)} — {sellerName}
                                  </span>
                                )
                              }
                              if (sellerName) {
                                return (
                                  <span className="text-[11px] text-slate-400 block truncate">
                                    Vendedor: {sellerName}
                                  </span>
                                )
                              }
                              return null
                            })()}
                          </>
                        ) : (
                          <div>
                            <span className="inline-flex items-center gap-1 font-mono font-semibold text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                              <Lock className="h-3 w-3 text-slate-400" />
                              Confidencial
                            </span>
                            <span className="text-[11px] text-slate-400 block truncate mt-0.5">
                              Vendedor:{' '}
                              {quote.seller || quote.expand?.seller_user?.name || 'Outro Vendedor'}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="space-y-1">
                          <div>{getStatusBadge(quote.status)}</div>
                          {fStatus.isPendingReturn && (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/15 text-amber-800 border border-amber-300 animate-pulse"
                              title={`Aviso: sem retorno há ${fStatus.daysElapsed} dias`}
                            >
                              <AlertCircle className="h-3 w-3 text-[#E66812]" />
                              Pendente de retorno
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Ações: Visualizar, Editar, Imprimir, Follow-up e Gerar Pedido */}
                      <td className="py-3.5 px-5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Ação Follow-up: rótulo exato "Follow-up", ícone PhoneCall com badge de pendente ou contagem */}
                          {canManageRecord(quote, user) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/orcamentos/${quote.id}/followup`)}
                              className={`h-8 px-2.5 text-xs font-semibold rounded-lg transition-all ${
                                fStatus.isPendingReturn
                                  ? 'bg-amber-100/80 border-amber-300 text-amber-900 hover:bg-[#F08A24] hover:text-white shadow-xs animate-in zoom-in-95'
                                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                              }`}
                              title={
                                fStatus.isPendingReturn
                                  ? `Follow-up urgente: sem contato há ${fStatus.daysElapsed} dias!`
                                  : `Gerenciar contatos de follow-up (${followupsCount} registrado${followupsCount === 1 ? '' : 's'})`
                              }
                            >
                              <PhoneCall
                                className={`h-3.5 w-3.5 mr-1 ${
                                  fStatus.isPendingReturn ? 'text-[#E66812]' : 'text-slate-500'
                                }`}
                              />
                              Follow-up
                              {fStatus.isPendingReturn ? (
                                <span className="ml-1.5 h-2 w-2 rounded-full bg-[#E66812] ring-2 ring-white" />
                              ) : followupsCount > 0 ? (
                                <span className="ml-1.5 px-1 py-0.2 rounded-full bg-slate-200 text-slate-700 text-[10px] font-mono font-bold">
                                  {followupsCount}
                                </span>
                              ) : null}
                            </Button>
                          )}
                          {/* Ação "Gerar pedido" disponível para Enviado ou Aprovado (somente dono ou admin) */}
                          {canManageRecord(quote, user) &&
                            (quote.status === 'Enviado' || quote.status === 'Aprovado') && (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={generatingOrderId === quote.id}
                                onClick={() => handleGenerateOrder(quote)}
                                className="h-8 px-2.5 text-xs font-semibold rounded-lg bg-orange-50/70 border-orange-200 text-[#E66812] hover:bg-[#F08A24] hover:text-white transition-all shadow-2xs"
                                title={
                                  quote.order_number
                                    ? `Já possui pedido vinculado (${formatOrderNumber(quote.order_number)}). Clique para gerar novo se necessário.`
                                    : 'Gerar Pedido a partir deste orçamento'
                                }
                              >
                                {generatingOrderId === quote.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <PackageCheck className="h-3.5 w-3.5 mr-1" />
                                )}
                                Gerar pedido
                              </Button>
                            )}

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(`/orcamentos/${quote.id}`)}
                            className="h-8 w-8 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Visualizar orçamento"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>

                          {canManageRecord(quote, user) && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => navigate(`/orcamentos/${quote.id}/editar`)}
                                className="h-8 w-8 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                title="Editar orçamento"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>

                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => navigate(`/orcamentos/${quote.id}?print=true`)}
                                className="h-8 w-8 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                                title="Imprimir proposta"
                              >
                                <Printer className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Cards Mobile (<768px) */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {paginatedQuotes.map((quote) => {
              const qFollowups = followupsByQuoteId.get(quote.id) || []
              const fStatus = getFollowupStatus(quote, qFollowups)
              const followupsCount = qFollowups.length

              return (
                <div
                  key={quote.id}
                  className={`bg-white p-4 rounded-xl border shadow-xs space-y-3 ${
                    fStatus.isPendingReturn
                      ? 'border-[#F08A24]/70 bg-amber-500/5'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-xs bg-slate-100 text-[#3A3A3C] px-2.5 py-1 rounded-lg border border-slate-200">
                        {formatQuoteNumber(quote.quote_number)}
                      </span>
                      {fStatus.isPendingReturn && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
                          <AlertCircle className="h-3 w-3 text-[#E66812]" />
                          Retorno pendente
                        </span>
                      )}
                    </div>
                    {getStatusBadge(quote.status)}
                  </div>

                  {quote.order_number && (
                    <Link
                      to={`/pedidos/${quote.order_id || ''}`}
                      className="inline-flex items-center gap-1 text-[11px] text-[#E66812] font-mono font-semibold"
                    >
                      <PackageCheck className="h-3 w-3" />
                      Pedido {formatOrderNumber(quote.order_number)}
                    </Link>
                  )}

                  <div>
                    <Link
                      to={`/orcamentos/${quote.id}`}
                      className="font-bold text-sm text-slate-900 hover:underline block"
                    >
                      {quote.expand?.client?.name || 'Cliente'}
                    </Link>
                    {quote.expand?.client?.company && (
                      <p className="text-xs text-slate-500">{quote.expand.client.company}</p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                    <div>
                      <span className="text-[11px] text-slate-400 block">Valor da Proposta</span>
                      {canViewValues(quote, user) ? (
                        <>
                          <span className="font-mono font-bold text-slate-900">
                            {formatCurrencyBRL(quote.total)}
                          </span>
                          {(() => {
                            const sellerName =
                              quote.seller || quote.expand?.seller_user?.name || 'Gustavo'
                            const { commissionAmount } = calculateCommission(
                              quote.items,
                              quote.discount_percent,
                              quote.commission_percent,
                            )
                            if (commissionAmount > 0) {
                              return (
                                <span className="text-[10px] text-slate-500 block">
                                  Comissão: {formatCurrencyBRL(commissionAmount)} — {sellerName}
                                </span>
                              )
                            }
                            return null
                          })()}
                        </>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-mono font-semibold text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                          <Lock className="h-3 w-3" /> Confidencial
                        </span>
                      )}
                    </div>

                    <div className="text-right">
                      <span className="text-[11px] text-slate-400 block">Emissão</span>
                      <span className="text-slate-600">{formatDateBR(quote.created)}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-1 pt-2 border-t border-slate-100 flex-wrap">
                    {canManageRecord(quote, user) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/orcamentos/${quote.id}/followup`)}
                        className={`h-8 text-xs font-semibold ${
                          fStatus.isPendingReturn
                            ? 'bg-amber-100 border-amber-300 text-amber-900'
                            : 'bg-slate-50 border-slate-200 text-slate-700'
                        }`}
                      >
                        <PhoneCall
                          className={`h-3.5 w-3.5 mr-1 ${
                            fStatus.isPendingReturn ? 'text-[#E66812]' : 'text-slate-500'
                          }`}
                        />
                        Follow-up
                        {followupsCount > 0 && (
                          <span className="ml-1 px-1 rounded-full bg-slate-200 text-slate-700 text-[10px] font-mono">
                            {followupsCount}
                          </span>
                        )}
                      </Button>
                    )}

                    {canManageRecord(quote, user) &&
                      (quote.status === 'Enviado' || quote.status === 'Aprovado') && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={generatingOrderId === quote.id}
                          onClick={() => handleGenerateOrder(quote)}
                          className="h-8 text-xs font-semibold bg-orange-50 text-[#E66812] border-orange-200"
                        >
                          {generatingOrderId === quote.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                          ) : (
                            <PackageCheck className="h-3.5 w-3.5 mr-1" />
                          )}
                          Gerar pedido
                        </Button>
                      )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/orcamentos/${quote.id}`)}
                      className="h-8 text-blue-600"
                    >
                      <Eye className="h-3.5 w-3.5 mr-1" /> Ver
                    </Button>
                    {canManageRecord(quote, user) && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/orcamentos/${quote.id}/editar`)}
                          className="h-8 text-amber-600"
                        >
                          <Edit className="h-3.5 w-3.5 mr-1" /> Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/orcamentos/${quote.id}?print=true`)}
                          className="h-8 text-slate-700"
                        >
                          <Printer className="h-3.5 w-3.5 mr-1" /> Imprimir
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Paginação de 10 por página */}
          <div className="flex items-center justify-between bg-white px-4 py-3 rounded-2xl border border-slate-200 shadow-xs text-xs text-slate-600">
            <div>
              Mostrando{' '}
              <span className="font-semibold text-slate-900">
                {(currentPage - 1) * itemsPerPage + 1}
              </span>{' '}
              a{' '}
              <span className="font-semibold text-slate-900">
                {Math.min(currentPage * itemsPerPage, filteredQuotes.length)}
              </span>{' '}
              de <span className="font-semibold text-slate-900">{filteredQuotes.length}</span>{' '}
              propostas
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage <= 1}
                className="h-8 rounded-xl px-2.5 text-xs border-slate-200"
              >
                <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                Anterior
              </Button>

              <span className="text-xs font-semibold px-2">
                {currentPage} / {totalPages}
              </span>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                disabled={currentPage >= totalPages}
                className="h-8 rounded-xl px-2.5 text-xs border-slate-200"
              >
                Próxima
                <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

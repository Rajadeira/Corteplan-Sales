import React, { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  PackageCheck,
  Search,
  Eye,
  Printer,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Calendar,
  Building,
  Ban,
  AlertTriangle,
  ArrowRight,
  Sparkles,
} from 'lucide-react'
import { orderService } from '@/services/orders'
import { useAuth } from '@/contexts/AuthContext'
import { useRealtime } from '@/hooks/use-realtime'
import type { OrderRecord, OrderStatus } from '@/types'
import {
  formatCurrencyBRL,
  formatDateBR,
  formatOrderNumber,
  formatQuoteNumber,
  calculateCommission,
} from '@/types'
import { canViewValues, canManageRecord } from '@/lib/permissions'
import { Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'

const statusList: { key: string; label: string }[] = [
  { key: 'Todos', label: 'Todos' },
  { key: 'Aberto', label: 'Aberto' },
  { key: 'Em Produção', label: 'Em Produção' },
  { key: 'Concluído', label: 'Concluído' },
  { key: 'Cancelado', label: 'Cancelado' },
]

export default function Orders() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [orders, setOrders] = useState<OrderRecord[]>([])
  const [loading, setLoading] = useState(true)

  // Filtros e busca
  const [statusFilter, setStatusFilter] = useState('Todos')
  const [search, setSearch] = useState('')

  // Paginação
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  // Modal de cancelamento
  const [orderToCancel, setOrderToCancel] = useState<OrderRecord | null>(null)
  const [cancelling, setCancelling] = useState(false)

  const loadData = async () => {
    try {
      const allOrders = await orderService.getAll()
      setOrders(allOrders)
    } catch (err) {
      console.error('Erro ao listar pedidos:', err)
      toast.error('Erro ao carregar a lista de pedidos.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Inscrição em tempo real na coleção orders
  useRealtime<OrderRecord>('orders', () => {
    loadData()
  })

  // Contagens por status para os pills
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      Todos: orders.length,
      Aberto: 0,
      'Em Produção': 0,
      Concluído: 0,
      Cancelado: 0,
    }
    for (const o of orders) {
      if (counts[o.status] !== undefined) {
        counts[o.status]++
      }
    }
    return counts
  }, [orders])

  // Troca rápida de status via dropdown
  const handleQuickStatusChange = async (orderId: string, newStatus: OrderStatus) => {
    try {
      const userName = user?.name || 'Usuário'
      await orderService.updateStatus(orderId, newStatus, userName)
      toast.success(`Status do pedido atualizado para "${newStatus}"!`)
      loadData()
    } catch (err) {
      console.error('Erro ao trocar status:', err)
      toast.error('Erro ao atualizar status do pedido.')
    }
  }

  // Cancelar pedido com confirmação modal
  const handleConfirmCancel = async () => {
    if (!orderToCancel) return
    setCancelling(true)
    try {
      const userName = user?.name || 'Usuário'
      await orderService.updateStatus(orderToCancel.id, 'Cancelado', userName)
      toast.success(
        `Pedido ${formatOrderNumber(orderToCancel.order_number)} cancelado com sucesso.`,
      )
      setOrderToCancel(null)
      loadData()
    } catch (err) {
      console.error('Erro ao cancelar pedido:', err)
      toast.error('Erro ao cancelar pedido.')
    } finally {
      setCancelling(false)
    }
  }

  // Filtragem combinada client-side
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (statusFilter !== 'Todos' && o.status !== statusFilter) {
        return false
      }

      if (search.trim()) {
        const clean = search.toLowerCase().trim()
        const numFormatted = formatOrderNumber(o.order_number).toLowerCase()
        const numRaw = String(o.order_number)
        const quoteNum = o.quote_number ? formatQuoteNumber(o.quote_number).toLowerCase() : ''
        const clientName = (o.expand?.client?.name || '').toLowerCase()
        const clientCompany = (o.expand?.client?.company || '').toLowerCase()
        const sellerName = (o.seller || o.expand?.seller_user?.name || '').toLowerCase()
        const obs = (o.observations || '').toLowerCase()
        const itemsText = (o.items || []).map((i) => i.description.toLowerCase()).join(' ')

        const matches =
          numFormatted.includes(clean) ||
          numRaw.includes(clean) ||
          quoteNum.includes(clean) ||
          clientName.includes(clean) ||
          clientCompany.includes(clean) ||
          sellerName.includes(clean) ||
          obs.includes(clean) ||
          itemsText.includes(clean)

        if (!matches) return false
      }

      return true
    })
  }, [orders, statusFilter, search])

  // Paginação
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage) || 1
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredOrders.slice(start, start + itemsPerPage)
  }, [filteredOrders, currentPage, itemsPerPage])

  useEffect(() => {
    setCurrentPage(1)
  }, [statusFilter, search])

  const renderStatusBadge = (status: OrderStatus, order: OrderRecord) => {
    let badgeClass = 'bg-slate-100 text-slate-700 border-slate-200'
    if (status === 'Aberto') {
      badgeClass = 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
    } else if (status === 'Em Produção') {
      badgeClass = 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
    } else if (status === 'Concluído') {
      badgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
    } else if (status === 'Cancelado') {
      badgeClass = 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
    }

    const canManage = canManageRecord(order, user)

    if (!canManage) {
      return (
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badgeClass}`}
        >
          {status}
        </span>
      )
    }

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${badgeClass}`}
            title="Clique para alterar o status"
          >
            <span>{status}</span>
            <span className="text-[10px] opacity-60">▾</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          <DropdownMenuLabel className="text-[11px] text-slate-400 uppercase">
            Alterar Status
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {(['Aberto', 'Em Produção', 'Concluído'] as OrderStatus[]).map((st) => (
            <DropdownMenuItem
              key={st}
              onClick={() => handleQuickStatusChange(order.id, st)}
              className={`cursor-pointer text-xs ${order.status === st ? 'font-bold' : ''}`}
            >
              {st}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setOrderToCancel(order)}
            className="cursor-pointer text-xs text-red-600 focus:text-red-600"
          >
            <Ban className="h-3.5 w-3.5 mr-1.5" />
            Cancelar Pedido...
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header com Título */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Pedidos de Venda</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Etapa de produção e execução com numeração sequencial PED-001 gerada a partir dos
            orçamentos.
          </p>
        </div>

        <Button
          asChild
          variant="outline"
          className="rounded-xl border-slate-300 text-slate-700 hover:bg-slate-50 shrink-0"
        >
          <Link to="/orcamentos">
            <ArrowRight className="h-4 w-4 mr-1.5 text-[#F08A24]" />
            Ver Orçamentos para Gerar Pedido
          </Link>
        </Button>
      </div>

      {/* Barra de Filtros: Status Pills + Busca */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
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
                      ? 'bg-[#F08A24] text-slate-950 font-bold'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        <div className="relative w-full lg:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            type="text"
            placeholder="Buscar pedido, cliente, vendedor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-3 h-9 text-xs sm:text-sm bg-slate-50 border-slate-200 rounded-xl"
          />
        </div>
      </div>

      {/* Tabela ou Cards */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-slate-500">
            <Loader2 className="h-8 w-8 animate-spin text-[#3A3A3C]" />
            <p className="text-sm">Carregando pedidos...</p>
          </div>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-slate-200 text-center space-y-4">
          <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
            <PackageCheck className="h-8 w-8 text-[#F08A24]" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-800">
              {search.trim() || statusFilter !== 'Todos'
                ? 'Nenhum pedido encontrado com estes filtros'
                : 'Nenhum pedido gerado ainda'}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm">
              {search.trim() || statusFilter !== 'Todos'
                ? 'Tente ajustar os filtros de status ou a busca por palavras-chave.'
                : 'Acesse a lista de orçamentos e clique em "Gerar pedido" em uma proposta com status Enviado ou Aprovado.'}
            </p>
          </div>
          {!(search.trim() || statusFilter !== 'Todos') && (
            <Button
              asChild
              className="rounded-xl bg-[#3A3A3C] hover:bg-[#2D2D2F] text-white font-medium"
            >
              <Link to="/orcamentos">
                <ArrowRight className="h-4 w-4 mr-1.5 text-amber-400" />
                Ir para lista de orçamentos
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
                  <th className="py-3.5 px-4">Cliente / Origem</th>
                  <th className="py-3.5 px-4">Data</th>
                  <th className="py-3.5 px-4">Valor Total</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                {paginatedOrders.map((order) => {
                  const sellerName =
                    order.seller || order.expand?.seller_user?.name || 'Não informado'
                  const comm =
                    order.commission_value !== undefined && order.commission_value !== null
                      ? order.commission_value
                      : calculateCommission(
                          order.items,
                          order.discount_percent,
                          order.commission_percent,
                        ).commissionAmount

                  return (
                    <tr
                      key={order.id}
                      className="hover:bg-[#F1F5F9] transition-colors duration-150 group"
                    >
                      {/* Número sequencial PED-001 */}
                      <td className="py-3.5 px-5">
                        <Link
                          to={`/pedidos/${order.id}`}
                          className="inline-flex items-center gap-1.5 font-mono font-bold text-xs bg-orange-50 text-[#E66812] px-2.5 py-1 rounded-lg border border-orange-200 group-hover:bg-[#3A3A3C] group-hover:text-white transition-colors"
                        >
                          {formatOrderNumber(order.order_number)}
                        </Link>
                      </td>

                      {/* Cliente e Orçamento de Origem */}
                      <td className="py-3.5 px-4">
                        {order.expand?.client ? (
                          <Link
                            to={`/clientes/${order.expand.client.id}`}
                            className="font-semibold text-slate-900 group-hover:text-[#3A3A3C] hover:underline block truncate max-w-xs"
                          >
                            {order.expand.client.name}
                            {order.expand.client.company && (
                              <span className="text-slate-400 font-normal text-xs block">
                                {order.expand.client.company}
                              </span>
                            )}
                          </Link>
                        ) : (
                          <span className="text-slate-400">Cliente não identificado</span>
                        )}

                        {order.quote_number && (
                          <Link
                            to={`/orcamentos/${order.quote || ''}`}
                            className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-[#F08A24] mt-0.5"
                          >
                            <span>Origem:</span>
                            <span className="font-mono font-semibold">
                              {formatQuoteNumber(order.quote_number, order.quote_revision)}
                            </span>
                          </Link>
                        )}
                      </td>

                      {/* Data */}
                      <td className="py-3.5 px-4 text-xs text-slate-500 whitespace-nowrap">
                        {formatDateBR(order.created)}
                      </td>

                      {/* Valor Total + Comissão Discreta */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {canViewValues(order, user) ? (
                          <>
                            <span className="font-mono font-bold text-xs sm:text-sm text-slate-900 block">
                              {formatCurrencyBRL(order.total)}
                            </span>
                            {comm > 0 ? (
                              <span
                                className="text-[11px] text-slate-500 block truncate"
                                title={`Comissão calculada: ${formatCurrencyBRL(comm)} — Vendedor: ${sellerName}`}
                              >
                                Comissão: {formatCurrencyBRL(comm)} — {sellerName}
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400 block truncate">
                                Vendedor: {sellerName}
                              </span>
                            )}
                          </>
                        ) : (
                          <div>
                            <span className="inline-flex items-center gap-1 font-mono font-semibold text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                              <Lock className="h-3 w-3 text-slate-400" />
                              Confidencial
                            </span>
                            <span className="text-[11px] text-slate-400 block truncate mt-0.5">
                              Vendedor: {sellerName}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Status com Dropdown direto */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {renderStatusBadge(order.status, order)}
                      </td>

                      {/* Ações */}
                      <td className="py-3.5 px-5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(`/pedidos/${order.id}`)}
                            className="h-8 w-8 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Visualizar pedido"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>

                          {canManageRecord(order, user) && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => navigate(`/pedidos/${order.id}?print=true`)}
                                className="h-8 w-8 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                                title="Imprimir pedido"
                              >
                                <Printer className="h-4 w-4" />
                              </Button>

                              {order.status !== 'Cancelado' && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setOrderToCancel(order)}
                                  className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Cancelar pedido"
                                >
                                  <Ban className="h-4 w-4" />
                                </Button>
                              )}
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
            {paginatedOrders.map((order) => {
              const sellerName = order.seller || order.expand?.seller_user?.name || 'Não informado'
              const comm =
                order.commission_value !== undefined && order.commission_value !== null
                  ? order.commission_value
                  : calculateCommission(
                      order.items,
                      order.discount_percent,
                      order.commission_percent,
                    ).commissionAmount

              return (
                <div
                  key={order.id}
                  className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs bg-orange-50 text-[#E66812] px-2.5 py-1 rounded-lg border border-orange-200">
                      {formatOrderNumber(order.order_number)}
                    </span>
                    {renderStatusBadge(order.status, order)}
                  </div>

                  <div>
                    <Link
                      to={`/pedidos/${order.id}`}
                      className="font-bold text-sm text-slate-900 hover:underline block"
                    >
                      {order.expand?.client?.name || 'Cliente'}
                    </Link>
                    {order.expand?.client?.company && (
                      <p className="text-xs text-slate-500">{order.expand.client.company}</p>
                    )}
                    {order.quote_number && (
                      <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                        Origem: {formatQuoteNumber(order.quote_number, order.quote_revision)}
                      </p>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-100 text-xs flex justify-between items-end">
                    <div>
                      <span className="text-[11px] text-slate-400 block">Total do Pedido</span>
                      {canViewValues(order, user) ? (
                        <>
                          <span className="font-mono font-bold text-slate-900">
                            {formatCurrencyBRL(order.total)}
                          </span>
                          {comm > 0 && (
                            <span className="text-[10px] text-slate-500 block">
                              Comissão: {formatCurrencyBRL(comm)} — {sellerName}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-mono font-semibold text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                          <Lock className="h-3 w-3" /> Confidencial
                        </span>
                      )}
                    </div>
                    <div className="text-right text-[11px] text-slate-400">
                      {formatDateBR(order.created)}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-1 pt-2 border-t border-slate-100">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/pedidos/${order.id}`)}
                      className="h-8 text-blue-600"
                    >
                      <Eye className="h-3.5 w-3.5 mr-1" /> Ver
                    </Button>
                    {canManageRecord(order, user) && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/pedidos/${order.id}?print=true`)}
                          className="h-8 text-slate-700"
                        >
                          <Printer className="h-3.5 w-3.5 mr-1" /> Imprimir
                        </Button>
                        {order.status !== 'Cancelado' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setOrderToCancel(order)}
                            className="h-8 text-red-600"
                          >
                            <Ban className="h-3.5 w-3.5 mr-1" /> Cancelar
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Paginação */}
          <div className="flex items-center justify-between bg-white px-4 py-3 rounded-2xl border border-slate-200 shadow-xs text-xs text-slate-600">
            <div>
              Mostrando{' '}
              <span className="font-semibold text-slate-900">
                {(currentPage - 1) * itemsPerPage + 1}
              </span>{' '}
              a{' '}
              <span className="font-semibold text-slate-900">
                {Math.min(currentPage * itemsPerPage, filteredOrders.length)}
              </span>{' '}
              de <span className="font-semibold text-slate-900">{filteredOrders.length}</span>{' '}
              pedidos
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

      {/* Modal de confirmação de cancelamento */}
      <Dialog open={!!orderToCancel} onOpenChange={(open) => !open && setOrderToCancel(null)}>
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
                {orderToCancel ? formatOrderNumber(orderToCancel.order_number) : ''}
              </strong>
              {orderToCancel?.expand?.client ? ` de ${orderToCancel.expand.client.name}` : ''}. O
              pedido permanecerá no histórico como Cancelado.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOrderToCancel(null)}
              disabled={cancelling}
              className="rounded-xl"
            >
              Voltar
            </Button>
            <Button
              type="button"
              onClick={handleConfirmCancel}
              disabled={cancelling}
              className="rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium"
            >
              {cancelling ? (
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

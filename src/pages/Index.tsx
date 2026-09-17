import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Users,
  FileText,
  CheckCircle,
  DollarSign,
  TrendingUp,
  ArrowRight,
  Plus,
  Loader2,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { clientService } from '@/services/clients'
import { quoteService } from '@/services/quotes'
import { orderService } from '@/services/orders'
import { userService } from '@/services/users'
import { useAuth } from '@/contexts/AuthContext'
import { useRealtime } from '@/hooks/use-realtime'
import type { ClientRecord, QuoteRecord, OrderRecord, AppUserRecord } from '@/types'
import { formatCurrencyBRL, formatQuoteNumber, calculateCommission } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Award, Lock, ShieldCheck } from 'lucide-react'
import { canViewValues } from '@/lib/permissions'

export default function Index() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'Administrador'
  const [clients, setClients] = useState<ClientRecord[]>([])
  const [quotes, setQuotes] = useState<QuoteRecord[]>([])
  const [orders, setOrders] = useState<OrderRecord[]>([])
  const [usersList, setUsersList] = useState<AppUserRecord[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    try {
      const [allClients, allQuotes, allOrders, allUsers] = await Promise.all([
        clientService.getAll(),
        quoteService.getAll(),
        orderService.getAll().catch(() => []),
        userService.getAll().catch(() => []),
      ])
      setClients(allClients)
      setQuotes(allQuotes)
      setOrders(allOrders)
      setUsersList(allUsers)
    } catch (err) {
      console.error('Erro ao carregar dados do Dashboard:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Subscrições em tempo real para atualização imediata
  useRealtime<ClientRecord>('clients', () => {
    loadData()
  })

  useRealtime<QuoteRecord>('quotes', () => {
    loadData()
  })

  useRealtime<OrderRecord>('orders', () => {
    loadData()
  })

  // Cálculos dos KPIs
  const totalClients = clients.length
  const totalQuotes = quotes.length
  const approvedQuotes = quotes.filter((q) => q.status === 'Aprovado')
  const totalApprovedQuotes = approvedQuotes.length
  const totalApprovedValue = approvedQuotes.reduce((sum, q) => sum + (q.total || 0), 0)

  // Gráfico dos últimos 6 meses
  const monthNames = [
    'Jan',
    'Fev',
    'Mar',
    'Abr',
    'Mai',
    'Jun',
    'Jul',
    'Ago',
    'Set',
    'Out',
    'Nov',
    'Dez',
  ]
  const now = new Date()
  const monthlyData: { name: string; count: number; total: number; isCurrentMonth: boolean }[] = []

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const monthIndex = d.getMonth()
    const year = d.getFullYear()
    const label = `${monthNames[monthIndex]}`

    // Count quotes created in that month
    const matching = quotes.filter((q) => {
      const qDate = new Date(q.created)
      return qDate.getMonth() === monthIndex && qDate.getFullYear() === year
    })

    const monthTotal = matching.reduce((acc, curr) => acc + (curr.total || 0), 0)

    monthlyData.push({
      name: label,
      count: matching.length,
      total: monthTotal,
      isCurrentMonth: i === 0,
    })
  }

  // 5 orçamentos recentes
  const recentQuotes = [...quotes].slice(0, 5)

  // 5 clientes recentes
  const recentClients = [...clients].slice(0, 5)

  // =========================================================================
  // CÁLCULO DAS COMISSÕES DO MÊS ATUAL POR VENDEDOR
  // Nova Regra Corteplan solicitada:
  // "A comissão acumulada no dashboard só pode ser computada após o orçamento gerar o pedido."
  // - quotesCount: propostas emitidas no mês pelo vendedor (para acompanhamento comercial)
  // - ordersCount / volume faturado / comissão a receber: COMPUTADOS APENAS para
  //   orçamentos que já geraram pedido (order_id / order_number presente ou pedido na tabela orders)
  // - Confidencialidade: Administrador vê todos os vendedores; Vendedor vê apenas a própria linha.
  // =========================================================================

  // Conjunto de quote IDs que possuem pedido vinculado (via tabela orders ou campo do quote)
  const quotesWithOrdersSet = new Set<string>()
  orders.forEach((o) => {
    if (o.quote) quotesWithOrdersSet.add(o.quote)
  })
  quotes.forEach((q) => {
    if ((q.order_id && q.order_id.trim()) || (q.order_number && q.order_number > 0)) {
      quotesWithOrdersSet.add(q.id)
    }
  })

  const currentMonthQuotes = quotes.filter((q) => {
    if (!q.created) return false
    const qDate = new Date(q.created)
    return qDate.getMonth() === now.getMonth() && qDate.getFullYear() === now.getFullYear()
  })

  // Agrupa os orçamentos do mês por vendedor
  interface SellerCommissionSummary {
    userId?: string
    name: string
    role: string
    quotesCount: number
    ordersCount: number
    commissionTotal: number
    totalVolume: number
    isCurrentUser: boolean
  }

  // Mapa de vendedores conhecidos (a partir de usersList e dos orçamentos do mês)
  const sellersMap = new Map<string, SellerCommissionSummary>()

  // Inicializa com usuários ativos do sistema que sejam Vendedores ou tenham emitido algo
  usersList.forEach((u) => {
    const isMe = user?.id === u.id
    sellersMap.set(u.id, {
      userId: u.id,
      name: u.name || u.email.split('@')[0],
      role: u.role || 'Vendedor',
      quotesCount: 0,
      ordersCount: 0,
      commissionTotal: 0,
      totalVolume: 0,
      isCurrentUser: isMe,
    })
  })

  // Processa cada orçamento do mês
  currentMonthQuotes.forEach((q) => {
    // Identifica o vendedor
    let sellerKey = q.seller_user
    let sellerName = q.seller || q.expand?.seller_user?.name

    if (!sellerKey) {
      // Tenta achar pelo nome do vendedor nos users
      const match = usersList.find(
        (u) =>
          sellerName &&
          (u.name.toLowerCase().trim() === sellerName.toLowerCase().trim() ||
            sellerName.toLowerCase().includes(u.name.toLowerCase().trim())),
      )
      if (match) {
        sellerKey = match.id
        sellerName = match.name
      } else {
        sellerKey = sellerName ? `name:${sellerName}` : 'unknown'
      }
    }

    if (!sellerName && sellerKey && sellersMap.has(sellerKey)) {
      sellerName = sellersMap.get(sellerKey)!.name
    }

    const finalName = sellerName || 'Vendedor'
    const isMe =
      user?.id === sellerKey ||
      (user?.name && finalName.toLowerCase().trim() === user.name.toLowerCase().trim())

    if (!sellersMap.has(sellerKey)) {
      sellersMap.set(sellerKey, {
        userId: sellerKey.startsWith('name:') ? undefined : sellerKey,
        name: finalName,
        role: 'Vendedor',
        quotesCount: 0,
        ordersCount: 0,
        commissionTotal: 0,
        totalVolume: 0,
        isCurrentUser: isMe,
      })
    }

    const existing = sellersMap.get(sellerKey)!
    // Contador de propostas emitidas no mês
    existing.quotesCount += 1

    // REGRA: Comissão acumulada e volume faturado SÓ entram se o orçamento já gerou pedido
    const hasOrder = quotesWithOrdersSet.has(q.id)
    if (hasOrder) {
      const { commissionAmount } = calculateCommission(
        q.items,
        q.discount_percent,
        q.commission_percent,
      )
      existing.ordersCount += 1
      existing.commissionTotal += commissionAmount
      existing.totalVolume += q.total || 0
    }

    if (isMe) existing.isCurrentUser = true
  })

  // Converte para lista
  let sellersCommissionList = Array.from(sellersMap.values())

  // Se não for admin, filtra estritamente para apenas a própria linha
  if (!isAdmin) {
    sellersCommissionList = sellersCommissionList.filter(
      (s) =>
        s.isCurrentUser ||
        (user?.id && s.userId === user.id) ||
        (user?.name && s.name.toLowerCase().trim() === user.name.toLowerCase().trim()),
    )

    // Se o usuário ainda não tiver nenhum orçamento no mês, assegura exibição zerada
    if (sellersCommissionList.length === 0 && user) {
      sellersCommissionList = [
        {
          userId: user.id,
          name: user.name || 'Meu Usuário',
          role: user.role || 'Vendedor',
          quotesCount: 0,
          ordersCount: 0,
          commissionTotal: 0,
          totalVolume: 0,
          isCurrentUser: true,
        },
      ]
    }
  } else {
    // Admin: exibe vendedores que emitiram propostas, geraram pedidos ou comissionamento no mês
    if (sellersCommissionList.length > 8) {
      sellersCommissionList = sellersCommissionList.filter(
        (s) => s.quotesCount > 0 || s.ordersCount > 0 || s.commissionTotal > 0,
      )
    }
  }

  // Ordenar por maior comissão decrescente
  sellersCommissionList.sort((a, b) => b.commissionTotal - a.commissionTotal)

  const totalCommissionsMonth = sellersCommissionList.reduce((sum, s) => sum + s.commissionTotal, 0)
  const totalOrdersMonth = sellersCommissionList.reduce((sum, s) => sum + s.ordersCount, 0)
  const totalQuotesMonth = sellersCommissionList.reduce((sum, s) => sum + s.quotesCount, 0)

  // Cores de status
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

  // Helper avatar initials
  const getInitials = (name?: string) => {
    if (!name) return 'CL'
    const parts = name.trim().split(' ')
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <Loader2 className="h-8 w-8 animate-spin text-[#3A3A3C]" />
          <p className="text-sm">Carregando painel analítico...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in-50 duration-300">
      {/* Banner de boas-vindas / Ações rápidas */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
            Visão Geral das Propostas
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Acompanhe o desempenho comercial, clientes cadastrados e faturamento aprovado.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            asChild
            variant="outline"
            className="rounded-xl border-slate-300 hover:bg-slate-50 text-slate-700 font-medium"
          >
            <Link to="/clientes">
              <Users className="h-4 w-4 mr-2 text-slate-500" />
              Novo Cliente
            </Link>
          </Button>

          <Button
            asChild
            className="rounded-xl bg-[#3A3A3C] hover:bg-[#2D2D2F] text-white font-medium shadow-sm transition-all duration-200 hover:scale-[1.02]"
          >
            <Link to="/orcamentos/novo">
              <Plus className="h-4 w-4 mr-2 text-amber-400" />
              Novo Orçamento
            </Link>
          </Button>
        </div>
      </div>

      {/* PAINEL DE COMISSÕES DO MÊS (POR VENDEDOR) COM REGRA DE CONFIDENCIALIDADE */}
      <Card className="rounded-2xl border-slate-800 bg-[#1C1C1E] text-white shadow-xl overflow-hidden">
        <div className="p-6 border-b border-slate-800 bg-gradient-to-r from-[#242427] to-[#1C1C1E] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-[#E66812] to-[#F08A24] text-white flex items-center justify-center font-black shadow-md shrink-0">
              <Award className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Comissões do Mês ({monthNames[now.getMonth()]}/{now.getFullYear()})
                </h3>
                {isAdmin ? (
                  <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-orange-500/20 text-[#F08A24] border border-orange-500/30 flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3" />
                    Visão Geral Admin
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1">
                    <Lock className="h-3 w-3" />
                    Minha Comissão (Confidencial)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {isAdmin
                  ? 'Comissões acumuladas sobre orçamentos com pedidos gerados no mês atual (base de produtos comissionáveis)'
                  : 'Sua comissão a receber sobre orçamentos que já geraram pedido neste mês'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 bg-[#2C2C2E] px-4 py-2.5 rounded-xl border border-slate-700/60 shrink-0 self-start sm:self-auto flex-wrap sm:flex-nowrap">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                {isAdmin ? 'Total Comissões da Equipe' : 'Minha Comissão a Receber'}
              </span>
              <span className="font-mono text-lg sm:text-xl font-extrabold text-[#F08A24]">
                {formatCurrencyBRL(totalCommissionsMonth)}
              </span>
            </div>
            <div className="h-8 w-px bg-slate-700 hidden sm:block" />
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                Pedidos Gerados
              </span>
              <span className="font-mono text-lg sm:text-xl font-extrabold text-emerald-400">
                {totalOrdersMonth}
              </span>
            </div>
            <div className="h-8 w-px bg-slate-700 hidden sm:block" />
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                Propostas do Mês
              </span>
              <span className="font-mono text-lg sm:text-xl font-extrabold text-white">
                {totalQuotesMonth}
              </span>
            </div>
          </div>
        </div>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-[#242427] text-slate-400 text-xs uppercase font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-5 sm:px-6">Vendedor</th>
                  <th className="py-3 px-4 text-center">Propostas no Mês</th>
                  <th className="py-3 px-4 text-center">Pedidos Gerados</th>
                  <th className="py-3 px-4 text-right">Volume Faturado</th>
                  <th className="py-3 px-5 sm:px-6 text-right">Comissão a Receber</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {sellersCommissionList.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-xs text-slate-500">
                      Nenhuma proposta ou movimentação registrada no mês de{' '}
                      {monthNames[now.getMonth()]}.
                    </td>
                  </tr>
                ) : (
                  sellersCommissionList.map((seller, idx) => (
                    <tr
                      key={seller.userId || seller.name}
                      className={`transition-colors ${
                        seller.isCurrentUser
                          ? 'bg-amber-500/10 hover:bg-amber-500/15'
                          : 'hover:bg-slate-800/50'
                      }`}
                    >
                      <td className="py-3.5 px-5 sm:px-6">
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold text-xs text-slate-500 w-5">
                            #{idx + 1}
                          </span>
                          <Avatar className="h-8 w-8 ring-1 ring-slate-700 shrink-0">
                            <AvatarFallback className="bg-[#2C2C2E] text-[#F08A24] font-bold text-xs">
                              {getInitials(seller.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-semibold text-white flex items-center gap-2">
                              <span>{seller.name}</span>
                              {seller.isCurrentUser && (
                                <Badge className="bg-[#F08A24] text-black font-extrabold text-[10px] hover:bg-[#F08A24] py-0 px-1.5 h-4">
                                  Você
                                </Badge>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-400">{seller.role}</span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span className="font-mono font-semibold text-slate-300 bg-[#262628] px-2.5 py-1 rounded-lg border border-slate-700/80">
                          {seller.quotesCount} {seller.quotesCount === 1 ? 'proposta' : 'propostas'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`font-mono font-bold px-2.5 py-1 rounded-lg border ${
                            seller.ordersCount > 0
                              ? 'text-emerald-300 bg-emerald-950/40 border-emerald-800/60'
                              : 'text-slate-500 bg-[#262628] border-slate-700/60'
                          }`}
                        >
                          {seller.ordersCount} {seller.ordersCount === 1 ? 'pedido' : 'pedidos'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono text-slate-300">
                        {formatCurrencyBRL(seller.totalVolume)}
                      </td>

                      <td className="py-3.5 px-5 sm:px-6 text-right">
                        <span className="font-mono font-bold text-base text-[#F08A24]">
                          {formatCurrencyBRL(seller.commissionTotal)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="p-3.5 bg-[#171719] border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-400 gap-2 px-5 sm:px-6">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[#F08A24]" />
              <span>
                Regra ativa: a comissão e o volume faturado são computados exclusivamente após o
                orçamento gerar pedido.
              </span>
            </div>
            {!isAdmin && (
              <span className="text-slate-500 text-[11px]">
                Regra de confidencialidade ativa: apenas o próprio vendedor visualiza seus dados.
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 4 Cards de Resumo (KPIs) com microinteração de elevação */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* KPI 1: Clientes */}
        <Card className="rounded-2xl border-slate-200/90 shadow-xs hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total de Clientes
            </CardTitle>
            <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-slate-900 font-mono tracking-tight">
              {totalClients}
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-xs font-medium text-emerald-600">
              <TrendingUp className="h-3.5 w-3.5" />
              <span>Base ativa e atualizada</span>
            </div>
          </CardContent>
        </Card>

        {/* KPI 2: Orçamentos Emitidos */}
        <Card className="rounded-2xl border-slate-200/90 shadow-xs hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Orçamentos Emitidos
            </CardTitle>
            <div className="h-10 w-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
              <FileText className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-slate-900 font-mono tracking-tight">
              {totalQuotes}
            </div>
            <p className="text-xs text-slate-500 mt-2">Propostas registradas no sistema</p>
          </CardContent>
        </Card>

        {/* KPI 3: Orçamentos Aprovados */}
        <Card className="rounded-2xl border-slate-200/90 shadow-xs hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Orçamentos Aprovados
            </CardTitle>
            <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <CheckCircle className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-slate-900 font-mono tracking-tight">
              {totalApprovedQuotes}
            </div>
            <p className="text-xs text-slate-500 mt-2">
              {totalQuotes > 0
                ? `${Math.round((totalApprovedQuotes / totalQuotes) * 100)}% de taxa de conversão`
                : 'Sem propostas emitidas'}
            </p>
          </CardContent>
        </Card>

        {/* KPI 4: Valor Total Aprovado */}
        <Card className="rounded-2xl border-slate-200/90 shadow-xs hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Valor Total Aprovado
            </CardTitle>
            <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <DollarSign className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl lg:text-3xl font-extrabold text-emerald-700 font-mono tracking-tight truncate">
              {formatCurrencyBRL(totalApprovedValue)}
            </div>
            <p className="text-xs text-slate-500 mt-2">Faturamento comercial aprovado</p>
          </CardContent>
        </Card>
      </div>

      {/* Grid: Gráfico e Listas Recentes */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Gráfico de Barras: 60% (7 cols desktop) */}
        <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between pb-6">
            <div>
              <h3 className="text-base font-bold text-slate-900">Orçamentos Emitidos por Mês</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Histórico de emissão nos últimos 6 meses (mês atual em destaque âmbar)
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs font-medium text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-xs bg-[#3A3A3C]" /> Histórico
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-xs bg-[#F59E0B]" /> Mês Atual
              </span>
            </div>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={{ stroke: '#CBD5E1' }}
                  tick={{ fill: '#64748B', fontSize: 12 }}
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#64748B', fontSize: 12 }}
                />
                <Tooltip
                  cursor={{ fill: '#F1F5F9', radius: 8 }}
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload
                      return (
                        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs space-y-1">
                          <p className="font-bold text-amber-400">{label}</p>
                          <p className="text-slate-200">
                            Propostas: <span className="font-bold font-mono">{data.count}</span>
                          </p>
                          <p className="text-slate-200">
                            Volume estimado:{' '}
                            <span className="font-bold font-mono">
                              {formatCurrencyBRL(data.total)}
                            </span>
                          </p>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {monthlyData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.isCurrentMonth ? '#F08A24' : '#3A3A3C'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Listas Recentes (40% - 5 cols desktop) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Orçamentos Recentes */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Orçamentos Recentes</h3>
              <Link
                to="/orcamentos"
                className="text-xs font-semibold text-[#3A3A3C] hover:text-[#F08A24] flex items-center gap-1 hover:underline"
              >
                Ver todos
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            <div className="divide-y divide-slate-100 mt-2">
              {recentQuotes.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  Nenhum orçamento cadastrado ainda.
                </div>
              ) : (
                recentQuotes.map((quote) => (
                  <Link
                    key={quote.id}
                    to={`/orcamentos/${quote.id}`}
                    className="flex items-center justify-between py-3 group hover:bg-slate-50 -mx-2 px-2 rounded-xl transition-colors"
                  >
                    <div className="truncate pr-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-[#3A3A3C] group-hover:text-[#F08A24]">
                          {formatQuoteNumber(quote.quote_number)}
                        </span>
                        {getStatusBadge(quote.status)}
                      </div>
                      <p className="text-xs text-slate-600 truncate mt-1">
                        {quote.expand?.client?.name || 'Cliente'}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      {canViewValues(quote, user) ? (
                        <span className="font-mono text-xs font-bold text-slate-900">
                          {formatCurrencyBRL(quote.total)}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-mono font-semibold text-[11px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                          <Lock className="h-3 w-3 text-slate-400" />
                          Confidencial
                        </span>
                      )}
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>

          {/* Clientes Recentes */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Clientes Recentes</h3>
              <Link
                to="/clientes"
                className="text-xs font-semibold text-[#3A3A3C] hover:text-[#F08A24] flex items-center gap-1 hover:underline"
              >
                Ver todos
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            <div className="divide-y divide-slate-100 mt-2">
              {recentClients.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  Nenhum cliente cadastrado ainda.
                </div>
              ) : (
                recentClients.map((c) => (
                  <Link
                    key={c.id}
                    to={`/clientes/${c.id}`}
                    className="flex items-center justify-between py-3 group hover:bg-slate-50 -mx-2 px-2 rounded-xl transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="h-8 w-8 ring-1 ring-slate-200 shrink-0">
                        <AvatarFallback className="bg-slate-100 text-[#3A3A3C] font-bold text-xs">
                          {getInitials(c.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 truncate">
                        <p className="text-xs font-semibold text-slate-900 group-hover:text-[#3A3A3C] truncate">
                          {c.name}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">
                          {c.company || c.phone}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0 text-[11px] text-slate-400">
                      {c.city ? c.city.split('-')[0] : 'Ver'}
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

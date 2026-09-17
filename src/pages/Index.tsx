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
  Building,
  Phone,
  Clock,
  Sparkles,
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
import { useRealtime } from '@/hooks/use-realtime'
import type { ClientRecord, QuoteRecord } from '@/types'
import { formatCurrencyBRL, formatQuoteNumber } from '@/types'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

export default function Index() {
  const [clients, setClients] = useState<ClientRecord[]>([])
  const [quotes, setQuotes] = useState<QuoteRecord[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    try {
      const [allClients, allQuotes] = await Promise.all([
        clientService.getAll(),
        quoteService.getAll(),
      ])
      setClients(allClients)
      setQuotes(allQuotes)
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
                      <span className="font-mono text-xs font-bold text-slate-900">
                        {formatCurrencyBRL(quote.total)}
                      </span>
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

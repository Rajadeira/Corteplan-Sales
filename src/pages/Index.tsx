import React, { useState, useEffect, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Users,
  FileText,
  CheckCircle,
  DollarSign,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Plus,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Calendar,
  CalendarDays,
  Percent,
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
import { followupService, getFollowupStatus } from '@/services/followups'
import { cashflowService } from '@/services/cashflow'
import { useAuth } from '@/contexts/AuthContext'
import { useRealtime } from '@/hooks/use-realtime'
import type {
  ClientRecord,
  QuoteRecord,
  OrderRecord,
  AppUserRecord,
  FollowupRecord,
  CashflowEntryRecord,
} from '@/types'
import {
  PhoneForwarded,
  PhoneCall,
  AlertCircle,
  Clock,
  AlertTriangle,
  CalendarClock,
} from 'lucide-react'
import { formatCurrencyBRL, formatDateBR, formatQuoteNumber, calculateCommission } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Award, Lock, ShieldCheck } from 'lucide-react'
import { canViewValues } from '@/lib/permissions'

// Nomes completos e abreviados dos meses em PT-BR
const monthFullNames = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

const monthShortNames = [
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

/**
 * Helper para interpretar a data do registro estritamente em horário local,
 * evitando que desvios de timezone alterem mês/ano de competência.
 */
function parseLocalDate(dateStr?: string) {
  if (!dateStr) return null
  const clean = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.trim().split(' ')[0]
  const match = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (match) {
    const year = parseInt(match[1], 10)
    const month = parseInt(match[2], 10) - 1 // 0-based
    const day = parseInt(match[3], 10)
    return { year, month, day, dateOnly: clean }
  }
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return null
  return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate(), dateOnly: clean }
}

export default function Index() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'Administrador'
  const [searchParams, setSearchParams] = useSearchParams()

  // Sincronização de competência com URL searchParams (?month=8&year=2025)
  const currentDate = useMemo(() => new Date(), [])
  const currentMonth = currentDate.getMonth()
  const currentYear = currentDate.getFullYear()

  const urlMonthParam = searchParams.get('month')
  const urlYearParam = searchParams.get('year')

  const initialMonth =
    urlMonthParam !== null && !isNaN(Number(urlMonthParam))
      ? Math.max(0, Math.min(11, Number(urlMonthParam)))
      : currentMonth
  const initialYear =
    urlYearParam !== null && !isNaN(Number(urlYearParam)) ? Number(urlYearParam) : currentYear

  const [selectedMonth, setSelectedMonth] = useState<number>(initialMonth)
  const [selectedYear, setSelectedYear] = useState<number>(initialYear)

  // Atualiza estado quando URL mudar
  useEffect(() => {
    const m = searchParams.get('month')
    if (m !== null && !isNaN(Number(m))) {
      setSelectedMonth(Math.max(0, Math.min(11, Number(m))))
    }
    const y = searchParams.get('year')
    if (y !== null && !isNaN(Number(y))) {
      setSelectedYear(Number(y))
    }
  }, [searchParams])

  // Helper para trocar competência e persistir na URL
  const updateCompetency = (m: number, y: number) => {
    setSelectedMonth(m)
    setSelectedYear(y)
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('month', String(m))
    nextParams.set('year', String(y))
    setSearchParams(nextParams)
  }

  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      updateCompetency(11, selectedYear - 1)
    } else {
      updateCompetency(selectedMonth - 1, selectedYear)
    }
  }

  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      updateCompetency(0, selectedYear + 1)
    } else {
      updateCompetency(selectedMonth + 1, selectedYear)
    }
  }

  const handleGoToToday = () => {
    const now = new Date()
    updateCompetency(now.getMonth(), now.getFullYear())
  }

  const isCurrentMonthView = selectedMonth === currentMonth && selectedYear === currentYear

  const [clients, setClients] = useState<ClientRecord[]>([])
  const [quotes, setQuotes] = useState<QuoteRecord[]>([])
  const [orders, setOrders] = useState<OrderRecord[]>([])
  const [usersList, setUsersList] = useState<AppUserRecord[]>([])
  const [allFollowups, setAllFollowups] = useState<FollowupRecord[]>([])
  const [cashflowEntries, setCashflowEntries] = useState<CashflowEntryRecord[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    try {
      // Vendedor NÃO deve nem renderizar nem buscar cashflow_entries
      const promises: [
        Promise<ClientRecord[]>,
        Promise<QuoteRecord[]>,
        Promise<OrderRecord[]>,
        Promise<AppUserRecord[]>,
        Promise<FollowupRecord[]>,
        Promise<CashflowEntryRecord[]>,
      ] = [
        clientService.getAll(),
        quoteService.getAll(),
        orderService.getAll().catch(() => []),
        userService.getAll().catch(() => []),
        followupService.getAll().catch(() => []),
        isAdmin ? cashflowService.getAll().catch(() => []) : Promise.resolve([]),
      ]

      const [allClients, allQuotes, allOrders, allUsers, followupsList, cashflowList] =
        await Promise.all(promises)

      setClients(allClients)
      setQuotes(allQuotes)
      setOrders(allOrders)
      setUsersList(allUsers)
      setAllFollowups(followupsList)
      if (isAdmin) {
        setCashflowEntries(cashflowList)
      }
    } catch (err) {
      console.error('Erro ao carregar dados do Dashboard:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [isAdmin])

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

  useRealtime<FollowupRecord>('followups', () => {
    followupService
      .getAll()
      .then(setAllFollowups)
      .catch(() => {})
  })

  // Realtime para cashflow_entries se for Administrador
  useRealtime<CashflowEntryRecord>('cashflow_entries', () => {
    if (isAdmin) {
      cashflowService
        .getAll()
        .then(setCashflowEntries)
        .catch(() => {})
    }
  })

  // Agrupamento de follow-ups por quoteId
  const followupsByQuoteId = React.useMemo(() => {
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

  // Lista de propostas pendentes de retorno (status Enviado/Aprovado há > 2 dias sem follow-up recente)
  // Respeita privacidade comercial: vendedor vê somente suas propostas; administrador vê todas
  const pendingFollowups = React.useMemo(() => {
    return quotes
      .filter((q) => {
        // Filtro de vendedor vs admin
        if (!isAdmin) {
          const sellerUser = q.seller_user
          const sellerName = (q.seller || '').toLowerCase()
          const userName = (user?.name || '').toLowerCase()
          const isOwner =
            (sellerUser && sellerUser === user?.id) ||
            (!sellerUser && userName && sellerName.includes(userName))
          if (!isOwner) return false
        }

        const qFollowups = followupsByQuoteId.get(q.id) || []
        const fStatus = getFollowupStatus(q, qFollowups)
        return fStatus.isPendingReturn
      })
      .map((q) => {
        const qFollowups = followupsByQuoteId.get(q.id) || []
        const fStatus = getFollowupStatus(q, qFollowups)
        return {
          quote: q,
          status: fStatus,
          totalFollowups: qFollowups.length,
        }
      })
      .sort((a, b) => b.status.daysElapsed - a.status.daysElapsed)
  }, [quotes, followupsByQuoteId, isAdmin, user])

  // Cálculos dos KPIs
  // =========================================================================
  // PAINEL DE PARCELAS DO FLUXO DE CAIXA (EXCLUSIVO PARA ADMINISTRADOR)
  // - Parcelas Vencidas: status='Pendente' e date < hoje
  //   (quantidade, soma R$, cliente e data da mais antiga)
  // - Parcelas a Vencer (30 dias): status='Pendente' e date entre hoje e hoje+30
  //   (quantidade e soma R$)
  // =========================================================================
  const installmentsSummary = React.useMemo(() => {
    if (!isAdmin) {
      return {
        overdueCount: 0,
        overdueTotal: 0,
        oldestOverdueDate: null as string | null,
        oldestOverdueClient: null as string | null,
        upcomingCount: 0,
        upcomingTotal: 0,
      }
    }

    const todayStr = new Date().toISOString().split('T')[0]
    const in30DaysDate = new Date()
    in30DaysDate.setDate(in30DaysDate.getDate() + 30)
    const in30DaysStr = in30DaysDate.toISOString().split('T')[0]

    let overdueCount = 0
    let overdueTotal = 0
    let oldestDate: string | null = null
    let oldestClient: string | null = null

    let upcomingCount = 0
    let upcomingTotal = 0
    let firstUpcomingDate: string | null = null

    // Helper para extrair YYYY-MM-DD estritamente como string local
    const extractLocalDateString = (dStr?: string) => {
      if (!dStr) return ''
      return dStr.includes('T') ? dStr.split('T')[0] : dStr.trim().split(' ')[0]
    }

    // Considera apenas entradas de fluxo com origin === 'parcela' e status === 'Pendente'
    const pendingInstallments = cashflowEntries.filter(
      (e) => (e.origin === 'parcela' || e.order) && e.status === 'Pendente' && e.date,
    )

    pendingInstallments.forEach((entry) => {
      const entryDate = extractLocalDateString(entry.date)
      if (!entryDate) return
      const amount = Number(entry.amount) || 0

      if (entryDate < todayStr) {
        overdueCount += 1
        overdueTotal += amount

        if (!oldestDate || entryDate < oldestDate) {
          oldestDate = entryDate
          // Tenta extrair cliente do expand do order ou da descrição
          let clientName = entry.expand?.order?.expand?.client?.name || ''
          if (!clientName && entry.description) {
            const match = entry.description.match(/\((.*?)\)/)
            if (match && match[1]) {
              clientName = match[1].trim()
            }
          }
          oldestClient = clientName || 'Cliente'
        }
      } else if (entryDate >= todayStr && entryDate <= in30DaysStr) {
        upcomingCount += 1
        upcomingTotal += amount

        if (!firstUpcomingDate || entryDate < firstUpcomingDate) {
          firstUpcomingDate = entryDate
        }
      }
    })

    return {
      overdueCount,
      overdueTotal,
      oldestOverdueDate: oldestDate,
      oldestOverdueClient: oldestClient,
      upcomingCount,
      upcomingTotal,
      firstUpcomingDate,
    }
  }, [cashflowEntries, isAdmin])

  // Anos disponíveis para seleção (do histórico até futuro próximo)
  const availableYears = useMemo(() => {
    const list = [2023, 2024, 2025, 2026, 2027, 2028]
    if (!list.includes(selectedYear)) {
      list.push(selectedYear)
      list.sort((a, b) => a - b)
    }
    return list
  }, [selectedYear])

  // =========================================================================
  // FILTRAGEM MENSAL (COMPETÊNCIA SELECIONADA: selectedMonth / selectedYear)
  // E CÁLCULO COMPARATIVO VS. MÊS ANTERIOR (MoM - Month over Month)
  // =========================================================================

  // Mês anterior (para variação % e indicadores de tendência)
  const prevMonthIndex = selectedMonth === 0 ? 11 : selectedMonth - 1
  const prevMonthYear = selectedMonth === 0 ? selectedYear - 1 : selectedYear

  // Orçamentos criados no mês selecionado
  const selectedMonthQuotes = useMemo(() => {
    return quotes.filter((q) => {
      const parsed = parseLocalDate(q.created)
      return parsed && parsed.month === selectedMonth && parsed.year === selectedYear
    })
  }, [quotes, selectedMonth, selectedYear])

  // Orçamentos criados no mês anterior (para comparação MoM)
  const prevMonthQuotes = useMemo(() => {
    return quotes.filter((q) => {
      const parsed = parseLocalDate(q.created)
      return parsed && parsed.month === prevMonthIndex && parsed.year === prevMonthYear
    })
  }, [quotes, prevMonthIndex, prevMonthYear])

  // Clientes cadastrados até o final da competência selecionada
  // (e novos clientes cadastrados especificamente no mês selecionado)
  const clientsCreatedInSelectedMonth = useMemo(() => {
    return clients.filter((c) => {
      const parsed = parseLocalDate(c.created)
      return parsed && parsed.month === selectedMonth && parsed.year === selectedYear
    })
  }, [clients, selectedMonth, selectedYear])

  const clientsCreatedInPrevMonth = useMemo(() => {
    return clients.filter((c) => {
      const parsed = parseLocalDate(c.created)
      return parsed && parsed.month === prevMonthIndex && parsed.year === prevMonthYear
    })
  }, [clients, prevMonthIndex, prevMonthYear])

  // Base cumulativa de clientes até o final da competência selecionada
  const cumulativeClientsUntilPeriod = useMemo(() => {
    // Ano/Mês no formato YYYY-MM
    const periodKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`
    return clients.filter((c) => {
      const parsed = parseLocalDate(c.created)
      if (!parsed) return true // Se sem data, assume cliente na base
      const itemKey = `${parsed.year}-${String(parsed.month + 1).padStart(2, '0')}`
      return itemKey <= periodKey
    })
  }, [clients, selectedMonth, selectedYear])

  // Métricas do Mês Selecionado
  const totalQuotesPeriod = selectedMonthQuotes.length
  const approvedQuotesPeriod = useMemo(
    () => selectedMonthQuotes.filter((q) => q.status === 'Aprovado'),
    [selectedMonthQuotes],
  )
  const totalApprovedQuotesPeriod = approvedQuotesPeriod.length
  const totalApprovedValuePeriod = useMemo(
    () => approvedQuotesPeriod.reduce((sum, q) => sum + (q.total || 0), 0),
    [approvedQuotesPeriod],
  )
  const conversionRatePeriod =
    totalQuotesPeriod > 0 ? Math.round((totalApprovedQuotesPeriod / totalQuotesPeriod) * 100) : 0

  // Métricas do Mês Anterior (MoM)
  const prevTotalQuotes = prevMonthQuotes.length
  const prevApprovedQuotes = prevMonthQuotes.filter((q) => q.status === 'Aprovado')
  const prevTotalApprovedQuotes = prevApprovedQuotes.length
  const prevTotalApprovedValue = prevApprovedQuotes.reduce((sum, q) => sum + (q.total || 0), 0)
  const prevNewClients = clientsCreatedInPrevMonth.length

  // Variações percentuais (% MoM)
  const calcVariationPercent = (current: number, previous: number): number | null => {
    if (previous === 0) {
      if (current === 0) return 0
      return null // Sem base anterior (ex: +100% ou infinito)
    }
    return Math.round(((current - previous) / previous) * 100)
  }

  const quotesVariation = calcVariationPercent(totalQuotesPeriod, prevTotalQuotes)
  const approvedQuotesVariation = calcVariationPercent(
    totalApprovedQuotesPeriod,
    prevTotalApprovedQuotes,
  )
  const approvedValueVariation = calcVariationPercent(
    totalApprovedValuePeriod,
    prevTotalApprovedValue,
  )
  const newClientsVariation = calcVariationPercent(
    clientsCreatedInSelectedMonth.length,
    prevNewClients,
  )

  // Gráfico de 6 meses centrados ou terminando na competência selecionada:
  // Mostra os 6 meses terminando no mês selecionado (com a barra do mês selecionado em destaque âmbar)
  const monthlyData = useMemo(() => {
    const list: {
      name: string
      fullName: string
      count: number
      total: number
      isSelectedMonth: boolean
      monthIdx: number
      yearVal: number
    }[] = []

    for (let i = 5; i >= 0; i--) {
      const d = new Date(selectedYear, selectedMonth - i, 1)
      const mIdx = d.getMonth()
      const yVal = d.getFullYear()
      const label = `${monthShortNames[mIdx]}`
      const fullName = `${monthFullNames[mIdx]} de ${yVal}`

      const matching = quotes.filter((q) => {
        const parsed = parseLocalDate(q.created)
        return parsed && parsed.month === mIdx && parsed.year === yVal
      })

      const monthTotal = matching.reduce((acc, curr) => acc + (curr.total || 0), 0)

      list.push({
        name: label,
        fullName,
        count: matching.length,
        total: monthTotal,
        isSelectedMonth: i === 0,
        monthIdx: mIdx,
        yearVal: yVal,
      })
    }
    return list
  }, [quotes, selectedMonth, selectedYear])

  // Orçamentos Recentes da competência selecionada (até 6 mais recentes do período)
  const periodRecentQuotes = useMemo(() => {
    const sorted = [...selectedMonthQuotes].sort((a, b) => {
      const da = new Date(a.created).getTime() || 0
      const db = new Date(b.created).getTime() || 0
      return db - da
    })
    return sorted.slice(0, 6)
  }, [selectedMonthQuotes])

  // Clientes do período (novos cadastrados no mês selecionado, ou os mais recentes até então)
  const periodRecentClients = useMemo(() => {
    const monthClients = [...clientsCreatedInSelectedMonth].sort((a, b) => {
      const da = new Date(a.created).getTime() || 0
      const db = new Date(b.created).getTime() || 0
      return db - da
    })
    if (monthClients.length > 0) {
      return monthClients.slice(0, 6)
    }
    // Caso não haja clientes novos no mês, mostra os 6 clientes mais recentes da base até a competência
    const sorted = [...cumulativeClientsUntilPeriod].sort((a, b) => {
      const da = new Date(a.created).getTime() || 0
      const db = new Date(b.created).getTime() || 0
      return db - da
    })
    return sorted.slice(0, 6)
  }, [clientsCreatedInSelectedMonth, cumulativeClientsUntilPeriod])

  // =========================================================================
  // CÁLCULO DAS COMISSÕES DO MÊS SELECIONADO POR VENDEDOR
  // Nova Regra Corteplan solicitada:
  // "A comissão acumulada no dashboard só pode ser computada após o orçamento gerar o pedido."
  // - quotesCount: propostas emitidas no mês selecionado pelo vendedor
  // - ordersCount / volume faturado / comissão a receber: COMPUTADOS APENAS para
  //   orçamentos que já geraram pedido (order_id / order_number presente ou pedido na tabela orders)
  // - Confidencialidade: Administrador vê todos os vendedores; Vendedor vê apenas a própria linha.
  // =========================================================================

  // Conjunto de quote IDs que possuem pedido vinculado (via tabela orders ou campo do quote)
  const quotesWithOrdersSet = useMemo(() => {
    const set = new Set<string>()
    orders.forEach((o) => {
      if (o.quote) set.add(o.quote)
    })
    quotes.forEach((q) => {
      if ((q.order_id && q.order_id.trim()) || (q.order_number && q.order_number > 0)) {
        set.add(q.id)
      }
    })
    return set
  }, [orders, quotes])

  // Agrupa os orçamentos do mês selecionado por vendedor
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

  const { sellersCommissionList, totalCommissionsMonth, totalOrdersMonth, totalQuotesMonth } =
    useMemo(() => {
      const map = new Map<string, SellerCommissionSummary>()

      // Inicializa com usuários ativos do sistema
      usersList.forEach((u) => {
        const isMe = user?.id === u.id
        map.set(u.id, {
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

      // Processa cada orçamento da competência selecionada
      selectedMonthQuotes.forEach((q) => {
        let sellerKey = q.seller_user
        let sellerName = q.seller || q.expand?.seller_user?.name

        if (!sellerKey) {
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

        if (!sellerName && sellerKey && map.has(sellerKey)) {
          sellerName = map.get(sellerKey)!.name
        }

        const finalName = sellerName || 'Vendedor'
        const isMe =
          user?.id === sellerKey ||
          (user?.name && finalName.toLowerCase().trim() === user.name.toLowerCase().trim())

        if (!map.has(sellerKey)) {
          map.set(sellerKey, {
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

        const existing = map.get(sellerKey)!
        existing.quotesCount += 1

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

      let list = Array.from(map.values())

      if (!isAdmin) {
        list = list.filter(
          (s) =>
            s.isCurrentUser ||
            (user?.id && s.userId === user.id) ||
            (user?.name && s.name.toLowerCase().trim() === user.name.toLowerCase().trim()),
        )

        if (list.length === 0 && user) {
          list = [
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
        if (list.length > 8) {
          list = list.filter((s) => s.quotesCount > 0 || s.ordersCount > 0 || s.commissionTotal > 0)
        }
      }

      list.sort((a, b) => b.commissionTotal - a.commissionTotal)

      const totalCommissions = list.reduce((sum, s) => sum + s.commissionTotal, 0)
      const totalOrders = list.reduce((sum, s) => sum + s.ordersCount, 0)
      const totalQuotes = list.reduce((sum, s) => sum + s.quotesCount, 0)

      return {
        sellersCommissionList: list,
        totalCommissionsMonth: totalCommissions,
        totalOrdersMonth: totalOrders,
        totalQuotesMonth: totalQuotes,
      }
    }, [usersList, user, selectedMonthQuotes, quotesWithOrdersSet, isAdmin])

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

      {/* SELETOR DE COMPETÊNCIA MENSAL (HISTÓRICO ATUAL E ANTERIORES) */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Lado esquerdo: Navegação de Mês/Ano + Botão Ir para hoje */}
          <div className="flex items-center flex-wrap gap-2.5 sm:gap-3">
            <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={handlePrevMonth}
                title="Mês anterior"
                className="h-8 w-8 p-0 rounded-lg hover:bg-white text-slate-700"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <div className="flex items-center gap-1.5 px-1">
                <Select
                  value={String(selectedMonth)}
                  onValueChange={(val) => updateCompetency(Number(val), selectedYear)}
                >
                  <SelectTrigger className="w-36 h-8 text-xs font-semibold rounded-lg bg-white border-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {monthFullNames.map((name, idx) => (
                      <SelectItem key={idx} value={String(idx)}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={String(selectedYear)}
                  onValueChange={(val) => updateCompetency(selectedMonth, Number(val))}
                >
                  <SelectTrigger className="w-24 h-8 text-xs font-semibold rounded-lg bg-white border-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableYears.map((yr) => (
                      <SelectItem key={yr} value={String(yr)}>
                        {yr}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={handleNextMonth}
                title="Próximo mês"
                className="h-8 w-8 p-0 rounded-lg hover:bg-white text-slate-700"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Atalho "Ir para hoje" quando não estiver no mês corrente */}
            {!isCurrentMonthView && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleGoToToday}
                className="h-8 text-xs rounded-xl border-amber-300 text-amber-900 bg-amber-50 hover:bg-amber-100 font-semibold"
              >
                <Calendar className="h-3.5 w-3.5 mr-1 text-[#E66812]" />
                Ir para hoje
              </Button>
            )}
          </div>

          {/* Lado direito: Rótulo claro da competência e status */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200">
              <CalendarDays className="h-4 w-4 text-[#F08A24]" />
              <span className="text-xs font-medium text-slate-600">Competência ativa:</span>
              <strong className="text-xs font-bold text-slate-900">
                {monthFullNames[selectedMonth]} de {selectedYear}
              </strong>
            </div>

            {isCurrentMonthView ? (
              <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-semibold py-1 px-2.5">
                Mês Corrente
              </Badge>
            ) : (
              <Badge className="bg-amber-50 text-amber-800 border border-amber-300 text-[11px] font-semibold py-1 px-2.5">
                Histórico
              </Badge>
            )}
          </div>
        </div>

        {/* Resumo do período selecionado e aviso caso não haja movimentação */}
        {totalQuotesPeriod === 0 && (
          <div className="p-3 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-xs text-slate-500 flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-slate-400 shrink-0" />
              Nenhum orçamento emitido no mês de {monthFullNames[selectedMonth]} de {selectedYear}.
              Os indicadores abaixo refletem a competência selecionada.
            </span>
            {!isCurrentMonthView && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleGoToToday}
                className="text-xs text-[#E66812] hover:text-[#F08A24] font-semibold h-7"
              >
                Voltar ao mês atual &rarr;
              </Button>
            )}
          </div>
        )}
      </div>

      {/* PAINEL DE COMISSÕES DO PERÍODO SELECIONADO (POR VENDEDOR) COM REGRA DE CONFIDENCIALIDADE */}
      <Card className="rounded-2xl border-slate-800 bg-[#1C1C1E] text-white shadow-xl overflow-hidden">
        <div className="p-6 border-b border-slate-800 bg-gradient-to-r from-[#242427] to-[#1C1C1E] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-[#E66812] to-[#F08A24] text-white flex items-center justify-center font-black shadow-md shrink-0">
              <Award className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Comissões da Competência ({monthFullNames[selectedMonth]} de {selectedYear})
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
                  ? `Comissões acumuladas sobre orçamentos com pedidos gerados em ${monthFullNames[selectedMonth]} de ${selectedYear}`
                  : `Sua comissão a receber sobre orçamentos que geraram pedido em ${monthFullNames[selectedMonth]} de ${selectedYear}`}
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
                Propostas do Período
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
                  <th className="py-3 px-4 text-center">Propostas no Período</th>
                  <th className="py-3 px-4 text-center">Pedidos Gerados</th>
                  <th className="py-3 px-4 text-right">Volume Faturado</th>
                  <th className="py-3 px-5 sm:px-6 text-right">Comissão a Receber</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {sellersCommissionList.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-xs text-slate-500">
                      Nenhuma proposta ou movimentação registrada na competência de{' '}
                      {monthFullNames[selectedMonth]} de {selectedYear}.
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

      {/* CARD DE AVISO: Propostas Pendentes de Retorno (Regra de Negócio de Follow-up) */}
      {pendingFollowups.length > 0 && (
        <Card className="rounded-2xl border-2 border-[#F08A24] bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-white shadow-md overflow-hidden animate-in fade-in-50 duration-200">
          <div className="p-5 border-b border-amber-200/80 bg-amber-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-[#F08A24] text-white flex items-center justify-center shrink-0 shadow-sm">
                <PhoneForwarded className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-bold text-amber-950">
                    Propostas Pendentes de Retorno ({pendingFollowups.length})
                  </h3>
                  <Badge className="bg-[#E66812] text-white text-[10px] font-bold px-2 py-0.5">
                    Ação recomendada
                  </Badge>
                </div>
                <p className="text-xs text-amber-900/80 mt-0.5">
                  Orçamentos enviados há mais de 2 dias sem contato recente do cliente. Ligue para
                  saber o que ele achou da proposta!
                </p>
              </div>
            </div>

            <Button
              asChild
              variant="outline"
              size="sm"
              className="rounded-xl border-amber-300 bg-white hover:bg-amber-100 text-amber-950 text-xs font-semibold shrink-0"
            >
              <Link to="/orcamentos">Ver todos os orçamentos &rarr;</Link>
            </Button>
          </div>

          <CardContent className="p-4 sm:p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {pendingFollowups.slice(0, 6).map(({ quote: q, status: s, totalFollowups }) => (
                <div
                  key={q.id}
                  className="bg-white rounded-xl p-3.5 border border-amber-200 hover:border-amber-400 hover:shadow-xs transition-all space-y-2 flex flex-col justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-xs bg-slate-100 text-[#3A3A3C] px-2 py-0.5 rounded-md border border-slate-200">
                        {formatQuoteNumber(q.quote_number, q.revision)}
                      </span>
                      <span className="text-[10px] font-bold text-[#E66812] bg-amber-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Há {s.daysElapsed} dias
                      </span>
                    </div>

                    <div className="font-bold text-xs sm:text-sm text-slate-900 truncate pt-0.5">
                      {q.expand?.client?.name || 'Cliente'}
                    </div>

                    <p className="text-[11px] text-slate-500 truncate">
                      Vendedor: {q.seller || q.expand?.seller_user?.name || 'Vendedor'} &bull;{' '}
                      {canViewValues(q, user) ? formatCurrencyBRL(q.total) : 'Confidencial'}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                    <span className="text-[11px] text-slate-400">
                      {totalFollowups > 0
                        ? `${totalFollowups} contato(s) registrado(s)`
                        : 'Nenhum contato ainda'}
                    </span>

                    <Button
                      asChild
                      size="sm"
                      className="h-7 px-2.5 text-xs font-semibold bg-[#E66812] hover:bg-[#F08A24] text-white rounded-lg shadow-2xs"
                    >
                      <Link to={`/orcamentos/${q.id}/followup`}>
                        <PhoneCall className="h-3 w-3 mr-1" />
                        Follow-up
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* PAINEL DE PARCELAS — EXCLUSIVO PARA ADMINISTRADOR */}
      {isAdmin && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-[#F08A24]" />
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                Painel de Parcelas
              </h3>
              <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100 text-[10px] font-semibold">
                Fluxo de Caixa
              </Badge>
            </div>
            <Link
              to="/financeiro?tab=fluxo"
              className="text-xs font-semibold text-[#3A3A3C] hover:text-[#F08A24] flex items-center gap-1 hover:underline"
            >
              Acessar financeiro completo &rarr;
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Bloco 1: Parcelas Vencidas */}
            {(() => {
              // Posiciona no mês da parcela vencida mais antiga ou no mês atual
              let overdueTargetUrl = '/financeiro?tab=fluxo&view=vencidas'
              if (installmentsSummary.oldestOverdueDate) {
                const parts = installmentsSummary.oldestOverdueDate.split('-')
                if (parts.length === 3) {
                  const y = parts[0]
                  const m = parseInt(parts[1], 10) - 1
                  overdueTargetUrl = `/financeiro?tab=fluxo&view=vencidas&month=${m}&year=${y}`
                }
              }

              return (
                <Link
                  to={overdueTargetUrl}
                  className="group block p-5 rounded-2xl border border-red-200 bg-gradient-to-br from-red-50/70 via-red-50/30 to-white hover:border-red-400 hover:shadow-md transition-all duration-200"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="p-2 rounded-xl bg-red-100 text-red-700 group-hover:bg-red-200 transition-colors">
                          <AlertTriangle className="h-5 w-5" />
                        </span>
                        <div>
                          <h4 className="text-sm font-bold text-red-950">Parcelas Vencidas</h4>
                          <p className="text-xs text-red-700/80">
                            Pendentes com vencimento anterior a hoje
                          </p>
                        </div>
                      </div>
                    </div>

                    <Badge
                      variant="outline"
                      className="bg-white/80 text-red-700 border-red-300 font-mono font-bold text-xs"
                    >
                      {installmentsSummary.overdueCount}{' '}
                      {installmentsSummary.overdueCount === 1 ? 'parcela' : 'parcelas'}
                    </Badge>
                  </div>

                  <div className="mt-4 pt-3 border-t border-red-200/60 flex items-baseline justify-between">
                    <div>
                      <span className="text-[11px] font-medium text-red-800 uppercase tracking-wider block">
                        Valor total em atraso
                      </span>
                      <span className="font-mono text-2xl font-black text-red-700">
                        {formatCurrencyBRL(installmentsSummary.overdueTotal)}
                      </span>
                    </div>

                    <div className="text-right">
                      {installmentsSummary.oldestOverdueDate ? (
                        <div className="text-[11px] text-red-900/90">
                          <span className="text-red-600/90 font-medium block">Mais antiga:</span>
                          <span className="font-bold">
                            {formatDateBR(installmentsSummary.oldestOverdueDate)}
                          </span>
                          {installmentsSummary.oldestOverdueClient && (
                            <span className="block text-[10px] text-red-700 truncate max-w-[140px]">
                              {installmentsSummary.oldestOverdueClient}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                          <CheckCircle className="h-4 w-4" /> Nenhuma parcela vencida
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              )
            })()}

            {/* Bloco 2: Parcelas a Vencer (30 dias) */}
            {(() => {
              // Posiciona no mês da primeira parcela a vencer ou no mês atual
              let upcomingTargetUrl = `/financeiro?tab=fluxo&view=a_vencer&month=${currentMonth}&year=${currentYear}`
              if (installmentsSummary.firstUpcomingDate) {
                const parts = installmentsSummary.firstUpcomingDate.split('-')
                if (parts.length === 3) {
                  const y = parts[0]
                  const m = parseInt(parts[1], 10) - 1
                  upcomingTargetUrl = `/financeiro?tab=fluxo&view=a_vencer&month=${m}&year=${y}`
                }
              }

              return (
                <Link
                  to={upcomingTargetUrl}
                  className="group block p-5 rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50/70 via-amber-50/30 to-white hover:border-amber-400 hover:shadow-md transition-all duration-200"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="p-2 rounded-xl bg-amber-100 text-amber-700 group-hover:bg-amber-200 transition-colors">
                          <CalendarClock className="h-5 w-5" />
                        </span>
                        <div>
                          <h4 className="text-sm font-bold text-amber-950">
                            Parcelas a Vencer (30 dias)
                          </h4>
                          <p className="text-xs text-amber-700/80">
                            Recebimentos previstos para o próximo mês
                          </p>
                        </div>
                      </div>
                    </div>

                    <Badge
                      variant="outline"
                      className="bg-white/80 text-amber-800 border-amber-300 font-mono font-bold text-xs"
                    >
                      {installmentsSummary.upcomingCount}{' '}
                      {installmentsSummary.upcomingCount === 1 ? 'parcela' : 'parcelas'}
                    </Badge>
                  </div>

                  <div className="mt-4 pt-3 border-t border-amber-200/60 flex items-baseline justify-between">
                    <div>
                      <span className="text-[11px] font-medium text-amber-800 uppercase tracking-wider block">
                        Previsão a receber
                      </span>
                      <span className="font-mono text-2xl font-black text-amber-700">
                        {formatCurrencyBRL(installmentsSummary.upcomingTotal)}
                      </span>
                    </div>

                    <div className="text-right text-xs text-amber-900/80 font-medium group-hover:text-amber-950 flex items-center gap-1">
                      <span>Filtrar no fluxo</span>
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </div>
                </Link>
              )
            })()}
          </div>
        </div>
      )}

      {/* 4 Cards de Resumo (KPIs da Competência Selecionada) com comparação MoM vs. mês anterior */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* KPI 1: Clientes */}
        <Card className="rounded-2xl border-slate-200/90 shadow-xs hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Base de Clientes
            </CardTitle>
            <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-slate-900 font-mono tracking-tight">
              {cumulativeClientsUntilPeriod.length}
            </div>
            <div className="flex items-center justify-between gap-1.5 mt-2 text-xs">
              <div className="flex items-center gap-1 font-medium text-slate-600 truncate">
                <span className="font-semibold text-slate-900">
                  +{clientsCreatedInSelectedMonth.length}
                </span>{' '}
                no mês
              </div>
              {newClientsVariation !== null ? (
                <span
                  className={`inline-flex items-center gap-0.5 font-bold text-[11px] ${
                    newClientsVariation >= 0 ? 'text-emerald-600' : 'text-red-500'
                  }`}
                  title={`Comparado a ${monthShortNames[prevMonthIndex]}/${prevMonthYear}`}
                >
                  {newClientsVariation >= 0 ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  {newClientsVariation >= 0
                    ? `+${newClientsVariation}%`
                    : `${newClientsVariation}%`}
                </span>
              ) : (
                <span className="text-[11px] text-slate-400">
                  vs {monthShortNames[prevMonthIndex]}
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* KPI 2: Orçamentos Emitidos no Período */}
        <Card className="rounded-2xl border-slate-200/90 shadow-xs hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Orçamentos no Mês
            </CardTitle>
            <div className="h-10 w-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
              <FileText className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-slate-900 font-mono tracking-tight">
              {totalQuotesPeriod}
            </div>
            <div className="flex items-center justify-between gap-1.5 mt-2 text-xs">
              <span className="text-slate-500 truncate">
                {prevTotalQuotes} em {monthShortNames[prevMonthIndex]}
              </span>
              {quotesVariation !== null ? (
                <span
                  className={`inline-flex items-center gap-0.5 font-bold text-[11px] ${
                    quotesVariation >= 0 ? 'text-emerald-600' : 'text-red-500'
                  }`}
                  title={`Variação vs ${monthShortNames[prevMonthIndex]}/${prevMonthYear}`}
                >
                  {quotesVariation >= 0 ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  {quotesVariation >= 0 ? `+${quotesVariation}%` : `${quotesVariation}%`}
                </span>
              ) : (
                <span className="text-[11px] text-slate-400">Novo período</span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* KPI 3: Orçamentos Aprovados no Período */}
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
              {totalApprovedQuotesPeriod}
            </div>
            <div className="flex items-center justify-between gap-1.5 mt-2 text-xs">
              <span className="text-slate-500">{conversionRatePeriod}% de conversão</span>
              {approvedQuotesVariation !== null ? (
                <span
                  className={`inline-flex items-center gap-0.5 font-bold text-[11px] ${
                    approvedQuotesVariation >= 0 ? 'text-emerald-600' : 'text-red-500'
                  }`}
                  title={`Variação vs ${monthShortNames[prevMonthIndex]}/${prevMonthYear}`}
                >
                  {approvedQuotesVariation >= 0 ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  {approvedQuotesVariation >= 0
                    ? `+${approvedQuotesVariation}%`
                    : `${approvedQuotesVariation}%`}
                </span>
              ) : (
                <span className="text-[11px] text-slate-400">
                  vs {monthShortNames[prevMonthIndex]}
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* KPI 4: Valor Total Aprovado no Período */}
        <Card className="rounded-2xl border-slate-200/90 shadow-xs hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Faturamento Aprovado
            </CardTitle>
            <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <DollarSign className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl lg:text-3xl font-extrabold text-emerald-700 font-mono tracking-tight truncate">
              {formatCurrencyBRL(totalApprovedValuePeriod)}
            </div>
            <div className="flex items-center justify-between gap-1.5 mt-2 text-xs">
              <span className="text-slate-500 truncate">{monthFullNames[selectedMonth]}</span>
              {approvedValueVariation !== null ? (
                <span
                  className={`inline-flex items-center gap-0.5 font-bold text-[11px] ${
                    approvedValueVariation >= 0 ? 'text-emerald-600' : 'text-red-500'
                  }`}
                  title={`Variação de receita vs ${monthShortNames[prevMonthIndex]}/${prevMonthYear}`}
                >
                  {approvedValueVariation >= 0 ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  {approvedValueVariation >= 0
                    ? `+${approvedValueVariation}%`
                    : `${approvedValueVariation}%`}
                </span>
              ) : (
                <span className="text-[11px] text-slate-400">
                  vs {monthShortNames[prevMonthIndex]}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Grid: Gráfico e Listas Recentes */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Gráfico de Barras: 60% (7 cols desktop) com destaque âmbar na competência selecionada */}
        <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 gap-2">
            <div>
              <h3 className="text-base font-bold text-slate-900">Orçamentos Emitidos por Mês</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Histórico de 6 meses até {monthFullNames[selectedMonth]} de {selectedYear} (barra
                selecionada em destaque)
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs font-medium text-slate-500 shrink-0">
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-xs bg-[#3A3A3C]" /> Histórico
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-xs bg-[#F08A24]" /> Mês Ativo
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
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload
                      return (
                        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs space-y-1">
                          <p className="font-bold text-amber-400">{data.fullName}</p>
                          <p className="text-slate-200">
                            Propostas emitidas:{' '}
                            <span className="font-bold font-mono">{data.count}</span>
                          </p>
                          <p className="text-slate-200">
                            Volume estimado:{' '}
                            <span className="font-bold font-mono">
                              {formatCurrencyBRL(data.total)}
                            </span>
                          </p>
                          {data.isSelectedMonth && (
                            <p className="text-[#F08A24] font-semibold pt-1 border-t border-slate-700 text-[11px]">
                              &bull; Competência selecionada
                            </p>
                          )}
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Bar
                  dataKey="count"
                  radius={[6, 6, 0, 0]}
                  cursor="pointer"
                  onClick={(entry: any) => {
                    if (entry && typeof entry.monthIdx === 'number' && entry.yearVal) {
                      updateCompetency(entry.monthIdx, entry.yearVal)
                    }
                  }}
                >
                  {monthlyData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.isSelectedMonth ? '#F08A24' : '#3A3A3C'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[11px] text-slate-400 text-center mt-2">
            Dica: clique em qualquer barra do gráfico para navegar diretamente àquele mês.
          </p>
        </div>

        {/* Listas Recentes (40% - 5 cols desktop) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Orçamentos do Período Selecionado */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Orçamentos de {monthFullNames[selectedMonth]}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {totalQuotesPeriod} proposta(s) emitida(s) nesta competência
                </p>
              </div>
              <Link
                to="/orcamentos"
                className="text-xs font-semibold text-[#3A3A3C] hover:text-[#F08A24] flex items-center gap-1 hover:underline shrink-0"
              >
                Ver todos
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            <div className="divide-y divide-slate-100 mt-2">
              {periodRecentQuotes.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 space-y-1">
                  <p className="font-semibold text-slate-600">
                    Nenhum orçamento emitido em {monthFullNames[selectedMonth]} de {selectedYear}.
                  </p>
                  <p className="text-slate-400">Altere o mês acima ou crie uma nova proposta.</p>
                </div>
              ) : (
                periodRecentQuotes.map((quote) => (
                  <Link
                    key={quote.id}
                    to={`/orcamentos/${quote.id}`}
                    className="flex items-center justify-between py-3 group hover:bg-slate-50 -mx-2 px-2 rounded-xl transition-colors"
                  >
                    <div className="truncate pr-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-[#3A3A3C] group-hover:text-[#F08A24]">
                          {formatQuoteNumber(quote.quote_number, quote.revision)}
                        </span>
                        {getStatusBadge(quote.status)}
                      </div>
                      <p className="text-xs text-slate-600 truncate mt-1">
                        {quote.expand?.client?.name || 'Cliente'} &bull;{' '}
                        <span className="text-[11px] text-slate-400 font-mono">
                          {formatDateBR(quote.created)}
                        </span>
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

          {/* Clientes da Competência */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {clientsCreatedInSelectedMonth.length > 0
                    ? `Novos Clientes de ${monthFullNames[selectedMonth]}`
                    : 'Clientes da Base'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {clientsCreatedInSelectedMonth.length > 0
                    ? `${clientsCreatedInSelectedMonth.length} cadastrado(s) no mês`
                    : `Base cumulativa até ${monthFullNames[selectedMonth]}/${selectedYear}`}
                </p>
              </div>
              <Link
                to="/clientes"
                className="text-xs font-semibold text-[#3A3A3C] hover:text-[#F08A24] flex items-center gap-1 hover:underline shrink-0"
              >
                Ver todos
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            <div className="divide-y divide-slate-100 mt-2">
              {periodRecentClients.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  Nenhum cliente cadastrado neste período.
                </div>
              ) : (
                periodRecentClients.map((c) => (
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

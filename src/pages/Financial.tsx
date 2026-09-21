import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  FileSpreadsheet,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Plus,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileText,
  Printer,
  ExternalLink,
  Ban,
  RefreshCw,
  Search,
  Filter,
  Check,
  ChevronRight,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
  Download,
  Building,
  KeyRound,
  FileCheck,
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
  Legend,
} from 'recharts'
import { useAuth } from '@/contexts/AuthContext'
import { invoiceService } from '@/services/invoices'
import { cashflowService } from '@/services/cashflow'
import { orderService } from '@/services/orders'
import { settingsService } from '@/services/settings'
import type {
  InvoiceRecord,
  InvoiceStatus,
  CashflowEntryRecord,
  OrderRecord,
  NfeSettings,
} from '@/types'
import { formatCurrencyBRL, formatDateBR, formatOrderNumber } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'

export default function Financial() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const isAdmin = user?.role === 'Administrador'

  // Aba ativa: 'notas' ou 'fluxo'
  const activeTab = searchParams.get('tab') === 'fluxo' ? 'fluxo' : 'notas'

  // Estados de dados
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState<OrderRecord[]>([])
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([])
  const [cashflowEntries, setCashflowEntries] = useState<CashflowEntryRecord[]>([])
  const [nfeConfig, setNfeConfig] = useState<NfeSettings | null>(null)

  // Filtros de busca
  const [invoiceSearch, setInvoiceSearch] = useState('')
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState('Todos')

  // Seletor de mês e ano do Fluxo de Caixa
  const currentDate = new Date()
  const [selectedMonth, setSelectedMonth] = useState<number>(currentDate.getMonth())
  const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear())
  const [cashflowTypeFilter, setCashflowTypeFilter] = useState('Todos')

  // Modal de Emissão de NF
  const [isEmitModalOpen, setIsEmitModalOpen] = useState(false)
  const [selectedOrderForEmit, setSelectedOrderForEmit] = useState<OrderRecord | null>(null)
  const [isSubmittingEmit, setIsSubmittingEmit] = useState(false)
  const [emitFormData, setEmitFormData] = useState({
    invoice_number: '',
    series: '1',
    client_name: '',
    client_document: '',
    client_address: '',
    client_city: '',
    client_state: '',
    client_zip: '',
    total_amount: 0,
    subtotal: 0,
    discount_percent: 0,
    icms: 0,
    ipi: 0,
    pis: 0,
    cofins: 0,
  })

  // Modal de Cancelamento de NF
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false)
  const [invoiceToCancel, setInvoiceToCancel] = useState<InvoiceRecord | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false)

  // Modal de Nova Saída / Entrada Manual de Fluxo de Caixa
  const [isCashflowModalOpen, setIsCashflowModalOpen] = useState(false)
  const [isSubmittingCashflow, setIsSubmittingCashflow] = useState(false)
  const [cashflowFormData, setCashflowFormData] = useState({
    type: 'Saída' as 'Entrada' | 'Saída',
    date: new Date().toISOString().split('T')[0],
    description: '',
    amount: '',
    category: 'Despesas Operacionais',
    status: 'Realizado' as 'Pendente' | 'Realizado',
    notes: '',
  })

  // Carregamento de dados
  const loadAllFinancialData = async () => {
    try {
      setLoading(true)
      const [ordersList, invoicesList, cashflowList, nfeSettings] = await Promise.all([
        orderService.getAll().catch(() => []),
        invoiceService.getAll().catch(() => []),
        cashflowService.getAll().catch(() => []),
        settingsService.getNfeSettings().catch(() => null),
      ])

      setOrders(ordersList)
      setInvoices(invoicesList)
      setCashflowEntries(cashflowList)
      setNfeConfig(nfeSettings)

      // Sincroniza automaticamente parcelas dos pedidos que ainda não existam no fluxo de caixa
      if (ordersList.length > 0) {
        cashflowService.syncInstallmentsFromOrders(ordersList).then((syncedCount) => {
          if (syncedCount > 0) {
            cashflowService
              .getAll()
              .then(setCashflowEntries)
              .catch(() => {})
          }
        })
      }
    } catch (err) {
      console.error('Erro ao carregar dados financeiros:', err)
      toast.error('Erro ao carregar dados financeiros.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isAdmin) {
      loadAllFinancialData()
    }
  }, [isAdmin])

  // Mapa de notas fiscais indexadas por order id para rápido vínculo
  const invoicesByOrderId = useMemo(() => {
    const map = new Map<string, InvoiceRecord>()
    invoices.forEach((inv) => {
      if (inv.order) {
        // Se houver mais de uma, mantém a mais recente emitida ou não cancelada
        const current = map.get(inv.order)
        if (!current || (inv.status === 'Emitida' && current.status !== 'Emitida')) {
          map.set(inv.order, inv)
        }
      }
    })
    return map
  }, [invoices])

  // Fila de pedidos para emissão de NF:
  // Conforme a regra de negócio: Pedidos com status 'Concluído' ou 'Aberto'/'Em Produção'
  // entram na esteira comercial, com prioridade para os 'Concluído' ("Aguardando Emissão")
  const ordersInvoiceQueue = useMemo(() => {
    return orders
      .filter((o) => o.status !== 'Cancelado')
      .map((order) => {
        const linkedInvoice = invoicesByOrderId.get(order.id)
        let invoiceStatus: InvoiceStatus = 'Aguardando Emissão'
        if (linkedInvoice) {
          invoiceStatus = linkedInvoice.status
        }
        return {
          order,
          invoice: linkedInvoice || null,
          invoiceStatus,
        }
      })
      .filter((item) => {
        if (invoiceStatusFilter !== 'Todos' && item.invoiceStatus !== invoiceStatusFilter) {
          return false
        }
        if (!invoiceSearch.trim()) return true
        const clean = invoiceSearch.toLowerCase().trim()
        const orderNum = `ped-${String(item.order.order_number).padStart(3, '0')}`.toLowerCase()
        const clientName = (
          item.order.expand?.client?.name ||
          item.order.seller ||
          ''
        ).toLowerCase()
        const clientDoc = (item.order.expand?.client?.document_number || '').toLowerCase()
        const invNum = (item.invoice?.invoice_number || '').toLowerCase()
        return (
          orderNum.includes(clean) ||
          clientName.includes(clean) ||
          clientDoc.includes(clean) ||
          invNum.includes(clean)
        )
      })
      .sort((a, b) => {
        // Aguardando Emissão e Concluídos primeiro
        if (a.invoiceStatus === 'Aguardando Emissão' && b.invoiceStatus !== 'Aguardando Emissão')
          return -1
        if (b.invoiceStatus === 'Aguardando Emissão' && a.invoiceStatus !== 'Aguardando Emissão')
          return 1
        return (b.order.order_number || 0) - (a.order.order_number || 0)
      })
  }, [orders, invoicesByOrderId, invoiceStatusFilter, invoiceSearch])

  // Abertura do Modal de Emissão para um Pedido da Fila
  const handleOpenEmitModal = (order: OrderRecord, existingInvoice?: InvoiceRecord | null) => {
    const client = order.expand?.client
    const clientDoc =
      client?.document_number ||
      (client?.notes?.includes('CNPJ:')
        ? client.notes.split('CNPJ:')[1]?.split('\n')[0]?.trim()
        : '') ||
      ''

    setSelectedOrderForEmit(order)
    setEmitFormData({
      invoice_number: existingInvoice?.invoice_number || '',
      series: nfeConfig?.series || '1',
      client_name: client?.name || client?.company || 'CLIENTE NÃO IDENTIFICADO',
      client_document: clientDoc,
      client_address: client?.address || '',
      client_city: client?.city || '',
      client_state: client?.state || 'SP',
      client_zip: client?.zip_code || '',
      total_amount: order.total || 0,
      subtotal: order.subtotal || 0,
      discount_percent: order.discount_percent || 0,
      icms: order.icms || 0,
      ipi: order.ipi || 0,
      pis: order.pis || 0,
      cofins: order.cofins || 0,
    })
    setIsEmitModalOpen(true)
  }

  // Disparo da Emissão de NF
  const handleConfirmEmitInvoice = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedOrderForEmit) return

    try {
      setIsSubmittingEmit(true)

      const payload = {
        orderId: selectedOrderForEmit.id,
        invoiceData: {
          invoice_number: emitFormData.invoice_number,
          series: emitFormData.series,
          client_name: emitFormData.client_name,
          client_document: emitFormData.client_document,
          client_address: emitFormData.client_address,
          client_city: emitFormData.client_city,
          client_state: emitFormData.client_state,
          client_zip: emitFormData.client_zip,
          total_amount: Number(emitFormData.total_amount),
          subtotal: Number(emitFormData.subtotal),
          discount_percent: Number(emitFormData.discount_percent),
          icms: Number(emitFormData.icms),
          ipi: Number(emitFormData.ipi),
          pis: Number(emitFormData.pis),
          cofins: Number(emitFormData.cofins),
          items: selectedOrderForEmit.items || [],
          installments: selectedOrderForEmit.installments || [],
        },
      }

      const res = await invoiceService.emitInvoice(payload)

      if (res.success) {
        toast.success(res.message || 'Nota Fiscal emitida com sucesso!')
        setIsEmitModalOpen(false)
        await loadAllFinancialData()
      } else {
        toast.error(res.message || 'Falha ao emitir nota fiscal.')
      }
    } catch (err: any) {
      console.error('Erro na emissão:', err)
      toast.error(err.message || 'Erro ao processar emissão de NF-e.')
    } finally {
      setIsSubmittingEmit(false)
    }
  }

  // Cancelamento de NF
  const handleOpenCancelModal = (inv: InvoiceRecord) => {
    setInvoiceToCancel(inv)
    setCancelReason('')
    setIsCancelModalOpen(true)
  }

  const handleConfirmCancelInvoice = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!invoiceToCancel) return

    if (!cancelReason.trim() || cancelReason.trim().length < 15) {
      toast.error(
        'A justificativa de cancelamento deve ter pelo menos 15 caracteres (exigência SEFAZ).',
      )
      return
    }

    try {
      setIsSubmittingCancel(true)
      const res = await invoiceService.cancelInvoice(invoiceToCancel.id, cancelReason)
      if (res.success) {
        toast.success(res.message || 'Nota fiscal cancelada com sucesso.')
        setIsCancelModalOpen(false)
        await loadAllFinancialData()
      } else {
        toast.error(res.message || 'Falha ao cancelar nota fiscal.')
      }
    } catch (err: any) {
      console.error('Erro ao cancelar nota:', err)
      toast.error(err.message || 'Erro ao processar cancelamento.')
    } finally {
      setIsSubmittingCancel(false)
    }
  }

  // Marcar parcela como recebida
  const handleMarkInstallmentReceived = async (entry: CashflowEntryRecord) => {
    try {
      await cashflowService.markAsReceived(entry.id)
      toast.success('Parcela marcada como recebida!')
      await loadAllFinancialData()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao marcar parcela como recebida.')
    }
  }

  // Criação de lançamento manual no fluxo de caixa
  const handleSaveCashflowEntry = async (e: React.FormEvent) => {
    e.preventDefault()
    const amountVal = parseFloat(cashflowFormData.amount.replace(',', '.'))
    if (isNaN(amountVal) || amountVal <= 0) {
      toast.error('Informe um valor válido maior que zero.')
      return
    }

    try {
      setIsSubmittingCashflow(true)
      await cashflowService.create({
        type: cashflowFormData.type,
        date: cashflowFormData.date,
        description: cashflowFormData.description,
        amount: amountVal,
        category: cashflowFormData.category,
        origin: 'manual',
        status: cashflowFormData.status,
        received_at: cashflowFormData.status === 'Realizado' ? cashflowFormData.date : undefined,
        notes: cashflowFormData.notes,
      })

      toast.success(
        cashflowFormData.type === 'Entrada'
          ? 'Receita cadastrada com sucesso!'
          : 'Despesa lançada com sucesso!',
      )
      setIsCashflowModalOpen(false)
      setCashflowFormData({
        type: 'Saída',
        date: new Date().toISOString().split('T')[0],
        description: '',
        amount: '',
        category: 'Despesas Operacionais',
        status: 'Realizado',
        notes: '',
      })
      await loadAllFinancialData()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar lançamento no fluxo de caixa.')
    } finally {
      setIsSubmittingCashflow(false)
    }
  }

  // ==========================================
  // CÁLCULOS DO FLUXO DE CAIXA MENSAL
  // ==========================================
  const monthNames = [
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

  const filteredMonthEntries = useMemo(() => {
    return cashflowEntries
      .filter((entry) => {
        if (!entry.date) return false
        const d = new Date(entry.date + 'T00:00:00')
        return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear
      })
      .filter((entry) => {
        if (cashflowTypeFilter === 'Todos') return true
        return entry.type === cashflowTypeFilter
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [cashflowEntries, selectedMonth, selectedYear, cashflowTypeFilter])

  // Métricas do mês
  const monthlyMetrics = useMemo(() => {
    let totalIncomes = 0
    let totalExpenses = 0
    let pendingIncomes = 0
    let realizedIncomes = 0

    cashflowEntries.forEach((entry) => {
      if (!entry.date) return
      const d = new Date(entry.date + 'T00:00:00')
      if (d.getMonth() === selectedMonth && d.getFullYear() === selectedYear) {
        if (entry.type === 'Entrada') {
          totalIncomes += entry.amount || 0
          if (entry.status === 'Realizado') {
            realizedIncomes += entry.amount || 0
          } else {
            pendingIncomes += entry.amount || 0
          }
        } else if (entry.type === 'Saída') {
          totalExpenses += entry.amount || 0
        }
      }
    })

    const balance = totalIncomes - totalExpenses
    return {
      totalIncomes,
      totalExpenses,
      balance,
      pendingIncomes,
      realizedIncomes,
    }
  }, [cashflowEntries, selectedMonth, selectedYear])

  // Gráfico diário/semanal de evolução de saldo no mês selecionado
  const chartDailyData = useMemo(() => {
    // Agrupa por dia do mês (1 até último dia)
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate()
    const daysMap = new Map<
      number,
      { day: number; entradas: number; saidas: number; saldo: number }
    >()

    for (let day = 1; day <= daysInMonth; day++) {
      daysMap.set(day, { day, entradas: 0, saidas: 0, saldo: 0 })
    }

    cashflowEntries.forEach((entry) => {
      if (!entry.date) return
      const d = new Date(entry.date + 'T00:00:00')
      if (d.getMonth() === selectedMonth && d.getFullYear() === selectedYear) {
        const day = d.getDate()
        const current = daysMap.get(day)
        if (current) {
          if (entry.type === 'Entrada') {
            current.entradas += entry.amount || 0
          } else {
            current.saidas += entry.amount || 0
          }
        }
      }
    })

    let accumulatedBalance = 0
    return Array.from(daysMap.values()).map((item) => {
      accumulatedBalance += item.entradas - item.saidas
      return {
        label: `Dia ${item.day}`,
        Entradas: item.entradas,
        Saídas: item.saidas,
        SaldoAcumulado: accumulatedBalance,
      }
    })
  }, [cashflowEntries, selectedMonth, selectedYear])

  const getStatusBadgeNfe = (status: InvoiceStatus) => {
    switch (status) {
      case 'Emitida':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Check className="h-3 w-3 mr-1" />
            Emitida
          </span>
        )
      case 'Aguardando Emissão':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="h-3 w-3 mr-1" />
            Aguardando Emissão
          </span>
        )
      case 'Cancelada':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300">
            <Ban className="h-3 w-3 mr-1" />
            Cancelada
          </span>
        )
      case 'Erro':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Erro na Emissão
          </span>
        )
      default:
        return null
    }
  }

  // ==========================================
  // BLOQUEIO RIGOROSO DE VENDEDORES (NÃO-ADMIN)
  // ==========================================
  if (!isAdmin) {
    return (
      <div className="bg-white p-8 md:p-12 rounded-2xl border border-slate-200 shadow-xs max-w-xl mx-auto my-12 text-center space-y-5 animate-in fade-in-50">
        <div className="h-16 w-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto ring-8 ring-red-50">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
            Acesso Restrito / Confidencial
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            O módulo <strong>Financeiro (Notas Fiscais de Venda & Fluxo de Caixa)</strong> é de
            acesso exclusivo da diretoria e administradores do sistema. Seu perfil de usuário não
            possui autorização para visualizar ou emitir documentos nesta área.
          </p>
        </div>
        <div className="pt-2">
          <Button
            onClick={() => navigate('/')}
            className="rounded-xl bg-[#3A3A3C] hover:bg-[#2D2D2F] text-white px-6 font-medium"
          >
            Voltar para o Dashboard
          </Button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <RefreshCw className="h-8 w-8 animate-spin text-[#3A3A3C]" />
          <p className="text-sm font-medium">Carregando Módulo Financeiro...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-300">
      {/* Header do Módulo Financeiro */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Gestão Financeira & Fiscal
            </h1>
            <Badge variant="outline" className="border-emerald-500 text-emerald-700 bg-emerald-50">
              Exclusivo Administrador
            </Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Sequência completa do ciclo comercial: Orçamento &rarr; Pedido &rarr; Nota Fiscal de
            Venda &rarr; Fluxo de Caixa.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {activeTab === 'notas' && (
            <Button
              variant="outline"
              onClick={() => navigate('/configuracoes')}
              className="rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 gap-2 text-xs"
            >
              <KeyRound className="h-4 w-4 text-[#F08A24]" />
              Provedor NF-e ({nfeConfig?.provider || 'Não configurado'})
            </Button>
          )}

          {activeTab === 'fluxo' && (
            <Button
              onClick={() => setIsCashflowModalOpen(true)}
              className="rounded-xl bg-[#3A3A3C] hover:bg-[#2D2D2F] text-white gap-2 font-medium"
            >
              <Plus className="h-4 w-4 text-[#F08A24]" />
              Novo Lançamento
            </Button>
          )}
        </div>
      </div>

      {/* Tabs Principais: Notas Fiscais vs Fluxo de Caixa */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => setSearchParams({ tab: val })}
        className="space-y-6"
      >
        <TabsList className="bg-slate-100 p-1 rounded-xl">
          <TabsTrigger value="notas" className="flex items-center gap-2 text-xs sm:text-sm">
            <FileSpreadsheet className="h-4 w-4 text-[#F08A24]" />
            Notas Fiscais de Venda
            {ordersInvoiceQueue.filter((q) => q.invoiceStatus === 'Aguardando Emissão').length >
              0 && (
              <span className="ml-1.5 px-1.5 py-0.2 rounded-full bg-amber-500 text-black text-[10px] font-extrabold">
                {ordersInvoiceQueue.filter((q) => q.invoiceStatus === 'Aguardando Emissão').length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="fluxo" className="flex items-center gap-2 text-xs sm:text-sm">
            <TrendingUp className="h-4 w-4 text-[#F08A24]" />
            Fluxo de Caixa
          </TabsTrigger>
        </TabsList>

        {/* =========================================================================
            ABA 1: NOTAS FISCAIS — FILA DE ESPERA E EMISSÃO AUTOMÁTICA VIA INTEGRAÇÃO
            ========================================================================= */}
        <TabsContent value="notas" className="space-y-6">
          {/* Card informativo sobre integração da API Focus NFe / NFe.io */}
          {(!nfeConfig || !nfeConfig.apiKey) && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900 leading-relaxed">
                  <strong className="font-semibold block mb-0.5">
                    Provedor autorizador de NF-e ainda não configurado:
                  </strong>
                  Para envio automático à SEFAZ, acesse{' '}
                  <span
                    onClick={() => navigate('/configuracoes')}
                    className="font-semibold underline cursor-pointer text-[#E66812]"
                  >
                    Configurações &gt; Nota Fiscal
                  </span>{' '}
                  e insira o token da API (Focus NFe ou NFe.io). O certificado digital A1 é
                  cadastrado no painel do provedor. A fila de emissão abaixo continua funcionando
                  normalmente para conferência e controle manual.
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate('/configuracoes')}
                className="shrink-0 border-amber-300 text-amber-800 hover:bg-amber-100 rounded-xl text-xs"
              >
                Configurar Provedor
              </Button>
            </div>
          )}

          {/* Filtros e Busca da Fila */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Buscar por pedido, cliente, CNPJ ou número da nota..."
                value={invoiceSearch}
                onChange={(e) => setInvoiceSearch(e.target.value)}
                className="pl-9 text-xs sm:text-sm rounded-xl"
              />
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500 font-medium">Status da Nota:</span>
              <Select value={invoiceStatusFilter} onValueChange={setInvoiceStatusFilter}>
                <SelectTrigger className="w-48 text-xs rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Todos">Todos os Status</SelectItem>
                  <SelectItem value="Aguardando Emissão">Aguardando Emissão</SelectItem>
                  <SelectItem value="Emitida">Emitida</SelectItem>
                  <SelectItem value="Erro">Com Erro</SelectItem>
                  <SelectItem value="Cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tabela da Fila de Espera para Emissão */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-[#F08A24]" />
                <h3 className="font-bold text-sm text-slate-900">
                  Fila de Espera &amp; Notas Fiscais de Venda
                </h3>
              </div>
              <span className="text-xs text-slate-500">
                {ordersInvoiceQueue.length} pedido(s) listado(s)
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                    <th className="py-3 px-4">Pedido</th>
                    <th className="py-3 px-4">Cliente / Razão Social</th>
                    <th className="py-3 px-4">Status Pedido</th>
                    <th className="py-3 px-4 text-right">Valor Total</th>
                    <th className="py-3 px-4 text-center">Status NF</th>
                    <th className="py-3 px-4">Dados da Nota</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ordersInvoiceQueue.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        Nenhum pedido encontrado na fila de notas fiscais.
                      </td>
                    </tr>
                  ) : (
                    ordersInvoiceQueue.map(({ order, invoice, invoiceStatus }) => {
                      const clientName =
                        order.expand?.client?.name || order.expand?.client?.company || 'Cliente'
                      const isCompleted = order.status === 'Concluído'

                      return (
                        <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => navigate(`/pedidos/${order.id}`)}
                              className="text-[#3A3A3C] hover:text-[#F08A24] hover:underline flex items-center gap-1"
                              title="Ver detalhes do pedido"
                            >
                              {formatOrderNumber(order.order_number)}
                              <ExternalLink className="h-3 w-3 text-slate-400" />
                            </button>
                            <span className="text-[10px] text-slate-400 block font-normal">
                              {formatDateBR(order.created)}
                            </span>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-slate-900 truncate max-w-xs">
                              {clientName}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {order.expand?.client?.document_number || 'Sem documento'}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <Badge
                              variant="outline"
                              className={
                                isCompleted
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-slate-100 text-slate-700 border-slate-200'
                              }
                            >
                              {order.status}
                            </Badge>
                          </td>

                          <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                            {formatCurrencyBRL(order.total)}
                          </td>

                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            {getStatusBadgeNfe(invoiceStatus)}
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {invoice ? (
                              <div className="space-y-0.5">
                                <div className="font-mono font-bold text-slate-900 text-[11px]">
                                  NF-e{' '}
                                  {invoice.invoice_number ? `Nº ${invoice.invoice_number}` : 'S/N'}{' '}
                                  {invoice.series ? `Série ${invoice.series}` : ''}
                                </div>
                                {invoice.access_key && (
                                  <div
                                    className="text-[10px] text-slate-400 font-mono truncate max-w-[160px]"
                                    title={invoice.access_key}
                                  >
                                    Chave: {invoice.access_key.substring(0, 16)}...
                                  </div>
                                )}
                                {invoice.error_message && (
                                  <div
                                    className="text-[10px] text-red-600 truncate max-w-[180px]"
                                    title={invoice.error_message}
                                  >
                                    Erro: {invoice.error_message}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">Pendente na fila</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-2">
                              {/* Se emitida: Botão Ver DANFE e Cancelar */}
                              {invoice && invoice.status === 'Emitida' && (
                                <>
                                  {invoice.danfe_url ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => window.open(invoice.danfe_url, '_blank')}
                                      className="rounded-xl h-8 px-2.5 text-xs border-slate-200 hover:bg-slate-100 text-slate-800"
                                      title="Abrir DANFE PDF"
                                    >
                                      <Printer className="h-3.5 w-3.5 mr-1 text-[#F08A24]" />
                                      Ver DANFE
                                    </Button>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled
                                      className="rounded-xl h-8 px-2 text-xs opacity-50"
                                    >
                                      DANFE
                                    </Button>
                                  )}

                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleOpenCancelModal(invoice)}
                                    className="rounded-xl h-8 px-2 text-xs border-red-200 text-red-600 hover:bg-red-50"
                                    title="Cancelar Nota Fiscal"
                                  >
                                    <Ban className="h-3.5 w-3.5 mr-1" />
                                    Cancelar
                                  </Button>
                                </>
                              )}

                              {/* Se Erro ou Aguardando Emissão: Botão Emitir NF */}
                              {(!invoice ||
                                invoice.status === 'Aguardando Emissão' ||
                                invoice.status === 'Erro' ||
                                invoice.status === 'Cancelada') && (
                                <Button
                                  size="sm"
                                  onClick={() => handleOpenEmitModal(order, invoice)}
                                  className="rounded-xl h-8 px-3 text-xs bg-[#3A3A3C] hover:bg-[#2D2D2F] text-white font-medium"
                                >
                                  <FileSpreadsheet className="h-3.5 w-3.5 mr-1 text-[#F08A24]" />
                                  {invoice?.status === 'Erro' ? 'Reemitir NF' : 'Emitir NF'}
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* =========================================================================
            ABA 2: FLUXO DE CAIXA — ENTRADAS (PARCELAS DOS PEDIDOS), SAÍDAS, SALDO
            ========================================================================= */}
        <TabsContent value="fluxo" className="space-y-6">
          {/* Seletor de Mês e Ano */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-[#F08A24]" />
              <div className="flex items-center gap-2">
                <Select
                  value={String(selectedMonth)}
                  onValueChange={(val) => setSelectedMonth(Number(val))}
                >
                  <SelectTrigger className="w-40 text-xs font-semibold rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {monthNames.map((name, idx) => (
                      <SelectItem key={idx} value={String(idx)}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={String(selectedYear)}
                  onValueChange={(val) => setSelectedYear(Number(val))}
                >
                  <SelectTrigger className="w-28 text-xs font-semibold rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[2024, 2025, 2026, 2027].map((yr) => (
                      <SelectItem key={yr} value={String(yr)}>
                        {yr}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Filtrar:</span>
              <Select value={cashflowTypeFilter} onValueChange={setCashflowTypeFilter}>
                <SelectTrigger className="w-36 text-xs rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Todos">Todos os Tipos</SelectItem>
                  <SelectItem value="Entrada">Apenas Entradas</SelectItem>
                  <SelectItem value="Saída">Apenas Saídas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Cards de Resumo do Mês (Entradas, Saídas, Saldo) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {/* Card Entradas */}
            <Card className="rounded-2xl border-slate-200 shadow-xs bg-white">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Total de Entradas (Receitas)
                </CardTitle>
                <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <ArrowUpRight className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl lg:text-3xl font-extrabold text-emerald-700 font-mono tracking-tight">
                  {formatCurrencyBRL(monthlyMetrics.totalIncomes)}
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2">
                  <span>Recebidas: {formatCurrencyBRL(monthlyMetrics.realizedIncomes)}</span>
                  <span>A receber: {formatCurrencyBRL(monthlyMetrics.pendingIncomes)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Card Saídas */}
            <Card className="rounded-2xl border-slate-200 shadow-xs bg-white">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Total de Saídas (Despesas)
                </CardTitle>
                <div className="h-10 w-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
                  <ArrowDownRight className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl lg:text-3xl font-extrabold text-red-600 font-mono tracking-tight">
                  {formatCurrencyBRL(monthlyMetrics.totalExpenses)}
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Lançamentos de fornecedores, materiais e custos
                </p>
              </CardContent>
            </Card>

            {/* Card Saldo do Mês */}
            <Card className="rounded-2xl border-slate-200 shadow-xs bg-white">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Resultado Líquido do Mês
                </CardTitle>
                <div
                  className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                    monthlyMetrics.balance >= 0
                      ? 'bg-blue-50 text-blue-600'
                      : 'bg-amber-50 text-amber-600'
                  }`}
                >
                  <DollarSign className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent>
                <div
                  className={`text-2xl lg:text-3xl font-extrabold font-mono tracking-tight ${
                    monthlyMetrics.balance >= 0 ? 'text-slate-900' : 'text-amber-700'
                  }`}
                >
                  {formatCurrencyBRL(monthlyMetrics.balance)}
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  {monthlyMetrics.balance >= 0 ? 'Superávit operacional' : 'Déficit operacional'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Gráfico de Barras com Entradas vs Saídas do Mês */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 gap-2">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Evolução do Saldo Diário &bull; {monthNames[selectedMonth]} de {selectedYear}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Comparativo de entradas geradas pelas parcelas dos pedidos vs saídas lançadas
                </p>
              </div>

              <div className="flex items-center gap-4 text-xs font-medium text-slate-600">
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-xs bg-emerald-500" /> Entradas
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-xs bg-red-500" /> Saídas
                </span>
              </div>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartDailyData}
                  margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={{ stroke: '#CBD5E1' }}
                    tick={{ fill: '#64748B', fontSize: 11 }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: '#64748B', fontSize: 11 }}
                    tickFormatter={(val) => `R$ ${val}`}
                  />
                  <Tooltip
                    cursor={{ fill: '#F1F5F9', radius: 8 }}
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload
                        return (
                          <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs space-y-1">
                            <p className="font-bold text-amber-400">{label}</p>
                            <p className="text-emerald-400 font-mono">
                              Entradas: {formatCurrencyBRL(data.Entradas)}
                            </p>
                            <p className="text-red-400 font-mono">
                              Saídas: {formatCurrencyBRL(data.Saídas)}
                            </p>
                            <p className="text-slate-200 font-mono border-t border-slate-700 pt-1 mt-1 font-bold">
                              Saldo Acumulado: {formatCurrencyBRL(data.SaldoAcumulado)}
                            </p>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Bar dataKey="Entradas" fill="#10B981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Saídas" fill="#EF4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Tabela de Lançamentos do Mês */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-[#F08A24]" />
                <h3 className="font-bold text-sm text-slate-900">
                  Lançamentos de {monthNames[selectedMonth]} de {selectedYear}
                </h3>
              </div>
              <span className="text-xs text-slate-500">
                {filteredMonthEntries.length} lançamento(s)
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                    <th className="py-3 px-4">Data</th>
                    <th className="py-3 px-4">Tipo</th>
                    <th className="py-3 px-4">Descrição</th>
                    <th className="py-3 px-4">Categoria / Origem</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Valor</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredMonthEntries.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        Nenhum lançamento registrado neste mês.
                      </td>
                    </tr>
                  ) : (
                    filteredMonthEntries.map((entry) => {
                      const isEntry = entry.type === 'Entrada'
                      const isRealized = entry.status === 'Realizado'

                      return (
                        <tr key={entry.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 font-mono font-medium text-slate-900 whitespace-nowrap">
                            {formatDateBR(entry.date)}
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 font-semibold ${
                                isEntry ? 'text-emerald-700' : 'text-red-600'
                              }`}
                            >
                              {isEntry ? (
                                <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600" />
                              ) : (
                                <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />
                              )}
                              {entry.type}
                            </span>
                          </td>

                          <td className="py-3 px-4 max-w-sm truncate">
                            <div className="font-semibold text-slate-900 truncate">
                              {entry.description}
                            </div>
                            {entry.order && (
                              <button
                                type="button"
                                onClick={() => navigate(`/pedidos/${entry.order}`)}
                                className="text-[11px] text-[#E66812] hover:underline font-mono"
                              >
                                Ver pedido vinculado &rarr;
                              </button>
                            )}
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="text-slate-700">{entry.category || 'Geral'}</div>
                            <span className="text-[10px] text-slate-400 capitalize">
                              Origem: {entry.origin}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <Badge
                              variant="outline"
                              className={
                                isRealized
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-amber-50 text-amber-700 border-amber-200'
                              }
                            >
                              {entry.status}
                            </Badge>
                          </td>

                          <td
                            className={`py-3 px-4 text-right font-mono font-bold whitespace-nowrap ${
                              isEntry ? 'text-emerald-700' : 'text-red-600'
                            }`}
                          >
                            {isEntry ? '+' : '-'} {formatCurrencyBRL(entry.amount)}
                          </td>

                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            {entry.type === 'Entrada' && entry.status === 'Pendente' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleMarkInstallmentReceived(entry)}
                                className="rounded-xl h-7 px-2.5 text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                                Marcar Recebida
                              </Button>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* =========================================================================
          MODAL DE EMISSÃO DE NOTA FISCAL (COM REVISÃO DE DADOS DO PEDIDO E IMPOSTOS)
          ========================================================================= */}
      <Dialog open={isEmitModalOpen} onOpenChange={setIsEmitModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <div className="h-10 w-10 rounded-full bg-orange-100 text-[#E66812] flex items-center justify-center mb-1">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <DialogTitle className="text-lg font-bold text-slate-900">
              Emitir Nota Fiscal Eletrônica (NF-e)
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Revise os dados fiscais e tributários do pedido{' '}
              <strong className="text-slate-800">
                {selectedOrderForEmit ? formatOrderNumber(selectedOrderForEmit.order_number) : ''}
              </strong>{' '}
              antes do envio para o provedor autorizador.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleConfirmEmitInvoice} className="space-y-4 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">
                  Razão Social / Cliente *
                </Label>
                <Input
                  value={emitFormData.client_name}
                  onChange={(e) =>
                    setEmitFormData({ ...emitFormData, client_name: e.target.value })
                  }
                  required
                  className="rounded-xl text-xs sm:text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">
                  CNPJ / CPF do Cliente *
                </Label>
                <Input
                  value={emitFormData.client_document}
                  onChange={(e) =>
                    setEmitFormData({ ...emitFormData, client_document: e.target.value })
                  }
                  placeholder="00.000.000/0000-00"
                  className="rounded-xl font-mono text-xs sm:text-sm"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs font-semibold text-slate-700">
                  Endereço de Faturamento
                </Label>
                <Input
                  value={emitFormData.client_address}
                  onChange={(e) =>
                    setEmitFormData({ ...emitFormData, client_address: e.target.value })
                  }
                  placeholder="Rua / Av, Número, Bairro"
                  className="rounded-xl text-xs sm:text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Município</Label>
                <Input
                  value={emitFormData.client_city}
                  onChange={(e) =>
                    setEmitFormData({ ...emitFormData, client_city: e.target.value })
                  }
                  className="rounded-xl text-xs sm:text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">UF / Estado</Label>
                <Input
                  value={emitFormData.client_state}
                  onChange={(e) =>
                    setEmitFormData({ ...emitFormData, client_state: e.target.value })
                  }
                  maxLength={2}
                  className="rounded-xl uppercase font-mono text-xs sm:text-sm"
                />
              </div>
            </div>

            {/* Quadro Tributário & Valores */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                Valores e Tributos Calculados
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 block">Subtotal</span>
                  <span className="font-mono font-bold text-slate-900">
                    {formatCurrencyBRL(emitFormData.subtotal)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Desconto</span>
                  <span className="font-mono font-bold text-slate-900">
                    {emitFormData.discount_percent}%
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">ICMS</span>
                  <span className="font-mono font-bold text-slate-900">
                    {formatCurrencyBRL(emitFormData.icms)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">IPI</span>
                  <span className="font-mono font-bold text-slate-900">
                    {formatCurrencyBRL(emitFormData.ipi)}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">Valor Total da Nota:</span>
                <span className="font-mono text-base font-extrabold text-[#E66812]">
                  {formatCurrencyBRL(emitFormData.total_amount)}
                </span>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEmitModalOpen(false)}
                disabled={isSubmittingEmit}
                className="rounded-xl"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmittingEmit}
                className="rounded-xl bg-[#3A3A3C] hover:bg-[#2D2D2F] text-white gap-2 font-medium"
              >
                {isSubmittingEmit ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin text-[#F08A24]" />
                    Transmitindo à SEFAZ...
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="h-4 w-4 text-[#F08A24]" />
                    Confirmar Emissão
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* =========================================================================
          MODAL DE CANCELAMENTO DE NOTA FISCAL
          ========================================================================= */}
      <Dialog open={isCancelModalOpen} onOpenChange={setIsCancelModalOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <div className="h-10 w-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-1">
              <Ban className="h-5 w-5" />
            </div>
            <DialogTitle className="text-base font-bold text-slate-900">
              Cancelar Nota Fiscal Nº {invoiceToCancel?.invoice_number || ''}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              O cancelamento de NF-e exige justificativa válida perante a Receita Federal (mínimo de
              15 caracteres).
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleConfirmCancelInvoice} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">
                Justificativa do Cancelamento *
              </Label>
              <Input
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Ex: Cancelamento de pedido acordado comercialmente com o cliente..."
                required
                minLength={15}
                className="rounded-xl text-xs sm:text-sm"
              />
              <span className="text-[11px] text-slate-400 block">
                {cancelReason.length}/15 caracteres mínimos
              </span>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCancelModalOpen(false)}
                disabled={isSubmittingCancel}
                className="rounded-xl"
              >
                Voltar
              </Button>
              <Button
                type="submit"
                disabled={isSubmittingCancel}
                className="rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium"
              >
                {isSubmittingCancel ? 'Cancelando...' : 'Confirmar Cancelamento'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* =========================================================================
          MODAL DE LANÇAMENTO MANUAL NO FLUXO DE CAIXA (RECEITA OU DESPESA)
          ========================================================================= */}
      <Dialog open={isCashflowModalOpen} onOpenChange={setIsCashflowModalOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <div className="h-10 w-10 rounded-full bg-orange-100 text-[#E66812] flex items-center justify-center mb-1">
              <TrendingUp className="h-5 w-5" />
            </div>
            <DialogTitle className="text-base font-bold text-slate-900">
              Novo Lançamento de Caixa
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Registre uma receita avulsa ou despesa manual no fluxo de caixa da empresa.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveCashflowEntry} className="space-y-3.5 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Tipo de Lançamento</Label>
                <Select
                  value={cashflowFormData.type}
                  onValueChange={(val: any) =>
                    setCashflowFormData({ ...cashflowFormData, type: val })
                  }
                >
                  <SelectTrigger className="rounded-xl text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Saída">Saída (Despesa)</SelectItem>
                    <SelectItem value="Entrada">Entrada (Receita)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Data do Lançamento *</Label>
                <Input
                  type="date"
                  value={cashflowFormData.date}
                  onChange={(e) =>
                    setCashflowFormData({ ...cashflowFormData, date: e.target.value })
                  }
                  required
                  className="rounded-xl text-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Descrição *</Label>
              <Input
                placeholder="Ex: Pagamento Fornecedor MDF / Frete Terceirizado"
                value={cashflowFormData.description}
                onChange={(e) =>
                  setCashflowFormData({ ...cashflowFormData, description: e.target.value })
                }
                required
                className="rounded-xl text-xs sm:text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Valor (R$) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                  value={cashflowFormData.amount}
                  onChange={(e) =>
                    setCashflowFormData({ ...cashflowFormData, amount: e.target.value })
                  }
                  required
                  className="rounded-xl font-mono text-xs sm:text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Categoria</Label>
                <Select
                  value={cashflowFormData.category}
                  onValueChange={(val) =>
                    setCashflowFormData({ ...cashflowFormData, category: val })
                  }
                >
                  <SelectTrigger className="rounded-xl text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Despesas Operacionais">Despesas Operacionais</SelectItem>
                    <SelectItem value="Matéria-Prima / Fornecedores">
                      Matéria-Prima / Fornecedores
                    </SelectItem>
                    <SelectItem value="Folha e Pró-labore">Folha e Pró-labore</SelectItem>
                    <SelectItem value="Impostos & Guias">Impostos &amp; Guias</SelectItem>
                    <SelectItem value="Infraestrutura / Manutenção">
                      Infraestrutura / Manutenção
                    </SelectItem>
                    <SelectItem value="Receitas Comerciais">Receitas Comerciais</SelectItem>
                    <SelectItem value="Outros">Outros</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Status</Label>
              <Select
                value={cashflowFormData.status}
                onValueChange={(val: any) =>
                  setCashflowFormData({ ...cashflowFormData, status: val })
                }
              >
                <SelectTrigger className="rounded-xl text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Realizado">Realizado (Efetivado no Caixa)</SelectItem>
                  <SelectItem value="Pendente">Pendente (Previsão Futura)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCashflowModalOpen(false)}
                disabled={isSubmittingCashflow}
                className="rounded-xl"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmittingCashflow}
                className="rounded-xl bg-[#3A3A3C] hover:bg-[#2D2D2F] text-white font-medium"
              >
                {isSubmittingCashflow ? 'Salvando...' : 'Salvar Lançamento'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

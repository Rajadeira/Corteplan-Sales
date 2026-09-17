import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  Send,
  UserPlus,
  Search,
  Building,
  Phone,
  Mail,
  Loader2,
  CheckCircle,
  Calendar,
  Percent,
  Image as ImageIcon,
  Upload,
  X,
  ShieldAlert,
} from 'lucide-react'
import { canManageRecord } from '@/lib/permissions'
import { compressProductImage } from '@/lib/imageUtils'
import { quoteService } from '@/services/quotes'
import { clientService } from '@/services/clients'
import { userService } from '@/services/users'
import { useAuth } from '@/contexts/AuthContext'
import type {
  ClientRecord,
  QuoteItem,
  QuoteRecord,
  QuoteInstallment,
  AppUserRecord,
  ItemCategory,
} from '@/types'
import {
  formatCurrencyBRL,
  formatQuoteNumber,
  maskPhoneBR,
  DEFAULT_TAX_RATES,
  ITEM_CATEGORIES,
  calculateCommission,
} from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import ClientModal from '@/components/ClientModal'
import { toast } from 'sonner'

export default function QuoteForm() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()

  const isEditing = Boolean(id)
  const [unauthorized, setUnauthorized] = useState(false)

  // Pre-selected client from navigation state (ex: from client detail)
  const initialClientId = (location.state as { clientId?: string })?.clientId

  // Dados do formulário
  const [quoteNumber, setQuoteNumber] = useState<number>(0)
  const [formattedNumber, setFormattedNumber] = useState<string>('ORÇ-...')
  const [clients, setClients] = useState<ClientRecord[]>([])
  const [selectedClientId, setSelectedClientId] = useState<string>(initialClientId || '')

  // Autocomplete do cliente
  const [clientSearchQuery, setClientSearchQuery] = useState('')
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false)

  // Itens do orçamento (com tax e technical_description)
  const [items, setItems] = useState<QuoteItem[]>([
    {
      description: '',
      quantity: 1,
      unit: 'un',
      unit_price: 0,
      tax: 0,
      technical_description: '',
    },
  ])

  // Desconto e Observações
  const [discountPercent, setDiscountPercent] = useState<number>(0)
  const [observations, setObservations] = useState<string>('')

  // Novos campos CORTEPLAN & Vendedores/Comissão
  const [usersList, setUsersList] = useState<AppUserRecord[]>([])
  const [selectedSellerUserId, setSelectedSellerUserId] = useState<string>('')
  const [seller, setSeller] = useState<string>('Gustavo')
  const [commissionPercent, setCommissionPercent] = useState<number>(5)
  const [validityDays, setValidityDays] = useState<number>(5)
  const [deliveryTerm, setDeliveryTerm] = useState<string>('À Combinar')
  const [paymentTerms, setPaymentTerms] = useState<string>('Entrada 50% + 2x')

  // Impostos: alíquotas (%) e valores (R$)
  // Regra padrão da CORTEPLAN: ICMS 12%, IPI 3,25%, PIS 0,65% e COFINS 3%
  const [icmsPercent, setIcmsPercent] = useState<number>(DEFAULT_TAX_RATES.icmsPercent)
  const [ipiPercent, setIpiPercent] = useState<number>(DEFAULT_TAX_RATES.ipiPercent)
  const [pisPercent, setPisPercent] = useState<number>(DEFAULT_TAX_RATES.pisPercent)
  const [cofinsPercent, setCofinsPercent] = useState<number>(DEFAULT_TAX_RATES.cofinsPercent)

  // Valores em R$ (editáveis diretamente ou calculados automaticamente)
  const [icms, setIcms] = useState<number>(0)
  const [ipi, setIpi] = useState<number>(0)
  const [pis, setPis] = useState<number>(0)
  const [cofins, setCofins] = useState<number>(0)
  const [taxMode, setTaxMode] = useState<'percent' | 'manual'>('percent')

  // Parcelas
  const [installments, setInstallments] = useState<QuoteInstallment[]>([
    {
      number: 1,
      date: new Date().toISOString().split('T')[0],
      method: 'Boleto',
      value: 0,
    },
  ])

  // Estado de carregamento e envio
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [existingQuote, setExistingQuote] = useState<QuoteRecord | null>(null)

  // Modal de criação rápida de cliente
  const [isClientModalOpen, setIsClientModalOpen] = useState(false)

  // Carregar dados iniciais
  useEffect(() => {
    const initialize = async () => {
      setLoading(true)
      try {
        const [clientList, usersData] = await Promise.all([
          clientService.getAll(),
          userService.getAll().catch(() => []),
        ])
        setClients(clientList)
        setUsersList(usersData)

        if (isEditing && id) {
          const q = await quoteService.getById(id)
          // Bloqueio de edição para vendedor que não é dono da proposta
          if (user && user.role !== 'Administrador' && !canManageRecord(q, user)) {
            setUnauthorized(true)
            setLoading(false)
            return
          }
          setExistingQuote(q)
          setQuoteNumber(q.quote_number)
          setFormattedNumber(formatQuoteNumber(q.quote_number))
          setSelectedClientId(q.client)
          setItems(
            q.items && q.items.length > 0
              ? q.items
              : [
                  {
                    description: '',
                    quantity: 1,
                    unit: 'un',
                    unit_price: 0,
                    tax: 0,
                    technical_description: '',
                  },
                ],
          )
          setDiscountPercent(q.discount_percent || 0)
          setObservations(q.observations || '')

          setSeller(q.seller || user?.name || 'Gustavo')
          if (q.seller_user) {
            setSelectedSellerUserId(q.seller_user)
          } else {
            // Tenta casar pelo nome
            const matched = usersData.find(
              (u) =>
                u.name.toLowerCase() === (q.seller || '').toLowerCase() ||
                (q.seller || '').toLowerCase().includes(u.name.toLowerCase()),
            )
            if (matched) setSelectedSellerUserId(matched.id)
          }

          setCommissionPercent(q.commission_percent !== undefined ? q.commission_percent : 0)
          setValidityDays(q.validity_days !== undefined ? q.validity_days : 5)
          setDeliveryTerm(q.delivery_term || 'À Combinar')
          setPaymentTerms(q.payment_terms || 'Entrada 50% + 2x')

          setIcms(q.icms || 0)
          setIpi(q.ipi || 0)
          setPis(q.pis || 0)
          setCofins(q.cofins || 0)

          // Se estiver editando um orçamento existente com valores salvos,
          // calcula o percentual correspondente em relação ao subtotal se aplicável
          if (q.subtotal && q.subtotal > 0) {
            if (q.icms) setIcmsPercent(Math.round((q.icms / q.subtotal) * 10000) / 100)
            if (q.ipi) setIpiPercent(Math.round((q.ipi / q.subtotal) * 10000) / 100)
            if (q.pis) setPisPercent(Math.round((q.pis / q.subtotal) * 10000) / 100)
            if (q.cofins) setCofinsPercent(Math.round((q.cofins / q.subtotal) * 10000) / 100)
          }

          if (q.installments && q.installments.length > 0) {
            setInstallments(q.installments)
          } else {
            // Default inicial
            const today = new Date().toISOString().split('T')[0]
            setInstallments([
              {
                number: 1,
                date: today,
                method: 'Boleto',
                value: q.total ? Math.round(q.total * 0.5 * 100) / 100 : 0,
              },
            ])
          }
        } else {
          // Novo orçamento
          const next = await quoteService.getNextQuoteNumber()
          setQuoteNumber(next.nextNumber)
          setFormattedNumber(next.formatted)

          // Seleção padrão do vendedor logado ou do primeiro usuário da lista
          if (user?.id) {
            setSelectedSellerUserId(user.id)
            setSeller(user.name || 'Vendedor')
          } else if (usersData.length > 0) {
            setSelectedSellerUserId(usersData[0].id)
            setSeller(usersData[0].name)
          }
        }
      } catch (err) {
        console.error('Erro na inicialização:', err)
        toast.error('Erro ao carregar dados do formulário.')
      } finally {
        setLoading(false)
      }
    }

    initialize()
  }, [id, isEditing])

  // Cliente selecionado atualmente
  const selectedClient = clients.find((c) => c.id === selectedClientId)

  // Autocomplete filtrado
  const filteredClients = clients.filter((c) => {
    if (!clientSearchQuery.trim()) return true
    const q = clientSearchQuery.toLowerCase()
    return (
      (c.name || '').toLowerCase().includes(q) ||
      (c.company || '').toLowerCase().includes(q) ||
      (c.trade_name || '').toLowerCase().includes(q) ||
      (c.document_number || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q)
    )
  })

  // Cálculos em tempo real
  const subtotal = items.reduce((sum, item) => {
    const qty = Number(item.quantity) || 0
    const price = Number(item.unit_price) || 0
    return sum + qty * price
  }, 0)

  // Quando o subtotal ou os percentuais mudam e estamos em modo 'percent',
  // recalcula os valores de impostos automaticamente com base na regra pré-estipulada
  useEffect(() => {
    if (taxMode === 'percent') {
      const calcIcms = Math.round(((subtotal * (Number(icmsPercent) || 0)) / 100) * 100) / 100
      const calcIpi = Math.round(((subtotal * (Number(ipiPercent) || 0)) / 100) * 100) / 100
      const calcPis = Math.round(((subtotal * (Number(pisPercent) || 0)) / 100) * 100) / 100
      const calcCofins = Math.round(((subtotal * (Number(cofinsPercent) || 0)) / 100) * 100) / 100

      setIcms(calcIcms)
      setIpi(calcIpi)
      setPis(calcPis)
      setCofins(calcCofins)
    }
  }, [subtotal, icmsPercent, ipiPercent, pisPercent, cofinsPercent, taxMode])

  const discountAmount = (subtotal * (Number(discountPercent) || 0)) / 100
  const taxesTotal =
    (Number(icms) || 0) + (Number(ipi) || 0) + (Number(pis) || 0) + (Number(cofins) || 0)
  // Total da proposta: se houver impostos discriminados, soma ao subtotal líquido; caso contrário subtotal - desconto
  const total = Math.max(0, subtotal - discountAmount + taxesTotal)

  // Cálculo de comissão em tempo real com regra restrita da Corteplan:
  // "A base de cálculo é o valor dos PRODUTOS... EXCETUANDO: o valor correspondente aos impostos e qualquer item cuja categoria seja 'Frete' ou 'Instalação'.
  // Comissão = (soma das linhas comissionáveis, com desconto proporcional aplicado) x percentual de comissão"
  const { commissionBase, commissionAmount } = calculateCommission(
    items,
    discountPercent,
    commissionPercent,
  )

  // Gerador automático de parcelas sugeridas a partir do total
  const handleAutoGenerateInstallments = (count: number) => {
    if (total <= 0) {
      toast.warning('Adicione produtos para gerar as parcelas com base no valor total.')
      return
    }
    const newInstallments: QuoteInstallment[] = []
    const baseValue = Math.floor((total / count) * 100) / 100
    const diff = Math.round((total - baseValue * count) * 100) / 100

    const today = new Date()

    for (let i = 1; i <= count; i++) {
      const d = new Date(today)
      d.setMonth(d.getMonth() + (i - 1))
      newInstallments.push({
        number: i,
        date: d.toISOString().split('T')[0],
        method: 'Boleto',
        value: i === 1 ? Math.round((baseValue + diff) * 100) / 100 : baseValue,
      })
    }
    setInstallments(newInstallments)
    toast.success(`${count} parcelas geradas automaticamente!`)
  }

  // Adicionar parcela manual
  const handleAddInstallment = () => {
    const nextNum = installments.length + 1
    const lastDate =
      installments.length > 0
        ? installments[installments.length - 1].date
        : new Date().toISOString().split('T')[0]
    const d = new Date(lastDate)
    d.setMonth(d.getMonth() + 1)

    setInstallments((prev) => [
      ...prev,
      {
        number: nextNum,
        date: d.toISOString().split('T')[0],
        method: 'Boleto',
        value: 0,
      },
    ])
  }

  const handleRemoveInstallment = (index: number) => {
    if (installments.length <= 1) {
      toast.warning('Deve haver pelo menos 1 parcela.')
      return
    }
    setInstallments((prev) =>
      prev.filter((_, i) => i !== index).map((item, i) => ({ ...item, number: i + 1 })),
    )
  }

  const handleInstallmentChange = (
    index: number,
    field: keyof QuoteInstallment,
    val: string | number,
  ) => {
    setInstallments((prev) => {
      const next = [...prev]
      next[index] = {
        ...next[index],
        [field]: val,
      }
      return next
    })
  }

  // Adicionar novo item
  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        description: '',
        quantity: 1,
        unit: 'un',
        unit_price: 0,
        tax: 0,
        technical_description: '',
      },
    ])
  }

  // Atualizar campo de item
  const handleItemChange = (index: number, field: keyof QuoteItem, value: string | number) => {
    setItems((prev) => {
      const next = [...prev]
      next[index] = {
        ...next[index],
        [field]: value,
      }
      return next
    })
  }

  // Remover item
  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      toast.warning('O orçamento deve conter pelo menos 1 item.')
      return
    }
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  // Validação do formulário
  const validateForm = () => {
    if (!selectedClientId) {
      toast.error('Selecione um cliente para a proposta.')
      return false
    }

    if (items.length === 0) {
      toast.error('Adicione pelo menos um item ao orçamento.')
      return false
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (!item.description.trim()) {
        toast.error(`Informe o título/descrição do item #${i + 1}.`)
        return false
      }
      if (item.quantity <= 0) {
        toast.error(`A quantidade do item #${i + 1} deve ser maior que zero.`)
        return false
      }
      if (item.unit_price < 0) {
        toast.error(`O valor unitário do item #${i + 1} não pode ser negativo.`)
        return false
      }
    }

    return true
  }

  // Salvar rascunho ou salvar e enviar
  const handleSave = async (targetStatus: 'Rascunho' | 'Enviado') => {
    if (!validateForm()) return

    setSaving(true)
    const cleanItems: QuoteItem[] = items.map((it) => ({
      description: it.description.trim(),
      category: it.category || 'Mobiliário',
      quantity: Number(it.quantity) || 1,
      unit: it.unit,
      unit_price: Number(it.unit_price) || 0,
      tax: Number(it.tax) || 0,
      technical_description: it.technical_description?.trim() || undefined,
      image: it.image || undefined,
    }))

    const cleanInstallments: QuoteInstallment[] = installments.map((inst, idx) => ({
      number: idx + 1,
      date: inst.date,
      method: inst.method || 'Boleto',
      value: Number(inst.value) || 0,
    }))

    const userName = user?.name || seller || 'Gustavo Tibério'
    const finalSellerUser =
      user?.role === 'Administrador'
        ? selectedSellerUserId || user.id
        : user?.id || selectedSellerUserId || undefined
    const finalSellerName =
      user?.role === 'Administrador'
        ? seller.trim() || 'Gustavo'
        : user?.name || seller.trim() || 'Vendedor'

    try {
      const quotePayload = {
        client: selectedClientId,
        items: cleanItems,
        discount_percent: Number(discountPercent) || 0,
        subtotal: Math.round(subtotal * 100) / 100,
        total: Math.round(total * 100) / 100,
        observations: observations.trim() || undefined,
        seller: finalSellerName,
        seller_user: finalSellerUser,
        commission_percent: Number(commissionPercent) || 0,
        validity_days: Number(validityDays) || 5,
        delivery_term: deliveryTerm.trim() || 'À Combinar',
        payment_terms: paymentTerms.trim() || 'Entrada 50% + 2x',
        icms: Number(icms) || 0,
        ipi: Number(ipi) || 0,
        pis: Number(pis) || 0,
        cofins: Number(cofins) || 0,
        installments: cleanInstallments,
      }

      if (isEditing && id) {
        const updatedStatus =
          existingQuote?.status === 'Rascunho' && targetStatus === 'Enviado'
            ? 'Enviado'
            : existingQuote?.status || targetStatus

        const updated = await quoteService.update(id, {
          ...quotePayload,
          status: updatedStatus,
        })

        toast.success('Orçamento CORTEPLAN atualizado com sucesso!')
        navigate(`/orcamentos/${updated.id}`)
      } else {
        const created = await quoteService.create(
          {
            ...quotePayload,
            quote_number: quoteNumber,
            status: targetStatus,
          },
          userName,
        )

        toast.success(
          targetStatus === 'Enviado'
            ? 'Proposta CORTEPLAN criada e enviada com sucesso!'
            : 'Rascunho da proposta comercial salvo com sucesso!',
        )

        navigate(`/orcamentos/${created.id}`)
      }
    } catch (err: unknown) {
      console.error('Erro ao salvar proposta:', err)
      toast.error('Erro ao salvar a proposta comercial. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <Loader2 className="h-8 w-8 animate-spin text-[#3A3A3C]" />
          <p className="text-sm">Carregando formulário de proposta...</p>
        </div>
      </div>
    )
  }

  if (unauthorized) {
    return (
      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-xs max-w-xl mx-auto my-12 text-center space-y-4">
        <div className="h-14 w-14 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-slate-900">Acesso Restrito</h2>
          <p className="text-sm text-slate-500">
            Você não possui permissão para editar propostas comerciais de outro vendedor.
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

  return (
    <div className="space-y-6 pb-16">
      {/* Botão de retorno e Header */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/orcamentos')}
          className="text-slate-600 hover:text-slate-900 -ml-2 rounded-xl"
        >
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Voltar para Orçamentos
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {isEditing ? 'Edição de Proposta' : 'Nova Proposta Comercial'} &bull; Modelo CORTEPLAN
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {isEditing ? `Editar Proposta Nº ${quoteNumber}` : 'Elaboração de Proposta Comercial'}
          </h1>
        </div>

        {/* Número sequencial em destaque */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[11px] font-semibold text-slate-400 block uppercase">
              Número da Proposta
            </span>
            <span className="font-mono text-2xl font-extrabold text-[#3A3A3C]">
              {formattedNumber}
            </span>
          </div>
        </div>
      </div>

      {/* Grid Principal: Formulário + Resumo Lateral */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Formulário Principal: 8 colunas desktop */}
        <div className="lg:col-span-8 space-y-6">
          {/* Seção 1: Seleção de Cliente */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                1. Cliente da Proposta <span className="text-red-500">*</span>
              </h2>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsClientModalOpen(true)}
                className="rounded-xl border-slate-300 text-xs h-8"
              >
                <UserPlus className="h-3.5 w-3.5 mr-1.5 text-amber-500" />
                Novo cliente
              </Button>
            </div>

            {/* Dropdown / Busca de clientes */}
            <div className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Pesquise por nome, empresa ou e-mail..."
                  value={clientSearchQuery}
                  onChange={(e) => {
                    setClientSearchQuery(e.target.value)
                    setClientDropdownOpen(true)
                  }}
                  onFocus={() => setClientDropdownOpen(true)}
                  className="pl-9 pr-4 h-11 bg-slate-50 text-sm rounded-xl border-slate-200"
                />
              </div>

              {clientDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-30 max-h-56 overflow-y-auto p-1 text-xs">
                  {filteredClients.length === 0 ? (
                    <div className="py-4 text-center text-slate-400">
                      Nenhum cliente encontrado com esse termo.
                    </div>
                  ) : (
                    filteredClients.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setSelectedClientId(c.id)
                          setClientSearchQuery('')
                          setClientDropdownOpen(false)
                        }}
                        className={`w-full flex items-center justify-between p-2.5 rounded-lg text-left transition-colors hover:bg-slate-100 ${
                          c.id === selectedClientId
                            ? 'bg-slate-100 font-semibold text-[#3A3A3C]'
                            : ''
                        }`}
                      >
                        <div className="truncate pr-2">
                          <div className="font-semibold text-slate-900">{c.name}</div>
                          <div className="text-[11px] text-slate-500 truncate">
                            {c.company ? `${c.company} • ` : ''}
                            {maskPhoneBR(c.phone)}
                          </div>
                        </div>
                        {c.id === selectedClientId && (
                          <CheckCircle className="h-4 w-4 text-[#3A3A3C] shrink-0" />
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Card do Cliente Selecionado */}
            {selectedClient ? (
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <div className="font-bold text-sm text-slate-900">{selectedClient.name}</div>
                  <div className="text-slate-600 flex flex-wrap items-center gap-3">
                    {selectedClient.company && (
                      <span className="flex items-center gap-1">
                        <Building className="h-3.5 w-3.5 text-slate-400" />
                        {selectedClient.company}
                      </span>
                    )}
                    <span className="flex items-center gap-1 font-medium">
                      <Phone className="h-3.5 w-3.5 text-slate-400" />
                      {maskPhoneBR(selectedClient.phone)}
                    </span>
                    {selectedClient.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="h-3.5 w-3.5 text-slate-400" />
                        {selectedClient.email}
                      </span>
                    )}
                  </div>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedClientId('')}
                  className="text-xs text-slate-500 hover:text-red-600 self-start sm:self-auto"
                >
                  Alterar
                </Button>
              </div>
            ) : (
              <p className="text-xs text-amber-700 bg-amber-50 p-3 rounded-xl border border-amber-200/80">
                Selecione um cliente para a proposta ou cadastre um novo pelo botão acima.
              </p>
            )}
          </div>

          {/* Seção 2: Itens do Orçamento (com Impostos do item e Descrição Técnica detalhada) */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  2. Itens e Especificações Técnicas <span className="text-red-500">*</span>
                </h2>
                <p className="text-xs text-slate-500">
                  Inclua título curto, imposto do item e a descrição técnica completa como no modelo
                  CORTEPLAN.
                </p>
              </div>
              <span className="text-xs text-slate-400">{items.length} item(ns)</span>
            </div>

            {/* Lista de itens dinâmicos */}
            <div className="space-y-4">
              {items.map((item, index) => {
                const itemSubtotal = (Number(item.quantity) || 0) * (Number(item.unit_price) || 0)

                return (
                  <div
                    key={index}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-bold text-slate-700">Item #{index + 1}</span>
                      {items.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveItem(index)}
                          className="h-7 w-7 text-slate-400 hover:text-red-600 hover:bg-red-50"
                          title="Remover item"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>

                    {/* Título do produto e Categoria (incluindo Frete e Instalação) */}
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                      <div className="sm:col-span-8 space-y-1">
                        <Label className="text-[11px] font-semibold text-slate-700">
                          Título do Item (ex: Carrinho Gourmet com Testeira.)
                        </Label>
                        <Input
                          placeholder="Ex: Carrinho Gourmet com Testeira."
                          value={item.description}
                          onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                          className="bg-white text-xs sm:text-sm h-10 font-medium"
                        />
                      </div>

                      <div className="sm:col-span-4 space-y-1">
                        <div className="flex items-center justify-between">
                          <Label className="text-[11px] font-semibold text-slate-700">
                            Categoria
                          </Label>
                          {(item.category === 'Frete' || item.category === 'Instalação') && (
                            <span className="text-[10px] text-amber-700 font-semibold">
                              Sem comissão
                            </span>
                          )}
                        </div>
                        <Select
                          value={item.category || 'Mobiliário'}
                          onValueChange={(val: ItemCategory) =>
                            handleItemChange(index, 'category', val)
                          }
                        >
                          <SelectTrigger className="bg-white h-10 text-xs sm:text-sm">
                            <SelectValue placeholder="Categoria" />
                          </SelectTrigger>
                          <SelectContent>
                            {ITEM_CATEGORIES.map((cat) => (
                              <SelectItem key={cat} value={cat}>
                                {cat}{' '}
                                {cat === 'Frete' || cat === 'Instalação'
                                  ? '(Não comissionável)'
                                  : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Quantidade, Unidade, Preço Unitário, Imposto do Item e Subtotal */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[11px] font-semibold text-slate-600">
                          Quantidade
                        </Label>
                        <Input
                          type="number"
                          min="0.01"
                          step="any"
                          value={item.quantity}
                          onChange={(e) =>
                            handleItemChange(index, 'quantity', parseFloat(e.target.value) || 0)
                          }
                          className="bg-white text-xs sm:text-sm h-10 font-mono"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[11px] font-semibold text-slate-600">Unidade</Label>
                        <Select
                          value={item.unit}
                          onValueChange={(val: 'un' | 'm²' | 'm' | 'kit' | 'hora') =>
                            handleItemChange(index, 'unit', val)
                          }
                        >
                          <SelectTrigger className="bg-white h-10 text-xs sm:text-sm">
                            <SelectValue placeholder="Un" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="un">un</SelectItem>
                            <SelectItem value="m²">m²</SelectItem>
                            <SelectItem value="m">m</SelectItem>
                            <SelectItem value="kit">kit</SelectItem>
                            <SelectItem value="hora">hora</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[11px] font-semibold text-slate-600">
                          Valor Unit. (R$)
                        </Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unit_price}
                          onChange={(e) =>
                            handleItemChange(index, 'unit_price', parseFloat(e.target.value) || 0)
                          }
                          className="bg-white text-xs sm:text-sm h-10 font-mono"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[11px] font-semibold text-slate-600">
                          Imp: (R$)
                        </Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="Ex: 1719.90"
                          value={item.tax || ''}
                          onChange={(e) =>
                            handleItemChange(index, 'tax', parseFloat(e.target.value) || 0)
                          }
                          className="bg-white text-xs sm:text-sm h-10 font-mono"
                        />
                      </div>

                      <div className="space-y-1 col-span-2 sm:col-span-1">
                        <Label className="text-[11px] font-semibold text-slate-600">
                          Valor Total
                        </Label>
                        <div className="h-10 rounded-md bg-slate-100 flex items-center px-3 font-mono text-xs font-bold text-slate-900">
                          {formatCurrencyBRL(itemSubtotal)}
                        </div>
                      </div>
                    </div>

                    {/* Descrição técnica longa */}
                    <div className="space-y-1 pt-1">
                      <Label className="text-[11px] font-semibold text-slate-600">
                        Descrição Técnica Detalhada (materiais, acabamento, dimensões, componentes)
                      </Label>
                      <Textarea
                        rows={3}
                        placeholder='Ex: Confeccionado em compensado com revestimento laminado (Fórmica). Tampo em MDF madeirado. Testeira com iluminação LED. Mini estoque com porta e fechadura. Rodas de alumínio aro 20 com paralamas e rodízios de apoio de 3". Medidas aproximadas: 120x60x185cm.'
                        value={item.technical_description || ''}
                        onChange={(e) =>
                          handleItemChange(index, 'technical_description', e.target.value)
                        }
                        className="bg-white text-xs"
                      />
                    </div>

                    {/* Foto / Imagem do Produto */}
                    <div className="pt-2 border-t border-slate-200/80">
                      <div className="flex items-center justify-between mb-1.5">
                        <Label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1.5">
                          <ImageIcon className="h-3.5 w-3.5 text-[#F08A24]" />
                          Foto do Produto (opcional — impressa na proposta)
                        </Label>
                        {item.image && (
                          <button
                            type="button"
                            onClick={() => handleItemChange(index, 'image', '')}
                            className="text-[10px] text-red-600 hover:text-red-700 hover:underline flex items-center gap-1"
                          >
                            <X className="h-3 w-3" />
                            Remover foto
                          </button>
                        )}
                      </div>

                      {item.image ? (
                        <div className="flex items-center gap-3 p-2 bg-white rounded-lg border border-slate-200">
                          <img
                            src={item.image}
                            alt="Pré-visualização do produto"
                            className="h-16 w-16 object-contain rounded border border-slate-100 bg-slate-50"
                          />
                          <div className="flex-1 text-xs">
                            <span className="font-semibold text-slate-800 block">
                              Imagem anexada ao item
                            </span>
                            <span className="text-[11px] text-slate-500">
                              Será exibida em miniatura (~2 cm) ao lado da descrição na proposta
                              impressa.
                            </span>
                          </div>
                          <label className="cursor-pointer">
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0]
                                if (!file) return
                                try {
                                  const compressed = await compressProductImage(file, 480, 0.82)
                                  handleItemChange(index, 'image', compressed)
                                  toast.success('Foto atualizada!')
                                } catch (err: unknown) {
                                  toast.error(
                                    err instanceof Error
                                      ? err.message
                                      : 'Erro ao processar imagem.',
                                  )
                                }
                              }}
                            />
                            <span className="inline-flex items-center px-2.5 py-1 text-[11px] font-medium border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700">
                              Trocar foto
                            </span>
                          </label>
                        </div>
                      ) : (
                        <label className="cursor-pointer flex items-center justify-center gap-2 p-3 border border-dashed border-slate-300 hover:border-[#F08A24] hover:bg-amber-50/20 rounded-xl transition-colors text-xs text-slate-600 bg-white">
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0]
                              if (!file) return
                              try {
                                const compressed = await compressProductImage(file, 480, 0.82)
                                handleItemChange(index, 'image', compressed)
                                toast.success('Foto do produto adicionada!')
                              } catch (err: unknown) {
                                toast.error(
                                  err instanceof Error ? err.message : 'Erro ao processar imagem.',
                                )
                              }
                            }}
                          />
                          <Upload className="h-4 w-4 text-[#F08A24]" />
                          <span>Clique para anexar foto do produto (PNG, JPG, WebP)</span>
                        </label>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Botão Adicionar Item */}
            <button
              type="button"
              onClick={handleAddItem}
              className="w-full py-3 border-2 border-dashed border-slate-200 hover:border-[#3A3A3C] hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-600 hover:text-[#3A3A3C] flex items-center justify-center gap-2 transition-all"
            >
              <Plus className="h-4 w-4 text-amber-500" />
              Adicionar Novo Item
            </button>
          </div>

          {/* Seção 3: Detalhamento de Impostos (ICMS 12%, IPI 3,25%, PIS 0,65%, COFINS 3%) */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  3. Regra de Impostos (ICMS 12%, IPI 3,25%, PIS 0,65%, COFINS 3%)
                </h2>
                <p className="text-xs text-slate-500">
                  Valores calculados automaticamente sobre o subtotal de produtos (editáveis por
                  proposta).
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIcmsPercent(DEFAULT_TAX_RATES.icmsPercent)
                    setIpiPercent(DEFAULT_TAX_RATES.ipiPercent)
                    setPisPercent(DEFAULT_TAX_RATES.pisPercent)
                    setCofinsPercent(DEFAULT_TAX_RATES.cofinsPercent)
                    setTaxMode('percent')
                    toast.success('Alíquotas padrão Corteplan restauradas!')
                  }}
                  className="text-xs h-7 rounded-lg text-slate-600 hover:text-slate-900"
                >
                  Restaurar Padrão Corteplan
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* ICMS (12%) */}
              <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-slate-900">ICMS</Label>
                  <span className="text-[11px] text-slate-500 font-medium">Padrão: 12%</span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={icmsPercent}
                      onChange={(e) => {
                        setTaxMode('percent')
                        setIcmsPercent(parseFloat(e.target.value) || 0)
                      }}
                      className="bg-white text-xs font-mono h-8"
                    />
                    <span className="text-xs font-bold text-slate-600">%</span>
                  </div>
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60">
                    <span className="text-slate-500 text-[11px]">Valor (R$):</span>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={icms || ''}
                      onChange={(e) => {
                        setTaxMode('manual')
                        setIcms(parseFloat(e.target.value) || 0)
                      }}
                      className="bg-white text-xs font-mono font-bold text-slate-900 h-8 w-28 text-right"
                    />
                  </div>
                </div>
              </div>

              {/* IPI (3,25%) */}
              <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-slate-900">IPI</Label>
                  <span className="text-[11px] text-slate-500 font-medium">Padrão: 3,25%</span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={ipiPercent}
                      onChange={(e) => {
                        setTaxMode('percent')
                        setIpiPercent(parseFloat(e.target.value) || 0)
                      }}
                      className="bg-white text-xs font-mono h-8"
                    />
                    <span className="text-xs font-bold text-slate-600">%</span>
                  </div>
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60">
                    <span className="text-slate-500 text-[11px]">Valor (R$):</span>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={ipi || ''}
                      onChange={(e) => {
                        setTaxMode('manual')
                        setIpi(parseFloat(e.target.value) || 0)
                      }}
                      className="bg-white text-xs font-mono font-bold text-slate-900 h-8 w-28 text-right"
                    />
                  </div>
                </div>
              </div>

              {/* PIS (0,65%) */}
              <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-slate-900">PIS</Label>
                  <span className="text-[11px] text-slate-500 font-medium">Padrão: 0,65%</span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={pisPercent}
                      onChange={(e) => {
                        setTaxMode('percent')
                        setPisPercent(parseFloat(e.target.value) || 0)
                      }}
                      className="bg-white text-xs font-mono h-8"
                    />
                    <span className="text-xs font-bold text-slate-600">%</span>
                  </div>
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60">
                    <span className="text-slate-500 text-[11px]">Valor (R$):</span>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={pis || ''}
                      onChange={(e) => {
                        setTaxMode('manual')
                        setPis(parseFloat(e.target.value) || 0)
                      }}
                      className="bg-white text-xs font-mono font-bold text-slate-900 h-8 w-28 text-right"
                    />
                  </div>
                </div>
              </div>

              {/* COFINS (3%) */}
              <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-slate-900">COFINS</Label>
                  <span className="text-[11px] text-slate-500 font-medium">Padrão: 3%</span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={cofinsPercent}
                      onChange={(e) => {
                        setTaxMode('percent')
                        setCofinsPercent(parseFloat(e.target.value) || 0)
                      }}
                      className="bg-white text-xs font-mono h-8"
                    />
                    <span className="text-xs font-bold text-slate-600">%</span>
                  </div>
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60">
                    <span className="text-slate-500 text-[11px]">Valor (R$):</span>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={cofins || ''}
                      onChange={(e) => {
                        setTaxMode('manual')
                        setCofins(parseFloat(e.target.value) || 0)
                      }}
                      className="bg-white text-xs font-mono font-bold text-slate-900 h-8 w-28 text-right"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1">
              <span>Soma total dos impostos discriminados:</span>
              <span className="font-mono font-bold text-slate-900">
                {formatCurrencyBRL(taxesTotal)}
              </span>
            </div>
          </div>

          {/* Seção 4: Condições Comerciais, Vendedor e Comissão */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              4. Condições Comerciais, Vendedor & Comissão
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Seleção do Vendedor entre os usuários (Apenas Administrador pode reatribuir) */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Vendedor Responsável</Label>
                {user?.role === 'Administrador' ? (
                  usersList.length > 0 ? (
                    <Select
                      value={selectedSellerUserId}
                      onValueChange={(val) => {
                        setSelectedSellerUserId(val)
                        const found = usersList.find((u) => u.id === val)
                        if (found) setSeller(found.name)
                      }}
                    >
                      <SelectTrigger className="text-xs sm:text-sm bg-white">
                        <SelectValue placeholder="Selecione o vendedor" />
                      </SelectTrigger>
                      <SelectContent>
                        {usersList.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.name} {u.role ? `(${u.role})` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      placeholder="Ex: Gustavo"
                      value={seller}
                      onChange={(e) => setSeller(e.target.value)}
                      className="text-xs sm:text-sm"
                    />
                  )
                ) : (
                  <Input
                    value={user?.name || seller || 'Vendedor'}
                    disabled
                    className="text-xs sm:text-sm bg-slate-100 text-slate-700 font-medium cursor-not-allowed"
                    title="Vendedores criam orçamentos atribuídos automaticamente ao seu próprio usuário"
                  />
                )}
              </div>

              {/* Comissão (%) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-slate-700">Comissão (%)</Label>
                  <span className="text-[11px] font-mono font-bold text-emerald-700">
                    = {formatCurrencyBRL(commissionAmount)}
                  </span>
                </div>
                <div className="relative">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    placeholder="Ex: 5"
                    value={commissionPercent}
                    onChange={(e) => setCommissionPercent(parseFloat(e.target.value) || 0)}
                    className="text-xs sm:text-sm font-mono pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    %
                  </span>
                </div>
                <p className="text-[10px] text-slate-500">
                  Base: produtos comissionáveis ({formatCurrencyBRL(commissionBase)}), excetuando
                  impostos, Frete e Instalação.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  Validade da Proposta (dias)
                </Label>
                <Input
                  type="number"
                  min="1"
                  placeholder="5"
                  value={validityDays}
                  onChange={(e) => setValidityDays(parseInt(e.target.value, 10) || 5)}
                  className="text-xs sm:text-sm font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Prazo de Entrega</Label>
                <Input
                  placeholder="Ex: À Combinar ou 20 dias úteis"
                  value={deliveryTerm}
                  onChange={(e) => setDeliveryTerm(e.target.value)}
                  className="text-xs sm:text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  Condição de Pagamento (resumo)
                </Label>
                <Input
                  placeholder="Ex: Entrada 50% + 2x"
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  className="text-xs sm:text-sm"
                />
              </div>
            </div>

            {/* Observações livres */}
            <div className="space-y-1.5 pt-2">
              <Label className="text-xs font-semibold text-slate-700">
                Observações Gerais da Proposta (texto livre exibido no corpo)
              </Label>
              <Textarea
                rows={4}
                placeholder="Ex: Prazo de entrega: 20 dias úteis&#10;Pagamento: 50% sinal, saldo em 30/60 dias após emissão da NF-e...&#10;Este orçamento contempla exclusivamente os itens descritos..."
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                className="text-xs sm:text-sm"
              />
            </div>
          </div>

          {/* Seção 5: Tabela de Parcelas (Página 2 do modelo CORTEPLAN) */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  5. Programação de Parcelas (Página 2)
                </h2>
                <p className="text-xs text-slate-500">
                  Defina as datas, formas de pagamento e valores de cada parcela.
                </p>
              </div>

              {/* Botões rápidos de geração */}
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleAutoGenerateInstallments(2)}
                  className="text-xs h-7 rounded-lg"
                >
                  2x
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleAutoGenerateInstallments(3)}
                  className="text-xs h-7 rounded-lg"
                >
                  3x (Entrada + 2x)
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleAutoGenerateInstallments(4)}
                  className="text-xs h-7 rounded-lg"
                >
                  4x
                </Button>
              </div>
            </div>

            {/* Lista de Parcelas */}
            <div className="space-y-2">
              {installments.map((inst, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50/70"
                >
                  <span className="w-12 text-center font-bold text-xs text-slate-700 shrink-0">
                    #{inst.number}
                  </span>

                  <div className="flex-1 min-w-[130px]">
                    <Input
                      type="date"
                      value={inst.date}
                      onChange={(e) => handleInstallmentChange(idx, 'date', e.target.value)}
                      className="h-9 bg-white text-xs font-mono"
                    />
                  </div>

                  <div className="flex-1 min-w-[120px]">
                    <Select
                      value={inst.method}
                      onValueChange={(val) => handleInstallmentChange(idx, 'method', val)}
                    >
                      <SelectTrigger className="h-9 bg-white text-xs">
                        <SelectValue placeholder="Forma" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Boleto">Boleto</SelectItem>
                        <SelectItem value="PIX">PIX</SelectItem>
                        <SelectItem value="Transferência">Transferência</SelectItem>
                        <SelectItem value="Cartão">Cartão</SelectItem>
                        <SelectItem value="Cheque">Cheque</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex-1 min-w-[110px]">
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Valor"
                      value={inst.value}
                      onChange={(e) =>
                        handleInstallmentChange(idx, 'value', parseFloat(e.target.value) || 0)
                      }
                      className="h-9 bg-white text-xs font-mono text-right"
                    />
                  </div>

                  {installments.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveInstallment(idx)}
                      className="h-8 w-8 text-slate-400 hover:text-red-600 shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddInstallment}
              className="text-xs rounded-xl"
            >
              <Plus className="h-3.5 w-3.5 mr-1 text-amber-500" />
              Adicionar Parcela
            </Button>
          </div>
        </div>

        {/* Resumo Lateral Fixo: 4 colunas desktop */}
        <div className="lg:col-span-4 sticky top-24 space-y-5">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider pb-2 border-b border-slate-100">
              Resumo da Proposta CORTEPLAN
            </h2>

            <div className="space-y-3 text-xs sm:text-sm">
              <div className="flex justify-between items-center text-slate-600">
                <span>Produtos (subtotal)</span>
                <span className="font-mono font-semibold text-slate-900">
                  {formatCurrencyBRL(subtotal)}
                </span>
              </div>

              {/* Campo de Desconto */}
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="discount" className="text-xs font-semibold text-slate-700">
                    Desconto (%)
                  </Label>
                  <span className="font-mono text-xs text-emerald-600 font-semibold">
                    - {formatCurrencyBRL(discountAmount)}
                  </span>
                </div>
                <Input
                  id="discount"
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(parseFloat(e.target.value) || 0)}
                  className="font-mono text-xs h-9 bg-slate-50"
                  placeholder="0"
                />
              </div>

              {/* Discriminativo de Impostos */}
              {taxesTotal > 0 && (
                <div className="pt-2 border-t border-slate-100 space-y-1 text-xs text-slate-600">
                  <div className="font-bold text-slate-700 text-[11px] uppercase">
                    Impostos discriminados
                  </div>
                  {icms > 0 && (
                    <div className="flex justify-between">
                      <span>ICMS</span>
                      <span className="font-mono">{formatCurrencyBRL(icms)}</span>
                    </div>
                  )}
                  {ipi > 0 && (
                    <div className="flex justify-between">
                      <span>IPI</span>
                      <span className="font-mono">{formatCurrencyBRL(ipi)}</span>
                    </div>
                  )}
                  {pis > 0 && (
                    <div className="flex justify-between">
                      <span>PIS</span>
                      <span className="font-mono">{formatCurrencyBRL(pis)}</span>
                    </div>
                  )}
                  {cofins > 0 && (
                    <div className="flex justify-between">
                      <span>COFINS</span>
                      <span className="font-mono">{formatCurrencyBRL(cofins)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Total Geral em Destaque */}
              <div className="pt-4 border-t-2 border-slate-200 space-y-1">
                <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <span>Total da Proposta</span>
                  <span>BRL</span>
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-[#3A3A3C] font-mono tracking-tight transition-all duration-200">
                  {formatCurrencyBRL(total)}
                </div>

                {/* Linha discreta de comissão calculada (dado interno) */}
                {commissionAmount > 0 && (
                  <div className="pt-2 text-xs text-slate-500 border-t border-slate-100 flex items-center justify-between">
                    <span>Comissão ({commissionPercent}%):</span>
                    <span className="font-mono font-bold text-slate-800">
                      {formatCurrencyBRL(commissionAmount)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Ações de salvamento */}
            <div className="pt-4 border-t border-slate-100 space-y-2.5">
              <Button
                type="button"
                onClick={() => handleSave('Enviado')}
                disabled={saving}
                className="w-full h-11 bg-[#3A3A3C] hover:bg-[#2D2D2F] text-white font-semibold text-xs sm:text-sm rounded-xl shadow-sm transition-all duration-200 hover:scale-[1.02]"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4 text-amber-400" />
                    Salvar e Enviar Proposta
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => handleSave('Rascunho')}
                disabled={saving}
                className="w-full h-10 border-slate-200 text-slate-700 hover:bg-slate-50 text-xs sm:text-sm rounded-xl font-medium"
              >
                <Save className="mr-2 h-4 w-4 text-slate-500" />
                Salvar como Rascunho
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Cadastro Rápido de Cliente */}
      <ClientModal
        open={isClientModalOpen}
        onOpenChange={setIsClientModalOpen}
        onSuccess={(created) => {
          setClients((prev) => [created, ...prev])
          setSelectedClientId(created.id)
        }}
      />
    </div>
  )
}

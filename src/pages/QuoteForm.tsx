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
} from 'lucide-react'
import { quoteService } from '@/services/quotes'
import { clientService } from '@/services/clients'
import { useAuth } from '@/contexts/AuthContext'
import type { ClientRecord, QuoteItem, QuoteRecord } from '@/types'
import { formatCurrencyBRL, formatQuoteNumber, maskPhoneBR } from '@/types'
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

  // Itens do orçamento
  const [items, setItems] = useState<QuoteItem[]>([
    {
      description: '',
      quantity: 1,
      unit: 'un',
      unit_price: 0,
    },
  ])

  // Desconto e Observações
  const [discountPercent, setDiscountPercent] = useState<number>(0)
  const [observations, setObservations] = useState<string>('')

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
        const clientList = await clientService.getAll()
        setClients(clientList)

        if (isEditing && id) {
          const q = await quoteService.getById(id)
          setExistingQuote(q)
          setQuoteNumber(q.quote_number)
          setFormattedNumber(formatQuoteNumber(q.quote_number))
          setSelectedClientId(q.client)
          setItems(
            q.items && q.items.length > 0
              ? q.items
              : [{ description: '', quantity: 1, unit: 'un', unit_price: 0 }],
          )
          setDiscountPercent(q.discount_percent || 0)
          setObservations(q.observations || '')
        } else {
          // Novo orçamento: obter próximo número sequencial garantido no servidor
          const next = await quoteService.getNextQuoteNumber()
          setQuoteNumber(next.nextNumber)
          setFormattedNumber(next.formatted)
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
      (c.email || '').toLowerCase().includes(q)
    )
  })

  // Cálculos em tempo real
  const subtotal = items.reduce((sum, item) => {
    const qty = Number(item.quantity) || 0
    const price = Number(item.unit_price) || 0
    return sum + qty * price
  }, 0)

  const discountAmount = (subtotal * (Number(discountPercent) || 0)) / 100
  const total = Math.max(0, subtotal - discountAmount)

  // Adicionar novo item
  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        description: '',
        quantity: 1,
        unit: 'un',
        unit_price: 0,
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
        toast.error(`Informe a descrição do item #${i + 1}.`)
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
      quantity: Number(it.quantity) || 1,
      unit: it.unit,
      unit_price: Number(it.unit_price) || 0,
    }))

    const userName = user?.name || 'Administrador'

    try {
      if (isEditing && id) {
        // Atualiza orçamento mantendo status anterior a menos que seja enviado
        const updatedStatus =
          existingQuote?.status === 'Rascunho' && targetStatus === 'Enviado'
            ? 'Enviado'
            : existingQuote?.status || targetStatus

        const updated = await quoteService.update(id, {
          client: selectedClientId,
          items: cleanItems,
          discount_percent: Number(discountPercent) || 0,
          subtotal: Math.round(subtotal * 100) / 100,
          total: Math.round(total * 100) / 100,
          status: updatedStatus,
          observations: observations.trim() || undefined,
        })

        toast.success('Orçamento atualizado com sucesso!')
        navigate(`/orcamentos/${updated.id}`)
      } else {
        // Criação de novo orçamento
        const created = await quoteService.create(
          {
            client: selectedClientId,
            quote_number: quoteNumber,
            items: cleanItems,
            discount_percent: Number(discountPercent) || 0,
            subtotal: Math.round(subtotal * 100) / 100,
            total: Math.round(total * 100) / 100,
            status: targetStatus,
            observations: observations.trim() || undefined,
          },
          userName,
        )

        toast.success(
          targetStatus === 'Enviado'
            ? 'Orçamento criado e enviado com sucesso!'
            : 'Rascunho do orçamento salvo com sucesso!',
        )

        navigate(`/orcamentos/${created.id}`)
      }
    } catch (err: unknown) {
      console.error('Erro ao salvar orçamento:', err)
      toast.error('Erro ao salvar a proposta comercial. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <Loader2 className="h-8 w-8 animate-spin text-[#1E3A5F]" />
          <p className="text-sm">Carregando dados da proposta...</p>
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
            {isEditing ? 'Edição de Proposta' : 'Nova Proposta Comercial'}
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {isEditing ? 'Editar Orçamento' : 'Elaboração de Orçamento'}
          </h1>
        </div>

        {/* Número sequencial em destaque */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[11px] font-semibold text-slate-400 block uppercase">
              Número Sequencial
            </span>
            <span className="font-mono text-2xl font-extrabold text-[#1E3A5F]">
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
                          c.id === selectedClientId ? 'bg-blue-50 font-semibold text-[#1E3A5F]' : ''
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
                          <CheckCircle className="h-4 w-4 text-[#1E3A5F] shrink-0" />
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
                Atenção: Selecione um cliente cadastrado acima ou utilize o botão &quot;Novo
                cliente&quot; para cadastrar rapidamente.
              </p>
            )}
          </div>

          {/* Seção 2: Itens do Orçamento */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                2. Itens do Orçamento <span className="text-red-500">*</span>
              </h2>
              <span className="text-xs text-slate-400">{items.length} item(ns) adicionado(s)</span>
            </div>

            {/* Lista de itens dinâmicos */}
            <div className="space-y-3">
              {items.map((item, index) => {
                const itemSubtotal = (Number(item.quantity) || 0) * (Number(item.unit_price) || 0)

                return (
                  <div
                    key={index}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-bold text-slate-500">Item #{index + 1}</span>
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

                    {/* Descrição */}
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold text-slate-600">
                        Descrição do produto ou serviço
                      </Label>
                      <Input
                        placeholder="Ex: Armário sob medida em MDF 18mm com dobradiças amortecedoras"
                        value={item.description}
                        onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                        className="bg-white text-xs sm:text-sm h-10"
                      />
                    </div>

                    {/* Quantidade, Unidade, Preço Unitário e Subtotal */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
                            <SelectItem value="un">un (unidade)</SelectItem>
                            <SelectItem value="m²">m² (metro quadrado)</SelectItem>
                            <SelectItem value="m">m (metro linear)</SelectItem>
                            <SelectItem value="kit">kit</SelectItem>
                            <SelectItem value="hora">hora</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[11px] font-semibold text-slate-600">
                          Valor Unitário (R$)
                        </Label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-semibold">
                            R$
                          </span>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unit_price}
                            onChange={(e) =>
                              handleItemChange(index, 'unit_price', parseFloat(e.target.value) || 0)
                            }
                            className="bg-white pl-8 text-xs sm:text-sm h-10 font-mono"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[11px] font-semibold text-slate-600">Subtotal</Label>
                        <div className="h-10 rounded-md bg-slate-100 flex items-center px-3 font-mono text-xs sm:text-sm font-bold text-slate-900">
                          {formatCurrencyBRL(itemSubtotal)}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Botão Adicionar Item */}
            <button
              type="button"
              onClick={handleAddItem}
              className="w-full py-3 border-2 border-dashed border-slate-200 hover:border-[#1E3A5F] hover:bg-blue-50/40 rounded-xl text-xs font-semibold text-slate-600 hover:text-[#1E3A5F] flex items-center justify-center gap-2 transition-all"
            >
              <Plus className="h-4 w-4 text-amber-500" />
              Adicionar Novo Item
            </button>
          </div>

          {/* Seção 4: Observações e Condições Comerciais */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              3. Condições Comerciais & Observações
            </h2>
            <Textarea
              rows={4}
              placeholder="Ex: Prazo de entrega: 20 dias úteis. Condições de pagamento: 40% na aprovação e saldo em 30/60 dias. Montagem e frete inclusos."
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              className="text-xs sm:text-sm"
            />
          </div>
        </div>

        {/* Resumo Lateral Fixo: 4 colunas desktop */}
        <div className="lg:col-span-4 sticky top-24 space-y-5">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider pb-2 border-b border-slate-100">
              Resumo Financeiro
            </h2>

            <div className="space-y-3 text-xs sm:text-sm">
              <div className="flex justify-between items-center text-slate-600">
                <span>Subtotal dos itens</span>
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

              {/* Total Geral em Destaque */}
              <div className="pt-4 border-t-2 border-slate-200 space-y-1">
                <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <span>Total da Proposta</span>
                  <span>BRL</span>
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-[#1E3A5F] font-mono tracking-tight transition-all duration-200">
                  {formatCurrencyBRL(total)}
                </div>
              </div>
            </div>

            {/* Ações de salvamento */}
            <div className="pt-4 border-t border-slate-100 space-y-2.5">
              <Button
                type="button"
                onClick={() => handleSave('Enviado')}
                disabled={saving}
                className="w-full h-11 bg-[#1E3A5F] hover:bg-[#2A4E7A] text-white font-semibold text-xs sm:text-sm rounded-xl shadow-sm transition-all duration-200 hover:scale-[1.02]"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4 text-amber-400" />
                    Salvar e Enviar
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

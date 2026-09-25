import React, { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  PhoneCall,
  MessageCircle,
  Mail,
  Users,
  MoreHorizontal,
  Plus,
  ArrowLeft,
  Calendar,
  Clock,
  User,
  Building,
  AlertTriangle,
  CheckCircle,
  FileText,
  Loader2,
  Trash2,
  Edit2,
  Send,
  PhoneForwarded,
  ShieldAlert,
  HelpCircle,
} from 'lucide-react'
import { quoteService } from '@/services/quotes'
import { followupService, getFollowupStatus } from '@/services/followups'
import { useAuth } from '@/contexts/AuthContext'
import { useRealtime } from '@/hooks/use-realtime'
import type { QuoteRecord, FollowupRecord, FollowupContactType } from '@/types'
import {
  formatCurrencyBRL,
  formatDateBR,
  formatDateTimeBR,
  formatQuoteNumber,
  formatOrderNumber,
} from '@/types'
import { canViewValues, canManageRecord } from '@/lib/permissions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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

const CONTACT_TYPES: { type: FollowupContactType; icon: React.ElementType; color: string }[] = [
  { type: 'Ligação', icon: PhoneCall, color: 'text-blue-600 bg-blue-50 border-blue-200' },
  {
    type: 'WhatsApp',
    icon: MessageCircle,
    color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
  },
  { type: 'E-mail', icon: Mail, color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
  { type: 'Reunião', icon: Users, color: 'text-purple-600 bg-purple-50 border-purple-200' },
  { type: 'Outros', icon: MoreHorizontal, color: 'text-slate-600 bg-slate-50 border-slate-200' },
]

export default function QuoteFollowup() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isAdmin = user?.role === 'Administrador'

  const [quote, setQuote] = useState<QuoteRecord | null>(null)
  const [followups, setFollowups] = useState<FollowupRecord[]>([])
  const [loading, setLoading] = useState(true)

  // Modal de Novo/Editar Contato
  const [modalOpen, setModalOpen] = useState(false)
  const [editingFollowup, setEditingFollowup] = useState<FollowupRecord | null>(null)
  const [contactType, setContactType] = useState<FollowupContactType>('Ligação')
  const [contactDate, setContactDate] = useState(() => {
    const now = new Date()
    // Formato YYYY-MM-DDTHH:mm para input datetime-local
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`
  })
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Modal de Exclusão
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadData = async () => {
    if (!id) return
    try {
      const [quoteData, followupsList] = await Promise.all([
        quoteService.getById(id),
        followupService.getByQuote(id),
      ])
      setQuote(quoteData)
      setFollowups(followupsList)
    } catch (err) {
      console.error('Erro ao carregar follow-ups do orçamento:', err)
      toast.error('Erro ao carregar dados do orçamento.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [id])

  // Realtime para followups e quotes
  useRealtime<FollowupRecord>('followups', () => {
    if (id) {
      followupService
        .getByQuote(id)
        .then(setFollowups)
        .catch(() => {})
    }
  })

  // Status de follow-up / retorno calculado
  const followupInfo = useMemo(() => {
    if (!quote) {
      return { isPendingReturn: false, daysElapsed: 0, reason: '' }
    }
    return getFollowupStatus(quote, followups)
  }, [quote, followups])

  // Checagem de permissão: Vendedor só gerencia orçamentos próprios
  const isAllowed = quote ? canManageRecord(quote, user) : false
  const canSeeValues = quote ? canViewValues(quote, user) : false

  const handleOpenNewModal = () => {
    setEditingFollowup(null)
    setContactType('Ligação')
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    setContactDate(
      `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`,
    )
    setNotes('')
    setModalOpen(true)
  }

  const handleOpenEditModal = (f: FollowupRecord) => {
    // Permissão: apenas autor ou administrador
    if (!isAdmin && f.author !== user?.id) {
      toast.error('Você só pode editar contatos registrados por você.')
      return
    }
    setEditingFollowup(f)
    setContactType(f.contact_type)
    if (f.contact_date) {
      const d = new Date(f.contact_date)
      const pad = (n: number) => String(n).padStart(2, '0')
      setContactDate(
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`,
      )
    }
    setNotes(f.notes)
    setModalOpen(true)
  }

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id || !notes.trim()) {
      toast.error('Por favor, descreva as observações do contato.')
      return
    }

    setSubmitting(true)
    try {
      const isoDate = new Date(contactDate).toISOString()
      if (editingFollowup) {
        await followupService.update(editingFollowup.id, {
          contact_type: contactType,
          contact_date: isoDate,
          notes: notes.trim(),
        })
        toast.success('Contato de follow-up atualizado!')
      } else {
        await followupService.create({
          quote: id,
          contact_type: contactType,
          contact_date: isoDate,
          notes: notes.trim(),
          author: user?.id,
          author_name: user?.name || 'Vendedor',
        })
        toast.success('Novo contato de follow-up registrado!')
      }
      setModalOpen(false)
      await loadData()
    } catch (err) {
      console.error('Erro ao salvar follow-up:', err)
      toast.error('Não foi possível salvar o contato de follow-up.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteContact = async () => {
    if (!deleteConfirmId) return
    setDeleting(true)
    try {
      await followupService.delete(deleteConfirmId)
      toast.success('Registro de contato excluído com sucesso.')
      setDeleteConfirmId(null)
      await loadData()
    } catch (err) {
      console.error('Erro ao excluir follow-up:', err)
      toast.error('Erro ao excluir contato de follow-up.')
    } finally {
      setDeleting(false)
    }
  }

  const getContactIcon = (type: FollowupContactType) => {
    switch (type) {
      case 'Ligação':
        return <PhoneCall className="h-4 w-4" />
      case 'WhatsApp':
        return <MessageCircle className="h-4 w-4" />
      case 'E-mail':
        return <Mail className="h-4 w-4" />
      case 'Reunião':
        return <Users className="h-4 w-4" />
      default:
        return <MoreHorizontal className="h-4 w-4" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Aprovado':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            Aprovado
          </span>
        )
      case 'Enviado':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            Enviado
          </span>
        )
      case 'Rejeitado':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">
            Rejeitado
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
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
          <p className="text-sm">Carregando histórico de follow-up...</p>
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

  // Regra de confidencialidade: se não tem permissão para gerenciar e não é admin
  if (!isAllowed) {
    return (
      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-xs max-w-xl mx-auto my-12 text-center space-y-4">
        <div className="h-14 w-14 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-slate-900">Acesso Restrito</h2>
          <p className="text-sm text-slate-500">
            Este orçamento pertence a outro vendedor. Pelas políticas de segurança da Corteplan,
            apenas o autor da proposta ou Administradores podem consultar e registrar follow-ups.
          </p>
        </div>
        <div className="pt-2">
          <Button
            onClick={() => navigate('/orcamentos')}
            className="bg-[#3A3A3C] hover:bg-[#2E2E30] text-white rounded-xl"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar para Orçamentos
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in-50 duration-200">
      {/* Barra de Navegação Superior */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/orcamentos')}
            className="rounded-xl border-slate-200 hover:bg-slate-100"
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Orçamentos
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-sm bg-slate-100 text-[#3A3A3C] px-2.5 py-0.5 rounded-lg border border-slate-200">
                {formatQuoteNumber(quote.quote_number, quote.revision)}
              </span>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Controle de Follow-up
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Acompanhamento de contatos, negociação e retorno da proposta comercial.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            asChild
            className="rounded-xl border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold"
          >
            <Link to={`/orcamentos/${quote.id}`}>
              <FileText className="h-4 w-4 mr-1.5 text-slate-500" />
              Ver Proposta Completa
            </Link>
          </Button>

          <Button
            onClick={handleOpenNewModal}
            className="rounded-xl bg-[#E66812] hover:bg-[#F08A24] text-white font-semibold shadow-sm transition-all duration-200 hover:scale-[1.02] text-xs"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Registrar Novo Contato
          </Button>
        </div>
      </div>

      {/* Card de Aviso / Destaque de Regra de Negócio */}
      {followupInfo.isPendingReturn ? (
        <div className="rounded-2xl bg-amber-500/10 border-2 border-[#F08A24] p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="h-11 w-11 rounded-xl bg-[#F08A24] text-white flex items-center justify-center shrink-0 shadow-sm animate-pulse">
              <PhoneForwarded className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-sm sm:text-base text-amber-950">
                  Aviso: Pendente de Retorno com o Cliente!
                </span>
                <Badge className="bg-[#E66812] text-white text-[10px] font-bold px-2 py-0.5">
                  &gt; 2 dias sem retorno
                </Badge>
              </div>
              <p className="text-xs sm:text-sm text-amber-900/90 mt-1 leading-relaxed">
                Este orçamento está com status <strong className="underline">{quote.status}</strong>{' '}
                há mais de <strong>{followupInfo.daysElapsed} dias</strong> sem retorno recente do
                cliente. Ligue ou envie uma mensagem para saber o que ele achou da proposta e dar
                sequência ao fechamento!
              </p>
            </div>
          </div>

          <Button
            onClick={handleOpenNewModal}
            className="bg-[#3A3A3C] hover:bg-[#2D2D2F] text-white font-semibold rounded-xl text-xs shrink-0 self-start sm:self-center"
          >
            <PhoneCall className="h-4 w-4 mr-1.5 text-amber-400" />
            Fazer contato agora
          </Button>
        </div>
      ) : (
        <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-2xs flex items-center justify-between gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-2.5">
            <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
            <span>
              <strong>Status de Acompanhamento:</strong> {followupInfo.reason}.
              {quote.status === 'Enviado' &&
                ' Quando atingir 2 dias sem contato, o aviso "Pendente de retorno" será exibido automaticamente.'}
            </span>
          </div>
          <span className="text-[11px] text-slate-400 hidden md:inline">
            Regra Corteplan de 48h
          </span>
        </div>
      )}

      {/* Grid de Resumo da Proposta (Cliente, Vendedor, Valor, Status) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Cliente */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[11px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1">
            <Building className="h-3.5 w-3.5 text-slate-400" />
            Cliente / Contato
          </span>
          <div className="font-bold text-sm text-slate-900 truncate">
            {quote.expand?.client?.name || 'Cliente não identificado'}
          </div>
          {quote.expand?.client?.company && (
            <div className="text-xs text-slate-500 truncate">{quote.expand.client.company}</div>
          )}
          {quote.expand?.client?.phone && (
            <div className="text-xs text-slate-600 pt-1 font-mono">
              Tel: {quote.expand.client.phone}
            </div>
          )}
        </div>

        {/* Vendedor / Emissão */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[11px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1">
            <User className="h-3.5 w-3.5 text-slate-400" />
            Vendedor Responsável
          </span>
          <div className="font-bold text-sm text-slate-900 truncate">
            {quote.seller || quote.expand?.seller_user?.name || 'Gustavo Tibério'}
          </div>
          <div className="text-xs text-slate-500 flex items-center gap-1 pt-0.5">
            <Calendar className="h-3 w-3" />
            Emitido em: {formatDateBR(quote.created)}
          </div>
        </div>

        {/* Valor da Proposta */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[11px] uppercase font-bold tracking-wider text-slate-400">
            Valor da Proposta
          </span>
          <div className="font-mono font-extrabold text-base sm:text-lg text-slate-900">
            {canSeeValues ? formatCurrencyBRL(quote.total) : 'Confidencial'}
          </div>
          <div className="text-xs text-slate-500">
            {quote.items?.length || 0} item(ns) orçado(s)
          </div>
        </div>

        {/* Status Atual */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1 flex flex-col justify-between">
          <span className="text-[11px] uppercase font-bold tracking-wider text-slate-400">
            Status do Orçamento
          </span>
          <div>{getStatusBadge(quote.status)}</div>
          {quote.order_number ? (
            <div className="text-xs font-mono font-semibold text-[#E66812]">
              Pedido: {formatOrderNumber(quote.order_number)}
            </div>
          ) : (
            <div className="text-[11px] text-slate-400">Ainda não gerou pedido</div>
          )}
        </div>
      </div>

      {/* Linha do Tempo de Contatos */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Linha do Tempo de Contatos ({followups.length})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Histórico de tentativas e contatos com o cliente para acompanhamento da proposta.
            </p>
          </div>
          <Button
            size="sm"
            onClick={handleOpenNewModal}
            className="rounded-xl bg-[#3A3A3C] hover:bg-[#2D2D2F] text-white text-xs font-medium"
          >
            <Plus className="h-3.5 w-3.5 mr-1 text-amber-400" />
            Novo Registro
          </Button>
        </div>

        {followups.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-3 bg-slate-50/60 rounded-xl border border-dashed border-slate-200">
            <div className="h-12 w-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
              <PhoneCall className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-800">
                Nenhum contato de follow-up registrado ainda
              </h3>
              <p className="text-xs text-slate-500 max-w-sm">
                Registre cada ligação, mensagem de WhatsApp ou e-mail trocado com o cliente para não
                perder o prazo de retorno.
              </p>
            </div>
            <Button
              onClick={handleOpenNewModal}
              className="bg-[#E66812] hover:bg-[#F08A24] text-white rounded-xl text-xs font-semibold"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Registrar Primeiro Contato
            </Button>
          </div>
        ) : (
          <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
            {followups.map((f) => {
              const contactInfo =
                CONTACT_TYPES.find((c) => c.type === f.contact_type) || CONTACT_TYPES[4]
              const isAuthor = f.author === user?.id
              const canEditThis = isAdmin || isAuthor

              return (
                <div key={f.id} className="relative group">
                  {/* Ponto / Ícone na Linha do Tempo */}
                  <div
                    className={`absolute -left-6 sm:-left-8 top-1 h-7 w-7 rounded-full flex items-center justify-center border shadow-2xs ${contactInfo.color} ring-4 ring-white`}
                    title={f.contact_type}
                  >
                    {getContactIcon(f.contact_type)}
                  </div>

                  {/* Card do Contato */}
                  <div className="bg-slate-50/80 hover:bg-slate-50 rounded-xl p-4 border border-slate-200/90 transition-all duration-150 space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 pb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${contactInfo.color}`}
                        >
                          {getContactIcon(f.contact_type)}
                          {f.contact_type}
                        </span>

                        <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
                          <Clock className="h-3 w-3 text-slate-400" />
                          {formatDateTimeBR(f.contact_date || f.created)}
                        </span>

                        <span className="text-xs text-slate-400">•</span>

                        <span className="text-xs text-slate-600 font-medium flex items-center gap-1">
                          <User className="h-3 w-3 text-slate-400" />
                          Registrado por:{' '}
                          <strong>
                            {f.author_name || f.expand?.author?.name || 'Colaborador'}
                          </strong>
                          {isAuthor && (
                            <Badge variant="outline" className="text-[10px] py-0 px-1 font-normal">
                              Você
                            </Badge>
                          )}
                        </span>
                      </div>

                      {canEditThis && (
                        <div className="flex items-center gap-1 self-end sm:self-auto">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenEditModal(f)}
                            className="h-7 w-7 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg"
                            title="Editar observações"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteConfirmId(f.id)}
                            className="h-7 w-7 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
                            title="Excluir contato"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Observação / Descrição da conversa */}
                    <p className="text-xs sm:text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                      {f.notes}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal: Novo / Editar Contato de Follow-up */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <div className="h-10 w-10 rounded-full bg-orange-100 text-[#E66812] flex items-center justify-center mb-1">
              <PhoneCall className="h-5 w-5" />
            </div>
            <DialogTitle className="text-base font-bold text-slate-900">
              {editingFollowup ? 'Editar Contato de Follow-up' : 'Registrar Contato de Follow-up'}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              {formatQuoteNumber(quote.quote_number, quote.revision)} &bull;{' '}
              {quote.expand?.client?.name || 'Cliente'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveContact} className="space-y-4 pt-2">
            {/* Tipo de Contato */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Tipo de Contato *</Label>
              <Select
                value={contactType}
                onValueChange={(val) => setContactType(val as FollowupContactType)}
              >
                <SelectTrigger className="text-xs sm:text-sm rounded-xl">
                  <SelectValue placeholder="Selecione o canal" />
                </SelectTrigger>
                <SelectContent>
                  {CONTACT_TYPES.map((c) => (
                    <SelectItem key={c.type} value={c.type}>
                      <span className="flex items-center gap-2">
                        {React.createElement(c.icon, { className: 'h-4 w-4' })}
                        {c.type}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Data e Hora do Contato */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Data e Hora *</Label>
              <Input
                type="datetime-local"
                value={contactDate}
                onChange={(e) => setContactDate(e.target.value)}
                required
                className="text-xs sm:text-sm rounded-xl"
              />
            </div>

            {/* Observações / Resumo da Conversa */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">
                Observações do Contato *
              </Label>
              <Textarea
                placeholder="Ex: Liguei para o cliente, ele aprovou o escopo técnico porém pediu um prazo maior no pagamento. Combinou de retornar amanhã."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                required
                className="text-xs sm:text-sm rounded-xl resize-none"
              />
              <p className="text-[11px] text-slate-400">
                Descreva com clareza o retorno dado pelo cliente para que toda a equipe fique
                alinhada.
              </p>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
                disabled={submitting}
                className="rounded-xl"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="rounded-xl bg-[#3A3A3C] hover:bg-[#2D2D2F] text-white font-medium"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar Contato'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de Confirmação de Exclusão */}
      <Dialog
        open={Boolean(deleteConfirmId)}
        onOpenChange={(open) => !open && setDeleteConfirmId(null)}
      >
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              Excluir registro de contato?
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Esta ação removerá este contato do histórico de follow-up do orçamento. Tem certeza
              que deseja continuar?
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0 pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteConfirmId(null)}
              disabled={deleting}
              className="rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteContact}
              disabled={deleting}
              className="rounded-xl"
            >
              {deleting ? 'Excluindo...' : 'Sim, excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

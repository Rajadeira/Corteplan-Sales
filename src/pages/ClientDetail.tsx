import React, { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Edit,
  PlusCircle,
  Phone,
  Mail,
  Building,
  MapPin,
  Calendar,
  FileText,
  Loader2,
  ExternalLink,
  Lock,
} from 'lucide-react'
import { clientService } from '@/services/clients'
import { quoteService } from '@/services/quotes'
import { useAuth } from '@/contexts/AuthContext'
import { canViewValues } from '@/lib/permissions'
import type { ClientRecord, QuoteRecord } from '@/types'
import { formatCurrencyBRL, formatDateBR, formatQuoteNumber, maskPhoneBR } from '@/types'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import ClientModal from '@/components/ClientModal'
import { toast } from 'sonner'

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [client, setClient] = useState<ClientRecord | null>(null)
  const [quotes, setQuotes] = useState<QuoteRecord[]>([])
  const [loading, setLoading] = useState(true)

  // Edit modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)

  const loadClientData = async () => {
    if (!id) return
    try {
      const [cData, qList] = await Promise.all([
        clientService.getById(id),
        quoteService.getByClientId(id),
      ])
      setClient(cData)
      setQuotes(qList)
    } catch (err) {
      console.error('Erro ao carregar cliente:', err)
      toast.error('Cliente não encontrado ou erro de conexão.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadClientData()
  }, [id])

  const getInitials = (name?: string) => {
    if (!name) return 'CL'
    const parts = name.trim().split(' ')
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }

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

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <Loader2 className="h-8 w-8 animate-spin text-[#3A3A3C]" />
          <p className="text-sm">Carregando detalhes do cliente...</p>
        </div>
      </div>
    )
  }

  if (!client) {
    return (
      <div className="text-center py-16 space-y-4">
        <h2 className="text-xl font-bold text-slate-800">Cliente não encontrado</h2>
        <p className="text-xs text-slate-500">O cliente solicitado pode ter sido excluído.</p>
        <Button onClick={() => navigate('/clientes')} variant="outline" className="rounded-xl">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar para Clientes
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* Botão de retorno */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/clientes')}
          className="text-slate-600 hover:text-slate-900 -ml-2 rounded-xl"
        >
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Voltar para a lista de clientes
        </Button>
      </div>

      {/* Header com Avatar Grande e Informações Principais */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <Avatar className="h-20 w-20 ring-4 ring-slate-100 bg-[#3A3A3C] text-[#F08A24] font-bold text-2xl shadow-sm">
            <AvatarFallback className="bg-[#3A3A3C] text-[#F08A24] font-bold text-2xl">
              {getInitials(client.name)}
            </AvatarFallback>
          </Avatar>

          <div className="space-y-1.5">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{client.name}</h1>
              {client.company && (
                <Badge
                  variant="secondary"
                  className="text-xs font-medium bg-slate-100 text-slate-700"
                >
                  <Building className="h-3 w-3 mr-1 text-slate-500" />
                  {client.company}
                </Badge>
              )}
              {client.document_number && (
                <Badge
                  variant="outline"
                  className="text-xs font-medium border-slate-300 text-slate-700 bg-white"
                >
                  {client.document_type || 'DOC'}: {client.document_number}
                </Badge>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 pt-1">
              <div className="flex items-center gap-1.5 font-medium">
                <Phone className="h-3.5 w-3.5 text-slate-400" />
                <span>{maskPhoneBR(client.phone)}</span>
              </div>
              {client.email && (
                <div className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-slate-400" />
                  <span>{client.email}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 text-slate-400">
                <Calendar className="h-3.5 w-3.5" />
                <span>Cadastrado em {formatDateBR(client.created)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 self-start md:self-auto shrink-0">
          <Button
            variant="outline"
            onClick={() => setIsEditModalOpen(true)}
            className="rounded-xl border-slate-300 hover:bg-slate-50 text-slate-700 font-medium"
          >
            <Edit className="h-4 w-4 mr-1.5 text-amber-600" />
            Editar Cliente
          </Button>

          <Button
            onClick={() => navigate('/orcamentos/novo', { state: { clientId: client.id } })}
            className="rounded-xl bg-[#3A3A3C] hover:bg-[#2D2D2F] text-white font-medium shadow-sm transition-all duration-200 hover:scale-[1.02]"
          >
            <PlusCircle className="h-4 w-4 mr-1.5 text-amber-400" />
            Novo Orçamento para este Cliente
          </Button>
        </div>
      </div>

      {/* Grid de Informações Complementares e Lista de Orçamentos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna 1: Informações Complementares */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider text-xs">
              Endereço e Localização
            </h2>
            <div className="space-y-3 text-xs text-slate-600">
              <div className="flex items-start gap-2.5">
                <MapPin className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-slate-800">
                    {client.address || 'Endereço não informado'}
                  </div>
                  {client.neighborhood && (
                    <div className="text-slate-600 mt-0.5">Bairro: {client.neighborhood}</div>
                  )}
                  <div className="text-slate-500 mt-0.5">
                    {client.city || 'Cidade não informada'}{' '}
                    {client.zip_code ? `• CEP ${client.zip_code}` : ''}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider text-xs">
              Observações Comerciais
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-100">
              {client.notes || 'Nenhuma observação interna cadastrada para este cliente.'}
            </p>
          </div>
        </div>

        {/* Coluna 2 e 3: Orçamentos do Cliente */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Histórico de Propostas do Cliente
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {quotes.length} orçamento(s) vinculado(s) a este cadastro.
              </p>
            </div>

            <Button
              asChild
              variant="outline"
              size="sm"
              className="rounded-xl border-slate-200 text-xs"
            >
              <Link to="/orcamentos/novo" state={{ clientId: client.id }}>
                <PlusCircle className="h-3.5 w-3.5 mr-1 text-amber-500" />
                Criar Proposta
              </Link>
            </Button>
          </div>

          {quotes.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <FileText className="h-10 w-10 text-slate-300 mx-auto" />
              <p className="text-xs text-slate-500">
                Nenhum orçamento emitido para este cliente ainda.
              </p>
              <Button
                onClick={() => navigate('/orcamentos/novo', { state: { clientId: client.id } })}
                className="rounded-xl bg-[#3A3A3C] hover:bg-[#2D2D2F] text-white text-xs h-9"
              >
                Criar primeiro orçamento
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {quotes.map((q) => (
                <div
                  key={q.id}
                  onClick={() => navigate(`/orcamentos/${q.id}`)}
                  className="flex items-center justify-between py-3.5 px-3 -mx-3 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer group"
                >
                  <div className="space-y-1 min-w-0 pr-4">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-[#3A3A3C] group-hover:text-[#F08A24]">
                        {formatQuoteNumber(q.quote_number)}
                      </span>
                      {getStatusBadge(q.status)}
                    </div>
                    <div className="text-xs text-slate-500 flex items-center gap-3">
                      <span>Emissão: {formatDateBR(q.created)}</span>
                      <span>&bull;</span>
                      <span>{q.items?.length || 0} item(ns)</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    {canViewValues(q, user) ? (
                      <span className="font-mono text-sm font-bold text-slate-900">
                        {formatCurrencyBRL(q.total)}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-mono font-semibold text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                        <Lock className="h-3 w-3" /> Confidencial
                      </span>
                    )}
                    <ExternalLink className="h-4 w-4 text-slate-400 group-hover:text-slate-700 transition-colors" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal de Edição */}
      <ClientModal
        open={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        clientToEdit={client}
        onSuccess={() => loadClientData()}
      />
    </div>
  )
}

import React, { useState, useEffect } from 'react'
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  Edit,
  Printer,
  CheckCircle,
  XCircle,
  Send,
  Building,
  Phone,
  Mail,
  Calendar,
  Clock,
  Loader2,
  Armchair,
  FileText,
} from 'lucide-react'
import { quoteService } from '@/services/quotes'
import { useAuth } from '@/contexts/AuthContext'
import type { QuoteRecord, QuoteStatus } from '@/types'
import {
  formatCurrencyBRL,
  formatDateBR,
  formatDateTimeBR,
  formatQuoteNumber,
  maskPhoneBR,
} from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

export default function QuoteDetail() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [quote, setQuote] = useState<QuoteRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [statusLoading, setStatusLoading] = useState(false)

  const loadQuote = async () => {
    if (!id) return
    try {
      const data = await quoteService.getById(id)
      setQuote(data)
    } catch (err) {
      console.error('Erro ao carregar orçamento:', err)
      toast.error('Orçamento não encontrado.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadQuote()
  }, [id])

  // Trigger print if ?print=true is present in query parameters
  useEffect(() => {
    if (searchParams.get('print') === 'true' && quote && !loading) {
      setTimeout(() => {
        window.print()
      }, 500)
    }
  }, [searchParams, quote, loading])

  // Atualização de status
  const handleUpdateStatus = async (newStatus: QuoteStatus) => {
    if (!id || !quote) return
    setStatusLoading(true)
    try {
      const userName = user?.name || 'Administrador'
      const updated = await quoteService.updateStatus(id, newStatus, userName)
      setQuote(updated)
      toast.success(`Status atualizado para "${newStatus}"!`)
    } catch (err: unknown) {
      console.error('Erro ao atualizar status:', err)
      toast.error('Erro ao atualizar status do orçamento.')
    } finally {
      setStatusLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Aprovado':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            Aprovado
          </span>
        )
      case 'Enviado':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
            Enviado
          </span>
        )
      case 'Rejeitado':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-300">
            Rejeitado
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">
            Rascunho
          </span>
        )
    }
  }

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <Loader2 className="h-8 w-8 animate-spin text-[#1E3A5F]" />
          <p className="text-sm">Carregando detalhes do orçamento...</p>
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

  const client = quote.expand?.client
  const discountAmount = (quote.subtotal * (quote.discount_percent || 0)) / 100

  return (
    <div className="space-y-6 pb-16">
      {/* Botão de retorno (Escondido em impressão) */}
      <div className="print:hidden">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/orcamentos')}
          className="text-slate-600 hover:text-slate-900 -ml-2 rounded-xl"
        >
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Voltar para a lista de orçamentos
        </Button>
      </div>

      {/* Header Interativo (Escondido na impressão) */}
      <div className="print:hidden bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="font-mono text-3xl font-extrabold text-[#1E3A5F] tracking-tight">
              {formatQuoteNumber(quote.quote_number)}
            </span>
            {getStatusBadge(quote.status)}
          </div>
          <p className="text-xs text-slate-500">
            Emitido em {formatDateBR(quote.created)} &bull; Atualizado em{' '}
            {formatDateBR(quote.updated)}
          </p>
        </div>

        <div className="flex items-center gap-3 self-start md:self-auto shrink-0">
          <Button
            variant="outline"
            onClick={() => navigate(`/orcamentos/${quote.id}/editar`)}
            className="rounded-xl border-slate-300 text-slate-700 hover:bg-slate-50 font-medium"
          >
            <Edit className="h-4 w-4 mr-1.5 text-amber-600" />
            Editar
          </Button>

          <Button
            onClick={() => window.print()}
            className="rounded-xl bg-[#1E3A5F] hover:bg-[#2A4E7A] text-white font-medium shadow-sm transition-all duration-200 hover:scale-[1.02]"
          >
            <Printer className="h-4 w-4 mr-1.5 text-amber-400" />
            Imprimir / Salvar PDF
          </Button>
        </div>
      </div>

      {/* Painel de Gestão de Ciclo de Vida do Status (Escondido na impressão) */}
      <div className="print:hidden bg-slate-900 text-white p-6 rounded-2xl shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block">
            Gestão de Ciclo de Vida
          </span>
          <h3 className="text-base font-bold text-white mt-0.5">
            Alterar status comercial desta proposta
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Cada mudança atualiza automaticamente a linha do tempo com data, hora e responsável.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {quote.status === 'Rascunho' && (
            <Button
              size="sm"
              disabled={statusLoading}
              onClick={() => handleUpdateStatus('Enviado')}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold"
            >
              <Send className="h-3.5 w-3.5 mr-1.5" />
              Enviar ao Cliente
            </Button>
          )}

          {quote.status !== 'Aprovado' && (
            <Button
              size="sm"
              disabled={statusLoading}
              onClick={() => handleUpdateStatus('Aprovado')}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold"
            >
              <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
              Marcar como Aprovado
            </Button>
          )}

          {quote.status !== 'Rejeitado' && (
            <Button
              size="sm"
              disabled={statusLoading}
              onClick={() => handleUpdateStatus('Rejeitado')}
              className="bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold"
            >
              <XCircle className="h-3.5 w-3.5 mr-1.5" />
              Marcar como Rejeitado
            </Button>
          )}
        </div>
      </div>

      {/* Grid Principal: Dados do Orçamento + Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Documento Principal: 8 colunas (12 colunas em impressão) */}
        <div className="lg:col-span-8 print:lg:col-span-12 space-y-6">
          {/* Card do Cliente */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Dados do Cliente
              </h3>
              {client && (
                <Link
                  to={`/clientes/${client.id}`}
                  className="text-xs font-semibold text-[#1E3A5F] hover:underline print:hidden"
                >
                  Ver cadastro completo &rarr;
                </Link>
              )}
            </div>

            {client ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm">
                <div>
                  <span className="text-[11px] text-slate-400 block">Nome do Cliente</span>
                  <span className="font-bold text-slate-900 text-base">{client.name}</span>
                  {client.company && (
                    <span className="text-slate-600 block mt-0.5">{client.company}</span>
                  )}
                </div>

                <div className="space-y-1 text-slate-600">
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 text-slate-400" />
                    <span>{maskPhoneBR(client.phone)}</span>
                  </div>
                  {client.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5 text-slate-400" />
                      <span>{client.email}</span>
                    </div>
                  )}
                  {client.address && (
                    <div className="text-slate-500 pt-1">
                      {client.address} {client.city ? `• ${client.city}` : ''}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500">Dados do cliente não vinculados.</p>
            )}
          </div>

          {/* Tabela de Itens */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Especificação dos Itens
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Descrição Técnica</th>
                    <th className="py-2.5 px-3 text-center">Qtd.</th>
                    <th className="py-2.5 px-3 text-center">Un.</th>
                    <th className="py-2.5 px-3 text-right">Valor Unit.</th>
                    <th className="py-2.5 px-3 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                  {quote.items?.map((item, index) => {
                    const itemSubtotal = (item.quantity || 0) * (item.unit_price || 0)
                    return (
                      <tr key={index} className="hover:bg-slate-50/70">
                        <td className="py-3 px-3 text-slate-400 font-mono text-xs">
                          {String(index + 1).padStart(2, '0')}
                        </td>
                        <td className="py-3 px-3 font-medium text-slate-900 max-w-sm">
                          {item.description}
                        </td>
                        <td className="py-3 px-3 text-center font-mono">{item.quantity}</td>
                        <td className="py-3 px-3 text-center text-slate-500">{item.unit}</td>
                        <td className="py-3 px-3 text-right font-mono text-slate-700">
                          {formatCurrencyBRL(item.unit_price)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                          {formatCurrencyBRL(itemSubtotal)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Resumo Financeiro */}
            <div className="pt-4 border-t border-slate-200 flex justify-end">
              <div className="w-full sm:w-72 space-y-2 text-xs sm:text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span className="font-mono font-semibold">
                    {formatCurrencyBRL(quote.subtotal)}
                  </span>
                </div>

                {quote.discount_percent > 0 && (
                  <div className="flex justify-between text-emerald-600 font-medium">
                    <span>Desconto ({quote.discount_percent}%)</span>
                    <span className="font-mono">- {formatCurrencyBRL(discountAmount)}</span>
                  </div>
                )}

                <div className="pt-2 border-t-2 border-slate-900 flex justify-between items-center">
                  <span className="font-bold text-slate-900 uppercase tracking-wider text-xs">
                    Total Geral
                  </span>
                  <span className="font-mono text-xl sm:text-2xl font-extrabold text-[#1E3A5F]">
                    {formatCurrencyBRL(quote.total)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Observações / Condições Comerciais */}
          {quote.observations && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Condições Comerciais & Observações
              </h3>
              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line bg-slate-50 p-4 rounded-xl border border-slate-100">
                {quote.observations}
              </p>
            </div>
          )}

          {/* Assinatura do Cliente para Impressão */}
          <div className="hidden print:block pt-16 mt-8 border-t border-slate-300">
            <div className="grid grid-cols-2 gap-12 text-center text-xs text-slate-600">
              <div>
                <div className="border-t border-slate-900 pt-2 font-semibold">
                  Mobiliário & Visual Ltda.
                </div>
                <div>Responsável Técnico Comercial</div>
              </div>
              <div>
                <div className="border-t border-slate-900 pt-2 font-semibold">
                  {client?.name || 'Cliente'}
                </div>
                <div>De Acordo / Assinatura de Aprovação</div>
              </div>
            </div>
          </div>
        </div>

        {/* Linha do Tempo de Status: 4 colunas (Escondido em impressão) */}
        <div className="lg:col-span-4 print:hidden space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 pb-2 border-b border-slate-100">
              Linha do Tempo de Status
            </h3>

            {!quote.status_history || quote.status_history.length === 0 ? (
              <p className="text-xs text-slate-400">Nenhum evento registrado.</p>
            ) : (
              <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                {quote.status_history.map((entry, index) => {
                  let dotColor = 'bg-slate-400'
                  if (entry.status === 'Aprovado') dotColor = 'bg-emerald-500'
                  if (entry.status === 'Enviado') dotColor = 'bg-amber-500'
                  if (entry.status === 'Rejeitado') dotColor = 'bg-red-500'

                  return (
                    <div key={index} className="relative group">
                      {/* Ponto indicador colorido na timeline */}
                      <span
                        className={`absolute -left-6 top-1 h-3.5 w-3.5 rounded-full border-2 border-white ring-2 ring-slate-100 ${dotColor}`}
                      />

                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-900">
                            Status: {entry.status}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                          <Clock className="h-3 w-3" />
                          <span>{formatDateTimeBR(entry.changed_at)}</span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Por:{' '}
                          <span className="font-medium text-slate-600">{entry.changed_by}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

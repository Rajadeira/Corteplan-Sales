import React, { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  FileText,
  Plus,
  Search,
  Eye,
  Edit,
  Printer,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Calendar,
  Building,
} from 'lucide-react'
import { quoteService } from '@/services/quotes'
import { useRealtime } from '@/hooks/use-realtime'
import type { QuoteRecord, QuoteStatus } from '@/types'
import { formatCurrencyBRL, formatDateBR, formatQuoteNumber } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

const statusList: { key: string; label: string }[] = [
  { key: 'Todos', label: 'Todos' },
  { key: 'Rascunho', label: 'Rascunho' },
  { key: 'Enviado', label: 'Enviado' },
  { key: 'Aprovado', label: 'Aprovado' },
  { key: 'Rejeitado', label: 'Rejeitado' },
]

export default function Quotes() {
  const navigate = useNavigate()
  const [quotes, setQuotes] = useState<QuoteRecord[]>([])
  const [loading, setLoading] = useState(true)

  // Filtros e busca
  const [statusFilter, setStatusFilter] = useState('Todos')
  const [search, setSearch] = useState('')

  // Paginação
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  const loadData = async () => {
    try {
      const allQuotes = await quoteService.getAll()
      setQuotes(allQuotes)
    } catch (err) {
      console.error('Erro ao listar orçamentos:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Inscrição em tempo real na coleção quotes
  useRealtime<QuoteRecord>('quotes', () => {
    loadData()
  })

  // Contagens por status para os pills
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      Todos: quotes.length,
      Rascunho: 0,
      Enviado: 0,
      Aprovado: 0,
      Rejeitado: 0,
    }
    for (const q of quotes) {
      if (counts[q.status] !== undefined) {
        counts[q.status]++
      }
    }
    return counts
  }, [quotes])

  // Filtragem combinada client-side (para experiência instantânea e flexível de busca)
  const filteredQuotes = useMemo(() => {
    return quotes.filter((q) => {
      // Filtro de status
      if (statusFilter !== 'Todos' && q.status !== statusFilter) {
        return false
      }

      // Busca por número, cliente, item ou observação
      if (search.trim()) {
        const clean = search.toLowerCase().trim()
        const numFormatted = formatQuoteNumber(q.quote_number).toLowerCase()
        const numRaw = String(q.quote_number)
        const clientName = (q.expand?.client?.name || '').toLowerCase()
        const clientCompany = (q.expand?.client?.company || '').toLowerCase()
        const obs = (q.observations || '').toLowerCase()
        const itemsText = (q.items || []).map((i) => i.description.toLowerCase()).join(' ')

        const matches =
          numFormatted.includes(clean) ||
          numRaw.includes(clean) ||
          clientName.includes(clean) ||
          clientCompany.includes(clean) ||
          obs.includes(clean) ||
          itemsText.includes(clean)

        if (!matches) return false
      }

      return true
    })
  }, [quotes, statusFilter, search])

  // Paginação client-side dos filtrados
  const totalPages = Math.ceil(filteredQuotes.length / itemsPerPage) || 1
  const paginatedQuotes = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredQuotes.slice(start, start + itemsPerPage)
  }, [filteredQuotes, currentPage, itemsPerPage])

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1)
  }, [statusFilter, search])

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

  return (
    <div className="space-y-6">
      {/* Header com Título e Botão Novo Orçamento */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Histórico de Orçamentos
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Gerencie propostas comerciais com numeração contínua e rastreabilidade total.
          </p>
        </div>

        <Button
          asChild
          className="rounded-xl bg-[#3A3A3C] hover:bg-[#2D2D2F] text-white font-medium shadow-sm transition-all duration-200 hover:scale-[1.02] shrink-0"
        >
          <Link to="/orcamentos/novo">
            <Plus className="h-4 w-4 mr-1.5 text-amber-400" />
            Novo Orçamento
          </Link>
        </Button>
      </div>

      {/* Barra de Filtros: Status Pills + Campo de Busca */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        {/* Horizontal Status Pills */}
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
                      ? 'bg-amber-400 text-slate-950 font-bold'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Busca por número, cliente ou item */}
        <div className="relative w-full lg:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            type="text"
            placeholder="Buscar número, cliente, item..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-3 h-9 text-xs sm:text-sm bg-slate-50 border-slate-200 rounded-xl"
          />
        </div>
      </div>

      {/* Conteúdo: Tabela Desktop / Cards Mobile */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-slate-500">
            <Loader2 className="h-8 w-8 animate-spin text-[#3A3A3C]" />
            <p className="text-sm">Carregando histórico de orçamentos...</p>
          </div>
        </div>
      ) : filteredQuotes.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-slate-200 text-center space-y-4">
          <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
            <FileText className="h-8 w-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-800">
              {search.trim() || statusFilter !== 'Todos'
                ? 'Nenhum orçamento encontrado com estes filtros'
                : 'Nenhum orçamento cadastrado ainda'}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm">
              {search.trim() || statusFilter !== 'Todos'
                ? 'Tente ajustar os filtros de status ou a busca por palavras-chave.'
                : 'Crie seu primeiro orçamento com cálculo de subtotais e numeração sequencial automática.'}
            </p>
          </div>
          {!(search.trim() || statusFilter !== 'Todos') && (
            <Button
              asChild
              className="rounded-xl bg-[#3A3A3C] hover:bg-[#2D2D2F] text-white font-medium"
            >
              <Link to="/orcamentos/novo">
                <Plus className="h-4 w-4 mr-1.5 text-amber-400" />
                Criar primeiro orçamento
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
                  <th className="py-3.5 px-4">Cliente / Razão</th>
                  <th className="py-3.5 px-4">Data de Emissão</th>
                  <th className="py-3.5 px-4">Valor Total</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                {paginatedQuotes.map((quote) => (
                  <tr
                    key={quote.id}
                    className="hover:bg-[#F1F5F9] transition-colors duration-150 group"
                  >
                    {/* Número sequencial formatado */}
                    <td className="py-3.5 px-5">
                      <Link
                        to={`/orcamentos/${quote.id}`}
                        className="inline-flex items-center gap-1.5 font-mono font-bold text-xs bg-slate-100 text-[#3A3A3C] px-2.5 py-1 rounded-lg border border-slate-200/80 group-hover:bg-[#3A3A3C] group-hover:text-white transition-colors"
                      >
                        {formatQuoteNumber(quote.quote_number)}
                      </Link>
                    </td>

                    {/* Cliente */}
                    <td className="py-3.5 px-4">
                      {quote.expand?.client ? (
                        <Link
                          to={`/clientes/${quote.expand.client.id}`}
                          className="font-semibold text-slate-900 group-hover:text-[#3A3A3C] hover:underline block truncate max-w-xs"
                        >
                          {quote.expand.client.name}
                          {quote.expand.client.company && (
                            <span className="text-slate-400 font-normal text-xs block">
                              {quote.expand.client.company}
                            </span>
                          )}
                        </Link>
                      ) : (
                        <span className="text-slate-400">Cliente não identificado</span>
                      )}
                    </td>

                    {/* Data de Emissão */}
                    <td className="py-3.5 px-4 text-xs text-slate-500 whitespace-nowrap">
                      {formatDateBR(quote.created)}
                    </td>

                    {/* Valor Total */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="font-mono font-bold text-xs sm:text-sm text-slate-900">
                        {formatCurrencyBRL(quote.total)}
                      </span>
                      {quote.discount_percent > 0 && (
                        <span className="text-[10px] text-emerald-600 block">
                          -{quote.discount_percent}% desc.
                        </span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {getStatusBadge(quote.status)}
                    </td>

                    {/* Ações: Visualizar, Editar, Imprimir */}
                    <td className="py-3.5 px-5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => navigate(`/orcamentos/${quote.id}`)}
                          className="h-8 w-8 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Visualizar orçamento"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => navigate(`/orcamentos/${quote.id}/editar`)}
                          className="h-8 w-8 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                          title="Editar orçamento"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => navigate(`/orcamentos/${quote.id}?print=true`)}
                          className="h-8 w-8 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Imprimir proposta"
                        >
                          <Printer className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cards Mobile (<768px) */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {paginatedQuotes.map((quote) => (
              <div
                key={quote.id}
                className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-xs bg-slate-100 text-[#3A3A3C] px-2.5 py-1 rounded-lg border border-slate-200">
                    {formatQuoteNumber(quote.quote_number)}
                  </span>
                  {getStatusBadge(quote.status)}
                </div>

                <div>
                  <Link
                    to={`/orcamentos/${quote.id}`}
                    className="font-bold text-sm text-slate-900 hover:underline block"
                  >
                    {quote.expand?.client?.name || 'Cliente'}
                  </Link>
                  {quote.expand?.client?.company && (
                    <p className="text-xs text-slate-500">{quote.expand.client.company}</p>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                  <div>
                    <span className="text-[11px] text-slate-400 block">Valor da Proposta</span>
                    <span className="font-mono font-bold text-slate-900">
                      {formatCurrencyBRL(quote.total)}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-[11px] text-slate-400 block">Emissão</span>
                    <span className="text-slate-600">{formatDateBR(quote.created)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-1 pt-2 border-t border-slate-100">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/orcamentos/${quote.id}`)}
                    className="h-8 text-blue-600"
                  >
                    <Eye className="h-3.5 w-3.5 mr-1" /> Ver
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/orcamentos/${quote.id}/editar`)}
                    className="h-8 text-amber-600"
                  >
                    <Edit className="h-3.5 w-3.5 mr-1" /> Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/orcamentos/${quote.id}?print=true`)}
                    className="h-8 text-slate-700"
                  >
                    <Printer className="h-3.5 w-3.5 mr-1" /> Imprimir
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Paginação de 10 por página */}
          <div className="flex items-center justify-between bg-white px-4 py-3 rounded-2xl border border-slate-200 shadow-xs text-xs text-slate-600">
            <div>
              Mostrando{' '}
              <span className="font-semibold text-slate-900">
                {(currentPage - 1) * itemsPerPage + 1}
              </span>{' '}
              a{' '}
              <span className="font-semibold text-slate-900">
                {Math.min(currentPage * itemsPerPage, filteredQuotes.length)}
              </span>{' '}
              de <span className="font-semibold text-slate-900">{filteredQuotes.length}</span>{' '}
              propostas
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
    </div>
  )
}

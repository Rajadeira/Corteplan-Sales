import React, { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Users,
  Plus,
  Search,
  Eye,
  Edit,
  Trash2,
  Phone,
  Mail,
  Building,
  Calendar,
  FileText,
  AlertTriangle,
  Loader2,
  FolderOpen,
} from 'lucide-react'
import { clientService } from '@/services/clients'
import { quoteService } from '@/services/quotes'
import { useRealtime } from '@/hooks/use-realtime'
import { useAuth } from '@/contexts/AuthContext'
import type { ClientRecord, QuoteRecord } from '@/types'
import { formatDateBR, maskPhoneBR } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import ClientModal from '@/components/ClientModal'
import { toast } from 'sonner'

export default function Clients() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const isAdmin = user?.role === 'Administrador'
  const [clients, setClients] = useState<ClientRecord[]>([])
  const [quotes, setQuotes] = useState<QuoteRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Modal create/edit
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [clientToEdit, setClientToEdit] = useState<ClientRecord | null>(null)

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState<ClientRecord | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [checkingDeps, setCheckingDeps] = useState(false)
  const [targetDeps, setTargetDeps] = useState<{ quotesCount: number; ordersCount: number } | null>(
    null,
  )

  const handleOpenDeleteDialog = async (client: ClientRecord) => {
    setDeleteTarget(client)
    setTargetDeps(null)
    setCheckingDeps(true)
    try {
      const deps = await clientService.checkClientDependencies(client.id)
      setTargetDeps(deps)
    } catch {
      setTargetDeps({ quotesCount: 0, ordersCount: 0 })
    } finally {
      setCheckingDeps(false)
    }
  }

  const loadData = async () => {
    try {
      const [allClients, allQuotes] = await Promise.all([
        clientService.getAll(),
        quoteService.getAll(),
      ])
      setClients(allClients)
      setQuotes(allQuotes)
    } catch (err) {
      console.error('Erro ao listar clientes:', err)
      toast.error('Erro ao carregar a lista de clientes.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Real-time listener on clients
  useRealtime<ClientRecord>('clients', () => {
    loadData()
  })

  // Map client ID to number of quotes
  const quotesCountMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const q of quotes) {
      const cId = q.client
      map.set(cId, (map.get(cId) || 0) + 1)
    }
    return map
  }, [quotes])

  // Instant client-side search with highlight support
  const filteredClients = useMemo(() => {
    if (!search.trim()) return clients
    const clean = search.toLowerCase().trim()
    return clients.filter((c) => {
      const name = (c.name || '').toLowerCase()
      const email = (c.email || '').toLowerCase()
      const phone = (c.phone || '').toLowerCase()
      const company = (c.company || '').toLowerCase()
      const city = (c.city || '').toLowerCase()
      const doc = (c.document_number || '').toLowerCase()
      const trade = (c.trade_name || '').toLowerCase()
      return (
        name.includes(clean) ||
        email.includes(clean) ||
        phone.includes(clean) ||
        company.includes(clean) ||
        city.includes(clean) ||
        doc.includes(clean) ||
        trade.includes(clean)
      )
    })
  }, [clients, search])

  // Highlight search text match
  const highlightMatch = (text: string, query: string) => {
    if (!query.trim() || !text) return text
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === query.toLowerCase() ? (
            <mark key={i} className="bg-amber-200 text-slate-900 rounded-xs px-0.5 font-semibold">
              {part}
            </mark>
          ) : (
            part
          ),
        )}
      </>
    )
  }

  // Handle deletion
  const confirmDelete = async () => {
    if (!deleteTarget) return
    if (targetDeps && (targetDeps.quotesCount > 0 || targetDeps.ordersCount > 0)) {
      toast.error(
        'Este cliente possui orçamentos ou pedidos vinculados e não pode ser excluído diretamente.',
      )
      return
    }

    setIsDeleting(true)
    try {
      await clientService.delete(deleteTarget.id)
      toast.success(`Cliente "${deleteTarget.name}" excluído com sucesso!`)
      setDeleteTarget(null)
      setTargetDeps(null)
      loadData()
    } catch (err: unknown) {
      console.error('Erro ao excluir cliente:', err)
      toast.error(
        'Não foi possível excluir o cliente. Verifique se existem vínculos com orçamentos/pedidos ou permissões.',
      )
    } finally {
      setIsDeleting(false)
    }
  }

  // Avatar initials with color palette
  const getAvatarData = (name: string) => {
    const parts = (name || 'CL').trim().split(' ')
    const initials =
      parts.length === 1
        ? parts[0].substring(0, 2).toUpperCase()
        : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()

    const colors = [
      'bg-blue-600 text-white',
      'bg-indigo-600 text-white',
      'bg-emerald-600 text-white',
      'bg-amber-600 text-white',
      'bg-purple-600 text-white',
      'bg-rose-600 text-white',
      'bg-slate-700 text-white',
    ]
    let hash = 0
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash)
    }
    const colorClass = colors[Math.abs(hash) % colors.length]

    return { initials, colorClass }
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-6">
        {/* Header com Título, Busca e Botão Novo Cliente */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Clientes Cadastrados
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Gerencie sua carteira de clientes corporativos e residenciais.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Buscar por nome, telefone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-3 h-10 text-xs sm:text-sm bg-white border-slate-200 rounded-xl"
              />
            </div>

            <Button
              onClick={() => {
                setClientToEdit(null)
                setIsModalOpen(true)
              }}
              className="rounded-xl bg-[#3A3A3C] hover:bg-[#2D2D2F] text-white font-medium shadow-sm transition-all duration-200 hover:scale-[1.02] shrink-0"
            >
              <Plus className="h-4 w-4 mr-1.5 text-amber-400" />
              Novo Cliente
            </Button>
          </div>
        </div>

        {/* Conteúdo: Tabela Desktop / Cards Mobile */}
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-slate-500">
              <Loader2 className="h-8 w-8 animate-spin text-[#3A3A3C]" />
              <p className="text-sm">Carregando carteira de clientes...</p>
            </div>
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-slate-200 text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
              <Users className="h-8 w-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-800">
                {search.trim() ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado ainda'}
              </h3>
              <p className="text-xs text-slate-500 max-w-sm">
                {search.trim()
                  ? `Não encontramos nenhum cliente correspondente ao termo "${search}".`
                  : 'Cadastre seu primeiro cliente para iniciar a elaboração de orçamentos e propostas.'}
              </p>
            </div>
            {!search.trim() && (
              <Button
                onClick={() => {
                  setClientToEdit(null)
                  setIsModalOpen(true)
                }}
                className="rounded-xl bg-[#3A3A3C] hover:bg-[#2D2D2F] text-white font-medium"
              >
                <Plus className="h-4 w-4 mr-1.5 text-amber-400" />
                Cadastrar primeiro cliente
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
                    <th className="py-3.5 px-5">Cliente</th>
                    <th className="py-3.5 px-4">Telefone</th>
                    <th className="py-3.5 px-4">Empresa / Cidade</th>
                    <th className="py-3.5 px-4">Cadastro</th>
                    <th className="py-3.5 px-4 text-center">Orçamentos</th>
                    <th className="py-3.5 px-5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                  {filteredClients.map((client) => {
                    const avatarData = getAvatarData(client.name)
                    const countQuotes = quotesCountMap.get(client.id) || 0

                    return (
                      <tr
                        key={client.id}
                        className="hover:bg-[#F1F5F9] transition-colors duration-150 group"
                      >
                        {/* Cliente (Avatar + Nome + E-mail) */}
                        <td className="py-3 px-5">
                          <div className="flex items-center gap-3">
                            <Avatar
                              className={`h-9 w-9 shrink-0 font-bold text-xs ${avatarData.colorClass}`}
                            >
                              <AvatarFallback className={avatarData.colorClass}>
                                {avatarData.initials}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 truncate">
                              <Link
                                to={`/clientes/${client.id}`}
                                className="font-semibold text-slate-900 group-hover:text-[#3A3A3C] hover:underline block truncate"
                              >
                                {highlightMatch(client.name, search)}
                              </Link>
                              {client.email && (
                                <span className="text-xs text-slate-500 block truncate">
                                  {highlightMatch(client.email, search)}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Telefone com máscara */}
                        <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 text-xs">
                            <Phone className="h-3.5 w-3.5 text-slate-400" />
                            <span>{highlightMatch(maskPhoneBR(client.phone), search)}</span>
                          </div>
                        </td>

                        {/* Empresa / Cidade */}
                        <td className="py-3 px-4 text-slate-700">
                          <div className="font-medium text-xs text-slate-900 truncate max-w-xs">
                            {client.company ? highlightMatch(client.company, search) : '—'}
                          </div>
                          {client.document_number && (
                            <div className="text-[11px] text-slate-500 font-mono">
                              {client.document_type ? `${client.document_type}: ` : ''}
                              {highlightMatch(client.document_number, search)}
                            </div>
                          )}
                          {client.city && (
                            <div className="text-[11px] text-slate-400 truncate max-w-xs">
                              {highlightMatch(client.city, search)}
                            </div>
                          )}
                        </td>

                        {/* Data de Cadastro */}
                        <td className="py-3 px-4 text-xs text-slate-500 whitespace-nowrap">
                          {formatDateBR(client.created)}
                        </td>

                        {/* Contagem de orçamentos */}
                        <td className="py-3 px-4 text-center">
                          <span className="inline-flex items-center justify-center h-6 min-w-6 px-2 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 font-mono">
                            {countQuotes}
                          </span>
                        </td>

                        {/* Ações com hovers distintos */}
                        <td className="py-3 px-5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            {/* Visualizar: Azul */}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => navigate(`/clientes/${client.id}`)}
                                  className="h-8 w-8 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                >
                                  <Eye className="h-4 w-4" />
                                  <span className="sr-only">Visualizar detalhes</span>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top">Visualizar detalhes</TooltipContent>
                            </Tooltip>

                            {/* Editar: Âmbar */}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setClientToEdit(client)
                                    setIsModalOpen(true)
                                  }}
                                  className="h-8 w-8 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                >
                                  <Edit className="h-4 w-4" />
                                  <span className="sr-only">Editar cliente</span>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top">Editar cliente</TooltipContent>
                            </Tooltip>

                            {/* Excluir: Vermelho (apenas Administrador) */}
                            {isAdmin && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleOpenDeleteDialog(client)}
                                    className="h-8 w-8 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    <span className="sr-only">Excluir</span>
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top">Excluir</TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Cards empilhados em Mobile (<768px) */}
            <div className="grid grid-cols-1 gap-3 md:hidden">
              {filteredClients.map((client) => {
                const avatarData = getAvatarData(client.name)
                const countQuotes = quotesCountMap.get(client.id) || 0

                return (
                  <div
                    key={client.id}
                    className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Avatar
                          className={`h-10 w-10 shrink-0 font-bold text-xs ${avatarData.colorClass}`}
                        >
                          <AvatarFallback className={avatarData.colorClass}>
                            {avatarData.initials}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <Link
                            to={`/clientes/${client.id}`}
                            className="font-bold text-sm text-slate-900 block"
                          >
                            {highlightMatch(client.name, search)}
                          </Link>
                          {client.company && (
                            <p className="text-xs text-slate-600">
                              {highlightMatch(client.company, search)}
                            </p>
                          )}
                        </div>
                      </div>

                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
                        <FileText className="h-3 w-3" /> {countQuotes}
                      </span>
                    </div>

                    <div className="text-xs text-slate-600 space-y-1 pt-1 border-t border-slate-100">
                      <div className="flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span>{highlightMatch(maskPhoneBR(client.phone), search)}</span>
                      </div>
                      {client.email && (
                        <div className="flex items-center gap-2 truncate">
                          <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{highlightMatch(client.email, search)}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                      <span className="text-[11px] text-slate-400">
                        Cadastrado em {formatDateBR(client.created)}
                      </span>

                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/clientes/${client.id}`)}
                          className="h-8 px-2 text-blue-600 hover:bg-blue-50"
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" /> Ver
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setClientToEdit(client)
                            setIsModalOpen(true)
                          }}
                          className="h-8 px-2 text-amber-600 hover:bg-amber-50"
                        >
                          <Edit className="h-3.5 w-3.5 mr-1" /> Editar
                        </Button>
                        {isAdmin && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenDeleteDialog(client)}
                                className="h-8 px-2 text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                <span className="sr-only">Excluir</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">Excluir</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* Modal Novo / Editar Cliente */}
        <ClientModal
          open={isModalOpen}
          onOpenChange={setIsModalOpen}
          clientToEdit={clientToEdit}
          onSuccess={() => loadData()}
        />

        {/* Modal de Confirmação de Exclusão */}
        <AlertDialog
          open={Boolean(deleteTarget)}
          onOpenChange={(open) => {
            if (!open) {
              setDeleteTarget(null)
              setTargetDeps(null)
            }
          }}
        >
          <AlertDialogContent className="max-w-md rounded-2xl bg-white animate-in zoom-in-95 duration-200">
            <AlertDialogHeader className="space-y-2">
              <div
                className={`h-10 w-10 rounded-full flex items-center justify-center mb-1 ${
                  targetDeps && (targetDeps.quotesCount > 0 || targetDeps.ordersCount > 0)
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-red-100 text-red-600'
                }`}
              >
                <AlertTriangle className="h-5 w-5" />
              </div>
              <AlertDialogTitle className="text-lg font-bold text-slate-900">
                {targetDeps && (targetDeps.quotesCount > 0 || targetDeps.ordersCount > 0)
                  ? 'Não é possível excluir o cliente'
                  : 'Excluir este cliente?'}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs text-slate-600 leading-relaxed space-y-2">
                {checkingDeps ? (
                  <div className="flex items-center gap-2 py-2 text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin text-slate-600" />
                    <span>Verificando orçamentos e pedidos vinculados...</span>
                  </div>
                ) : targetDeps && (targetDeps.quotesCount > 0 || targetDeps.ordersCount > 0) ? (
                  <div className="space-y-2 text-slate-700">
                    <p>
                      O cliente{' '}
                      <strong className="text-slate-900">&quot;{deleteTarget?.name}&quot;</strong>{' '}
                      possui registros vinculados no sistema:
                    </p>
                    <ul className="list-disc list-inside bg-amber-50 p-3 rounded-xl border border-amber-200 text-amber-900 font-medium space-y-1">
                      {targetDeps.quotesCount > 0 && (
                        <li>{targetDeps.quotesCount} orçamento(s) cadastrado(s)</li>
                      )}
                      {targetDeps.ordersCount > 0 && (
                        <li>{targetDeps.ordersCount} pedido(s) cadastrado(s)</li>
                      )}
                    </ul>
                    <p className="text-slate-500 text-[11px]">
                      Para manter a integridade comercial e o histórico financeiro, clientes com
                      propostas ou pedidos não podem ser excluídos. Remova ou reatribua os vínculos
                      antes de tentar novamente.
                    </p>
                  </div>
                ) : (
                  <p>
                    Tem certeza que deseja excluir o cliente{' '}
                    <strong className="text-slate-900">&quot;{deleteTarget?.name}&quot;</strong>?
                    Esta ação não pode ser desfeita e todos os dados cadastrais serão removidos
                    definitivamente.
                  </p>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="pt-2 gap-2">
              <AlertDialogCancel disabled={isDeleting} className="rounded-xl">
                {targetDeps && (targetDeps.quotesCount > 0 || targetDeps.ordersCount > 0)
                  ? 'Fechar'
                  : 'Cancelar'}
              </AlertDialogCancel>
              {(!targetDeps || (targetDeps.quotesCount === 0 && targetDeps.ordersCount === 0)) && (
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault()
                    confirmDelete()
                  }}
                  disabled={isDeleting || checkingDeps}
                  className="rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                      Excluindo...
                    </>
                  ) : (
                    'Sim, excluir cliente'
                  )}
                </AlertDialogAction>
              )}
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  )
}

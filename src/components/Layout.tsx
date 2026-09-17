import React, { useState, useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  FileText,
  PlusCircle,
  PackageCheck,
  UserCheck,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Search,
  ExternalLink,
  Package,
  Settings,
  Download,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { clientService } from '@/services/clients'
import { quoteService } from '@/services/quotes'
import { notificationService } from '@/services/notifications'
import type { ClientRecord, QuoteRecord, NotificationRecord } from '@/types'
import { formatCurrencyBRL, formatQuoteNumber } from '@/types'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Bell, CheckCheck, Clock } from 'lucide-react'
import { toast } from 'sonner'
import pb from '@/lib/pocketbase/client'

const navItems = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard, adminOnly: false },
  { name: 'Orçamentos', path: '/orcamentos', icon: FileText, adminOnly: false },
  { name: 'Pedidos', path: '/pedidos', icon: PackageCheck, adminOnly: false },
  { name: 'Itens', path: '/itens', icon: Package, adminOnly: false },
  { name: 'Clientes', path: '/clientes', icon: Users, adminOnly: false },
  { name: 'Usuários', path: '/usuarios', icon: UserCheck, adminOnly: true },
  { name: 'Configurações', path: '/configuracoes', icon: Settings, adminOnly: true },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const isAdmin = user?.role === 'Administrador'
  const location = useLocation()
  const navigate = useNavigate()

  // Sidebar collapse state
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  // PWA beforeinstallprompt state
  interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
  }
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstallable, setIsInstallable] = useState(false)

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setIsInstallable(true)
    }

    const handleAppInstalled = () => {
      setIsInstallable(false)
      setDeferredPrompt(null)
      toast.success('Aplicativo Corteplan instalado com sucesso!')
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const handleInstallApp = async () => {
    if (!deferredPrompt) return
    try {
      await deferredPrompt.prompt()
      const choice = await deferredPrompt.userChoice
      if (choice.outcome === 'accepted') {
        setIsInstallable(false)
        setDeferredPrompt(null)
      }
    } catch (err) {
      console.warn('Erro ao disparar prompt de instalação:', err)
    }
  }

  // Global search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchResults, setSearchResults] = useState<{
    clients: ClientRecord[]
    quotes: QuoteRecord[]
  }>({ clients: [], quotes: [] })
  const [isSearching, setIsSearching] = useState(false)
  const searchContainerRef = useRef<HTMLDivElement>(null)

  // Notifications state
  const [notifications, setNotifications] = useState<NotificationRecord[]>([])
  const [unreadCount, setUnreadCount] = useState<number>(0)
  const [notificationsLoading, setNotificationsLoading] = useState<boolean>(false)

  // Carregar notificações do usuário logado
  const loadNotifications = async () => {
    if (!user) return
    try {
      setNotificationsLoading(true)
      const list = await notificationService.getMyNotifications(20)
      setNotifications(list)
      const unread = list.filter((n) => !n.read).length
      setUnreadCount(unread)
    } catch (err) {
      console.warn('Erro ao carregar notificações:', err)
    } finally {
      setNotificationsLoading(false)
    }
  }

  useEffect(() => {
    if (user?.id) {
      loadNotifications()
    }
  }, [user?.id])

  // Subscrição em tempo real para notificações do usuário logado
  useEffect(() => {
    if (!user?.id) return

    let isSubscribed = true
    const setupRealtime = async () => {
      try {
        await pb.collection('notifications').subscribe('*', (e) => {
          if (!isSubscribed) return
          const record = e.record as unknown as NotificationRecord

          // Se a notificação for para mim
          if (record && record.user === user.id) {
            if (e.action === 'create') {
              setNotifications((prev) => [record, ...prev.filter((n) => n.id !== record.id)])
              setUnreadCount((c) => c + 1)
              // Alerta sonoro/visual breve na sessão atual
              toast.info(record.title, {
                description: record.message,
                duration: 5000,
                action: record.quote
                  ? {
                      label: 'Ver Proposta',
                      onClick: () => navigate(`/orcamentos/${record.quote}`),
                    }
                  : undefined,
              })
            } else if (e.action === 'update') {
              setNotifications((prev) => prev.map((n) => (n.id === record.id ? record : n)))
              // Recalcula contagem de não lidas
              loadNotifications()
            } else if (e.action === 'delete') {
              setNotifications((prev) => prev.filter((n) => n.id !== record.id))
              loadNotifications()
            }
          }
        })
      } catch (err) {
        console.warn('Erro ao conectar realtime de notificações:', err)
      }
    }

    setupRealtime()

    return () => {
      isSubscribed = false
      try {
        pb.collection('notifications')
          .unsubscribe('*')
          .catch(() => {})
      } catch {
        /* intentionally ignored */
      }
    }
  }, [user?.id, navigate])

  const handleNotificationClick = async (notification: NotificationRecord) => {
    try {
      if (!notification.read) {
        await notificationService.markAsRead(notification.id)
        setNotifications((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n)),
        )
        setUnreadCount((prev) => Math.max(0, prev - 1))
      }
      if (notification.quote) {
        navigate(`/orcamentos/${notification.quote}`)
      }
    } catch (err) {
      console.warn('Erro ao marcar notificação como lida:', err)
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead()
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
      setUnreadCount(0)
      toast.success('Todas as notificações foram marcadas como lidas.')
    } catch (err) {
      console.warn('Erro ao marcar todas como lidas:', err)
      toast.error('Não foi possível marcar todas como lidas.')
    }
  }

  // Formatador de tempo relativo em PT-BR
  const formatRelativeTime = (dateStr?: string) => {
    if (!dateStr) return ''
    try {
      const now = new Date().getTime()
      const past = new Date(dateStr).getTime()
      const diffMs = Math.max(0, now - past)
      const diffMin = Math.floor(diffMs / 60000)
      const diffHours = Math.floor(diffMin / 60)
      const diffDays = Math.floor(diffHours / 24)

      if (diffMin < 1) return 'Agora mesmo'
      if (diffMin === 1) return 'Há 1 minuto'
      if (diffMin < 60) return `Há ${diffMin} min`
      if (diffHours === 1) return 'Há 1 hora'
      if (diffHours < 24) return `Há ${diffHours} h`
      if (diffDays === 1) return 'Ontem'
      if (diffDays < 7) return `Há ${diffDays} dias`
      return new Date(dateStr).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
      })
    } catch (_) {
      return ''
    }
  }

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false)
    setSearchOpen(false)
  }, [location.pathname])

  // Click outside to close global search dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Global search handler
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults({ clients: [], quotes: [] })
      return
    }

    const timer = setTimeout(async () => {
      setIsSearching(true)
      try {
        const [clients, allQuotes] = await Promise.all([
          clientService.search(searchQuery),
          quoteService.getAll(),
        ])

        const cleanQ = searchQuery.toLowerCase().trim()
        const matchedQuotes = allQuotes.filter((q) => {
          const numStr = `ORÇ-${String(q.quote_number).padStart(3, '0')}`.toLowerCase()
          const rawNum = String(q.quote_number)
          const clientName = (q.expand?.client?.name || '').toLowerCase()
          const clientCompany = (q.expand?.client?.company || '').toLowerCase()
          const obs = (q.observations || '').toLowerCase()
          return (
            numStr.includes(cleanQ) ||
            rawNum.includes(cleanQ) ||
            clientName.includes(cleanQ) ||
            clientCompany.includes(cleanQ) ||
            obs.includes(cleanQ)
          )
        })

        setSearchResults({
          clients: clients.slice(0, 4),
          quotes: matchedQuotes.slice(0, 4),
        })
        setSearchOpen(true)
      } catch (err) {
        console.error('Erro na busca global:', err)
      } finally {
        setIsSearching(false)
      }
    }, 250)

    return () => clearTimeout(timer)
  }, [searchQuery])

  // Get initials for avatar
  const getInitials = (name?: string) => {
    if (!name) return 'MV'
    const parts = name.trim().split(' ')
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }

  // Determine current page title
  const getPageTitle = () => {
    const path = location.pathname
    if (path === '/') return 'Dashboard'
    if (path === '/clientes') return 'Clientes'
    if (path.startsWith('/clientes/novo')) return 'Novo Cliente'
    if (path.startsWith('/clientes/')) return 'Detalhes do Cliente'
    if (path === '/orcamentos') return 'Orçamentos'
    if (path === '/orcamentos/novo') return 'Novo Orçamento'
    if (path.includes('/editar')) return 'Editar Orçamento'
    if (path.startsWith('/orcamentos/')) return 'Detalhes do Orçamento'
    if (path === '/pedidos') return 'Pedidos'
    if (path.startsWith('/pedidos/')) return 'Detalhes do Pedido'
    if (path === '/itens') return 'Catálogo de Itens'
    if (path === '/usuarios') return 'Usuários'
    if (path === '/configuracoes') return 'Configurações do Sistema'
    return 'Corteplan Gestão'
  }

  return (
    <div className="flex min-h-screen bg-[#F8FAFC] text-[#111827] font-sans antialiased">
      {/* Mobile Backdrop Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm md:hidden transition-opacity duration-300"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Desktop / Mobile Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-gradient-to-b from-[#2E2E30] to-[#3A3A3C] text-[#E2E8F0] shadow-xl border-r border-[#3E3E42]/60 transition-all duration-300 ease-in-out print:hidden ${
          collapsed ? 'w-20' : 'w-[280px]'
        } ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
      >
        {/* Brand / Logo */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-white/10">
          <Link to="/" className="flex items-center gap-3 overflow-hidden group">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#E66812] to-amber-600 text-white shadow-md shadow-black/30 group-hover:scale-105 transition-transform duration-200 font-extrabold text-lg tracking-wider">
              C
            </div>
            {!collapsed && (
              <div className="flex flex-col truncate">
                <span className="font-bold text-white text-base tracking-wider font-sans">
                  CORTEPLAN
                </span>
                <span className="text-[11px] text-slate-300 font-medium tracking-wide uppercase">
                  Gestão Comercial
                </span>
              </div>
            )}
          </Link>
          {/* Mobile close button */}
          <button
            type="button"
            className="md:hidden text-slate-300 hover:text-white p-1.5 rounded-lg"
            onClick={() => setMobileOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 space-y-1.5 px-3 py-4 overflow-y-auto">
          {navItems
            .filter((item) => !item.adminOnly || isAdmin)
            .map((item) => {
              const Icon = item.icon
              const isActive =
                item.path === '/'
                  ? location.pathname === '/'
                  : location.pathname.startsWith(item.path) &&
                    (item.path !== '/orcamentos' ||
                      location.pathname === '/orcamentos' ||
                      location.pathname.startsWith('/orcamentos/'))

              const isExactActive = location.pathname === item.path

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  title={collapsed ? item.name : undefined}
                  className={`flex items-center gap-3.5 rounded-xl px-3.5 py-3 text-sm font-medium transition-all duration-200 ${
                    isExactActive ||
                    (item.path !== '/' &&
                      isActive &&
                      item.path === '/orcamentos' &&
                      !location.pathname.includes('/novo'))
                      ? 'bg-white/15 text-white shadow-sm border-l-4 border-[#F08A24] font-semibold'
                      : 'text-slate-200 hover:bg-white/10 hover:text-white'
                  } ${collapsed ? 'justify-center px-0' : ''}`}
                >
                  <Icon
                    className={`h-5 w-5 shrink-0 transition-transform duration-200 ${
                      isActive ? 'text-[#F08A24]' : 'text-slate-300'
                    }`}
                  />
                  {!collapsed && <span>{item.name}</span>}
                </Link>
              )
            })}

          {/* Botão discreto no menu lateral quando instalável como PWA */}
          {isInstallable && (
            <div className="pt-2">
              <button
                type="button"
                onClick={handleInstallApp}
                title={collapsed ? 'Instalar aplicativo' : undefined}
                className={`w-full flex items-center gap-3.5 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-all ${
                  collapsed ? 'justify-center px-0' : ''
                }`}
              >
                <Download className="h-4 w-4 text-[#F08A24] shrink-0" />
                {!collapsed && <span>Instalar aplicativo</span>}
              </button>
            </div>
          )}
        </nav>

        {/* Collapse Toggle (Desktop only) */}
        <div className="hidden md:flex px-3 py-2 border-t border-white/10 justify-end">
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center justify-center h-8 w-8 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
            title={collapsed ? 'Expandir barra lateral' : 'Recolher barra lateral'}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {/* User Card Footer */}
        <div className="p-3 border-t border-white/10 bg-black/20">
          <div
            className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'} gap-2`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <Avatar className="h-9 w-9 ring-2 ring-white/20 bg-[#252527] text-white font-bold text-xs shrink-0">
                <AvatarFallback className="bg-[#252527] text-[#F08A24] font-bold">
                  {getInitials(user?.name)}
                </AvatarFallback>
              </Avatar>
              {!collapsed && (
                <div className="flex flex-col min-w-0 truncate">
                  <span className="text-xs font-semibold text-white truncate" title={user?.name}>
                    {user?.name || 'Administrador'}
                  </span>
                  <span className="text-[11px] text-slate-300 truncate" title={user?.email}>
                    {user?.email || 'admin@mobiliario.com.br'}
                  </span>
                </div>
              )}
            </div>

            {!collapsed && (
              <Button
                variant="ghost"
                size="icon"
                onClick={logout}
                className="h-8 w-8 text-slate-300 hover:text-red-400 hover:bg-white/10 shrink-0"
                title="Sair do sistema"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div
        className={`flex-1 flex flex-col transition-all duration-300 min-w-0 print:m-0 print:p-0 print:w-full ${
          collapsed ? 'md:ml-20' : 'md:ml-[280px]'
        }`}
      >
        {/* Header Superior */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-4 md:px-8 backdrop-blur-md shadow-xs print:hidden">
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <button
              type="button"
              className="md:hidden -ml-1.5 p-2 rounded-lg text-slate-600 hover:bg-slate-100 focus:outline-hidden"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </button>

            <h1 className="text-lg md:text-xl font-bold text-slate-900 tracking-tight">
              {getPageTitle()}
            </h1>
          </div>

          {/* Center / Right: Global Search & User Dropdown */}
          <div className="flex items-center gap-3 md:gap-5">
            {/* Global Search */}
            <div className="relative w-48 sm:w-64 md:w-80" ref={searchContainerRef}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Buscar clientes, orçamentos..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => {
                    if (searchQuery.trim().length >= 2) setSearchOpen(true)
                  }}
                  className="pl-9 pr-3 h-9 text-xs sm:text-sm bg-slate-50 border-slate-200 focus-visible:ring-1 focus-visible:ring-[#3A3A3C] rounded-lg"
                />
              </div>

              {/* Search dropdown results */}
              {searchOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-200 p-2 z-50 text-xs sm:text-sm max-h-96 overflow-y-auto animate-in fade-in-50 zoom-in-95 duration-150">
                  {isSearching ? (
                    <div className="py-6 text-center text-slate-400">Pesquisando no sistema...</div>
                  ) : searchResults.clients.length === 0 && searchResults.quotes.length === 0 ? (
                    <div className="py-6 text-center text-slate-400">
                      Nenhum resultado encontrado para &quot;{searchQuery}&quot;
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Clientes agrupados */}
                      {searchResults.clients.length > 0 && (
                        <div>
                          <div className="flex items-center justify-between px-2.5 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                            <span>Clientes</span>
                            <span className="text-[10px] lowercase text-slate-400">
                              {searchResults.clients.length} encontrados
                            </span>
                          </div>
                          <div className="space-y-0.5 mt-1">
                            {searchResults.clients.map((c) => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => {
                                  setSearchOpen(false)
                                  setSearchQuery('')
                                  navigate(`/clientes/${c.id}`)
                                }}
                                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left hover:bg-slate-100 transition-colors"
                              >
                                <div className="truncate pr-2">
                                  <div className="font-medium text-slate-900 truncate">
                                    {c.name}
                                  </div>
                                  <div className="text-[11px] text-slate-500 truncate">
                                    {c.company || c.phone}
                                  </div>
                                </div>
                                <ExternalLink className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Orçamentos agrupados */}
                      {searchResults.quotes.length > 0 && (
                        <div>
                          <div className="flex items-center justify-between px-2.5 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                            <span>Orçamentos</span>
                            <span className="text-[10px] lowercase text-slate-400">
                              {searchResults.quotes.length} encontrados
                            </span>
                          </div>
                          <div className="space-y-0.5 mt-1">
                            {searchResults.quotes.map((q) => (
                              <button
                                key={q.id}
                                type="button"
                                onClick={() => {
                                  setSearchOpen(false)
                                  setSearchQuery('')
                                  navigate(`/orcamentos/${q.id}`)
                                }}
                                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left hover:bg-slate-100 transition-colors"
                              >
                                <div className="truncate pr-2">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-semibold text-[#3A3A3C]">
                                      {formatQuoteNumber(q.quote_number)}
                                    </span>
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] py-0 px-1.5 font-normal"
                                    >
                                      {q.status}
                                    </Badge>
                                  </div>
                                  <div className="text-[11px] text-slate-500 truncate mt-0.5">
                                    {q.expand?.client?.name || 'Cliente'} &bull;{' '}
                                    {formatCurrencyBRL(q.total)}
                                  </div>
                                </div>
                                <ExternalLink className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Sininho de Notificações com Badge de Não Lidas */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-9 w-9 rounded-full p-0 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                  title="Notificações do sistema"
                >
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#E66812] text-white text-[10px] font-extrabold flex items-center justify-center ring-2 ring-white animate-in zoom-in-50 duration-200 shadow-sm">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-80 sm:w-96 p-0 rounded-2xl shadow-2xl border-slate-200 bg-white overflow-hidden text-slate-800"
                align="end"
                forceMount
              >
                <div className="flex items-center justify-between px-4 py-3 bg-[#242427] text-white border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-[#F08A24]" />
                    <span className="font-bold text-sm">Notificações</span>
                    {unreadCount > 0 && (
                      <Badge className="bg-[#F08A24] text-black font-extrabold text-[10px] px-1.5 py-0 h-4">
                        {unreadCount} nova{unreadCount > 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAllAsRead}
                      className="text-xs text-orange-300 hover:text-white flex items-center gap-1 transition-colors font-medium"
                      title="Marcar todas como lidas"
                    >
                      <CheckCheck className="h-3.5 w-3.5" />
                      Marcar todas
                    </button>
                  )}
                </div>

                <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100">
                  {notifications.length === 0 ? (
                    <div className="py-10 text-center px-4 space-y-2">
                      <div className="h-10 w-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                        <Bell className="h-5 w-5" />
                      </div>
                      <p className="text-xs font-medium text-slate-500">
                        Nenhuma notificação no momento
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Você será notificado aqui quando um orçamento for aprovado.
                      </p>
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => handleNotificationClick(n)}
                        className={`p-3.5 transition-colors cursor-pointer flex items-start gap-3 hover:bg-slate-50 ${
                          !n.read ? 'bg-amber-500/5' : 'bg-white'
                        }`}
                      >
                        <div
                          className={`mt-1 h-2.5 w-2.5 rounded-full shrink-0 ${
                            !n.read ? 'bg-[#F08A24] ring-2 ring-orange-200' : 'bg-slate-300'
                          }`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <h4
                              className={`text-xs font-bold truncate ${
                                !n.read ? 'text-slate-900' : 'text-slate-700'
                              }`}
                            >
                              {n.title}
                            </h4>
                            <span className="text-[10px] text-slate-400 shrink-0 flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatRelativeTime(n.created)}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 mt-0.5 line-clamp-2 leading-relaxed">
                            {n.message}
                          </p>
                          {n.quote && (
                            <span className="inline-block mt-1 text-[11px] font-semibold text-[#E66812] hover:underline">
                              Ver orçamento &rarr;
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="p-2.5 bg-slate-50 border-t border-slate-100 text-center">
                  <span className="text-[11px] text-slate-400">
                    Notificações de orçamentos aprovados da equipe
                  </span>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* User Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-9 w-9 rounded-full p-0 ring-1 ring-slate-200 hover:ring-[#3A3A3C] transition-all"
                >
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-[#3A3A3C] text-[#F08A24] font-bold text-xs">
                      {getInitials(user?.name)}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-semibold leading-none text-slate-900">
                      {user?.name || 'Administrador'}
                    </p>
                    <p className="text-xs leading-none text-slate-500">{user?.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => navigate('/orcamentos')}
                  className="cursor-pointer"
                >
                  <FileText className="mr-2 h-4 w-4 text-slate-500" />
                  <span>Orçamentos</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/pedidos')} className="cursor-pointer">
                  <PackageCheck className="mr-2 h-4 w-4 text-slate-500" />
                  <span>Pedidos</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/itens')} className="cursor-pointer">
                  <Package className="mr-2 h-4 w-4 text-slate-500" />
                  <span>Catálogo de Itens</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/clientes')} className="cursor-pointer">
                  <Users className="mr-2 h-4 w-4 text-slate-500" />
                  <span>Clientes</span>
                </DropdownMenuItem>
                {isAdmin && (
                  <>
                    <DropdownMenuItem
                      onClick={() => navigate('/usuarios')}
                      className="cursor-pointer"
                    >
                      <UserCheck className="mr-2 h-4 w-4 text-slate-500" />
                      <span>Usuários</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => navigate('/configuracoes')}
                      className="cursor-pointer"
                    >
                      <Settings className="mr-2 h-4 w-4 text-slate-500" />
                      <span>Configurações</span>
                    </DropdownMenuItem>
                  </>
                )}
                {isInstallable && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={handleInstallApp}
                      className="cursor-pointer text-[#E66812] font-semibold focus:text-[#E66812]"
                    >
                      <Download className="mr-2 h-4 w-4 text-[#F08A24]" />
                      <span>Instalar aplicativo</span>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-red-600 focus:text-red-600"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sair do sistema</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Content Viewport */}
        <main className="flex-1 p-4 md:p-8 animate-in fade-in-50 duration-200 max-w-7xl w-full mx-auto print:p-0 print:m-0 print:max-w-none print:w-full print:block">
          <Outlet />
        </main>

        {/* Discreto Footer */}
        <footer className="border-t border-slate-200/80 bg-white/50 py-4 px-6 text-center text-xs text-slate-500 print:hidden">
          &copy; 2026 CORTEPLAN — Gestão Comercial & Orçamentos. Todos os direitos reservados.
        </footer>
      </div>
    </div>
  )
}

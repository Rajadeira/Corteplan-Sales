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
  Armchair,
  ExternalLink,
  User,
  ShieldCheck,
  Building,
  Package,
  Settings,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { clientService } from '@/services/clients'
import { quoteService } from '@/services/quotes'
import type { ClientRecord, QuoteRecord } from '@/types'
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

  // Global search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchResults, setSearchResults] = useState<{
    clients: ClientRecord[]
    quotes: QuoteRecord[]
  }>({ clients: [], quotes: [] })
  const [isSearching, setIsSearching] = useState(false)
  const searchContainerRef = useRef<HTMLDivElement>(null)

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

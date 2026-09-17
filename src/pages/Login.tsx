import React, { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Armchair, Mail, Lock, Loader2, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/'

  const [email, setEmail] = useState('gustavo@corteplan.com.br')
  const [password, setPassword] = useState('Skip@Pass')
  const [rememberMe, setRememberMe] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [validationErrors, setValidationErrors] = useState<{ email?: string; password?: string }>(
    {},
  )

  const validate = () => {
    const errs: { email?: string; password?: string } = {}
    if (!email) {
      errs.email = 'E-mail é obrigatório'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errs.email = 'Insira um formato de e-mail válido'
    }

    if (!password) {
      errs.password = 'Senha é obrigatória'
    } else if (password.length < 8) {
      errs.password = 'A senha deve conter no mínimo 8 caracteres'
    }

    setValidationErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!validate()) return

    setLoading(true)
    try {
      await login(email, password)
      navigate(from, { replace: true })
    } catch (err: unknown) {
      console.error('Falha de login:', err)
      setError('Credenciais inválidas. Verifique seu e-mail e senha e tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      {/* Coluna Esquerda: Visual Escuro com Gradiente (Desktop) */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-[#1C1C1E] via-[#2C2C2E] to-[#3A3A3C] flex-col justify-between p-12 text-white overflow-hidden">
        {/* Subtle geometric pattern / glow */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Logo superior */}
        <div className="flex items-center gap-3 relative z-10">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#3A3A3C] to-[#F08A24] text-white shadow-lg shadow-black/40 border border-slate-700/50">
            <Armchair className="h-6 w-6 text-amber-400" />
          </div>
          <div>
            <span className="text-xl font-bold tracking-tight text-white block">
              <span className="font-semibold">Corteplan Sales</span>
            </span>
            Sistema de Elaboração de Orçamentos
          </div>
        </div>

        {/* Hero Central */}
        <div className="space-y-6 relative z-10 max-w-lg">
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-800/80 px-3.5 py-1.5 text-xs font-medium text-amber-400 border border-amber-400/20 backdrop-blur-sm">
            <CheckCircle2 className="h-4 w-4" /> Solução Corporativa Integrada
          </div>

          <h2 className="text-4xl font-extrabold tracking-tight leading-tight text-white">
            Gestão inteligente para <br />
            <span className="bg-gradient-to-r from-amber-400 via-amber-200 to-white bg-clip-text text-transparent">
              mobiliário & comunicação visual
            </span>
          </h2>

          <p className="text-slate-300 text-base leading-relaxed">
            Controle completo de clientes, orçamentos sequenciais automatizados, cálculo de itens em
            tempo real e histórico integral de propostas em uma plataforma moderna e intuitiva.
          </p>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-800/80">
            <div>
              <div className="text-2xl font-bold text-amber-400 font-mono">100%</div>
              <div className="text-xs text-slate-400">Numeração sequencial e rastreável</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-emerald-400 font-mono">Real-time</div>
              <div className="text-xs text-slate-400">Sincronização imediata de propostas</div>
            </div>
          </div>
        </div>

        {/* Rodapé da coluna visual */}
        <div className="text-xs text-slate-500 relative z-10">
          &copy; 2025 Mobiliário & Visual. Todos os direitos reservados.
        </div>
      </div>

      {/* Coluna Direita: Formulário */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 lg:p-16">
        <div className="w-full max-w-md space-y-8 bg-white p-8 sm:p-10 rounded-2xl shadow-sm border border-slate-200">
          {/* Mobile logo header */}
          <div className="lg:hidden flex items-center justify-center gap-3 pb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0F172A] text-white">
              <Armchair className="h-5 w-5 text-amber-400" />
            </div>
            <span className="text-lg font-bold text-slate-900">Mobiliário & Visual</span>
          </div>

          <div className="space-y-2 text-center lg:text-left">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Acesse sua conta</h1>
            <p className="text-sm text-slate-500">
              Entre com suas credenciais para gerenciar orçamentos e clientes.
            </p>
          </div>

          {/* Painel de Erro */}
          {error && (
            <div className="rounded-xl bg-red-50 p-4 border border-red-200 text-red-700 text-xs flex items-start gap-3 animate-in fade-in-50 duration-200">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
              <div className="leading-relaxed">{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold text-slate-700">
                E-mail corporativo
              </Label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="exemplo@corteplan.com.br"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`pl-10 h-11 text-sm bg-slate-50/50 ${
                    validationErrors.email ? 'border-red-500 focus-visible:ring-red-500' : ''
                  }`}
                  autoComplete="email"
                  disabled={loading}
                />
              </div>
              {validationErrors.email && (
                <p className="text-[11px] font-medium text-red-500">{validationErrors.email}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-semibold text-slate-700">
                  Senha de acesso
                </Label>
                <button
                  type="button"
                  onClick={() =>
                    alert(
                      'Para redefinir sua senha, solicite ao administrador do sistema ou entre com o usuário padrão (Skip@Pass).',
                    )
                  }
                  className="text-xs font-medium text-[#3A3A3C] hover:underline"
                >
                  Esqueceu sua senha?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Mínimo 8 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`pl-10 h-11 text-sm bg-slate-50/50 ${
                    validationErrors.password ? 'border-red-500 focus-visible:ring-red-500' : ''
                  }`}
                  autoComplete="current-password"
                  disabled={loading}
                />
              </div>
              {validationErrors.password && (
                <p className="text-[11px] font-medium text-red-500">{validationErrors.password}</p>
              )}
            </div>

            <div className="flex items-center space-x-2 pt-1">
              <Checkbox
                id="rememberMe"
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked === true)}
              />
              <label
                htmlFor="rememberMe"
                className="text-xs font-medium text-slate-600 leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                Lembrar de mim neste dispositivo
              </label>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-[#3A3A3C] hover:bg-[#2D2D2F] text-white font-semibold text-sm rounded-xl transition-all duration-200 shadow-md shadow-black/20 hover:scale-[1.01]"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Entrando no sistema...
                </>
              ) : (
                <>
                  Entrar
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          {/* Dica de acesso padrão */}
          <div className="p-3 bg-amber-50/80 rounded-xl border border-amber-200/60 text-xs text-amber-900">
            <span className="font-semibold">Usuário de demonstração:</span>
            <div className="mt-0.5 text-slate-600 flex justify-between items-center">
              <span>gustavo@corteplan.com.br</span>
              <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-amber-200 text-[11px]">
                Skip@Pass
              </span>
            </div>
          </div>

          <div className="text-center pt-2">
            <p className="text-xs text-slate-500">
              Não possui cadastro?{' '}
              <Link
                to="/cadastro"
                className="font-semibold text-[#3A3A3C] hover:text-[#2D2D2F] hover:underline"
              >
                Criar conta
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

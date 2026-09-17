import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import {
  Armchair,
  Mail,
  Lock,
  User,
  Loader2,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [validationErrors, setValidationErrors] = useState<{
    name?: string
    email?: string
    password?: string
    passwordConfirm?: string
  }>({})

  const validate = () => {
    const errs: {
      name?: string
      email?: string
      password?: string
      passwordConfirm?: string
    } = {}

    if (!name.trim()) {
      errs.name = 'Nome completo é obrigatório'
    }

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

    if (password !== passwordConfirm) {
      errs.passwordConfirm = 'As senhas não coincidem'
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
      await register(name.trim(), email.trim(), password)
      navigate('/', { replace: true })
    } catch (err: unknown) {
      console.error('Falha de cadastro:', err)
      setError('Não foi possível concluir o cadastro. O e-mail pode já estar em uso.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      {/* Coluna Esquerda: Visual Escuro com Gradiente (Desktop) */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#1E3A5F] flex-col justify-between p-12 text-white overflow-hidden">
        {/* Subtle geometric pattern / glow */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Logo superior */}
        <div className="flex items-center gap-3 relative z-10">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#1E3A5F] to-blue-600 text-white shadow-lg shadow-black/40 border border-slate-700/50">
            <Armchair className="h-6 w-6 text-amber-400" />
          </div>
          <div>
            <span className="text-xl font-bold tracking-tight text-white block">
              Mobiliário & Visual
            </span>
            <span className="text-xs text-slate-400 tracking-wider uppercase font-semibold">
              Sistema de Gestão Interno
            </span>
          </div>
        </div>

        {/* Hero Central */}
        <div className="space-y-6 relative z-10 max-w-lg">
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-800/80 px-3.5 py-1.5 text-xs font-medium text-amber-400 border border-amber-400/20 backdrop-blur-sm">
            <CheckCircle2 className="h-4 w-4" /> Novo Acesso Corporativo
          </div>

          <h2 className="text-4xl font-extrabold tracking-tight leading-tight text-white">
            Crie sua conta e comece a emitir propostas com{' '}
            <span className="bg-gradient-to-r from-amber-400 via-amber-200 to-white bg-clip-text text-transparent">
              precisão e agilidade
            </span>
          </h2>

          <p className="text-slate-300 text-base leading-relaxed">
            Centralize seus clientes, automatize números de orçamentos e gere documentos de
            propostas elegantes e prontos para impressão ou envio.
          </p>

          <div className="space-y-3 pt-2 text-sm text-slate-300">
            <div className="flex items-center gap-2.5">
              <div className="h-2 w-2 rounded-full bg-emerald-400" />
              <span>Numeração sequencial e contínua garantida no servidor</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="h-2 w-2 rounded-full bg-emerald-400" />
              <span>Linha do tempo e histórico completo de alterações de status</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="h-2 w-2 rounded-full bg-emerald-400" />
              <span>Layout clean para impressão técnica com cabeçalho corporativo</span>
            </div>
          </div>
        </div>

        {/* Rodapé da coluna visual */}
        <div className="text-xs text-slate-500 relative z-10">
          &copy; 2025 Mobiliário & Visual. Todos os direitos reservados.
        </div>
      </div>

      {/* Coluna Direita: Formulário de Cadastro */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 lg:p-16">
        <div className="w-full max-w-md space-y-7 bg-white p-8 sm:p-10 rounded-2xl shadow-sm border border-slate-200">
          {/* Mobile logo header */}
          <div className="lg:hidden flex items-center justify-center gap-3 pb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0F172A] text-white">
              <Armchair className="h-5 w-5 text-amber-400" />
            </div>
            <span className="text-lg font-bold text-slate-900">Mobiliário & Visual</span>
          </div>

          <div className="space-y-1.5 text-center lg:text-left">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Criar nova conta</h1>
            <p className="text-sm text-slate-500">
              Preencha os dados abaixo para ter acesso à plataforma.
            </p>
          </div>

          {/* Painel de Erro */}
          {error && (
            <div className="rounded-xl bg-red-50 p-4 border border-red-200 text-red-700 text-xs flex items-start gap-3 animate-in fade-in-50 duration-200">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
              <div className="leading-relaxed">{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="name" className="text-xs font-semibold text-slate-700">
                Nome completo
              </Label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="name"
                  type="text"
                  placeholder="Seu nome ou razão"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                    if (validationErrors.name) {
                      setValidationErrors((prev) => ({ ...prev, name: undefined }))
                    }
                  }}
                  className={`pl-10 h-10 text-sm bg-slate-50/50 ${
                    validationErrors.name ? 'border-red-500 focus-visible:ring-red-500' : ''
                  }`}
                  disabled={loading}
                />
              </div>
              {validationErrors.name && (
                <p className="text-[11px] font-medium text-red-500">{validationErrors.name}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="email" className="text-xs font-semibold text-slate-700">
                E-mail corporativo
              </Label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="usuario@empresa.com.br"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (validationErrors.email) {
                      setValidationErrors((prev) => ({ ...prev, email: undefined }))
                    }
                  }}
                  className={`pl-10 h-10 text-sm bg-slate-50/50 ${
                    validationErrors.email ? 'border-red-500 focus-visible:ring-red-500' : ''
                  }`}
                  disabled={loading}
                />
              </div>
              {validationErrors.email && (
                <p className="text-[11px] font-medium text-red-500">{validationErrors.email}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="password" className="text-xs font-semibold text-slate-700">
                Senha (mínimo 8 caracteres)
              </Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Mínimo 8 caracteres"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    if (validationErrors.password) {
                      setValidationErrors((prev) => ({ ...prev, password: undefined }))
                    }
                  }}
                  className={`pl-10 h-10 text-sm bg-slate-50/50 ${
                    validationErrors.password ? 'border-red-500 focus-visible:ring-red-500' : ''
                  }`}
                  disabled={loading}
                />
              </div>
              {validationErrors.password && (
                <p className="text-[11px] font-medium text-red-500">{validationErrors.password}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="passwordConfirm" className="text-xs font-semibold text-slate-700">
                Confirmar senha
              </Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="passwordConfirm"
                  type="password"
                  placeholder="Repita a senha digitada"
                  value={passwordConfirm}
                  onChange={(e) => {
                    setPasswordConfirm(e.target.value)
                    if (validationErrors.passwordConfirm) {
                      setValidationErrors((prev) => ({ ...prev, passwordConfirm: undefined }))
                    }
                  }}
                  className={`pl-10 h-10 text-sm bg-slate-50/50 ${
                    validationErrors.passwordConfirm
                      ? 'border-red-500 focus-visible:ring-red-500'
                      : ''
                  }`}
                  disabled={loading}
                />
              </div>
              {validationErrors.passwordConfirm && (
                <p className="text-[11px] font-medium text-red-500">
                  {validationErrors.passwordConfirm}
                </p>
              )}
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-[#1E3A5F] hover:bg-[#2A4E7A] text-white font-semibold text-sm rounded-xl transition-all duration-200 shadow-md shadow-[#1E3A5F]/20 hover:scale-[1.01] mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Criando conta...
                </>
              ) : (
                <>
                  Criar conta
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          <div className="text-center pt-2">
            <p className="text-xs text-slate-500">
              Já tem uma conta cadastrada?{' '}
              <Link
                to="/login"
                className="font-semibold text-[#1E3A5F] hover:text-[#2A4E7A] hover:underline"
              >
                Fazer login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

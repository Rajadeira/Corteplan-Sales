import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Mail, Lock, Loader2, AlertCircle, ArrowRight, Zap, Users, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import robotMascotImg from '@/assets/d54b79eb-9d0d-4995-bf27-319da4ab10c8-82c03.png'
import logoBrancoImg from '@/assets/logo-novo-corteplan-branco-58c7e.png'
import CorteplanLogo from '@/components/CorteplanLogo'

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
    <div className="flex min-h-screen w-full bg-[#171719] overflow-hidden select-none">
      {/* Coluna Esquerda: Visual Escuro com Mascote Robô (~56% de largura no desktop) */}
      <div className="hidden lg:flex lg:w-[56%] relative bg-[#131417] text-white flex-col justify-between p-8 xl:p-12 overflow-hidden">
        {/* Gradiente escuro de fundo com brilho laranja vindo do canto inferior esquerdo */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(circle at 10% 85%, rgba(240, 138, 36, 0.28) 0%, rgba(240, 110, 20, 0.12) 35%, transparent 70%), linear-gradient(135deg, #151619 0%, #0f1012 100%)',
          }}
        />

        {/* Linhas geométricas decorativas em laranja sutil (SVG de fundo idêntico à referência) */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none opacity-40"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Contorno geométrico no topo direito atrás do mascote */}
          <path
            d="M 420 40 L 580 40 Q 610 40 610 70 L 610 460 Q 610 490 580 490 L 320 490"
            fill="none"
            stroke="#F08A24"
            strokeWidth="2.5"
            strokeOpacity="0.55"
          />
          {/* Linha decorativa adicional sutil */}
          <path
            d="M 460 20 L 630 20 Q 640 20 640 30 L 640 200"
            fill="none"
            stroke="#F08A24"
            strokeWidth="1.5"
            strokeOpacity="0.25"
          />
          {/* Traço angular inferior decorativo */}
          <path
            d="M 300 700 L 400 700 Q 430 700 430 730 L 430 800"
            fill="none"
            stroke="#F08A24"
            strokeWidth="1.5"
            strokeOpacity="0.25"
          />
        </svg>

        {/* Halo laranja sutil sob a projeção holográfica e mão do mascote */}
        <div
          className="absolute top-[28%] left-[24%] w-80 h-80 rounded-full pointer-events-none blur-3xl opacity-35"
          style={{
            background: 'radial-gradient(circle, #F08A24 0%, transparent 70%)',
          }}
        />

        {/* Topo Esquerdo: Logo CORTEPLAN (versão branca oficial sobre fundo escuro) */}
        <div className="relative z-10">
          <div className="inline-block p-2 bg-[#1C1D21]/80 rounded-xl border border-white/10 shadow-lg shadow-black/40 backdrop-blur-sm">
            <img
              src={logoBrancoImg}
              alt="CORTEPLAN"
              className="h-10 sm:h-11 w-auto object-contain select-none"
            />
          </div>
        </div>

        {/* Imagem do Mascote Robô oficial sobre o fundo escuro com iluminação */}
        <div className="absolute right-[-2%] xl:right-[2%] bottom-0 top-[10%] w-[58%] max-w-[540px] pointer-events-none z-10 flex items-end justify-end">
          <img
            src={robotMascotImg}
            alt="Mascote Corteplan Robô"
            className="w-auto h-auto max-h-[92%] max-w-full object-contain select-none drop-shadow-[0_25px_35px_rgba(0,0,0,0.6)]"
          />
        </div>

        {/* Textos Centrais e Destaques (lado esquerdo) */}
        <div className="relative z-20 max-w-md my-auto pt-24 pb-8">
          <h1 className="text-3xl sm:text-4xl xl:text-[42px] font-black tracking-tight leading-[1.15] text-white">
            Sistema de Gestão <br />
            <span className="text-[#F08A24]">de Orçamentos</span>
          </h1>

          {/* Pequeno traço laranja horizontal abaixo do título */}
          <div className="w-12 h-1 bg-[#F08A24] rounded-full my-4" />

          <p className="text-slate-300 text-sm sm:text-base leading-relaxed pr-6 max-w-sm">
            Controle seus clientes, projetos e orçamentos de forma simples, rápida e eficiente.
          </p>
        </div>

        {/* Linha Inferior com 3 Itens de Destaque Lado a Lado */}
        <div className="relative z-20 pt-6 border-t border-white/10 grid grid-cols-3 gap-3 max-w-lg">
          {/* Item 1: Agilidade no Processo */}
          <div className="flex flex-col items-start gap-1.5">
            <div className="text-[#F08A24]">
              <Zap className="h-5 w-5 fill-[#F08A24]/20 stroke-[#F08A24] stroke-[2.2]" />
            </div>
            <div className="text-[10px] xl:text-[11px] font-bold tracking-wider leading-tight text-slate-300 uppercase">
              AGILIDADE
              <span className="block font-medium text-slate-400 text-[9px] xl:text-[10px]">
                NO PROCESSO
              </span>
            </div>
          </div>

          {/* Item 2: Clientes Mais Satisfeitos */}
          <div className="flex flex-col items-start gap-1.5">
            <div className="text-[#F08A24]">
              <Users className="h-5 w-5 stroke-[#F08A24] stroke-[2.2]" />
            </div>
            <div className="text-[10px] xl:text-[11px] font-bold tracking-wider leading-tight text-slate-300 uppercase">
              CLIENTES
              <span className="block font-medium text-slate-400 text-[9px] xl:text-[10px]">
                MAIS SATISFEITOS
              </span>
            </div>
          </div>

          {/* Item 3: Crescimento Sustentável */}
          <div className="flex flex-col items-start gap-1.5">
            <div className="text-[#F08A24]">
              <TrendingUp className="h-5 w-5 stroke-[#F08A24] stroke-[2.2]" />
            </div>
            <div className="text-[10px] xl:text-[11px] font-bold tracking-wider leading-tight text-slate-300 uppercase">
              CRESCIMENTO
              <span className="block font-medium text-slate-400 text-[9px] xl:text-[10px]">
                SUSTENTÁVEL
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Coluna Direita: Fundo Claro com Card Branco Elevado */}
      <div className="flex-1 bg-[#F4F5F7] flex items-center justify-center p-4 sm:p-8 lg:p-12 xl:p-16">
        <div className="w-full max-w-[460px] bg-white rounded-2xl shadow-[0_10px_35px_-5px_rgba(0,0,0,0.08),0_4px_12px_-2px_rgba(0,0,0,0.04)] border border-slate-100 p-7 sm:p-10 space-y-6">
          {/* Logo Corteplan visível no mobile no topo do card */}
          <div className="lg:hidden flex justify-center pb-2">
            <div className="inline-block px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-200 shadow-xs">
              <CorteplanLogo width={160} height={38} />
            </div>
          </div>

          {/* Título e Subtítulo */}
          <div className="space-y-1.5">
            <h2 className="text-2xl sm:text-[26px] font-extrabold tracking-tight text-[#1F242E]">
              Acesse sua conta
            </h2>
            <p className="text-xs sm:text-[13px] text-slate-500 leading-normal">
              Entre com suas credenciais para gerenciar orçamentos e clientes.
            </p>
          </div>

          {/* Mensagem de Erro com Fade-in */}
          {error && (
            <div className="rounded-xl bg-red-50 p-3.5 border border-red-200 text-red-700 text-xs flex items-start gap-2.5 animate-in fade-in-50 duration-200 shadow-sm">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
              <div className="leading-relaxed font-medium">{error}</div>
            </div>
          )}

          {/* Formulário de Login */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Campo E-mail */}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold text-slate-700 select-none">
                E-mail corporativo
              </Label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-slate-400 pointer-events-none" />
                <Input
                  id="email"
                  type="email"
                  placeholder="gustavo@corteplan.com.br"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`pl-10 h-11 text-sm bg-white border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus-visible:ring-1 focus-visible:ring-[#F08A24] focus-visible:border-[#F08A24] shadow-none ${
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

            {/* Campo Senha */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="password"
                  className="text-xs font-semibold text-slate-700 select-none"
                >
                  Senha de acesso
                </Label>
                <button
                  type="button"
                  onClick={() =>
                    alert(
                      'Para redefinir sua senha, solicite ao administrador do sistema ou entre com o usuário padrão de demonstração (Skip@Pass).',
                    )
                  }
                  className="text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors"
                >
                  Esqueceu sua senha?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-slate-400 pointer-events-none" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`pl-10 h-11 text-sm bg-white border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus-visible:ring-1 focus-visible:ring-[#F08A24] focus-visible:border-[#F08A24] shadow-none ${
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

            {/* Checkbox Lembrar de Mim */}
            <div className="flex items-center space-x-2 pt-0.5">
              <Checkbox
                id="rememberMe"
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked === true)}
                className="border-slate-300 data-[state=checked]:bg-[#2F343F] data-[state=checked]:border-[#2F343F]"
              />
              <label
                htmlFor="rememberMe"
                className="text-xs font-normal text-slate-600 leading-none select-none cursor-pointer"
              >
                Lembrar de mim neste dispositivo
              </label>
            </div>

            {/* Botão Entrar com Seta e Hover Microinteração */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-[#3A3C42] hover:bg-[#2A2B30] text-white font-medium text-sm rounded-lg transition-all duration-200 shadow-sm flex items-center justify-center gap-2 group cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Entrando no sistema...</span>
                </>
              ) : (
                <>
                  <span>Entrar</span>
                  <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                </>
              )}
            </Button>
          </form>

          {/* Card Inferior Destacado: Usuário de Demonstração */}
          <div className="rounded-xl border border-amber-200/70 bg-[#FFFDF7] p-3.5 text-xs">
            <div className="text-[11px] font-bold text-amber-800 tracking-wide">
              Usuário de demonstração:
            </div>
            <div className="mt-1 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setEmail('gustavo@corteplan.com.br')}
                className="text-slate-600 hover:text-[#F08A24] transition-colors text-xs truncate font-normal text-left"
                title="Clique para preencher o e-mail"
              >
                gustavo@corteplan.com.br
              </button>
              <button
                type="button"
                onClick={() => setPassword('Skip@Pass')}
                className="shrink-0 font-mono text-[11px] bg-white text-slate-700 px-2.5 py-1 rounded border border-slate-200 hover:border-amber-400 hover:text-amber-800 transition-colors shadow-2xs font-medium"
                title="Clique para preencher a senha"
              >
                Skip@Pass
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

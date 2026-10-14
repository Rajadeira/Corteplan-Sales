import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  ShieldAlert,
  Search,
  Building2,
  RefreshCw,
  Trash2,
  PlusCircle,
  ExternalLink,
  Info,
  Calendar,
  AlertCircle,
  TrendingDown,
  Clock,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from '@/hooks/use-toast'
import { maskCNPJ, cleanDocument, validateCNPJ, consultCNPJ } from '@/lib/cnpjCpfUtils'
import {
  calculateClientRisk,
  riskAnalysisService,
  type RiskAnalysisResult,
} from '@/services/riskAnalysis'
import { clientService } from '@/services/clients'
import type { ClientRecord, MonitoredClientRecord, RiskLevel } from '@/types'
import { formatDateBR, formatCurrencyBRL } from '@/types'
import { useAuth } from '@/contexts/AuthContext'

export interface RiskAnalysisTabProps {
  onGoToOrder?: (orderId: string) => void
}

export const RiskAnalysisTab: React.FC<RiskAnalysisTabProps> = () => {
  const { user } = useAuth()

  // Estados de busca
  const [cnpjInput, setCnpjInput] = useState('')
  const [cnpjError, setCnpjError] = useState<string | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Clientes cadastrados para dropdown / seleção rápida
  const [systemClients, setSystemClients] = useState<ClientRecord[]>([])
  const [selectedClientId, setSelectedClientId] = useState<string>('')

  // Resultado da consulta atual
  const [consultResult, setConsultResult] = useState<{
    razaoSocial: string
    nomeFantasia: string
    cnpj: string
    cnae: string
    cnaeDescricao: string
    naturezaJuridicaCodigo: string
    naturezaJuridicaDescricao: string
    situacaoCadastral: string
    fonte?: string
  } | null>(null)

  const [riskResult, setRiskResult] = useState<RiskAnalysisResult | null>(null)

  // Carteira de monitoramento
  const [monitoredList, setMonitoredList] = useState<MonitoredClientRecord[]>([])
  const [isLoadingMonitored, setIsLoadingMonitored] = useState(false)
  const [monitoredFilter, setMonitoredFilter] = useState('')
  const [reconsultingCnpj, setReconsultingCnpj] = useState<string | null>(null)

  // Feedback se o CNPJ atual está na carteira
  const isCurrentlyMonitored = useMemo(() => {
    if (!consultResult) return false
    const clean = cleanDocument(consultResult.cnpj)
    return monitoredList.some((m) => cleanDocument(m.cnpj) === clean)
  }, [consultResult, monitoredList])

  // Carregar lista de clientes do sistema para o seletor
  useEffect(() => {
    async function loadClients() {
      try {
        const list = await clientService.getAll()
        setSystemClients(list)
      } catch (err) {
        console.warn('Erro ao carregar clientes do sistema:', err)
      }
    }
    loadClients()
  }, [])

  // Carregar carteira de monitoramento
  const loadMonitoredList = useCallback(async () => {
    setIsLoadingMonitored(true)
    try {
      const list = await riskAnalysisService.listMonitored()
      setMonitoredList(list)
    } catch (err) {
      console.warn('Erro ao carregar carteira monitorada:', err)
    } finally {
      setIsLoadingMonitored(false)
    }
  }, [])

  useEffect(() => {
    loadMonitoredList()
  }, [loadMonitoredList])

  // Ao selecionar um cliente no dropdown
  const handleSelectClient = (clientId: string) => {
    setSelectedClientId(clientId)
    if (!clientId) return
    const cl = systemClients.find((c) => c.id === clientId)
    if (cl && cl.document_number) {
      setCnpjInput(maskCNPJ(cl.document_number))
      setCnpjError(null)
    }
  }

  // Realizar a consulta do CNPJ
  const handleConsult = async (targetCnpj?: string) => {
    const raw = targetCnpj || cnpjInput
    const clean = cleanDocument(raw)

    if (!clean) {
      setCnpjError('Informe o CNPJ para consulta.')
      return
    }

    if (clean.length !== 14) {
      setCnpjError('CNPJ deve conter 14 dígitos.')
      return
    }

    if (!validateCNPJ(clean)) {
      setCnpjError('CNPJ inválido (dígitos verificadores incorretos).')
      return
    }

    setCnpjError(null)
    setIsSearching(true)

    try {
      // 1. Consulta dados cadastrais
      const cad = await consultCNPJ(clean)

      // 2. Calcula risco financeiro com base nos dados reais do sistema
      const situacao = cad.situacaoCadastral || 'ATIVA'
      const risk = await calculateClientRisk(clean, situacao)

      const resultObj = {
        razaoSocial: cad.razaoSocial || 'RAZÃO SOCIAL NÃO INFORMADA',
        nomeFantasia: cad.nomeFantasia || cad.razaoSocial || '',
        cnpj: maskCNPJ(clean),
        cnae: cad.cnae || '',
        cnaeDescricao: cad.cnaeDescricao || '',
        naturezaJuridicaCodigo: cad.naturezaJuridicaCodigo || '',
        naturezaJuridicaDescricao: cad.naturezaJuridicaDescricao || '',
        situacaoCadastral: situacao,
        fonte: cad.fonte,
      }

      setConsultResult(resultObj)
      setRiskResult(risk)

      // Se já estava na carteira, atualiza os dados automaticamente
      const existingInList = monitoredList.find((m) => cleanDocument(m.cnpj) === clean)
      if (existingInList) {
        await riskAnalysisService.saveMonitored({
          cnpj: clean,
          razao_social: resultObj.razaoSocial,
          nome_fantasia: resultObj.nomeFantasia,
          risco: risk.level,
          risco_motivo: risk.reason,
          situacao_cadastral: resultObj.situacaoCadastral,
          cnae: resultObj.cnae,
          cnae_descricao: resultObj.cnaeDescricao,
          natureza_juridica: resultObj.naturezaJuridicaDescricao,
          natureza_juridica_codigo: resultObj.naturezaJuridicaCodigo,
          criado_por: user?.id,
        })
        loadMonitoredList()
      }

      toast({
        title: 'Consulta realizada com sucesso',
        description: `Dados de ${resultObj.razaoSocial} carregados.`,
      })
    } catch (err: any) {
      console.error('Erro na consulta de CNPJ:', err)
      setCnpjError(
        err?.message ||
          'Não foi possível consultar este CNPJ. Verifique a conexão e tente novamente.',
      )
      toast({
        title: 'Falha na consulta',
        description: err?.message || 'Não foi possível consultar os dados cadastrais do CNPJ.',
        variant: 'destructive',
      })
    } finally {
      setIsSearching(false)
    }
  }

  // Incluir na carteira de monitoramento
  const handleIncludeInWallet = async () => {
    if (!consultResult || !riskResult) return

    setIsSaving(true)
    try {
      const clean = cleanDocument(consultResult.cnpj)
      await riskAnalysisService.saveMonitored({
        cnpj: clean,
        razao_social: consultResult.razaoSocial,
        nome_fantasia: consultResult.nomeFantasia,
        risco: riskResult.level,
        risco_motivo: riskResult.reason,
        situacao_cadastral: consultResult.situacaoCadastral,
        cnae: consultResult.cnae,
        cnae_descricao: consultResult.cnaeDescricao,
        natureza_juridica: consultResult.naturezaJuridicaDescricao,
        natureza_juridica_codigo: consultResult.naturezaJuridicaCodigo,
        criado_por: user?.id,
      })

      await loadMonitoredList()

      toast({
        title: 'Cliente incluído na carteira!',
        description: `${consultResult.razaoSocial} agora é monitorado pelo sistema.`,
      })
    } catch (err: any) {
      console.error('Erro ao salvar na carteira:', err)
      toast({
        title: 'Erro ao incluir na carteira',
        description: err?.message || 'Falha ao salvar dados de monitoramento.',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  // Reconsultar cliente da carteira
  const handleReconsult = async (item: MonitoredClientRecord) => {
    setReconsultingCnpj(item.cnpj)
    try {
      setCnpjInput(maskCNPJ(item.cnpj))
      await handleConsult(item.cnpj)
    } finally {
      setReconsultingCnpj(null)
    }
  }

  // Remover da carteira
  const handleRemoveMonitored = async (item: MonitoredClientRecord) => {
    if (
      !confirm(
        `Deseja realmente remover ${item.razao_social} (${maskCNPJ(item.cnpj)}) da carteira de monitoramento?`,
      )
    ) {
      return
    }

    try {
      await riskAnalysisService.removeMonitored(item.id)
      await loadMonitoredList()
      toast({
        title: 'Removido da carteira',
        description: 'Cliente removido do monitoramento.',
      })
    } catch (err: any) {
      console.error('Erro ao remover da carteira:', err)
      toast({
        title: 'Erro ao remover',
        description: err?.message || 'Falha ao remover cliente da carteira.',
        variant: 'destructive',
      })
    }
  }

  // Helpers visuais de cores para Nível de Risco
  const getRiskBadgeStyles = (level: RiskLevel) => {
    switch (level) {
      case 'Baixo':
        return {
          dotColor: 'bg-emerald-500',
          textColor: 'text-emerald-700',
          bgColor: 'bg-emerald-50',
          borderColor: 'border-emerald-200',
          label: 'Baixo',
        }
      case 'Médio':
        return {
          dotColor: 'bg-amber-500',
          textColor: 'text-amber-800',
          bgColor: 'bg-amber-50',
          borderColor: 'border-amber-200',
          label: 'Médio',
        }
      case 'Alto':
        return {
          dotColor: 'bg-orange-500',
          textColor: 'text-orange-700',
          bgColor: 'bg-orange-50',
          borderColor: 'border-orange-200',
          label: 'Alto',
        }
      case 'Altíssimo':
        return {
          dotColor: 'bg-red-500',
          textColor: 'text-red-700',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          label: 'Altíssimo',
        }
      default:
        return {
          dotColor: 'bg-slate-400',
          textColor: 'text-slate-600',
          bgColor: 'bg-slate-100',
          borderColor: 'border-slate-200',
          label: 'Sem histórico',
        }
    }
  }

  // Helper visual para Status Cadastral
  const getStatusCadastralBadge = (statusStr: string) => {
    const s = (statusStr || '').toUpperCase().trim()
    const isAtivo = s === 'ATIVA' || s === 'ATIVO'
    if (isAtivo) {
      return {
        label: 'Ativo',
        className: 'bg-[#00a859] hover:bg-[#00924c] text-white font-semibold',
      }
    }
    if (s.includes('BAIXADA')) {
      return {
        label: 'Baixada',
        className: 'bg-red-600 hover:bg-red-700 text-white font-semibold',
      }
    }
    if (s.includes('INAPTA')) {
      return {
        label: 'Inapta',
        className: 'bg-red-600 hover:bg-red-700 text-white font-semibold',
      }
    }
    if (s.includes('SUSPENSA')) {
      return {
        label: 'Suspensa',
        className: 'bg-amber-600 hover:bg-amber-700 text-white font-semibold',
      }
    }
    return {
      label: statusStr || 'Indefinido',
      className: 'bg-slate-500 hover:bg-slate-600 text-white font-semibold',
    }
  }

  // Filtragem da lista da carteira
  const filteredMonitoredList = useMemo(() => {
    if (!monitoredFilter.trim()) return monitoredList
    const q = monitoredFilter.toLowerCase().trim()
    const cleanQ = cleanDocument(monitoredFilter)
    return monitoredList.filter((m) => {
      const matchRazao = m.razao_social?.toLowerCase().includes(q)
      const matchFantasia = m.nome_fantasia?.toLowerCase().includes(q)
      const matchCnpj = m.cnpj?.includes(cleanQ) || m.cnpj?.includes(q)
      const matchRisco = m.risco?.toLowerCase().includes(q)
      return matchRazao || matchFantasia || matchCnpj || matchRisco
    })
  }, [monitoredList, monitoredFilter])

  return (
    <div className="space-y-6">
      {/* Barra de Filtro / Seleção / Busca de CNPJ */}
      <Card className="rounded-2xl border-slate-200 shadow-xs">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle className="text-base sm:text-lg flex items-center gap-2 font-bold text-slate-900">
                <ShieldAlert className="h-5 w-5 text-[#F08A24]" />
                Consulta de Análise de Risco &amp; Situação Cadastral
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 mt-0.5">
                Consulte dados cadastrais oficiais e avalie a inadimplência interna baseada no
                histórico de parcelas e pedidos.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider bg-slate-100 px-2 py-1 rounded-md">
                Inspirado no Serasa Monitora
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            {/* Seletor de Cliente do Sistema */}
            <div className="md:col-span-5 space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-slate-400" />
                Selecionar Cliente Já Cadastrado (Opcional):
              </label>
              <Select value={selectedClientId} onValueChange={handleSelectClient}>
                <SelectTrigger className="h-10 text-xs rounded-xl bg-slate-50/50">
                  <SelectValue placeholder="Selecione um cliente para preencher CNPJ..." />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {systemClients
                    .filter(
                      (c) =>
                        c.document_type === 'CNPJ' ||
                        (c.document_number && cleanDocument(c.document_number).length === 14),
                    )
                    .map((client) => (
                      <SelectItem key={client.id} value={client.id} className="text-xs">
                        {client.company || client.name} — {maskCNPJ(client.document_number || '')}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Input de CNPJ */}
            <div className="md:col-span-4 space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                <span>CNPJ do Cliente / Fornecedor:</span>
                {cnpjInput && (
                  <span className="text-[10px] text-slate-400 font-mono">
                    {cleanDocument(cnpjInput).length}/14 dígitos
                  </span>
                )}
              </label>
              <div className="relative">
                <Input
                  type="text"
                  placeholder="00.000.000/0000-00"
                  value={cnpjInput}
                  onChange={(e) => {
                    setCnpjInput(maskCNPJ(e.target.value))
                    setCnpjError(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleConsult()
                    }
                  }}
                  className="h-10 text-xs sm:text-sm font-mono rounded-xl pl-3 pr-8"
                  maxLength={18}
                />
              </div>
            </div>

            {/* Botão Consultar */}
            <div className="md:col-span-3 flex items-center gap-2">
              <Button
                type="button"
                onClick={() => handleConsult()}
                disabled={isSearching}
                className="w-full h-10 rounded-xl bg-[#3A3A3C] hover:bg-[#2D2D2F] text-white font-medium text-xs sm:text-sm flex items-center justify-center gap-2"
              >
                {isSearching ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin text-[#F08A24]" />
                    Consultando...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 text-[#F08A24]" />
                    Consultar
                  </>
                )}
              </Button>
            </div>
          </div>

          {cnpjError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
              <span>{cnpjError}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* =========================================================================
          PAINEL DE ANÁLISE DE RISCO — VISUAL FIEL AO SERASA MONITORA
          ========================================================================= */}
      {consultResult && riskResult && (
        <div className="space-y-4 animate-in fade-in-50 duration-300">
          {/* Container Azul-Escuro Arredondado com Cabeçalho e Bloco Branco */}
          <div className="bg-[#1E4B8F] text-white rounded-3xl p-5 sm:p-7 shadow-lg border border-[#16386C]">
            {/* Cabeçalho do Painel Azul */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
              <div className="flex items-start sm:items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0 text-white">
                  <Sparkles className="h-4 w-4 text-amber-300" />
                </div>
                <div className="text-sm sm:text-base font-normal leading-snug">
                  {isCurrentlyMonitored ? (
                    <>
                      Você incluiu{' '}
                      <strong className="font-extrabold uppercase tracking-wide text-white">
                        {consultResult.razaoSocial}
                      </strong>{' '}
                      à sua carteira de clientes e fornecedores.
                    </>
                  ) : (
                    <>
                      Consulta cadastral e análise interna de:{' '}
                      <strong className="font-extrabold uppercase tracking-wide text-white">
                        {consultResult.razaoSocial}
                      </strong>
                    </>
                  )}
                </div>
              </div>

              {/* Botão de Incluir na Carteira se ainda não estiver salvo */}
              {!isCurrentlyMonitored && (
                <Button
                  onClick={handleIncludeInWallet}
                  disabled={isSaving}
                  className="rounded-2xl bg-white text-[#1E4B8F] hover:bg-slate-100 font-bold text-xs h-9 px-4 shrink-0 shadow-sm"
                >
                  {isSaving ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <PlusCircle className="h-3.5 w-3.5 mr-1.5 text-[#1E4B8F]" />
                      Incluir na carteira de monitoramento
                    </>
                  )}
                </Button>
              )}
            </div>

            {/* Bloco Branco Arredondado Interno: Dados Cadastrais com Rótulos Pequenos em Maiúsculas */}
            <div className="bg-white text-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
              {/* NOME FANTASIA */}
              <div>
                <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                  NOME FANTASIA
                </span>
                <span className="text-base sm:text-lg font-bold text-slate-900 uppercase">
                  {consultResult.nomeFantasia || consultResult.razaoSocial || '—'}
                </span>
              </div>

              {/* CNPJ */}
              <div>
                <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                  CNPJ
                </span>
                <span className="text-sm sm:text-base font-mono font-bold text-slate-800">
                  {consultResult.cnpj}
                </span>
              </div>

              {/* CNAE */}
              <div>
                <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                  CNAE
                </span>
                <span className="text-xs sm:text-sm text-slate-700 uppercase font-medium">
                  {consultResult.cnae ? (
                    <>
                      <span className="font-semibold text-slate-900">{consultResult.cnae}</span>
                      {consultResult.cnaeDescricao && (
                        <span className="text-slate-600"> | {consultResult.cnaeDescricao}</span>
                      )}
                    </>
                  ) : (
                    <span className="text-slate-400">Não informado</span>
                  )}
                </span>
              </div>

              {/* COD. E DESCRIÇÃO DA NAT. JURÍDICA */}
              <div>
                <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                  COD. E DESCRIÇÃO DA NAT. JURÍDICA
                </span>
                <span className="text-xs sm:text-sm text-slate-700 uppercase font-medium">
                  {consultResult.naturezaJuridicaCodigo ||
                  consultResult.naturezaJuridicaDescricao ? (
                    <>
                      {consultResult.naturezaJuridicaCodigo && (
                        <span className="font-semibold text-slate-900">
                          {consultResult.naturezaJuridicaCodigo} |{' '}
                        </span>
                      )}
                      <span className="text-slate-600">
                        {consultResult.naturezaJuridicaDescricao}
                      </span>
                    </>
                  ) : (
                    <span className="text-slate-400">Não informada</span>
                  )}
                </span>
              </div>
            </div>

            {/* Dois Cards Lado a Lado: Risco de Inadimplência e Status Cadastral */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mt-4">
              {/* Card 1: RISCO DE INADIMPLÊNCIA */}
              {(() => {
                const styles = getRiskBadgeStyles(riskResult.level)
                return (
                  <div className="bg-white text-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col justify-between">
                    <div>
                      <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2.5">
                        RISCO DE INADIMPLÊNCIA
                      </span>
                      <div className="flex items-center gap-2">
                        <span className={`h-3 w-3 rounded-full shrink-0 ${styles.dotColor}`} />
                        <span className="text-sm sm:text-base font-bold text-slate-800">
                          {riskResult.level}
                        </span>
                      </div>
                    </div>

                    {/* Linha explicativa "Por quê?" */}
                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-start gap-1.5 text-[11px] text-slate-500">
                      <Info className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <div className="leading-tight">
                        <strong className="font-semibold text-slate-700">Fatores: </strong>
                        <span>{riskResult.reason}</span>
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* Card 2: STATUS CADASTRAL */}
              {(() => {
                const badge = getStatusCadastralBadge(consultResult.situacaoCadastral)
                return (
                  <div className="bg-white text-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col justify-between">
                    <div>
                      <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2.5">
                        STATUS CADASTRAL
                      </span>
                      <div>
                        <span
                          className={`inline-block px-5 py-1.5 rounded-full text-xs sm:text-sm shadow-xs ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                      <span>Receita Federal do Brasil</span>
                      {consultResult.fonte && (
                        <span className="font-medium text-slate-500">
                          Fonte: {consultResult.fonte}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>

          {/* Resumo Complementar de Parcelas do Sistema Interno */}
          {riskResult.stats.hasHistory && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Total de Parcelas
                </span>
                <span className="text-base font-bold text-slate-800 font-mono">
                  {riskResult.stats.totalInstallments}
                </span>
                <span className="text-[10px] text-slate-500 block">
                  {formatCurrencyBRL(riskResult.stats.totalAmount)}
                </span>
              </div>

              <div className="p-3 bg-emerald-50 rounded-xl">
                <span className="text-[10px] uppercase font-bold text-emerald-700 block">
                  Parcelas Quitadas
                </span>
                <span className="text-base font-bold text-emerald-800 font-mono">
                  {riskResult.stats.paidInstallments}
                </span>
                <span className="text-[10px] text-emerald-600 block">
                  {formatCurrencyBRL(riskResult.stats.paidAmount)}
                </span>
              </div>

              <div className="p-3 bg-amber-50 rounded-xl">
                <span className="text-[10px] uppercase font-bold text-amber-700 block">
                  A Vencer (Em dia)
                </span>
                <span className="text-base font-bold text-amber-800 font-mono">
                  {riskResult.stats.futureInstallments}
                </span>
                <span className="text-[10px] text-amber-600 block">
                  {formatCurrencyBRL(riskResult.stats.futureAmount)}
                </span>
              </div>

              <div
                className={`p-3 rounded-xl ${
                  riskResult.stats.overdueInstallments > 0
                    ? 'bg-red-50 text-red-900'
                    : 'bg-slate-50 text-slate-600'
                }`}
              >
                <span className="text-[10px] uppercase font-bold block">Vencidas em Atraso</span>
                <span className="text-base font-bold font-mono">
                  {riskResult.stats.overdueInstallments}
                </span>
                <span className="text-[10px] block opacity-90">
                  {formatCurrencyBRL(riskResult.stats.overdueAmount)}
                  {riskResult.stats.maxOverdueDays > 0 &&
                    ` (${riskResult.stats.maxOverdueDays} dias)`}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          LISTA: CARTEIRA DE MONITORAMENTO
          ========================================================================= */}
      <Card className="rounded-2xl border-slate-200 shadow-xs overflow-hidden">
        <CardHeader className="bg-slate-50/60 pb-4 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-[#F08A24]" />
                Carteira de Monitoramento
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Empresas adicionadas para acompanhamento contínuo de risco e situação cadastral.
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Buscar na carteira..."
                  value={monitoredFilter}
                  onChange={(e) => setMonitoredFilter(e.target.value)}
                  className="h-8 text-xs pl-8 rounded-xl"
                />
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={loadMonitoredList}
                disabled={isLoadingMonitored}
                className="h-8 text-xs rounded-xl border-slate-200"
                title="Recarregar carteira"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 text-slate-500 ${
                    isLoadingMonitored ? 'animate-spin text-[#F08A24]' : ''
                  }`}
                />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6">
          {isLoadingMonitored && monitoredList.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
              <RefreshCw className="h-6 w-6 animate-spin text-[#F08A24]" />
              Carregando carteira de monitoramento...
            </div>
          ) : filteredMonitoredList.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              {monitoredList.length === 0
                ? 'Nenhum cliente incluído na carteira de monitoramento ainda. Faça uma consulta acima e clique em "Incluir na carteira de monitoramento".'
                : 'Nenhum cliente encontrado com os termos pesquisados.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredMonitoredList.map((item) => {
                const styles = getRiskBadgeStyles(item.risco)
                const isReconsulting = reconsultingCnpj === item.cnpj

                return (
                  <div
                    key={item.id}
                    className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs transition-all flex flex-col justify-between space-y-3"
                  >
                    <div>
                      {/* Topo do Card: Badge de Risco + Status Cadastral */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${styles.bgColor} ${styles.textColor} ${styles.borderColor}`}
                        >
                          <span className={`h-2 w-2 rounded-full ${styles.dotColor}`} />
                          <span>Risco {item.risco}</span>
                        </div>

                        <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                          {item.situacao_cadastral || 'Ativo'}
                        </span>
                      </div>

                      {/* Razão Social e Fantasia */}
                      <h4
                        className="font-bold text-sm text-slate-900 line-clamp-1"
                        title={item.razao_social}
                      >
                        {item.razao_social}
                      </h4>
                      {item.nome_fantasia && item.nome_fantasia !== item.razao_social && (
                        <p className="text-xs text-slate-500 line-clamp-1 mb-1">
                          {item.nome_fantasia}
                        </p>
                      )}

                      {/* CNPJ */}
                      <div className="text-xs font-mono text-slate-600 mt-1">
                        {maskCNPJ(item.cnpj)}
                      </div>

                      {/* Motivo do Risco */}
                      {item.risco_motivo && (
                        <p className="text-[11px] text-slate-500 mt-2 line-clamp-2 leading-relaxed bg-slate-50 p-2 rounded-lg border border-slate-100">
                          {item.risco_motivo}
                        </p>
                      )}
                    </div>

                    {/* Rodapé do Card: Data de Consulta + Ações */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-slate-400" />
                        {item.ultima_consulta
                          ? formatDateBR(item.ultima_consulta)
                          : formatDateBR(item.created)}
                      </span>

                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleReconsult(item)}
                          disabled={isReconsulting}
                          className="h-7 px-2 text-xs text-slate-700 hover:text-[#F08A24] rounded-lg"
                          title="Reconsultar cliente"
                        >
                          <RefreshCw
                            className={`h-3 w-3 mr-1 ${
                              isReconsulting ? 'animate-spin text-[#F08A24]' : ''
                            }`}
                          />
                          Atualizar
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveMonitored(item)}
                          className="h-7 px-2 text-xs text-red-600 hover:bg-red-50 hover:text-red-700 rounded-lg"
                          title="Remover da carteira"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

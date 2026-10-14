import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  History,
  Building2,
  Calendar,
  User,
  ShieldCheck,
  FileBadge2,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Trash2,
  Globe2,
  Info,
} from 'lucide-react'
import type { RiskInquiryRecord } from '@/types'
import { formatDateBR, formatDateTimeBR } from '@/types'
import { maskCNPJ } from '@/lib/cnpjCpfUtils'

interface RiskInquiryDetailModalProps {
  inquiry: RiskInquiryRecord | null
  isOpen: boolean
  onClose: () => void
  onDelete?: (inquiry: RiskInquiryRecord) => void
  isAdmin?: boolean
}

// Helper defensivo para extrair string de status
function extractStatusString(val: unknown): string {
  if (val === null || val === undefined) return ''
  if (typeof val === 'string') return val
  if (typeof val === 'number' || typeof val === 'boolean') return String(val)
  if (typeof val === 'object') {
    const obj = val as Record<string, unknown>
    const candidate =
      obj.status ??
      obj.situacao ??
      obj.descricao ??
      obj.resultado ??
      obj.mensagem ??
      obj.label ??
      obj.value
    if (typeof candidate === 'string') return candidate
    if (candidate !== null && candidate !== undefined && typeof candidate !== 'object') {
      return String(candidate)
    }
  }
  return ''
}

export const RiskInquiryDetailModal: React.FC<RiskInquiryDetailModalProps> = ({
  inquiry,
  isOpen,
  onClose,
  onDelete,
  isAdmin,
}) => {
  if (!inquiry) return null

  const isExternal = inquiry.source === 'external'

  // Situação cadastral / dados da empresa
  const sitObj =
    typeof inquiry.situation === 'object' && inquiry.situation !== null
      ? (inquiry.situation as Record<string, unknown>)
      : {}
  const situacaoCadastralStr =
    typeof inquiry.situation === 'string'
      ? inquiry.situation
      : extractStatusString(sitObj.situacao) || 'ATIVA'
  const cnaeStr = sitObj.cnae ? String(sitObj.cnae) : ''
  const cnaeDescStr = sitObj.cnae_descricao ? String(sitObj.cnae_descricao) : ''
  const natJurStr = sitObj.natureza_juridica ? String(sitObj.natureza_juridica) : ''
  const natJurCodStr = sitObj.natureza_juridica_codigo
    ? String(sitObj.natureza_juridica_codigo)
    : ''

  // Certidões
  const cndFedObj =
    typeof inquiry.cnd_federal === 'object' && inquiry.cnd_federal !== null
      ? (inquiry.cnd_federal as Record<string, unknown>)
      : {}
  const cndFedStatus = extractStatusString(cndFedObj.status ?? inquiry.cnd_federal)
  const cndFedValidade = typeof cndFedObj.validade === 'string' ? cndFedObj.validade : ''
  const cndFedNumero = typeof cndFedObj.numero === 'string' ? cndFedObj.numero : ''

  const cndtObj =
    typeof inquiry.cndt === 'object' && inquiry.cndt !== null
      ? (inquiry.cndt as Record<string, unknown>)
      : {}
  const cndtStatus = extractStatusString(cndtObj.status ?? inquiry.cndt)
  const cndtValidade = typeof cndtObj.validade === 'string' ? cndtObj.validade : ''
  const cndtNumero = typeof cndtObj.numero === 'string' ? cndtObj.numero : ''

  // Alertas
  const alerts: Array<{ texto: string; tipo?: string }> = []
  if (Array.isArray(inquiry.external_alerts)) {
    inquiry.external_alerts.forEach((a) => {
      if (typeof a === 'string') alerts.push({ texto: a })
      else if (a && typeof a === 'object') {
        alerts.push({
          texto: (a as any).texto || (a as any).mensagem || JSON.stringify(a),
          tipo: (a as any).tipo,
        })
      }
    })
  }

  // Motivos internos
  const internalReasons: string[] = []
  if (Array.isArray(inquiry.internal_reasons)) {
    inquiry.internal_reasons.forEach((r) => {
      if (typeof r === 'string') internalReasons.push(r)
      else if (r) internalReasons.push(String(r))
    })
  } else if (typeof inquiry.internal_reasons === 'string') {
    internalReasons.push(inquiry.internal_reasons)
  }

  const requestedByName = inquiry.expand?.requested_by?.name || 'Sistema'

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-6">
        <DialogHeader className="pb-3 border-b border-slate-100">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge
                  className={
                    isExternal
                      ? 'bg-[#F08A24] hover:bg-[#d87616] text-white border-none text-[11px]'
                      : 'bg-[#1E4B8F] hover:bg-[#16386C] text-white border-none text-[11px]'
                  }
                >
                  {isExternal ? 'Pesquisa Externa — Confere CNPJ' : 'Consulta Interna de Risco'}
                </Badge>
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatDateTimeBR(inquiry.created)}
                </span>
              </div>
              <DialogTitle className="text-lg font-bold text-slate-900 leading-tight">
                {inquiry.razao_social}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 font-mono mt-0.5">
                CNPJ: {maskCNPJ(inquiry.cnpj)}
                {inquiry.nome_fantasia && inquiry.nome_fantasia !== inquiry.razao_social && (
                  <span className="font-sans ml-2 text-slate-600">
                    · Fantasia: {inquiry.nome_fantasia}
                  </span>
                )}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Card: Metadados da Consulta */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Solicitado por
              </span>
              <span className="font-semibold text-slate-800 flex items-center gap-1 mt-0.5">
                <User className="h-3 w-3 text-slate-400" />
                {requestedByName}
              </span>
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Situação Cadastral
              </span>
              <span className="font-semibold text-slate-800 mt-0.5 block">
                {situacaoCadastralStr || 'ATIVA'}
              </span>
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Data / Hora
              </span>
              <span className="font-medium text-slate-700 mt-0.5 block">
                {formatDateTimeBR(inquiry.created)}
              </span>
            </div>
          </div>

          {/* Scores (Interno e Externo) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Score Interno */}
            <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  Risco Interno (Fluxo de Caixa)
                </span>
                {inquiry.internal_score_label && (
                  <Badge variant="outline" className="text-[10px] font-semibold border-slate-200">
                    {inquiry.internal_score_label}
                  </Badge>
                )}
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900">
                  {inquiry.internal_score !== null && inquiry.internal_score !== undefined
                    ? `${inquiry.internal_score}/100`
                    : inquiry.internal_score_label || 'Não avaliado'}
                </span>
              </div>
              {internalReasons.length > 0 && (
                <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-600 space-y-1">
                  <span className="font-semibold text-slate-700 block">Fatores identificados:</span>
                  {internalReasons.map((r, i) => (
                    <p key={i} className="leading-snug text-slate-600">
                      • {r}
                    </p>
                  ))}
                </div>
              )}
            </div>

            {/* Score Externo */}
            <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1">
                  <Globe2 className="h-3 w-3 text-[#F08A24]" />
                  Score Confere CNPJ
                </span>
                {inquiry.external_score_label && (
                  <Badge className="text-[10px] font-bold bg-[#F08A24]/10 text-[#F08A24] border border-[#F08A24]/30">
                    {inquiry.external_score_label}
                  </Badge>
                )}
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900">
                  {inquiry.external_score !== null && inquiry.external_score !== undefined
                    ? `${inquiry.external_score}/100`
                    : '—'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                {inquiry.external_score !== null && inquiry.external_score !== undefined
                  ? 'Score de confiança oficial gerado por IA e cruzamento de bases.'
                  : 'Pesquisa externa não retornou pontuação numérica.'}
              </p>
            </div>
          </div>

          {/* Certidões CND e CNDT */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1">
                  <FileBadge2 className="h-3.5 w-3.5 text-slate-400" />
                  CND Federal (Receita/PGFN)
                </span>
              </div>
              <span className="inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full bg-white border border-slate-200 text-slate-800">
                {cndFedStatus || 'Não consultada'}
              </span>
              {cndFedValidade && (
                <p className="text-[11px] text-slate-500">
                  Validade:{' '}
                  <strong className="text-slate-700">{formatDateBR(cndFedValidade)}</strong>
                </p>
              )}
              {cndFedNumero && (
                <p className="text-[10px] text-slate-400 font-mono truncate">Nº {cndFedNumero}</p>
              )}
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5 text-slate-400" />
                  CNDT (Justiça do Trabalho)
                </span>
              </div>
              <span className="inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full bg-white border border-slate-200 text-slate-800">
                {cndtStatus || 'Não consultada'}
              </span>
              {cndtValidade && (
                <p className="text-[11px] text-slate-500">
                  Validade: <strong className="text-slate-700">{formatDateBR(cndtValidade)}</strong>
                </p>
              )}
              {cndtNumero && (
                <p className="text-[10px] text-slate-400 font-mono truncate">Nº {cndtNumero}</p>
              )}
            </div>
          </div>

          {/* Dados Cadastrais Detalhados (CNAE, Nat Jurídica) */}
          {(cnaeStr || natJurStr) && (
            <div className="p-3.5 bg-white rounded-xl border border-slate-200 text-xs space-y-2">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                Ficha Cadastral Complementar
              </span>
              {cnaeStr && (
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">
                    CNAE Principal:
                  </span>
                  <span className="font-semibold text-slate-800">{cnaeStr}</span>
                  {cnaeDescStr && <span className="text-slate-600"> — {cnaeDescStr}</span>}
                </div>
              )}
              {natJurStr && (
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">
                    Natureza Jurídica:
                  </span>
                  {natJurCodStr && (
                    <span className="font-semibold text-slate-800">{natJurCodStr} — </span>
                  )}
                  <span className="text-slate-700">{natJurStr}</span>
                </div>
              )}
            </div>
          )}

          {/* Alertas Externos */}
          {alerts.length > 0 && (
            <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2 text-xs">
              <span className="font-bold text-amber-900 block flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                Alertas da Consulta Externa ({alerts.length})
              </span>
              <div className="space-y-1">
                {alerts.map((al, idx) => (
                  <p key={idx} className="text-amber-800 leading-snug">
                    • {al.texto}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Resumo Bruto se houver */}
          {inquiry.raw_summary && (
            <details className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <summary className="font-semibold text-slate-700 cursor-pointer">
                Ver detalhes brutos técnicos (JSON / Resumo)
              </summary>
              <pre className="mt-2 whitespace-pre-wrap font-mono text-[10px] max-h-40 overflow-y-auto bg-white p-2 rounded border border-slate-200">
                {inquiry.raw_summary}
              </pre>
            </details>
          )}
        </div>

        {/* Rodapé do Modal */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
          {isAdmin && onDelete ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onDelete(inquiry)}
              className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 h-8 rounded-xl"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Excluir do Histórico
            </Button>
          ) : (
            <div />
          )}

          <Button
            type="button"
            onClick={onClose}
            className="h-8 px-4 text-xs rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-medium"
          >
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

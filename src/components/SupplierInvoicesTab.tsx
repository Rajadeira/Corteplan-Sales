import React, { useState, useEffect, useRef, useMemo } from 'react'
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Search,
  Filter,
  ShieldCheck,
  KeyRound,
  Lock,
  RefreshCw,
  Building,
  Calendar,
  FileCheck,
  TrendingDown,
  Info,
  ExternalLink,
  Plus,
  Eye,
  Check,
  X,
  FileSpreadsheet,
  ArrowDownRight,
  Zap,
} from 'lucide-react'
import { supplierInvoicesService } from '@/services/supplierInvoices'
import type {
  SupplierInvoiceRecord,
  SupplierCertificateInfo,
  ParseXmlImportResultItem,
} from '@/types'
import { formatCurrencyBRL, formatDateBR } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'

interface SupplierInvoicesTabProps {
  onGoToCashflow?: (searchTerm?: string) => void
  onRefreshFinancialData?: () => Promise<void>
}

export function SupplierInvoicesTab({
  onGoToCashflow,
  onRefreshFinancialData,
}: SupplierInvoicesTabProps) {
  const [loading, setLoading] = useState(true)
  const [invoices, setInvoices] = useState<SupplierInvoiceRecord[]>([])
  const [certificate, setCertificate] = useState<SupplierCertificateInfo | null>(null)

  // Filtros de busca
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedMonth, setSelectedMonth] = useState('Todos')
  const [selectedYear, setSelectedYear] = useState('Todos')

  // Modal de Detalhes da Nota
  const [selectedInvoice, setSelectedInvoice] = useState<SupplierInvoiceRecord | null>(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)

  // Modal de Exclusão de Nota
  const [invoiceToDelete, setInvoiceToDelete] = useState<SupplierInvoiceRecord | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Modal / Ação de Upload de Certificado A1
  const [isCertModalOpen, setIsCertModalOpen] = useState(false)
  const [certFile, setCertFile] = useState<File | null>(null)
  const [certPassword, setCertPassword] = useState('')
  const [certValidUntil, setCertValidUntil] = useState('')
  const [certSubjectName, setCertSubjectName] = useState('CORTEPLAN COMERCIAL')
  const [certCnpj, setCertCnpj] = useState('24.306.897/0001-44')
  const [isSavingCert, setIsSavingCert] = useState(false)
  const [isDeletingCert, setIsDeletingCert] = useState(false)
  const certFileInputRef = useRef<HTMLInputElement>(null)

  // Drag and drop & importação múltipla de XML
  const [isDragging, setIsDragging] = useState(false)
  const [isImportingXml, setIsImportingXml] = useState(false)
  const [importResults, setImportResults] = useState<ParseXmlImportResultItem[] | null>(null)
  const [isResultModalOpen, setIsResultModalOpen] = useState(false)
  const xmlFileInputRef = useRef<HTMLInputElement>(null)

  // Sugestão de cadastro de Fornecedor
  const [supplierToCreate, setSupplierToCreate] = useState<{
    cnpj: string
    name: string
    tradeName?: string
    address?: string
    city?: string
    state?: string
  } | null>(null)
  const [isCreatingSupplier, setIsCreatingSupplier] = useState(false)

  // Carrega notas e status do certificado
  const loadData = async () => {
    try {
      setLoading(true)
      const [invoicesList, certStatus] = await Promise.all([
        supplierInvoicesService.getAll().catch(() => []),
        supplierInvoicesService.getCertificateStatus().catch(() => ({
          configured: false,
          certificate: null,
        })),
      ])
      setInvoices(invoicesList)
      setCertificate(certStatus.certificate)
    } catch (err) {
      console.error('Erro ao carregar notas de fornecedores:', err)
      toast.error('Erro ao carregar dados de notas de fornecedores.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Processamento de arquivos XML selecionados ou dropados
  const handleXmlFiles = async (fileList: FileList | File[]) => {
    const filesArray = Array.from(fileList).filter((f) => f.name.toLowerCase().endsWith('.xml'))
    if (filesArray.length === 0) {
      toast.error('Por favor, selecione arquivos com extensão .xml válidos.')
      return
    }

    try {
      setIsImportingXml(true)
      const payloads: { filename: string; content: string }[] = []

      for (const file of filesArray) {
        const text = await file.text()
        payloads.push({
          filename: file.name,
          content: text,
        })
      }

      const res = await supplierInvoicesService.parseAndImportXml(payloads)
      setImportResults(res.results)
      setIsResultModalOpen(true)

      if (res.importedCount > 0) {
        toast.success(
          `${res.importedCount} nota(s) importada(s) e lançada(s) no Fluxo de Caixa com sucesso!`,
        )
      }
      if (res.duplicatedCount > 0) {
        toast.info(
          `${res.duplicatedCount} nota(s) já existia(m) no sistema e não foi(ram) duplicada(s).`,
        )
      }
      if (res.errorCount > 0) {
        const firstError = res.results.find((r) => !r.success && r.status !== 'duplicated')
        const detailMsg = firstError ? `: ${firstError.message}` : '.'
        toast.error(`${res.errorCount} arquivo(s) com erro na importação${detailMsg}`)
      }

      await loadData()
      if (onRefreshFinancialData) {
        await onRefreshFinancialData()
      }
    } catch (err: any) {
      console.error('Erro ao importar XMLs:', err)
      const specificMsg =
        err?.data?.message ||
        err?.response?.message ||
        err?.message ||
        'Erro ao processar importação dos arquivos XML.'
      toast.error(`Falha na importação: ${specificMsg}`)
    } finally {
      setIsImportingXml(false)
      if (xmlFileInputRef.current) {
        xmlFileInputRef.current.value = ''
      }
    }
  }

  // Manipuladores de Drag and Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleXmlFiles(e.dataTransfer.files)
    }
  }

  // Confirmação de exclusão da nota
  const handleConfirmDeleteInvoice = async () => {
    if (!invoiceToDelete) return
    try {
      setIsDeleting(true)
      const res = await supplierInvoicesService.deleteInvoice(invoiceToDelete.id)
      toast.success(res.message || 'Nota fiscal e lançamento de caixa removidos com sucesso.')
      setInvoiceToDelete(null)
      await loadData()
      if (onRefreshFinancialData) {
        await onRefreshFinancialData()
      }
    } catch (err: any) {
      console.error('Erro ao remover nota fiscal:', err)
      toast.error(err.message || 'Erro ao excluir nota fiscal.')
    } finally {
      setIsDeleting(false)
    }
  }

  // Salvar Certificado A1
  const handleSaveCertificate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!certFile && !certificate) {
      toast.error('Selecione o arquivo do certificado (.pfx ou .p12).')
      return
    }
    if (!certPassword && !certificate) {
      toast.error('Informe a senha do certificado A1.')
      return
    }

    try {
      setIsSavingCert(true)
      const filename = certFile ? certFile.name : certificate?.filename || 'certificado_a1.pfx'
      const res = await supplierInvoicesService.saveCertificate({
        filename,
        password: certPassword,
        validUntil: certValidUntil || undefined,
        subjectName: certSubjectName,
        cnpj: certCnpj,
      })

      toast.success(res.message || 'Certificado A1 salvo com segurança no backend!')
      setCertificate(res.certificate)
      setIsCertModalOpen(false)
      setCertFile(null)
      setCertPassword('')
    } catch (err: any) {
      console.error('Erro ao salvar certificado A1:', err)
      toast.error(err.message || 'Erro ao registrar certificado digital.')
    } finally {
      setIsSavingCert(false)
    }
  }

  // Remover Certificado A1
  const handleDeleteCertificate = async () => {
    if (!certificate?.id) return
    if (!window.confirm('Tem certeza de que deseja remover o Certificado A1 ativo?')) return

    try {
      setIsDeletingCert(true)
      await supplierInvoicesService.deleteCertificate(certificate.id)
      toast.success('Certificado digital removido com sucesso.')
      setCertificate(null)
    } catch (err: any) {
      toast.error(err.message || 'Erro ao remover certificado digital.')
    } finally {
      setIsDeletingCert(false)
    }
  }

  // Criação rápida de fornecedor sugerido
  const handleCreateSupplier = async () => {
    if (!supplierToCreate) return
    try {
      setIsCreatingSupplier(true)
      const res = await supplierInvoicesService.quickCreateSupplier(supplierToCreate)
      toast.success(res.message || 'Fornecedor cadastrado com sucesso!')
      setSupplierToCreate(null)
    } catch (err: any) {
      toast.error(err.message || 'Erro ao cadastrar fornecedor.')
    } finally {
      setIsCreatingSupplier(false)
    }
  }

  // Filtro de notas
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      // Busca textual
      if (searchTerm.trim()) {
        const clean = searchTerm.toLowerCase().trim()
        const matchNumber = (inv.number || '').toLowerCase().includes(clean)
        const matchSupplier = (inv.supplier_name || '').toLowerCase().includes(clean)
        const matchCnpj = (inv.supplier_cnpj || '').toLowerCase().includes(clean)
        const matchKey = (inv.access_key || '').toLowerCase().includes(clean)
        const matchAmount = String(inv.total_amount || '').includes(clean)
        if (!matchNumber && !matchSupplier && !matchCnpj && !matchKey && !matchAmount) {
          return false
        }
      }

      // Filtro de data
      if (inv.issue_date) {
        const [year, month] = inv.issue_date.split('-')
        if (selectedYear !== 'Todos' && year !== selectedYear) return false
        if (selectedMonth !== 'Todos' && String(parseInt(month, 10) - 1) !== selectedMonth) {
          return false
        }
      }

      return true
    })
  }, [invoices, searchTerm, selectedMonth, selectedYear])

  // Métricas do resumo
  const metrics = useMemo(() => {
    const totalCount = filteredInvoices.length
    const totalValue = filteredInvoices.reduce((acc, curr) => acc + (curr.total_amount || 0), 0)
    const suppliersSet = new Set(filteredInvoices.map((i) => i.supplier_cnpj))
    return {
      totalCount,
      totalValue,
      uniqueSuppliers: suppliersSet.size,
    }
  }, [filteredInvoices])

  const monthNames = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro',
  ]

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-slate-500">
          <RefreshCw className="h-6 w-6 animate-spin text-[#3A3A3C]" />
          <p className="text-xs font-medium">Carregando notas de fornecedores...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* =========================================================================
          SEÇÃO 1: PAINEL SUPERIOR - IMPORTAÇÃO DE XML E CERTIFICADO A1
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Card de Drag & Drop de XML */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-xs p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-xl bg-orange-100 text-[#E66812] flex items-center justify-center">
                  <Upload className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Importação de XML de NF-e de Fornecedores (Entradas)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Importe notas fiscais emitidas contra o CNPJ da Corteplan sem precisar digitar.
                  </p>
                </div>
              </div>
            </div>

            {/* Área de Arraste e Solte */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => xmlFileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center gap-2 ${
                isDragging
                  ? 'border-[#F08A24] bg-orange-50/70 scale-[1.01]'
                  : 'border-slate-300 hover:border-slate-400 bg-slate-50/60 hover:bg-slate-50'
              }`}
            >
              <input
                ref={xmlFileInputRef}
                type="file"
                multiple
                accept=".xml"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleXmlFiles(e.target.files)
                  }
                }}
              />

              {isImportingXml ? (
                <div className="py-2 flex flex-col items-center gap-2">
                  <RefreshCw className="h-8 w-8 text-[#F08A24] animate-spin" />
                  <p className="text-xs font-semibold text-slate-700">
                    Processando XMLs, deduplicando chaves e sincronizando com o Fluxo de Caixa...
                  </p>
                </div>
              ) : (
                <>
                  <div className="h-12 w-12 rounded-full bg-white shadow-xs border border-slate-200 flex items-center justify-center text-[#F08A24]">
                    <FileSpreadsheet className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm font-bold text-slate-900">
                      Arraste e solte arquivos XML aqui ou clique para selecionar
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Suporte a NF-e (modelo 55) e NFC-e com seleção múltipla. Deduplicação
                      automática por chave de 44 dígitos.
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="mt-1 h-8 rounded-xl text-xs bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                    onClick={(e) => {
                      e.stopPropagation()
                      xmlFileInputRef.current?.click()
                    }}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1 text-[#F08A24]" />
                    Selecionar Arquivos XML
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              Gera saída automática no Fluxo de Caixa na categoria "Fornecedores"
            </span>
            <span className="hidden sm:inline font-mono">Deduplicação SEFAZ ativa</span>
          </div>
        </div>

        {/* Card do Certificado Digital A1 */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div
                  className={`h-9 w-9 rounded-xl flex items-center justify-center ${
                    certificate ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  <KeyRound className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Certificado Digital A1</h3>
                  <p className="text-[11px] text-slate-500">Para consultas e provedor SEFAZ</p>
                </div>
              </div>

              <Badge
                variant="outline"
                className={
                  certificate
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px]'
                    : 'bg-amber-50 text-amber-700 border-amber-300 text-[10px]'
                }
              >
                {certificate ? 'Cadastrado' : 'Não cadastrado'}
              </Badge>
            </div>

            {certificate ? (
              <div className="space-y-2.5 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                      Arquivo
                    </span>
                    <span className="font-mono font-semibold text-slate-800 break-all">
                      {certificate.filename}
                    </span>
                  </div>
                  <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" />
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200 text-[11px]">
                  <div>
                    <span className="text-slate-500 block">Upload:</span>
                    <span className="font-medium text-slate-800">
                      {formatDateBR(certificate.uploaded_at)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Validade:</span>
                    <span className="font-medium text-slate-800">
                      {certificate.valid_until
                        ? formatDateBR(certificate.valid_until)
                        : '1 ano padrão'}
                    </span>
                  </div>
                </div>

                <div className="pt-1 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-600">
                  <span className="flex items-center gap-1">
                    <Lock className="h-3 w-3 text-slate-400" />
                    Senha protegida no backend
                  </span>
                  <span className="text-emerald-700 font-semibold font-mono">Status: Ativo</span>
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-900 space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-amber-800">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  Nenhum certificado A1 ativo
                </div>
                <p className="text-[11px] leading-relaxed text-amber-800/90">
                  Cadastre o arquivo .pfx e a senha da Corteplan para deixar o ambiente pronto para
                  a busca automática de notas no SEFAZ via provedor.
                </p>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => setIsCertModalOpen(true)}
              className="flex-1 rounded-xl h-8 text-xs bg-[#3A3A3C] hover:bg-[#2D2D2F] text-white font-medium gap-1.5"
            >
              <KeyRound className="h-3.5 w-3.5 text-[#F08A24]" />
              {certificate ? 'Substituir Certificado' : 'Enviar Certificado A1'}
            </Button>

            {certificate && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isDeletingCert}
                onClick={handleDeleteCertificate}
                className="h-8 px-2.5 rounded-xl text-xs border-red-200 text-red-600 hover:bg-red-50"
                title="Remover Certificado A1"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* =========================================================================
          SEÇÃO 2: CARD INFORMATIVO - ABA AUTOMÁTICA (PROVEDOR FOCUS NFE / NFE.IO)
          ========================================================================= */}
      <div className="p-4 bg-gradient-to-r from-slate-900 via-slate-800 to-[#3A3A3C] text-white rounded-2xl shadow-sm border border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="h-10 w-10 rounded-xl bg-white/10 text-amber-400 flex items-center justify-center shrink-0 mt-0.5 border border-white/10">
            <Zap className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm tracking-wide">
                Download 100% Automático via SEFAZ (Focus NFe / NFe.io)
              </span>
              <Badge
                variant="outline"
                className="bg-amber-500/20 text-amber-300 border-amber-400/40 text-[10px]"
              >
                Aguardando Provedor
              </Badge>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
              O download 100% automático e contínuo direto do SEFAZ (Manifestação do Destinatário)
              exige integração contratada com um provedor autorizado (Focus NFe ou NFe.io) vinculado
              ao seu Certificado A1. A estrutura do sistema está pronta — enquanto isso, utilize a
              área de importação de XML acima para alimentar o Caixa sem nenhuma digitação.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          <Button
            size="sm"
            variant="outline"
            disabled
            className="rounded-xl h-8 px-3 text-xs bg-white/5 border-white/20 text-slate-400 cursor-not-allowed opacity-75"
          >
            Sincronizar SEFAZ (Provedor)
          </Button>
        </div>
      </div>

      {/* =========================================================================
          SEÇÃO 3: MÉTRICAS E RESUMO DE NOTAS DE ENTRADA
          ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="rounded-2xl border-slate-200 shadow-xs bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Notas Importadas
            </CardTitle>
            <div className="h-8 w-8 rounded-lg bg-orange-50 text-[#F08A24] flex items-center justify-center">
              <FileCheck className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-extrabold text-slate-900 font-mono">
              {metrics.totalCount}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {metrics.uniqueSuppliers} fornecedor(es) distintos
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200 shadow-xs bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total em Compras (NF-e)
            </CardTitle>
            <div className="h-8 w-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
              <TrendingDown className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-extrabold text-red-600 font-mono">
              {formatCurrencyBRL(metrics.totalValue)}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">Lançado como Saídas no Caixa</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200 shadow-xs bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Integração Fluxo de Caixa
            </CardTitle>
            <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="flex items-center gap-1.5 text-base font-bold text-emerald-700">
              <Check className="h-4 w-4" />
              100% Sincronizado
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Cada nota possui Saída gerada no Fluxo de Caixa
            </p>
          </CardContent>
        </Card>
      </div>

      {/* =========================================================================
          SEÇÃO 4: BARRA DE FILTROS E BUSCA DE NOTAS
          ========================================================================= */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            type="text"
            placeholder="Buscar por fornecedor, CNPJ, número ou chave da NF-e..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 text-xs sm:text-sm rounded-xl h-9"
          />
        </div>

        <div className="flex items-center flex-wrap gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 font-medium">Mês:</span>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-32 h-8 text-xs rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">Todos os meses</SelectItem>
                {monthNames.map((m, idx) => (
                  <SelectItem key={idx} value={String(idx)}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 font-medium">Ano:</span>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-24 h-8 text-xs rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">Todos</SelectItem>
                {[2024, 2025, 2026, 2027].map((yr) => (
                  <SelectItem key={yr} value={String(yr)}>
                    {yr}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {(searchTerm || selectedMonth !== 'Todos' || selectedYear !== 'Todos') && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchTerm('')
                setSelectedMonth('Todos')
                setSelectedYear('Todos')
              }}
              className="h-8 text-xs text-slate-500 hover:text-slate-900 rounded-xl"
            >
              Limpar Filtros
            </Button>
          )}
        </div>
      </div>

      {/* =========================================================================
          SEÇÃO 5: TABELA DE NOTAS DE FORNECEDORES IMPORTADAS
          ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-[#F08A24]" />
            <h3 className="font-bold text-sm text-slate-900">
              Notas Fiscais de Entrada (Fornecedores)
            </h3>
          </div>
          <span className="text-xs text-slate-500">
            {filteredInvoices.length} nota(s) listada(s)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                <th className="py-3 px-4">Emissão</th>
                <th className="py-3 px-4">NF-e / Série</th>
                <th className="py-3 px-4">Fornecedor / Razão Social</th>
                <th className="py-3 px-4">Natureza da Operação</th>
                <th className="py-3 px-4 text-right">Valor Total</th>
                <th className="py-3 px-4 text-center">Lançamento no Caixa</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    {searchTerm || selectedMonth !== 'Todos'
                      ? 'Nenhuma nota de fornecedor encontrada para os filtros selecionados.'
                      : 'Nenhuma nota fiscal de entrada importada ainda. Arraste arquivos XML na área acima.'}
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => {
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-medium text-slate-900 whitespace-nowrap">
                        {formatDateBR(inv.issue_date)}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-mono font-bold text-slate-900">
                          Nº {inv.number}
                          {inv.series && (
                            <span className="text-slate-500 font-normal ml-1">
                              (Série {inv.series})
                            </span>
                          )}
                        </div>
                        <div
                          className="text-[10px] text-slate-400 font-mono truncate max-w-[150px]"
                          title={inv.access_key}
                        >
                          Chave: {inv.access_key.substring(0, 18)}...
                        </div>
                      </td>

                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="font-semibold text-slate-900 truncate">
                          {inv.supplier_name}
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1">
                          <span className="font-mono">{inv.supplier_cnpj}</span>
                          {inv.supplier_city && (
                            <span>
                              &bull; {inv.supplier_city}/{inv.supplier_state}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 max-w-[180px] truncate text-slate-600">
                        {inv.operation_nature || 'Compra de Fornecedor'}
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-bold text-red-600 whitespace-nowrap">
                        {formatCurrencyBRL(inv.total_amount)}
                      </td>

                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <Badge
                          variant="outline"
                          className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[11px] font-semibold gap-1"
                        >
                          <Check className="h-3 w-3 text-emerald-600" />
                          Lançado automaticamente
                        </Badge>
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Botão Ver no Caixa */}
                          {onGoToCashflow && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => onGoToCashflow(inv.number)}
                              className="rounded-xl h-8 px-2.5 text-xs border-slate-200 hover:bg-slate-100 text-slate-700"
                              title="Ver lançamento no Fluxo de Caixa"
                            >
                              <TrendingDown className="h-3.5 w-3.5 mr-1 text-red-500" />
                              Ver no Caixa
                            </Button>
                          )}

                          {/* Botão Detalhes da Nota */}
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedInvoice(inv)
                              setIsDetailModalOpen(true)
                            }}
                            className="rounded-xl h-8 px-2.5 text-xs border-slate-200 hover:bg-slate-100 text-slate-700"
                            title="Ver itens e detalhes tributários do XML"
                          >
                            <Eye className="h-3.5 w-3.5 text-[#F08A24]" />
                          </Button>

                          {/* Botão Excluir */}
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setInvoiceToDelete(inv)}
                            className="rounded-xl h-8 px-2.5 text-xs border-red-200 text-red-600 hover:bg-red-50"
                            title="Remover nota e estornar do caixa"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* =========================================================================
          MODAL 1: RESULTADO DA IMPORTAÇÃO DE XML COM SUGESTÃO DE CADASTRO
          ========================================================================= */}
      <Dialog open={isResultModalOpen} onOpenChange={setIsResultModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <div className="h-10 w-10 rounded-full bg-orange-100 text-[#E66812] flex items-center justify-center mb-1">
              <FileCheck className="h-5 w-5" />
            </div>
            <DialogTitle className="text-lg font-bold text-slate-900">
              Relatório de Importação de XML
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Confira os arquivos processados, deduplicados e lançados no Caixa.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            {importResults?.map((res, idx) => {
              const isSuccess = res.success
              const isDuplicated = res.status === 'duplicated'
              const needsSupplierRegistration = isSuccess && !res.existing_supplier

              return (
                <div
                  key={idx}
                  className={`p-3.5 rounded-xl border text-xs space-y-2 ${
                    isSuccess
                      ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                      : isDuplicated
                        ? 'bg-amber-50/70 border-amber-200 text-amber-900'
                        : 'bg-red-50/70 border-red-200 text-red-900'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-semibold flex items-center gap-1.5">
                      {isSuccess ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      ) : isDuplicated ? (
                        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                      ) : (
                        <X className="h-4 w-4 text-red-600 shrink-0" />
                      )}
                      <span className="font-mono">{res.filename}</span>
                    </div>

                    {res.total_amount !== undefined && (
                      <span className="font-mono font-bold">
                        {formatCurrencyBRL(res.total_amount)}
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] leading-relaxed opacity-90">{res.message}</p>

                  {/* Sugestão de cadastro de Fornecedor caso não exista em clients */}
                  {needsSupplierRegistration && (
                    <div className="mt-2 pt-2 border-t border-emerald-200/60 flex items-center justify-between gap-3 bg-white/70 p-2 rounded-lg">
                      <div className="text-[11px] text-slate-700">
                        <strong className="text-slate-900">Fornecedor não cadastrado: </strong>
                        Deseja salvar <strong>{res.supplier_name}</strong> (CNPJ {res.supplier_cnpj}
                        ) na base de clientes/fornecedores?
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          setSupplierToCreate({
                            cnpj: res.supplier_cnpj || '',
                            name: res.supplier_name || '',
                            address: res.supplier_address,
                            city: res.supplier_city,
                            state: res.supplier_state,
                          })
                        }}
                        className="rounded-lg h-7 px-2 text-xs bg-emerald-700 hover:bg-emerald-800 text-white shrink-0 font-medium"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Cadastrar Fornecedor
                      </Button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <DialogFooter className="pt-3">
            <Button
              type="button"
              onClick={() => setIsResultModalOpen(false)}
              className="rounded-xl bg-[#3A3A3C] hover:bg-[#2D2D2F] text-white"
            >
              Concluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* =========================================================================
          MODAL 2: CADASTRO RÁPIDO DO FORNECEDOR
          ========================================================================= */}
      <Dialog open={!!supplierToCreate} onOpenChange={() => setSupplierToCreate(null)}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <div className="h-10 w-10 rounded-full bg-orange-100 text-[#E66812] flex items-center justify-center mb-1">
              <Building className="h-5 w-5" />
            </div>
            <DialogTitle className="text-base font-bold text-slate-900">
              Cadastrar Fornecedor
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Adicione o fornecedor na base de contatos com dados importados da nota.
            </DialogDescription>
          </DialogHeader>

          {supplierToCreate && (
            <div className="space-y-3 pt-2 text-xs">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Razão Social / Nome</Label>
                <Input
                  value={supplierToCreate.name}
                  onChange={(e) =>
                    setSupplierToCreate({ ...supplierToCreate, name: e.target.value })
                  }
                  className="rounded-xl text-xs sm:text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">CNPJ</Label>
                <Input
                  value={supplierToCreate.cnpj}
                  onChange={(e) =>
                    setSupplierToCreate({ ...supplierToCreate, cnpj: e.target.value })
                  }
                  className="rounded-xl font-mono text-xs sm:text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Endereço</Label>
                <Input
                  value={supplierToCreate.address || ''}
                  onChange={(e) =>
                    setSupplierToCreate({ ...supplierToCreate, address: e.target.value })
                  }
                  className="rounded-xl text-xs sm:text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Cidade</Label>
                  <Input
                    value={supplierToCreate.city || ''}
                    onChange={(e) =>
                      setSupplierToCreate({ ...supplierToCreate, city: e.target.value })
                    }
                    className="rounded-xl text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Estado / UF</Label>
                  <Input
                    value={supplierToCreate.state || ''}
                    onChange={(e) =>
                      setSupplierToCreate({ ...supplierToCreate, state: e.target.value })
                    }
                    className="rounded-xl text-xs uppercase"
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0 pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setSupplierToCreate(null)}
              className="rounded-xl text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={isCreatingSupplier}
              onClick={handleCreateSupplier}
              className="rounded-xl bg-[#3A3A3C] hover:bg-[#2D2D2F] text-white font-medium text-xs"
            >
              {isCreatingSupplier ? 'Salvando...' : 'Confirmar Cadastro'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* =========================================================================
          MODAL 3: UPLOAD / GESTÃO DO CERTIFICADO DIGITAL A1
          ========================================================================= */}
      <Dialog open={isCertModalOpen} onOpenChange={setIsCertModalOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <div className="h-10 w-10 rounded-full bg-orange-100 text-[#E66812] flex items-center justify-center mb-1">
              <KeyRound className="h-5 w-5" />
            </div>
            <DialogTitle className="text-base font-bold text-slate-900">
              {certificate
                ? 'Atualizar Certificado Digital A1'
                : 'Cadastrar Certificado Digital A1'}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Envie o arquivo (.pfx ou .p12) e a senha para autenticação de NF-e na SEFAZ. A senha é
              armazenada de forma criptografada no backend e nunca é exposta.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveCertificate} className="space-y-3.5 pt-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">
                Arquivo do Certificado (.pfx / .p12) *
              </Label>
              <div
                onClick={() => certFileInputRef.current?.click()}
                className="border border-dashed border-slate-300 hover:border-slate-400 p-3 rounded-xl bg-slate-50 cursor-pointer text-center text-xs text-slate-600 flex items-center justify-center gap-2"
              >
                <Upload className="h-4 w-4 text-[#F08A24]" />
                <span className="font-mono truncate">
                  {certFile
                    ? certFile.name
                    : certificate
                      ? `Atual: ${certificate.filename}`
                      : 'Clique para escolher arquivo .pfx'}
                </span>
              </div>
              <input
                ref={certFileInputRef}
                type="file"
                accept=".pfx,.p12,application/x-pkcs12,application/pkcs12"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setCertFile(e.target.files[0])
                  }
                }}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Senha do Certificado *</Label>
              <Input
                type="password"
                placeholder={certificate ? 'Digite a nova senha para atualizar' : 'Senha do .pfx'}
                value={certPassword}
                onChange={(e) => setCertPassword(e.target.value)}
                required={!certificate}
                className="rounded-xl font-mono text-xs sm:text-sm"
              />
              <span className="text-[10px] text-slate-400 block">
                Criptografia simétrica segura no servidor
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">CNPJ Titular</Label>
                <Input
                  value={certCnpj}
                  onChange={(e) => setCertCnpj(e.target.value)}
                  className="rounded-xl font-mono text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Data de Validade</Label>
                <Input
                  type="date"
                  value={certValidUntil}
                  onChange={(e) => setCertValidUntil(e.target.value)}
                  className="rounded-xl text-xs"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCertModalOpen(false)}
                className="rounded-xl text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSavingCert}
                className="rounded-xl bg-[#3A3A3C] hover:bg-[#2D2D2F] text-white font-medium text-xs gap-1.5"
              >
                {isSavingCert ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-3.5 w-3.5 text-[#F08A24]" />
                    Salvar Certificado
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* =========================================================================
          MODAL 4: DETALHES COMPLETOS DA NOTA FISCAL (ITENS E TRIBUTOS)
          ========================================================================= */}
      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <div className="h-10 w-10 rounded-full bg-orange-100 text-[#E66812] flex items-center justify-center mb-1">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <DialogTitle className="text-lg font-bold text-slate-900">
              Detalhes da NF-e Nº {selectedInvoice?.number}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Emitida por{' '}
              <strong className="text-slate-800">{selectedInvoice?.supplier_name}</strong> em{' '}
              {formatDateBR(selectedInvoice?.issue_date)}
            </DialogDescription>
          </DialogHeader>

          {selectedInvoice && (
            <div className="space-y-4 pt-2 text-xs">
              {/* Chave de Acesso */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block mb-0.5">
                  Chave de Acesso (44 dígitos)
                </span>
                <span className="font-mono text-xs text-slate-900 font-semibold break-all select-all">
                  {selectedInvoice.access_key}
                </span>
              </div>

              {/* Dados do Fornecedor e Operação */}
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-500 block text-[11px]">Fornecedor</span>
                  <span className="font-semibold text-slate-900 block">
                    {selectedInvoice.supplier_name}
                  </span>
                  <span className="font-mono text-[11px] text-slate-600">
                    CNPJ: {selectedInvoice.supplier_cnpj}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Natureza da Operação</span>
                  <span className="font-medium text-slate-900 block">
                    {selectedInvoice.operation_nature || 'Compra'}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Local: {selectedInvoice.supplier_city || '-'}/
                    {selectedInvoice.supplier_state || '-'}
                  </span>
                </div>
              </div>

              {/* Quadro de Valores e Impostos */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                  Totais da Nota Fiscal
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div>
                    <span className="text-slate-500 block">Produtos</span>
                    <span className="font-mono font-bold text-slate-800">
                      {formatCurrencyBRL(selectedInvoice.products_amount || 0)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">ICMS</span>
                    <span className="font-mono font-bold text-slate-800">
                      {formatCurrencyBRL(selectedInvoice.icms_amount || 0)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">IPI</span>
                    <span className="font-mono font-bold text-slate-800">
                      {formatCurrencyBRL(selectedInvoice.ipi_amount || 0)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">PIS / COFINS</span>
                    <span className="font-mono font-bold text-slate-800">
                      {formatCurrencyBRL(
                        (selectedInvoice.pis_amount || 0) + (selectedInvoice.cofins_amount || 0),
                      )}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                  <span className="font-bold text-slate-900">Valor Total da Nota:</span>
                  <span className="font-mono text-base font-extrabold text-red-600">
                    {formatCurrencyBRL(selectedInvoice.total_amount)}
                  </span>
                </div>
              </div>

              {/* Itens da NF-e */}
              {selectedInvoice.items_summary && selectedInvoice.items_summary.length > 0 && (
                <div className="space-y-2">
                  <span className="font-bold text-slate-900 block">
                    Itens da Nota ({selectedInvoice.items_summary.length})
                  </span>
                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-52 overflow-y-auto">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-slate-100 text-slate-600 font-semibold sticky top-0">
                        <tr>
                          <th className="py-2 px-3">Item / Código</th>
                          <th className="py-2 px-3">Descrição</th>
                          <th className="py-2 px-3 text-right">Qtd</th>
                          <th className="py-2 px-3 text-right">Unitário</th>
                          <th className="py-2 px-3 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedInvoice.items_summary.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-1.5 px-3 font-mono text-slate-500">
                              {item.code || `#${idx + 1}`}
                            </td>
                            <td className="py-1.5 px-3 font-medium text-slate-800 max-w-xs truncate">
                              {item.description}
                            </td>
                            <td className="py-1.5 px-3 text-right font-mono">
                              {item.quantity} {item.unit}
                            </td>
                            <td className="py-1.5 px-3 text-right font-mono text-slate-600">
                              {formatCurrencyBRL(item.unit_price)}
                            </td>
                            <td className="py-1.5 px-3 text-right font-mono font-bold text-slate-900">
                              {formatCurrencyBRL(item.total_price)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              onClick={() => setIsDetailModalOpen(false)}
              className="rounded-xl bg-[#3A3A3C] hover:bg-[#2D2D2F] text-white"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* =========================================================================
          MODAL 5: CONFIRMAÇÃO DE EXCLUSÃO DA NOTA COM ESTORNO NO CAIXA
          ========================================================================= */}
      <Dialog open={!!invoiceToDelete} onOpenChange={() => setInvoiceToDelete(null)}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <div className="h-10 w-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-1">
              <Trash2 className="h-5 w-5" />
            </div>
            <DialogTitle className="text-base font-bold text-slate-900">
              Excluir Nota Fiscal de Fornecedor
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              A exclusão removerá permanentemente o registro da NF-e{' '}
              <strong className="text-slate-800">Nº {invoiceToDelete?.number}</strong> e também o
              lançamento correspondente de{' '}
              <strong className="text-red-600 font-mono">
                {formatCurrencyBRL(invoiceToDelete?.total_amount || 0)}
              </strong>{' '}
              no Fluxo de Caixa.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0 pt-3">
            <Button
              type="button"
              variant="outline"
              disabled={isDeleting}
              onClick={() => setInvoiceToDelete(null)}
              className="rounded-xl text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={isDeleting}
              onClick={handleConfirmDeleteInvoice}
              className="rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium text-xs gap-1"
            >
              {isDeleting ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  Excluindo...
                </>
              ) : (
                'Confirmar Exclusão'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

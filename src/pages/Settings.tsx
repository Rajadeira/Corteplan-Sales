import React, { useState, useEffect } from 'react'
import {
  Building2,
  Receipt,
  Database,
  Save,
  Download,
  Upload,
  ShieldCheck,
  AlertCircle,
  FileCheck,
  CheckCircle2,
  RefreshCw,
  FileSpreadsheet,
  KeyRound,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { settingsService } from '@/services/settings'
import { quoteService } from '@/services/quotes'
import { orderService } from '@/services/orders'
import { clientService } from '@/services/clients'
import { itemService } from '@/services/items'
import type { CompanySettings, TaxSettings, NfeSettings } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export default function SettingsPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const isAdmin = user?.role === 'Administrador'

  const [loading, setLoading] = useState(true)
  const [savingCompany, setSavingCompany] = useState(false)
  const [savingTaxes, setSavingTaxes] = useState(false)
  const [savingSeq, setSavingSeq] = useState(false)
  const [savingNfe, setSavingNfe] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [lastQuoteNum, setLastQuoteNum] = useState<number>(140)
  const [lastOrderNum, setLastOrderNum] = useState<number>(0)

  // NFe Form
  const [nfeConfig, setNfeConfig] = useState<NfeSettings>({
    provider: 'Focus NFe',
    environment: 'homologacao',
    apiKey: '',
    companyId: '',
    series: '1',
    autoIssueOnCompletedOrder: true,
  })

  // Company Form
  const [company, setCompany] = useState<CompanySettings>({
    name: 'CORTEPLAN COMÉRCIO E SERVIÇOS LTDA',
    trade_name: 'CORTEPLAN',
    cnpj: '08.618.375/0001-35',
    ie: '148.910.824.110',
    phone: '(11) 2201-4475',
    email: 'comercial@corteplan.com.br',
    address: 'Rua Soldado Teodoro Ximenes, 137',
    neighborhood: 'Parque Novo Mundo',
    city: 'São Paulo',
    state: 'SP',
    zip_code: '02188-040',
    website: 'www.corteplan.com.br',
  })

  // Taxes Form
  const [taxes, setTaxes] = useState<TaxSettings>({
    icmsPercent: 12,
    ipiPercent: 3.25,
    pisPercent: 0.65,
    cofinsPercent: 3,
    defaultValidityDays: 5,
    defaultPaymentTerms: 'Entrada 50% + 2x',
    defaultDeliveryTerm: 'À Combinar',
  })

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        const [compData, taxData, quoteSeqVal, orderSeqVal, nfeData] = await Promise.all([
          settingsService.getCompanySettings(),
          settingsService.getTaxSettings(),
          settingsService.getByKey<number>('last_quote_number'),
          settingsService.getByKey<number>('last_order_number'),
          settingsService.getNfeSettings(),
        ])
        if (compData) setCompany(compData)
        if (taxData) setTaxes(taxData)
        if (quoteSeqVal !== null && quoteSeqVal !== undefined) {
          setLastQuoteNum(Number(quoteSeqVal))
        }
        if (orderSeqVal !== null && orderSeqVal !== undefined) {
          setLastOrderNum(Number(orderSeqVal))
        }
        if (nfeData) setNfeConfig(nfeData)
      } catch (err) {
        console.error('Erro ao carregar configurações:', err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isAdmin) return
    try {
      setSavingCompany(true)
      await settingsService.saveCompanySettings(company)
      toast({
        title: 'Dados da Empresa Salvos',
        description: 'As informações cadastrais foram atualizadas com sucesso.',
      })
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar',
        description: err.message || 'Falha ao salvar dados da empresa.',
        variant: 'destructive',
      })
    } finally {
      setSavingCompany(false)
    }
  }

  const handleSaveSequences = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isAdmin) return
    try {
      setSavingSeq(true)
      await Promise.all([
        settingsService.setByKey(
          'last_quote_number',
          lastQuoteNum,
          'Último número de orçamento utilizado (o próximo será este + 1)',
        ),
        settingsService.setByKey(
          'last_order_number',
          lastOrderNum,
          'Último número de pedido utilizado (o próximo será este + 1)',
        ),
      ])
      toast({
        title: 'Sequência numérica atualizada',
        description: `Próximo orçamento será ORÇ-${String(lastQuoteNum + 1).padStart(3, '0')} e próximo pedido será PED-${String(lastOrderNum + 1).padStart(3, '0')}.`,
      })
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar sequenciais',
        description: err.message || 'Falha ao salvar numeração sequencial.',
        variant: 'destructive',
      })
    } finally {
      setSavingSeq(false)
    }
  }

  const handleSaveNfe = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isAdmin) return
    try {
      setSavingNfe(true)
      await settingsService.saveNfeSettings(nfeConfig)
      toast({
        title: 'Configurações de Nota Fiscal Salvas',
        description:
          'Credenciais e ambiente do provedor autorizador foram atualizados com sucesso.',
      })
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar',
        description: err.message || 'Falha ao salvar configurações de NF-e.',
        variant: 'destructive',
      })
    } finally {
      setSavingNfe(false)
    }
  }

  const handleSaveTaxes = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isAdmin) return
    try {
      setSavingTaxes(true)
      await settingsService.saveTaxSettings(taxes)
      toast({
        title: 'Configurações Fiscais Salvas',
        description: 'Impostos padrão e condições comerciais foram atualizados.',
      })
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar',
        description: err.message || 'Falha ao salvar impostos padrão.',
        variant: 'destructive',
      })
    } finally {
      setSavingTaxes(false)
    }
  }

  // Backup / Export
  const handleExportBackup = async () => {
    if (!isAdmin) return
    try {
      setIsExporting(true)
      const [clients, quotes, orders, items, settings] = await Promise.all([
        clientService.getAll(),
        quoteService.getAll(),
        orderService.getAll(),
        itemService.getAll(),
        settingsService.getAll(),
      ])

      const backupData = {
        app: 'Corteplan Gestão Comercial',
        version: '1.0.0',
        exported_at: new Date().toISOString(),
        exported_by: user?.email,
        data: {
          clients,
          quotes,
          orders,
          items,
          settings,
        },
      }

      const jsonStr = JSON.stringify(backupData, null, 2)
      const blob = new Blob([jsonStr], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const dateStr = new Date().toISOString().split('T')[0]
      a.href = url
      a.download = `backup_corteplan_${dateStr}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast({
        title: 'Backup concluído',
        description: 'Arquivo JSON gerado e baixado com sucesso.',
      })
    } catch (err: any) {
      toast({
        title: 'Erro no backup',
        description: err.message || 'Falha ao exportar dados do sistema.',
        variant: 'destructive',
      })
    } finally {
      setIsExporting(false)
    }
  }

  // Backup / Import (Validar e simular/restaurar dados não-destrutivos)
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAdmin) return
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setImporting(true)
      const reader = new FileReader()
      reader.onload = async (event) => {
        try {
          const content = event.target?.result as string
          const parsed = JSON.parse(content)

          if (!parsed.data) {
            throw new Error('Arquivo de backup inválido ou em formato incompatível.')
          }

          // Se tiver configurações no backup, restaura
          if (parsed.data.settings && Array.isArray(parsed.data.settings)) {
            for (const s of parsed.data.settings) {
              if (s.setting_key && s.value) {
                await settingsService.setByKey(s.setting_key, s.value, s.description)
              }
            }
          }

          toast({
            title: 'Backup verificado com sucesso',
            description: `Arquivo de backup de ${parsed.exported_at ? new Date(parsed.exported_at).toLocaleDateString('pt-BR') : 'data desconhecida'} lido com sucesso.`,
          })
        } catch (parseErr: any) {
          toast({
            title: 'Falha na leitura do backup',
            description: parseErr.message || 'Arquivo corrompido ou formato inválido.',
            variant: 'destructive',
          })
        } finally {
          setImporting(false)
          e.target.value = ''
        }
      }
      reader.readAsText(file)
    } catch (err: any) {
      setImporting(false)
      toast({
        title: 'Erro no arquivo',
        description: err.message,
        variant: 'destructive',
      })
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-500">
        <RefreshCw className="h-6 w-6 animate-spin mr-2" />
        Carregando configurações...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Configurações do Sistema
            </h1>
            <Badge variant="outline" className="border-emerald-500 text-emerald-700 bg-emerald-50">
              Acesso Restrito: Administrador
            </Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Gerencie os dados cadastrais da empresa, alíquotas fiscais padrão e cópias de segurança
            (backup).
          </p>
        </div>
      </div>

      <Tabs defaultValue="empresa" className="space-y-6">
        <TabsList className="bg-slate-100 p-1 rounded-xl">
          <TabsTrigger value="empresa" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Dados da Empresa
          </TabsTrigger>
          <TabsTrigger value="impostos" className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Impostos & Condições Padrão
          </TabsTrigger>
          <TabsTrigger value="sequenciais" className="flex items-center gap-2">
            <FileCheck className="h-4 w-4" />
            Numeração Sequencial
          </TabsTrigger>
          <TabsTrigger value="nfe" className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-[#F08A24]" />
            Nota Fiscal
          </TabsTrigger>
          <TabsTrigger value="backup" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Backup & Segurança
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: EMPRESA */}
        <TabsContent value="empresa">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-6">
              <div className="p-2.5 bg-orange-50 text-[#F08A24] rounded-lg">
                <Building2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 text-base">
                  Informações da Empresa (Cabeçalho de Propostas)
                </h3>
                <p className="text-xs text-slate-500">
                  Estes dados são exibidos na impressão e geração de PDF dos orçamentos e pedidos.
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveCompany} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="company_name">Razão Social *</Label>
                  <Input
                    id="company_name"
                    value={company.name}
                    onChange={(e) => setCompany({ ...company, name: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="trade_name">Nome Fantasia</Label>
                  <Input
                    id="trade_name"
                    value={company.trade_name || ''}
                    onChange={(e) => setCompany({ ...company, trade_name: e.target.value })}
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="cnpj">CNPJ *</Label>
                  <Input
                    id="cnpj"
                    value={company.cnpj}
                    onChange={(e) => setCompany({ ...company, cnpj: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="ie">Inscrição Estadual (IE)</Label>
                  <Input
                    id="ie"
                    value={company.ie || ''}
                    onChange={(e) => setCompany({ ...company, ie: e.target.value })}
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="phone">Telefone Comercial *</Label>
                  <Input
                    id="phone"
                    value={company.phone}
                    onChange={(e) => setCompany({ ...company, phone: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="email">E-mail Comercial *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={company.email}
                    onChange={(e) => setCompany({ ...company, email: e.target.value })}
                    required
                  />
                </div>

                <div className="md:col-span-2 space-y-1">
                  <Label htmlFor="address">Endereço Completo</Label>
                  <Input
                    id="address"
                    value={company.address}
                    onChange={(e) => setCompany({ ...company, address: e.target.value })}
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="neighborhood">Bairro</Label>
                  <Input
                    id="neighborhood"
                    value={company.neighborhood || ''}
                    onChange={(e) => setCompany({ ...company, neighborhood: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="city">Cidade</Label>
                    <Input
                      id="city"
                      value={company.city}
                      onChange={(e) => setCompany({ ...company, city: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="state">UF</Label>
                    <Input
                      id="state"
                      value={company.state}
                      maxLength={2}
                      onChange={(e) =>
                        setCompany({ ...company, state: e.target.value.toUpperCase() })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="zip_code">CEP</Label>
                  <Input
                    id="zip_code"
                    value={company.zip_code}
                    onChange={(e) => setCompany({ ...company, zip_code: e.target.value })}
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    value={company.website || ''}
                    onChange={(e) => setCompany({ ...company, website: e.target.value })}
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <Button
                  type="submit"
                  disabled={savingCompany}
                  className="bg-[#3A3A3C] hover:bg-[#2E2E30] text-white gap-2"
                >
                  <Save className="h-4 w-4 text-[#F08A24]" />
                  {savingCompany ? 'Salvando...' : 'Salvar Dados da Empresa'}
                </Button>
              </div>
            </form>
          </div>
        </TabsContent>

        {/* TAB 2: IMPOSTOS & CONDIÇÕES */}
        <TabsContent value="impostos">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-6">
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
                <Receipt className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 text-base">
                  Parâmetros Fiscais e Comerciais Padrão
                </h3>
                <p className="text-xs text-slate-500">
                  Valores pré-preenchidos automaticamente ao criar um novo orçamento no sistema.
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveTaxes} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Alíquotas */}
                <div className="space-y-4 bg-slate-50/70 p-4 rounded-xl border border-slate-100">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Alíquotas de Imposto (%)
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="icms">ICMS (%)</Label>
                      <Input
                        id="icms"
                        type="number"
                        step="0.01"
                        min="0"
                        value={taxes.icmsPercent}
                        onChange={(e) =>
                          setTaxes({ ...taxes, icmsPercent: parseFloat(e.target.value) || 0 })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="ipi">IPI (%)</Label>
                      <Input
                        id="ipi"
                        type="number"
                        step="0.01"
                        min="0"
                        value={taxes.ipiPercent}
                        onChange={(e) =>
                          setTaxes({ ...taxes, ipiPercent: parseFloat(e.target.value) || 0 })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="pis">PIS (%)</Label>
                      <Input
                        id="pis"
                        type="number"
                        step="0.01"
                        min="0"
                        value={taxes.pisPercent}
                        onChange={(e) =>
                          setTaxes({ ...taxes, pisPercent: parseFloat(e.target.value) || 0 })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="cofins">COFINS (%)</Label>
                      <Input
                        id="cofins"
                        type="number"
                        step="0.01"
                        min="0"
                        value={taxes.cofinsPercent}
                        onChange={(e) =>
                          setTaxes({ ...taxes, cofinsPercent: parseFloat(e.target.value) || 0 })
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* Condições Comerciais */}
                <div className="space-y-4 bg-slate-50/70 p-4 rounded-xl border border-slate-100">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Condições Comerciais Padrão
                  </h4>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label htmlFor="validity">Validade Padrão da Proposta (dias)</Label>
                      <Input
                        id="validity"
                        type="number"
                        min="1"
                        value={taxes.defaultValidityDays}
                        onChange={(e) =>
                          setTaxes({
                            ...taxes,
                            defaultValidityDays: parseInt(e.target.value) || 5,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="paymentTerms">Condição de Pagamento Padrão</Label>
                      <Input
                        id="paymentTerms"
                        value={taxes.defaultPaymentTerms}
                        onChange={(e) =>
                          setTaxes({ ...taxes, defaultPaymentTerms: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="deliveryTerm">Prazo de Entrega Padrão</Label>
                      <Input
                        id="deliveryTerm"
                        value={taxes.defaultDeliveryTerm}
                        onChange={(e) =>
                          setTaxes({ ...taxes, defaultDeliveryTerm: e.target.value })
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <Button
                  type="submit"
                  disabled={savingTaxes}
                  className="bg-[#3A3A3C] hover:bg-[#2E2E30] text-white gap-2"
                >
                  <Save className="h-4 w-4 text-[#F08A24]" />
                  {savingTaxes ? 'Salvando...' : 'Salvar Impostos e Condições'}
                </Button>
              </div>
            </form>
          </div>
        </TabsContent>

        {/* TAB 3: NUMERAÇÃO SEQUENCIAL */}
        <TabsContent value="sequenciais">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-6">
              <div className="p-2.5 bg-orange-50 text-[#F08A24] rounded-lg">
                <FileCheck className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 text-base">
                  Numeração Sequencial de Documentos
                </h3>
                <p className="text-xs text-slate-500">
                  Defina o último número emitido no sistema anterior para manter a continuidade
                  histórica da Corteplan.
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveSequences} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Sequencial de Orçamentos */}
                <div className="space-y-4 bg-slate-50/70 p-5 rounded-xl border border-slate-100">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-slate-800">Orçamentos (ORÇ-XXX)</h4>
                    <Badge
                      variant="outline"
                      className="border-orange-500 text-orange-600 bg-orange-50"
                    >
                      Próximo: ORÇ-{String(lastQuoteNum + 1).padStart(3, '0')}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last_quote_number">Último número de orçamento utilizado</Label>
                    <Input
                      id="last_quote_number"
                      type="number"
                      min="0"
                      value={lastQuoteNum}
                      onChange={(e) => setLastQuoteNum(parseInt(e.target.value, 10) || 0)}
                      required
                    />
                    <p className="text-xs text-slate-500">
                      O sistema antigo encerrou no orçamento <strong>140</strong>. O próximo
                      orçamento criado receberá o número <strong>{lastQuoteNum + 1}</strong> (ORÇ-
                      {String(lastQuoteNum + 1).padStart(3, '0')}).
                    </p>
                  </div>
                </div>

                {/* Sequencial de Pedidos */}
                <div className="space-y-4 bg-slate-50/70 p-5 rounded-xl border border-slate-100">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-slate-800">
                      Pedidos de Venda (PED-XXX)
                    </h4>
                    <Badge variant="outline" className="border-blue-500 text-blue-600 bg-blue-50">
                      Próximo: PED-{String(lastOrderNum + 1).padStart(3, '0')}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last_order_number">Último número de pedido utilizado</Label>
                    <Input
                      id="last_order_number"
                      type="number"
                      min="0"
                      value={lastOrderNum}
                      onChange={(e) => setLastOrderNum(parseInt(e.target.value, 10) || 0)}
                      required
                    />
                    <p className="text-xs text-slate-500">
                      Se definido como 0, o primeiro pedido gerado será <strong>PED-001</strong>.
                      Caso queira continuar de uma numeração anterior, altere este valor.
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <Button
                  type="submit"
                  disabled={savingSeq}
                  className="bg-[#3A3A3C] hover:bg-[#2E2E30] text-white gap-2"
                >
                  <Save className="h-4 w-4 text-[#F08A24]" />
                  {savingSeq ? 'Salvando...' : 'Salvar Numeração Sequencial'}
                </Button>
              </div>
            </form>
          </div>
        </TabsContent>

        {/* TAB: NOTA FISCAL (NFE INTEGRATION) */}
        <TabsContent value="nfe">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="p-2.5 bg-orange-50 text-[#F08A24] rounded-lg">
                <FileSpreadsheet className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 text-base">
                  Integração de Nota Fiscal Eletrônica (NF-e de Venda)
                </h3>
                <p className="text-xs text-slate-500">
                  Configure o provedor autorizador via API-key para emissão e cancelamento das notas
                  dos pedidos concluídos.
                </p>
              </div>
            </div>

            {/* Explicação importante sobre o certificado digital A1 */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3">
              <ShieldAlert className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
              <div className="text-xs text-blue-900 leading-relaxed space-y-1">
                <strong className="font-semibold block">Certificado Digital A1 no Provedor:</strong>
                <p>
                  O certificado digital A1 da empresa deve ser cadastrado diretamente no painel do
                  provedor autorizador escolhido (ex.: Focus NFe ou NFe.io). O sistema Corteplan
                  envia os dados fiscais da venda através da API segura e o provedor realiza a
                  assinatura digital e o envio para a SEFAZ.
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveNfe} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <Label htmlFor="nfe_provider">Provedor de Emissão</Label>
                  <Select
                    value={nfeConfig.provider}
                    onValueChange={(val: any) => setNfeConfig({ ...nfeConfig, provider: val })}
                  >
                    <SelectTrigger id="nfe_provider" className="rounded-xl">
                      <SelectValue placeholder="Selecione o provedor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Focus NFe">Focus NFe (focusnfe.com.br)</SelectItem>
                      <SelectItem value="NFe.io">NFe.io (nfe.io)</SelectItem>
                      <SelectItem value="Outro">Outro Provedor / API Própria</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-[11px] text-slate-500">
                    Provedor homologado para emissão e consulta do DANFE/XML.
                  </span>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="nfe_env">Ambiente de Operação</Label>
                  <Select
                    value={nfeConfig.environment}
                    onValueChange={(val: any) => setNfeConfig({ ...nfeConfig, environment: val })}
                  >
                    <SelectTrigger id="nfe_env" className="rounded-xl">
                      <SelectValue placeholder="Selecione o ambiente" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="homologacao">
                        Homologação (Ambiente de Testes SEFAZ)
                      </SelectItem>
                      <SelectItem value="producao">
                        Produção (Notas com validade jurídica)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-[11px] text-slate-500">
                    Utilize homologação para testar antes de emitir notas reais na SEFAZ.
                  </span>
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="nfe_token" className="flex items-center gap-1.5">
                    <KeyRound className="h-4 w-4 text-amber-600" />
                    API Token / Chave Secreta do Provedor *
                  </Label>
                  <Input
                    id="nfe_token"
                    type="password"
                    placeholder="Ex: oA9sD8f7G6h5J4k3L2... (fornecido pelo provedor)"
                    value={nfeConfig.apiKey}
                    onChange={(e) => setNfeConfig({ ...nfeConfig, apiKey: e.target.value })}
                    className="font-mono text-xs sm:text-sm rounded-xl"
                  />
                  <span className="text-[11px] text-slate-500">
                    Armazenada com segurança no banco de dados. Apenas o backend do sistema utiliza
                    essa chave para disparar as chamadas à SEFAZ.
                  </span>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="nfe_series">Série Padrão da NF-e</Label>
                  <Input
                    id="nfe_series"
                    placeholder="1"
                    value={nfeConfig.series || '1'}
                    onChange={(e) => setNfeConfig({ ...nfeConfig, series: e.target.value })}
                    className="font-mono text-xs sm:text-sm rounded-xl"
                  />
                  <span className="text-[11px] text-slate-500">
                    Série padrão autorizada para emissão de NF-e na sua inscrição estadual.
                  </span>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="nfe_company_id">ID da Empresa no Provedor (Opcional)</Label>
                  <Input
                    id="nfe_company_id"
                    placeholder="Ex: id da conta/empresa caso exigido pelo provedor"
                    value={nfeConfig.companyId || ''}
                    onChange={(e) => setNfeConfig({ ...nfeConfig, companyId: e.target.value })}
                    className="text-xs sm:text-sm rounded-xl"
                  />
                  <span className="text-[11px] text-slate-500">
                    Utilizado principalmente para contas multi-empresas no NFe.io.
                  </span>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <a
                  href="https://focusnfe.github.io/docs/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-[#E66812] hover:underline flex items-center gap-1 font-medium"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Ver documentação Focus NFe
                </a>

                <Button
                  type="submit"
                  disabled={savingNfe}
                  className="bg-[#3A3A3C] hover:bg-[#2E2E30] text-white gap-2 rounded-xl"
                >
                  <Save className="h-4 w-4 text-[#F08A24]" />
                  {savingNfe ? 'Salvando...' : 'Salvar Configurações de NF-e'}
                </Button>
              </div>
            </form>
          </div>
        </TabsContent>

        {/* TAB 4: BACKUP & SEGURANÇA */}
        <TabsContent value="backup">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
                <Database className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 text-base">
                  Backup e Exportação / Importação de Dados
                </h3>
                <p className="text-xs text-slate-500">
                  Exclusivo para o Administrador. Exporte uma cópia completa de clientes,
                  orçamentos, pedidos, catálogo e configurações.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Exportar */}
              <div className="border border-slate-200 rounded-xl p-5 space-y-4 bg-slate-50/50">
                <div className="flex items-center gap-2 font-semibold text-slate-900">
                  <Download className="h-5 w-5 text-[#F08A24]" />
                  Exportar Backup Completo
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Gera um arquivo de segurança no formato <code>.json</code> contendo todo o banco
                  de dados operacional da Corteplan (clientes, orçamentos, pedidos, histórico e
                  catálogo de itens).
                </p>
                <div className="pt-2">
                  <Button
                    onClick={handleExportBackup}
                    disabled={isExporting}
                    className="w-full bg-[#3A3A3C] hover:bg-[#2E2E30] text-white gap-2"
                  >
                    <Download className="h-4 w-4 text-[#F08A24]" />
                    {isExporting ? 'Gerando arquivo de backup...' : 'Baixar Arquivo de Backup'}
                  </Button>
                </div>
              </div>

              {/* Importar / Restaurar */}
              <div className="border border-slate-200 rounded-xl p-5 space-y-4 bg-slate-50/50">
                <div className="flex items-center gap-2 font-semibold text-slate-900">
                  <Upload className="h-5 w-5 text-blue-600" />
                  Importar / Validar Backup
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Carregue um arquivo JSON gerado previamente para validar a integridade dos dados e
                  restaurar configurações do sistema.
                </p>
                <div className="pt-2">
                  <label className="flex items-center justify-center w-full px-4 py-2 border border-slate-300 rounded-lg shadow-xs text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 cursor-pointer transition-colors">
                    <Upload className="h-4 w-4 text-blue-600 mr-2" />
                    {importing ? 'Validando arquivo...' : 'Selecionar Arquivo .JSON'}
                    <input
                      type="file"
                      accept=".json"
                      className="hidden"
                      onChange={handleImportFile}
                      disabled={importing}
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Informação sobre segurança */}
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
              <ShieldCheck className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-900 leading-relaxed">
                <strong className="font-semibold block mb-0.5">
                  Segurança dos Dados e Backups:
                </strong>
                O backend na nuvem Skip Cloud já realiza snapshots automáticos contínuos de
                integridade. A exportação manual nesta tela serve como salvaguarda local
                independente para auditoria e gestão da diretoria.
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

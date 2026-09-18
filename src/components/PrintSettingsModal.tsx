import React, { useState, useEffect } from 'react'
import {
  Printer,
  Sliders,
  Scissors,
  RotateCcw,
  Save,
  Eye,
  FileText,
  Layers,
  ZoomIn,
  ZoomOut,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  PrintSettingsConfig,
  DEFAULT_PRINT_SETTINGS,
  ProposalBlockId,
  ProposalLayoutConfig,
} from '@/types'
import { BLOCK_LABELS } from '@/components/ProposalLayoutEditor'
import { toast } from 'sonner'

interface PrintSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  currentSettings?: PrintSettingsConfig
  layoutConfig?: ProposalLayoutConfig
  documentTitle?: string
  previewContentElementId?: string // ID do elemento DOM (#proposal-sheet) para preview espelhado
  onApplyAndPrint: (settings: PrintSettingsConfig) => void
  onSaveSettings?: (settings: PrintSettingsConfig) => Promise<void> | void
  isSaving?: boolean
}

// Lista ordenada de blocos que podem ter quebra de página manual antes deles
const BREAKABLE_BLOCKS: { id: ProposalBlockId; label: string; defaultPage: number }[] = [
  { id: 'items', label: 'Tabela de Itens e Produtos', defaultPage: 1 },
  { id: 'totals_obs', label: 'Observações e Bloco de Totais', defaultPage: 1 },
  { id: 'conditions_summary', label: 'Condições Comerciais e Validade', defaultPage: 2 },
  { id: 'installments', label: 'Programação de Parcelas / Pagamento', defaultPage: 2 },
  { id: 'signature', label: 'Área de Assinaturas', defaultPage: 2 },
]

export function applyDynamicPrintStyles(settings: PrintSettingsConfig) {
  const existingStyle = document.getElementById('corteplan-dynamic-print-style')
  if (existingStyle) {
    existingStyle.remove()
  }

  const topMm = settings.marginTopMm ?? 6.5
  const bottomMm = settings.marginBottomMm ?? 18
  const leftMm = settings.marginLeftMm ?? 10
  const rightMm = settings.marginRightMm ?? 10
  const scale = (settings.scalePercent ?? 100) / 100

  // Gera seletores de quebra forçada para os blocos marcados
  const breakSelectors = Object.entries(settings.breaksBefore || {})
    .filter(([_, shouldBreak]) => shouldBreak)
    .map(([blockId]) => `[data-block-id="${blockId}"]`)
    .join(', ')

  const breakCss = breakSelectors
    ? `
      ${breakSelectors} {
        page-break-before: always !important;
        break-before: page !important;
        margin-top: 0 !important;
        padding-top: 4mm !important;
      }
    `
    : ''

  const styleEl = document.createElement('style')
  styleEl.id = 'corteplan-dynamic-print-style'
  styleEl.innerHTML = `
    @media print {
      @page {
        size: A4 portrait !important;
        margin: ${topMm}mm ${rightMm}mm ${bottomMm}mm ${leftMm}mm !important;
      }

      body {
        background: #ffffff !important;
        background-color: #ffffff !important;
        color: #0f172a !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }

      #proposal-sheet, .proposal-document-sheet {
        zoom: ${scale} !important;
        transform-origin: top center !important;
        width: 100% !important;
        max-width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
      }

      ${breakCss}
    }
  `
  document.head.appendChild(styleEl)
}

export default function PrintSettingsModal({
  isOpen,
  onClose,
  currentSettings,
  layoutConfig,
  documentTitle = 'Proposta Comercial Corteplan',
  previewContentElementId = 'proposal-sheet',
  onApplyAndPrint,
  onSaveSettings,
  isSaving = false,
}: PrintSettingsModalProps) {
  const [settings, setSettings] = useState<PrintSettingsConfig>(() => ({
    ...DEFAULT_PRINT_SETTINGS,
    ...(currentSettings || {}),
    breaksBefore: {
      ...DEFAULT_PRINT_SETTINGS.breaksBefore,
      ...(currentSettings?.breaksBefore || {}),
    },
  }))

  const [activeTab, setActiveTab] = useState<'margins' | 'breaks' | 'presets'>('margins')
  const [previewZoom, setPreviewZoom] = useState<number>(75) // % de zoom do preview visual

  // Atualiza quando abrir ou trocar props
  useEffect(() => {
    if (isOpen) {
      setSettings({
        ...DEFAULT_PRINT_SETTINGS,
        ...(currentSettings || {}),
        breaksBefore: {
          ...DEFAULT_PRINT_SETTINGS.breaksBefore,
          ...(currentSettings?.breaksBefore || {}),
        },
      })
    }
  }, [isOpen, currentSettings])

  const handleUpdateMargin = (field: keyof PrintSettingsConfig, val: number) => {
    setSettings((prev) => ({
      ...prev,
      [field]: Math.max(0, Math.min(150, val)),
    }))
  }

  const handleToggleBreak = (blockId: ProposalBlockId) => {
    setSettings((prev) => ({
      ...prev,
      breaksBefore: {
        ...prev.breaksBefore,
        [blockId]: !prev.breaksBefore?.[blockId],
      },
    }))
  }

  const handleResetDefaults = () => {
    setSettings({ ...DEFAULT_PRINT_SETTINGS })
    toast.info('Margens e quebras restauradas para o padrão oficial.')
  }

  const handlePresetCalcme = () => {
    // Preset baseado no sistema Calcme (6,5mm superior, 10mm esquerda/direita, 18mm inferior)
    setSettings((prev) => ({
      ...prev,
      marginTopMm: 6.5,
      marginBottomMm: 18,
      marginLeftMm: 10,
      marginRightMm: 10,
      scalePercent: 100,
    }))
    toast.success('Preset Calcme aplicado: Topo 6,5mm | Laterais 10mm | Rodapé 18mm')
  }

  const handlePresetCompact = () => {
    setSettings((prev) => ({
      ...prev,
      marginTopMm: 5,
      marginBottomMm: 14,
      marginLeftMm: 8,
      marginRightMm: 8,
      scalePercent: 95,
    }))
    toast.success('Preset Econômico/Compacto aplicado.')
  }

  const handlePresetSpacious = () => {
    setSettings((prev) => ({
      ...prev,
      marginTopMm: 15,
      marginBottomMm: 20,
      marginLeftMm: 15,
      marginRightMm: 15,
      scalePercent: 100,
    }))
    toast.success('Preset Espaçado aplicado.')
  }

  const triggerPrintWithTitle = () => {
    const originalTitle = document.title
    if (documentTitle) {
      document.title = documentTitle
    }
    applyDynamicPrintStyles(settings)
    onApplyAndPrint(settings)

    // Restaura document.title após o fechamento da janela de impressão
    const restoreTitle = () => {
      document.title = originalTitle
      window.removeEventListener('afterprint', restoreTitle)
    }
    window.addEventListener('afterprint', restoreTitle)
    // Fallback de segurança para restauração do título
    setTimeout(() => {
      document.title = originalTitle
    }, 5000)
  }

  const handlePrint = () => {
    triggerPrintWithTitle()
  }

  const handleSaveAndPrint = async () => {
    if (onSaveSettings) {
      await onSaveSettings(settings)
    }
    triggerPrintWithTitle()
  }

  if (!isOpen) return null

  // Calcular área útil da folha A4 (210mm x 297mm)
  const usefulWidthMm = Math.max(
    50,
    210 - (Number(settings.marginLeftMm) || 0) - (Number(settings.marginRightMm) || 0),
  )
  const usefulHeightMm = Math.max(
    50,
    297 - (Number(settings.marginTopMm) || 0) - (Number(settings.marginBottomMm) || 0),
  )

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-full h-full max-w-none md:max-w-6xl lg:max-w-7xl xl:max-w-[92vw] md:h-[94vh] md:max-h-[94vh] p-0 overflow-hidden rounded-none md:rounded-2xl border-slate-800 bg-[#1C1C1E] text-slate-100 flex flex-col shadow-2xl">
        {/* Header no estilo Calcme / Ferramenta Pro Corteplan */}
        <div className="flex items-center justify-between px-5 sm:px-7 py-4 border-b border-slate-800 bg-[#262628] shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-[#E66812] to-[#F08A24] text-white flex items-center justify-center font-black text-base shadow-lg ring-1 ring-white/10 shrink-0">
              <Printer className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <DialogTitle className="text-lg md:text-xl font-bold text-white tracking-tight">
                  Configuração de Impressão e PDF
                </DialogTitle>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-orange-500/20 text-[#F08A24] font-bold border border-orange-500/30">
                  Estilo Calcme
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Ajuste manualmente margens em milímetros (mm), quebras de página e escala da folha
                A4
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleResetDefaults}
              className="text-xs sm:text-sm text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl px-3 h-9"
              title="Restaurar padrão"
            >
              <RotateCcw className="h-4 w-4 mr-1.5 text-slate-400" />
              Restaurar Padrão
            </Button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Fechar janela"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Corpo: Painel de Controles à esquerda (42%) + Preview A4 interativo à direita (58%) */}
        <div className="flex-1 overflow-y-auto md:overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-0">
          {/* LADO ESQUERDO: Controles (5 colunas desktop) */}
          <div className="md:col-span-5 lg:col-span-5 border-b md:border-b-0 md:border-r border-slate-800 bg-[#212124] flex flex-col md:overflow-y-auto">
            {/* Navegação entre Abas */}
            <div className="flex border-b border-slate-800 bg-[#1C1C1E] p-2 gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('margins')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                  activeTab === 'margins'
                    ? 'bg-[#3A3A3C] text-white shadow-sm ring-1 ring-white/10'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <Sliders className="h-4 w-4 text-[#F08A24]" />
                Margens (mm)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('breaks')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                  activeTab === 'breaks'
                    ? 'bg-[#3A3A3C] text-white shadow-sm ring-1 ring-white/10'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <Scissors className="h-4 w-4 text-[#F08A24]" />
                Quebras de Página
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('presets')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                  activeTab === 'presets'
                    ? 'bg-[#3A3A3C] text-white shadow-sm ring-1 ring-white/10'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <Layers className="h-4 w-4 text-[#F08A24]" />
                Modelos Rápidos
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-6 flex-1">
              {/* ABA 1: MARGENS (ESTILO CALCME) */}
              {activeTab === 'margins' && (
                <div className="space-y-6">
                  <div className="bg-[#1C1C1E] p-4 rounded-xl border border-slate-800 space-y-1.5 shadow-xs">
                    <div className="text-sm font-bold text-white flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-[#F08A24]" />
                        Dimensões da Folha A4
                      </span>
                      <span className="font-mono text-[#F08A24] font-semibold text-xs bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20">
                        210mm × 297mm
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Área útil resultante de impressão:{' '}
                      <strong className="text-slate-100 font-mono text-sm">
                        {usefulWidthMm.toFixed(1)}mm × {usefulHeightMm.toFixed(1)}mm
                      </strong>
                    </p>
                  </div>

                  {/* Grid de 4 margens com inputs diretos em mm */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                        Margens em Milímetros (mm)
                      </Label>
                      <span className="text-[11px] text-slate-500">Formato Calcme</span>
                    </div>

                    {/* Margem Superior (Calcme: 6,5mm) */}
                    <div className="bg-[#1C1C1E] p-4 rounded-xl border border-slate-800 space-y-3 hover:border-slate-700 transition-colors">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <Label
                            htmlFor="margin-top"
                            className="text-sm font-semibold text-white block"
                          >
                            Margem Superior (Topo)
                          </Label>
                          <p className="text-xs text-slate-400 mt-0.5">
                            Distância do cabeçalho até o topo da folha
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Input
                            id="margin-top"
                            type="number"
                            step="0.5"
                            min="0"
                            max="60"
                            value={settings.marginTopMm}
                            onChange={(e) =>
                              handleUpdateMargin('marginTopMm', parseFloat(e.target.value) || 0)
                            }
                            className="w-24 h-9 text-right font-mono text-sm font-bold bg-[#262628] border-slate-700 text-white rounded-lg focus-visible:ring-[#F08A24]"
                          />
                          <span className="text-xs text-slate-400 font-mono font-semibold">mm</span>
                        </div>
                      </div>
                      <Slider
                        value={[settings.marginTopMm]}
                        min={0}
                        max={40}
                        step={0.5}
                        onValueChange={([val]) => handleUpdateMargin('marginTopMm', val)}
                        className="py-1.5"
                      />
                    </div>

                    {/* Margens Laterais (Esquerda e Direita - Calcme: 10mm / 10mm) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {/* Margem Esquerda */}
                      <div className="bg-[#1C1C1E] p-4 rounded-xl border border-slate-800 space-y-3 hover:border-slate-700 transition-colors">
                        <div className="flex items-center justify-between gap-1">
                          <Label htmlFor="margin-left" className="text-sm font-semibold text-white">
                            Lateral Esquerda
                          </Label>
                          <div className="flex items-center gap-1 shrink-0">
                            <Input
                              id="margin-left"
                              type="number"
                              step="0.5"
                              min="0"
                              max="50"
                              value={settings.marginLeftMm}
                              onChange={(e) =>
                                handleUpdateMargin('marginLeftMm', parseFloat(e.target.value) || 0)
                              }
                              className="w-20 h-9 text-right font-mono text-sm font-bold bg-[#262628] border-slate-700 text-white rounded-lg focus-visible:ring-[#F08A24]"
                            />
                            <span className="text-xs text-slate-400 font-mono">mm</span>
                          </div>
                        </div>
                        <Slider
                          value={[settings.marginLeftMm]}
                          min={0}
                          max={35}
                          step={0.5}
                          onValueChange={([val]) => handleUpdateMargin('marginLeftMm', val)}
                          className="py-1.5"
                        />
                      </div>

                      {/* Margem Direita */}
                      <div className="bg-[#1C1C1E] p-4 rounded-xl border border-slate-800 space-y-3 hover:border-slate-700 transition-colors">
                        <div className="flex items-center justify-between gap-1">
                          <Label
                            htmlFor="margin-right"
                            className="text-sm font-semibold text-white"
                          >
                            Lateral Direita
                          </Label>
                          <div className="flex items-center gap-1 shrink-0">
                            <Input
                              id="margin-right"
                              type="number"
                              step="0.5"
                              min="0"
                              max="50"
                              value={settings.marginRightMm}
                              onChange={(e) =>
                                handleUpdateMargin('marginRightMm', parseFloat(e.target.value) || 0)
                              }
                              className="w-20 h-9 text-right font-mono text-sm font-bold bg-[#262628] border-slate-700 text-white rounded-lg focus-visible:ring-[#F08A24]"
                            />
                            <span className="text-xs text-slate-400 font-mono">mm</span>
                          </div>
                        </div>
                        <Slider
                          value={[settings.marginRightMm]}
                          min={0}
                          max={35}
                          step={0.5}
                          onValueChange={([val]) => handleUpdateMargin('marginRightMm', val)}
                          className="py-1.5"
                        />
                      </div>
                    </div>

                    {/* Margem Inferior (Base / Rodapé - Calcme área de rodapé) */}
                    <div className="bg-[#1C1C1E] p-4 rounded-xl border border-slate-800 space-y-3 hover:border-slate-700 transition-colors">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <Label
                            htmlFor="margin-bottom"
                            className="text-sm font-semibold text-white block"
                          >
                            Margem Inferior (Base / Rodapé)
                          </Label>
                          <p className="text-xs text-slate-400 mt-0.5">
                            Espaço livre reservado para rodapé e paginação
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Input
                            id="margin-bottom"
                            type="number"
                            step="0.5"
                            min="0"
                            max="80"
                            value={settings.marginBottomMm}
                            onChange={(e) =>
                              handleUpdateMargin('marginBottomMm', parseFloat(e.target.value) || 0)
                            }
                            className="w-24 h-9 text-right font-mono text-sm font-bold bg-[#262628] border-slate-700 text-white rounded-lg focus-visible:ring-[#F08A24]"
                          />
                          <span className="text-xs text-slate-400 font-mono font-semibold">mm</span>
                        </div>
                      </div>
                      <Slider
                        value={[settings.marginBottomMm]}
                        min={5}
                        max={50}
                        step={0.5}
                        onValueChange={([val]) => handleUpdateMargin('marginBottomMm', val)}
                        className="py-1.5"
                      />
                    </div>
                  </div>

                  {/* Escala / Zoom do Conteúdo */}
                  <div className="bg-[#1C1C1E] p-4 rounded-xl border border-slate-800 space-y-3 hover:border-slate-700 transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm font-semibold text-white block">
                          Escala do Conteúdo (Zoom de Impressão)
                        </Label>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Reduza se a proposta ultrapassar poucos centímetros para outra folha
                        </p>
                      </div>
                      <span className="text-base font-mono font-bold text-[#F08A24] bg-orange-500/10 px-2.5 py-1 rounded-lg border border-orange-500/20">
                        {settings.scalePercent}%
                      </span>
                    </div>
                    <Slider
                      value={[settings.scalePercent]}
                      min={70}
                      max={115}
                      step={1}
                      onValueChange={([val]) =>
                        setSettings((prev) => ({ ...prev, scalePercent: val }))
                      }
                      className="py-1.5"
                    />
                  </div>
                </div>
              )}

              {/* ABA 2: QUEBRAS MANUAIS DE PÁGINA */}
              {activeTab === 'breaks' && (
                <div className="space-y-4">
                  <div className="bg-[#1C1C1E] p-4 rounded-xl border border-slate-800 text-xs sm:text-sm text-slate-300 space-y-1.5">
                    <div className="font-bold text-white flex items-center gap-2 text-sm">
                      <Scissors className="h-4 w-4 text-[#F08A24]" />
                      Controle Manual de Quebra de Página
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Escolha onde forçar início de uma nova folha para evitar que tabelas ou
                      assinaturas fiquem cortadas com espaço em branco desorganizado.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {BREAKABLE_BLOCKS.map((block) => {
                      const isChecked = Boolean(settings.breaksBefore?.[block.id])
                      return (
                        <div
                          key={block.id}
                          onClick={() => handleToggleBreak(block.id)}
                          className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                            isChecked
                              ? 'bg-amber-500/10 border-[#F08A24] text-white shadow-sm'
                              : 'bg-[#1C1C1E] border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-800/40'
                          }`}
                        >
                          <div className="space-y-1 pr-2">
                            <div className="text-sm font-bold flex items-center gap-2.5">
                              <span>{block.label}</span>
                              {isChecked && (
                                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#F08A24] text-black font-extrabold tracking-wide">
                                  QUEBRA ATIVA
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-400">
                              {isChecked
                                ? 'Inicia obrigatoriamente no topo de uma nova página A4'
                                : 'Segue o fluxo contínuo na mesma página se houver espaço'}
                            </p>
                          </div>

                          <Switch
                            checked={isChecked}
                            onCheckedChange={() => handleToggleBreak(block.id)}
                            className="shrink-0 data-[state=checked]:bg-[#F08A24] scale-110"
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* ABA 3: MODELOS PRÉ-CONFIGURADOS */}
              {activeTab === 'presets' && (
                <div className="space-y-3.5">
                  <div className="bg-[#1C1C1E] p-4 rounded-xl border border-slate-800 text-xs sm:text-sm text-slate-300">
                    <p className="font-bold text-white text-sm">Modelos Rápidos de Margem</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Selecione um ajuste pré-definido e testado para folhas A4 comerciais.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handlePresetCalcme}
                    className="w-full text-left p-4 rounded-xl border border-slate-800 hover:border-[#F08A24] bg-[#1C1C1E] hover:bg-slate-800/80 transition-all space-y-1.5 group cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-white group-hover:text-[#F08A24] transition-colors">
                        Padrão Calcme Oficial (6,5mm / 10mm / 18mm)
                      </span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-semibold border border-emerald-500/30">
                        Recomendado
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Topo 6,5mm, laterais 10mm, base 18mm. Medidas idênticas ao print de referência
                      do Calcme com excelente aproveitamento de folha.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={handlePresetCompact}
                    className="w-full text-left p-4 rounded-xl border border-slate-800 hover:border-slate-700 bg-[#1C1C1E] hover:bg-slate-800/80 transition-all space-y-1.5 cursor-pointer"
                  >
                    <div className="text-sm font-bold text-white">
                      Modelo Econômico / Compacto (5mm / 8mm)
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Margens estreitas e escala 95%. Ideal para orçamentos longos com muitos itens
                      cabendo em menos páginas.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={handlePresetSpacious}
                    className="w-full text-left p-4 rounded-xl border border-slate-800 hover:border-slate-700 bg-[#1C1C1E] hover:bg-slate-800/80 transition-all space-y-1.5 cursor-pointer"
                  >
                    <div className="text-sm font-bold text-white">
                      Modelo Espaçado / Executivo (15mm / 15mm)
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Margens mais amplas e respiração visual para propostas curtas de alto padrão.
                    </p>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* LADO DIREITO: Pré-visualização ao vivo da folha A4 com etiquetas estilo Calcme (7 colunas desktop) */}
          <div className="md:col-span-7 lg:col-span-7 bg-[#141416] p-4 sm:p-6 lg:p-8 flex flex-col items-center justify-center relative overflow-hidden min-h-[440px] md:min-h-0">
            {/* Controles de Zoom do Preview */}
            <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5 bg-[#262628] p-1.5 rounded-xl border border-slate-800 shadow-md">
              <button
                type="button"
                onClick={() => setPreviewZoom((z) => Math.max(50, z - 10))}
                className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors"
                title="Diminuir zoom do preview"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <span className="text-xs font-mono font-bold text-slate-200 px-2 min-w-[44px] text-center">
                {previewZoom}%
              </span>
              <button
                type="button"
                onClick={() => setPreviewZoom((z) => Math.min(130, z + 10))}
                className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors"
                title="Aumentar zoom do preview"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
            </div>

            <div className="absolute top-4 left-6 z-20 flex items-center gap-2">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2 bg-[#262628] px-3 py-1.5 rounded-xl border border-slate-800">
                <Eye className="h-4 w-4 text-[#F08A24]" />
                Pré-visualização A4 ao Vivo
              </span>
            </div>

            {/* Container da Folha A4 Simulada (Proporção 210 x 297mm ≈ 1 : 1.414) */}
            <div
              className="relative transition-all duration-200 shadow-2xl flex items-center justify-center my-auto"
              style={{
                width: `${420 * (previewZoom / 100)}px`,
                height: `${594 * (previewZoom / 100)}px`,
                maxWidth: '96%',
              }}
            >
              {/* Folha Branca A4 */}
              <div className="w-full h-full bg-white rounded-xs shadow-2xl relative overflow-hidden border border-slate-300 text-slate-900 select-none">
                {/* Linha guia pontilhada da margem (exatamente no estilo Calcme) */}
                <div
                  className="absolute border-2 border-dashed border-blue-500/80 pointer-events-none transition-all duration-150"
                  style={{
                    top: `${(settings.marginTopMm / 297) * 100}%`,
                    bottom: `${(settings.marginBottomMm / 297) * 100}%`,
                    left: `${(settings.marginLeftMm / 210) * 100}%`,
                    right: `${(settings.marginRightMm / 210) * 100}%`,
                  }}
                />

                {/* ETIQUETAS PRETAS SOBREPOSTAS COM MEDIDAS EM MILÍMETROS (Exatamente como o print Calcme) */}
                {/* Etiqueta Topo: 6,5mm */}
                <div
                  className="absolute z-30 -translate-x-1/2 bg-[#1C1C1E] text-white font-mono font-bold text-xs px-3 py-1 rounded-md shadow-xl border border-slate-700 pointer-events-none"
                  style={{
                    top: `calc(${(settings.marginTopMm / 297) * 100}% - 6px)`,
                    left: '50%',
                  }}
                >
                  {settings.marginTopMm}mm
                </div>

                {/* Etiqueta Esquerda: 10mm */}
                <div
                  className="absolute z-30 -translate-y-1/2 bg-[#1C1C1E] text-white font-mono font-bold text-xs px-2.5 py-1 rounded-md shadow-xl border border-slate-700 pointer-events-none"
                  style={{
                    left: `calc(${(settings.marginLeftMm / 210) * 100}% - 4px)`,
                    top: '48%',
                  }}
                >
                  {settings.marginLeftMm}mm
                </div>

                {/* Etiqueta Direita: 10mm */}
                <div
                  className="absolute z-30 -translate-y-1/2 -translate-x-full bg-[#1C1C1E] text-white font-mono font-bold text-xs px-2.5 py-1 rounded-md shadow-xl border border-slate-700 pointer-events-none"
                  style={{
                    right: `calc(100% - ${(settings.marginRightMm / 210) * 100}% - 4px)`,
                    top: '52%',
                  }}
                >
                  {settings.marginRightMm}mm
                </div>

                {/* Etiqueta Base / Rodapé: 18mm */}
                <div
                  className="absolute z-30 -translate-x-1/2 bg-[#1C1C1E] text-white font-mono font-bold text-xs px-3 py-1 rounded-md shadow-xl border border-slate-700 pointer-events-none"
                  style={{
                    bottom: `calc(${(settings.marginBottomMm / 297) * 100}% - 8px)`,
                    left: '50%',
                  }}
                >
                  {settings.marginBottomMm}mm
                </div>

                {/* Conteúdo Esquematizado dentro da Área Útil */}
                <div
                  className="w-full h-full p-3 sm:p-4 flex flex-col justify-between text-[8px] sm:text-[9px] leading-tight"
                  style={{
                    paddingTop: `${(settings.marginTopMm / 297) * 100}%`,
                    paddingBottom: `${(settings.marginBottomMm / 297) * 100}%`,
                    paddingLeft: `${(settings.marginLeftMm / 210) * 100}%`,
                    paddingRight: `${(settings.marginRightMm / 210) * 100}%`,
                  }}
                >
                  {/* Cabeçalho da proposta no preview */}
                  <div className="space-y-1.5 border-b border-slate-200 pb-2">
                    <div className="flex justify-between items-center">
                      <div className="h-4 w-20 bg-[#3A3A3C] rounded-xs" />
                      <div className="text-[8px] sm:text-[9px] text-right font-bold text-slate-800">
                        CORTEPLAN
                      </div>
                    </div>
                    <div className="text-[7px] sm:text-[8px] text-slate-500 flex justify-between">
                      <span className="font-bold text-slate-700">CLIENTE IDENTIFICADO</span>
                      <span className="font-mono">Proposta Nº 141</span>
                    </div>
                  </div>

                  {/* Itens esquematizados */}
                  <div className="space-y-1.5 my-2 flex-1 overflow-hidden">
                    <div className="bg-slate-100 p-1 rounded-xs flex justify-between font-bold text-[7.5px] sm:text-[8.5px]">
                      <span>Item</span>
                      <span>Descrição</span>
                      <span>Total</span>
                    </div>
                    <div className="space-y-1 text-[7px] sm:text-[8px] text-slate-600">
                      <div className="flex justify-between border-b border-slate-100 py-0.5">
                        <span>1. Quiosque Besties Cookie</span>
                        <span className="font-mono font-bold text-slate-900">R$ 62.000,00</span>
                      </div>
                      <div className="flex justify-between border-b border-slate-100 py-0.5">
                        <span>2. Frete e Instalação Especializada</span>
                        <span className="font-mono font-bold text-slate-900">R$ 10.000,00</span>
                      </div>
                    </div>

                    {/* Simulação de quebra se ativada */}
                    {settings.breaksBefore?.totals_obs && (
                      <div className="my-1.5 border-t-2 border-dashed border-red-500 text-red-600 text-[7.5px] font-bold text-center py-1 bg-red-50 rounded">
                        [Quebra de página forçada antes dos totais]
                      </div>
                    )}

                    {/* Totais */}
                    <div className="bg-slate-50 p-1.5 rounded border border-slate-200 text-right mt-1.5">
                      <span className="font-bold text-[8px] sm:text-[9px] text-slate-900">
                        Total da Proposta: R$ 72.000,00
                      </span>
                    </div>
                  </div>

                  {/* Rodapé fixo simulado na base da folha */}
                  <div className="border-t border-slate-200 pt-1.5 text-center text-[6.5px] sm:text-[7.5px] text-slate-400">
                    CORTEPLAN &bull; CNPJ 24.306.897/0001-44 &bull; contato@corteplan.com.br
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-3 text-center">
              <span className="text-xs text-slate-400">
                Padrão A4 vertical &bull; Fundo 100% branco sem elementos de interface &bull;
                Escala: {settings.scalePercent}%
              </span>
            </div>
          </div>
        </div>

        {/* Footer com Ações */}
        <div className="flex flex-col sm:flex-row items-center justify-between px-5 sm:px-7 py-4 border-t border-slate-800 bg-[#262628] gap-3 shrink-0">
          <div className="text-xs sm:text-sm text-slate-400 flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 ring-4 ring-emerald-500/20 shrink-0" />
            <span>Configurações aplicadas na impressão nativa do navegador</span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="border-slate-700 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs sm:text-sm h-10 px-4"
            >
              Cancelar
            </Button>

            {onSaveSettings && (
              <Button
                type="button"
                variant="outline"
                disabled={isSaving}
                onClick={handleSaveAndPrint}
                className="border-orange-500/50 text-[#F08A24] hover:bg-orange-500/10 rounded-xl text-xs sm:text-sm h-10 px-4 font-semibold"
              >
                <Save className="h-4 w-4 mr-1.5" />
                {isSaving ? 'Salvando...' : 'Salvar e Imprimir'}
              </Button>
            )}

            <Button
              type="button"
              onClick={handlePrint}
              className="bg-[#F08A24] hover:bg-[#d9771a] text-white font-bold rounded-xl text-xs sm:text-sm h-10 px-5 shadow-lg shadow-orange-500/20"
            >
              <Printer className="h-4 w-4 mr-2" />
              Imprimir / Salvar PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

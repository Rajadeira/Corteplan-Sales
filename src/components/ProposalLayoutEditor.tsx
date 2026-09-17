import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  Move,
  RotateCcw,
  Save,
  Check,
  Sliders,
  ChevronUp,
  ChevronDown,
  Maximize2,
  Minimize2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Eye,
  Info,
  Layers,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { ProposalLayoutConfig, ProposalBlockId, BlockStyleConfig } from '@/types'
import { toast } from 'sonner'

export const DEFAULT_PAGE1_ORDER: ProposalBlockId[] = [
  'header',
  'client',
  'title_date',
  'intro',
  'items',
  'totals_obs',
]

export const DEFAULT_PAGE2_ORDER: ProposalBlockId[] = [
  'conditions_summary',
  'installments',
  'signature',
  'footer',
]

export const DEFAULT_BLOCK_STYLE: BlockStyleConfig = {
  xOffset: 0,
  yOffset: 0,
  scale: 100,
  widthPercent: 100,
  marginTop: 0,
  marginBottom: 0,
  padding: 0,
  align: 'left',
}

export const BLOCK_LABELS: Record<ProposalBlockId, { name: string; page: number }> = {
  header: { name: 'Cabeçalho e Logo Corteplan', page: 1 },
  client: { name: 'Dados do Cliente', page: 1 },
  title_date: { name: 'Título e Data da Proposta', page: 1 },
  intro: { name: 'Texto de Apresentação', page: 1 },
  items: { name: 'Tabela de Itens e Produtos', page: 1 },
  totals_obs: { name: 'Observações e Bloco de Totais', page: 1 },
  conditions_summary: { name: 'Condições Comerciais e Validade', page: 2 },
  installments: { name: 'Tabela de Parcelas', page: 2 },
  signature: { name: 'Área de Assinaturas', page: 2 },
  footer: { name: 'Rodapé com Dados de Contato', page: 2 },
}

interface LayoutBlockWrapperProps {
  id: ProposalBlockId
  isEditMode: boolean
  isSelected: boolean
  styleConfig?: BlockStyleConfig
  onSelect: (id: ProposalBlockId) => void
  onUpdateStyle: (id: ProposalBlockId, newStyle: Partial<BlockStyleConfig>) => void
  onMoveOrder: (id: ProposalBlockId, direction: 'up' | 'down') => void
  children: React.ReactNode
}

/**
 * Wrapper com alças de arraste e redimensionamento estilo CorelDRAW
 */
export function LayoutBlockWrapper({
  id,
  isEditMode,
  isSelected,
  styleConfig = {},
  onSelect,
  onUpdateStyle,
  onMoveOrder,
  children,
}: LayoutBlockWrapperProps) {
  const cfg = { ...DEFAULT_BLOCK_STYLE, ...styleConfig }
  const isDraggingRef = useRef(false)
  const isResizingRef = useRef<string | null>(null)
  const dragStartRef = useRef<{
    mouseX: number
    mouseY: number
    startX: number
    startY: number
    startWidth: number
  }>({
    mouseX: 0,
    mouseY: 0,
    startX: 0,
    startY: 0,
    startWidth: 100,
  })

  // Arraste livre (Pan/Offset) estilo Corel
  const handleMouseDownDrag = (e: React.MouseEvent) => {
    if (!isEditMode) return
    e.stopPropagation()
    onSelect(id)
    isDraggingRef.current = true
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: cfg.xOffset || 0,
      startY: cfg.yOffset || 0,
      startWidth: cfg.widthPercent || 100,
    }
  }

  // Redimensionamento pelas alças laterais
  const handleMouseDownResize = (e: React.MouseEvent, handle: string) => {
    if (!isEditMode) return
    e.stopPropagation()
    onSelect(id)
    isResizingRef.current = handle
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: cfg.xOffset || 0,
      startY: cfg.yOffset || 0,
      startWidth: cfg.widthPercent || 100,
    }
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingRef.current) {
        const dx = e.clientX - dragStartRef.current.mouseX
        const dy = e.clientY - dragStartRef.current.mouseY
        const newX = Math.round(dragStartRef.current.startX + dx)
        const newY = Math.round(dragStartRef.current.startY + dy)
        onUpdateStyle(id, { xOffset: newX, yOffset: newY })
      } else if (isResizingRef.current) {
        const dx = e.clientX - dragStartRef.current.mouseX
        // Redimensionar largura percentual
        const deltaPercent = Math.round((dx / 600) * 100)
        let newWidth = dragStartRef.current.startWidth
        if (isResizingRef.current === 'right' || isResizingRef.current === 'bottom-right') {
          newWidth = Math.max(30, Math.min(100, dragStartRef.current.startWidth + deltaPercent))
        } else if (isResizingRef.current === 'left') {
          newWidth = Math.max(30, Math.min(100, dragStartRef.current.startWidth - deltaPercent))
        }
        onUpdateStyle(id, { widthPercent: newWidth })
      }
    }

    const handleMouseUp = () => {
      isDraggingRef.current = false
      isResizingRef.current = null
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [id, onUpdateStyle])

  // Aplicação de estilo computado (visível na tela e na impressão fiel)
  const computedStyle: React.CSSProperties = {
    transform: `translate(${cfg.xOffset || 0}px, ${cfg.yOffset || 0}px) scale(${(cfg.scale || 100) / 100})`,
    transformOrigin:
      cfg.align === 'center' ? 'center top' : cfg.align === 'right' ? 'right top' : 'left top',
    width: cfg.widthPercent ? `${cfg.widthPercent}%` : '100%',
    marginTop: cfg.marginTop ? `${cfg.marginTop}px` : undefined,
    marginBottom: cfg.marginBottom ? `${cfg.marginBottom}px` : undefined,
    padding: cfg.padding ? `${cfg.padding}px` : undefined,
    marginLeft: cfg.align === 'center' ? 'auto' : cfg.align === 'right' ? 'auto' : undefined,
    marginRight: cfg.align === 'center' ? 'auto' : undefined,
    transition: isDraggingRef.current || isResizingRef.current ? 'none' : 'box-shadow 0.15s ease',
  }

  if (!isEditMode) {
    return <div style={computedStyle}>{children}</div>
  }

  const label = BLOCK_LABELS[id]?.name || id

  return (
    <div
      onClick={(e) => {
        e.stopPropagation()
        onSelect(id)
      }}
      style={computedStyle}
      className={`relative group rounded-md transition-colors ${
        isSelected
          ? 'outline-2 outline-dashed outline-[#F08A24] bg-amber-50/20 shadow-sm'
          : 'outline-1 outline-dashed outline-slate-300 hover:outline-[#3A3A3C] hover:bg-slate-50/30'
      }`}
    >
      {/* Barra de controle no topo do bloco no modo CorelDRAW */}
      <div
        className={`absolute -top-7 left-0 right-0 h-6 flex items-center justify-between px-2 text-[10px] font-bold rounded-t-md z-30 select-none ${
          isSelected
            ? 'bg-[#3A3A3C] text-white opacity-100'
            : 'bg-slate-800 text-slate-200 opacity-0 group-hover:opacity-100'
        } transition-opacity duration-150`}
      >
        <div
          onMouseDown={handleMouseDownDrag}
          className="flex items-center gap-1.5 cursor-move truncate"
          title="Clique e arraste para posicionar livremente"
        >
          <Move className="h-3 w-3 text-[#F08A24]" />
          <span className="truncate">{label}</span>
          {(cfg.xOffset !== 0 || cfg.yOffset !== 0) && (
            <span className="text-[9px] text-[#F08A24] font-mono">
              ({cfg.xOffset}px, {cfg.yOffset}px)
            </span>
          )}
          {cfg.widthPercent !== 100 && (
            <span className="text-[9px] text-amber-200 font-mono">[{cfg.widthPercent}%]</span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onMoveOrder(id, 'up')
            }}
            className="p-0.5 hover:bg-slate-700 rounded text-slate-300 hover:text-white"
            title="Mover para cima"
          >
            <ChevronUp className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onMoveOrder(id, 'down')
            }}
            className="p-0.5 hover:bg-slate-700 rounded text-slate-300 hover:text-white"
            title="Mover para baixo"
          >
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Alças de Redimensionamento tipo nós do CorelDRAW (visíveis quando selecionado) */}
      {isSelected && (
        <>
          {/* Alça Esquerda */}
          <div
            onMouseDown={(e) => handleMouseDownResize(e, 'left')}
            className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-white border-2 border-[#F08A24] rounded-xs cursor-ew-resize z-40 shadow-xs hover:scale-125 transition-transform"
            title="Redimensionar largura (esquerda)"
          />
          {/* Alça Direita */}
          <div
            onMouseDown={(e) => handleMouseDownResize(e, 'right')}
            className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-white border-2 border-[#F08A24] rounded-xs cursor-ew-resize z-40 shadow-xs hover:scale-125 transition-transform"
            title="Redimensionar largura (direita)"
          />
          {/* Alça Canto Inferior Direito */}
          <div
            onMouseDown={(e) => handleMouseDownResize(e, 'bottom-right')}
            className="absolute -right-1.5 -bottom-1.5 w-3 h-3 bg-[#F08A24] border-2 border-white rounded-xs cursor-nwse-resize z-40 shadow-xs hover:scale-125 transition-transform"
            title="Ajustar escala e largura"
          />
        </>
      )}

      {/* Conteúdo real do bloco */}
      <div className="relative pointer-events-auto">{children}</div>
    </div>
  )
}

/**
 * Painel flutuante de ferramentas de diagramação (Estilo CorelDRAW)
 */
interface CorelToolbarProps {
  isEditMode: boolean
  onToggleEditMode: () => void
  selectedBlockId: ProposalBlockId | null
  layoutConfig: ProposalLayoutConfig
  onSelectBlock: (id: ProposalBlockId | null) => void
  onUpdateBlockStyle: (id: ProposalBlockId, style: Partial<BlockStyleConfig>) => void
  onResetBlock: (id: ProposalBlockId) => void
  onResetAll: () => void
  onSaveLayout: () => void
  saving: boolean
}

export function CorelToolbar({
  isEditMode,
  onToggleEditMode,
  selectedBlockId,
  layoutConfig,
  onSelectBlock,
  onUpdateBlockStyle,
  onResetBlock,
  onResetAll,
  onSaveLayout,
  saving,
}: CorelToolbarProps) {
  const selectedStyle = selectedBlockId
    ? { ...DEFAULT_BLOCK_STYLE, ...(layoutConfig.blocks[selectedBlockId] || {}) }
    : DEFAULT_BLOCK_STYLE

  const selectedLabel = selectedBlockId ? BLOCK_LABELS[selectedBlockId]?.name : null

  if (!isEditMode) {
    return (
      <Button
        type="button"
        variant="outline"
        onClick={onToggleEditMode}
        className="rounded-xl border-[#3A3A3C] text-[#3A3A3C] hover:bg-slate-100 font-semibold shadow-xs"
      >
        <Sliders className="h-4 w-4 mr-1.5 text-[#F08A24]" />
        Modo de Ajuste do Layout
      </Button>
    )
  }

  return (
    <div className="print:hidden w-full bg-[#1C1C1E] text-slate-100 p-4 rounded-2xl border border-slate-800 shadow-2xl space-y-4">
      {/* Topo do painel: Status, Ações principais */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-[#F08A24] text-white flex items-center justify-center font-black text-xs shadow-md">
            CD
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#F08A24]">
                Ferramenta de Diagramação Manual
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-medium border border-amber-500/30">
                Ativo
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Arraste os blocos na folha ou use os controles de alça para ajustar posição e tamanho
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onResetAll}
            className="text-xs text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl"
            title="Restaura todos os blocos para o alinhamento e tamanhos originais"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1 text-slate-400" />
            Restaurar padrão
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={onSaveLayout}
            disabled={saving}
            className="bg-[#F08A24] hover:bg-[#d9771a] text-white font-bold rounded-xl text-xs shadow-md"
          >
            <Save className="h-3.5 w-3.5 mr-1" />
            {saving ? 'Salvando...' : 'Salvar Layout'}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onToggleEditMode}
            className="border-slate-700 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-medium"
          >
            <Check className="h-3.5 w-3.5 mr-1 text-emerald-400" />
            Concluir Edição
          </Button>
        </div>
      </div>

      {/* Controles do Bloco Atualmente Selecionado */}
      {selectedBlockId ? (
        <div className="bg-[#262628] p-3.5 rounded-xl border border-slate-700/80 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#F08A24]" />
              <span className="text-xs font-bold text-white">
                Elemento Selecionado: <span className="text-[#F08A24]">{selectedLabel}</span>
              </span>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onResetBlock(selectedBlockId)}
              className="text-[11px] h-6 text-slate-400 hover:text-white px-2"
            >
              Resetar este bloco
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            {/* Deslocamento X e Y */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px] text-slate-300">
                <span>Posição X / Y (Offset)</span>
                <span className="font-mono text-[#F08A24]">
                  X: {selectedStyle.xOffset || 0}px | Y: {selectedStyle.yOffset || 0}px
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-1 bg-[#1C1C1E] px-2 py-1 rounded border border-slate-700">
                  <span className="text-[10px] text-slate-400 font-bold">X:</span>
                  <input
                    type="number"
                    value={selectedStyle.xOffset || 0}
                    onChange={(e) =>
                      onUpdateBlockStyle(selectedBlockId, {
                        xOffset: parseInt(e.target.value, 10) || 0,
                      })
                    }
                    className="w-full bg-transparent text-xs font-mono text-white focus:outline-hidden"
                  />
                </div>
                <div className="flex items-center gap-1 bg-[#1C1C1E] px-2 py-1 rounded border border-slate-700">
                  <span className="text-[10px] text-slate-400 font-bold">Y:</span>
                  <input
                    type="number"
                    value={selectedStyle.yOffset || 0}
                    onChange={(e) =>
                      onUpdateBlockStyle(selectedBlockId, {
                        yOffset: parseInt(e.target.value, 10) || 0,
                      })
                    }
                    className="w-full bg-transparent text-xs font-mono text-white focus:outline-hidden"
                  />
                </div>
              </div>
            </div>

            {/* Largura Percentual */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px] text-slate-300">
                <span>Largura do Bloco</span>
                <span className="font-mono text-[#F08A24]">
                  {selectedStyle.widthPercent || 100}%
                </span>
              </div>
              <Slider
                value={[selectedStyle.widthPercent || 100]}
                min={30}
                max={100}
                step={5}
                onValueChange={([val]) =>
                  onUpdateBlockStyle(selectedBlockId, { widthPercent: val })
                }
                className="py-1"
              />
            </div>

            {/* Escala / Zoom do Bloco */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px] text-slate-300">
                <span>Escala (Tamanho)</span>
                <span className="font-mono text-[#F08A24]">{selectedStyle.scale || 100}%</span>
              </div>
              <Slider
                value={[selectedStyle.scale || 100]}
                min={70}
                max={130}
                step={2}
                onValueChange={([val]) => onUpdateBlockStyle(selectedBlockId, { scale: val })}
                className="py-1"
              />
            </div>

            {/* Alinhamento horizontal */}
            <div className="space-y-1.5">
              <div className="text-[11px] text-slate-300">Alinhamento</div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onUpdateBlockStyle(selectedBlockId, { align: 'left' })}
                  className={`h-7 px-2.5 rounded text-xs ${
                    (selectedStyle.align || 'left') === 'left'
                      ? 'bg-[#F08A24] text-white font-bold'
                      : 'bg-[#1C1C1E] text-slate-300 hover:text-white'
                  }`}
                  title="Alinhar à esquerda"
                >
                  <AlignLeft className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onUpdateBlockStyle(selectedBlockId, { align: 'center' })}
                  className={`h-7 px-2.5 rounded text-xs ${
                    selectedStyle.align === 'center'
                      ? 'bg-[#F08A24] text-white font-bold'
                      : 'bg-[#1C1C1E] text-slate-300 hover:text-white'
                  }`}
                  title="Centralizar"
                >
                  <AlignCenter className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onUpdateBlockStyle(selectedBlockId, { align: 'right' })}
                  className={`h-7 px-2.5 rounded text-xs ${
                    selectedStyle.align === 'right'
                      ? 'bg-[#F08A24] text-white font-bold'
                      : 'bg-[#1C1C1E] text-slate-300 hover:text-white'
                  }`}
                  title="Alinhar à direita"
                >
                  <AlignRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-3 bg-[#262628] rounded-xl border border-dashed border-slate-700 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
          <Layers className="h-4 w-4 text-[#F08A24]" />
          <span>
            Clique em qualquer bloco na proposta abaixo (logo, tabela, cliente, totais) para ajustar
            posição, largura ou escala.
          </span>
        </div>
      )}
    </div>
  )
}

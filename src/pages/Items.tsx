import React, { useState, useEffect } from 'react'
import {
  Package,
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Eye,
  Tag,
  DollarSign,
  AlertCircle,
  Layers,
  FileSpreadsheet,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { itemService } from '@/services/items'
import type { ItemCatalogRecord, ItemCategory } from '@/types'
import { ITEM_CATEGORIES, formatCurrencyBRL } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
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
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'

export default function Items() {
  const { user } = useAuth()
  const { toast } = useToast()
  const isAdmin = user?.role === 'Administrador'

  const [items, setItems] = useState<ItemCatalogRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<ItemCatalogRecord | null>(null)
  const [viewingItem, setViewingItem] = useState<ItemCatalogRecord | null>(null)
  const [isDeleting, setIsDeleting] = useState<ItemCatalogRecord | null>(null)

  // Form State
  const [formData, setFormData] = useState({
    code: '',
    description: '',
    category: 'Mobiliário' as ItemCategory,
    unit: 'un' as 'un' | 'm²' | 'm' | 'kit' | 'hora',
    unit_price: 0,
    default_tax: 0,
    technical_description: '',
    active: true,
  })
  const [submitting, setSubmitting] = useState(false)

  const loadItems = async () => {
    try {
      setLoading(true)
      const data = await itemService.getAll()
      setItems(data)
    } catch (err: any) {
      console.error('Erro ao carregar itens:', err)
      toast({
        title: 'Erro ao carregar itens',
        description: err.message || 'Não foi possível buscar o catálogo de itens.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadItems()
  }, [])

  const handleOpenCreate = () => {
    if (!isAdmin) return
    setEditingItem(null)
    setFormData({
      code: `ITM-${String(items.length + 1).padStart(3, '0')}`,
      description: '',
      category: 'Mobiliário',
      unit: 'un',
      unit_price: 0,
      default_tax: 0,
      technical_description: '',
      active: true,
    })
    setIsModalOpen(true)
  }

  const handleOpenEdit = (item: ItemCatalogRecord) => {
    if (!isAdmin) return
    setEditingItem(item)
    setFormData({
      code: item.code || '',
      description: item.description,
      category: item.category,
      unit: item.unit,
      unit_price: item.unit_price,
      default_tax: item.default_tax || 0,
      technical_description: item.technical_description || '',
      active: item.active !== false,
    })
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isAdmin) return

    if (!formData.description.trim()) {
      toast({
        title: 'Descrição obrigatória',
        description: 'Por favor, informe a descrição do item.',
        variant: 'destructive',
      })
      return
    }

    try {
      setSubmitting(true)
      if (editingItem) {
        await itemService.update(editingItem.id, {
          code: formData.code.trim(),
          description: formData.description.trim(),
          category: formData.category,
          unit: formData.unit,
          unit_price: Number(formData.unit_price) || 0,
          default_tax: Number(formData.default_tax) || 0,
          technical_description: formData.technical_description.trim(),
          active: formData.active,
        })
        toast({
          title: 'Item atualizado',
          description: 'O item do catálogo foi atualizado com sucesso.',
        })
      } else {
        await itemService.create({
          code: formData.code.trim(),
          description: formData.description.trim(),
          category: formData.category,
          unit: formData.unit,
          unit_price: Number(formData.unit_price) || 0,
          default_tax: Number(formData.default_tax) || 0,
          technical_description: formData.technical_description.trim(),
          active: formData.active,
          created_by: user?.id,
        })
        toast({
          title: 'Item cadastrado',
          description: 'O novo item foi adicionado ao catálogo com sucesso.',
        })
      }
      setIsModalOpen(false)
      loadItems()
    } catch (err: any) {
      console.error('Erro ao salvar item:', err)
      toast({
        title: 'Erro ao salvar',
        description: err.message || 'Ocorreu um erro ao salvar o item.',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!isAdmin || !isDeleting) return
    try {
      await itemService.delete(isDeleting.id)
      toast({
        title: 'Item excluído',
        description: 'O item foi removido do catálogo.',
      })
      setIsDeleting(null)
      loadItems()
    } catch (err: any) {
      console.error('Erro ao excluir item:', err)
      toast({
        title: 'Erro ao excluir',
        description: err.message || 'Não foi possível excluir o item.',
        variant: 'destructive',
      })
    }
  }

  // Filtragem
  const filteredItems = items.filter((item) => {
    const matchesSearch =
      (item.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.technical_description || '').toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Catálogo de Itens</h1>
            <Badge
              variant="outline"
              className={
                isAdmin
                  ? 'border-emerald-500 text-emerald-700 bg-emerald-50'
                  : 'border-blue-500 text-blue-700 bg-blue-50'
              }
            >
              {isAdmin ? 'Acesso Total (Admin)' : 'Modo Consulta (Vendedor)'}
            </Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            {isAdmin
              ? 'Cadastre e gerencie os produtos, mobiliários e serviços utilizados nos orçamentos.'
              : 'Consulte os itens e produtos cadastrados na Corteplan para uso nos seus orçamentos.'}
          </p>
        </div>

        {isAdmin && (
          <Button
            onClick={handleOpenCreate}
            className="bg-[#3A3A3C] hover:bg-[#2E2E30] text-white shadow-sm gap-2"
          >
            <Plus className="h-4 w-4 text-[#F08A24]" />
            Novo Item
          </Button>
        )}
      </div>

      {/* Barra de Filtros */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar por código, descrição ou detalhe técnico..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-white border-slate-200"
          />
        </div>
        <div className="w-full sm:w-60">
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="bg-white border-slate-200">
              <SelectValue placeholder="Todas as categorias" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              {ITEM_CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Grid de Estatísticas Rápidas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-400">
            <Package className="h-4 w-4 text-[#F08A24]" />
            Total de Itens
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">{items.length}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-400">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            Itens Ativos
          </div>
          <div className="text-2xl font-bold text-emerald-600 mt-2">
            {items.filter((i) => i.active !== false).length}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-400">
            <Layers className="h-4 w-4 text-blue-500" />
            Categorias
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">
            {new Set(items.map((i) => i.category)).size}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-400">
            <FileSpreadsheet className="h-4 w-4 text-amber-500" />
            Exibindo
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">{filteredItems.length}</div>
        </div>
      </div>

      {/* Tabela de Itens */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">Carregando catálogo de itens...</div>
        ) : filteredItems.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <h3 className="font-semibold text-slate-700">Nenhum item encontrado</h3>
            <p className="text-sm text-slate-400 mt-1">
              {searchTerm || selectedCategory !== 'all'
                ? 'Tente ajustar os filtros de busca.'
                : 'Nenhum item cadastrado no catálogo ainda.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Código</th>
                  <th className="py-3 px-4">Descrição</th>
                  <th className="py-3 px-4">Categoria</th>
                  <th className="py-3 px-4">Unidade</th>
                  <th className="py-3 px-4 text-right">Preço Unitário</th>
                  <th className="py-3 px-4 text-right">Imposto Estimado</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 font-mono text-xs font-medium text-slate-600">
                      {item.code || '—'}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-900 max-w-md">
                      <div>{item.description}</div>
                      {item.technical_description && (
                        <p className="text-xs text-slate-400 truncate max-w-sm mt-0.5">
                          {item.technical_description}
                        </p>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge variant="secondary" className="text-xs font-normal">
                        {item.category}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 font-mono text-xs">{item.unit}</td>
                    <td className="py-3.5 px-4 text-right font-semibold text-slate-900 font-mono">
                      {formatCurrencyBRL(item.unit_price)}
                    </td>
                    <td className="py-3.5 px-4 text-right text-slate-500 font-mono text-xs">
                      {item.default_tax ? formatCurrencyBRL(item.default_tax) : '—'}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {item.active !== false ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="h-3 w-3" /> Ativo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                          <XCircle className="h-3 w-3" /> Inativo
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-500 hover:text-slate-800"
                          onClick={() => setViewingItem(item)}
                          title="Visualizar detalhes do item"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {isAdmin && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-500 hover:text-blue-600"
                              onClick={() => handleOpenEdit(item)}
                              title="Editar item (Admin)"
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-500 hover:text-red-600"
                              onClick={() => setIsDeleting(item)}
                              title="Excluir item (Admin)"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Criação / Edição (Somente Administrador) */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? 'Editar Item do Catálogo' : 'Novo Item do Catálogo'}
            </DialogTitle>
            <DialogDescription>
              Preencha os dados do produto ou serviço para disponibilizar aos orçamentos.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="code">Código / SKU</Label>
                <Input
                  id="code"
                  placeholder="Ex: MOB-001"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="category">Categoria *</Label>
                <Select
                  value={formData.category}
                  onValueChange={(val: ItemCategory) => setFormData({ ...formData, category: val })}
                >
                  <SelectTrigger id="category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ITEM_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="description">Descrição do Item *</Label>
              <Input
                id="description"
                placeholder="Ex: Balcão Promocional com Testeira"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label htmlFor="unit">Unidade</Label>
                <Select
                  value={formData.unit}
                  onValueChange={(val: any) => setFormData({ ...formData, unit: val })}
                >
                  <SelectTrigger id="unit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="un">un (unidade)</SelectItem>
                    <SelectItem value="m²">m² (metro quadrado)</SelectItem>
                    <SelectItem value="m">m (metro linear)</SelectItem>
                    <SelectItem value="kit">kit (conjunto)</SelectItem>
                    <SelectItem value="hora">hora (serviço)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="unit_price">Preço Unitário (R$) *</Label>
                <Input
                  id="unit_price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.unit_price}
                  onChange={(e) =>
                    setFormData({ ...formData, unit_price: parseFloat(e.target.value) || 0 })
                  }
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="default_tax">Imposto Estimado (R$)</Label>
                <Input
                  id="default_tax"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.default_tax}
                  onChange={(e) =>
                    setFormData({ ...formData, default_tax: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="technical_description">Descrição Técnica / Memorial</Label>
              <Textarea
                id="technical_description"
                rows={3}
                placeholder="Ex: Estrutura em MDF 15mm com acabamento em pintura laca branca, rodízios de silicone, tampo em vidro temperado..."
                value={formData.technical_description}
                onChange={(e) =>
                  setFormData({ ...formData, technical_description: e.target.value })
                }
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="active"
                checked={formData.active}
                onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-[#3A3A3C] focus:ring-[#3A3A3C]"
              />
              <Label htmlFor="active" className="text-sm cursor-pointer">
                Item ativo e visível para novos orçamentos
              </Label>
            </div>

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-[#3A3A3C] hover:bg-[#2E2E30] text-white"
                disabled={submitting}
              >
                {submitting ? 'Salvando...' : editingItem ? 'Salvar Alterações' : 'Cadastrar Item'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de Detalhes do Item (Consulta para ambos perfis) */}
      <Dialog open={!!viewingItem} onOpenChange={(open) => !open && setViewingItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{viewingItem?.category}</Badge>
              {viewingItem?.code && (
                <span className="font-mono text-xs text-slate-500 font-semibold">
                  {viewingItem.code}
                </span>
              )}
            </div>
            <DialogTitle className="text-xl mt-2">{viewingItem?.description}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 text-sm">
            <div className="bg-slate-50 p-4 rounded-xl space-y-2 border border-slate-100">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Preço Unitário:</span>
                <span className="font-bold text-slate-900 font-mono text-base">
                  {formatCurrencyBRL(viewingItem?.unit_price || 0)} / {viewingItem?.unit}
                </span>
              </div>
              {viewingItem?.default_tax ? (
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Imposto Estimado:</span>
                  <span className="font-mono text-slate-700">
                    {formatCurrencyBRL(viewingItem.default_tax)}
                  </span>
                </div>
              ) : null}
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Status no catálogo:</span>
                <span
                  className={
                    viewingItem?.active !== false
                      ? 'text-emerald-600 font-medium'
                      : 'text-slate-400 font-medium'
                  }
                >
                  {viewingItem?.active !== false ? 'Ativo para venda' : 'Inativo'}
                </span>
              </div>
            </div>

            {viewingItem?.technical_description && (
              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Especificações Técnicas
                </h4>
                <div className="text-slate-700 whitespace-pre-wrap bg-slate-50 p-3 rounded-lg text-xs leading-relaxed border border-slate-100">
                  {viewingItem.technical_description}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingItem(null)} className="w-full">
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Exclusão (Admin) */}
      <Dialog open={!!isDeleting} onOpenChange={(open) => !open && setIsDeleting(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              <DialogTitle>Excluir Item</DialogTitle>
            </div>
            <DialogDescription className="pt-2">
              Tem certeza que deseja remover o item &quot;{isDeleting?.description}&quot; do
              catálogo? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsDeleting(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Confirmar Exclusão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

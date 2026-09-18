import React, { useState, useEffect, useMemo } from 'react'
import {
  Users as UsersIcon,
  UserCheck,
  ShieldAlert,
  Plus,
  Search,
  Edit,
  Trash2,
  Mail,
  Shield,
  Briefcase,
  Loader2,
  User,
  KeyRound,
} from 'lucide-react'
import { userService, CreateUserData } from '@/services/users'
import type { AppUserRecord, UserRole } from '@/types'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { toast } from 'sonner'

export default function Users() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<AppUserRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'Todos' | 'Administrador' | 'Vendedor'>('Todos')

  // Modal de Criação / Edição
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<AppUserRecord | null>(null)
  const [saving, setSaving] = useState(false)

  // Formulário
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [oldPassword, setOldPassword] = useState('')
  const [role, setRole] = useState<UserRole>('Vendedor')

  // Modal separado dedicado a Troca de Senha
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  const [targetPasswordUser, setTargetPasswordUser] = useState<AppUserRecord | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)

  // Modal de exclusão
  const [userToDelete, setUserToDelete] = useState<AppUserRecord | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadUsers = async () => {
    try {
      const data = await userService.getAll()
      setUsers(data)
    } catch (err) {
      console.error('Erro ao carregar usuários:', err)
      toast.error('Erro ao carregar lista de usuários.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  const handleOpenCreate = () => {
    setEditingUser(null)
    setName('')
    setEmail('')
    setPassword('')
    setOldPassword('')
    setRole('Vendedor')
    setIsModalOpen(true)
  }

  const handleOpenEdit = (user: AppUserRecord) => {
    setEditingUser(user)
    setName(user.name)
    setEmail(user.email)
    setPassword('')
    setOldPassword('')
    setRole(user.role || 'Vendedor')
    setIsModalOpen(true)
  }

  const handleOpenPasswordModal = (user: AppUserRecord) => {
    setTargetPasswordUser(user)
    setNewPassword('')
    setConfirmNewPassword('')
    setCurrentPassword('')
    setPasswordModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Informe o nome do usuário.')
      return
    }
    if (!email.trim()) {
      toast.error('Informe o e-mail do usuário.')
      return
    }

    if (password && password.length < 8) {
      toast.error('A senha deve ter no mínimo 8 caracteres.')
      return
    }

    setSaving(true)
    try {
      if (editingUser) {
        await userService.update(editingUser.id, {
          name: name.trim(),
          email: email.trim(),
          role,
          ...(password ? { password, oldPassword: oldPassword || undefined } : {}),
        })
        toast.success(`Usuário ${name} atualizado com sucesso!`)
      } else {
        await userService.create({
          name: name.trim(),
          email: email.trim(),
          role,
          password: password.trim() || 'Skip@Pass',
        })
        toast.success(`Usuário ${name} cadastrado com sucesso!`)
      }
      setIsModalOpen(false)
      loadUsers()
    } catch (err: any) {
      console.error('Erro ao salvar usuário:', err)
      const errorMsg =
        err?.response?.data?.password?.message ||
        err?.response?.data?.oldPassword?.message ||
        err?.response?.message ||
        err?.message ||
        'Erro ao salvar dados do usuário.'
      toast.error(errorMsg)
    } finally {
      setSaving(false)
    }
  }

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!targetPasswordUser) return

    if (!newPassword) {
      toast.error('Informe a nova senha.')
      return
    }
    if (newPassword.length < 8) {
      toast.error('A nova senha deve ter no mínimo 8 caracteres.')
      return
    }
    if (newPassword !== confirmNewPassword) {
      toast.error('A confirmação da nova senha não confere.')
      return
    }

    const isCurrentAdmin = currentUser?.role === 'Administrador'
    const isSelf = targetPasswordUser.id === currentUser?.id

    // Vendedor trocando a própria senha precisa informar a senha atual
    if (isSelf && !isCurrentAdmin && !currentPassword) {
      toast.error('Informe sua senha atual para continuar.')
      return
    }

    setChangingPassword(true)
    try {
      const res = await userService.changePassword(targetPasswordUser.id, {
        password: newPassword,
        passwordConfirm: confirmNewPassword,
        oldPassword: currentPassword || undefined,
      })
      toast.success(res.message || 'Senha alterada com sucesso!')
      setPasswordModalOpen(false)
    } catch (err: any) {
      console.error('Erro ao alterar senha:', err)
      const errorMsg =
        err?.response?.data?.message ||
        err?.response?.message ||
        err?.message ||
        'Erro ao alterar senha. Verifique os dados.'
      toast.error(errorMsg)
    } finally {
      setChangingPassword(false)
    }
  }

  const handleDelete = async () => {
    if (!userToDelete) return
    if (userToDelete.id === currentUser?.id) {
      toast.error('Você não pode excluir o seu próprio usuário logado.')
      return
    }

    setDeleting(true)
    try {
      await userService.delete(userToDelete.id)
      toast.success(`Usuário ${userToDelete.name} excluído com sucesso.`)
      setUserToDelete(null)
      loadUsers()
    } catch (err) {
      console.error('Erro ao excluir usuário:', err)
      toast.error('Erro ao excluir usuário.')
    } finally {
      setDeleting(false)
    }
  }

  // Filtragem
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (roleFilter !== 'Todos' && (u.role || 'Vendedor') !== roleFilter) {
        return false
      }
      if (search.trim()) {
        const q = search.toLowerCase().trim()
        const matchName = u.name.toLowerCase().includes(q)
        const matchEmail = u.email.toLowerCase().includes(q)
        const matchRole = (u.role || '').toLowerCase().includes(q)
        if (!matchName && !matchEmail && !matchRole) return false
      }
      return true
    })
  }, [users, roleFilter, search])

  return (
    <div className="space-y-6">
      {/* Header com Título e Ação */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Usuários e Vendedores
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Gestão de equipe comercial e administradores para vinculação em orçamentos e cálculo de
            comissões.
          </p>
        </div>

        <Button
          onClick={handleOpenCreate}
          className="rounded-xl bg-[#3A3A3C] hover:bg-[#2D2D2F] text-white font-medium shadow-sm transition-all duration-200 hover:scale-[1.02] shrink-0"
        >
          <Plus className="h-4 w-4 mr-1.5 text-[#F08A24]" />
          Novo Usuário
        </Button>
      </div>

      {/* Barra de Filtros */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2">
          {(['Todos', 'Administrador', 'Vendedor'] as const).map((r) => {
            const isSelected = roleFilter === r
            const count =
              r === 'Todos'
                ? users.length
                : users.filter((u) => (u.role || 'Vendedor') === r).length

            return (
              <button
                key={r}
                type="button"
                onClick={() => setRoleFilter(r)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  isSelected
                    ? 'bg-[#3A3A3C] text-white shadow-xs'
                    : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                }`}
              >
                <span>{r}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[11px] font-mono ${
                    isSelected
                      ? 'bg-[#F08A24] text-slate-950 font-bold'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            type="text"
            placeholder="Buscar por nome, e-mail ou perfil..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-3 h-9 text-xs sm:text-sm bg-slate-50 border-slate-200 rounded-xl"
          />
        </div>
      </div>

      {/* Grid de Usuários */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-slate-500">
            <Loader2 className="h-8 w-8 animate-spin text-[#3A3A3C]" />
            <p className="text-sm">Carregando usuários...</p>
          </div>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-slate-200 text-center space-y-4">
          <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
            <UsersIcon className="h-8 w-8 text-[#F08A24]" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-800">Nenhum usuário encontrado</h3>
            <p className="text-xs text-slate-500 max-w-sm">
              Tente redefinir os filtros de perfil ou o termo de busca.
            </p>
          </div>
          <Button
            onClick={handleOpenCreate}
            className="rounded-xl bg-[#3A3A3C] hover:bg-[#2D2D2F] text-white"
          >
            <Plus className="h-4 w-4 mr-1.5 text-amber-400" />
            Cadastrar Novo Usuário
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredUsers.map((u) => {
            const isAdmin = u.role === 'Administrador'
            const isSelf = u.id === currentUser?.id

            return (
              <div
                key={u.id}
                className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-11 w-11 rounded-xl flex items-center justify-center font-bold text-sm ${
                          isAdmin
                            ? 'bg-slate-900 text-white shadow-xs'
                            : 'bg-orange-100 text-[#E66812]'
                        }`}
                      >
                        {u.name
                          .split(' ')
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join('')
                          .toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-bold text-slate-900 text-sm">{u.name}</h3>
                          {isSelf && (
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">
                              Você
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <Mail className="h-3 w-3 text-slate-400" />
                          <span className="truncate max-w-[170px]">{u.email}</span>
                        </p>
                      </div>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                        isAdmin
                          ? 'bg-slate-100 text-slate-900 border-slate-300'
                          : 'bg-orange-50 text-[#E66812] border-orange-200'
                      }`}
                    >
                      {isAdmin ? (
                        <Shield className="h-3 w-3 text-slate-700" />
                      ) : (
                        <Briefcase className="h-3 w-3 text-[#E66812]" />
                      )}
                      {u.role || 'Vendedor'}
                    </span>
                  </div>

                  <div className="text-xs bg-slate-50/70 p-3 rounded-xl border border-slate-100 space-y-1">
                    <div className="text-slate-500 flex justify-between">
                      <span>Perfil de Acesso:</span>
                      <strong className="text-slate-800">{u.role || 'Vendedor'}</strong>
                    </div>
                    <div className="text-slate-500 flex justify-between">
                      <span>Vendedor de Orçamento:</span>
                      <span className="text-emerald-700 font-medium">Ativo para comissão</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-1.5 pt-3 border-t border-slate-100">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenPasswordModal(u)}
                    className="h-8 text-xs text-amber-700 hover:text-amber-800 hover:bg-amber-50 rounded-lg"
                    title="Alterar Senha de Acesso"
                  >
                    <KeyRound className="h-3.5 w-3.5 mr-1" />
                    Senha
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenEdit(u)}
                    className="h-8 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
                  >
                    <Edit className="h-3.5 w-3.5 mr-1" />
                    Editar
                  </Button>

                  {!isSelf && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setUserToDelete(u)}
                      className="h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      Excluir
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal de Criação / Edição de Usuário */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              {editingUser ? 'Editar Usuário / Vendedor' : 'Cadastrar Novo Usuário / Vendedor'}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Defina os dados e o perfil de acesso do colaborador da Corteplan.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Nome Completo *</Label>
              <Input
                placeholder="Ex: Gustavo Tibério ou Felizardo"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="text-xs sm:text-sm rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">E-mail de Acesso *</Label>
              <Input
                type="email"
                placeholder="Ex: felizardo@corteplan.com.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="text-xs sm:text-sm rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Perfil / Função *</Label>
              <Select value={role} onValueChange={(val: UserRole) => setRole(val)}>
                <SelectTrigger className="text-xs sm:text-sm rounded-xl bg-white">
                  <SelectValue placeholder="Selecione o perfil" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Administrador">
                    Administrador (Acesso total + Gestão)
                  </SelectItem>
                  <SelectItem value="Vendedor">Vendedor (Vendedor Externo / Comercial)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-slate-700">
                  {editingUser ? 'Nova Senha (opcional, mín. 8 caracteres)' : 'Senha de Acesso'}
                </Label>
                {!editingUser && (
                  <span className="text-[10px] text-slate-400">Padrão: Skip@Pass</span>
                )}
              </div>
              <Input
                type="password"
                placeholder={
                  editingUser
                    ? 'Deixe em branco para manter a atual'
                    : 'Skip@Pass (mín. 8 caracteres)'
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="text-xs sm:text-sm rounded-xl"
              />
            </div>

            {editingUser &&
              password &&
              currentUser?.role !== 'Administrador' &&
              editingUser.id === currentUser?.id && (
                <div className="space-y-1.5 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                  <Label className="text-xs font-semibold text-amber-900">
                    Senha Atual (obrigatória para vendedor) *
                  </Label>
                  <Input
                    type="password"
                    placeholder="Informe a sua senha atual"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    className="text-xs sm:text-sm rounded-xl bg-white"
                  />
                </div>
              )}

            <DialogFooter className="gap-2 sm:gap-0 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                disabled={saving}
                className="rounded-xl"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-[#3A3A3C] hover:bg-[#2D2D2F] text-white font-medium"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar Usuário'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de confirmação de exclusão */}
      <Dialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <div className="h-10 w-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-2">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <DialogTitle className="text-base font-bold text-slate-900">
              Excluir Usuário?
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Tem certeza que deseja remover o usuário{' '}
              <strong className="text-slate-900">{userToDelete?.name}</strong> (
              {userToDelete?.email})? Os orçamentos e pedidos vinculados continuarão registrados.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setUserToDelete(null)}
              disabled={deleting}
              className="rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : (
                'Excluir Usuário'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Modal Dedicado para Alteração de Senha */}
      <Dialog open={passwordModalOpen} onOpenChange={setPasswordModalOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <div className="h-10 w-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mb-1">
              <KeyRound className="h-5 w-5" />
            </div>
            <DialogTitle className="text-base font-bold text-slate-900">
              Alterar Senha de {targetPasswordUser?.name}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              {currentUser?.role === 'Administrador' && targetPasswordUser?.id !== currentUser?.id
                ? 'Como Administrador, você pode redefinir diretamente a senha de acesso deste colaborador.'
                : 'Defina uma nova senha de no mínimo 8 caracteres para acesso ao sistema.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSavePassword} className="space-y-4 pt-2">
            {/* Campo de Senha Atual exigido se o vendedor estiver alterando a própria senha */}
            {targetPasswordUser?.id === currentUser?.id &&
              currentUser?.role !== 'Administrador' && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Senha Atual *</Label>
                  <Input
                    type="password"
                    placeholder="Sua senha atual"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    className="text-xs sm:text-sm rounded-xl"
                  />
                </div>
              )}

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Nova Senha *</Label>
              <Input
                type="password"
                placeholder="Mínimo de 8 caracteres"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                className="text-xs sm:text-sm rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Confirmar Nova Senha *</Label>
              <Input
                type="password"
                placeholder="Repita a nova senha"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                required
                minLength={8}
                className="text-xs sm:text-sm rounded-xl"
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPasswordModalOpen(false)}
                disabled={changingPassword}
                className="rounded-xl"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={changingPassword}
                className="rounded-xl bg-[#3A3A3C] hover:bg-[#2D2D2F] text-white font-medium"
              >
                {changingPassword ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando Senha...
                  </>
                ) : (
                  'Salvar Nova Senha'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

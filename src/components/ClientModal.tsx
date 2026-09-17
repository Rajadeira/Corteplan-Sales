import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2 } from 'lucide-react'
import { clientService, type CreateClientData } from '@/services/clients'
import type { ClientRecord } from '@/types'
import { maskPhoneBR } from '@/types'
import { toast } from 'sonner'

interface ClientModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  clientToEdit?: ClientRecord | null
  onSuccess: (client: ClientRecord) => void
}

export default function ClientModal({
  open,
  onOpenChange,
  clientToEdit,
  onSuccess,
}: ClientModalProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [company, setCompany] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [notes, setNotes] = useState('')

  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<{ name?: string; phone?: string; email?: string }>({})

  const isEditing = Boolean(clientToEdit)

  useEffect(() => {
    if (clientToEdit) {
      setName(clientToEdit.name || '')
      setEmail(clientToEdit.email || '')
      setPhone(maskPhoneBR(clientToEdit.phone || ''))
      setCompany(clientToEdit.company || '')
      setAddress(clientToEdit.address || '')
      setCity(clientToEdit.city || '')
      setNotes(clientToEdit.notes || '')
    } else {
      setName('')
      setEmail('')
      setPhone('')
      setCompany('')
      setAddress('')
      setCity('')
      setNotes('')
    }
    setErrors({})
  }, [clientToEdit, open])

  const validate = () => {
    const errs: { name?: string; phone?: string; email?: string } = {}
    if (!name.trim()) {
      errs.name = 'Nome completo é obrigatório'
    }

    const digitsOnly = phone.replace(/\D/g, '')
    if (!digitsOnly) {
      errs.phone = 'Telefone é obrigatório'
    } else if (digitsOnly.length < 10) {
      errs.phone = 'Informe um telefone completo com DDD'
    }

    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errs.email = 'Insira um e-mail válido'
    }

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    const masked = maskPhoneBR(raw)
    setPhone(masked)
    if (errors.phone) {
      setErrors((prev) => ({ ...prev, phone: undefined }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setLoading(true)
    const payload: CreateClientData = {
      name: name.trim(),
      email: email.trim() || undefined,
      phone: phone.trim(),
      company: company.trim() || undefined,
      address: address.trim() || undefined,
      city: city.trim() || undefined,
      notes: notes.trim() || undefined,
    }

    try {
      if (isEditing && clientToEdit) {
        const updated = await clientService.update(clientToEdit.id, payload)
        toast.success('Cliente atualizado com sucesso!')
        onSuccess(updated)
      } else {
        const created = await clientService.create(payload)
        toast.success('Cliente cadastrado com sucesso!')
        onSuccess(created)
      }
      onOpenChange(false)
    } catch (err: unknown) {
      console.error('Erro ao salvar cliente:', err)
      toast.error('Erro ao salvar cliente. Verifique os dados e tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-6 sm:p-8 rounded-2xl bg-white animate-in zoom-in-95 duration-200">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-xl font-bold text-slate-900">
            {isEditing ? 'Editar Cliente' : 'Cadastrar Novo Cliente'}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Preencha os dados cadastrais do cliente para vincular às propostas comerciais.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="client-name" className="text-xs font-semibold text-slate-700">
              Nome completo <span className="text-red-500">*</span>
            </Label>
            <Input
              id="client-name"
              placeholder="Ex: Carlos Eduardo Mendes"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }))
              }}
              className={errors.name ? 'border-red-500' : ''}
              disabled={loading}
            />
            {errors.name && <p className="text-[11px] font-medium text-red-500">{errors.name}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="client-phone" className="text-xs font-semibold text-slate-700">
                Telefone / WhatsApp <span className="text-red-500">*</span>
              </Label>
              <Input
                id="client-phone"
                placeholder="(11) 98765-4321"
                value={phone}
                onChange={handlePhoneChange}
                className={errors.phone ? 'border-red-500' : ''}
                disabled={loading}
              />
              {errors.phone && (
                <p className="text-[11px] font-medium text-red-500">{errors.phone}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="client-email" className="text-xs font-semibold text-slate-700">
                E-mail (opcional)
              </Label>
              <Input
                id="client-email"
                type="email"
                placeholder="contato@empresa.com.br"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }))
                }}
                className={errors.email ? 'border-red-500' : ''}
                disabled={loading}
              />
              {errors.email && (
                <p className="text-[11px] font-medium text-red-500">{errors.email}</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="client-company" className="text-xs font-semibold text-slate-700">
              Empresa / Razão Social
            </Label>
            <Input
              id="client-company"
              placeholder="Ex: Estilo & Design Interiores"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="client-address" className="text-xs font-semibold text-slate-700">
                Endereço
              </Label>
              <Input
                id="client-address"
                placeholder="Ex: Av. Paulista, 1500, Sala 82"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="client-city" className="text-xs font-semibold text-slate-700">
                Cidade / UF
              </Label>
              <Input
                id="client-city"
                placeholder="Ex: São Paulo - SP"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="client-notes" className="text-xs font-semibold text-slate-700">
              Observações gerais
            </Label>
            <Textarea
              id="client-notes"
              rows={3}
              placeholder="Preferências de materiais, detalhes comerciais, histórico..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={loading}
            />
          </div>

          <DialogFooter className="pt-3 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-[#3A3A3C] hover:bg-[#2D2D2F] text-white font-medium"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar Cliente'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

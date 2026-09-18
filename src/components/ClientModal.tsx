import React, { useState, useEffect, useRef } from 'react'
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
import { Loader2, Sparkles, Building2, User } from 'lucide-react'
import { clientService, type CreateClientData } from '@/services/clients'
import type { ClientRecord, DocumentType } from '@/types'
import { maskPhoneBR } from '@/types'
import {
  maskCPF,
  maskCNPJ,
  maskCEP,
  validateCPF,
  validateCNPJ,
  cleanDocument,
  consultCNPJ,
} from '@/lib/cnpjCpfUtils'
import { getErrorMessage } from '@/lib/pocketbase/errors'
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
  const [documentType, setDocumentType] = useState<DocumentType>('CNPJ')
  const [documentNumber, setDocumentNumber] = useState('')
  const [name, setName] = useState('')
  const [tradeName, setTradeName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [company, setCompany] = useState('')
  const [contactName, setContactName] = useState('')
  const [zipCode, setZipCode] = useState('')
  const [address, setAddress] = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [notes, setNotes] = useState('')

  const [loading, setLoading] = useState(false)
  const [isConsulting, setIsConsulting] = useState(false)
  const [autoFilledSource, setAutoFilledSource] = useState<string | null>(null)
  const [errors, setErrors] = useState<{
    name?: string
    phone?: string
    email?: string
    document?: string
  }>({})

  // Evita re-consultar o mesmo CNPJ enquanto o usuário não mudar o número
  const lastConsultedCNPJ = useRef<string>('')

  const isEditing = Boolean(clientToEdit)

  useEffect(() => {
    if (clientToEdit) {
      const docType: DocumentType = clientToEdit.document_type || 'CNPJ'
      setDocumentType(docType)
      const rawDoc = clientToEdit.document_number || ''
      setDocumentNumber(docType === 'CNPJ' ? maskCNPJ(rawDoc) : maskCPF(rawDoc))
      lastConsultedCNPJ.current = cleanDocument(rawDoc)
      setName(clientToEdit.name || '')
      setTradeName(clientToEdit.trade_name || '')
      setEmail(clientToEdit.email || '')
      setPhone(maskPhoneBR(clientToEdit.phone || ''))
      setCompany(clientToEdit.company || '')
      setContactName(clientToEdit.contact_name || '')
      setZipCode(maskCEP(clientToEdit.zip_code || ''))
      setAddress(clientToEdit.address || '')
      setNeighborhood(clientToEdit.neighborhood || '')
      setCity(clientToEdit.city || '')
      setState(clientToEdit.state || '')
      setNotes(clientToEdit.notes || '')
      setAutoFilledSource(null)
    } else {
      setDocumentType('CNPJ')
      setDocumentNumber('')
      lastConsultedCNPJ.current = ''
      setName('')
      setTradeName('')
      setEmail('')
      setPhone('')
      setCompany('')
      setContactName('')
      setZipCode('')
      setAddress('')
      setNeighborhood('')
      setCity('')
      setState('')
      setNotes('')
      setAutoFilledSource(null)
    }
    setErrors({})
    setIsConsulting(false)
  }, [clientToEdit, open])

  // Alternância entre CNPJ e CPF
  const handleTypeChange = (newType: DocumentType) => {
    if (newType === documentType) return
    setDocumentType(newType)
    // Limpa ou reaplica máscara conforme novo tipo
    const digits = cleanDocument(documentNumber)
    if (newType === 'CNPJ') {
      setDocumentNumber(maskCNPJ(digits))
    } else {
      setDocumentNumber(maskCPF(digits))
      setAutoFilledSource(null)
    }
    setErrors((prev) => ({ ...prev, document: undefined }))
  }

  // Consulta automática de CNPJ
  const triggerCNPJLookup = async (cnpjToQuery: string) => {
    const clean = cleanDocument(cnpjToQuery)
    if (clean.length !== 14) return
    if (!validateCNPJ(clean)) {
      setErrors((prev) => ({ ...prev, document: 'CNPJ inválido (dígitos verificadores)' }))
      return
    }

    if (lastConsultedCNPJ.current === clean) {
      return
    }

    setIsConsulting(true)
    setErrors((prev) => ({ ...prev, document: undefined }))

    try {
      const res = await consultCNPJ(clean)
      lastConsultedCNPJ.current = clean

      // Preenchimento automático dos dados retornados
      if (res.razaoSocial) {
        setName(res.razaoSocial)
      }
      if (res.nomeFantasia) {
        setTradeName(res.nomeFantasia)
        if (!company) setCompany(res.nomeFantasia)
      } else if (res.razaoSocial && !company) {
        setCompany(res.razaoSocial)
      }

      // Monta endereço completo ou atualiza campos
      const logradouroPart = [res.logradouro, res.numero ? `Nº ${res.numero}` : '', res.complemento]
        .filter(Boolean)
        .join(', ')

      if (logradouroPart) {
        setAddress(logradouroPart)
      }
      if (res.bairro) setNeighborhood(res.bairro)
      if (res.cidade) setCity(res.cidade)
      if (res.uf) setState(res.uf)
      if (res.cep) setZipCode(res.cep)

      if (res.telefone) {
        setPhone(maskPhoneBR(res.telefone))
        if (errors.phone) setErrors((prev) => ({ ...prev, phone: undefined }))
      }

      if (res.email) {
        setEmail(res.email)
        if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }))
      }

      setAutoFilledSource(res.fonte)
      toast.success(`Dados preenchidos automaticamente via ${res.fonte}!`)
    } catch (err: unknown) {
      console.warn('Erro ao consultar CNPJ:', err)
      setAutoFilledSource(null)
      toast.warning(
        'CNPJ não encontrado ou serviço de consulta indisponível. Preencha manualmente.',
      )
    } finally {
      setIsConsulting(false)
    }
  }

  // Mudança do campo documento
  const handleDocumentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    if (documentType === 'CNPJ') {
      const masked = maskCNPJ(raw)
      setDocumentNumber(masked)
      const clean = cleanDocument(masked)
      if (errors.document) setErrors((prev) => ({ ...prev, document: undefined }))

      if (clean.length === 14) {
        if (validateCNPJ(clean)) {
          triggerCNPJLookup(clean)
        } else {
          setErrors((prev) => ({ ...prev, document: 'CNPJ inválido (dígitos incorretos)' }))
        }
      }
    } else {
      // CPF
      const masked = maskCPF(raw)
      setDocumentNumber(masked)
      const clean = cleanDocument(masked)
      if (errors.document) setErrors((prev) => ({ ...prev, document: undefined }))

      if (clean.length === 11 && !validateCPF(clean)) {
        setErrors((prev) => ({ ...prev, document: 'CPF inválido (dígitos incorretos)' }))
      }
    }
  }

  const validate = () => {
    const errs: { name?: string; phone?: string; email?: string; document?: string } = {}

    if (!name.trim()) {
      errs.name =
        documentType === 'CNPJ' ? 'Razão Social é obrigatória' : 'Nome completo é obrigatório'
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

    const cleanDoc = cleanDocument(documentNumber)
    if (cleanDoc) {
      if (documentType === 'CNPJ') {
        if (cleanDoc.length !== 14 || !validateCNPJ(cleanDoc)) {
          errs.document = 'CNPJ inválido. Verifique os dígitos.'
        }
      } else {
        if (cleanDoc.length !== 11 || !validateCPF(cleanDoc)) {
          errs.document = 'CPF inválido. Verifique os dígitos.'
        }
      }
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

  const handleZipCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setZipCode(maskCEP(e.target.value))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setLoading(true)

    // Formata o campo de cidade/UF unificado caso o usuário informe UF
    let finalCity = city.trim()
    if (state.trim() && !finalCity.includes(state.trim())) {
      finalCity = finalCity ? `${finalCity}/${state.trim()}` : state.trim()
    }

    // Se company estiver vazia mas tiver tradeName ou name, usa como referência comercial
    const finalCompany = company.trim() || tradeName.trim() || undefined

    const payload: CreateClientData = {
      name: name.trim(),
      email: email.trim() || undefined,
      phone: phone.trim(),
      company: finalCompany,
      address: address.trim() || undefined,
      city: finalCity || undefined,
      notes: notes.trim() || undefined,
      document_type: documentType,
      document_number: documentNumber.trim() || undefined,
      trade_name: tradeName.trim() || undefined,
      contact_name: contactName.trim() || undefined,
      zip_code: zipCode.trim() || undefined,
      neighborhood: neighborhood.trim() || undefined,
      state: state.trim() || undefined,
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
      const message = getErrorMessage(err)
      toast.error(message || 'Erro ao salvar cliente. Verifique os dados e tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-6 sm:p-8 rounded-2xl bg-white animate-in zoom-in-95 duration-200">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-xl font-bold text-slate-900">
            {isEditing ? 'Editar Cliente' : 'Cadastrar Novo Cliente'}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Preencha os dados cadastrais do cliente para vincular às propostas comerciais.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Seletor CNPJ / CPF + Campo Documento */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <Label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Tipo de Documento
              </Label>

              {/* Botões alternadores CNPJ / CPF */}
              <div className="inline-flex rounded-lg bg-slate-200 p-0.5" role="group">
                <button
                  type="button"
                  onClick={() => handleTypeChange('CNPJ')}
                  disabled={loading}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                    documentType === 'CNPJ'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Building2 className="h-3.5 w-3.5" />
                  Pessoa Jurídica (CNPJ)
                </button>
                <button
                  type="button"
                  onClick={() => handleTypeChange('CPF')}
                  disabled={loading}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                    documentType === 'CPF'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <User className="h-3.5 w-3.5" />
                  Pessoa Física (CPF)
                </button>
              </div>
            </div>

            {/* Input do Documento com indicador de consulta */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="client-document" className="text-xs font-semibold text-slate-700">
                  {documentType === 'CNPJ' ? 'Número do CNPJ' : 'Número do CPF'}
                </Label>
                {documentType === 'CNPJ' && (
                  <span className="text-[11px] text-slate-500 flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-amber-500" />
                    Consulta automática ao digitar 14 dígitos
                  </span>
                )}
              </div>

              <div className="relative">
                <Input
                  id="client-document"
                  placeholder={documentType === 'CNPJ' ? '00.000.000/0000-00' : '000.000.000-00'}
                  value={documentNumber}
                  onChange={handleDocumentChange}
                  className={`${errors.document ? 'border-red-500' : ''} ${
                    isConsulting ? 'pr-9' : ''
                  }`}
                  disabled={loading}
                />
                {isConsulting && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="h-4 w-4 animate-spin text-[#F08A24]" />
                  </div>
                )}
              </div>

              {errors.document && (
                <p className="text-[11px] font-medium text-red-500">{errors.document}</p>
              )}

              {/* Indicador de preenchimento automático */}
              {autoFilledSource && (
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 font-medium bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                  <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                  <span>
                    Dados preenchidos automaticamente via consulta CNPJ ({autoFilledSource})
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Razão Social / Nome Completo */}
          <div className="space-y-1.5">
            <Label htmlFor="client-name" className="text-xs font-semibold text-slate-700">
              {documentType === 'CNPJ' ? 'Razão Social' : 'Nome completo'}{' '}
              <span className="text-red-500">*</span>
            </Label>
            <Input
              id="client-name"
              placeholder={
                documentType === 'CNPJ'
                  ? 'Ex: QUALIMAIS DISTRIBUIDORA E COMERCIO DE BEBIDAS LTDA'
                  : 'Ex: Carlos Eduardo Mendes'
              }
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

          {/* Nome Fantasia e Contato (Relevante para PJ) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="client-tradename" className="text-xs font-semibold text-slate-700">
                Nome Fantasia
              </Label>
              <Input
                id="client-tradename"
                placeholder="Ex: Qualimais Distribuidora"
                value={tradeName}
                onChange={(e) => {
                  setTradeName(e.target.value)
                  if (!company) setCompany(e.target.value)
                }}
                disabled={loading}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="client-contact" className="text-xs font-semibold text-slate-700">
                Pessoa de Contato / Responsável
              </Label>
              <Input
                id="client-contact"
                placeholder="Ex: Carlos / Depto. Compras"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          {/* Telefone e E-mail */}
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
                E-mail
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

          {/* Endereço completo */}
          <div className="space-y-3 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="client-address" className="text-xs font-semibold text-slate-700">
                  Logradouro e Número
                </Label>
                <Input
                  id="client-address"
                  placeholder="Ex: Rua Guaranesia, 66"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="client-zip" className="text-xs font-semibold text-slate-700">
                  CEP
                </Label>
                <Input
                  id="client-zip"
                  placeholder="00000-000"
                  value={zipCode}
                  onChange={handleZipCodeChange}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label
                  htmlFor="client-neighborhood"
                  className="text-xs font-semibold text-slate-700"
                >
                  Bairro
                </Label>
                <Input
                  id="client-neighborhood"
                  placeholder="Ex: Vila Maria Baixa"
                  value={neighborhood}
                  onChange={(e) => setNeighborhood(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="client-city" className="text-xs font-semibold text-slate-700">
                  Cidade
                </Label>
                <Input
                  id="client-city"
                  placeholder="Ex: São Paulo"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="client-state" className="text-xs font-semibold text-slate-700">
                  UF / Estado
                </Label>
                <Input
                  id="client-state"
                  placeholder="SP"
                  maxLength={2}
                  value={state}
                  onChange={(e) => setState(e.target.value.toUpperCase())}
                  disabled={loading}
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="client-notes" className="text-xs font-semibold text-slate-700">
              Observações gerais
            </Label>
            <Textarea
              id="client-notes"
              rows={2}
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
              disabled={loading || isConsulting}
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

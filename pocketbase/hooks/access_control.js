// pocketbase/hooks/access_control.js
// Regras de controle de acesso para Orçamentos, Pedidos, Clientes, Itens e Configurações
// NOTA: No PocketBase v0.23+ (Go 1.22 mux), o objeto de autenticação da requisição é obtido diretamente via e.auth
// (e não via e.httpContext.get('authRecord'), que causava TypeError: Cannot read property 'get' of undefined or null).

// 1. Regras de alteração de Orçamentos (Quotes)
onRecordUpdateRequest((e) => {
  const auth = e.auth
  if (!auth) {
    throw new ForbiddenError('Acesso não autorizado.')
  }

  const role = auth.get('role')
  const isAdmin = role === 'Administrador'
  if (isAdmin) {
    return e.next()
  }

  // Vendedor só pode editar se for dono/vendedor do orçamento
  const currentRecord = e.record
  const sellerUser = currentRecord.get('seller_user')
  const sellerName = (currentRecord.get('seller') || '').toLowerCase()
  const authName = (auth.get('name') || '').toLowerCase()
  const authId = auth.id

  const isOwner =
    (sellerUser && sellerUser === authId) ||
    (!sellerUser && authName && sellerName.includes(authName))

  if (!isOwner) {
    throw new ForbiddenError('Vendedor só pode editar seus próprios orçamentos.')
  }

  // Previne que vendedor altere o seller_user para outro usuário
  const newSellerUser = e.record.get('seller_user')
  if (newSellerUser && newSellerUser !== authId) {
    e.record.set('seller_user', authId)
  }

  e.next()
}, 'quotes')

onRecordDeleteRequest((e) => {
  const auth = e.auth
  if (!auth) {
    throw new ForbiddenError('Acesso não autorizado.')
  }

  const role = auth.get('role')
  const isAdmin = role === 'Administrador'
  if (isAdmin) {
    return e.next()
  }

  const currentRecord = e.record
  const sellerUser = currentRecord.get('seller_user')
  const sellerName = (currentRecord.get('seller') || '').toLowerCase()
  const authName = (auth.get('name') || '').toLowerCase()
  const authId = auth.id

  const isOwner =
    (sellerUser && sellerUser === authId) ||
    (!sellerUser && authName && sellerName.includes(authName))

  if (!isOwner) {
    throw new ForbiddenError('Vendedor só pode excluir seus próprios orçamentos.')
  }

  e.next()
}, 'quotes')

onRecordCreateRequest((e) => {
  const auth = e.auth
  if (auth) {
    const role = auth.get('role')
    const isAdmin = role === 'Administrador'
    if (!isAdmin) {
      e.record.set('seller_user', auth.id)
      if (!e.record.get('seller')) {
        e.record.set('seller', auth.get('name') || 'Vendedor')
      }
    }
  }
  e.next()
}, 'quotes')

// 2. Regras de alteração de Pedidos (Orders)
onRecordUpdateRequest((e) => {
  const auth = e.auth
  if (!auth) {
    throw new ForbiddenError('Acesso não autorizado.')
  }

  const role = auth.get('role')
  const isAdmin = role === 'Administrador'
  if (isAdmin) {
    return e.next()
  }

  const currentRecord = e.record
  const sellerUser = currentRecord.get('seller_user')
  const sellerName = (currentRecord.get('seller') || '').toLowerCase()
  const authName = (auth.get('name') || '').toLowerCase()
  const authId = auth.id

  const isOwner =
    (sellerUser && sellerUser === authId) ||
    (!sellerUser && authName && sellerName.includes(authName))

  if (!isOwner) {
    throw new ForbiddenError('Vendedor só pode editar seus próprios pedidos.')
  }

  e.next()
}, 'orders')

onRecordDeleteRequest((e) => {
  const auth = e.auth
  if (!auth) {
    throw new ForbiddenError('Acesso não autorizado.')
  }

  const role = auth.get('role')
  const isAdmin = role === 'Administrador'
  if (isAdmin) {
    return e.next()
  }

  const currentRecord = e.record
  const sellerUser = currentRecord.get('seller_user')
  const sellerName = (currentRecord.get('seller') || '').toLowerCase()
  const authName = (auth.get('name') || '').toLowerCase()
  const authId = auth.id

  const isOwner =
    (sellerUser && sellerUser === authId) ||
    (!sellerUser && authName && sellerName.includes(authName))

  if (!isOwner) {
    throw new ForbiddenError('Vendedor só pode excluir seus próprios pedidos.')
  }

  e.next()
}, 'orders')

onRecordCreateRequest((e) => {
  const auth = e.auth
  if (auth) {
    const role = auth.get('role')
    const isAdmin = role === 'Administrador'
    if (!isAdmin) {
      e.record.set('seller_user', auth.id)
      if (!e.record.get('seller')) {
        e.record.set('seller', auth.get('name') || 'Vendedor')
      }
    }
  }
  e.next()
}, 'orders')

// 3. Regras de Clientes (Clients): apenas Administrador pode criar, editar ou excluir
onRecordCreateRequest((e) => {
  const auth = e.auth
  const role = auth ? auth.get('role') : ''
  if (!auth || role !== 'Administrador') {
    throw new ForbiddenError('Apenas administradores podem cadastrar novos clientes.')
  }
  e.next()
}, 'clients')

onRecordUpdateRequest((e) => {
  const auth = e.auth
  const role = auth ? auth.get('role') : ''
  if (!auth || role !== 'Administrador') {
    throw new ForbiddenError('Apenas administradores podem editar clientes.')
  }
  e.next()
}, 'clients')

onRecordDeleteRequest((e) => {
  const auth = e.auth
  const role = auth ? auth.get('role') : ''
  if (!auth || role !== 'Administrador') {
    throw new ForbiddenError('Apenas administradores podem excluir clientes.')
  }
  e.next()
}, 'clients')

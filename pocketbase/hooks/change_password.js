// pocketbase/hooks/change_password.js
// Endpoint seguro para alteração de senha:
// - Administrador pode alterar a senha de qualquer usuário (sem precisar da senha antiga).
// - Vendedor / usuário comum só pode alterar a sua própria senha, exigindo a validação da senha atual (oldPassword).

routerAdd(
  'POST',
  '/backend/v1/users/{id}/password',
  (e) => {
    const auth = e.auth
    if (!auth) {
      throw new UnauthorizedError('Acesso não autorizado. Faça login.')
    }

    const targetUserId = e.request.pathValue('id')
    if (!targetUserId) {
      throw new BadRequestError('ID do usuário não fornecido.')
    }

    let targetUser
    try {
      targetUser = $app.findRecordById('users', targetUserId)
    } catch (_) {
      throw new NotFoundError('Usuário não encontrado.')
    }

    const body = new DynamicModel({
      oldPassword: '',
      password: '',
      passwordConfirm: '',
    })
    e.bindBody(body)

    const newPassword = (body.password || '').trim()
    const passwordConfirm = (body.passwordConfirm || '').trim()
    const oldPassword = body.oldPassword || ''

    if (!newPassword) {
      throw new BadRequestError('A nova senha é obrigatória.')
    }
    if (newPassword.length < 8) {
      throw new BadRequestError('A nova senha deve ter no mínimo 8 caracteres.')
    }
    if (passwordConfirm && newPassword !== passwordConfirm) {
      throw new BadRequestError('A confirmação da nova senha não confere.')
    }

    const authRole = auth.get('role')
    const isAdmin = authRole === 'Administrador'
    const isSelf = auth.id === targetUserId

    if (!isAdmin && !isSelf) {
      throw new ForbiddenError('Você só tem permissão para alterar a sua própria senha.')
    }

    // Se for o próprio usuário alterando a senha e NÃO for admin, a senha antiga é obrigatória
    if (isSelf && !isAdmin) {
      if (!oldPassword) {
        throw new BadRequestError('Informe a sua senha atual para confirmação.')
      }
      if (!targetUser.validatePassword(oldPassword)) {
        throw new BadRequestError('A senha atual informada está incorreta.')
      }
    }

    // Se for admin alterando a própria senha, mas informou oldPassword, valida também se desejar, senão permite direto
    if (isSelf && isAdmin && oldPassword) {
      if (!targetUser.validatePassword(oldPassword)) {
        throw new BadRequestError('A senha atual informada está incorreta.')
      }
    }

    // Aplica a nova senha no registro
    targetUser.setPassword(newPassword)
    $app.save(targetUser)

    return e.json(200, {
      success: true,
      message: 'Senha alterada com sucesso.',
    })
  },
  $apis.requireAuth(),
)

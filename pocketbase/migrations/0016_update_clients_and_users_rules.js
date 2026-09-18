migrate(
  (app) => {
    // 1. Atualizar regras de acesso da collection clients para permitir criação/edição por qualquer usuário autenticado
    try {
      const clients = app.findCollectionByNameOrId('clients')
      clients.listRule = '@request.auth.id != ""'
      clients.viewRule = '@request.auth.id != ""'
      clients.createRule = '@request.auth.id != ""'
      clients.updateRule = '@request.auth.id != ""'
      // Exclusão pode continuar restrita a Administrador
      clients.deleteRule = '@request.auth.role = "Administrador"'
      app.save(clients)
    } catch (e) {
      console.log('Erro ao atualizar regras de clients:', e)
    }

    // 2. Atualizar regras de acesso da collection users
    // manageRule permite que Administradores alterem senha/dados de qualquer usuário diretamente sem oldPassword
    try {
      const users = app.findCollectionByNameOrId('users')
      users.listRule = '@request.auth.id != ""'
      users.viewRule = '@request.auth.id != ""'
      users.createRule = '@request.auth.role = "Administrador"'
      users.updateRule = '@request.auth.role = "Administrador" || @request.auth.id = id'
      users.deleteRule = '@request.auth.role = "Administrador"'
      users.manageRule = '@request.auth.role = "Administrador"'
      app.save(users)
    } catch (e) {
      console.log('Erro ao atualizar regras de users:', e)
    }
  },
  (app) => {
    try {
      const clients = app.findCollectionByNameOrId('clients')
      clients.createRule = '@request.auth.role = "Administrador"'
      clients.updateRule = '@request.auth.role = "Administrador"'
      app.save(clients)
    } catch (_) {}

    try {
      const users = app.findCollectionByNameOrId('users')
      users.manageRule = null
      app.save(users)
    } catch (_) {}
  },
)

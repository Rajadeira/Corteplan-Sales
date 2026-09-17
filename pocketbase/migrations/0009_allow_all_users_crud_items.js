// pocketbase/migrations/0009_allow_all_users_crud_items.js
migrate(
  (app) => {
    try {
      const items = app.findCollectionByNameOrId('items')
      // Qualquer usuário/vendedor autenticado pode listar, visualizar, criar, editar e excluir itens
      items.listRule = '@request.auth.id != ""'
      items.viewRule = '@request.auth.id != ""'
      items.createRule = '@request.auth.id != ""'
      items.updateRule = '@request.auth.id != ""'
      items.deleteRule = '@request.auth.id != ""'
      app.save(items)

      // Regras de quotes e orders:
      // List e View para qualquer autenticado (a UI mascara valores confidenciais para vendedores)
      // Create para qualquer autenticado
      // Update e Delete para Administrador OU dono do orçamento (seller_user ou nome do vendedor)
      const quotes = app.findCollectionByNameOrId('quotes')
      quotes.listRule = '@request.auth.id != ""'
      quotes.viewRule = '@request.auth.id != ""'
      quotes.createRule = '@request.auth.id != ""'
      quotes.updateRule =
        '@request.auth.role = "Administrador" || seller_user = @request.auth.id || seller ~ @request.auth.name'
      quotes.deleteRule =
        '@request.auth.role = "Administrador" || seller_user = @request.auth.id || seller ~ @request.auth.name'
      app.save(quotes)

      const orders = app.findCollectionByNameOrId('orders')
      orders.listRule = '@request.auth.id != ""'
      orders.viewRule = '@request.auth.id != ""'
      orders.createRule = '@request.auth.id != ""'
      orders.updateRule =
        '@request.auth.role = "Administrador" || seller_user = @request.auth.id || seller ~ @request.auth.name'
      orders.deleteRule =
        '@request.auth.role = "Administrador" || seller_user = @request.auth.id || seller ~ @request.auth.name'
      app.save(orders)
    } catch (e) {
      console.log('Erro ao atualizar regras de items:', e)
    }
  },
  (app) => {
    try {
      const items = app.findCollectionByNameOrId('items')
      items.listRule = '@request.auth.id != ""'
      items.viewRule = '@request.auth.id != ""'
      items.createRule = '@request.auth.role = "Administrador"'
      items.updateRule = '@request.auth.role = "Administrador"'
      items.deleteRule = '@request.auth.role = "Administrador"'
      app.save(items)
    } catch (_) {}
  },
)

// pocketbase/migrations/0010_update_quotes_and_orders_rules.js
migrate(
  (app) => {
    try {
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
      console.log('Erro ao atualizar regras de quotes e orders:', e)
    }
  },
  (app) => {
    try {
      const quotes = app.findCollectionByNameOrId('quotes')
      quotes.updateRule = '@request.auth.id != ""'
      quotes.deleteRule = '@request.auth.id != ""'
      app.save(quotes)
    } catch (_) {}
  },
)

migrate(
  (app) => {
    // 1. Limpar dados operacionais/demonstração
    // Ordem de deleção respeitando dependências:
    // notifications -> orders -> quotes -> items -> clients
    try {
      app.db().newQuery('DELETE FROM notifications').execute()
    } catch (_) {}

    try {
      app.db().newQuery('DELETE FROM orders').execute()
    } catch (_) {}

    try {
      app.db().newQuery('DELETE FROM quotes').execute()
    } catch (_) {}

    try {
      app.db().newQuery('DELETE FROM items').execute()
    } catch (_) {}

    try {
      app.db().newQuery('DELETE FROM clients').execute()
    } catch (_) {}

    // Limpar eventuais registros vazios em app_settings
    try {
      app
        .db()
        .newQuery("DELETE FROM app_settings WHERE setting_key IS NULL OR setting_key = ''")
        .execute()
    } catch (_) {}

    // 2. Configurar o sequencial inicial em app_settings
    // O último orçamento do app antigo foi o 140, portanto o próximo deve ser 141.
    // Pedidos iniciam em 1 (último = 0).
    const appSettingsCol = app.findCollectionByNameOrId('app_settings')

    // Sequencial de Orçamentos
    try {
      const quoteSeq = app.findFirstRecordByData('app_settings', 'setting_key', 'last_quote_number')
      quoteSeq.set('value', 140)
      quoteSeq.set('description', 'Último número de orçamento utilizado (o próximo será este + 1)')
      app.save(quoteSeq)
    } catch (_) {
      const quoteSeq = new Record(appSettingsCol)
      quoteSeq.set('setting_key', 'last_quote_number')
      quoteSeq.set('value', 140)
      quoteSeq.set('description', 'Último número de orçamento utilizado (o próximo será este + 1)')
      app.save(quoteSeq)
    }

    // Sequencial de Pedidos
    try {
      const orderSeq = app.findFirstRecordByData('app_settings', 'setting_key', 'last_order_number')
      orderSeq.set('value', 0)
      orderSeq.set('description', 'Último número de pedido utilizado (o próximo será este + 1)')
      app.save(orderSeq)
    } catch (_) {
      const orderSeq = new Record(appSettingsCol)
      orderSeq.set('setting_key', 'last_order_number')
      orderSeq.set('value', 0)
      orderSeq.set('description', 'Último número de pedido utilizado (o próximo será este + 1)')
      app.save(orderSeq)
    }
  },
  (app) => {
    // Reversão opcional (não destrutiva)
  },
)

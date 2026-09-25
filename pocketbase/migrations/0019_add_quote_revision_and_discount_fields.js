migrate(
  (app) => {
    const quotes = app.findCollectionByNameOrId('quotes')

    // 1. Campos de revisão e desconto na collection 'quotes'
    if (!quotes.fields.getByName('revision')) {
      quotes.fields.add(new NumberField({ name: 'revision', required: false, onlyInt: true }))
    }
    if (!quotes.fields.getByName('parent_quote')) {
      quotes.fields.add(
        new RelationField({
          name: 'parent_quote',
          collectionId: quotes.id,
          cascadeDelete: false,
          maxSelect: 1,
          required: false,
        }),
      )
    }
    if (!quotes.fields.getByName('discount_value')) {
      quotes.fields.add(new NumberField({ name: 'discount_value', required: false }))
    }

    // 2. Remover índice único antigo que travava apenas em quote_number
    try {
      quotes.removeIndex('idx_quotes_number')
    } catch (_) {}

    app.save(quotes)

    // 3. Atualizar registros existentes para revision = 0 se nulo
    app.db().newQuery('UPDATE quotes SET revision = 0 WHERE revision IS NULL').execute()

    // 4. Adicionar índice único composto (quote_number, revision)
    try {
      quotes.addIndex('idx_quotes_number_revision', true, 'quote_number, revision', '')
      app.save(quotes)
    } catch (_) {}

    // 5. Adicionar campos correspondentes na collection 'orders'
    const orders = app.findCollectionByNameOrId('orders')
    if (!orders.fields.getByName('quote_revision')) {
      orders.fields.add(new NumberField({ name: 'quote_revision', required: false, onlyInt: true }))
    }
    if (!orders.fields.getByName('discount_value')) {
      orders.fields.add(new NumberField({ name: 'discount_value', required: false }))
    }
    app.save(orders)
  },
  (app) => {
    try {
      const quotes = app.findCollectionByNameOrId('quotes')
      try {
        quotes.removeIndex('idx_quotes_number_revision')
      } catch (_) {}
      try {
        quotes.addIndex('idx_quotes_number', true, 'quote_number', '')
      } catch (_) {}
      if (quotes.fields.getByName('revision')) quotes.fields.removeByName('revision')
      if (quotes.fields.getByName('parent_quote')) quotes.fields.removeByName('parent_quote')
      if (quotes.fields.getByName('discount_value')) quotes.fields.removeByName('discount_value')
      app.save(quotes)
    } catch (_) {}

    try {
      const orders = app.findCollectionByNameOrId('orders')
      if (orders.fields.getByName('quote_revision')) orders.fields.removeByName('quote_revision')
      if (orders.fields.getByName('discount_value')) orders.fields.removeByName('discount_value')
      app.save(orders)
    } catch (_) {}
  },
)

migrate(
  (app) => {
    const quotes = app.findCollectionByNameOrId('quotes')

    // Campo de layout customizado (JSON) para diagramação manual
    if (!quotes.fields.getByName('layout_config')) {
      quotes.fields.add(new JSONField({ name: 'layout_config', required: false }))
    }

    app.save(quotes)
  },
  (app) => {
    try {
      const quotes = app.findCollectionByNameOrId('quotes')
      const f = quotes.fields.getByName('layout_config')
      if (f) {
        quotes.fields.removeByName('layout_config')
        app.save(quotes)
      }
    } catch (_) {}
  },
)

migrate(
  (app) => {
    const quotes = app.findCollectionByNameOrId('quotes')

    // Campos de impostos
    if (!quotes.fields.getByName('icms')) {
      quotes.fields.add(new NumberField({ name: 'icms', required: false }))
    }
    if (!quotes.fields.getByName('ipi')) {
      quotes.fields.add(new NumberField({ name: 'ipi', required: false }))
    }
    if (!quotes.fields.getByName('pis')) {
      quotes.fields.add(new NumberField({ name: 'pis', required: false }))
    }
    if (!quotes.fields.getByName('cofins')) {
      quotes.fields.add(new NumberField({ name: 'cofins', required: false }))
    }

    // Campos comerciais
    if (!quotes.fields.getByName('seller')) {
      quotes.fields.add(new TextField({ name: 'seller', required: false }))
    }
    if (!quotes.fields.getByName('validity_days')) {
      quotes.fields.add(new NumberField({ name: 'validity_days', required: false, onlyInt: true }))
    }
    if (!quotes.fields.getByName('delivery_term')) {
      quotes.fields.add(new TextField({ name: 'delivery_term', required: false }))
    }
    if (!quotes.fields.getByName('payment_terms')) {
      quotes.fields.add(new TextField({ name: 'payment_terms', required: false }))
    }

    // Parcelas (JSON array de {number, date, method, value})
    if (!quotes.fields.getByName('installments')) {
      quotes.fields.add(new JSONField({ name: 'installments', required: false }))
    }

    app.save(quotes)
  },
  (app) => {
    try {
      const quotes = app.findCollectionByNameOrId('quotes')
      const fieldsToRemove = [
        'icms',
        'ipi',
        'pis',
        'cofins',
        'seller',
        'validity_days',
        'delivery_term',
        'payment_terms',
        'installments',
      ]
      for (let i = 0; i < fieldsToRemove.length; i++) {
        const f = quotes.fields.getByName(fieldsToRemove[i])
        if (f) quotes.fields.removeByName(fieldsToRemove[i])
      }
      app.save(quotes)
    } catch (_) {}
  },
)

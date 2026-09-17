migrate(
  (app) => {
    const clients = app.findCollectionByNameOrId('clients')

    if (!clients.fields.getByName('document_type')) {
      clients.fields.add(
        new SelectField({
          name: 'document_type',
          required: false,
          values: ['CNPJ', 'CPF'],
          maxSelect: 1,
        }),
      )
    }

    if (!clients.fields.getByName('document_number')) {
      clients.fields.add(new TextField({ name: 'document_number', required: false }))
    }

    if (!clients.fields.getByName('trade_name')) {
      clients.fields.add(new TextField({ name: 'trade_name', required: false }))
    }

    if (!clients.fields.getByName('contact_name')) {
      clients.fields.add(new TextField({ name: 'contact_name', required: false }))
    }

    if (!clients.fields.getByName('zip_code')) {
      clients.fields.add(new TextField({ name: 'zip_code', required: false }))
    }

    if (!clients.fields.getByName('neighborhood')) {
      clients.fields.add(new TextField({ name: 'neighborhood', required: false }))
    }

    if (!clients.fields.getByName('state')) {
      clients.fields.add(new TextField({ name: 'state', required: false }))
    }

    app.save(clients)

    // Atualiza o cliente Qualimais Distribuidora que foi semeado na migration 0004
    try {
      const qualimais = app.findFirstRecordByData('clients', 'phone', '(11) 2774-1260')
      if (qualimais) {
        qualimais.set('document_type', 'CNPJ')
        qualimais.set('document_number', '09.506.555/0001-84')
        qualimais.set('trade_name', 'QUALIMAIS DISTRIBUIDORA')
        qualimais.set('contact_name', 'QUALIMAIS')
        qualimais.set('neighborhood', 'Vila Maria Baixa')
        qualimais.set('state', 'SP')
        app.save(qualimais)
      }
    } catch (_) {}
  },
  (app) => {
    try {
      const clients = app.findCollectionByNameOrId('clients')
      const fieldsToRemove = [
        'document_type',
        'document_number',
        'trade_name',
        'contact_name',
        'zip_code',
        'neighborhood',
        'state',
      ]
      for (let i = 0; i < fieldsToRemove.length; i++) {
        const f = clients.fields.getByName(fieldsToRemove[i])
        if (f) clients.fields.removeByName(fieldsToRemove[i])
      }
      app.save(clients)
    } catch (_) {}
  },
)

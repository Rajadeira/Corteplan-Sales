migrate(
  (app) => {
    // 1. Collection 'clients'
    const clientsCollection = new Collection({
      name: 'clients',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'email', type: 'text', required: false },
        { name: 'phone', type: 'text', required: true },
        { name: 'company', type: 'text', required: false },
        { name: 'address', type: 'text', required: false },
        { name: 'city', type: 'text', required: false },
        { name: 'notes', type: 'text', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_clients_name ON clients (name)',
        'CREATE INDEX idx_clients_email ON clients (email)',
      ],
    })
    app.save(clientsCollection)

    const clientsId = app.findCollectionByNameOrId('clients').id

    // 2. Collection 'quotes'
    const quotesCollection = new Collection({
      name: 'quotes',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'quote_number', type: 'number', required: true, onlyInt: true },
        {
          name: 'client',
          type: 'relation',
          required: true,
          collectionId: clientsId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'items', type: 'json', required: true },
        { name: 'discount_percent', type: 'number', required: false },
        { name: 'subtotal', type: 'number', required: true },
        { name: 'total', type: 'number', required: true },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['Rascunho', 'Enviado', 'Aprovado', 'Rejeitado'],
          maxSelect: 1,
        },
        { name: 'observations', type: 'text', required: false },
        { name: 'status_history', type: 'json', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_quotes_number ON quotes (quote_number)',
        'CREATE INDEX idx_quotes_status ON quotes (status)',
        'CREATE INDEX idx_quotes_client ON quotes (client)',
      ],
    })
    app.save(quotesCollection)
  },
  (app) => {
    try {
      const quotes = app.findCollectionByNameOrId('quotes')
      app.delete(quotes)
    } catch (_) {}

    try {
      const clients = app.findCollectionByNameOrId('clients')
      app.delete(clients)
    } catch (_) {}
  },
)

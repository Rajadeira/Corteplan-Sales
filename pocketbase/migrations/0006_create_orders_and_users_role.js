migrate(
  (app) => {
    // 1. Atualizar users: adicionar campo 'role' (Administrador | Vendedor)
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    if (!usersCol.fields.getByName('role')) {
      usersCol.fields.add(
        new SelectField({
          name: 'role',
          required: false,
          values: ['Administrador', 'Vendedor'],
          maxSelect: 1,
        }),
      )
      app.save(usersCol)
    }

    // Atualizar o usuário existente gustavo@corteplan.com.br para Administrador e nome Gustavo
    try {
      const gustavo = app.findAuthRecordByEmail('_pb_users_auth_', 'gustavo@corteplan.com.br')
      gustavo.set('name', 'Gustavo')
      gustavo.set('role', 'Administrador')
      app.save(gustavo)
    } catch (_) {}

    // Criar o vendedor Felizardo (felizardo@corteplan.com.br / Skip@Pass) se não existir
    try {
      app.findAuthRecordByEmail('_pb_users_auth_', 'felizardo@corteplan.com.br')
    } catch (_) {
      const felizardo = new Record(usersCol)
      felizardo.setEmail('felizardo@corteplan.com.br')
      felizardo.setPassword('Skip@Pass')
      felizardo.setVerified(true)
      felizardo.set('name', 'Felizardo')
      felizardo.set('role', 'Vendedor')
      app.save(felizardo)
    }

    // 2. Atualizar quotes: adicionar 'seller_user' (relação opcional com users), 'commission_percent' e 'order_number'
    const quotesCol = app.findCollectionByNameOrId('quotes')
    if (!quotesCol.fields.getByName('seller_user')) {
      quotesCol.fields.add(
        new RelationField({
          name: 'seller_user',
          collectionId: '_pb_users_auth_',
          required: false,
          maxSelect: 1,
          cascadeDelete: false,
        }),
      )
    }
    if (!quotesCol.fields.getByName('commission_percent')) {
      quotesCol.fields.add(
        new NumberField({
          name: 'commission_percent',
          required: false,
          min: 0,
          max: 100,
        }),
      )
    }
    if (!quotesCol.fields.getByName('order_number')) {
      quotesCol.fields.add(
        new NumberField({
          name: 'order_number',
          required: false,
          onlyInt: true,
        }),
      )
    }
    if (!quotesCol.fields.getByName('order_id')) {
      quotesCol.fields.add(
        new TextField({
          name: 'order_id',
          required: false,
        }),
      )
    }
    app.save(quotesCol)

    // 3. Criar coleção 'orders'
    const clientsId = app.findCollectionByNameOrId('clients').id
    const quotesId = app.findCollectionByNameOrId('quotes').id

    try {
      app.findCollectionByNameOrId('orders')
    } catch (_) {
      const ordersCol = new Collection({
        name: 'orders',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        fields: [
          { name: 'order_number', type: 'number', required: true, onlyInt: true },
          {
            name: 'client',
            type: 'relation',
            required: true,
            collectionId: clientsId,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'quote',
            type: 'relation',
            required: false,
            collectionId: quotesId,
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'quote_number', type: 'number', required: false, onlyInt: true },
          { name: 'items', type: 'json', required: true },
          { name: 'discount_percent', type: 'number', required: false },
          { name: 'subtotal', type: 'number', required: true },
          { name: 'total', type: 'number', required: true },
          {
            name: 'status',
            type: 'select',
            required: true,
            values: ['Aberto', 'Em Produção', 'Concluído', 'Cancelado'],
            maxSelect: 1,
          },
          { name: 'observations', type: 'text', required: false },
          { name: 'status_history', type: 'json', required: false },
          { name: 'seller', type: 'text', required: false },
          {
            name: 'seller_user',
            type: 'relation',
            required: false,
            collectionId: '_pb_users_auth_',
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'commission_percent', type: 'number', required: false },
          { name: 'commission_value', type: 'number', required: false },
          { name: 'validity_days', type: 'number', required: false, onlyInt: true },
          { name: 'delivery_term', type: 'text', required: false },
          { name: 'payment_terms', type: 'text', required: false },
          { name: 'installments', type: 'json', required: false },
          { name: 'icms', type: 'number', required: false },
          { name: 'ipi', type: 'number', required: false },
          { name: 'pis', type: 'number', required: false },
          { name: 'cofins', type: 'number', required: false },
          { name: 'layout_config', type: 'json', required: false },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_orders_number ON orders (order_number)',
          'CREATE INDEX idx_orders_status ON orders (status)',
          'CREATE INDEX idx_orders_client ON orders (client)',
          'CREATE INDEX idx_orders_quote ON orders (quote)',
        ],
      })
      app.save(ordersCol)
    }
  },
  (app) => {
    try {
      const orders = app.findCollectionByNameOrId('orders')
      app.delete(orders)
    } catch (_) {}
  },
)

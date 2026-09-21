migrate(
  (app) => {
    const orders = app.findCollectionByNameOrId('orders')
    const quotes = app.findCollectionByNameOrId('quotes')

    // 1. Collection 'invoices' (Notas Fiscais de Venda)
    // Apenas Administrador pode listar, visualizar, criar, alterar e deletar
    const invoices = new Collection({
      name: 'invoices',
      type: 'base',
      listRule: '@request.auth.role = "Administrador"',
      viewRule: '@request.auth.role = "Administrador"',
      createRule: '@request.auth.role = "Administrador"',
      updateRule: '@request.auth.role = "Administrador"',
      deleteRule: '@request.auth.role = "Administrador"',
      fields: [
        {
          name: 'invoice_number',
          type: 'text',
        },
        {
          name: 'series',
          type: 'text',
        },
        {
          name: 'access_key',
          type: 'text',
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['Aguardando Emissão', 'Emitida', 'Cancelada', 'Erro'],
          maxSelect: 1,
        },
        {
          name: 'provider',
          type: 'text',
        },
        {
          name: 'order',
          type: 'relation',
          collectionId: orders.id,
          maxSelect: 1,
        },
        {
          name: 'quote',
          type: 'relation',
          collectionId: quotes.id,
          maxSelect: 1,
        },
        {
          name: 'client_name',
          type: 'text',
          required: true,
        },
        {
          name: 'client_document',
          type: 'text',
        },
        {
          name: 'total_amount',
          type: 'number',
        },
        {
          name: 'issued_at',
          type: 'date',
        },
        {
          name: 'cancelled_at',
          type: 'date',
        },
        {
          name: 'cancel_reason',
          type: 'text',
        },
        {
          name: 'danfe_url',
          type: 'text',
        },
        {
          name: 'xml_url',
          type: 'text',
        },
        {
          name: 'error_message',
          type: 'text',
        },
        {
          name: 'raw_payload',
          type: 'json',
        },
        {
          name: 'raw_response',
          type: 'json',
        },
        {
          name: 'created',
          type: 'autodate',
          onCreate: true,
          onUpdate: false,
        },
        {
          name: 'updated',
          type: 'autodate',
          onCreate: true,
          onUpdate: true,
        },
      ],
      indexes: [
        'CREATE INDEX idx_invoices_order ON invoices (order)',
        'CREATE INDEX idx_invoices_status ON invoices (status)',
        'CREATE INDEX idx_invoices_access_key ON invoices (access_key)',
      ],
    })
    app.save(invoices)

    // 2. Collection 'cashflow_entries' (Fluxo de Caixa)
    // Apenas Administrador pode acessar
    const cashflow = new Collection({
      name: 'cashflow_entries',
      type: 'base',
      listRule: '@request.auth.role = "Administrador"',
      viewRule: '@request.auth.role = "Administrador"',
      createRule: '@request.auth.role = "Administrador"',
      updateRule: '@request.auth.role = "Administrador"',
      deleteRule: '@request.auth.role = "Administrador"',
      fields: [
        {
          name: 'type',
          type: 'select',
          required: true,
          values: ['Entrada', 'Saída'],
          maxSelect: 1,
        },
        {
          name: 'date',
          type: 'date',
          required: true,
        },
        {
          name: 'description',
          type: 'text',
          required: true,
        },
        {
          name: 'amount',
          type: 'number',
          required: true,
        },
        {
          name: 'category',
          type: 'text',
        },
        {
          name: 'origin',
          type: 'select',
          required: true,
          values: ['manual', 'parcela'],
          maxSelect: 1,
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['Pendente', 'Realizado'],
          maxSelect: 1,
        },
        {
          name: 'order',
          type: 'relation',
          collectionId: orders.id,
          maxSelect: 1,
        },
        {
          name: 'installment_number',
          type: 'number',
        },
        {
          name: 'payment_method',
          type: 'text',
        },
        {
          name: 'received_at',
          type: 'date',
        },
        {
          name: 'notes',
          type: 'text',
        },
        {
          name: 'created',
          type: 'autodate',
          onCreate: true,
          onUpdate: false,
        },
        {
          name: 'updated',
          type: 'autodate',
          onCreate: true,
          onUpdate: true,
        },
      ],
      indexes: [
        'CREATE INDEX idx_cashflow_date ON cashflow_entries (date DESC)',
        'CREATE INDEX idx_cashflow_type ON cashflow_entries (type)',
        'CREATE INDEX idx_cashflow_order ON cashflow_entries (order)',
        'CREATE INDEX idx_cashflow_status ON cashflow_entries (status)',
      ],
    })
    app.save(cashflow)
  },
  (app) => {
    try {
      const cashflow = app.findCollectionByNameOrId('cashflow_entries')
      app.delete(cashflow)
    } catch (_) {}

    try {
      const invoices = app.findCollectionByNameOrId('invoices')
      app.delete(invoices)
    } catch (_) {}
  },
)

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    const clients = app.findCollectionByNameOrId('clients')
    const monitoredClients = app.findCollectionByNameOrId('monitored_clients')

    const riskInquiries = new Collection({
      name: 'risk_inquiries',
      type: 'base',
      listRule: '@request.auth.role = "Administrador"',
      viewRule: '@request.auth.role = "Administrador"',
      createRule: '@request.auth.role = "Administrador"',
      updateRule: '@request.auth.role = "Administrador"',
      deleteRule: '@request.auth.role = "Administrador"',
      fields: [
        {
          name: 'client',
          type: 'relation',
          required: false,
          collectionId: clients.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'monitored_client',
          type: 'relation',
          required: false,
          collectionId: monitoredClients.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'cnpj',
          type: 'text',
          required: true,
        },
        {
          name: 'razao_social',
          type: 'text',
          required: true,
        },
        {
          name: 'nome_fantasia',
          type: 'text',
          required: false,
        },
        {
          name: 'source',
          type: 'select',
          required: true,
          values: ['internal', 'external'],
          maxSelect: 1,
        },
        {
          name: 'internal_score',
          type: 'number',
          required: false,
        },
        {
          name: 'internal_score_label',
          type: 'text',
          required: false,
        },
        {
          name: 'internal_reasons',
          type: 'json',
          required: false,
        },
        {
          name: 'external_score',
          type: 'number',
          required: false,
        },
        {
          name: 'external_score_label',
          type: 'text',
          required: false,
        },
        {
          name: 'external_alerts',
          type: 'json',
          required: false,
        },
        {
          name: 'cnd_federal',
          type: 'json',
          required: false,
        },
        {
          name: 'cndt',
          type: 'json',
          required: false,
        },
        {
          name: 'situation',
          type: 'json',
          required: false,
        },
        {
          name: 'raw_summary',
          type: 'text',
          required: false,
        },
        {
          name: 'requested_by',
          type: 'relation',
          required: false,
          collectionId: users.id,
          cascadeDelete: false,
          maxSelect: 1,
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
        'CREATE INDEX idx_risk_inquiries_created ON risk_inquiries (created DESC)',
        'CREATE INDEX idx_risk_inquiries_cnpj ON risk_inquiries (cnpj)',
      ],
    })

    app.save(riskInquiries)
  },
  (app) => {
    try {
      const riskInquiries = app.findCollectionByNameOrId('risk_inquiries')
      app.delete(riskInquiries)
    } catch (_) {}
  },
)

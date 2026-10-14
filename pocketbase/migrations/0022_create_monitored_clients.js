migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')

    const monitoredClients = new Collection({
      name: 'monitored_clients',
      type: 'base',
      listRule: '@request.auth.role = "Administrador"',
      viewRule: '@request.auth.role = "Administrador"',
      createRule: '@request.auth.role = "Administrador"',
      updateRule: '@request.auth.role = "Administrador"',
      deleteRule: '@request.auth.role = "Administrador"',
      fields: [
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
          name: 'risco',
          type: 'select',
          required: true,
          values: ['Baixo', 'Médio', 'Alto', 'Altíssimo', 'Sem histórico'],
          maxSelect: 1,
        },
        {
          name: 'risco_motivo',
          type: 'text',
          required: false,
        },
        {
          name: 'situacao_cadastral',
          type: 'text',
          required: false,
        },
        {
          name: 'cnae',
          type: 'text',
          required: false,
        },
        {
          name: 'cnae_descricao',
          type: 'text',
          required: false,
        },
        {
          name: 'natureza_juridica',
          type: 'text',
          required: false,
        },
        {
          name: 'natureza_juridica_codigo',
          type: 'text',
          required: false,
        },
        {
          name: 'ultima_consulta',
          type: 'date',
          required: false,
        },
        {
          name: 'criado_por',
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
        'CREATE UNIQUE INDEX idx_monitored_clients_cnpj ON monitored_clients (cnpj)',
        'CREATE INDEX idx_monitored_clients_risco ON monitored_clients (risco)',
      ],
    })

    app.save(monitoredClients)
  },
  (app) => {
    try {
      const monitoredClients = app.findCollectionByNameOrId('monitored_clients')
      app.delete(monitoredClients)
    } catch (_) {}
  },
)

migrate(
  (app) => {
    // 1. Criar collection followups
    const quotes = app.findCollectionByNameOrId('quotes')

    const collection = new Collection({
      name: 'followups',
      type: 'base',
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.id != ""',
      updateRule: '@request.auth.role = "Administrador" || author = @request.auth.id',
      deleteRule: '@request.auth.role = "Administrador" || author = @request.auth.id',
      fields: [
        {
          name: 'quote',
          type: 'relation',
          required: true,
          collectionId: quotes.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'contact_date',
          type: 'date',
          required: true,
        },
        {
          name: 'contact_type',
          type: 'select',
          required: true,
          values: ['Ligação', 'WhatsApp', 'E-mail', 'Reunião', 'Outros'],
          maxSelect: 1,
        },
        {
          name: 'notes',
          type: 'text',
          required: true,
        },
        {
          name: 'author',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
        },
        {
          name: 'author_name',
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
        'CREATE INDEX idx_followups_quote ON followups (quote)',
        'CREATE INDEX idx_followups_contact_date ON followups (contact_date DESC)',
        'CREATE INDEX idx_followups_author ON followups (author)',
      ],
    })

    app.save(collection)

    // 2. Garantir regra de criação da collection users restrita a Administrador
    try {
      const users = app.findCollectionByNameOrId('users')
      users.createRule = '@request.auth.role = "Administrador"'
      users.manageRule = '@request.auth.role = "Administrador"'
      app.save(users)
    } catch (e) {
      console.log('Erro ao garantir regras de users na migration 0017:', e)
    }
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId('followups')
      app.delete(collection)
    } catch (_) {}
  },
)

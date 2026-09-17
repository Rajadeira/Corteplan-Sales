migrate(
  (app) => {
    let notificationsCol = null
    try {
      notificationsCol = app.findCollectionByNameOrId('notifications')
    } catch (_) {}

    if (!notificationsCol) {
      const usersCol = app.findCollectionByNameOrId('users')
      const quotesCol = app.findCollectionByNameOrId('quotes')

      notificationsCol = new Collection({
        name: 'notifications',
        type: 'base',
        // Cada usuário lê, visualiza e atualiza (marca lida) apenas suas próprias notificações
        // Usuários autenticados podem criar notificações (ex.: ao aprovar um orçamento)
        listRule: '@request.auth.id != "" && user = @request.auth.id',
        viewRule: '@request.auth.id != "" && user = @request.auth.id',
        createRule: '@request.auth.id != ""',
        updateRule: '@request.auth.id != "" && user = @request.auth.id',
        deleteRule: '@request.auth.id != "" && user = @request.auth.id',
        fields: [
          {
            name: 'user',
            type: 'relation',
            required: true,
            collectionId: usersCol.id,
            maxSelect: 1,
            cascadeDelete: true,
          },
          {
            name: 'type',
            type: 'text',
            required: false,
          },
          {
            name: 'title',
            type: 'text',
            required: true,
          },
          {
            name: 'message',
            type: 'text',
            required: true,
          },
          {
            name: 'quote',
            type: 'relation',
            required: false,
            collectionId: quotesCol.id,
            maxSelect: 1,
            cascadeDelete: false,
          },
          {
            name: 'read',
            type: 'bool',
            required: false,
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
          'CREATE INDEX idx_notifications_user ON notifications (user, created DESC)',
          'CREATE INDEX idx_notifications_read ON notifications (user, read)',
        ],
      })

      app.save(notificationsCol)
    }
  },
  (app) => {
    try {
      const notificationsCol = app.findCollectionByNameOrId('notifications')
      if (notificationsCol) {
        app.delete(notificationsCol)
      }
    } catch (_) {}
  },
)

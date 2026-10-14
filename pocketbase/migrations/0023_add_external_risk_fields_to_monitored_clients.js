migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('monitored_clients')

    if (!col.fields.getByName('external_score')) {
      col.fields.add(
        new NumberField({
          name: 'external_score',
          required: false,
          min: 0,
          max: 100,
        }),
      )
    }

    if (!col.fields.getByName('external_score_label')) {
      col.fields.add(
        new TextField({
          name: 'external_score_label',
          required: false,
        }),
      )
    }

    if (!col.fields.getByName('external_alerts')) {
      col.fields.add(
        new JSONField({
          name: 'external_alerts',
          required: false,
        }),
      )
    }

    if (!col.fields.getByName('external_cnd_federal')) {
      col.fields.add(
        new JSONField({
          name: 'external_cnd_federal',
          required: false,
        }),
      )
    }

    if (!col.fields.getByName('external_cndt')) {
      col.fields.add(
        new JSONField({
          name: 'external_cndt',
          required: false,
        }),
      )
    }

    if (!col.fields.getByName('external_consulted_at')) {
      col.fields.add(
        new DateField({
          name: 'external_consulted_at',
          required: false,
        }),
      )
    }

    if (!col.fields.getByName('external_raw_summary')) {
      col.fields.add(
        new JSONField({
          name: 'external_raw_summary',
          required: false,
        }),
      )
    }

    app.save(col)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('monitored_clients')
      const fieldsToRemove = [
        'external_score',
        'external_score_label',
        'external_alerts',
        'external_cnd_federal',
        'external_cndt',
        'external_consulted_at',
        'external_raw_summary',
      ]
      for (let i = 0; i < fieldsToRemove.length; i++) {
        const fieldName = fieldsToRemove[i]
        const f = col.fields.getByName(fieldName)
        if (f) col.fields.remove(f)
      }
      app.save(col)
    } catch (_) {}
  },
)

// pocketbase/migrations/0012_ensure_items_and_settings_schema_and_rules.js
migrate(
  (app) => {
    // 1. Garantir collection "items" com todos os campos e regras livres para usuários autenticados
    let itemsCollection = null
    try {
      itemsCollection = app.findCollectionByNameOrId('items')
    } catch (_) {}

    if (!itemsCollection) {
      const usersCol = app.findCollectionByNameOrId('users')
      itemsCollection = new Collection({
        name: 'items',
        type: 'base',
        listRule: '@request.auth.id != ""',
        viewRule: '@request.auth.id != ""',
        createRule: '@request.auth.id != ""',
        updateRule: '@request.auth.id != ""',
        deleteRule: '@request.auth.id != ""',
        fields: [
          new TextField({ name: 'code', required: false }),
          new TextField({ name: 'description', required: true }),
          new SelectField({
            name: 'category',
            required: true,
            values: [
              'Mobiliário',
              'Display',
              'Comunicação Visual',
              'Totem',
              'Quiosque',
              'Cenografia',
              'Frete',
              'Instalação',
              'Outros',
            ],
            maxSelect: 1,
          }),
          new SelectField({
            name: 'unit',
            required: true,
            values: ['un', 'm²', 'm', 'kit', 'hora'],
            maxSelect: 1,
          }),
          new NumberField({ name: 'unit_price', required: true, min: 0 }),
          new NumberField({ name: 'default_tax', required: false, min: 0 }),
          new TextField({ name: 'technical_description', required: false }),
          new TextField({ name: 'image', required: false }),
          new BoolField({ name: 'active', required: false }),
          new RelationField({
            name: 'created_by',
            collectionId: usersCol.id,
            maxSelect: 1,
            required: false,
          }),
          new AutodateField({ name: 'created', onCreate: true, onUpdate: false }),
          new AutodateField({ name: 'updated', onCreate: true, onUpdate: true }),
        ],
      })
      app.save(itemsCollection)
    } else {
      // Garantir regras
      itemsCollection.listRule = '@request.auth.id != ""'
      itemsCollection.viewRule = '@request.auth.id != ""'
      itemsCollection.createRule = '@request.auth.id != ""'
      itemsCollection.updateRule = '@request.auth.id != ""'
      itemsCollection.deleteRule = '@request.auth.id != ""'

      // Garantir campos
      if (!itemsCollection.fields.getByName('code')) {
        itemsCollection.fields.add(new TextField({ name: 'code', required: false }))
      }
      if (!itemsCollection.fields.getByName('description')) {
        itemsCollection.fields.add(new TextField({ name: 'description', required: true }))
      }
      if (!itemsCollection.fields.getByName('category')) {
        itemsCollection.fields.add(
          new SelectField({
            name: 'category',
            required: true,
            values: [
              'Mobiliário',
              'Display',
              'Comunicação Visual',
              'Totem',
              'Quiosque',
              'Cenografia',
              'Frete',
              'Instalação',
              'Outros',
            ],
            maxSelect: 1,
          }),
        )
      }
      if (!itemsCollection.fields.getByName('unit')) {
        itemsCollection.fields.add(
          new SelectField({
            name: 'unit',
            required: true,
            values: ['un', 'm²', 'm', 'kit', 'hora'],
            maxSelect: 1,
          }),
        )
      }
      if (!itemsCollection.fields.getByName('unit_price')) {
        itemsCollection.fields.add(new NumberField({ name: 'unit_price', required: true, min: 0 }))
      }
      if (!itemsCollection.fields.getByName('default_tax')) {
        itemsCollection.fields.add(
          new NumberField({ name: 'default_tax', required: false, min: 0 }),
        )
      }
      if (!itemsCollection.fields.getByName('technical_description')) {
        itemsCollection.fields.add(
          new TextField({ name: 'technical_description', required: false }),
        )
      }
      if (!itemsCollection.fields.getByName('image')) {
        itemsCollection.fields.add(new TextField({ name: 'image', required: false }))
      }
      if (!itemsCollection.fields.getByName('active')) {
        itemsCollection.fields.add(new BoolField({ name: 'active', required: false }))
      }
      if (!itemsCollection.fields.getByName('created_by')) {
        const usersCol = app.findCollectionByNameOrId('users')
        itemsCollection.fields.add(
          new RelationField({
            name: 'created_by',
            collectionId: usersCol.id,
            maxSelect: 1,
            required: false,
          }),
        )
      }
      if (!itemsCollection.fields.getByName('created')) {
        itemsCollection.fields.add(
          new AutodateField({ name: 'created', onCreate: true, onUpdate: false }),
        )
      }
      if (!itemsCollection.fields.getByName('updated')) {
        itemsCollection.fields.add(
          new AutodateField({ name: 'updated', onCreate: true, onUpdate: true }),
        )
      }
      app.save(itemsCollection)
    }

    // 2. Garantir collection "app_settings" com list/view/update/create para autenticados
    let settingsCollection = null
    try {
      settingsCollection = app.findCollectionByNameOrId('app_settings')
    } catch (_) {}

    if (settingsCollection) {
      settingsCollection.listRule = '@request.auth.id != ""'
      settingsCollection.viewRule = '@request.auth.id != ""'
      settingsCollection.createRule = '@request.auth.id != ""'
      settingsCollection.updateRule = '@request.auth.id != ""'
      settingsCollection.deleteRule = '@request.auth.role = "Administrador"'

      if (!settingsCollection.fields.getByName('setting_key')) {
        settingsCollection.fields.add(new TextField({ name: 'setting_key', required: true }))
      }
      if (!settingsCollection.fields.getByName('value')) {
        settingsCollection.fields.add(new JSONField({ name: 'value', required: true }))
      }
      if (!settingsCollection.fields.getByName('description')) {
        settingsCollection.fields.add(new TextField({ name: 'description', required: false }))
      }
      if (!settingsCollection.fields.getByName('created')) {
        settingsCollection.fields.add(
          new AutodateField({ name: 'created', onCreate: true, onUpdate: false }),
        )
      }
      if (!settingsCollection.fields.getByName('updated')) {
        settingsCollection.fields.add(
          new AutodateField({ name: 'updated', onCreate: true, onUpdate: true }),
        )
      }
      app.save(settingsCollection)
    }

    // 3. Garantir que os itens de exemplo existem
    const sampleItems = [
      {
        code: 'MOB-001',
        description: 'Carrinho Gourmet com Testeira',
        category: 'Mobiliário',
        unit: 'un',
        unit_price: 14540.76,
        default_tax: 1719.9,
        technical_description:
          'Confeccionado em compensado com revestimento laminado (Fórmica). Tampo em MDF madeirado. Testeira com iluminação LED. Mini estoque com porta e fechadura. Rodas de alumínio aro 20 com paralamas e rodízios de apoio de 3". Medidas aproximadas: 120x60x185cm.',
        active: true,
      },
      {
        code: 'TOT-002',
        description: 'Totem Expositor de Discos',
        category: 'Totem',
        unit: 'un',
        unit_price: 26892.5,
        default_tax: 3227.1,
        technical_description:
          'Estrutura em aço carbono tubular com pintura eletrostática preta fosca, nichos em acrílico moldado 4mm e testeira luminosa com corte a laser em MDF.',
        active: true,
      },
      {
        code: 'DIS-003',
        description: 'Display de Balcão em Acrílico Cristal 3mm',
        category: 'Display',
        unit: 'un',
        unit_price: 245.0,
        default_tax: 29.4,
        technical_description:
          'Acrílico virgem 100% cristal, corte a laser e dobra térmica perfeita, acabamento polido, bolsa porta-folheto A4.',
        active: true,
      },
      {
        code: 'SRV-004',
        description: 'Frete e Logística Especializada SP/Capital',
        category: 'Frete',
        unit: 'un',
        unit_price: 650.0,
        default_tax: 0,
        technical_description:
          'Transporte em veículo fechado com amarração protetora, plástico bolha e seguro de carga dentro da Região Metropolitana de São Paulo.',
        active: true,
      },
      {
        code: 'SRV-005',
        description: 'Instalação e Montagem Noturna em Shopping',
        category: 'Instalação',
        unit: 'hora',
        unit_price: 180.0,
        default_tax: 0,
        technical_description:
          'Equipe treinada com NR-35 e NR-10, EPIs completos, montagem no período pós-fechamento do shopping.',
        active: true,
      },
    ]

    for (let i = 0; i < sampleItems.length; i++) {
      const s = sampleItems[i]
      try {
        app.findFirstRecordByData('items', 'code', s.code)
      } catch (_) {
        try {
          const rec = new Record(itemsCollection)
          rec.set('code', s.code)
          rec.set('description', s.description)
          rec.set('category', s.category)
          rec.set('unit', s.unit)
          rec.set('unit_price', s.unit_price)
          rec.set('default_tax', s.default_tax)
          rec.set('technical_description', s.technical_description)
          rec.set('active', s.active)
          app.save(rec)
        } catch (errSave) {
          console.log('Erro ao salvar item sample:', errSave)
        }
      }
    }
  },
  (app) => {},
)

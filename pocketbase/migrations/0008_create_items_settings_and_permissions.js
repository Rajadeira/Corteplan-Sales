migrate(
  (app) => {
    let gustavoUser = null
    let felizardoUser = null

    // 1. Atualizar ou garantir usuários Gustavo (Administrador) e Felizardo (Vendedor)
    try {
      const usersCol = app.findCollectionByNameOrId('users')

      // Verificar Gustavo
      try {
        gustavoUser = app.findFirstRecordByData('users', 'email', 'gustavo@corteplan.com.br')
      } catch (_) {}

      if (!gustavoUser) {
        try {
          gustavoUser = app.findFirstRecordByData('users', 'name', 'Gustavo')
        } catch (_) {}
      }

      if (gustavoUser) {
        gustavoUser.set('role', 'Administrador')
        app.save(gustavoUser)
      } else {
        const newGustavo = new Record(usersCol)
        newGustavo.set('email', 'gustavo@corteplan.com.br')
        newGustavo.set('name', 'Gustavo')
        newGustavo.set('role', 'Administrador')
        newGustavo.setPassword('Skip@Pass123')
        app.save(newGustavo)
        gustavoUser = newGustavo
      }

      // Verificar Felizardo
      try {
        felizardoUser = app.findFirstRecordByData('users', 'email', 'felizardo@corteplan.com.br')
      } catch (_) {}

      if (!felizardoUser) {
        try {
          felizardoUser = app.findFirstRecordByData('users', 'name', 'Felizardo')
        } catch (_) {}
      }

      if (felizardoUser) {
        felizardoUser.set('role', 'Vendedor')
        app.save(felizardoUser)
      } else {
        const newFelizardo = new Record(usersCol)
        newFelizardo.set('email', 'felizardo@corteplan.com.br')
        newFelizardo.set('name', 'Felizardo')
        newFelizardo.set('role', 'Vendedor')
        newFelizardo.setPassword('Skip@Pass123')
        app.save(newFelizardo)
        felizardoUser = newFelizardo
      }

      // 2. Garantir campo seller_user em quotes e orders com fallback para gustavoUser.id
      if (gustavoUser) {
        try {
          const quotes = app.findRecordsByFilter(
            'quotes',
            'seller_user = "" || seller_user = null',
            '-created',
            500,
          )
          for (let i = 0; i < quotes.length; i++) {
            const q = quotes[i]
            const sellerName = (q.get('seller') || '').toLowerCase()
            if (sellerName.includes('felizardo') && felizardoUser) {
              q.set('seller_user', felizardoUser.id)
            } else {
              q.set('seller_user', gustavoUser.id)
            }
            app.save(q)
          }
        } catch (_) {}

        try {
          const orders = app.findRecordsByFilter(
            'orders',
            'seller_user = "" || seller_user = null',
            '-created',
            500,
          )
          for (let i = 0; i < orders.length; i++) {
            const o = orders[i]
            const sellerName = (o.get('seller') || '').toLowerCase()
            if (sellerName.includes('felizardo') && felizardoUser) {
              o.set('seller_user', felizardoUser.id)
            } else {
              o.set('seller_user', gustavoUser.id)
            }
            app.save(o)
          }
        } catch (_) {}
      }
    } catch (e) {
      console.log('Erro ao ajustar usuarios:', e)
    }

    // 3. Criar collection "items" (catálogo de produtos e serviços)
    let itemsCollection = null
    try {
      itemsCollection = app.findCollectionByNameOrId('items')
    } catch (_) {}

    if (!itemsCollection) {
      const usersCol = app.findCollectionByNameOrId('users')
      itemsCollection = new Collection({
        name: 'items',
        type: 'base',
        // Qualquer usuário autenticado pode listar e visualizar; criação/edição/exclusão apenas Administrador
        listRule: '@request.auth.id != ""',
        viewRule: '@request.auth.id != ""',
        createRule: '@request.auth.role = "Administrador"',
        updateRule: '@request.auth.role = "Administrador"',
        deleteRule: '@request.auth.role = "Administrador"',
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
        ],
      })
      app.save(itemsCollection)

      // Semear alguns itens padrão da Corteplan para catálogo imediato
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
        const itemData = sampleItems[i]
        const rec = new Record(itemsCollection)
        rec.set('code', itemData.code)
        rec.set('description', itemData.description)
        rec.set('category', itemData.category)
        rec.set('unit', itemData.unit)
        rec.set('unit_price', itemData.unit_price)
        rec.set('default_tax', itemData.default_tax)
        rec.set('technical_description', itemData.technical_description)
        rec.set('active', itemData.active)
        if (gustavoUser) rec.set('created_by', gustavoUser.id)
        app.save(rec)
      }
    }

    // 4. Criar collection "app_settings" (configurações do sistema: dados da empresa, impostos padrão, layout)
    let settingsCollection = null
    try {
      settingsCollection = app.findCollectionByNameOrId('app_settings')
    } catch (_) {}

    if (!settingsCollection) {
      settingsCollection = new Collection({
        name: 'app_settings',
        type: 'base',
        // Qualquer usuário autenticado pode ler as configurações; alteração somente Administrador
        listRule: '@request.auth.id != ""',
        viewRule: '@request.auth.id != ""',
        createRule: '@request.auth.role = "Administrador"',
        updateRule: '@request.auth.role = "Administrador"',
        deleteRule: '@request.auth.role = "Administrador"',
        fields: [
          new TextField({ name: 'setting_key', required: true }),
          new JSONField({ name: 'value', required: true }),
          new TextField({ name: 'description', required: false }),
        ],
      })
      app.save(settingsCollection)

      // Inserir configurações iniciais
      const defaultCompany = {
        name: 'CORTEPLAN COMÉRCIO E SERVIÇOS LTDA',
        trade_name: 'CORTEPLAN',
        cnpj: '08.618.375/0001-35',
        ie: '148.910.824.110',
        phone: '(11) 2201-4475',
        email: 'comercial@corteplan.com.br',
        address: 'Rua Soldado Teodoro Ximenes, 137',
        neighborhood: 'Parque Novo Mundo',
        city: 'São Paulo',
        state: 'SP',
        zip_code: '02188-040',
        website: 'www.corteplan.com.br',
      }

      const defaultTaxes = {
        icmsPercent: 12,
        ipiPercent: 3.25,
        pisPercent: 0.65,
        cofinsPercent: 3,
        defaultValidityDays: 5,
        defaultPaymentTerms: 'Entrada 50% + 2x',
        defaultDeliveryTerm: 'À Combinar',
      }

      const recCompany = new Record(settingsCollection)
      recCompany.set('setting_key', 'company_info')
      recCompany.set('value', defaultCompany)
      recCompany.set('description', 'Dados cadastrais da Corteplan')
      app.save(recCompany)

      const recTaxes = new Record(settingsCollection)
      recTaxes.set('setting_key', 'default_taxes')
      recTaxes.set('value', defaultTaxes)
      recTaxes.set('description', 'Impostos padrão e condições comerciais')
      app.save(recTaxes)
    }

    // 5. Ajustar regras de acesso da collection clients
    try {
      const clients = app.findCollectionByNameOrId('clients')
      // Todos autenticados podem ver e consultar clients (inclusive vendedor, para usar em orçamentos)
      // Somente Administrador pode criar, editar ou excluir
      clients.listRule = '@request.auth.id != ""'
      clients.viewRule = '@request.auth.id != ""'
      clients.createRule = '@request.auth.role = "Administrador"'
      clients.updateRule = '@request.auth.role = "Administrador"'
      clients.deleteRule = '@request.auth.role = "Administrador"'
      app.save(clients)
    } catch (e) {
      console.log('Erro ao atualizar regras de clients:', e)
    }

    // 6. Ajustar regras de acesso da collection users
    try {
      const users = app.findCollectionByNameOrId('users')
      // Usuários podem ser listados por autenticados (para dropdown de vendedores)
      // Mas criar/editar/excluir outros usuários apenas Administrador (ou o próprio usuário atualizando a si mesmo se necessário)
      users.listRule = '@request.auth.id != ""'
      users.viewRule = '@request.auth.id != ""'
      users.createRule = '@request.auth.role = "Administrador"'
      users.updateRule = '@request.auth.role = "Administrador" || @request.auth.id = id'
      users.deleteRule = '@request.auth.role = "Administrador"'
      app.save(users)
    } catch (e) {
      console.log('Erro ao atualizar regras de users:', e)
    }
  },
  (app) => {
    try {
      const itemsCol = app.findCollectionByNameOrId('items')
      if (itemsCol) app.delete(itemsCol)
    } catch (_) {}

    try {
      const settingsCol = app.findCollectionByNameOrId('app_settings')
      if (settingsCol) app.delete(settingsCol)
    } catch (_) {}
  },
)

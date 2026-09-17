migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')

    // 1. Seed user: gustavo@corteplan.com.br / Skip@Pass
    let adminUserId = ''
    try {
      const existingUser = app.findAuthRecordByEmail('_pb_users_auth_', 'gustavo@corteplan.com.br')
      adminUserId = existingUser.id
    } catch (_) {
      const user = new Record(users)
      user.setEmail('gustavo@corteplan.com.br')
      user.setPassword('Skip@Pass')
      user.setVerified(true)
      user.set('name', 'Gustavo Corteplan')
      app.save(user)
      adminUserId = user.id
    }

    // 2. Seed clients
    const clientsCol = app.findCollectionByNameOrId('clients')
    const sampleClients = [
      {
        name: 'Carlos Eduardo Mendes',
        email: 'carlos@estilomoveis.com.br',
        phone: '(11) 98765-4321',
        company: 'Estilo & Design Interiores',
        address: 'Av. Paulista, 1500, Sala 82',
        city: 'São Paulo - SP',
        notes:
          'Cliente corporativo com preferência por acabamento em MDF laca fosca e sinalização interna em acrílico.',
      },
      {
        name: 'Mariana Silveira Ramos',
        email: 'mariana.ramos@visualimpacto.com.br',
        phone: '(19) 99123-8877',
        company: 'Impacto Visual & Fachadas',
        address: 'Rua Barão de Jaguara, 420',
        city: 'Campinas - SP',
        notes:
          'Parceira recorrente para projetos de totens externos, fachadas em ACM e corte router.',
      },
      {
        name: 'Roberto Antunes Dias',
        email: 'roberto@diasengenharia.com.br',
        phone: '(21) 98456-1122',
        company: 'Dias Engenharia e Arquitetura',
        address: 'Rua do Ouvidor, 89, 4º andar',
        city: 'Rio de Janeiro - RJ',
        notes: 'Contratos corporativos de mobiliário de escritório e comunicação tátil/braille.',
      },
      {
        name: 'Fernanda Albuquerque Lima',
        email: 'fernanda@boutiquegourmet.com.br',
        phone: '(31) 99765-3344',
        company: 'Boutique Gourmet & Café',
        address: 'Alameda da Serra, 1020',
        city: 'Nova Lima - MG',
        notes:
          'Novo ponto comercial: balcão refrigerado sob medida, painel backlight e letreiro neon LED.',
      },
    ]

    const clientRecords = []
    for (let i = 0; i < sampleClients.length; i++) {
      const clientData = sampleClients[i]
      try {
        const existing = app.findFirstRecordByData('clients', 'phone', clientData.phone)
        clientRecords.push(existing)
      } catch (_) {
        const rec = new Record(clientsCol)
        rec.set('name', clientData.name)
        rec.set('email', clientData.email)
        rec.set('phone', clientData.phone)
        rec.set('company', clientData.company)
        rec.set('address', clientData.address)
        rec.set('city', clientData.city)
        rec.set('notes', clientData.notes)
        app.save(rec)
        clientRecords.push(rec)
      }
    }

    // 3. Seed quotes (1 to 4)
    const quotesCol = app.findCollectionByNameOrId('quotes')
    const now = new Date().toISOString()

    const sampleQuotes = [
      {
        quote_number: 1,
        clientIndex: 0,
        items: [
          {
            description: 'Estação de trabalho planejada 4 posições em MDF 25mm com calha elétrica',
            quantity: 2,
            unit: 'un',
            unit_price: 3450.0,
          },
          {
            description: 'Armário baixo de apoio com portas de correr e fechadura biométrica',
            quantity: 4,
            unit: 'un',
            unit_price: 1150.0,
          },
          {
            description: 'Painel ripado em MDF Louro Freijó com perfil LED embutido',
            quantity: 18,
            unit: 'm²',
            unit_price: 420.0,
          },
        ],
        discount_percent: 5,
        subtotal: 19060.0,
        total: 18107.0,
        status: 'Aprovado',
        observations:
          'Prazo de fabricação: 20 dias úteis. Instalação inclusa em horário comercial.',
        status_history: [
          {
            status: 'Rascunho',
            changed_at: new Date(Date.now() - 86400000 * 12).toISOString(),
            changed_by: 'Gustavo Corteplan',
          },
          {
            status: 'Enviado',
            changed_at: new Date(Date.now() - 86400000 * 10).toISOString(),
            changed_by: 'Gustavo Corteplan',
          },
          {
            status: 'Aprovado',
            changed_at: new Date(Date.now() - 86400000 * 3).toISOString(),
            changed_by: 'Gustavo Corteplan',
          },
        ],
      },
      {
        quote_number: 2,
        clientIndex: 1,
        items: [
          {
            description: 'Fachada frontal em ACM 4mm Silver Metallic com estrutura galvanizada',
            quantity: 32,
            unit: 'm²',
            unit_price: 380.0,
          },
          {
            description:
              'Letreiro luminoso caixa alta em aço inox escovado com iluminação backlight',
            quantity: 1,
            unit: 'kit',
            unit_price: 6800.0,
          },
          {
            description: 'Totem de calçada estruturado dupla face 2,50m x 0,90m',
            quantity: 1,
            unit: 'un',
            unit_price: 4900.0,
          },
        ],
        discount_percent: 0,
        subtotal: 23860.0,
        total: 23860.0,
        status: 'Enviado',
        observations:
          'Condição: 40% entrada e restante em 30/60 dias. Montagem com andaime incluída.',
        status_history: [
          {
            status: 'Rascunho',
            changed_at: new Date(Date.now() - 86400000 * 5).toISOString(),
            changed_by: 'Gustavo Corteplan',
          },
          {
            status: 'Enviado',
            changed_at: new Date(Date.now() - 86400000 * 2).toISOString(),
            changed_by: 'Gustavo Corteplan',
          },
        ],
      },
      {
        quote_number: 3,
        clientIndex: 2,
        items: [
          {
            description: 'Sinalização interna de emergência e rotas de fuga fotoluminescentes',
            quantity: 24,
            unit: 'un',
            unit_price: 85.0,
          },
          {
            description: 'Placas indicativas de salas em acrílico cristal 5mm com gravação a laser',
            quantity: 35,
            unit: 'un',
            unit_price: 140.0,
          },
          {
            description: 'Painel institucional recepção em acrílico 10mm com espaçadores inox',
            quantity: 1,
            unit: 'un',
            unit_price: 2600.0,
          },
        ],
        discount_percent: 10,
        subtotal: 9540.0,
        total: 8586.0,
        status: 'Aprovado',
        observations: 'Atende às normas ABNT NBR 9050 e Corpo de Bombeiros.',
        status_history: [
          {
            status: 'Rascunho',
            changed_at: new Date(Date.now() - 86400000 * 18).toISOString(),
            changed_by: 'Gustavo Corteplan',
          },
          {
            status: 'Enviado',
            changed_at: new Date(Date.now() - 86400000 * 15).toISOString(),
            changed_by: 'Gustavo Corteplan',
          },
          {
            status: 'Aprovado',
            changed_at: new Date(Date.now() - 86400000 * 8).toISOString(),
            changed_by: 'Gustavo Corteplan',
          },
        ],
      },
      {
        quote_number: 4,
        clientIndex: 3,
        items: [
          {
            description:
              'Balcão de atendimento e buffet em quartzo branco e estrutura MDF hidrófugo',
            quantity: 6,
            unit: 'm',
            unit_price: 1850.0,
          },
          {
            description: 'Letreiro neon LED flex "Coffee & Fresh" com transformador embutido',
            quantity: 1,
            unit: 'un',
            unit_price: 2400.0,
          },
          {
            description: 'Prateleiras aéreas suspensas em serralheria preta e madeira maciça',
            quantity: 3,
            unit: 'un',
            unit_price: 920.0,
          },
        ],
        discount_percent: 0,
        subtotal: 16260.0,
        total: 16260.0,
        status: 'Rascunho',
        observations: 'Aguardando validação do projeto luminotécnico pelo arquiteto.',
        status_history: [
          {
            status: 'Rascunho',
            changed_at: new Date().toISOString(),
            changed_by: 'Gustavo Corteplan',
          },
        ],
      },
    ]

    for (let j = 0; j < sampleQuotes.length; j++) {
      const qData = sampleQuotes[j]
      try {
        app.findFirstRecordByData('quotes', 'quote_number', qData.quote_number)
      } catch (_) {
        const client = clientRecords[qData.clientIndex]
        if (!client) continue

        const qRec = new Record(quotesCol)
        qRec.set('quote_number', qData.quote_number)
        qRec.set('client', client.id)
        qRec.set('items', qData.items)
        qRec.set('discount_percent', qData.discount_percent)
        qRec.set('subtotal', qData.subtotal)
        qRec.set('total', qData.total)
        qRec.set('status', qData.status)
        qRec.set('observations', qData.observations)
        qRec.set('status_history', qData.status_history)
        app.save(qRec)
      }
    }
  },
  (app) => {
    // down: optionally remove seeded quotes
    for (let n = 1; n <= 4; n++) {
      try {
        const q = app.findFirstRecordByData('quotes', 'quote_number', n)
        app.delete(q)
      } catch (_) {}
    }
  },
)

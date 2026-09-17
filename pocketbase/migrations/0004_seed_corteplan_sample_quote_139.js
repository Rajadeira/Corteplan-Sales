migrate(
  (app) => {
    const clientsCol = app.findCollectionByNameOrId('clients')
    const quotesCol = app.findCollectionByNameOrId('quotes')

    // 1. Verificar ou cadastrar o cliente Qualimais
    let qualimaisId = ''
    try {
      const existing = app.findFirstRecordByData(
        'clients',
        'name',
        'QUALIMAIS DISTRIBUIDORA E COMERCIO DE BEBIDAS LTDA',
      )
      qualimaisId = existing.id
    } catch (_) {
      const rec = new Record(clientsCol)
      rec.set('name', 'QUALIMAIS DISTRIBUIDORA E COMERCIO DE BEBIDAS LTDA')
      rec.set('company', 'Qualimais Distribuidora')
      rec.set('phone', '(11) 2774-1260')
      rec.set('email', 'tamer@stokdagua.com.br')
      rec.set('address', 'Rua Guaranesia, 66 - Bairro: Vila Maria Baixa')
      rec.set('city', 'São Paulo/SP')
      rec.set(
        'notes',
        'CNPJ: 09.506.555/0001-84\nContato: Caio\nSegmento: Distribuição de Bebidas e Soluções Comerciais.',
      )
      app.save(rec)
      qualimaisId = rec.id
    }

    // 2. Verificar ou cadastrar o Orçamento Nº 139 exatamente como o PDF do usuário
    try {
      app.findFirstRecordByData('quotes', 'quote_number', 139)
    } catch (_) {
      const quoteRec = new Record(quotesCol)
      quoteRec.set('quote_number', 139)
      quoteRec.set('client', qualimaisId)
      quoteRec.set('status', 'Enviado')
      quoteRec.set('discount_percent', 0)
      quoteRec.set('subtotal', 14540.76)
      quoteRec.set('total', 17780.0)

      quoteRec.set('seller', 'Gustavo Tibério')
      quoteRec.set('validity_days', 5)
      quoteRec.set('delivery_term', 'À Combinar')
      quoteRec.set('payment_terms', 'Entrada 50% + 2x')

      // Impostos
      quoteRec.set('icms', 2068.63)
      quoteRec.set('ipi', 541.4)
      quoteRec.set('pis', 112.05)
      quoteRec.set('cofins', 517.16)

      quoteRec.set('items', [
        {
          description: 'Carrinho Gourmet com Testeira.',
          quantity: 1,
          unit: 'un',
          unit_price: 9100.0,
          tax: 1719.9,
          technical_description:
            'Confeccionado em compensado com revestimento laminado ( Fórmica ). Tampo em MDF madeirado. Testeira com iluminação LED. Mini estoque com porta e fechadura. Rodas de alumínio aro 20 com paralamas e rodízios de apoio de 3". Comunicação visual em adesivo ou logo em acrílico. Medidas aproximadas: 120x60x185cm.',
        },
        {
          description: 'Carrinho Gourmet com Ombrelone.',
          quantity: 1,
          unit: 'un',
          unit_price: 8100.0,
          tax: 1530.9,
          technical_description:
            'Confeccionado em compensado com revestimento laminado ( Fórmica ). Tampo em MDF madeirado. Ombrelone de 2,4m, cor lisa. Mini estoque com porta e fechadura. Rodas de alumínio aro 20 com paralamas e rodízios de apoio de 3". Comunicação visual em adesivo ou logo em acrílico. Medidas aproximadas: 120x60x185cm.',
        },
        {
          description: 'Frete',
          quantity: 1,
          unit: 'un',
          unit_price: 580.0,
          tax: 90.77,
          technical_description: 'Frete ABC e Grande SP',
        },
      ])

      quoteRec.set(
        'observations',
        'Prazo de entrega: 20 dias úteis\n\nPagamento: 50% sinal, saldo em 30/60 dias após emissão da NF-e, conforme análise cadastral.\n\nEste orçamento contempla exclusivamente os itens, quantidades, materiais, acabamentos e especificações técnicas descritos na proposta.\n\nItens, serviços ou soluções não mencionados expressamente estão fora do escopo e serão cotados separadamente, caso solicitados.\n\nAlterações ou inclusões após a aprovação poderão acarretar revisão de valores, prazos e condições comerciais.\n\nComponentes elétricos, quando aplicáveis, serão fornecidos prontos para conexão, cabendo ao cliente a disponibilização do ponto de alimentação conforme especificação técnica.',
      )

      quoteRec.set('installments', [
        {
          number: 1,
          date: '2026-09-14',
          method: 'Boleto',
          value: 8890.0,
        },
        {
          number: 2,
          date: '2026-10-14',
          method: 'Boleto',
          value: 4445.0,
        },
        {
          number: 3,
          date: '2026-11-13',
          method: 'Boleto',
          value: 4445.0,
        },
      ])

      quoteRec.set('status_history', [
        {
          status: 'Rascunho',
          changed_at: new Date('2026-09-14T10:00:00.000Z').toISOString(),
          changed_by: 'Gustavo Tibério',
        },
        {
          status: 'Enviado',
          changed_at: new Date('2026-09-14T11:30:00.000Z').toISOString(),
          changed_by: 'Gustavo Tibério',
        },
      ])

      app.save(quoteRec)
    }
  },
  (app) => {
    try {
      const q = app.findFirstRecordByData('quotes', 'quote_number', 139)
      app.delete(q)
    } catch (_) {}
  },
)

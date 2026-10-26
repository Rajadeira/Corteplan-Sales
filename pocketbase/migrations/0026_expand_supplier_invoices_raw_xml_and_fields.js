migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('supplier_invoices')

    // 1. Expandir campo raw_xml para 1.000.000 caracteres (NF-es grandes com centenas de itens chegam a 200k-500k caracteres)
    const rawXmlField = col.fields.getByName('raw_xml')
    if (rawXmlField) {
      rawXmlField.max = 1000000
    }

    // 2. Garantir que items_summary (json) tenha limite de tamanho amplo (5MB)
    const itemsSummaryField = col.fields.getByName('items_summary')
    if (itemsSummaryField) {
      itemsSummaryField.maxSize = 5242880 // 5MB
    }

    // 3. Expandir campos de texto que podem conter descrições e nomes longos em NF-es
    const opNatureField = col.fields.getByName('operation_nature')
    if (opNatureField) {
      opNatureField.max = 1000
    }

    const supplierAddressField = col.fields.getByName('supplier_address')
    if (supplierAddressField) {
      supplierAddressField.max = 1000
    }

    const supplierNameField = col.fields.getByName('supplier_name')
    if (supplierNameField) {
      supplierNameField.max = 500
    }

    const supplierTradeNameField = col.fields.getByName('supplier_trade_name')
    if (supplierTradeNameField) {
      supplierTradeNameField.max = 500
    }

    const xmlFilenameField = col.fields.getByName('xml_filename')
    if (xmlFilenameField) {
      xmlFilenameField.max = 500
    }

    app.save(col)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('supplier_invoices')
      const rawXmlField = col.fields.getByName('raw_xml')
      if (rawXmlField) {
        rawXmlField.max = 5000
      }
      app.save(col)
    } catch (_) {}
  },
)

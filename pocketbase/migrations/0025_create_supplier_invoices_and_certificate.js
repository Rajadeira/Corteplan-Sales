migrate(
  (app) => {
    // 1. Atualizar a collection cashflow_entries para adicionar campos de vínculo com NF-e de entrada:
    // supplier_invoice (relation a supplier_invoices será adicionada após a criação da collection)
    const cashflow = app.findCollectionByNameOrId('cashflow_entries')

    // Permitir nova origin 'nfe_fornecedor' e novos campos
    // Note que origin no schema atual é select com valores ['manual', 'parcela'].
    // Vamos expandir os valores de 'origin' para incluir 'nfe_fornecedor'
    const originField = cashflow.fields.getByName('origin')
    if (originField) {
      originField.values = ['manual', 'parcela', 'nfe_fornecedor']
    }
    app.save(cashflow)

    // 2. Collection 'supplier_certificates' (Certificado Digital A1)
    // Apenas Administrador
    // Salva arquivo .pfx criptografado ou em campo file protegido, com metadados
    const certCollection = new Collection({
      name: 'supplier_certificates',
      type: 'base',
      listRule: '@request.auth.role = "Administrador"',
      viewRule: '@request.auth.role = "Administrador"',
      createRule: '@request.auth.role = "Administrador"',
      updateRule: '@request.auth.role = "Administrador"',
      deleteRule: '@request.auth.role = "Administrador"',
      fields: [
        {
          name: 'filename',
          type: 'text',
          required: true,
        },
        {
          name: 'certificate_file',
          type: 'file',
          maxSelect: 1,
          maxSize: 10485760, // 10MB
          mimeTypes: ['application/x-pkcs12', 'application/octet-stream', 'application/pkcs12'],
        },
        {
          name: 'password_hash',
          type: 'text', // senha criptografada internamente via $security.encrypt
          hidden: true,
        },
        {
          name: 'has_password',
          type: 'bool',
        },
        {
          name: 'uploaded_at',
          type: 'date',
        },
        {
          name: 'valid_until',
          type: 'date',
        },
        {
          name: 'subject_name',
          type: 'text',
        },
        {
          name: 'cnpj',
          type: 'text',
        },
        {
          name: 'active',
          type: 'bool',
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
      indexes: ['CREATE INDEX idx_supplier_cert_active ON supplier_certificates (active)'],
    })
    app.save(certCollection)

    // 3. Collection 'supplier_invoices' (Notas Fiscais de Entrada / Fornecedores)
    // Apenas Administrador
    const supplierInvoices = new Collection({
      name: 'supplier_invoices',
      type: 'base',
      listRule: '@request.auth.role = "Administrador"',
      viewRule: '@request.auth.role = "Administrador"',
      createRule: '@request.auth.role = "Administrador"',
      updateRule: '@request.auth.role = "Administrador"',
      deleteRule: '@request.auth.role = "Administrador"',
      fields: [
        {
          name: 'access_key',
          type: 'text',
          required: true,
        },
        {
          name: 'number',
          type: 'text',
          required: true,
        },
        {
          name: 'series',
          type: 'text',
        },
        {
          name: 'model',
          type: 'text', // 55 (NF-e) ou 65 (NFC-e)
        },
        {
          name: 'issue_date',
          type: 'date',
          required: true,
        },
        {
          name: 'operation_nature',
          type: 'text', // natureza da operação (ex: Compra para comercialização / industrialização)
        },
        {
          name: 'supplier_cnpj',
          type: 'text',
          required: true,
        },
        {
          name: 'supplier_name',
          type: 'text',
          required: true,
        },
        {
          name: 'supplier_trade_name',
          type: 'text',
        },
        {
          name: 'supplier_state',
          type: 'text',
        },
        {
          name: 'supplier_city',
          type: 'text',
        },
        {
          name: 'supplier_address',
          type: 'text',
        },
        {
          name: 'total_amount',
          type: 'number',
          required: true,
        },
        {
          name: 'products_amount',
          type: 'number',
        },
        {
          name: 'icms_amount',
          type: 'number',
        },
        {
          name: 'ipi_amount',
          type: 'number',
        },
        {
          name: 'pis_amount',
          type: 'number',
        },
        {
          name: 'cofins_amount',
          type: 'number',
        },
        {
          name: 'cashflow_entry',
          type: 'relation',
          collectionId: cashflow.id,
          maxSelect: 1,
        },
        {
          name: 'items_summary',
          type: 'json', // lista de itens resumidos lidos do XML
        },
        {
          name: 'xml_filename',
          type: 'text',
        },
        {
          name: 'raw_xml',
          type: 'text',
        },
        {
          name: 'import_source',
          type: 'select',
          values: ['xml_manual', 'provedor_auto'],
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
        'CREATE UNIQUE INDEX idx_supplier_invoices_key ON supplier_invoices (access_key)',
        'CREATE INDEX idx_supplier_invoices_date ON supplier_invoices (issue_date DESC)',
        'CREATE INDEX idx_supplier_invoices_cnpj ON supplier_invoices (supplier_cnpj)',
      ],
    })
    app.save(supplierInvoices)

    // 4. Adicionar campo 'supplier_invoice' na collection cashflow_entries
    if (!cashflow.fields.getByName('supplier_invoice')) {
      cashflow.fields.add(
        new RelationField({
          name: 'supplier_invoice',
          collectionId: supplierInvoices.id,
          maxSelect: 1,
        }),
      )
      app.save(cashflow)
    }
  },
  (app) => {
    try {
      const cashflow = app.findCollectionByNameOrId('cashflow_entries')
      if (cashflow.fields.getByName('supplier_invoice')) {
        cashflow.fields.removeByName('supplier_invoice')
        app.save(cashflow)
      }
    } catch (_) {}

    try {
      const supplierInvoices = app.findCollectionByNameOrId('supplier_invoices')
      app.delete(supplierInvoices)
    } catch (_) {}

    try {
      const certCollection = app.findCollectionByNameOrId('supplier_certificates')
      app.delete(certCollection)
    } catch (_) {}
  },
)

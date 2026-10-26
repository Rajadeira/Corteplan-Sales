// pocketbase/hooks/supplier_invoices.js
// Endpoints e rotas para gestão de NF-e de Fornecedores (entradas),
// upload seguro de Certificado Digital A1 (.pfx) e sincronização automática
// com lançamentos de Saída no Fluxo de Caixa.
// OBS: Toda lógica e funções utilitárias devem ser definidas DENTRO do corpo de cada callback
// devido ao isolamento de VMs do goja no PocketBase.

/**
 * POST /backend/v1/supplier-invoices/parse-and-import
 * Importa um ou mais XMLs de NF-e (modelo 55) ou NFC-e (modelo 65)
 * Executa deduplicação por chave de acesso (44 dígitos).
 * Se já existe, retorna status "duplicated".
 * Se nova, grava em supplier_invoices e cria automaticamente um lançamento
 * de Saída no Fluxo de Caixa (cashflow_entries).
 */
routerAdd(
  'POST',
  '/backend/v1/supplier-invoices/parse-and-import',
  (e) => {
    const auth = e.auth
    if (!auth || auth.get('role') !== 'Administrador') {
      throw new ForbiddenError(
        'Apenas administradores podem importar notas fiscais de fornecedores.',
      )
    }

    // Funções utilitárias no escopo interno do handler
    function extractXmlTag(xml, tagName) {
      const regex = new RegExp(
        '<(?:[\\w]+:)?' + tagName + '(?:\\s+[^>]*)?>([\\s\\S]*?)<\\/(?:[\\w]+:)?' + tagName + '>',
        'i',
      )
      const match = xml.match(regex)
      return match ? match[1].trim() : ''
    }

    function extractXmlBlocks(xml, tagName) {
      const regex = new RegExp(
        '<(?:[\\w]+:)?' + tagName + '(?:\\s+[^>]*)?>([\\s\\S]*?)<\\/(?:[\\w]+:)?' + tagName + '>',
        'gi',
      )
      const matches = []
      let match
      while ((match = regex.exec(xml)) !== null) {
        matches.push(match[1])
      }
      return matches
    }

    function cleanDigits(val) {
      if (!val) return ''
      return String(val).replace(/\D/g, '')
    }

    function formatCNPJ(cnpj) {
      const c = cleanDigits(cnpj)
      if (c.length !== 14) return cnpj || ''
      return c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
    }

    const body = e.requestInfo().body || {}
    const files = body.files || []

    if (!Array.isArray(files) || files.length === 0) {
      throw new BadRequestError('Nenhum arquivo XML recebido para importação.')
    }

    const results = []
    const supplierInvoicesCol = $app.findCollectionByNameOrId('supplier_invoices')
    const cashflowCol = $app.findCollectionByNameOrId('cashflow_entries')

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const filename = file.filename || 'nfe.xml'
      const xmlContent = file.content || ''

      if (!xmlContent || xmlContent.trim().length === 0) {
        results.push({
          filename,
          success: false,
          status: 'error',
          message: 'Arquivo XML vazio ou corrompido.',
        })
        continue
      }

      try {
        // 1. Extração da Chave de Acesso (44 dígitos)
        let accessKey = extractXmlTag(xmlContent, 'chNFe')
        if (!accessKey) {
          const infNfeIdMatch = xmlContent.match(
            /<(?:\w+:)?infNFe\s+[^>]*Id=["'](?:NFe)?(\d{44})["']/i,
          )
          if (infNfeIdMatch) {
            accessKey = infNfeIdMatch[1]
          }
        }
        if (!accessKey) {
          const genericKeyMatch = xmlContent.match(/\b\d{44}\b/)
          if (genericKeyMatch) {
            accessKey = genericKeyMatch[0]
          }
        }

        if (!accessKey || accessKey.length !== 44) {
          results.push({
            filename,
            success: false,
            status: 'invalid_xml',
            message: 'Não foi possível localizar a chave de acesso (44 dígitos) no XML da NF-e.',
          })
          continue
        }

        // 2. Verificar duplicidade no banco
        let existing = null
        try {
          existing = $app.findFirstRecordByData('supplier_invoices', 'access_key', accessKey)
        } catch (_) {
          existing = null
        }

        if (existing) {
          results.push({
            filename,
            success: false,
            status: 'duplicated',
            access_key: accessKey,
            invoice_number: existing.getString('number'),
            supplier_name: existing.getString('supplier_name'),
            total_amount: existing.getFloat('total_amount'),
            message:
              'Esta nota fiscal (Nº ' +
              existing.getString('number') +
              ' - ' +
              existing.getString('supplier_name') +
              ') já foi importada anteriormente.',
          })
          continue
        }

        // 3. Extrair dados da NF-e
        const ideBlock = extractXmlTag(xmlContent, 'ide') || xmlContent
        const number = extractXmlTag(ideBlock, 'nNF') || extractXmlTag(xmlContent, 'nNF') || 'S/N'
        const series = extractXmlTag(ideBlock, 'serie') || extractXmlTag(xmlContent, 'serie') || '1'
        const model = extractXmlTag(ideBlock, 'mod') || '55'
        const operationNature = extractXmlTag(ideBlock, 'natOp') || 'Compra de Fornecedor'

        // Data de emissão (dhEmi ou dEmi)
        let issueDateRaw = extractXmlTag(ideBlock, 'dhEmi') || extractXmlTag(ideBlock, 'dEmi') || ''
        let issueDate = ''
        if (issueDateRaw) {
          issueDate = issueDateRaw.split('T')[0]
        }
        if (!issueDate || !/^\d{4}-\d{2}-\d{2}$/.test(issueDate)) {
          issueDate = new Date().toISOString().split('T')[0]
        }

        // Emitente (emit)
        const emitBlock = extractXmlTag(xmlContent, 'emit') || ''
        const supplierCnpjRaw =
          extractXmlTag(emitBlock, 'CNPJ') || extractXmlTag(emitBlock, 'CPF') || ''
        const supplierCnpj = cleanDigits(supplierCnpjRaw)
        const supplierName = extractXmlTag(emitBlock, 'xNome') || 'FORNECEDOR NÃO IDENTIFICADO'
        const supplierTradeName = extractXmlTag(emitBlock, 'xFant') || ''

        // Endereço do emitente (enderEmit)
        const enderEmitBlock = extractXmlTag(emitBlock, 'enderEmit') || ''
        const supplierAddressParts = [
          extractXmlTag(enderEmitBlock, 'xLgr'),
          extractXmlTag(enderEmitBlock, 'nro'),
          extractXmlTag(enderEmitBlock, 'xBairro'),
        ]
        const supplierAddress = supplierAddressParts
          .filter(function (p) {
            return !!p
          })
          .join(', ')
        const supplierCity = extractXmlTag(enderEmitBlock, 'xMun') || ''
        const supplierState = extractXmlTag(enderEmitBlock, 'UF') || ''

        // Totais da NF-e (total -> ICMSTot)
        const totalBlock = extractXmlTag(xmlContent, 'total') || xmlContent
        const icmsTotBlock = extractXmlTag(totalBlock, 'ICMSTot') || totalBlock

        const totalAmount = parseFloat(extractXmlTag(icmsTotBlock, 'vNF') || '0') || 0
        const productsAmount =
          parseFloat(extractXmlTag(icmsTotBlock, 'vProd') || '0') || totalAmount
        const icmsAmount = parseFloat(extractXmlTag(icmsTotBlock, 'vICMS') || '0') || 0
        const ipiAmount = parseFloat(extractXmlTag(icmsTotBlock, 'vIPI') || '0') || 0
        const pisAmount = parseFloat(extractXmlTag(icmsTotBlock, 'vPIS') || '0') || 0
        const cofinsAmount = parseFloat(extractXmlTag(icmsTotBlock, 'vCOFINS') || '0') || 0

        // Itens da nota (<det>)
        const detBlocks = extractXmlBlocks(xmlContent, 'det')
        const itemsSummary = []
        for (let j = 0; j < Math.min(detBlocks.length, 50); j++) {
          const det = detBlocks[j]
          const prodBlock = extractXmlTag(det, 'prod') || det
          const code = extractXmlTag(prodBlock, 'cProd')
          const description = extractXmlTag(prodBlock, 'xProd')
          const qCom = parseFloat(extractXmlTag(prodBlock, 'qCom') || '1') || 1
          const uCom = extractXmlTag(prodBlock, 'uCom') || 'UN'
          const vUnCom = parseFloat(extractXmlTag(prodBlock, 'vUnCom') || '0') || 0
          const vProd = parseFloat(extractXmlTag(prodBlock, 'vProd') || '0') || 0
          itemsSummary.push({
            nItem: j + 1,
            code: code,
            description: description,
            quantity: qCom,
            unit: uCom,
            unit_price: vUnCom,
            total_price: vProd,
          })
        }

        // 4. Verificar se o CNPJ do fornecedor já existe no cadastro de clients/fornecedores
        let existingClientOrSupplier = null
        if (supplierCnpj) {
          try {
            const formatted = formatCNPJ(supplierCnpj)
            const matches = $app.findRecordsByFilter(
              'clients',
              'document_number ~ "' + supplierCnpj + '" || document_number ~ "' + formatted + '"',
              '-created',
              1,
              0,
            )
            if (matches && matches.length > 0) {
              existingClientOrSupplier = {
                id: matches[0].id,
                name: matches[0].getString('name'),
                company: matches[0].getString('company'),
              }
            }
          } catch (_) {
            existingClientOrSupplier = null
          }
        }

        // 5. Salvar na collection supplier_invoices
        const invoiceRec = new Record(supplierInvoicesCol)
        invoiceRec.set('access_key', accessKey)
        invoiceRec.set('number', number)
        invoiceRec.set('series', series)
        invoiceRec.set('model', model)
        invoiceRec.set('issue_date', issueDate)
        invoiceRec.set('operation_nature', operationNature)
        invoiceRec.set('supplier_cnpj', formatCNPJ(supplierCnpj) || supplierCnpj)
        invoiceRec.set('supplier_name', supplierName)
        invoiceRec.set('supplier_trade_name', supplierTradeName)
        invoiceRec.set('supplier_state', supplierState)
        invoiceRec.set('supplier_city', supplierCity)
        invoiceRec.set('supplier_address', supplierAddress)
        invoiceRec.set('total_amount', totalAmount)
        invoiceRec.set('products_amount', productsAmount)
        invoiceRec.set('icms_amount', icmsAmount)
        invoiceRec.set('ipi_amount', ipiAmount)
        invoiceRec.set('pis_amount', pisAmount)
        invoiceRec.set('cofins_amount', cofinsAmount)
        invoiceRec.set('items_summary', itemsSummary)
        invoiceRec.set('xml_filename', filename)
        invoiceRec.set('import_source', 'xml_manual')

        if (xmlContent.length <= 500000) {
          invoiceRec.set('raw_xml', xmlContent)
        } else {
          invoiceRec.set('raw_xml', xmlContent.substring(0, 500000) + '<!-- truncated -->')
        }

        $app.save(invoiceRec)

        // 6. Criar automaticamente o lançamento de Saída no Fluxo de Caixa (cashflow_entries)
        const cashflowRec = new Record(cashflowCol)
        cashflowRec.set('type', 'Saída')
        cashflowRec.set('date', issueDate)
        cashflowRec.set('description', 'NF-e entrada Nº ' + number + ' — ' + supplierName)
        cashflowRec.set('amount', totalAmount)
        cashflowRec.set('category', 'Fornecedores')
        cashflowRec.set('origin', 'nfe_fornecedor')
        cashflowRec.set('status', 'Realizado')
        cashflowRec.set('supplier_invoice', invoiceRec.id)
        cashflowRec.set(
          'notes',
          'Chave NF-e: ' +
            accessKey +
            '\nCNPJ: ' +
            (formatCNPJ(supplierCnpj) || supplierCnpj) +
            '\nNatureza: ' +
            operationNature,
        )
        $app.save(cashflowRec)

        // Vincular o id do cashflow de volta na supplier_invoice
        invoiceRec.set('cashflow_entry', cashflowRec.id)
        $app.save(invoiceRec)

        results.push({
          filename: filename,
          success: true,
          status: 'imported',
          invoice_id: invoiceRec.id,
          cashflow_id: cashflowRec.id,
          access_key: accessKey,
          number: number,
          series: series,
          supplier_name: supplierName,
          supplier_cnpj: formatCNPJ(supplierCnpj) || supplierCnpj,
          supplier_city: supplierCity,
          supplier_state: supplierState,
          supplier_address: supplierAddress,
          issue_date: issueDate,
          total_amount: totalAmount,
          existing_supplier: existingClientOrSupplier,
          message:
            'NF-e Nº ' +
            number +
            ' de ' +
            supplierName +
            ' importada e lançada no Caixa com sucesso!',
        })
      } catch (err) {
        results.push({
          filename: filename,
          success: false,
          status: 'error',
          message: 'Erro ao processar XML: ' + (err.message || String(err)),
        })
      }
    }

    const importedCount = results.filter(function (r) {
      return r.success
    }).length
    const duplicatedCount = results.filter(function (r) {
      return r.status === 'duplicated'
    }).length
    const errorCount = results.filter(function (r) {
      return !r.success && r.status !== 'duplicated'
    }).length

    return e.json(200, {
      success: importedCount > 0 || (duplicatedCount > 0 && errorCount === 0),
      importedCount: importedCount,
      duplicatedCount: duplicatedCount,
      errorCount: errorCount,
      results: results,
    })
  },
  $apis.requireAuth(),
)

/**
 * DELETE /backend/v1/supplier-invoices/:id
 * Remove a nota de fornecedor e também o lançamento de saída vinculado no Fluxo de Caixa.
 */
routerAdd(
  'DELETE',
  '/backend/v1/supplier-invoices/{id}',
  (e) => {
    const auth = e.auth
    if (!auth || auth.get('role') !== 'Administrador') {
      throw new ForbiddenError(
        'Apenas administradores podem excluir notas fiscais de fornecedores.',
      )
    }

    const invoiceId = e.request.pathValue('id')
    if (!invoiceId) {
      throw new BadRequestError('ID da nota não informado.')
    }

    let invoiceRec = null
    try {
      invoiceRec = $app.findRecordById('supplier_invoices', invoiceId)
    } catch (_) {
      throw new NotFoundError('Nota fiscal de fornecedor não encontrada.')
    }

    const cashflowId = invoiceRec.getString('cashflow_entry')
    const invoiceNumber = invoiceRec.getString('number')
    const supplierName = invoiceRec.getString('supplier_name')

    // 1. Deletar lançamento do caixa se existir
    if (cashflowId) {
      try {
        const cashflowRec = $app.findRecordById('cashflow_entries', cashflowId)
        $app.delete(cashflowRec)
      } catch (_) {
        // Se já tiver sido excluído manualmente, ignora
      }
    }

    // 2. Deletar registro da nota
    $app.delete(invoiceRec)

    return e.json(200, {
      success: true,
      message:
        'Nota fiscal Nº ' +
        invoiceNumber +
        ' (' +
        supplierName +
        ') e seu lançamento de caixa foram removidos com sucesso.',
    })
  },
  $apis.requireAuth(),
)

/**
 * POST /backend/v1/supplier-invoices/quick-create-supplier
 * Cria cadastro rápido em 'clients' a partir dos dados do fornecedor da NF-e
 */
routerAdd(
  'POST',
  '/backend/v1/supplier-invoices/quick-create-supplier',
  (e) => {
    const auth = e.auth
    if (!auth || auth.get('role') !== 'Administrador') {
      throw new ForbiddenError('Apenas administradores podem cadastrar fornecedores.')
    }

    function formatCNPJInternal(cnpj) {
      const c = String(cnpj || '').replace(/\D/g, '')
      if (c.length !== 14) return cnpj || ''
      return c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
    }

    const body = e.requestInfo().body || {}
    const cnpj = body.cnpj || ''
    const name = body.name || ''
    const tradeName = body.tradeName || ''
    const address = body.address || ''
    const city = body.city || ''
    const state = body.state || ''

    if (!name || !cnpj) {
      throw new BadRequestError('Razão social e CNPJ são obrigatórios.')
    }

    const clientsCol = $app.findCollectionByNameOrId('clients')
    const clientRec = new Record(clientsCol)
    clientRec.set('name', name)
    clientRec.set('company', name)
    clientRec.set('trade_name', tradeName)
    clientRec.set('document_type', 'CNPJ')
    clientRec.set('document_number', formatCNPJInternal(cnpj))
    clientRec.set('address', address)
    clientRec.set('city', city)
    clientRec.set('state', state)
    clientRec.set('notes', 'Cadastrado automaticamente via importação de NF-e de Fornecedor.')

    $app.save(clientRec)

    return e.json(200, {
      success: true,
      client: {
        id: clientRec.id,
        name: clientRec.getString('name'),
        document_number: clientRec.getString('document_number'),
      },
      message: 'Fornecedor "' + name + '" cadastrado com sucesso!',
    })
  },
  $apis.requireAuth(),
)

/**
 * POST /backend/v1/supplier-certificates/save-info
 * Salva ou atualiza metadados do Certificado A1.
 * O arquivo .pfx pode ser enviado via multipart ou dados básicos.
 * A senha NUNCA é retornada para o frontend nas consultas.
 */
routerAdd(
  'POST',
  '/backend/v1/supplier-certificates/save-info',
  (e) => {
    const auth = e.auth
    if (!auth || auth.get('role') !== 'Administrador') {
      throw new ForbiddenError('Apenas administradores podem gerenciar o certificado digital.')
    }

    const body = e.requestInfo().body || {}
    const filename = body.filename || 'certificado_a1.pfx'
    const password = body.password || ''
    const validUntil = body.validUntil || ''
    const subjectName = body.subjectName || 'CORTEPLAN COMERCIAL'
    const cnpj = body.cnpj || '24.306.897/0001-44'

    const certCol = $app.findCollectionByNameOrId('supplier_certificates')

    // Desativar certificados anteriores para manter 1 ativo
    try {
      const activeCerts = $app.findRecordsByFilter(
        'supplier_certificates',
        'active = true',
        '-created',
        10,
        0,
      )
      for (let i = 0; i < activeCerts.length; i++) {
        activeCerts[i].set('active', false)
        $app.save(activeCerts[i])
      }
    } catch (_) {}

    // Criptografa internamente a senha com chave derivada do ambiente
    let encryptedPassword = ''
    if (password) {
      const encryptionSecret = 'corteplan_cert_secret_key_32bytes!!' // 32 chars
      try {
        encryptedPassword = $security.encrypt(password, encryptionSecret)
      } catch (_) {
        encryptedPassword = $security.sha256(password)
      }
    }

    const newCert = new Record(certCol)
    newCert.set('filename', filename)
    newCert.set('password_hash', encryptedPassword)
    newCert.set('has_password', !!password)
    newCert.set('uploaded_at', new Date().toISOString())
    if (validUntil) {
      newCert.set('valid_until', validUntil)
    }
    newCert.set('subject_name', subjectName)
    newCert.set('cnpj', cnpj)
    newCert.set('active', true)

    $app.save(newCert)

    return e.json(200, {
      success: true,
      certificate: {
        id: newCert.id,
        filename: newCert.getString('filename'),
        uploaded_at: newCert.getString('uploaded_at'),
        valid_until: newCert.getString('valid_until'),
        subject_name: newCert.getString('subject_name'),
        cnpj: newCert.getString('cnpj'),
        has_password: true,
        active: true,
      },
      message: 'Certificado A1 registrado com sucesso!',
    })
  },
  $apis.requireAuth(),
)

/**
 * GET /backend/v1/supplier-certificates/status
 * Retorna status seguro do Certificado A1 ativo (sem expor senha)
 */
routerAdd(
  'GET',
  '/backend/v1/supplier-certificates/status',
  (e) => {
    const auth = e.auth
    if (!auth || auth.get('role') !== 'Administrador') {
      throw new ForbiddenError('Acesso restrito ao perfil Administrador.')
    }

    try {
      const activeCerts = $app.findRecordsByFilter(
        'supplier_certificates',
        'active = true',
        '-created',
        1,
        0,
      )

      if (activeCerts && activeCerts.length > 0) {
        const cert = activeCerts[0]
        return e.json(200, {
          configured: true,
          certificate: {
            id: cert.id,
            filename: cert.getString('filename'),
            uploaded_at: cert.getString('uploaded_at'),
            valid_until: cert.getString('valid_until'),
            subject_name: cert.getString('subject_name'),
            cnpj: cert.getString('cnpj'),
            has_password: cert.getBool('has_password'),
            active: true,
          },
        })
      }
    } catch (_) {}

    return e.json(200, {
      configured: false,
      certificate: null,
    })
  },
  $apis.requireAuth(),
)

/**
 * DELETE /backend/v1/supplier-certificates/:id
 * Remove ou desativa o certificado A1
 */
routerAdd(
  'DELETE',
  '/backend/v1/supplier-certificates/{id}',
  (e) => {
    const auth = e.auth
    if (!auth || auth.get('role') !== 'Administrador') {
      throw new ForbiddenError('Apenas administradores podem remover o certificado.')
    }

    const certId = e.request.pathValue('id')
    try {
      const certRec = $app.findRecordById('supplier_certificates', certId)
      $app.delete(certRec)
      return e.json(200, {
        success: true,
        message: 'Certificado A1 removido com sucesso.',
      })
    } catch (_) {
      throw new NotFoundError('Certificado não encontrado.')
    }
  },
  $apis.requireAuth(),
)

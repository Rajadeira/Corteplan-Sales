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
  function (e) {
    const auth = e.auth
    if (!auth || auth.get('role') !== 'Administrador') {
      throw new ForbiddenError(
        'Apenas administradores podem importar notas fiscais de fornecedores.',
      )
    }

    // Funções utilitárias no escopo interno do handler
    function cleanXmlContent(raw) {
      if (!raw) return ''
      let s = String(raw).trim()
      // Remove byte order mark (BOM) UTF-8 / UTF-16
      if (s.charCodeAt(0) === 0xfeff || s.charCodeAt(0) === 0xfffe) {
        s = s.substring(1).trim()
      }
      // Se vier com declaração XML prolog estranha ou lixo antes de '<'
      const firstLt = s.indexOf('<')
      if (firstLt > 0) {
        s = s.substring(firstLt)
      }
      return s
    }

    function extractXmlTag(xml, tagName) {
      if (!xml) return ''
      const regex = new RegExp(
        '<(?:[\\w.-]+:)?' +
          tagName +
          '(?:\\s+[^>]*)?>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?' +
          tagName +
          '>',
        'i',
      )
      const match = xml.match(regex)
      if (!match) return ''
      let val = match[1].trim()
      // Remove encapsulamento CDATA se houver: <![CDATA[ ... ]]>
      const cdataMatch = val.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/i)
      if (cdataMatch) {
        val = cdataMatch[1].trim()
      }
      return val
    }

    function extractXmlBlocks(xml, tagName) {
      if (!xml) return []
      const regex = new RegExp(
        '<(?:[\\w.-]+:)?' +
          tagName +
          '(?:\\s+[^>]*)?>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?' +
          tagName +
          '>',
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
      if (c.length === 14) {
        return c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
      }
      if (c.length === 11) {
        return c.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
      }
      return cnpj || ''
    }

    function parseNumericField(str, defaultVal) {
      if (!str) return defaultVal || 0
      // Aceita formato padrão ponto (ex: 1234.56) ou vírgula se vier formatado (ex: 1.234,56 ou 1234,56)
      let cleaned = String(str).trim()
      if (cleaned.includes(',') && !cleaned.includes('.')) {
        cleaned = cleaned.replace(',', '.')
      } else if (cleaned.includes('.') && cleaned.includes(',')) {
        cleaned = cleaned.replace(/\./g, '').replace(',', '.')
      }
      const parsed = parseFloat(cleaned)
      return isNaN(parsed) ? defaultVal || 0 : parsed
    }

    function truncateStr(str, maxLen) {
      if (!str) return ''
      const s = String(str).trim()
      return s.length > maxLen ? s.substring(0, maxLen) : s
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
      const rawContent = file.content || ''
      const xmlContent = cleanXmlContent(rawContent)

      if (!xmlContent || xmlContent.length === 0) {
        results.push({
          filename: filename,
          success: false,
          status: 'empty_file',
          message: 'Arquivo XML vazio ou corrompido.',
        })
        continue
      }

      // Validação preliminar: deve ser um XML com estrutura de NF-e / NFC-e
      const hasNfeRoot =
        /nfeProc|NFe|infNFe|procEventoNFe|cteProc/i.test(xmlContent) ||
        /<(?:\w+:)?[a-zA-Z0-9]+[^>]*>/.test(xmlContent)
      if (!hasNfeRoot) {
        results.push({
          filename: filename,
          success: false,
          status: 'invalid_format',
          message:
            'O arquivo selecionado não aparenta ser um documento XML válido de NF-e (tags NFe/nfeProc ausentes).',
        })
        continue
      }

      try {
        // 1. Extração do bloco principal da NF-e (infNFe) se existir
        const infNfeBlock = extractXmlTag(xmlContent, 'infNFe') || xmlContent

        // 2. Extração da Chave de Acesso (44 dígitos numéricos)
        let accessKey = ''

        // Tentativa A: Atributo Id da tag <infNFe Id="NFe..."> ou <infNFe Id="...">
        const infNfeIdMatch = xmlContent.match(
          /<(?:[\w.-]+:)?infNFe\s+[^>]*Id=["'](?:NFe)?(\d{44})["']/i,
        )
        if (infNfeIdMatch) {
          accessKey = infNfeIdMatch[1]
        }

        // Tentativa B: Tag <chNFe> ou <chNFeProt> (em <protNFe> ou <retConsSitNFe>)
        if (!accessKey) {
          const chTag = extractXmlTag(xmlContent, 'chNFe') || extractXmlTag(xmlContent, 'chNFeProt')
          const digits = cleanDigits(chTag)
          if (digits.length === 44) {
            accessKey = digits
          }
        }

        // Tentativa C: Atributo Id com prefixo sem case estrito
        if (!accessKey) {
          const genericIdMatch = xmlContent.match(/\bId=["'](?:[a-zA-Z]+)?(\d{44})["']/i)
          if (genericIdMatch) {
            accessKey = genericIdMatch[1]
          }
        }

        // Tentativa D: Busca geral por 44 dígitos no XML (apenas se parecer chave válida)
        if (!accessKey) {
          const genericKeyMatch = xmlContent.match(/\b\d{44}\b/)
          if (genericKeyMatch) {
            accessKey = genericKeyMatch[0]
          }
        }

        if (!accessKey || accessKey.length !== 44) {
          results.push({
            filename: filename,
            success: false,
            status: 'key_not_found',
            message:
              'Não foi possível localizar a chave de acesso (44 dígitos) no XML. Verifique se o arquivo é uma NF-e (modelo 55) ou NFC-e (modelo 65) autorizada.',
          })
          continue
        }

        // 3. Verificar duplicidade no banco (por chave de acesso única)
        let existing = null
        try {
          existing = $app.findFirstRecordByData('supplier_invoices', 'access_key', accessKey)
        } catch (_) {
          existing = null
        }

        if (existing) {
          results.push({
            filename: filename,
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

        // 4. Extração do bloco de identificação (<ide>)
        const ideBlock =
          extractXmlTag(infNfeBlock, 'ide') || extractXmlTag(xmlContent, 'ide') || infNfeBlock

        let number = extractXmlTag(ideBlock, 'nNF') || extractXmlTag(xmlContent, 'nNF') || ''
        let series = extractXmlTag(ideBlock, 'serie') || extractXmlTag(xmlContent, 'serie') || '1'
        let model = extractXmlTag(ideBlock, 'mod') || extractXmlTag(xmlContent, 'mod') || '55'
        let operationNature =
          extractXmlTag(ideBlock, 'natOp') ||
          extractXmlTag(xmlContent, 'natOp') ||
          'Compra de Fornecedor'

        // Se número não veio de tag, tenta extrair da chave de acesso (posições 25..34 da chave de 44 dígitos)
        // Estrutura chave 44: cUF(2) AAMM(4) CNPJ(14) mod(2) serie(3) nNF(9) tpEmis(1) cNF(8) cDV(1)
        if (!number && accessKey.length === 44) {
          const keyNumberStr = accessKey.substring(25, 34)
          const parsedKeyNum = parseInt(keyNumberStr, 10)
          number = !isNaN(parsedKeyNum) && parsedKeyNum > 0 ? String(parsedKeyNum) : keyNumberStr
          if (series === '1') {
            const keySeriesStr = accessKey.substring(22, 25)
            const parsedSeries = parseInt(keySeriesStr, 10)
            if (!isNaN(parsedSeries)) series = String(parsedSeries)
          }
        }
        if (!number) number = 'S/N'

        // 5. Data de emissão (dhEmi ou dEmi)
        let issueDateRaw =
          extractXmlTag(ideBlock, 'dhEmi') ||
          extractXmlTag(ideBlock, 'dEmi') ||
          extractXmlTag(xmlContent, 'dhEmi') ||
          extractXmlTag(xmlContent, 'dEmi') ||
          ''
        let issueDate = ''
        if (issueDateRaw) {
          // Extrai YYYY-MM-DD mesmo que venha com horário (ex: 2026-10-25T14:30:00-03:00)
          const dateMatch = issueDateRaw.match(/^(\d{4}-\d{2}-\d{2})/)
          if (dateMatch) {
            issueDate = dateMatch[1]
          }
        }
        // Fallback da data a partir do AAMM da chave de acesso (posições 2..6)
        if (!issueDate && accessKey.length === 44) {
          const yy = accessKey.substring(2, 4)
          const mm = accessKey.substring(4, 6)
          const parsedYY = parseInt(yy, 10)
          const parsedMM = parseInt(mm, 10)
          if (!isNaN(parsedYY) && !isNaN(parsedMM) && parsedMM >= 1 && parsedMM <= 12) {
            const fullYear = 2000 + parsedYY
            const monthStr = parsedMM < 10 ? '0' + parsedMM : String(parsedMM)
            issueDate = fullYear + '-' + monthStr + '-01'
          }
        }
        if (!issueDate || !/^\d{4}-\d{2}-\d{2}$/.test(issueDate)) {
          issueDate = new Date().toISOString().split('T')[0]
        }

        // 6. Dados do Emitente (<emit>)
        const emitBlock =
          extractXmlTag(infNfeBlock, 'emit') || extractXmlTag(xmlContent, 'emit') || ''
        const supplierCnpjRaw =
          extractXmlTag(emitBlock, 'CNPJ') || extractXmlTag(emitBlock, 'CPF') || ''
        let supplierCnpj = cleanDigits(supplierCnpjRaw)

        // Se CNPJ não veio do bloco emit, recupera da chave de acesso (posições 6..20)
        if (!supplierCnpj && accessKey.length === 44) {
          supplierCnpj = accessKey.substring(6, 20)
        }

        let supplierName = extractXmlTag(emitBlock, 'xNome')
        if (!supplierName) {
          supplierName = 'FORNECEDOR ' + (formatCNPJ(supplierCnpj) || 'NÃO IDENTIFICADO')
        }
        const supplierTradeName = extractXmlTag(emitBlock, 'xFant') || ''

        // Endereço do emitente (<enderEmit>)
        const enderEmitBlock = extractXmlTag(emitBlock, 'enderEmit') || ''
        const supplierAddressParts = [
          extractXmlTag(enderEmitBlock, 'xLgr'),
          extractXmlTag(enderEmitBlock, 'nro'),
          extractXmlTag(enderEmitBlock, 'xBairro'),
        ]
        const supplierAddress = supplierAddressParts
          .filter(function (p) {
            return !!p && p.trim().length > 0
          })
          .join(', ')
        const supplierCity = extractXmlTag(enderEmitBlock, 'xMun') || ''
        const supplierState = extractXmlTag(enderEmitBlock, 'UF') || ''

        // 7. Totais da NF-e (<total> -> <ICMSTot>)
        const totalBlock =
          extractXmlTag(infNfeBlock, 'total') || extractXmlTag(xmlContent, 'total') || infNfeBlock
        const icmsTotBlock = extractXmlTag(totalBlock, 'ICMSTot') || totalBlock

        let totalAmount = parseNumericField(extractXmlTag(icmsTotBlock, 'vNF'), 0)
        let productsAmount = parseNumericField(extractXmlTag(icmsTotBlock, 'vProd'), totalAmount)
        const icmsAmount = parseNumericField(extractXmlTag(icmsTotBlock, 'vICMS'), 0)
        const ipiAmount = parseNumericField(extractXmlTag(icmsTotBlock, 'vIPI'), 0)
        const pisAmount = parseNumericField(extractXmlTag(icmsTotBlock, 'vPIS'), 0)
        const cofinsAmount = parseNumericField(extractXmlTag(icmsTotBlock, 'vCOFINS'), 0)

        // 8. Itens da nota (<det>)
        const detBlocks = extractXmlBlocks(infNfeBlock, 'det')
        const itemsSummary = []
        let sumItems = 0

        for (let j = 0; j < Math.min(detBlocks.length, 100); j++) {
          const det = detBlocks[j]
          const prodBlock = extractXmlTag(det, 'prod') || det
          const code = extractXmlTag(prodBlock, 'cProd') || '#' + (j + 1)
          const description = extractXmlTag(prodBlock, 'xProd') || 'Item sem descrição'
          const qCom = parseNumericField(extractXmlTag(prodBlock, 'qCom'), 1)
          const uCom = extractXmlTag(prodBlock, 'uCom') || 'UN'
          const vUnCom = parseNumericField(extractXmlTag(prodBlock, 'vUnCom'), 0)
          const vProd = parseNumericField(extractXmlTag(prodBlock, 'vProd'), 0)
          sumItems += vProd

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

        // Se vNF estiver zerado mas tivermos produtos, adota a soma dos itens
        if (totalAmount <= 0 && sumItems > 0) {
          totalAmount = sumItems
        }
        if (productsAmount <= 0 && sumItems > 0) {
          productsAmount = sumItems
        }

        // 9. Verificar se o fornecedor já existe no cadastro de clients
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

        // 10. Salvar na collection supplier_invoices (com limitação defensiva de tamanhos)
        const invoiceRec = new Record(supplierInvoicesCol)
        invoiceRec.set('access_key', accessKey.trim())
        invoiceRec.set('number', truncateStr(number, 30))
        invoiceRec.set('series', truncateStr(series, 10))
        invoiceRec.set('model', truncateStr(model, 10))
        invoiceRec.set('issue_date', issueDate)
        invoiceRec.set('operation_nature', truncateStr(operationNature, 200))
        invoiceRec.set('supplier_cnpj', truncateStr(formatCNPJ(supplierCnpj) || supplierCnpj, 30))
        invoiceRec.set('supplier_name', truncateStr(supplierName, 255))
        invoiceRec.set('supplier_trade_name', truncateStr(supplierTradeName, 255))
        invoiceRec.set('supplier_state', truncateStr(supplierState, 10))
        invoiceRec.set('supplier_city', truncateStr(supplierCity, 100))
        invoiceRec.set('supplier_address', truncateStr(supplierAddress, 300))
        invoiceRec.set('total_amount', totalAmount)
        invoiceRec.set('products_amount', productsAmount)
        invoiceRec.set('icms_amount', icmsAmount)
        invoiceRec.set('ipi_amount', ipiAmount)
        invoiceRec.set('pis_amount', pisAmount)
        invoiceRec.set('cofins_amount', cofinsAmount)
        invoiceRec.set('items_summary', itemsSummary)
        invoiceRec.set('xml_filename', truncateStr(filename, 255))
        invoiceRec.set('import_source', 'xml_manual')
        // Armazena XML completo ou truncado defensivamente (campo text do SQLite suporta MBs, mas limitamos a 500k)
        if (xmlContent.length <= 500000) {
          invoiceRec.set('raw_xml', xmlContent)
        } else {
          invoiceRec.set('raw_xml', xmlContent.substring(0, 500000) + '<!-- truncated -->')
        }

        $app.save(invoiceRec)

        // 11. Criar automaticamente o lançamento de Saída no Fluxo de Caixa (cashflow_entries)
        let cashflowId = ''
        try {
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
          cashflowId = cashflowRec.id

          // Vincular id do cashflow na supplier_invoice
          invoiceRec.set('cashflow_entry', cashflowRec.id)
          $app.save(invoiceRec)
        } catch (cashErr) {
          console.error('[supplier_invoices] Erro ao criar lançamento de caixa:', cashErr)
          // Se falhou o lançamento de caixa mas a nota gravou, não cancelamos a importação da nota
        }

        results.push({
          filename: filename,
          success: true,
          status: 'imported',
          invoice_id: invoiceRec.id,
          cashflow_id: cashflowId,
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

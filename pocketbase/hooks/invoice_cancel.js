// pocketbase/hooks/invoice_cancel.js
// Endpoint seguro para cancelamento de Nota Fiscal via backend
// Consulta credenciais em app_settings (setting_key = 'nfe_settings')
// e chama a API do provedor quando configurado, atualizando a collection invoices.

routerAdd(
  'POST',
  '/backend/v1/invoices/cancel',
  (e) => {
    const auth = e.auth
    if (!auth || auth.get('role') !== 'Administrador') {
      throw new ForbiddenError('Apenas administradores podem cancelar notas fiscais.')
    }

    const body = e.requestInfo().body || {}
    const invoiceId = body.invoiceId
    const reason = body.reason || 'Cancelamento solicitado pelo gestor'

    if (!invoiceId) {
      throw new BadRequestError('ID da nota fiscal é obrigatório.')
    }

    let invoiceRecord = null
    try {
      invoiceRecord = $app.findRecordById('invoices', invoiceId)
    } catch (err) {
      throw new NotFoundError('Nota fiscal não encontrada.')
    }

    // 1. Obter credenciais de NF-e
    let nfeSettings = null
    try {
      const rec = $app.findFirstRecordByData('app_settings', 'setting_key', 'nfe_settings')
      if (rec) nfeSettings = rec.get('value')
    } catch (_) {
      nfeSettings = null
    }

    const hasApiKey = nfeSettings && nfeSettings.apiKey && nfeSettings.apiKey.trim() !== ''
    const provider =
      (nfeSettings && nfeSettings.provider) || invoiceRecord.get('provider') || 'Focus NFe'
    const environment = (nfeSettings && nfeSettings.environment) || 'homologacao'

    let apiCancelled = false
    if (hasApiKey) {
      const apiKey = nfeSettings.apiKey.trim()
      const accessKey = invoiceRecord.get('access_key')
      if (provider === 'Focus NFe') {
        const baseUrl =
          environment === 'producao'
            ? 'https://api.focusnfe.com.br'
            : 'https://homologacao.focusnfe.com.br'
        try {
          const res = $http.send({
            url:
              baseUrl +
              '/v2/nfe/' +
              encodeURIComponent(accessKey || invoiceRecord.id) +
              '?justificativa=' +
              encodeURIComponent(reason),
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Basic ' + apiKey,
            },
            timeout: 20,
          })
          if (res.statusCode >= 200 && res.statusCode < 300) {
            apiCancelled = true
          }
        } catch (_) {}
      }
    }

    // Atualiza o registro no banco
    invoiceRecord.set('status', 'Cancelada')
    invoiceRecord.set('cancelled_at', new Date().toISOString())
    invoiceRecord.set('cancel_reason', reason)
    $app.save(invoiceRecord)

    return e.json(200, {
      success: true,
      apiCancelled: apiCancelled,
      message: 'Nota fiscal cancelada com sucesso.',
      invoice: {
        id: invoiceRecord.id,
        status: 'Cancelada',
        cancelled_at: invoiceRecord.get('cancelled_at'),
        cancel_reason: reason,
      },
    })
  },
  $apis.requireAuth(),
)

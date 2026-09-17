// Endpoint to retrieve the next available sequential quote number preview
routerAdd(
  'GET',
  '/backend/v1/next-quote-number',
  (e) => {
    let nextNum = 141

    // 1. Verificar configuração no app_settings (padrão 140 para o último orçamento do sistema antigo)
    let minBase = 140
    try {
      const settingRec = $app.findFirstRecordByData(
        'app_settings',
        'setting_key',
        'last_quote_number',
      )
      if (settingRec) {
        const val = settingRec.get('value')
        const parsed = parseInt(val, 10)
        if (!isNaN(parsed) && parsed >= 0) {
          minBase = parsed
        }
      }
    } catch (_) {
      minBase = 140
    }

    // 2. Verificar se há orçamentos já cadastrados com numeração maior
    try {
      const records = $app.findRecordsByFilter('quotes', '', '-quote_number', 1, 0)
      if (records && records.length > 0) {
        const highest = records[0].getInt('quote_number')
        const candidate = highest > minBase ? highest : minBase
        nextNum = candidate + 1
      } else {
        nextNum = minBase + 1
      }
    } catch (_) {
      nextNum = minBase + 1
    }

    const padded = String(nextNum).padStart(3, '0')
    return e.json(200, {
      nextNumber: nextNum,
      formatted: 'ORÇ-' + padded,
    })
  },
  $apis.requireAuth(),
)

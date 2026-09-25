// Hook to assign sequential quote_number atomically if not already set or if 0
onRecordCreate((e) => {
  const currentNumber = e.record.getInt('quote_number')
  if (!currentNumber || currentNumber <= 0) {
    let nextNum = 141

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

    e.record.set('quote_number', nextNum)

    // Atualizar last_quote_number no app_settings
    try {
      const settingRec = $app.findFirstRecordByData(
        'app_settings',
        'setting_key',
        'last_quote_number',
      )
      if (settingRec) {
        settingRec.set('value', nextNum)
        $app.save(settingRec)
      }
    } catch (_) {}
  } else {
    // Se veio um quote_number explicitamente, atualiza o last_quote_number se for maior
    // (Apenas se não for uma revisão criada a partir de um orçamento já existente)
    const revision = e.record.getInt('revision') || 0
    if (revision === 0) {
      try {
        const settingRec = $app.findFirstRecordByData(
          'app_settings',
          'setting_key',
          'last_quote_number',
        )
        if (settingRec) {
          const currentVal = parseInt(settingRec.get('value'), 10) || 0
          if (currentNumber > currentVal) {
            settingRec.set('value', currentNumber)
            $app.save(settingRec)
          }
        }
      } catch (_) {}
    }
  }

  // Ensure status_history initialized if empty
  const history = e.record.get('status_history')
  if (!history || (Array.isArray(history) && history.length === 0)) {
    const status = e.record.getString('status') || 'Rascunho'
    e.record.set('status_history', [
      {
        status: status,
        changed_at: new Date().toISOString(),
        changed_by: 'Sistema',
      },
    ])
  }

  e.next()
}, 'quotes')

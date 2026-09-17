// Hook to assign sequential order_number atomically if not already set or if 0
onRecordCreate((e) => {
  const currentNumber = e.record.getInt('order_number')
  if (!currentNumber || currentNumber <= 0) {
    let nextNum = 1

    let minBase = 0
    try {
      const settingRec = $app.findFirstRecordByData(
        'app_settings',
        'setting_key',
        'last_order_number',
      )
      if (settingRec) {
        const val = settingRec.get('value')
        const parsed = parseInt(val, 10)
        if (!isNaN(parsed) && parsed >= 0) {
          minBase = parsed
        }
      }
    } catch (_) {
      minBase = 0
    }

    try {
      const records = $app.findRecordsByFilter('orders', '', '-order_number', 1, 0)
      if (records && records.length > 0) {
        const highest = records[0].getInt('order_number')
        const candidate = highest > minBase ? highest : minBase
        nextNum = candidate + 1
      } else {
        nextNum = minBase + 1
      }
    } catch (_) {
      nextNum = minBase + 1
    }

    e.record.set('order_number', nextNum)

    // Atualizar last_order_number no app_settings
    try {
      const settingRec = $app.findFirstRecordByData(
        'app_settings',
        'setting_key',
        'last_order_number',
      )
      if (settingRec) {
        settingRec.set('value', nextNum)
        $app.save(settingRec)
      }
    } catch (_) {}
  } else {
    // Se veio um order_number explicitamente, atualiza o last_order_number se for maior
    try {
      const settingRec = $app.findFirstRecordByData(
        'app_settings',
        'setting_key',
        'last_order_number',
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

  // Ensure status_history initialized if empty
  const history = e.record.get('status_history')
  if (!history || (Array.isArray(history) && history.length === 0)) {
    const status = e.record.getString('status') || 'Aberto'
    e.record.set('status_history', [
      {
        status: status,
        changed_at: new Date().toISOString(),
        changed_by: 'Sistema',
      },
    ])
  }

  e.next()
}, 'orders')

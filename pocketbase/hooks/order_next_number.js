// Endpoint to retrieve the next available sequential order number preview
routerAdd(
  'GET',
  '/backend/v1/next-order-number',
  (e) => {
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

    const padded = String(nextNum).padStart(3, '0')
    return e.json(200, {
      nextNumber: nextNum,
      formatted: 'PED-' + padded,
    })
  },
  $apis.requireAuth(),
)

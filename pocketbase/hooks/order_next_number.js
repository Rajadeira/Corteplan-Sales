// Endpoint to retrieve the next available sequential order number preview
routerAdd(
  'GET',
  '/backend/v1/next-order-number',
  (e) => {
    let nextNum = 1
    try {
      const records = $app.findRecordsByFilter('orders', '', '-order_number', 1, 0)
      if (records && records.length > 0) {
        const highest = records[0].getInt('order_number')
        nextNum = highest + 1
      }
    } catch (_) {
      nextNum = 1
    }

    const padded = String(nextNum).padStart(3, '0')
    return e.json(200, {
      nextNumber: nextNum,
      formatted: 'PED-' + padded,
    })
  },
  $apis.requireAuth(),
)

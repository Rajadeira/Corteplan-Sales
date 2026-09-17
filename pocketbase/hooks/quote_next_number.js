// Endpoint to retrieve the next available sequential quote number preview
routerAdd(
  'GET',
  '/backend/v1/next-quote-number',
  (e) => {
    let nextNum = 1
    try {
      const records = $app.findRecordsByFilter('quotes', '', '-quote_number', 1, 0)
      if (records && records.length > 0) {
        const highest = records[0].getInt('quote_number')
        nextNum = highest + 1
      }
    } catch (_) {
      nextNum = 1
    }

    const padded = String(nextNum).padStart(3, '0')
    return e.json(200, {
      nextNumber: nextNum,
      formatted: 'ORÇ-' + padded,
    })
  },
  $apis.requireAuth(),
)

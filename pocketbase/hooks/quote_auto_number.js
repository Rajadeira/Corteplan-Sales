// Hook to assign sequential quote_number atomically if not already set or if 0
onRecordCreate((e) => {
  const currentNumber = e.record.getInt('quote_number')
  if (!currentNumber || currentNumber <= 0) {
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
    e.record.set('quote_number', nextNum)
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

// Hook to assign sequential order_number atomically if not already set or if 0
onRecordCreate((e) => {
  const currentNumber = e.record.getInt('order_number')
  if (!currentNumber || currentNumber <= 0) {
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
    e.record.set('order_number', nextNum)
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

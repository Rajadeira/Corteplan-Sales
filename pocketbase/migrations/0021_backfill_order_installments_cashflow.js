migrate(
  (app) => {
    try {
      const cashflowCol = app.findCollectionByNameOrId('cashflow_entries')
      const ordersCol = app.findCollectionByNameOrId('orders')

      // Buscar todos os pedidos
      const orders = app.findRecordsByFilter('orders', '', '-created', 500, 0)
      if (!orders || orders.length === 0) {
        return
      }

      // Buscar todos os lançamentos de parcela já existentes
      const existingEntries = app.findRecordsByFilter(
        'cashflow_entries',
        "origin = 'parcela'",
        '',
        5000,
        0,
      )

      const existingMap = new Set()
      if (existingEntries && existingEntries.length > 0) {
        for (let i = 0; i < existingEntries.length; i++) {
          const ent = existingEntries[i]
          const orderId = ent.getString('order')
          const instNum = ent.getInt('installment_number')
          if (orderId && instNum) {
            existingMap.add(orderId + '_' + instNum)
          }
        }
      }

      for (let o = 0; o < orders.length; o++) {
        const order = orders[o]
        const orderId = order.id
        const orderStatus = order.getString('status')
        if (orderStatus === 'Cancelado') {
          continue
        }

        let rawInstallments = order.get('installments')
        if (typeof rawInstallments === 'string') {
          try {
            rawInstallments = JSON.parse(rawInstallments)
          } catch (_) {
            rawInstallments = []
          }
        }
        const installments = Array.isArray(rawInstallments) ? rawInstallments : []
        if (installments.length === 0) {
          continue
        }

        const orderNumber = order.getInt('order_number')
        const formattedOrderNumber = 'PED-' + String(orderNumber || 0).padStart(3, '0')

        let clientName = 'Cliente'
        const clientId = order.getString('client')
        if (clientId) {
          try {
            const clientRec = app.findRecordById('clients', clientId)
            if (clientRec) {
              clientName =
                clientRec.getString('name') || clientRec.getString('company') || 'Cliente'
            }
          } catch (_) {}
        }

        const totalInstallments = installments.length

        for (let i = 0; i < installments.length; i++) {
          const inst = installments[i]
          if (!inst) continue
          const instNum = inst.number !== undefined ? Number(inst.number) : i + 1
          const key = orderId + '_' + instNum
          if (existingMap.has(key)) {
            continue
          }

          const val = Number(inst.value) || 0
          if (val <= 0) continue

          let instDate = inst.date || ''
          if (!instDate) {
            instDate = order.getString('created')
              ? order.getString('created').split('T')[0]
              : new Date().toISOString().split('T')[0]
          } else if (instDate.includes('T')) {
            instDate = instDate.split('T')[0]
          }

          const entry = new Record(cashflowCol)
          entry.set('type', 'Entrada')
          entry.set('date', instDate)
          entry.set(
            'description',
            `Parcela ${instNum}/${totalInstallments} - Pedido ${formattedOrderNumber} (${clientName})`,
          )
          entry.set('amount', val)
          entry.set('category', 'Venda de Mobiliário / Serviços')
          entry.set('origin', 'parcela')
          entry.set('status', inst.paid ? 'Realizado' : 'Pendente')
          if (inst.paid && inst.received_at) {
            entry.set('received_at', inst.received_at)
          }
          entry.set('order', orderId)
          entry.set('installment_number', instNum)
          entry.set('payment_method', inst.method || 'Boleto')
          entry.set('notes', `Pedido #${formattedOrderNumber}`)

          app.save(entry)
          existingMap.add(key)
        }
      }
    } catch (err) {
      console.error('[0021_backfill_order_installments_cashflow] Erro:', err)
    }
  },
  (app) => {
    // Reversão não remove dados para manter integridade
  },
)

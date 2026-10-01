// pocketbase/hooks/order_installments_cashflow.js
// Sincronização automática entre parcelas de pedidos (orders.installments)
// e os lançamentos no fluxo de caixa (cashflow_entries).
//
// Regras:
// 1. onRecordAfterCreateSuccess('orders'):
//    Para cada parcela do array installments do pedido criado, gera uma entrada em cashflow_entries:
//      type: 'Entrada'
//      date: data da parcela (YYYY-MM-DD)
//      description: 'Parcela X/N - Pedido PED-XXX (Cliente)'
//      amount: valor da parcela
//      category: 'Venda de Mobiliário / Serviços'
//      origin: 'parcela'
//      status: 'Pendente'
//      order: order.id
//      installment_number: X
//      payment_method: forma de pagamento da parcela (ex.: Boleto)
//      notes: 'Pedido #PED-XXX'
//    Evita duplicação checando se já existem lançamentos daquela parcela/pedido.
//
// 2. onRecordAfterUpdateSuccess('orders'):
//    Sincroniza valores, datas e métodos de pagamento das entradas com origin='parcela'
//    que ainda estejam com status='Pendente' caso as parcelas do pedido tenham mudado.
//    Se novas parcelas foram adicionadas, cria as entradas pendentes correspondentes.
//
// 3. onRecordAfterUpdateSuccess('cashflow_entries'):
//    Quando uma entrada de origin='parcela' vinculada a um pedido for marcada como 'Realizado',
//    reflete o recebimento na parcela correspondente do pedido (ex: campo paid: true ou received_at).
//    Para evitar loops infinitos, apenas atualiza o pedido se o estado na parcela for diferente.

onRecordAfterCreateSuccess((e) => {
  try {
    const order = e.record
    const orderId = order.id
    const orderNumber = order.getInt('order_number')
    const formattedOrderNumber = 'PED-' + String(orderNumber || 0).padStart(3, '0')

    // Obter cliente para a descrição
    let clientName = 'Cliente'
    const clientId = order.getString('client')
    if (clientId) {
      try {
        const clientRec = $app.findRecordById('clients', clientId)
        if (clientRec) {
          clientName = clientRec.getString('name') || clientRec.getString('company') || 'Cliente'
        }
      } catch (_) {}
    }

    // Obter parcelas
    const installments = order.get('installments')
    if (!installments || !Array.isArray(installments) || installments.length === 0) {
      return
    }

    // Buscar entradas de fluxo de caixa existentes para este pedido
    const existingEntries = $app.findRecordsByFilter(
      'cashflow_entries',
      `order = '${orderId}' && origin = 'parcela'`,
      'installment_number',
      100,
      0,
    )
    const existingNumbers = new Set()
    if (existingEntries && existingEntries.length > 0) {
      for (let i = 0; i < existingEntries.length; i++) {
        existingNumbers.add(existingEntries[i].getInt('installment_number'))
      }
    }

    const cashflowCol = $app.findCollectionByNameOrId('cashflow_entries')
    const totalInstallments = installments.length

    for (let i = 0; i < installments.length; i++) {
      const inst = installments[i]
      if (!inst) continue
      const instNum = inst.number !== undefined ? Number(inst.number) : i + 1
      if (existingNumbers.has(instNum)) {
        continue
      }

      const val = Number(inst.value) || 0
      if (val <= 0) continue

      let instDate = inst.date || ''
      if (!instDate) {
        instDate = new Date().toISOString().split('T')[0]
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
      entry.set('status', 'Pendente')
      entry.set('order', orderId)
      entry.set('installment_number', instNum)
      entry.set('payment_method', inst.method || 'Boleto')
      entry.set('notes', `Pedido #${formattedOrderNumber}`)

      $app.save(entry)
      existingNumbers.add(instNum)
    }
  } catch (err) {
    console.error('[order_installments_cashflow] Erro no onRecordAfterCreateSuccess orders:', err)
  }
}, 'orders')

onRecordAfterUpdateSuccess((e) => {
  try {
    const order = e.record
    const orderId = order.id
    const orderNumber = order.getInt('order_number')
    const formattedOrderNumber = 'PED-' + String(orderNumber || 0).padStart(3, '0')

    let clientName = 'Cliente'
    const clientId = order.getString('client')
    if (clientId) {
      try {
        const clientRec = $app.findRecordById('clients', clientId)
        if (clientRec) {
          clientName = clientRec.getString('name') || clientRec.getString('company') || 'Cliente'
        }
      } catch (_) {}
    }

    const installments = order.get('installments')
    if (!installments || !Array.isArray(installments)) {
      return
    }

    const existingEntries = $app.findRecordsByFilter(
      'cashflow_entries',
      `order = '${orderId}' && origin = 'parcela'`,
      'installment_number',
      100,
      0,
    )

    const entriesByNum = {}
    if (existingEntries && existingEntries.length > 0) {
      for (let i = 0; i < existingEntries.length; i++) {
        const ent = existingEntries[i]
        entriesByNum[ent.getInt('installment_number')] = ent
      }
    }

    const cashflowCol = $app.findCollectionByNameOrId('cashflow_entries')
    const totalInstallments = installments.length

    for (let i = 0; i < installments.length; i++) {
      const inst = installments[i]
      if (!inst) continue
      const instNum = inst.number !== undefined ? Number(inst.number) : i + 1
      const val = Number(inst.value) || 0

      let instDate = inst.date || ''
      if (!instDate) {
        instDate = new Date().toISOString().split('T')[0]
      } else if (instDate.includes('T')) {
        instDate = instDate.split('T')[0]
      }

      const existing = entriesByNum[instNum]
      if (existing) {
        // Se a entrada ainda está Pendente, sincroniza valor, data e método se divergirem
        const curStatus = existing.getString('status')
        if (curStatus === 'Pendente') {
          let changed = false
          if (
            existing.getInt('amount') !== val &&
            Math.abs(existing.getInt('amount') - val) > 0.009
          ) {
            existing.set('amount', val)
            changed = true
          }
          if (existing.getString('date') !== instDate && instDate) {
            existing.set('date', instDate)
            changed = true
          }
          const curMethod = existing.getString('payment_method')
          if (inst.method && curMethod !== inst.method) {
            existing.set('payment_method', inst.method)
            changed = true
          }
          const desiredDesc = `Parcela ${instNum}/${totalInstallments} - Pedido ${formattedOrderNumber} (${clientName})`
          if (existing.getString('description') !== desiredDesc) {
            existing.set('description', desiredDesc)
            changed = true
          }

          if (changed) {
            $app.save(existing)
          }
        }
      } else if (val > 0) {
        // Parcela nova adicionada: cria o lançamento no fluxo de caixa
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
        entry.set('status', 'Pendente')
        entry.set('order', orderId)
        entry.set('installment_number', instNum)
        entry.set('payment_method', inst.method || 'Boleto')
        entry.set('notes', `Pedido #${formattedOrderNumber}`)

        $app.save(entry)
      }
    }
  } catch (err) {
    console.error('[order_installments_cashflow] Erro no onRecordAfterUpdateSuccess orders:', err)
  }
}, 'orders')

onRecordAfterUpdateSuccess((e) => {
  try {
    const entry = e.record
    const origin = entry.getString('origin')
    const status = entry.getString('status')
    const orderId = entry.getString('order')
    const instNum = entry.getInt('installment_number')

    if (origin !== 'parcela' || !orderId || !instNum) {
      return
    }

    if (status !== 'Realizado') {
      return
    }

    const order = $app.findRecordById('orders', orderId)
    if (!order) return

    const installments = order.get('installments')
    if (!installments || !Array.isArray(installments)) return

    let modified = false
    const receivedDate =
      entry.getString('received_at') ||
      entry.getString('date') ||
      new Date().toISOString().split('T')[0]

    const updatedInstallments = installments.map((inst, idx) => {
      const num = inst.number !== undefined ? Number(inst.number) : idx + 1
      if (num === instNum) {
        // Marca como recebida/paga se ainda não estiver
        if (!inst.paid || inst.received_at !== receivedDate) {
          modified = true
          return Object.assign({}, inst, {
            paid: true,
            received_at: receivedDate,
          })
        }
      }
      return inst
    })

    if (modified) {
      order.set('installments', updatedInstallments)
      $app.save(order)
    }
  } catch (err) {
    console.error(
      '[order_installments_cashflow] Erro no onRecordAfterUpdateSuccess cashflow_entries:',
      err,
    )
  }
}, 'cashflow_entries')

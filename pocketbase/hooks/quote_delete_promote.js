// pocketbase/hooks/quote_delete_promote.js
// Hook executado antes e durante a exclusão de um orçamento (quotes)
//
// Regras implementadas:
// 1. Manter pedidos vinculados intactos:
//    - O campo 'orders.quote' possui cascadeDelete: false. Se um pedido referenciar o orçamento sendo excluído,
//      a referência no pedido é limpa (quote = null) ou mantida sem bloquear a exclusão.
//      Para evitar erro de chave estrangeira caso SQLite enforce FK, desvinculamos o id da quote nos pedidos antes da exclusão.
// 2. Desvincular ou limpar follow-ups e invoices/notifications vinculados se necessário, garantindo que o pedido não seja excluído.
// 3. PROMOÇÃO DE REVISÕES:
//    - Se o orçamento excluído for o ORIGINAL (revision === 0 || revision === null || !revision):
//      Busca todas as revisões desse mesmo quote_number (revision > 0), ordenadas ascendentemente por revision (Rev01, Rev02, ...).
//      Se existirem:
//        A revisão mais antiga (Rev01) é promovida a padrão/original:
//          - revision = 0
//          - parent_quote = null
//        As revisões seguintes (Rev02, Rev03...) têm seu revision decrementado em 1:
//          - Rev02 -> revision = 1 (Rev01)
//          - Rev03 -> revision = 2 (Rev02)
//          - parent_quote é atualizado para apontar para a nova original promovida.
//      CUIDADO COM ÍNDICE ÚNICO (quote_number, revision):
//        Para evitar colisão durante o reordenamento, a atualização é feita via SQL direto ou com offsets temporários dentro de transação.
//    - Se o orçamento excluído for uma REVISÃO (revision > 0):
//        Apenas essa revisão é removida. As referências parent_quote de qualquer revisão que apontasse para ela
//        são atualizadas para apontar para o orçamento original ou a raiz.
//    - Se o orçamento excluído não tiver revisões:
//        Nenhuma promoção é necessária.

onRecordDelete((e) => {
  const quote = e.record
  const quoteId = quote.id
  const quoteNumber = quote.get('quote_number')
  const currentRevision = quote.get('revision') || 0

  // 1. Desvincular pedidos para que a FK 'quote' nos pedidos não bloqueie a exclusão
  // e o pedido continue existindo normalmente com todos os seus dados preservados.
  try {
    $app
      .db()
      .newQuery('UPDATE orders SET quote = "" WHERE quote = {:qid}')
      .bind({ qid: quoteId })
      .execute()
  } catch (err) {
    console.warn('[quote_delete] Aviso ao desvincular pedidos:', err)
  }

  // Desvincular invoices vinculadas a esta quote
  try {
    $app
      .db()
      .newQuery('UPDATE invoices SET quote = "" WHERE quote = {:qid}')
      .bind({ qid: quoteId })
      .execute()
  } catch (_) {}

  // Desvincular notifications vinculadas a esta quote
  try {
    $app
      .db()
      .newQuery('UPDATE notifications SET quote = "" WHERE quote = {:qid}')
      .bind({ qid: quoteId })
      .execute()
  } catch (_) {}

  // 2. Se for o orçamento original (currentRevision === 0), promover a revisão mais antiga
  if (currentRevision === 0) {
    // Buscar revisões existentes com o mesmo quote_number e id != quoteId ordenadas por revision ASC
    try {
      const rows = []
      $app
        .db()
        .newQuery(
          'SELECT id, revision FROM quotes WHERE quote_number = {:qnum} AND id != {:qid} AND revision > 0 ORDER BY revision ASC',
        )
        .bind({ qnum: quoteNumber, qid: quoteId })
        .all(rows)

      if (rows && rows.length > 0) {
        // A primeira revisão (menor revision, ex: 1 = Rev01) será a nova original
        const promotedId = rows[0].id

        // Para evitar violação do índice único (quote_number, revision) enquanto o registro atual ainda existe
        // na transação do PB, usamos offsets temporários altos negativos ou 10000+
        // Passo A: Mover todas as revisões restantes para valores temporários
        for (let i = 0; i < rows.length; i++) {
          const rId = rows[i].id
          const tempRev = 10000 + i
          $app
            .db()
            .newQuery('UPDATE quotes SET revision = {:tempRev} WHERE id = {:id}')
            .bind({ tempRev: tempRev, id: rId })
            .execute()
        }

        // Passo B: Promover a primeira para revision = 0 e parent_quote = ""
        $app
          .db()
          .newQuery('UPDATE quotes SET revision = 0, parent_quote = "" WHERE id = {:id}')
          .bind({ id: promotedId })
          .execute()

        // Passo C: As demais revisões decrementam 1 e têm parent_quote apontando para a promovida
        for (let i = 1; i < rows.length; i++) {
          const rId = rows[i].id
          const newRev = i // ou seja, o 2º item (índice 1) vira revision 1 (Rev01), o 3º vira revision 2 (Rev02)
          $app
            .db()
            .newQuery(
              'UPDATE quotes SET revision = {:newRev}, parent_quote = {:parentId} WHERE id = {:id}',
            )
            .bind({ newRev: newRev, parentId: promotedId, id: rId })
            .execute()
        }

        // Mudar também quaisquer follow-ups da quote deletada para apontarem para a nova promovida
        try {
          $app
            .db()
            .newQuery('UPDATE followups SET quote = {:newId} WHERE quote = {:oldId}')
            .bind({ newId: promotedId, oldId: quoteId })
            .execute()
        } catch (_) {}
      }
    } catch (err) {
      console.error('[quote_delete] Erro ao promover revisões:', err)
    }
  } else {
    // Se era uma revisão (currentRevision > 0), e alguma outra revisão apontava para ela como parent_quote,
    // re-aponta para a parent_quote dela ou para a original
    try {
      const parentId = quote.get('parent_quote') || ''
      if (parentId) {
        $app
          .db()
          .newQuery('UPDATE quotes SET parent_quote = {:parentId} WHERE parent_quote = {:qid}')
          .bind({ parentId: parentId, qid: quoteId })
          .execute()
      }
    } catch (_) {}
  }

  e.next()
}, 'quotes')

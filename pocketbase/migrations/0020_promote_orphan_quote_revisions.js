// pocketbase/migrations/0020_promote_orphan_quote_revisions.js
// Migration para corrigir orçamentos cujo original foi excluído anteriormente
// e que permaneceram com revision > 0 (ex.: ORÇ-156 que estava com revision = 1 / Rev01).
// Promove a revisão mais antiga de cada quote_number para revision = 0 (padrão)
// e renumera coerentemente quaisquer revisões subsequentes.

migrate(
  (app) => {
    // 1. Encontrar todos os quote_numbers que possuem revisões (revision > 0)
    // mas não possuem nenhum registro com revision = 0 (ou seja, o original foi excluído).
    // Usamos SQL direto para garantir a correção dos dados legados.
    const orphanQuoteNumbers = []

    // Identificar quote_numbers órfãos onde não há registro com revision = 0
    // SQLite query:
    const orphanNumbersQuery = `
      SELECT DISTINCT q1.quote_number 
      FROM quotes q1 
      WHERE q1.quote_number NOT IN (
        SELECT q2.quote_number FROM quotes q2 WHERE q2.revision = 0 OR q2.revision IS NULL
      )
    `

    // No PocketBase / goja migration, app.findRecordsByFilter ou newQuery
    // Vamos buscar os registros com revision > 0
    const allRevs = app.findRecordsByFilter(
      'quotes',
      'revision > 0',
      'quote_number,revision',
      500,
      0,
    )

    if (allRevs && allRevs.length > 0) {
      // Agrupar por quote_number
      const groups = {}
      for (let i = 0; i < allRevs.length; i++) {
        const qNum = allRevs[i].getInt('quote_number')
        if (!groups[qNum]) {
          groups[qNum] = []
        }
        groups[qNum].push(allRevs[i])
      }

      for (const qNumStr in groups) {
        const qNum = parseInt(qNumStr, 10)
        // Verificar se já existe algum registro com revision = 0 para esse quote_number
        const zeroRevs = app.findRecordsByFilter(
          'quotes',
          `quote_number = ${qNum} && (revision = 0 || revision = null)`,
          '',
          1,
          0,
        )

        // Se não houver nenhum com revision = 0, os registros deste grupo são órfãos
        if (!zeroRevs || zeroRevs.length === 0) {
          const revList = groups[qNumStr]
          // Ordenar por revision crescente
          revList.sort((a, b) => a.getInt('revision') - b.getInt('revision'))

          // Passo A: colocar temporários para evitar violação do índice único
          for (let i = 0; i < revList.length; i++) {
            const tempRev = 20000 + i
            app
              .db()
              .newQuery('UPDATE quotes SET revision = {:tempRev} WHERE id = {:id}')
              .bind({ tempRev: tempRev, id: revList[i].id })
              .execute()
          }

          // Passo B: o primeiro vira original (revision = 0, parent_quote = "")
          const promotedId = revList[0].id
          app
            .db()
            .newQuery('UPDATE quotes SET revision = 0, parent_quote = "" WHERE id = {:id}')
            .bind({ id: promotedId })
            .execute()

          // Passo C: as demais revisões renumeram a partir de 1 e apontam para a promovida
          for (let i = 1; i < revList.length; i++) {
            const newRev = i
            app
              .db()
              .newQuery(
                'UPDATE quotes SET revision = {:newRev}, parent_quote = {:parentId} WHERE id = {:id}',
              )
              .bind({ newRev: newRev, parentId: promotedId, id: revList[i].id })
              .execute()
          }
        }
      }
    }
  },
  (app) => {
    // Reversão não é necessária pois corrige dados inconsistentes gerados pelo bug
  },
)

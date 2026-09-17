// pocketbase/migrations/0013_clean_blank_items.js
migrate(
  (app) => {
    try {
      app.db().newQuery("DELETE FROM items WHERE description = '' OR description IS NULL").execute()
    } catch (e) {
      console.log('Erro ao limpar itens em branco:', e)
    }
  },
  (app) => {},
)

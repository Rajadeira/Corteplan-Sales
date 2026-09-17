import pb from '@/lib/pocketbase/client'
import type { NotificationRecord } from '@/types'

export interface CreateNotificationData {
  user: string
  type?: string
  title: string
  message: string
  quote?: string
  read?: boolean
}

export const notificationService = {
  /**
   * Retorna as notificações do usuário logado (PocketBase filtra pela listRule)
   */
  async getMyNotifications(limit = 30): Promise<NotificationRecord[]> {
    return pb
      .collection('notifications')
      .getList<NotificationRecord>(1, limit, {
        sort: '-created',
        expand: 'quote',
      })
      .then((res) => res.items)
  },

  /**
   * Retorna contagem de não lidas do usuário atual
   */
  async getUnreadCount(): Promise<number> {
    const res = await pb.collection('notifications').getList<NotificationRecord>(1, 1, {
      filter: 'read = false || read = null',
    })
    return res.totalItems
  },

  /**
   * Cria uma notificação para um usuário específico
   */
  async create(data: CreateNotificationData): Promise<NotificationRecord> {
    return pb.collection('notifications').create<NotificationRecord>({
      ...data,
      read: false,
    })
  },

  /**
   * Marca uma notificação como lida
   */
  async markAsRead(id: string): Promise<NotificationRecord> {
    return pb.collection('notifications').update<NotificationRecord>(id, {
      read: true,
    })
  },

  /**
   * Marca todas as notificações não lidas do usuário atual como lidas
   */
  async markAllAsRead(): Promise<void> {
    const unread = await pb.collection('notifications').getFullList<NotificationRecord>({
      filter: 'read = false || read = null',
    })
    await Promise.all(
      unread.map((n) =>
        pb.collection('notifications').update(n.id, {
          read: true,
        }),
      ),
    )
  },

  /**
   * Exclui uma notificação
   */
  async delete(id: string): Promise<boolean> {
    return pb.collection('notifications').delete(id)
  },

  /**
   * Dispara notificações quando um orçamento é aprovado:
   * Destinatários:
   * 1. O vendedor dono do orçamento (se existir e não for quem aprovou)
   * 2. Todos os administradores (exceto quem aprovou a ação)
   * Quem aprova NÃO recebe notificação da própria ação.
   */
  async notifyQuoteApproved(params: {
    quoteId: string
    quoteNumber: number
    clientName?: string
    sellerUserId?: string
    approverUserId?: string
    approverName?: string
  }): Promise<void> {
    try {
      const {
        quoteId,
        quoteNumber,
        clientName = 'Cliente',
        sellerUserId,
        approverUserId,
        approverName = 'Usuário',
      } = params

      // Buscar todos os administradores para notificação
      const allUsers = await pb.collection('users').getFullList({
        filter: 'role = "Administrador"',
      })

      const recipientIds = new Set<string>()

      // 1. Adicionar administradores (exceto quem aprovou)
      allUsers.forEach((admin) => {
        if (admin.id !== approverUserId) {
          recipientIds.add(admin.id)
        }
      })

      // 2. Adicionar o vendedor dono (se existir e não for quem aprovou)
      if (sellerUserId && sellerUserId !== approverUserId) {
        recipientIds.add(sellerUserId)
      }

      const formattedNumber = `ORÇ-${String(quoteNumber || 0).padStart(3, '0')}`
      const title = `Orçamento ${formattedNumber} Aprovado!`
      const message = `O orçamento ${formattedNumber} (${clientName}) foi marcado como Aprovado por ${approverName}.`

      // Criar a notificação para cada destinatário
      const promises = Array.from(recipientIds).map((userId) =>
        pb
          .collection('notifications')
          .create({
            user: userId,
            type: 'quote_approved',
            title,
            message,
            quote: quoteId,
            read: false,
          })
          .catch((err) => {
            console.warn(`Erro ao enviar notificação para usuário ${userId}:`, err)
          }),
      )

      await Promise.all(promises)
    } catch (err) {
      console.error('Erro ao processar notificações de aprovação de orçamento:', err)
    }
  },
}

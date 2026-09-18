import pb from '@/lib/pocketbase/client'
import type { AppUserRecord, UserRole } from '@/types'

export interface CreateUserData {
  name: string
  email: string
  password?: string
  role: UserRole
}

export interface UpdateUserData {
  name?: string
  email?: string
  role?: UserRole
  password?: string
  oldPassword?: string
}

export interface ChangePasswordData {
  oldPassword?: string
  password: string
  passwordConfirm?: string
}

export const userService = {
  async getAll(): Promise<AppUserRecord[]> {
    return pb.collection('users').getFullList<AppUserRecord>({
      sort: 'name',
    })
  },

  async getById(id: string): Promise<AppUserRecord> {
    return pb.collection('users').getOne<AppUserRecord>(id)
  },

  async create(data: CreateUserData): Promise<AppUserRecord> {
    const defaultPassword = data.password || 'Skip@Pass'
    return pb.collection('users').create<AppUserRecord>({
      name: data.name,
      email: data.email,
      password: defaultPassword,
      passwordConfirm: defaultPassword,
      role: data.role || 'Vendedor',
      emailVisibility: true,
    })
  },

  async update(id: string, data: UpdateUserData): Promise<AppUserRecord> {
    const payload: Record<string, unknown> = {}
    if (data.name !== undefined) payload.name = data.name
    if (data.role !== undefined) payload.role = data.role
    if (data.email !== undefined) payload.email = data.email
    if (data.password) {
      payload.password = data.password
      payload.passwordConfirm = data.password
      if (data.oldPassword) {
        payload.oldPassword = data.oldPassword
      }
    }

    try {
      const updated = await pb.collection('users').update<AppUserRecord>(id, payload)
      return updated
    } catch (err) {
      // Se a atualização direta do registro falhar por conta de senha, tenta o endpoint customizado
      if (data.password) {
        await userService.changePassword(id, {
          password: data.password,
          passwordConfirm: data.password,
          oldPassword: data.oldPassword,
        })
        // Atualiza os outros campos (sem senha)
        const restPayload: Record<string, unknown> = {}
        if (data.name !== undefined) restPayload.name = data.name
        if (data.role !== undefined) restPayload.role = data.role
        if (data.email !== undefined) restPayload.email = data.email
        if (Object.keys(restPayload).length > 0) {
          return pb.collection('users').update<AppUserRecord>(id, restPayload)
        }
        return pb.collection('users').getOne<AppUserRecord>(id)
      }
      throw err
    }
  },

  async changePassword(
    id: string,
    data: ChangePasswordData,
  ): Promise<{ success: boolean; message: string }> {
    return pb.send<{ success: boolean; message: string }>(`/backend/v1/users/${id}/password`, {
      method: 'POST',
      body: {
        password: data.password,
        passwordConfirm: data.passwordConfirm || data.password,
        oldPassword: data.oldPassword || '',
      },
    })
  },

  async delete(id: string): Promise<boolean> {
    return pb.collection('users').delete(id)
  },
}

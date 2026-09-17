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
    const payload: Record<string, unknown> = {
      name: data.name,
      role: data.role,
    }
    if (data.email) {
      payload.email = data.email
    }
    if (data.password) {
      payload.password = data.password
      payload.passwordConfirm = data.password
    }
    return pb.collection('users').update<AppUserRecord>(id, payload)
  },

  async delete(id: string): Promise<boolean> {
    return pb.collection('users').delete(id)
  },
}

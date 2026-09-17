import React, { createContext, useContext, useEffect, useState } from 'react'
import type { AuthRecord } from 'pocketbase'
import pb from '@/lib/pocketbase/client'

export interface UserProfile {
  id: string
  name: string
  email: string
  avatar?: string
}

interface AuthContextType {
  user: UserProfile | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(() => {
    if (pb.authStore.isValid && pb.authStore.record) {
      const rec = pb.authStore.record as AuthRecord
      return {
        id: rec.id,
        name: (rec.name as string) || (rec.email as string)?.split('@')[0] || 'Usuário',
        email: rec.email as string,
        avatar: (rec.avatar as string) || undefined,
      }
    }
    return null
  })
  const [token, setToken] = useState<string | null>(pb.authStore.token || null)
  const [isLoading, setIsLoading] = useState<boolean>(true)

  useEffect(() => {
    const unsub = pb.authStore.onChange((newToken, record) => {
      setToken(newToken)
      if (record) {
        const rec = record as AuthRecord
        setUser({
          id: rec.id,
          name: (rec.name as string) || (rec.email as string)?.split('@')[0] || 'Usuário',
          email: rec.email as string,
          avatar: (rec.avatar as string) || undefined,
        })
      } else {
        setUser(null)
      }
    })

    // Verify token validity
    if (pb.authStore.isValid) {
      pb.collection('users')
        .authRefresh()
        .then(() => {
          if (pb.authStore.record) {
            const rec = pb.authStore.record as AuthRecord
            setUser({
              id: rec.id,
              name: (rec.name as string) || (rec.email as string)?.split('@')[0] || 'Usuário',
              email: rec.email as string,
              avatar: (rec.avatar as string) || undefined,
            })
          }
        })
        .catch(() => {
          pb.authStore.clear()
          setUser(null)
          setToken(null)
        })
        .finally(() => {
          setIsLoading(false)
        })
    } else {
      setIsLoading(false)
    }

    return () => {
      unsub()
    }
  }, [])

  const login = async (email: string, password: string) => {
    const authData = await pb.collection('users').authWithPassword(email, password)
    const rec = authData.record as AuthRecord
    setUser({
      id: rec.id,
      name: (rec.name as string) || (rec.email as string)?.split('@')[0] || 'Usuário',
      email: rec.email as string,
      avatar: (rec.avatar as string) || undefined,
    })
    setToken(authData.token)
  }

  const register = async (name: string, email: string, password: string) => {
    await pb.collection('users').create({
      name,
      email,
      password,
      passwordConfirm: password,
      emailVisibility: true,
    })
    // Auto-login after registration
    await login(email, password)
  }

  const logout = () => {
    pb.authStore.clear()
    setUser(null)
    setToken(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user && !!token,
        isLoading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider')
  }
  return context
}

/* Main App Component - Handles routing (using react-router-dom), query client and other providers - use this file to add all routes */
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider } from '@/contexts/AuthContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import Layout from '@/components/Layout'

import Index from './pages/Index'
import Login from './pages/Login'
import { Navigate } from 'react-router-dom'
import Clients from './pages/Clients'
import ClientDetail from './pages/ClientDetail'
import Quotes from './pages/Quotes'
import QuoteDetail from './pages/QuoteDetail'
import QuoteForm from './pages/QuoteForm'
import QuoteFollowup from './pages/QuoteFollowup'
import Orders from './pages/Orders'
import OrderDetail from './pages/OrderDetail'
import Users from './pages/Users'
import Items from './pages/Items'
import SettingsPage from './pages/Settings'
import Financial from './pages/Financial'
import NotFound from './pages/NotFound'
const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner position="top-right" duration={4000} richColors />
        <Routes>
          {/* Rotas Públicas */}
          <Route path="/login" element={<Login />} />
          <Route path="/cadastro" element={<Navigate to="/login" replace />} />

          {/* Rotas Protegidas sob o Layout Principal */}
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Index />} />
            <Route path="/clientes" element={<Clients />} />
            <Route path="/clientes/:id" element={<ClientDetail />} />
            <Route path="/orcamentos" element={<Quotes />} />
            <Route path="/orcamentos/novo" element={<QuoteForm />} />
            <Route path="/orcamentos/:id" element={<QuoteDetail />} />
            <Route path="/orcamentos/:id/editar" element={<QuoteForm />} />
            <Route path="/orcamentos/:id/followup" element={<QuoteFollowup />} />
            <Route path="/pedidos" element={<Orders />} />
            <Route path="/pedidos/:id" element={<OrderDetail />} />
            <Route path="/itens" element={<Items />} />
            <Route
              path="/usuarios"
              element={
                <ProtectedRoute requireAdmin>
                  <Users />
                </ProtectedRoute>
              }
            />
            <Route
              path="/financeiro"
              element={
                <ProtectedRoute requireAdmin>
                  <Financial />
                </ProtectedRoute>
              }
            />
            <Route
              path="/financeiro/notas"
              element={
                <ProtectedRoute requireAdmin>
                  <Navigate to="/financeiro?tab=notas" replace />
                </ProtectedRoute>
              }
            />
            <Route
              path="/financeiro/fluxo"
              element={
                <ProtectedRoute requireAdmin>
                  <Navigate to="/financeiro?tab=fluxo" replace />
                </ProtectedRoute>
              }
            />
            <Route
              path="/configuracoes"
              element={
                <ProtectedRoute requireAdmin>
                  <SettingsPage />
                </ProtectedRoute>
              }
            />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </TooltipProvider>
    </AuthProvider>
  </BrowserRouter>
)

export default App

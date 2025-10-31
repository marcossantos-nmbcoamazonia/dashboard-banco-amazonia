"use client"

import type React from "react"
import { useAuth } from "../../contexts/AuthContext"
import { AlertTriangle, LogOut } from "lucide-react"

const UnauthorizedAccess: React.FC = () => {
  const { user, logout } = useAuth()

  return (
    <div className="min-h-screen flex items-center justify-center relative">
      {/* Background Image */}
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat z-0"
        style={{
          backgroundImage: "url('/images/banner-background.webp')",
        }}
      >
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm"></div>
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-md w-full mx-4">
        <div className="card-overlay rounded-lg shadow-lg p-8 text-center">
          <div className="flex justify-center mb-6">
            <div className="p-3 bg-red-100 rounded-full">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-4">Acesso Negado</h1>

          <p className="text-gray-600 mb-6">
            Olá, <strong>{user?.name}</strong>! Seu e-mail <strong>{user?.email}</strong> não está autorizado a acessar
            este sistema.
          </p>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-yellow-800">
              Entre em contato com o administrador do sistema para solicitar acesso.
            </p>
          </div>

          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </div>
    </div>
  )
}

export default UnauthorizedAccess

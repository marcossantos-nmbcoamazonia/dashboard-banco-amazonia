"use client"

import type React from "react"
import { GoogleLogin } from "@react-oauth/google"
import { useAuth } from "../../contexts/AuthContext"
import { BarChart3 } from "lucide-react"

const Login: React.FC = () => {
  const { login } = useAuth()

  const handleSuccess = (credentialResponse: any) => {
    if (credentialResponse.credential) {
      login(credentialResponse.credential)
    }
  }

  const handleError = () => {
    console.error("Erro no login com Google")
  }

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

      {/* Login Content */}
      <div className="relative z-10 max-w-md w-full mx-4">
        <div className="card-overlay rounded-lg shadow-lg p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-blue-600 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-8 h-8 text-white" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Dashboard Cartões</h1>
            <p className="text-gray-600">Faça login para acessar o sistema</p>
          </div>

          {/* Google Login Button */}
          <div className="flex justify-center">
            <GoogleLogin
              onSuccess={handleSuccess}
              onError={handleError}
              theme="outline"
              size="large"
              text="signin_with"
              shape="rectangular"
              logo_alignment="left"
            />
          </div>

          {/* Footer */}
          <div className="mt-8 text-center">
            <p className="text-xs text-gray-500">Apenas usuários autorizados podem acessar este sistema</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login

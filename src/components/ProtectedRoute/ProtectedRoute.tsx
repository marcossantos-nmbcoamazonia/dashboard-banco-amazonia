"use client"

import type React from "react"
import { useAuth } from "../../contexts/AuthContext"
import Login from "../../pages/Login/Login"
import UnauthorizedAccess from "../UnauthorizedAccess/UnauthorizedAccess"

interface ProtectedRouteProps {
  children: React.ReactNode
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isAuthorized, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Login />
  }

  if (!isAuthorized) {
    return <UnauthorizedAccess />
  }

  return <>{children}</>
}

export default ProtectedRoute

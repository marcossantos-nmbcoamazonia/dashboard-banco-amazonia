import type React from "react"

interface LoadingProps {
  size?: "sm" | "md" | "lg" | "xl"
  message?: string
  className?: string
}

const Loading: React.FC<LoadingProps> = ({ size = "md", message = "Carregando...", className = "" }) => {
  // Definir tamanhos do spinner
  const sizeClasses = {
    sm: "w-12 h-12", // 48px
    md: "w-24 h-24", // 96px
    lg: "w-32 h-32", // 128px
    xl: "w-40 h-40", // 160px
  }

  // Definir altura do container baseado no tamanho
  const containerHeights = {
    sm: "h-32", // 128px
    md: "h-64", // 256px
    lg: "h-80", // 320px
    xl: "h-96", // 384px
  }

  return (
    <div className={`flex flex-col items-center justify-center ${containerHeights[size]} ${className}`}>
      <div className={`${sizeClasses[size]} mb-4 relative`}>
        <div className="absolute inset-0 border-4 border-blue-200 rounded-full"></div>
        <div className="absolute inset-0 border-4 border-transparent border-t-blue-600 rounded-full animate-spin"></div>
      </div>
      {message && <p className="text-gray-600 text-sm font-medium animate-pulse">{message}</p>}
    </div>
  )
}

export default Loading

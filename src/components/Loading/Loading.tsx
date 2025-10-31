import type React from "react"

interface LoadingProps {
  size?: "sm" | "md" | "lg" | "xl"
  message?: string
  className?: string
}

const Loading: React.FC<LoadingProps> = ({ size = "md", message = "Carregando...", className = "" }) => {
  // Definir tamanhos do GIF
  const sizeClasses = {
    sm: "h-12", // 48px
    md: "h-24", // 96px
    lg: "h-32", // 128px
    xl: "h-40", // 160px
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
      <img src="/images/nacional.gif" alt="Carregando..." className={`${sizeClasses[size]} w-auto mb-4`} />
      {message && <p className="text-gray-600 text-sm font-medium animate-pulse">{message}</p>}
    </div>
  )
}

export default Loading

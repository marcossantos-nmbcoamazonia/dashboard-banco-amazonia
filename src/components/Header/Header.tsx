import type React from "react"
import Sidebar from "../Sidebar/Sidebar"

interface LayoutProps {
  children: React.ReactNode
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="flex min-h-screen relative">
      {/* Background Image */}
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat z-0"
        style={{
          backgroundImage: "url('/images/banner-background.webp')",
        }}
      >
        {/* Overlay para melhorar a legibilidade */}
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm"></div>
      </div>

      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <main className="flex-1 ml-16 transition-all duration-300 relative z-10">
        <div className="p-6">{children}</div>
      </main>
    </div>
  )
}

export default Layout

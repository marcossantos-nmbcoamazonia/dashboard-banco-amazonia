import type React from "react"
import { Link } from "react-router-dom"
import {
  Clock,
  Globe,
  BarChart3,
  Users,
  Eye,
  TrendingUp,
  Video,
  ArrowRight,
  Calendar,
  Target,
  User,
  TargetIcon as Bullseye,
  Linkedin,
  ImageIcon as MetaIcon,
  PinIcon as Pinterest,
  BookOpenText,
} from "lucide-react"

interface NavigationCard {
  title: string
  description: string
  path: string
  icon: React.ReactNode
  color: string
}

const navigationCards: NavigationCard[] = [
  // Card "Estratégia Documentação" removido conforme solicitação
  {
    title: "Linha do Tempo",
    description: "Cronograma e marcos importantes da campanha",
    path: "/linha-tempo",
    icon: <Clock className="w-6 h-6" />,
    color: "bg-green-500",
  },
  {
    title: "Estratégia Online",
    description: "Planejamento e execução da estratégia digital",
    path: "/estrategia-online",
    icon: <Globe className="w-6 h-6" />,
    color: "bg-purple-500",
  },
  {
    title: "Visão Geral",
    description: "Panorama geral das métricas e resultados",
    path: "/visao-geral",
    icon: <BarChart3 className="w-6 h-6" />,
    color: "bg-indigo-500",
  },
  {
    title: "Alcance",
    description: "Métricas de alcance e impressões da campanha",
    path: "/alcance",
    icon: <Users className="w-6 h-6" />,
    color: "bg-cyan-500",
  },
  {
    title: "Visualizações",
    description: "Dados de visualizações e engajamento visual",
    path: "/visualizacoes",
    icon: <Eye className="w-6 h-6" />,
    color: "bg-orange-500",
  },
  {
    title: "Tráfego e Engajamento",
    description: "Análise de tráfego e interações dos usuários",
    path: "/trafego-engajamento",
    icon: <TrendingUp className="w-6 h-6" />,
    color: "bg-red-500",
  },
  {
    title: "Criativos - TikTok",
    description: "Performance dos criativos na plataforma TikTok",
    path: "/criativos-tiktok",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
      </svg>
    ),
    color: "bg-pink-500",
  },
  {
    title: "Criativos - Meta Ads",
    description: "Análise dos criativos no Facebook e Instagram",
    path: "/criativos-meta-ads",
    icon: (
      <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="50" height="50" viewBox="0 0 50 50" fill="currentColor">
        <path d="M47.3,21.01c-0.58-1.6-1.3-3.16-2.24-4.66c-0.93-1.49-2.11-2.93-3.63-4.13c-1.51-1.19-3.49-2.09-5.59-2.26l-0.78-0.04	c-0.27,0.01-0.57,0.01-0.85,0.04c-0.57,0.06-1.11,0.19-1.62,0.34c-1.03,0.32-1.93,0.8-2.72,1.32c-1.42,0.94-2.55,2.03-3.57,3.15	c0.01,0.02,0.03,0.03,0.04,0.05l0.22,0.28c0.51,0.67,1.62,2.21,2.61,3.87c1.23-1.2,2.83-2.65,3.49-3.07	c0.5-0.31,0.99-0.55,1.43-0.68c0.23-0.06,0.44-0.11,0.64-0.12c0.1-0.02,0.19-0.01,0.3-0.02l0.38,0.02c0.98,0.09,1.94,0.49,2.85,1.19	c1.81,1.44,3.24,3.89,4.17,6.48c0.95,2.6,1.49,5.44,1.52,8.18c0,1.31-0.17,2.57-0.57,3.61c-0.39,1.05-1.38,1.45-2.5,1.45	c-1.63,0-2.81-0.7-3.76-1.68c-1.04-1.09-2.02-2.31-2.96-3.61c-0.78-1.09-1.54-2.22-2.26-3.37c-1.27-2.06-2.97-4.67-4.15-6.85	L25,16.35c-0.31-0.39-0.61-0.78-0.94-1.17c-1.11-1.26-2.34-2.5-3.93-3.56c-0.79-0.52-1.69-1-2.72-1.32	c-0.51-0.15-1.05-0.28-1.62-0.34c-0.18-0.02-0.36-0.03-0.54-0.03c-0.11,0-0.21-0.01-0.31-0.01l-0.78,0.04	c-2.1,0.17-4.08,1.07-5.59,2.26c-1.52,1.2-2.7,2.64-3.63,4.13C4,17.85,3.28,19.41,2.7,21.01c-1.13,3.2-1.74,6.51-1.75,9.93	c0.01,1.78,0.24,3.63,0.96,5.47c0.7,1.8,2.02,3.71,4.12,4.77c1.03,0.53,2.2,0.81,3.32,0.81c1.23,0.03,2.4-0.32,3.33-0.77	c1.87-0.93,3.16-2.16,4.33-3.4c2.31-2.51,4.02-5.23,5.6-8c0.44-0.76,0.86-1.54,1.27-2.33c-0.21-0.41-0.42-0.84-0.64-1.29	c-0.62-1.03-1.39-2.25-1.95-3.1c-0.83,1.5-1.69,2.96-2.58,4.41c-1.59,2.52-3.3,4.97-5.21,6.98c-0.95,0.98-2,1.84-2.92,2.25	c-0.47,0.2-0.83,0.27-1.14,0.25c-0.43,0-0.79-0.1-1.13-0.28c-0.67-0.35-1.3-1.1-1.69-2.15c-0.4-1.04-0.57-2.3-0.57-3.61	c0.03-2.74,0.57-5.58,1.52-8.18c0.93-2.59,2.36-5.04,4.17-6.48c0.91-0.7,1.87-1.1,2.85-1.19l0.38-0.02c0.11,0.01,0.2,0,0.3,0.02	c0.2,0.01,0.41,0.06,0.64,0.12c0.26,0.08,0.54,0.19,0.83,0.34c0.2,0.1,0.4,0.21,0.6,0.34c1,0.64,1.99,1.58,2.92,2.62	c0.72,0.81,1.41,1.71,2.1,2.63L25,25.24c0.75,1.55,1.53,3.09,2.39,4.58c1.58,2.77,3.29,5.49,5.6,8c0.68,0.73,1.41,1.45,2.27,2.1	c0.61,0.48,1.28,0.91,2.06,1.3c0.93,0.45,2.1,0.8,3.33,0.77c1.12,0,2.29-0.28,3.32-0.81c2.1-1.06,3.42-2.97,4.12-4.77	c0.72-1.84,0.95-3.69,0.96-5.47C49.04,27.52,48.43,24.21,47.3,21.01z"></path>
      </svg>
    ), 
    color: "bg-blue-600",
  },
  {
    title: "Criativos - Pinterest",
    description: "Performance dos criativos na plataforma Pinterest",
    path: "/criativos-pinterest",
    icon: (
      <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="50" height="50" viewBox="0 0 50 50" fill="currentColor">
        <path d="M 25 2 C 12.309295 2 2 12.309295 2 25 C 2 37.690705 12.309295 48 25 48 C 37.690705 48 48 37.690705 48 25 C 48 12.309295 37.690705 2 25 2 z M 25 4 C 36.609825 4 46 13.390175 46 25 C 46 36.609825 36.609825 46 25 46 C 22.876355 46 20.82771 45.682142 18.896484 45.097656 C 19.75673 43.659418 20.867347 41.60359 21.308594 39.90625 C 21.570728 38.899887 22.648438 34.794922 22.648438 34.794922 C 23.348841 36.132057 25.395277 37.263672 27.574219 37.263672 C 34.058123 37.263672 38.732422 31.300682 38.732422 23.890625 C 38.732422 16.78653 32.935409 11.472656 25.476562 11.472656 C 16.196831 11.472656 11.271484 17.700825 11.271484 24.482422 C 11.271484 27.636307 12.94892 31.562193 15.634766 32.8125 C 16.041611 33.001865 16.260073 32.919834 16.353516 32.525391 C 16.425459 32.226044 16.788267 30.766792 16.951172 30.087891 C 17.003269 29.871239 16.978043 29.68405 16.802734 29.470703 C 15.913793 28.392399 15.201172 26.4118 15.201172 24.564453 C 15.201172 19.822048 18.791452 15.232422 24.908203 15.232422 C 30.18976 15.232422 33.888672 18.832872 33.888672 23.980469 C 33.888672 29.796219 30.95207 33.826172 27.130859 33.826172 C 25.020554 33.826172 23.440361 32.080359 23.947266 29.939453 C 24.555054 27.38426 25.728516 24.626944 25.728516 22.78125 C 25.728516 21.130713 24.842754 19.753906 23.007812 19.753906 C 20.850369 19.753906 19.117188 21.984457 19.117188 24.974609 C 19.117187 26.877359 19.761719 28.166016 19.761719 28.166016 C 19.761719 28.166016 17.630543 37.176514 17.240234 38.853516 C 16.849091 40.52931 16.953851 42.786365 17.115234 44.466797 C 9.421139 41.352465 4 33.819328 4 25 C 4 13.390175 13.390175 4 25 4 z"></path>
      </svg>
    ),
    color: "bg-red-400",
  },
  {
    title: "Criativos - LinkedIn",
    description: "Performance dos criativos na plataforma LinkedIn",
    path: "/criativos-linkedin",
    icon: (
      <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="50" height="50" viewBox="0 0 50 50" fill="currentColor">
          <path d="M41,4H9C6.24,4,4,6.24,4,9v32c0,2.76,2.24,5,5,5h32c2.76,0,5-2.24,5-5V9C46,6.24,43.76,4,41,4z M17,20v19h-6V20H17z M11,14.47c0-1.4,1.2-2.47,3-2.47s2.93,1.07,3,2.47c0,1.4-1.12,2.53-3,2.53C12.2,17,11,15.87,11,14.47z M39,39h-6c0,0,0-9.26,0-10 c0-2-1-4-3.5-4.04h-0.08C27,24.96,26,27.02,26,29c0,0.91,0,10,0,10h-6V20h6v2.56c0,0,1.93-2.56,5.81-2.56 c3.97,0,7.19,2.73,7.19,8.26V39z"></path>
      </svg>
    ),
    color: "bg-blue-700",
  },
  {
    title: "Glossário",
    description: "Entenda os termos técnicos e métricas do dashboard",
    path: "/glossario",
    icon: <BookOpenText className="w-6 h-6" />, // Novo card para Glossário
    color: "bg-purple-600",
  },
]

const Capa: React.FC = () => {
  return (
    <div className="h-full flex flex-col space-y-4 overflow-hidden">
      {/* Hero Section com Imagem da Campanha */}
      <div className="relative overflow-hidden rounded-2xl shadow-2xl h-48">
        <div className="relative h-full bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600">
          <img
            src="/images/fundo_card.webp"
            alt="Campanha Cartões - Colecione Momentos"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/20"></div>
          <div className=" grid grid-cols-1 lg:grid-cols-2 gap-4 absolute bottom-0 left-0 right-0 p-4">
            <div className="bg-white/95 backdrop-blur-sm rounded-xl p-4 shadow-lg">
              <h1 className="text-2xl font-bold text-gray-900 mb-1">Dashboard - Banco da Amazônia</h1>
              <p className="text-base text-gray-700">Colecione momentos • Análise completa de performance</p>
            </div>
          </div>
        </div>
      </div>

      {/* Informações da Campanha */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Detalhes da Campanha */}
        <div className="card-overlay rounded-xl shadow-lg p-4">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
            <Calendar className="w-4 h-4 mr-2 text-blue-600" />
            Informações da Campanha
          </h2>
          <div className="space-y-3">
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">Campanha:</p>
                <p className="text-gray-700 text-sm">Cartões</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">Códigos</p>
                <p className="text-gray-700 text-sm">Nº Ação: A2025/00002</p>
                <p className="text-gray-700 text-sm">Nº Projeto: P2024/00854</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <User className="w-3 h-3 text-purple-600 mt-1" />
              <div>
                <p className="font-semibold text-gray-900 text-sm">Assessora:</p>
                <p className="text-gray-700 text-sm">Isis Azevedo</p>
              </div>
            </div>
          </div>
        </div>

        {/* Objetivos e Público */}
        <div className="card-overlay rounded-xl shadow-lg p-4">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
            <Target className="w-4 h-4 mr-2 text-green-600" />
            Objetivos e Público
          </h2>
          <div className="space-y-3">
            <div className="flex items-start space-x-3">
              <Users className="w-3 h-3 text-orange-600 mt-1" />
              <div>
                <p className="font-semibold text-gray-900 text-sm">Público Alvo:</p>
                <p className="text-gray-700 text-sm">AS - 18 +</p>
                <p className="text-gray-700 text-sm">AS - 18 a 40 anos + Interesses</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <Bullseye className="w-3 h-3 text-red-600 mt-1" />
              <div>
                <p className="font-semibold text-gray-900 text-sm">Objetivo de Campanha:</p>
                <p className="text-gray-700 text-sm">Mercadológica - Negocial</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <BarChart3 className="w-3 h-3 text-blue-600 mt-1" />
              <div>
                <p className="font-semibold text-gray-900 text-sm">Objetivo de Mídia:</p>
                <p className="text-gray-700 text-sm">Alcance</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Menu de Navegação */}
      <div className="flex-1 min-h-0">
        <h2 className="text-xl font-bold text-gray-900 mb-3 text-enhanced">Navegação do Dashboard</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 h-full overflow-y-auto">
          {navigationCards.map((card, index) => (
            <Link
              key={index}
              to={card.path}
              className="group card-overlay rounded-xl shadow-lg p-4 hover:shadow-xl transition-all duration-300 h-fit"
            >
              <div className="flex items-start space-x-3">
                <div
                  className={`${card.color} p-2 rounded-lg text-white group-hover:scale-110 transition-transform duration-300`}
                >
                  {card.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-gray-900 group-hover:text-blue-600 transition-colors duration-300">
                    {card.title}
                  </h3>
                  <p className="text-xs text-gray-600 mt-1 line-clamp-2">{card.description}</p>
                  <div className="flex items-center mt-2 text-blue-600 group-hover:text-blue-700">
                    <span className="text-xs font-medium">Acessar</span>
                    <ArrowRight className="w-3 h-3 ml-1 group-hover:translate-x-1 transition-transform duration-300" />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

export default Capa

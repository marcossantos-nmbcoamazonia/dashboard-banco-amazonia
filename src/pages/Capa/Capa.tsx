import type React from "react"
import { Link } from "react-router-dom"
import { useState, useMemo } from "react"
import { ResponsiveLine } from "@nivo/line"
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
  BookOpenText,
  CircleDot,
  DollarSign,
  MousePointerClick,
  Radio,
} from "lucide-react"
import { useConsolidadoGeral } from "../../services/consolidadoApi"

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
    title: "Criativos - Google Ads",
    description: "Performance dos criativos na plataforma Google Ads",
    path: "/criativos-google-ads",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"/>
      </svg>
    ),
    color: "bg-green-600",
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
    title: "Veiculação Off-line",
    description: "Análise de veiculação em mídias off-line",
    path: "/veiculacao-offline",
    icon: <Radio className="w-6 h-6" />,
    color: "bg-slate-600",
  },
  {
    title: "Glossário",
    description: "Entenda os termos técnicos e métricas do dashboard",
    path: "/glossario",
    icon: <BookOpenText className="w-6 h-6" />,
    color: "bg-purple-600",
  },
]

type MetricType = "impressions" | "clicks" | "videoViews" | "spent"

const Capa: React.FC = () => {
  const { campaigns, last7Days, loading, error, data } = useConsolidadoGeral()
  const [selectedMetric, setSelectedMetric] = useState<MetricType>("impressions")
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null)

  // Filtrar dados dos últimos 7 dias por campanha selecionada
  const filteredLast7Days = useMemo(() => {
    if (!selectedCampaign || !data?.success || !data?.data?.values) return last7Days

    const headers = data.data.values[0]
    const rows = data.data.values.slice(1)

    const dateIndex = headers.indexOf("Date")
    const campaignIndex = headers.indexOf("Campanha")
    const spentIndex = headers.indexOf("Cost (Spend)")
    const impressionsIndex = headers.indexOf("Impressions")
    const clicksIndex = headers.indexOf("Clicks")
    const videoViewsIndex = headers.indexOf("Video Views")

    // Parsear números brasileiros
    const parseBrazilianCurrency = (value: string): number => {
      if (!value || value === "0") return 0
      return parseFloat(value.replace(/R\$\s?/g, '').replace(/\./g, '').replace(',', '.'))
    }
    const parseBrazilianNumber = (value: string): number => {
      if (!value || value === "0") return 0
      return parseFloat(value.replace(/\./g, '').replace(',', '.'))
    }

    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    yesterday.setHours(0, 0, 0, 0)
    const sevenDaysAgo = new Date(yesterday)
    sevenDaysAgo.setDate(yesterday.getDate() - 6)
    sevenDaysAgo.setHours(0, 0, 0, 0)

    const metricsMap = new Map<string, { date: string; impressions: number; clicks: number; videoViews: number; spent: number }>()

    rows.forEach((row) => {
      const campaignName = row[campaignIndex]
      const dateStr = row[dateIndex]

      if (campaignName !== selectedCampaign || !dateStr) return

      const [day, month, year] = dateStr.split("/")
      const rowDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
      rowDate.setHours(0, 0, 0, 0)

      if (rowDate >= sevenDaysAgo && rowDate <= yesterday) {
        if (!metricsMap.has(dateStr)) {
          metricsMap.set(dateStr, { date: dateStr, impressions: 0, clicks: 0, videoViews: 0, spent: 0 })
        }
        const metrics = metricsMap.get(dateStr)!
        metrics.impressions += parseBrazilianNumber(row[impressionsIndex] || "0")
        metrics.clicks += parseBrazilianNumber(row[clicksIndex] || "0")
        metrics.videoViews += parseBrazilianNumber(row[videoViewsIndex] || "0")
        metrics.spent += parseBrazilianCurrency(row[spentIndex] || "0")
      }
    })

    return Array.from(metricsMap.values()).sort((a, b) => {
      const [dayA, monthA, yearA] = a.date.split("/").map(Number)
      const [dayB, monthB, yearB] = b.date.split("/").map(Number)
      const dateA = new Date(yearA, monthA - 1, dayA)
      const dateB = new Date(yearB, monthB - 1, dayB)
      return dateA.getTime() - dateB.getTime()
    })
  }, [selectedCampaign, data, last7Days])

  // Preparar dados para o gráfico
  const chartData = useMemo(() => {
    const dataToUse = filteredLast7Days
    if (!dataToUse.length) return []

    const metricLabels: Record<MetricType, string> = {
      impressions: "Impressões",
      clicks: "Cliques",
      videoViews: "Visualizações",
      spent: "Investimento",
    }

    return [
      {
        id: metricLabels[selectedMetric],
        data: dataToUse.map((day) => ({
          x: day.date,
          y: day[selectedMetric],
        })),
      },
    ]
  }, [filteredLast7Days, selectedMetric])

  // Calcular total da métrica selecionada
  const totalMetric = useMemo(() => {
    return filteredLast7Days.reduce((sum, day) => sum + day[selectedMetric], 0)
  }, [filteredLast7Days, selectedMetric])

  // Handler para clicar em uma campanha
  const handleCampaignClick = (campaignName: string) => {
    setSelectedCampaign(selectedCampaign === campaignName ? null : campaignName)
  }

  // Formatar valor baseado na métrica
  const formatMetricValue = (value: number, metric: MetricType): string => {
    if (metric === "spent") {
      return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(value)
    }
    return new Intl.NumberFormat("pt-BR").format(Math.round(value))
  }

  return (
    <div className="h-full flex flex-col space-y-4 overflow-hidden">
      {/* Hero Section com Imagem da Campanha */}
      <div className="relative overflow-hidden rounded-2xl shadow-2xl h-44">
        <div className="relative h-full bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600">
          <img
            src="/images/fundo_card.webp"
            alt="Dashboard - Banco da Amazônia"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/20"></div>
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <div className="bg-white/95 backdrop-blur-sm rounded-xl p-4 shadow-lg max-w-2xl">
              <h1 className="text-2xl font-bold text-gray-900 mb-1">Dashboard - Banco da Amazônia</h1>
              <p className="text-base text-gray-700">Análise de performance • Múltiplas Campanhas</p>
            </div>
          </div>
        </div>
      </div>

      {/* Cards de Informação */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Card de Campanhas */}
        <div className="card-overlay rounded-xl shadow-lg p-5 max-h-80 flex flex-col">
          <h2 className="text-base font-bold text-gray-900 mb-3 flex items-center">
            <BarChart3 className="w-4 h-4 mr-2 text-blue-600" />
            Campanhas
          </h2>

          {loading && (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm text-gray-500">Carregando campanhas...</p>
            </div>
          )}

          {error && (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm text-red-500">Erro ao carregar campanhas</p>
            </div>
          )}

          {!loading && !error && campaigns.length > 0 && (
            <>
              <div className="flex-1 overflow-y-auto space-y-2 mb-3">
                {campaigns.map((campaign, index) => (
                  <div
                    key={index}
                    onClick={() => handleCampaignClick(campaign.name)}
                    className={`flex items-start space-x-2 py-2 px-3 rounded-lg cursor-pointer transition-all duration-200 ${
                      selectedCampaign === campaign.name
                        ? "bg-blue-50 border-2 border-blue-400 shadow-sm"
                        : "hover:bg-gray-50 border-2 border-transparent"
                    }`}
                  >
                    <CircleDot
                      className={`w-3 h-3 mt-1 flex-shrink-0 ${
                        campaign.isActive ? "text-green-500 fill-green-500" : "text-gray-400 fill-gray-400"
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{campaign.name}</p>
                      <p className="text-xs text-gray-600">
                        {formatMetricValue(campaign.totalSpent, "spent")} •{" "}
                        {formatMetricValue(campaign.impressions, "impressions")} impressões
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Legenda */}
              <div className="border-t pt-2 flex items-center justify-start space-x-4 text-xs text-gray-600">
                <div className="flex items-center space-x-1">
                  <CircleDot className="w-3 h-3 text-green-500 fill-green-500" />
                  <span>Ativa (últimos 7 dias)</span>
                </div>
                <div className="flex items-center space-x-1">
                  <CircleDot className="w-3 h-3 text-gray-400 fill-gray-400" />
                  <span>Inativa</span>
                </div>
              </div>
            </>
          )}

          {!loading && !error && campaigns.length === 0 && (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm text-gray-500">Nenhuma campanha encontrada</p>
            </div>
          )}
        </div>

        {/* Gráfico de Métricas dos Últimos 7 Dias */}
        <div className="card-overlay rounded-xl shadow-lg p-5 max-h-80 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              <h2 className="text-base font-bold text-gray-900">
                Últimos 7 Dias
                {selectedCampaign && (
                  <span className="text-sm font-normal text-blue-600 ml-2">• {selectedCampaign}</span>
                )}
              </h2>
            </div>
            <div className="relative">
              <select
                value={selectedMetric}
                onChange={(e) => setSelectedMetric(e.target.value as MetricType)}
                className="appearance-none text-sm bg-white border-2 border-gray-200 rounded-xl pl-3 pr-8 py-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-300 transition-colors"
              >
                <option value="impressions">Impressões</option>
                <option value="clicks">Cliques</option>
                <option value="videoViews">Visualizações</option>
                <option value="spent">Investimento</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          {loading && (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm text-gray-500">Carregando métricas...</p>
            </div>
          )}

          {error && (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm text-red-500">Erro ao carregar métricas</p>
            </div>
          )}

          {!loading && !error && chartData.length > 0 && (
            <>
              {/* Valor Total */}
              <div className="mb-2">
                <p className="text-xs text-gray-600">Total do Período</p>
                <p className="text-lg font-bold text-green-600">
                  {formatMetricValue(totalMetric, selectedMetric)}
                </p>
              </div>

              {/* Gráfico */}
              <div className="flex-1 min-h-0">
                <ResponsiveLine
                  data={chartData}
                  margin={{ top: 10, right: 10, bottom: 30, left: 60 }}
                  xScale={{ type: "point" }}
                  yScale={{ type: "linear", min: "auto", max: "auto" }}
                  curve="monotoneX"
                  axisTop={null}
                  axisRight={null}
                  axisBottom={{
                    tickSize: 5,
                    tickPadding: 5,
                    tickRotation: -45,
                    legendOffset: 36,
                    legendPosition: "middle",
                    format: (value) => {
                      const [day, month] = value.split("/")
                      return `${day}/${month}`
                    },
                  }}
                  axisLeft={{
                    tickSize: 5,
                    tickPadding: 8,
                    tickRotation: 0,
                    legendOffset: -50,
                    legendPosition: "middle",
                    format: (value) => {
                      if (selectedMetric === "spent") {
                        return `R$${(value / 1000).toFixed(0)}k`
                      }
                      return value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value.toString()
                    },
                  }}
                  colors={["#10b981"]}
                  pointSize={6}
                  pointColor={{ theme: "background" }}
                  pointBorderWidth={2}
                  pointBorderColor={{ from: "serieColor" }}
                  pointLabelYOffset={-12}
                  enableArea={true}
                  areaOpacity={0.15}
                  useMesh={true}
                  enableGridX={false}
                  theme={{
                    text: {
                      fontSize: 10,
                      fill: "#6b7280",
                    },
                    axis: {
                      ticks: {
                        text: {
                          fontSize: 10,
                          fill: "#6b7280",
                        },
                      },
                    },
                  }}
                  tooltip={({ point }) => (
                    <div className="bg-white px-2 py-1 shadow-lg rounded border border-gray-200">
                      <div className="text-xs">
                        <strong>{point.data.xFormatted}</strong>
                        <br />
                        {formatMetricValue(point.data.y as number, selectedMetric)}
                      </div>
                    </div>
                  )}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Menu de Navegação Minimalista */}
      <div className="flex-1 min-h-0">
        <div className="bg-gradient-to-r from-blue-600 to-green-700 rounded-lg px-4 py-2 mb-3 shadow-md">
          <h2 className="text-base font-bold text-white">Navegação do Dashboard</h2>
        </div>
        <div className="grid grid-cols-4 gap-3 overflow-y-auto">
          {navigationCards.map((card, index) => (
            <Link
              key={index}
              to={card.path}
              className="group card-overlay rounded-lg shadow-md p-3 hover:shadow-lg transition-all duration-300 h-fit"
            >
              <div className="flex flex-col items-center text-center space-y-2">
                <div
                  className={`${card.color} p-2 rounded-lg text-white group-hover:scale-110 transition-transform duration-300`}
                >
                  {card.icon}
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-gray-900 group-hover:text-blue-600 transition-colors duration-300 line-clamp-2">
                    {card.title}
                  </h3>
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

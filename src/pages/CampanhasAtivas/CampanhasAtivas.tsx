"use client"

import type React from "react"
import { useState, useMemo } from "react"
import { ResponsiveLine } from "@nivo/line"
import { TrendingUp, BarChart3, DollarSign, Eye, MousePointerClick, Play } from "lucide-react"
import { useConsolidadoGeral } from "../../services/consolidadoApi"
import Loading from "../../components/Loading/Loading"

type MetricType = "impressions" | "clicks" | "videoViews" | "spent"

const CampanhasAtivas: React.FC = () => {
  const { campaigns, last7Days, loading: consolidadoLoading, error: consolidadoError, data: consolidadoData } = useConsolidadoGeral()

  const [selectedMetric, setSelectedMetric] = useState<MetricType>("impressions")
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null)

  // Filtrar dados dos últimos 7 dias por campanha selecionada
  const filteredLast7Days = useMemo(() => {
    if (!selectedCampaign || !consolidadoData?.success || !consolidadoData?.data?.values) return last7Days

    const headers = consolidadoData.data.values[0]
    const rows = consolidadoData.data.values.slice(1)

    const dateIndex = headers.indexOf("Date")
    const campaignIndex = headers.indexOf("Campanha")
    const spentIndex = headers.indexOf("Total spent")
    const impressionsIndex = headers.indexOf("Impressions")
    const clicksIndex = headers.indexOf("Clicks")
    const videoViewsIndex = headers.indexOf("Video views")

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
  }, [selectedCampaign, consolidadoData, last7Days])

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

  // Calcular métricas totais dos últimos 7 dias
  const last7DaysMetrics = useMemo(() => {
    const totals = filteredLast7Days.reduce(
      (acc, day) => ({
        spent: acc.spent + day.spent,
        impressions: acc.impressions + day.impressions,
        clicks: acc.clicks + day.clicks,
        videoViews: acc.videoViews + day.videoViews,
      }),
      { spent: 0, impressions: 0, clicks: 0, videoViews: 0 }
    )

    const cpm = totals.impressions > 0 ? (totals.spent / totals.impressions) * 1000 : 0
    const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0
    const vtr = totals.impressions > 0 ? (totals.videoViews / totals.impressions) * 100 : 0

    return {
      ...totals,
      cpm,
      ctr,
      vtr,
    }
  }, [filteredLast7Days])

  // Handler para clicar em uma campanha
  const handleCampaignClick = (campaignName: string) => {
    setSelectedCampaign(selectedCampaign === campaignName ? null : campaignName)
  }

  // Formatar valor baseado na métrica
  const formatMetricValue = (value: number, metric?: MetricType): string => {
    if (metric === "spent") {
      return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(value)
    }
    return new Intl.NumberFormat("pt-BR").format(Math.round(value))
  }

  // Formatar número
  const formatNumber = (value: number): string => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`
    }
    return value.toLocaleString("pt-BR")
  }

  if (consolidadoLoading) {
    return <Loading message="Carregando campanhas ativas..." />
  }

  if (consolidadoError) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-red-500">Erro ao carregar dados das campanhas</div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col space-y-4 overflow-auto">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-2xl shadow-2xl h-44">
        <div className="relative h-full bg-gradient-to-r from-blue-400 via-blue-500 to-blue-600">
          <img
            src="/images/fundo_card.webp"
            alt="Campanhas Ativas - Banco da Amazônia"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/20"></div>
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <div className="bg-white/95 backdrop-blur-sm rounded-xl p-4 shadow-lg max-w-2xl">
              <h1 className="text-2xl font-bold text-gray-900 mb-1">Campanhas Ativas</h1>
              <p className="text-base text-gray-700">Veiculação dos últimos 7 dias</p>
            </div>
          </div>
        </div>
      </div>

      {/* Cards de Métricas dos Últimos 7 Dias */}
      <div className="grid grid-cols-5 gap-3">
        {/* Card Investimento */}
        <div className="card-overlay rounded-lg shadow p-3">
          <div className="flex items-center space-x-2 mb-2">
            <div className="p-1.5 bg-blue-50 rounded">
              <DollarSign className="w-4 h-4 text-blue-600" />
            </div>
            <p className="text-xs text-gray-600">Investimento</p>
          </div>
          <p className="text-lg font-bold text-gray-900">{formatMetricValue(last7DaysMetrics.spent, "spent")}</p>
        </div>

        {/* Card Impressões */}
        <div className="card-overlay rounded-lg shadow p-3">
          <div className="flex items-center space-x-2 mb-2">
            <div className="p-1.5 bg-purple-50 rounded">
              <Eye className="w-4 h-4 text-purple-600" />
            </div>
            <p className="text-xs text-gray-600">Impressões</p>
          </div>
          <p className="text-lg font-bold text-gray-900">{formatNumber(last7DaysMetrics.impressions)}</p>
        </div>

        {/* Card Cliques */}
        <div className="card-overlay rounded-lg shadow p-3">
          <div className="flex items-center space-x-2 mb-2">
            <div className="p-1.5 bg-green-50 rounded">
              <MousePointerClick className="w-4 h-4 text-green-600" />
            </div>
            <p className="text-xs text-gray-600">Cliques</p>
          </div>
          <p className="text-lg font-bold text-gray-900">{formatNumber(last7DaysMetrics.clicks)}</p>
        </div>

        {/* Card Visualizações */}
        <div className="card-overlay rounded-lg shadow p-3">
          <div className="flex items-center space-x-2 mb-2">
            <div className="p-1.5 bg-orange-50 rounded">
              <Play className="w-4 h-4 text-orange-600" />
            </div>
            <p className="text-xs text-gray-600">Visualizações</p>
          </div>
          <p className="text-lg font-bold text-gray-900">{formatNumber(last7DaysMetrics.videoViews)}</p>
        </div>

        {/* Card Resumo de Métricas */}
        <div className="card-overlay rounded-lg shadow p-3">
          <div className="flex items-center space-x-2 mb-3">
            <div className="p-1.5 bg-gray-50 rounded">
              <BarChart3 className="w-4 h-4 text-gray-600" />
            </div>
            <p className="text-xs text-gray-600 font-medium">Resumo</p>
          </div>
          <div className="space-y-2">
            {/* CPM */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-600">CPM:</span>
              <span className="text-sm font-bold text-blue-900">{formatMetricValue(last7DaysMetrics.cpm, "spent")}</span>
            </div>
            {/* CTR */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-600">CTR:</span>
              <span className="text-sm font-bold text-green-900">{last7DaysMetrics.ctr.toFixed(2)}%</span>
            </div>
            {/* VTR */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-600">VTR:</span>
              <span className="text-sm font-bold text-orange-900">{last7DaysMetrics.vtr.toFixed(2)}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Análise dos Últimos 7 Dias */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Card de Campanhas Ativas */}
        <div className="card-overlay rounded-xl shadow-lg p-5 h-96 flex flex-col">
          <h2 className="text-base font-bold text-gray-900 mb-3 flex items-center">
            <BarChart3 className="w-4 h-4 mr-2 text-blue-600" />
            Campanhas Ativas ({campaigns.length})
          </h2>

          {consolidadoLoading && (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm text-gray-500">Carregando campanhas...</p>
            </div>
          )}

          {consolidadoError && (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm text-red-500">Erro ao carregar campanhas</p>
            </div>
          )}

          {!consolidadoLoading && !consolidadoError && campaigns.length > 0 && (
            <div className="flex-1 overflow-y-auto space-y-2">
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
                  <div
                    className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                      campaign.isActive ? "bg-green-500" : "bg-gray-400"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{campaign.name}</p>
                    <p className="text-xs text-gray-600">
                      {formatMetricValue(campaign.totalSpent, "spent")} • {formatNumber(campaign.impressions)} impressões
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Gráfico de Métricas dos Últimos 7 Dias */}
        <div className="card-overlay rounded-xl shadow-lg p-5 h-96 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              <h2 className="text-base font-bold text-gray-900">
                Últimos 7 Dias
                {selectedCampaign && <span className="text-sm font-normal text-blue-600 ml-2">• {selectedCampaign}</span>}
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

          {!consolidadoLoading && !consolidadoError && chartData.length > 0 && (
            <>
              <div className="mb-2">
                <p className="text-xs text-gray-600">Total do Período</p>
                <p className="text-lg font-bold text-green-600">{formatMetricValue(totalMetric, selectedMetric)}</p>
              </div>

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
    </div>
  )
}

export default CampanhasAtivas

"use client"

import type React from "react"
import { useState, useEffect, useMemo } from "react"
import { Play, Calendar, Filter, ShoppingCart, Info } from "lucide-react"
import { useConsolidadoData } from "../../services/api"
import Loading from "../../components/Loading/Loading"

interface ProcessedData {
  date: string
  platform: string
  campaignName: string
  impressions: number
  cost: number
  reach: number
  clicks: number
  frequency: number
  cpm: number
  linkClicks: number
  videoViews: number
  videoViews25: number
  videoViews50: number
  videoViews75: number
  videoCompletions: number
  cpv: number
  cpvc: number
  vtr100: number
  tipoCompra: string
}

interface PlatformMetrics {
  platform: string
  impressions: number
  cost: number
  reach: number
  clicks: number
  cpm: number
  frequency: number
  linkClicks: number
  videoViews: number
  videoViews25: number
  videoViews50: number
  videoViews75: number
  videoCompletions: number
  cpv: number
  cpvc: number
  vtr100: number
  color: string
  percentage: number
  vtrPercentage: number
  visualizacoesPercentage: number
  tiposCompra: string[]
}

const Visualizacoes: React.FC = () => {
  const { data: apiData, loading, error } = useConsolidadoData()
  const [processedData, setProcessedData] = useState<ProcessedData[]>([])
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: "", end: "" })
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])
  const [selectedTiposCompra, setSelectedTiposCompra] = useState<string[]>([])
  const [availablePlatforms, setAvailablePlatforms] = useState<string[]>([])
  const [availableTiposCompra, setAvailableTiposCompra] = useState<string[]>([])

  // Cores para as plataformas (seguindo o modelo da imagem)
  const platformColors: Record<string, string> = {
    YouTube: "#ff6b6b", // Rosa/vermelho claro
    TikTok: "#ff4757", // Vermelho
    Google: "#5f27cd", // Roxo escuro
    Netflix: "#341f97", // Roxo
    Meta: "#74b9ff", // Azul claro
    Spotify: "#0984e3", // Azul
    Kwai: "#fdcb6e", // Amarelo/laranja
    Band: "#e17055", // Laranja
    "Catraca Livre": "#00b894", // Verde
    "Globo.com": "#00a085", // Verde escuro
    Pinterest: "#bd081c", // Vermelho Pinterest
    LinkedIn: "#0077B5",
    GDN: "#34A853",
    "Demand-Gen": "#EA4335",
    Default: "#6c5ce7",
  }

  // Cores para tipos de compra
  const tipoCompraColors: Record<string, string> = {
    CPM: "#3B82F6", // Azul
    CPC: "#10B981", // Verde
    CPV: "#F59E0B", // Amarelo/Laranja
    Default: "#6B7280", // Cinza
  }

  // Função para ordenar tipos de compra na ordem correta
  const sortTiposCompra = (tipos: string[]): string[] => {
    const ordem = ["CPM", "CPC", "CPV"]
    return tipos.sort((a, b) => {
      const indexA = ordem.indexOf(a)
      const indexB = ordem.indexOf(b)
      if (indexA === -1) return 1
      if (indexB === -1) return -1
      return indexA - indexB
    })
  }

  // Função para converter data brasileira DD/MM/YYYY para formato ISO YYYY-MM-DD
  const convertBrazilianDate = (dateStr: string): string => {
    if (!dateStr) return ""
    const [day, month, year] = dateStr.split("/")
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
  }

  // Processar dados da API
  useEffect(() => {
    if (apiData?.values) {
      const headers = apiData.values[0]
      const rows = apiData.values.slice(1)

      const processed: ProcessedData[] = rows
        .map((row: string[]) => {
          const parseNumber = (value: string) => {
            if (!value) return 0
            return Number.parseFloat(value.replace(/[R$\s.]/g, "").replace(",", ".")) || 0
          }

          const parseInteger = (value: string) => {
            if (!value) return 0
            return Number.parseInt(value.replace(/[.\s]/g, "").replace(",", "")) || 0
          }

          const impressions = parseInteger(row[headers.indexOf("Impressions")])
          const videoViews = parseInteger(row[headers.indexOf("Video views ")])
          const videoCompletions = parseInteger(row[headers.indexOf("Video completions ")])

          return {
            date: row[headers.indexOf("Date")] || "",
            platform: row[headers.indexOf("Veículo")] || "Outros",
            campaignName: row[headers.indexOf("Campaign name")] || "",
            impressions: impressions,
            cost: parseNumber(row[headers.indexOf("Total spent")]),
            reach: parseInteger(row[headers.indexOf("Reach")]),
            clicks: parseInteger(row[headers.indexOf("Clicks")]),
            frequency: parseNumber(row[headers.indexOf("Frequency")]) || 1,
            cpm: parseNumber(row[headers.indexOf("CPM")]),
            linkClicks: parseInteger(row[headers.indexOf("Link clicks")]),
            videoViews: videoViews,
            videoViews25: parseInteger(row[headers.indexOf("Video views at 25%")]),
            videoViews50: parseInteger(row[headers.indexOf("Video views at 50%")]),
            videoViews75: parseInteger(row[headers.indexOf("Video views at 75%")]),
            videoCompletions: parseInteger(row[headers.indexOf("Video completions ")]),
            cpv:
              parseNumber(row[headers.indexOf("CPV")]) ||
              (videoViews > 0 ? parseNumber(row[headers.indexOf("Total spent")]) / videoViews : 0),
            cpvc: parseNumber(row[headers.indexOf("CPVc")]) || parseNumber(row[headers.indexOf("CPV")]) * 0.8,
            vtr100: impressions > 0 && videoCompletions > 0 ? (videoCompletions / impressions) * 100 : 0,
            tipoCompra: row[headers.indexOf("Tipo de Compra")] || "CPM",
          } as ProcessedData
        })
        .filter((item: ProcessedData) => item.date && item.impressions > 0 && item.videoViews > 0) // Filtrar apenas itens com video views

      setProcessedData(processed)

      // Definir range de datas inicial
      if (processed.length > 0) {
        const validDates = processed
          .map((item) => convertBrazilianDate(item.date))
          .filter(Boolean)
          .sort()

        if (validDates.length > 0) {
          setDateRange({
            start: validDates[0],
            end: validDates[validDates.length - 1],
          })
        }
      }

      // Extrair plataformas únicas (apenas as que têm video views)
      const platformSet = new Set<string>()
      processed.forEach((item) => {
        if (item.platform && item.videoViews > 0) {
          platformSet.add(item.platform)
        }
      })
      const platforms = Array.from(platformSet).filter(Boolean)
      setAvailablePlatforms(platforms)
      setSelectedPlatforms([]) // Inicialmente nenhuma plataforma selecionada

      // Extrair tipos de compra únicos
      const tipoCompraSet = new Set<string>()
      processed.forEach((item) => {
        if (item.tipoCompra) {
          tipoCompraSet.add(item.tipoCompra)
        }
      })
      const tiposCompra = Array.from(tipoCompraSet).filter(Boolean)
      setAvailableTiposCompra(tiposCompra)
      setSelectedTiposCompra([])
    }
  }, [apiData])

  // Filtrar dados por data, plataforma e tipo de compra
  const filteredData = useMemo(() => {
    let filtered = processedData

    // Filtro por data
    if (dateRange.start && dateRange.end) {
      filtered = filtered.filter((item) => {
        const itemDateISO = convertBrazilianDate(item.date)
        if (!itemDateISO) return false

        const itemDate = new Date(itemDateISO)
        const startDate = new Date(dateRange.start)
        const endDate = new Date(dateRange.end)
        return itemDate >= startDate && itemDate <= endDate
      })
    }

    // Filtro por plataforma
    if (selectedPlatforms.length > 0) {
      filtered = filtered.filter((item) => selectedPlatforms.includes(item.platform))
    }

    // Filtro por tipo de compra
    if (selectedTiposCompra.length > 0) {
      filtered = filtered.filter((item) => selectedTiposCompra.includes(item.tipoCompra))
    }

    return filtered
  }, [processedData, dateRange, selectedPlatforms, selectedTiposCompra])

  // Calcular métricas por plataforma
  const platformMetrics = useMemo(() => {
    const metrics: Record<string, PlatformMetrics> = {}

    filteredData.forEach((item) => {
      if (!metrics[item.platform]) {
        metrics[item.platform] = {
          platform: item.platform,
          impressions: 0,
          cost: 0,
          reach: 0,
          clicks: 0,
          cpm: 0,
          frequency: 0,
          linkClicks: 0,
          videoViews: 0,
          videoViews25: 0,
          videoViews50: 0,
          videoViews75: 0,
          videoCompletions: 0,
          cpv: 0,
          cpvc: 0,
          vtr100: 0,
          color: platformColors[item.platform] || platformColors.Default,
          percentage: 0,
          vtrPercentage: 0,
          visualizacoesPercentage: 0,
          tiposCompra: [],
        }
      }

      metrics[item.platform].impressions += item.impressions
      metrics[item.platform].cost += item.cost
      metrics[item.platform].reach += item.reach
      metrics[item.platform].clicks += item.clicks
      metrics[item.platform].linkClicks += item.linkClicks
      metrics[item.platform].videoViews += item.videoViews
      metrics[item.platform].videoViews25 += item.videoViews25
      metrics[item.platform].videoViews50 += item.videoViews50
      metrics[item.platform].videoViews75 += item.videoViews75
      metrics[item.platform].videoCompletions += item.videoCompletions

      // Adicionar tipo de compra se não existir
      if (!metrics[item.platform].tiposCompra.includes(item.tipoCompra)) {
        metrics[item.platform].tiposCompra.push(item.tipoCompra)
      }
    })

    // Calcular médias e percentuais
    const totalCost = Object.values(metrics).reduce((sum, metric) => sum + metric.cost, 0)
    const totalVisualizacoes = Object.values(metrics).reduce((sum, metric) => sum + metric.videoViews, 0)
    const maxVtr = Math.max(...Object.values(metrics).map((m) => m.vtr100))

    Object.values(metrics).forEach((metric) => {
      const platformData = filteredData.filter((item) => item.platform === metric.platform)
      if (platformData.length > 0) {
        metric.cpm = metric.cost / (metric.impressions / 1000)
        metric.frequency = metric.reach > 0 ? metric.impressions / metric.reach : 0
        metric.cpv = metric.videoViews > 0 ? metric.cost / metric.videoViews : 0
        metric.cpvc = metric.cpv * 0.8 // Estimativa
        metric.vtr100 = metric.impressions > 0 ? (metric.videoCompletions / metric.impressions) * 100 : 0
        metric.percentage = totalCost > 0 ? (metric.cost / totalCost) * 100 : 0
        metric.visualizacoesPercentage = totalVisualizacoes > 0 ? (metric.videoViews / totalVisualizacoes) * 100 : 0
        metric.vtrPercentage = maxVtr > 0 ? (metric.vtr100 / maxVtr) * 100 : 0
        // Ordenar tipos de compra
        metric.tiposCompra = sortTiposCompra(metric.tiposCompra)
      }
    })

    return Object.values(metrics).sort((a, b) => b.cost - a.cost)
  }, [filteredData])

  // Calcular totais
  const totals = useMemo(() => {
    const totalInvestment = filteredData.reduce((sum, item) => sum + item.cost, 0)
    const totalImpressions = filteredData.reduce((sum, item) => sum + item.impressions, 0)
    const totalVideoViews = filteredData.reduce((sum, item) => sum + item.videoCompletions, 0)
    const avgVtr100 = totalImpressions > 0 ? (totalVideoViews / totalImpressions) * 100 : 0
    const avgCpv = totalVideoViews > 0 ? totalInvestment / totalVideoViews : 0
    const avgCpvc = avgCpv * 0.8

    return {
      investment: totalInvestment,
      impressions: totalImpressions,
      videoViews: totalVideoViews,
      vtr100: avgVtr100,
      cpv: avgCpv,
      cpvc: avgCpvc,
    }
  }, [filteredData])

  // Função para formatar números
  const formatNumber = (value: number): string => {
    if (value >= 1000000000) {
      return `${(value / 1000000000).toFixed(1)} bi`
    }
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)} mi`
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(0)} mil`
    }
    return value.toLocaleString("pt-BR")
  }

  // Função para formatar moeda
  const formatCurrency = (value: number): string => {
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    })
  }

  // Função para alternar seleção de plataforma
  const togglePlatform = (platform: string) => {
    setSelectedPlatforms((prev) => {
      if (prev.includes(platform)) {
        return prev.filter((p) => p !== platform)
      }
      return [...prev, platform]
    })
  }

  // Função para alternar seleção de tipo de compra
  const toggleTipoCompra = (tipoCompra: string) => {
    setSelectedTiposCompra((prev) => {
      if (prev.includes(tipoCompra)) {
        return prev.filter((t) => t !== tipoCompra)
      }
      return [...prev, tipoCompra]
    })
  }

  // Componente de curva de retenção (agora gráfico de barras)
  const RetentionCurveChart: React.FC<{ data: PlatformMetrics[] }> = ({ data }) => {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold text-gray-900">Curva de Retenção por Veículo</h3>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 max-w-md">
            <div className="text-sm text-blue-800">
              <strong>VTR (Video Through Rate):</strong> Percentual de pessoas que assistiram o vídeo completo em
              relação ao total de impressões.
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {data.map((platform, index) => {
            // Calcular percentuais de retenção
            const retention25 = platform.videoViews > 0 ? (platform.videoViews25 / platform.videoViews) * 100 : 0
            const retention50 = platform.videoViews > 0 ? (platform.videoViews50 / platform.videoViews) * 100 : 0
            const retention75 = platform.videoViews > 0 ? (platform.videoViews75 / platform.videoViews) * 100 : 0
            const retention100 = platform.videoViews > 0 ? (platform.videoCompletions / platform.videoViews) * 100 : 0

            // Determine if 25%, 50%, 75% data is all zero
            const hasIntermediateData =
              platform.videoViews25 > 0 || platform.videoViews50 > 0 || platform.videoViews75 > 0

            const retentionPoints = hasIntermediateData
              ? [
                  { x: 0, y: 100, label: "Início" },
                  { x: 25, y: retention25, label: "25%" },
                  { x: 50, y: retention50, label: "50%" },
                  { x: 75, y: retention75, label: "75%" },
                  { x: 100, y: retention100, label: "100%" },
                ]
              : [
                  { x: 0, y: 100, label: "Início" },
                  { x: 100, y: retention100, label: "100%" },
                ]

            const chartWidth = 300
            const chartHeight = 100
            const barWidth = hasIntermediateData ? 30 : 60 // Wider bars if only two points
            const barSpacing = hasIntermediateData ? 20 : 100 // Adjust spacing based on number of bars
            const totalBarsWidth = retentionPoints.length * barWidth + (retentionPoints.length - 1) * barSpacing
            const startX = (chartWidth - totalBarsWidth) / 2

            return (
              <div key={index} className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: platform.color }} />
                    <h4 className="font-semibold text-gray-900">{platform.platform}</h4>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-600">VTR</div>
                    <div className="text-lg font-bold" style={{ color: platform.color }}>
                      {platform.vtr100.toFixed(2)}%
                    </div>
                  </div>
                </div>

                <div className="relative h-32 bg-gray-50 rounded-lg p-2 flex items-end justify-center">
                  <svg
                    width="100%"
                    height="100%"
                    viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                    className="overflow-visible"
                  >
                    {/* Y-axis labels */}
                    {[0, 25, 50, 75, 100].map((value) => (
                      <text
                        key={value}
                        x={-10}
                        y={chartHeight - value + 3}
                        textAnchor="end"
                        className="text-xs fill-gray-500"
                      >
                        {value}%
                      </text>
                    ))}

                    {/* Bars */}
                    {retentionPoints.map((point, i) => {
                      const barHeight = (point.y / 100) * chartHeight
                      const xPos = startX + i * (barWidth + barSpacing)
                      const yPos = chartHeight - barHeight
                      return (
                        <g key={i}>
                          <rect
                            x={xPos}
                            y={yPos}
                            width={barWidth}
                            height={barHeight}
                            fill={platform.color}
                            rx="4"
                            ry="4"
                          />
                          <text
                            x={xPos + barWidth / 2}
                            y={yPos - 5}
                            textAnchor="middle"
                            className="text-xs font-medium"
                            fill={platform.color}
                          >
                            {point.y.toFixed(2)}%
                          </text>
                          <text
                            x={xPos + barWidth / 2}
                            y={chartHeight + 15}
                            textAnchor="middle"
                            className="text-xs fill-gray-500"
                          >
                            {point.label}
                          </text>
                        </g>
                      )
                    })}
                  </svg>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                  <div>
                    <span className="font-medium">Total Views:</span> {formatNumber(platform.videoViews)}
                  </div>
                  <div>
                    <span className="font-medium">Completions:</span> {formatNumber(platform.videoCompletions)}
                  </div>
                  <div>
                    <span className="font-medium">CPV:</span> {formatCurrency(platform.cpv)}
                  </div>
                  <div>
                    <span className="font-medium">Investimento:</span> {formatCurrency(platform.cost)}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 mb-2">Como interpretar a curva de retenção:</h4>
          <div className="text-sm text-gray-700 space-y-1">
            <p>
              • <strong>Início (0%):</strong> 100% das pessoas que começaram a assistir o vídeo
            </p>
            <p>
              • <strong>25%, 50%, 75%:</strong> Percentual de pessoas que continuaram assistindo até esse ponto
            </p>
            <p>
              • <strong>100%:</strong> Percentual de pessoas que assistiram o vídeo completo
            </p>
            <p>
              • <strong>VTR:</strong> Video Through Rate - percentual de visualizações completas em relação às
              impressões totais
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Componente de gráfico de barras verticais
  const VerticalBarChart: React.FC<{
    title: string
    data: PlatformMetrics[]
    getValue: (item: PlatformMetrics) => number
    format?: (value: number) => string
    showPercentage?: boolean
  }> = ({ title, data, getValue, format = formatNumber, showPercentage = false }) => {
    const maxValue = Math.max(...data.map(getValue))

    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <div className="flex items-end space-x-2 h-32">
          {data.slice(0, 8).map((item, index) => {
            const value = getValue(item)
            const height = maxValue > 0 ? (value / maxValue) * 100 : 0

            return (
              <div key={index} className="flex-1 flex flex-col items-center space-y-1">
                <div className="w-full flex flex-col items-center">
                  <div
                    className="w-full rounded-t transition-all duration-500 flex items-end justify-center text-xs font-medium text-white p-1"
                    style={{
                      height: `${height}%`,
                      backgroundColor: item.color,
                      minHeight: value > 0 ? "20px" : "0",
                    }}
                  >
                    {value > 0 && (
                      <span className="text-center">{showPercentage ? `${value.toFixed(2)}%` : format(value)}</span>
                    )}
                  </div>
                </div>
                <span className="text-xs text-gray-600 text-center truncate w-full">{item.platform}</span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  if (loading) {
    return <Loading message="Carregando dados de visualizações..." />
  }

  if (error) {
    return (
      <div className="bg-red-50/90 backdrop-blur-sm border border-red-200 rounded-lg p-4">
        <p className="text-red-600">Erro ao carregar dados: {error.message}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-r from-pink-500 to-red-600 rounded-lg flex items-center justify-center">
            <Play className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 text-enhanced">Visualizações</h1>
            <p className="text-gray-600">Análise de visualizações de vídeo</p>
          </div>
        </div>
        <div className="text-sm text-gray-600 bg-white/80 backdrop-blur-sm px-3 py-1 rounded-lg">
          Última atualização: {new Date().toLocaleString("pt-BR")}
        </div>
      </div>

      {/* Filtros */}
      <div className="card-overlay rounded-lg shadow-lg p-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Filtro de Data */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
              <Calendar className="w-4 h-4 mr-2" />
              Período
            </label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          </div>

          {/* Filtro de Plataforma */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
              <Filter className="w-4 h-4 mr-2" />
              Plataforma
            </label>
            <div className="flex flex-wrap gap-2">
              {availablePlatforms.map((platform) => (
                <button
                  key={platform}
                  onClick={() => togglePlatform(platform)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors duration-200 ${
                    selectedPlatforms.includes(platform)
                      ? "bg-blue-100 text-blue-800 border border-blue-300"
                      : "bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200"
                  }`}
                  style={{
                    backgroundColor: selectedPlatforms.includes(platform) ? platformColors[platform] + "20" : undefined,
                    borderColor: selectedPlatforms.includes(platform) ? platformColors[platform] : undefined,
                    color: selectedPlatforms.includes(platform) ? platformColors[platform] : undefined,
                  }}
                >
                  {platform}
                </button>
              ))}
            </div>
          </div>

          {/* Filtro de Tipo de Compra */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
              <ShoppingCart className="w-4 h-4 mr-2" />
              Tipo de Compra
            </label>
            <div className="flex flex-wrap gap-2">
              {availableTiposCompra.map((tipoCompra) => (
                <button
                  key={tipoCompra}
                  onClick={() => toggleTipoCompra(tipoCompra)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors duration-200 ${
                    selectedTiposCompra.includes(tipoCompra)
                      ? "bg-blue-100 text-blue-800 border border-blue-300"
                      : "bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200"
                  }`}
                  style={{
                    backgroundColor: selectedTiposCompra.includes(tipoCompra)
                      ? tipoCompraColors[tipoCompra] + "20"
                      : undefined,
                    borderColor: selectedTiposCompra.includes(tipoCompra) ? tipoCompraColors[tipoCompra] : undefined,
                    color: selectedTiposCompra.includes(tipoCompra) ? tipoCompraColors[tipoCompra] : undefined,
                  }}
                >
                  {tipoCompra}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Métricas Principais */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="card-overlay rounded-lg shadow-lg p-4 text-center min-h-[100px] flex flex-col justify-center">
          <div className="text-sm text-gray-600 mb-1">Investimento total</div>
          <div className="text-2xl font-bold text-gray-900">R$ {formatNumber(totals.investment)}</div>
        </div>

        <div className="card-overlay rounded-lg shadow-lg p-4 text-center min-h-[100px] flex flex-col justify-center">
          <div className="text-sm text-gray-600 mb-1">VTR 100%</div>
          <div className="text-2xl font-bold text-gray-900">{totals.vtr100.toFixed(2)}%</div>
        </div>

        <div className="card-overlay rounded-lg shadow-lg p-4 text-center min-h-[100px] flex flex-col justify-center">
          <div className="text-sm text-gray-600 mb-1">Vis. de vídeo 100%</div>
          <div className="text-2xl font-bold text-gray-900">{formatNumber(totals.videoViews)}</div>
        </div>

        <div className="card-overlay rounded-lg shadow-lg p-4 text-center min-h-[100px] flex flex-col justify-center">
          <div className="text-sm text-gray-600 mb-1">CPV Médio</div>
          <div className="text-2xl font-bold text-gray-900">{formatCurrency(totals.cpv)}</div>
        </div>

        <div className="card-overlay rounded-lg shadow-lg p-4 text-center min-h-[100px] flex flex-col justify-center">
          <div className="text-sm text-gray-600 mb-1">CPVc Médio</div>
          <div className="text-2xl font-bold text-gray-900">{formatCurrency(totals.cpvc)}</div>
        </div>
      </div>

      {/* Gráficos */}
      <div className="card-overlay rounded-lg shadow-lg p-6">
        <RetentionCurveChart data={platformMetrics} />
      </div>

      {/* Tabela Detalhada */}
      <div className="flex-1 card-overlay rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Dados Detalhados por Plataforma</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-blue-600 text-white">
                <th className="text-left py-3 px-4 font-semibold">#</th>
                <th className="text-left py-3 px-4 font-semibold">Plataforma</th>
                <th className="text-left py-3 px-4 font-semibold">Tipo de Compra</th>
                <th className="text-right py-3 px-4 font-semibold">Investimento</th>
                <th className="text-right py-3 px-4 font-semibold">CPM</th>
                <th className="text-right py-3 px-4 font-semibold">CPV*</th>
                <th className="text-right py-3 px-4 font-semibold">CPVc*</th>
                <th className="text-right py-3 px-4 font-semibold">VTR 100%</th>
              </tr>
            </thead>
            <tbody>
              {platformMetrics.map((metric, index) => (
                <tr key={index} className={index % 2 === 0 ? "bg-blue-50" : "bg-white"}>
                  <td className="py-3 px-4 font-medium">{index + 1}.</td>
                  <td className="py-3 px-4 font-medium">{metric.platform}</td>
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap gap-1">
                      {metric.tiposCompra.map((tipo, tipoIndex) => (
                        <span
                          key={tipoIndex}
                          className="px-2 py-1 rounded-full text-xs font-medium text-white"
                          style={{ backgroundColor: tipoCompraColors[tipo] || tipoCompraColors.Default }}
                        >
                          {tipo}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right font-semibold">{formatCurrency(metric.cost)}</td>
                  <td className="py-3 px-4 text-right">{formatCurrency(metric.cpm)}</td>
                  <td className="py-3 px-4 text-right">{formatCurrency(metric.cpv)}</td>
                  <td className="py-3 px-4 text-right">{formatCurrency(metric.cpvc)}</td>
                  <td className="py-3 px-4 text-right">{metric.vtr100.toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Observações */}
        <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <div className="text-sm text-gray-700">
            <strong>*CPV:</strong> custo/visualizações 50%
            <br />
            <strong>**CPVc:</strong> custo/visualizações 100%
          </div>
        </div>
      </div>

      {/* Alerta Informativo */}
      <div className="bg-blue-50/90 backdrop-blur-sm border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <Info className="w-5 h-5 text-blue-600 mt-0.5" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-blue-900 mb-1">Informações sobre Métricas de Vídeo</h3>
            <p className="text-sm text-blue-700">
              As métricas de <strong>visualizações</strong> e <strong>VTR</strong> são baseadas nos dados fornecidos
              pelas plataformas. O <strong>CPV</strong> representa o custo por visualização (50% do vídeo) e o{" "}
              <strong>CPVc</strong> o custo por visualização completa (100%). Estes valores podem variar conforme as
              configurações de campanha e as definições específicas de cada plataforma.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Visualizacoes

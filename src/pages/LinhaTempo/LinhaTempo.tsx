"use client"

import type React from "react"
import { useState, useEffect, useMemo, useRef } from "react"
import { ResponsiveLine } from "@nivo/line"
import { Calendar, Filter, TrendingUp, Play, Info, DollarSign, MousePointer, Eye, BarChart3 } from "lucide-react"
import { useData } from "../../contexts/DataContext"
import Loading from "../../components/Loading/Loading"
import PDFDownloadButton from "../../components/PDFDownloadButton/PDFDownloadButton"
import AnaliseSemanal from "./components/AnaliseSemanal"

interface DataPoint {
  date: string
  campaignName: string
  creativeTitle: string
  platform: string
  reach: number
  impressions: number
  clicks: number
  totalSpent: number // Investimento
  videoViews: number
  videoViews25: number
  videoViews50: number
  videoViews75: number
  videoCompletions: number
  totalEngagements: number
  veiculo: string
  tipoCompra: string
}

interface ChartData {
  id: string
  data: Array<{
    x: string
    y: number
  }>
}

interface VehicleEntry {
  platform: string
  firstDate: string
  color: string
}

const LinhaTempo: React.FC = () => {
  const contentRef = useRef<HTMLDivElement>(null)
  const { data, campaigns, loading, error } = useData()
  const [processedData, setProcessedData] = useState<DataPoint[]>([])
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: "", end: "" })
  const [selectedVehicles, setSelectedVehicles] = useState<string[]>([])
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null)
  const [availableVehicles, setAvailableVehicles] = useState<string[]>([])
  const [isWeeklyAnalysis, setIsWeeklyAnalysis] = useState(false)
  const [filteredData, setFilteredData] = useState<DataPoint[]>([])
  const [selectedMetric, setSelectedMetric] = useState<
    "impressions" | "clicks" | "totalSpent" | "videoViews" | "cpm" | "cpc" | "ctr" | "vtr"
  >("impressions")

  // Cores para diferentes plataformas/veículos
  const platformColors: Record<string, string> = {
    TikTok: "#ff0050",
    LinkedIn: "#0077b5",
    Meta: "#0668E1",
    Spotify: "#1DB954",
    Band: "#ffd700",
    "Brasil 247": "#ff4500",
    GDN: "#4285f4",
    "Demand-Gen": "#34a853",
    "Portal Forum": "#8b4513",
    YouTube: "#ff0000",
    Pinterest: "#bd081c",
    Default: "#6366f1", // Cor padrão para veículos não mapeados
  }

  // Função para criar datas locais sem problemas de timezone
  const createLocalDate = (dateStr: string) => {
    if (!dateStr) return new Date()
    const parts = dateStr.split("-")
    if (parts.length !== 3) return new Date()
    const [year, month, day] = parts
    return new Date(Number.parseInt(year), Number.parseInt(month) - 1, Number.parseInt(day))
  }

  // Processar dados da API
  useEffect(() => {
    if (data?.success && data?.data?.values) {
      const headers = data.data.values[0]
      const rows = data.data.values.slice(1)

      const processed: DataPoint[] = rows
        .map((row: any[]) => {
          const parseNumber = (value: string | number) => {
            if (!value || value === "" || value === null || value === undefined) return 0
            const stringValue = value.toString()
            const cleanValue = stringValue
              .replace(/R\$\s*/g, "")
              .replace(/\./g, "")
              .replace(",", ".")
              .trim()
            const parsed = Number.parseFloat(cleanValue)
            return isNaN(parsed) ? 0 : parsed
          }

          const parseInteger = (value: string | number) => {
            if (!value || value === "" || value === null || value === undefined) return 0
            const stringValue = value.toString()
            const cleanValue = stringValue.replace(/\./g, "").trim()
            const parsed = Number.parseInt(cleanValue)
            return isNaN(parsed) ? 0 : parsed
          }

          const parseDate = (dateStr: string) => {
            if (!dateStr) return ""
            const parts = dateStr.split("/")
            if (parts.length !== 3) return ""
            const [day, month, year] = parts
            return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
          }

          const dateIndex = headers.indexOf("Date")
          const campaignNameIndex = headers.indexOf("Campanha")
          const creativeTitleIndex = headers.indexOf("Creative title")
          const reachIndex = headers.indexOf("Reach")
          const impressionsIndex = headers.indexOf("Impressions")
          const clicksIndex = headers.indexOf("Clicks")
          const totalSpentIndex = headers.indexOf("Total spent")
          const videoViewsIndex = headers.indexOf("Video views")
          const videoViews25Index = headers.indexOf("Video views at 25%")
          const videoViews50Index = headers.indexOf("Video views at 50%")
          const videoViews75Index = headers.indexOf("Video views at 75%")
          const videoCompletionsIndex = headers.indexOf("Video completions")
          const totalEngagementsIndex = headers.indexOf("Total engagements")
          const veiculoIndex = headers.indexOf("Veículo")
          const tipoCompraIndex = headers.indexOf("Tipo de Compra")

          if (dateIndex === -1 || !row[dateIndex] || row[dateIndex] === "") {
            return null
          }

          const hasImpressions = row[impressionsIndex] && row[impressionsIndex] !== ""
          const hasSpent = row[totalSpentIndex] && row[totalSpentIndex] !== ""

          if (!hasImpressions && !hasSpent) {
            return null
          }

          const originalDate = row[dateIndex]
          const formattedDate = parseDate(originalDate)

          // Normalizar veículo: mapear "Audience Network", "unknown" e "threads" para "Meta"
          const rawVeiculo = row[veiculoIndex] || "Outros"
          const normalizedVeiculo = (() => {
            const lower = rawVeiculo.toLowerCase()
            if (lower === 'audience network' || lower === 'unknown' || lower === 'threads') {
              return 'Meta'
            }
            return rawVeiculo
          })()

          const dataPoint: DataPoint = {
            date: formattedDate,
            campaignName: row[campaignNameIndex] || "",
            creativeTitle: row[creativeTitleIndex] || "",
            platform: normalizedVeiculo,
            reach: parseInteger(row[reachIndex]),
            impressions: parseInteger(row[impressionsIndex]),
            clicks: parseInteger(row[clicksIndex]),
            totalSpent: parseNumber(row[totalSpentIndex]),
            videoViews: parseInteger(row[videoViewsIndex]),
            videoViews25: parseInteger(row[videoViews25Index]),
            videoViews50: parseInteger(row[videoViews50Index]),
            videoViews75: parseInteger(row[videoViews75Index]),
            videoCompletions: parseInteger(row[videoCompletionsIndex]),
            totalEngagements: parseInteger(row[totalEngagementsIndex]),
            veiculo: normalizedVeiculo,
            tipoCompra: row[tipoCompraIndex] || "",
          }

          return dataPoint
        })
        .filter(Boolean) as DataPoint[]

      processed.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

      setProcessedData(processed)

      if (processed.length > 0) {
        const dates = processed
          .map((item) => item.date)
          .filter((date) => date && date.match(/^\d{4}-\d{2}-\d{2}$/))
          .sort()

        if (dates.length > 0) {
          const firstDate = dates[0]
          const lastDate = dates[dates.length - 1]
          setDateRange({ start: firstDate, end: lastDate })
        }
      }

      const vehicleSet = new Set<string>()
      processed.forEach((item) => {
        if (item.platform && item.platform.trim() !== "") {
          vehicleSet.add(item.platform)
        }
      })
      const vehicles = Array.from(vehicleSet).filter(Boolean)
      setAvailableVehicles(vehicles)
      setSelectedVehicles([])
    }
  }, [data])

  // Filtrar dados baseado nos filtros selecionados
  useEffect(() => {
    if (processedData.length > 0) {
      let filtered = processedData

      if (dateRange.start && dateRange.end) {
        filtered = filtered.filter((item) => {
          const itemDate = new Date(item.date)
          const startDate = new Date(dateRange.start)
          const endDate = new Date(dateRange.end)
          return itemDate >= startDate && itemDate <= endDate
        })
      }

      // Filtrar por campanha selecionada
      if (selectedCampaign) {
        filtered = filtered.filter((item) => item.campaignName === selectedCampaign)
      }

      setFilteredData(filtered)
    } else {
      setFilteredData([])
    }
  }, [processedData, dateRange, selectedCampaign])

  // Função para obter o valor da métrica de um item de dado
  const getMetricValue = (item: DataPoint, metric: typeof selectedMetric): number => {
    switch (metric) {
      case "impressions":
        return item.impressions || 0
      case "clicks":
        return item.clicks || 0
      case "totalSpent":
        return item.totalSpent || 0
      case "videoViews":
        return item.videoViews || item.videoCompletions || 0
      // Para métricas compostas, retornamos os valores base para agregação posterior
      case "cpm":
      case "cpc":
      case "ctr":
      case "vtr":
        return 0 // Será calculado na agregação
      default:
        return 0
    }
  }

  // Preparar dados para o gráfico
  const chartData: ChartData[] = useMemo(() => {
    // Função para calcular métricas compostas de um grupo de dados
    const calculateCompositeMetric = (dayData: DataPoint[], metric: typeof selectedMetric): number => {
      if (!dayData || dayData.length === 0) return 0

      const totalCost = dayData.reduce((sum, item) => sum + (item.totalSpent || 0), 0)
      const totalImpressions = dayData.reduce((sum, item) => sum + (item.impressions || 0), 0)
      const totalClicks = dayData.reduce((sum, item) => sum + (item.clicks || 0), 0)
      const totalViews = dayData.reduce((sum, item) => sum + (item.videoViews || item.videoCompletions || 0), 0)

      switch (metric) {
        case "impressions":
          return totalImpressions
        case "clicks":
          return totalClicks
        case "totalSpent":
          return totalCost
        case "videoViews":
          return totalViews
        case "cpm":
          return totalImpressions > 0 ? (totalCost / totalImpressions) * 1000 : 0
        case "cpc":
          return totalClicks > 0 ? totalCost / totalClicks : 0
        case "ctr":
          return totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0
        case "vtr":
          return totalImpressions > 0 ? (totalViews / totalImpressions) * 100 : 0
        default:
          return 0
      }
    }

    if (selectedVehicles.length === 0) {
      // Agregação para uma única linha (todos os veículos)
      const groupedByDate = filteredData.reduce(
        (acc, item) => {
          const date = item.date
          if (!acc[date]) {
            acc[date] = []
          }
          acc[date].push(item)
          return acc
        },
        {} as Record<string, DataPoint[]>,
      )

      const data = Object.entries(groupedByDate)
        .map(([date, dayData]) => ({
          x: date,
          y: calculateCompositeMetric(dayData, selectedMetric),
        }))
        .sort((a, b) => new Date(a.x).getTime() - new Date(b.x).getTime())

      return [
        {
          id: selectedMetric.charAt(0).toUpperCase() + selectedMetric.slice(1),
          data,
        },
      ]
    } else {
      // Múltiplas linhas para veículos selecionados
      const seriesMap: Record<string, Record<string, DataPoint[]>> = {}

      selectedVehicles.forEach((vehicle) => {
        seriesMap[vehicle] = {}
      })

      filteredData.forEach((item) => {
        if (selectedVehicles.includes(item.platform)) {
          const date = item.date
          if (!seriesMap[item.platform][date]) {
            seriesMap[item.platform][date] = []
          }
          seriesMap[item.platform][date].push(item)
        }
      })

      const result: ChartData[] = []
      Object.entries(seriesMap).forEach(([platform, dataByDate]) => {
        const data = Object.entries(dataByDate)
          .map(([date, dayData]) => ({
            x: date,
            y: calculateCompositeMetric(dayData, selectedMetric),
          }))
          .sort((a, b) => new Date(a.x).getTime() - new Date(b.x).getTime())
        result.push({
          id: platform,
          data,
        })
      })
      return result.sort((a, b) => a.id.localeCompare(b.id))
    }
  }, [filteredData, selectedVehicles, selectedMetric])

  // Identificar entradas de veículos
  const vehicleEntries: VehicleEntry[] = useMemo(() => {
    const entries: Record<string, string> = {}

    processedData.forEach((item) => {
      if (!entries[item.platform]) {
        entries[item.platform] = item.date
      } else if (new Date(item.date) < new Date(entries[item.platform])) {
        entries[item.platform] = item.date
      }
    })

    return Object.entries(entries)
      .map(([platform, date]) => ({
        platform,
        firstDate: date,
        color: platformColors[platform] || platformColors.Default,
      }))
      .sort((a, b) => new Date(a.firstDate).getTime() - new Date(b.firstDate).getTime())
  }, [processedData])

  // Calcular estatísticas
  const totalInvestment = useMemo(() => {
    return filteredData.reduce((sum, item) => sum + item.totalSpent, 0)
  }, [filteredData])

  const totalImpressions = filteredData.reduce((sum, item) => sum + item.impressions, 0)
  const totalClicks = filteredData.reduce((sum, item) => sum + item.clicks, 0)

  // Função para formatar valor monetário
  const formatCurrency = (value: number): string => {
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    })
  }

  // Função para formatar números
  const formatNumber = (value: number): string => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`
    }
    return value.toLocaleString("pt-BR")
  }

  // Função para formatar valores do eixo Y e tooltip
  const formatChartValue = (value: number): string => {
    if (["totalSpent", "cpm", "cpc", "cpv"].includes(selectedMetric)) {
      return formatCurrency(value)
    }
    if (["ctr", "vtr"].includes(selectedMetric)) {
      return `${value.toFixed(2)}%`
    }
    return formatNumber(value)
  }

  // Função para alternar seleção de veículo
  const toggleVehicle = (vehicle: string) => {
    setSelectedVehicles((prev) => {
      if (prev.includes(vehicle)) {
        return prev.filter((v) => v !== vehicle)
      }
      return [...prev, vehicle]
    })
  }

  // Renderização condicional DEPOIS de todos os hooks
  if (loading) {
    return <Loading message="Carregando dados da linha do tempo..." />
  }

  if (error) {
    return (
      <div className="bg-red-50/90 backdrop-blur-sm border border-red-200 rounded-lg p-4">
        <p className="text-red-600">Erro ao carregar dados: {error.message}</p>
      </div>
    )
  }

  // Se estiver no modo análise semanal, renderizar o componente separado
  if (isWeeklyAnalysis) {
    return (
      <div className="space-y-4">
        <AnaliseSemanal
          processedData={processedData}
          availableVehicles={availableVehicles}
          platformColors={platformColors}
          campaigns={campaigns}
          onBack={() => setIsWeeklyAnalysis(false)}
        />
      </div>
    )
  }

  return (
    <div ref={contentRef} className="space-y-4 flex flex-col max-h-screen overflow-y-auto p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900 text-enhanced">Linha do Tempo</h1>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 text-sm text-gray-600 bg-white/80 backdrop-blur-sm px-3 py-1 rounded-lg">
            <TrendingUp className="w-4 h-4" />
            <span>Evolução de {selectedMetric.charAt(0).toUpperCase() + selectedMetric.slice(1)}</span>
          </div>
          <PDFDownloadButton contentRef={contentRef} fileName="linha-tempo" />
          <button
            onClick={() => setIsWeeklyAnalysis(true)}
            className="px-4 py-2 border border-blue-500 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors duration-200 text-sm font-medium"
          >
            Análise Semanal
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="card-overlay rounded-lg shadow-lg p-4">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Filtro de Campanha */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
              <Filter className="w-4 h-4 mr-2" />
              Campanha
            </label>
            <div className="relative">
              <select
                value={selectedCampaign || ""}
                onChange={(e) => setSelectedCampaign(e.target.value || null)}
                className="w-full px-4 py-2 bg-white border-2 border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 appearance-none cursor-pointer"
              >
                <option value="">Todas as campanhas</option>
                {campaigns.map((campaign) => (
                  <option key={campaign.name} value={campaign.name}>
                    {campaign.name}
                  </option>
                ))}
              </select>
              <svg
                className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

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

          {/* Filtro de Veículos */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
              <Filter className="w-4 h-4 mr-2" />
              Veículos de Mídia
            </label>
            <div className="flex flex-wrap gap-2">
              {availableVehicles.map((vehicle) => (
                <button
                  key={vehicle}
                  onClick={() => toggleVehicle(vehicle)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors duration-200 ${
                    selectedVehicles.includes(vehicle)
                      ? "bg-blue-100 text-blue-800 border border-blue-300"
                      : "bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200"
                  }`}
                  style={{
                    backgroundColor: selectedVehicles.includes(vehicle) ? platformColors[vehicle] + "20" : undefined,
                    borderColor: selectedVehicles.includes(vehicle) ? platformColors[vehicle] : undefined,
                    color: selectedVehicles.includes(vehicle) ? platformColors[vehicle] : undefined,
                  }}
                >
                  {vehicle}
                </button>
              ))}
            </div>
          </div>

          {/* Filtro de Métricas */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
              <BarChart3 className="w-4 h-4 mr-2" />
              Métrica do Gráfico
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { key: "impressions", label: "Impressões", icon: TrendingUp },
                { key: "clicks", label: "Cliques", icon: MousePointer },
                { key: "totalSpent", label: "Investimento", icon: DollarSign },
                { key: "videoViews", label: "Visualizações", icon: Eye },
                { key: "cpm", label: "CPM", icon: DollarSign },
                { key: "cpc", label: "CPC", icon: DollarSign },
                { key: "ctr", label: "CTR", icon: BarChart3 },
                { key: "vtr", label: "VTR", icon: BarChart3 },
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setSelectedMetric(key as typeof selectedMetric)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors duration-200 ${
                    selectedMetric === key
                      ? "bg-purple-100 text-purple-800 border border-purple-300"
                      : "bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200"
                  }`}
                >
                  <Icon className="w-3 h-3 inline-block mr-1" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card-overlay rounded-lg shadow-lg p-4">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Investimento Total</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(totalInvestment)}</p>
            </div>
          </div>
        </div>

        <div className="card-overlay rounded-lg shadow-lg p-4">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <TrendingUp className="w-5 h-5 text-blue-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Total de Impressões</p>
              <p className="text-xl font-bold text-gray-900">{formatNumber(totalImpressions)}</p>
            </div>
          </div>
        </div>

        <div className="card-overlay rounded-lg shadow-lg p-4">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <MousePointer className="w-5 h-5 text-purple-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Total de Cliques</p>
              <p className="text-xl font-bold text-gray-900">{formatNumber(totalClicks)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Área do Gráfico e Informações */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4" style={{ height: "500px" }}>
        {/* Gráfico */}
        <div className="lg:col-span-3 card-overlay rounded-lg shadow-lg p-4 flex flex-col h-full">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Evolução de {selectedMetric.charAt(0).toUpperCase() + selectedMetric.slice(1)} por Data
          </h3>
          <div className="flex-1 min-h-0">
            {chartData.length > 0 && chartData.some((series) => series.data.length > 0) ? (
              <ResponsiveLine
                data={chartData}
                margin={{ top: 30, right: 30, bottom: 80, left: 100 }}
                xScale={{ type: "point" }}
                yScale={{ type: "linear", min: "auto", max: "auto" }}
                yFormat=" >-.0f"
                axisTop={null}
                axisRight={null}
                axisBottom={{
                  tickSize: 5,
                  tickPadding: 15,
                  tickRotation: -45,
                  legend: "Data",
                  legendOffset: 60,
                  legendPosition: "middle",
                }}
                axisLeft={{
                  tickSize: 5,
                  tickPadding: 10,
                  tickRotation: 0,
                  legend: selectedMetric.charAt(0).toUpperCase() + selectedMetric.slice(1),
                  legendOffset: -85,
                  legendPosition: "middle",
                  format: (value) => formatChartValue(value),
                }}
                pointSize={8}
                pointColor={{ theme: "background" }}
                pointBorderWidth={2}
                pointBorderColor={{ from: "serieColor" }}
                pointLabelYOffset={-12}
                useMesh={true}
                colors={
                  selectedVehicles.length > 0
                    ? (serie) => platformColors[serie.id] || platformColors.Default
                    : ["#3b82f6"]
                }
                lineWidth={3}
                enableArea={true}
                areaOpacity={0.1}
                enableGridX={false}
                enableGridY={true}
                gridYValues={5}
                theme={{
                  axis: {
                    ticks: {
                      text: {
                        fontSize: 11,
                        fill: "#6b7280",
                      },
                    },
                    legend: {
                      text: {
                        fontSize: 12,
                        fill: "#374151",
                        fontWeight: 600,
                      },
                    },
                  },
                  grid: {
                    line: {
                      stroke: "#e5e7eb",
                      strokeWidth: 1,
                    },
                  },
                }}
                legends={
                  selectedVehicles.length > 0
                    ? [
                        {
                          anchor: "top-right",
                          direction: "row",
                          justify: false,
                          translateX: 0,
                          translateY: -25,
                          itemsSpacing: 10,
                          itemDirection: "left-to-right",
                          itemWidth: 120,
                          itemHeight: 20,
                          itemOpacity: 0.85,
                          symbolSize: 12,
                          symbolShape: "circle",
                          symbolBorderColor: "rgba(0, 0, 0, .5)",
                          effects: [
                            {
                              on: "hover",
                              style: {
                                itemBackground: "rgba(0, 0, 0, .03)",
                                itemOpacity: 1,
                              },
                            },
                          ],
                        },
                      ]
                    : []
                }
                tooltip={({ point }) => (
                  <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                    <div className="text-sm font-medium text-gray-900">Data: {point.data.x as string}</div>
                    <div className="text-sm text-gray-600">
                      {point.seriesId}: {formatChartValue(point.data.y as number)}
                    </div>
                  </div>
                )}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <TrendingUp className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Nenhum dado disponível para o período ou filtros selecionados</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Painel Lateral - Entrada de Veículos */}
        <div className="card-overlay rounded-lg shadow-lg p-4 flex flex-col h-full max-h-[500px]">
          <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center flex-shrink-0">
            <Info className="w-4 h-4 mr-2" />
            Entrada de Veículos
          </h3>
          <div className="space-y-3 overflow-y-scroll" style={{ maxHeight: "calc(500px - 80px)" }}>
            {vehicleEntries.map((entry, index) => (
              <div key={index} className="flex items-center space-x-3 p-2 rounded-lg bg-gray-50">
                <div className="flex items-center space-x-2">
                  <Play className="w-3 h-3" style={{ color: entry.color }} />
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }}></div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{entry.platform}</p>
                  <p className="text-xs text-gray-500">
                    {createLocalDate(entry.firstDate).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default LinhaTempo

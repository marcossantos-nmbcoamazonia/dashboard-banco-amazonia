"use client"

import type React from "react"
import { useState, useMemo, useRef, useEffect } from "react"
import { ResponsiveLine } from "@nivo/line"
import {
  Calendar,
  Filter,
  TrendingUp,
  DollarSign,
  MousePointer,
  Eye,
  BarChart3,
  ArrowUp,
  ArrowDown,
  Minus,
  Info,
} from "lucide-react"
import PDFDownloadButton from "../../../components/PDFDownloadButton/PDFDownloadButton"

interface DataPoint {
  date: string
  campaignName: string
  creativeTitle: string
  platform: string
  reach: number
  impressions: number
  clicks: number
  totalSpent: number
  videoViews: number
  videoViews25: number
  videoViews50: number
  videoViews75: number
  videoCompletions: number
  videoStarts: number
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

interface WeeklyMetrics {
  investment: number
  impressions: number
  clicks: number
  views: number
  cpm: number
  cpc: number
  ctr: number
  vtr: number
  cpv: number
}

interface WeeklyComparison {
  current: WeeklyMetrics
  previous: WeeklyMetrics
  comparison: {
    investment: number
    impressions: number
    clicks: number
    views: number
    cpm: number
    cpc: number
    ctr: number
    vtr: number
    cpv: number
  }
}

interface AnaliseSemanalProps {
  processedData: DataPoint[]
  availableVehicles: string[]
  platformColors: Record<string, string>
  onBack: () => void
}

const AnaliseSemanal: React.FC<AnaliseSemanalProps> = ({
  processedData,
  availableVehicles,
  platformColors,
  onBack,
}) => {
  const contentRef = useRef<HTMLDivElement>(null)
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: "", end: "" })
  const [selectedVehicles, setSelectedVehicles] = useState<string[]>([])
  const [selectedMetric, setSelectedMetric] = useState<
    "impressions" | "clicks" | "views" | "cpm" | "cpc" | "cpv" | "ctr" | "vtr"
  >("impressions")

  // Função para criar datas locais sem problemas de timezone
  const createLocalDate = (dateStr: string) => {
    if (!dateStr) return new Date()
    const parts = dateStr.split("-")
    if (parts.length !== 3) return new Date()
    const [year, month, day] = parts
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
  }

  // Configurar automaticamente os últimos 7 dias
  useEffect(() => {
    if (processedData.length > 0) {
      // Obter todas as datas únicas e ordenar
      const allDates = Array.from(new Set(processedData.map((item) => item.date)))
        .filter((date) => date && date.match(/^\d{4}-\d{2}-\d{2}$/))
        .sort()

      if (allDates.length > 0) {
        const lastDate = allDates[allDates.length - 1]
        const lastDateObj = createLocalDate(lastDate) // ← MUDANÇA AQUI

        // Calcular 7 dias antes da última data
        const firstDateObj = new Date(lastDateObj) // ← Esta pode ficar assim pois já é um Date object
        firstDateObj.setDate(lastDateObj.getDate() - 6)

        const firstDate = firstDateObj.toISOString().split("T")[0]

        setDateRange({ start: firstDate, end: lastDate })
      }
    }
  }, [processedData])

  // Função para obter dados baseado no período selecionado
  const getFilteredDataByPeriod = (isCurrentPeriod: boolean): DataPoint[] => {
    console.log("getFilteredDataByPeriod called with:", { isCurrentPeriod, dateRange, selectedVehicles })

    // Se não há filtro de data, usar últimos 7 dias
    if (!dateRange.start || !dateRange.end) {
      return []
    }

    // Com filtro de data selecionado
    const startDate = createLocalDate(dateRange.start) // ← MUDANÇA AQUI
    const endDate = createLocalDate(dateRange.end) // ← MUDANÇA AQUI

    // Calcular período anterior com a mesma duração
    const periodDuration = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
    const previousStartDate = new Date(startDate) // ← Esta pode ficar assim pois já é um Date object
    previousStartDate.setDate(startDate.getDate() - periodDuration)
    const previousEndDate = new Date(previousStartDate) // ← Esta pode ficar assim pois já é um Date object
    previousEndDate.setDate(previousStartDate.getDate() + periodDuration - 1)

    let targetStartDate: Date
    let targetEndDate: Date

    if (isCurrentPeriod) {
      targetStartDate = startDate
      targetEndDate = endDate
    } else {
      targetStartDate = previousStartDate
      targetEndDate = previousEndDate
    }

    return processedData.filter((item) => {
      const itemDate = createLocalDate(item.date) // ← MUDANÇA AQUI
      const isInDateRange = itemDate >= targetStartDate && itemDate <= targetEndDate
      const isVehicleSelected = selectedVehicles.length === 0 || selectedVehicles.includes(item.platform)
      return isInDateRange && isVehicleSelected
    })
  }

  // Calcular métricas semanais com tratamento de valores zerados
  const calculateWeeklyMetrics = (data: DataPoint[]): WeeklyMetrics => {
    const totalInvestment = data.reduce((sum, item) => sum + (item.totalSpent || 0), 0)
    const totalImpressions = data.reduce((sum, item) => sum + (item.impressions || 0), 0)
    const totalClicks = data.reduce((sum, item) => sum + (item.clicks || 0), 0)
    const totalViews = data.reduce((sum, item) => sum + (item.videoViews || item.videoCompletions || 0), 0)

    const cpm = totalImpressions > 0 ? (totalInvestment / totalImpressions) * 1000 : 0
    const cpc = totalClicks > 0 ? totalInvestment / totalClicks : 0
    const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0
    const vtr = totalImpressions > 0 ? (totalViews / totalImpressions) * 100 : 0
    const cpv = totalViews > 0 ? totalInvestment / totalViews : 0

    return {
      investment: totalInvestment || 0,
      impressions: totalImpressions || 0,
      clicks: totalClicks || 0,
      views: totalViews || 0,
      cpm: cpm || 0,
      cpc: cpc || 0,
      ctr: ctr || 0,
      vtr: vtr || 0,
      cpv: cpv || 0,
    }
  }

  // Dados da análise semanal
  const weeklyComparison: WeeklyComparison = useMemo(() => {
    const currentWeekData = getFilteredDataByPeriod(true)
    const previousWeekData = getFilteredDataByPeriod(false)

    const current = calculateWeeklyMetrics(currentWeekData)
    const previous = calculateWeeklyMetrics(previousWeekData)

    const safeCalculatePercentage = (currentVal: number, previousVal: number): number => {
      if (!previousVal || previousVal === 0) return currentVal > 0 ? 100 : 0
      return ((currentVal - previousVal) / previousVal) * 100
    }

    const comparison = {
      investment: safeCalculatePercentage(current.investment, previous.investment),
      impressions: safeCalculatePercentage(current.impressions, previous.impressions),
      clicks: safeCalculatePercentage(current.clicks, previous.clicks),
      views: safeCalculatePercentage(current.views, previous.views),
      cpm: safeCalculatePercentage(current.cpm, previous.cpm),
      cpc: safeCalculatePercentage(current.cpc, previous.cpc),
      ctr: safeCalculatePercentage(current.ctr, previous.ctr),
      vtr: safeCalculatePercentage(current.vtr, previous.vtr),
      cpv: safeCalculatePercentage(current.cpv, previous.cpv),
    }

    return { current, previous, comparison }
  }, [processedData, selectedVehicles, dateRange])

  // Dados do gráfico semanal comparativo
  const weeklyChartData: ChartData[] = useMemo(() => {
    const currentWeekData = getFilteredDataByPeriod(true)
    const previousWeekData = getFilteredDataByPeriod(false)

    // Agrupar por dia da semana
    const groupByDay = (data: DataPoint[]) => {
      const grouped: Record<string, DataPoint[]> = {}
      data.forEach((item) => {
        const date = createLocalDate(item.date) // ← MUDANÇA AQUI
        const dayKey = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
        if (!grouped[dayKey]) grouped[dayKey] = []
        grouped[dayKey].push(item)
      })
      return grouped
    }

    const currentGrouped = groupByDay(currentWeekData)
    const previousGrouped = groupByDay(previousWeekData)

    const getDayValue = (dayData: DataPoint[], metric: string) => {
      if (!dayData || dayData.length === 0) return 0

      switch (metric) {
        case "impressions":
          return dayData.reduce((sum, item) => sum + (item.impressions || 0), 0)
        case "clicks":
          return dayData.reduce((sum, item) => sum + (item.clicks || 0), 0)
        case "views":
          return dayData.reduce((sum, item) => sum + (item.videoViews || item.videoCompletions || 0), 0)
        case "cpm":
          const totalCost = dayData.reduce((sum, item) => sum + (item.totalSpent || 0), 0)
          const totalImpressions = dayData.reduce((sum, item) => sum + (item.impressions || 0), 0)
          return totalImpressions > 0 ? (totalCost / totalImpressions) * 1000 : 0
        case "cpc":
          const totalCostCpc = dayData.reduce((sum, item) => sum + (item.totalSpent || 0), 0)
          const totalClicksCpc = dayData.reduce((sum, item) => sum + (item.clicks || 0), 0)
          return totalClicksCpc > 0 ? totalCostCpc / totalClicksCpc : 0
        case "cpv":
          const totalCostCpv = dayData.reduce((sum, item) => sum + (item.totalSpent || 0), 0)
          const totalViewsCpv = dayData.reduce((sum, item) => sum + (item.videoViews || item.videoCompletions || 0), 0)
          return totalViewsCpv > 0 ? totalCostCpv / totalViewsCpv : 0
        case "ctr":
          const totalImpressionsCtr = dayData.reduce((sum, item) => sum + (item.impressions || 0), 0)
          const totalClicksCtr = dayData.reduce((sum, item) => sum + (item.clicks || 0), 0)
          return totalImpressionsCtr > 0 ? (totalClicksCtr / totalImpressionsCtr) * 100 : 0
        case "vtr":
          const totalImpressionsVtr = dayData.reduce((sum, item) => sum + (item.impressions || 0), 0)
          const totalViewsVtr = dayData.reduce((sum, item) => sum + (item.videoViews || item.videoCompletions || 0), 0)
          return totalImpressionsVtr > 0 ? (totalViewsVtr / totalImpressionsVtr) * 100 : 0
        default:
          return 0
      }
    }

    // Processar dados do período atual
    const currentDays = Object.keys(currentGrouped).sort((a, b) => {
      const [dayA, monthA] = a.split("/").map(Number)
      const [dayB, monthB] = b.split("/").map(Number)
      const dateA = new Date(new Date().getFullYear(), monthA - 1, dayA)
      const dateB = new Date(new Date().getFullYear(), monthB - 1, dayB)
      return dateA.getTime() - dateB.getTime()
    })

    // Processar dados do período anterior
    const previousDays = Object.keys(previousGrouped).sort((a, b) => {
      const [dayA, monthA] = a.split("/").map(Number)
      const [dayB, monthB] = b.split("/").map(Number)
      const dateA = new Date(new Date().getFullYear(), monthA - 1, dayA)
      const dateB = new Date(new Date().getFullYear(), monthB - 1, dayB)
      return dateA.getTime() - dateB.getTime()
    })

    const currentData: Array<{ x: string; y: number }> = []
    const previousData: Array<{ x: string; y: number }> = []

    currentDays.forEach((day) => {
      const value = getDayValue(currentGrouped[day], selectedMetric)
      if (value > 0) {
        currentData.push({ x: day, y: value })
      }
    })

    previousDays.forEach((day) => {
      const value = getDayValue(previousGrouped[day], selectedMetric)
      if (value > 0) {
        previousData.push({ x: day, y: value })
      }
    })

    const result: ChartData[] = []

    if (previousData.length > 0) {
      result.push({
        id: "Período Anterior",
        data: previousData,
      })
    }

    if (currentData.length > 0) {
      result.push({
        id: "Período Atual",
        data: currentData,
      })
    }

    return result
  }, [selectedMetric, processedData, selectedVehicles, dateRange])

  // Função para formatar valor monetário
  const formatCurrency = (value: number): string => {
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    })
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

  // Função para renderizar ícone de comparação
  const renderComparisonIcon = (value: number) => {
    if (!value || isNaN(value)) return <Minus className="w-4 h-4 text-gray-400" />
    if (value > 0) return <ArrowUp className="w-4 h-4 text-green-600" />
    if (value < 0) return <ArrowDown className="w-4 h-4 text-red-600" />
    return <Minus className="w-4 h-4 text-gray-400" />
  }

  const getComparisonColor = (value: number) => {
    if (!value || isNaN(value)) return "text-gray-400"
    if (value > 0) return "text-green-600"
    if (value < 0) return "text-red-600"
    return "text-gray-400"
  }

  // Função para obter cor da comparação específica para CPM (inversa)
  const getComparisonColorCPM = (value: number) => {
    if (!value || isNaN(value)) return "text-gray-400"
    if (value > 0) return "text-red-600"  // Aumento de CPM é ruim (vermelho)
    if (value < 0) return "text-green-600"  // Diminuição de CPM é bom (verde)
    return "text-gray-400"
  }

  // Função para obter escala do gráfico
  const getChartScale = (): { type: "linear"; min: "auto" | number; max: "auto" | number } => {
    if (["ctr", "vtr"].includes(selectedMetric)) {
      const maxValue = Math.min(
        100,
        Math.max(...weeklyChartData.flatMap((series) => series.data.map((d) => d.y))) * 1.002,
      )
      return { type: "linear", min: 0, max: maxValue }
    }

    return { type: "linear", min: "auto", max: "auto" }
  }

  // Calcular período anterior para exibição
  const getPreviousPeriodDates = () => {
    if (!dateRange.start || !dateRange.end) return { start: "", end: "" }

    const startDate = createLocalDate(dateRange.start) // ← MUDANÇA AQUI
    const endDate = createLocalDate(dateRange.end) // ← MUDANÇA AQUI
    const periodDuration = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1

    const previousStartDate = new Date(startDate) // ← Esta pode ficar assim pois já é um Date object
    previousStartDate.setDate(startDate.getDate() - periodDuration)
    const previousEndDate = new Date(previousStartDate) // ← Esta pode ficar assim pois já é um Date object
    previousEndDate.setDate(previousStartDate.getDate() + periodDuration - 1)

    return {
      start: previousStartDate.toLocaleDateString("pt-BR"),
      end: previousEndDate.toLocaleDateString("pt-BR"),
    }
  }

  const previousPeriod = getPreviousPeriodDates()

  return (
    <div ref={contentRef} className="space-y-4 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900 text-enhanced">Análise de Período</h1>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 text-sm text-gray-600 bg-white/80 backdrop-blur-sm px-3 py-1 rounded-lg">
            <TrendingUp className="w-4 h-4" />
            <span>Comparativo de Períodos</span>
          </div>

          <PDFDownloadButton contentRef={contentRef} fileName="analise-de-periodo" />
          <button
            onClick={onBack}
            className="px-4 py-2 border border-blue-500 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors duration-200 text-sm font-medium"
          >
            ← Voltar para Linha do Tempo
          </button>
        </div>
      </div>

      {/* Indicador de Períodos Comparados */}
      <div className="card-overlay rounded-lg shadow-lg p-4">
        <div className="flex items-center justify-center space-x-8">

          <div className="text-center">
            <div className="flex items-center space-x-2 text-orange-600 mb-1">
              <div className="w-3 h-3 bg-orange-600 rounded-full"></div>
              <span className="text-sm font-medium">Período Anterior</span>
            </div>
            <p className="text-lg font-bold text-gray-900">
              {previousPeriod.start && previousPeriod.end && `${previousPeriod.start} - ${previousPeriod.end}`}
            </p>
          </div>

          <div className="text-center">
            <span className="text-gray-400 text-2xl">vs</span>
          </div>

          <div className="text-center">
            <div className="flex items-center space-x-2 text-blue-600 mb-1">
              <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
              <span className="text-sm font-medium">Período Atual</span>
            </div>
            <p className="text-lg font-bold text-gray-900">
              {dateRange.start &&
                dateRange.end &&
                `${createLocalDate(dateRange.start).toLocaleDateString("pt-BR")} - ${createLocalDate(dateRange.end).toLocaleDateString("pt-BR")}`}
            </p>
          </div>      

        </div>
      </div>

      {/* Filtros */}
      <div className="card-overlay rounded-lg shadow-lg p-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Filtro de Data */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
              <Calendar className="w-4 h-4 mr-2" />
              Período (Últimos 7 dias por padrão)
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
        </div>
      </div>

      {/* Cards da Análise de Período */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card Investimento */}
        <div className="card-overlay rounded-lg shadow-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <div className="flex items-center space-x-1">
              {renderComparisonIcon(weeklyComparison.comparison.investment)}
              <span className={`text-sm font-semibold ${getComparisonColor(weeklyComparison.comparison.investment)}`}>
                {Math.abs(weeklyComparison.comparison.investment).toFixed(1)}%
              </span>
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600">Investimento</p>
            <p className="text-lg font-bold text-gray-900">{formatCurrency(weeklyComparison.current.investment)}</p>
            <p className="text-sm text-gray-500 mt-1">CPM: {formatCurrency(weeklyComparison.current.cpm)}</p>
          </div>
        </div>

        {/* Card Impressões */}
        <div className="card-overlay rounded-lg shadow-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <TrendingUp className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex items-center space-x-1">
              {renderComparisonIcon(weeklyComparison.comparison.impressions)}
              <span className={`text-sm font-semibold ${getComparisonColor(weeklyComparison.comparison.impressions)}`}>
                {Math.abs(weeklyComparison.comparison.impressions).toFixed(1)}%
              </span>
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600">Impressões</p>
            <p className="text-lg font-bold text-gray-900">
              {weeklyComparison.current.impressions.toLocaleString("pt-BR")}
            </p>
            <p className="text-sm text-gray-500 mt-1">CTR: {weeklyComparison.current.ctr.toFixed(2)}%</p>
          </div>
        </div>

        {/* Card Cliques */}
        <div className="card-overlay rounded-lg shadow-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-purple-100 rounded-lg">
              <MousePointer className="w-5 h-5 text-purple-600" />
            </div>
            <div className="flex items-center space-x-1">
              {renderComparisonIcon(weeklyComparison.comparison.clicks)}
              <span className={`text-sm font-semibold ${getComparisonColor(weeklyComparison.comparison.clicks)}`}>
                {Math.abs(weeklyComparison.comparison.clicks).toFixed(1)}%
              </span>
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600">Cliques</p>
            <p className="text-lg font-bold text-gray-900">{weeklyComparison.current.clicks.toLocaleString("pt-BR")}</p>
            <p className="text-sm text-gray-500 mt-1">CPC: {formatCurrency(weeklyComparison.current.cpc)}</p>
          </div>
        </div>

        {/* Card Views */}
        <div className="card-overlay rounded-lg shadow-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Eye className="w-5 h-5 text-orange-600" />
            </div>
            <div className="flex items-center space-x-1">
              {renderComparisonIcon(weeklyComparison.comparison.views)}
              <span className={`text-sm font-semibold ${getComparisonColor(weeklyComparison.comparison.views)}`}>
                {Math.abs(weeklyComparison.comparison.views).toFixed(1)}%
              </span>
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600">Views</p>
            <p className="text-lg font-bold text-gray-900">{weeklyComparison.current.views.toLocaleString("pt-BR")}</p>
            <p className="text-sm text-gray-500 mt-1">
              VTR: {weeklyComparison.current.vtr.toFixed(2)}% | CPV: {formatCurrency(weeklyComparison.current.cpv)}
            </p>
          </div>
        </div>

        {/* Card Resumo Detalhado */}
        <div className="card-overlay rounded-lg shadow-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <BarChart3 className="w-5 h-5 text-indigo-600" />
            </div>
            <Info className="w-4 h-4 text-gray-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600">Resumo Comparativo</p>
            <div className="mt-2 space-y-2">
              <div className="text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">CPM:</span>
                  <span className={`font-semibold ${getComparisonColorCPM(weeklyComparison.comparison.cpm)}`}>
                    {weeklyComparison.comparison.cpm > 0 ? "+" : ""}
                    {weeklyComparison.comparison.cpm.toFixed(1)}%
                  </span>
                </div>
                <div className="text-xs">
                  <span className="text-blue-600 font-medium">{formatCurrency(weeklyComparison.current.cpm)}</span>
                  <span className="text-gray-500"> vs </span>
                  <span className="text-orange-600 font-medium">{formatCurrency(weeklyComparison.previous.cpm)}</span>
                </div>
              </div>

              <div className="text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">CTR:</span>
                  <span className={`font-semibold ${getComparisonColor(weeklyComparison.comparison.ctr)}`}>
                    {weeklyComparison.comparison.ctr > 0 ? "+" : ""}
                    {weeklyComparison.comparison.ctr.toFixed(1)}%
                  </span>
                </div>
                <div className="text-xs">
                  <span className="text-blue-600 font-medium">{weeklyComparison.current.ctr.toFixed(2)}%</span>
                  <span className="text-gray-500"> vs </span>
                  <span className="text-orange-600 font-medium">{weeklyComparison.previous.ctr.toFixed(2)}%</span>
                </div>
              </div>

              <div className="text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">VTR:</span>
                  <span className={`font-semibold ${getComparisonColor(weeklyComparison.comparison.vtr)}`}>
                    {weeklyComparison.comparison.vtr > 0 ? "+" : ""}
                    {weeklyComparison.comparison.vtr.toFixed(1)}%
                  </span>
                </div>
                <div className="text-xs">
                  <span className="text-blue-600 font-medium">{weeklyComparison.current.vtr.toFixed(2)}%</span>
                  <span className="text-gray-500"> vs </span>
                  <span className="text-orange-600 font-medium">{weeklyComparison.previous.vtr.toFixed(2)}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Área do Gráfico e Informações */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4 min-h-0">
        {/* Gráfico */}
        <div className="lg:col-span-3 card-overlay rounded-lg shadow-lg p-4 flex flex-col">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Comparativo de Períodos - {selectedMetric.charAt(0).toUpperCase() + selectedMetric.slice(1)}
          </h3>
          <div className="flex-1" style={{ minHeight: "400px" }}>
            {weeklyChartData.length > 0 && weeklyChartData.some((series) => series.data.length > 0) ? (
              <ResponsiveLine
                data={weeklyChartData}
                margin={{ top: 30, right: 30, bottom: 80, left: 100 }}
                xScale={{ type: "point" }}
                yScale={getChartScale()}
                yFormat=" >-.0f"
                axisTop={null}
                axisRight={null}
                axisBottom={{
                  tickSize: 5,
                  tickPadding: 15,
                  tickRotation: -45,
                  legend: "Dia/Mês",
                  legendOffset: 60,
                  legendPosition: "middle",
                }}
                axisLeft={{
                  tickSize: 5,
                  tickPadding: 10,
                  tickRotation: 0,
                  legend: selectedMetric.charAt(0).toUpperCase() + selectedMetric.slice(1),
                  legendOffset: -65,
                  legendPosition: "middle",
                  format: (value) => {
                    if (["ctr", "vtr"].includes(selectedMetric)) {
                      return `${value.toFixed(1)}%`
                    }
                    if (["cpm", "cpc", "cpv"].includes(selectedMetric)) {
                      return `R$ ${value.toFixed(2)}`
                    }
                    return value.toLocaleString("pt-BR")
                  },
                }}
                pointSize={8}
                pointColor={{ theme: "background" }}
                pointBorderWidth={2}
                pointBorderColor={{ from: "serieColor" }}
                pointLabelYOffset={-12}
                useMesh={true}
                colors={["#fbbf24", "#3b82f6"]}
                lineWidth={3}
                enableArea={true}
                areaOpacity={0.2}
                defs={[
                  {
                    id: "gradientA",
                    type: "linearGradient",
                    colors: [
                      { offset: 0, color: "#fbbf24", opacity: 0.3 },
                      { offset: 100, color: "#fbbf24", opacity: 0.1 },
                    ],
                  },
                  {
                    id: "gradientB",
                    type: "linearGradient",
                    colors: [
                      { offset: 0, color: "#3b82f6", opacity: 0.3 },
                      { offset: 100, color: "#3b82f6", opacity: 0.1 },
                    ],
                  },
                ]}
                fill={[
                  { match: { id: "Período Anterior" }, id: "gradientA" },
                  { match: { id: "Período Atual" }, id: "gradientB" },
                ]}
                legends={[
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
                ]}
                tooltip={({ point }) => (
                  <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                    <div className="text-sm font-medium text-gray-900">Dia: {point.data.x}</div>
                    <div className="text-sm text-gray-600">
                      {point.seriesId}:{" "}
                      {["ctr", "vtr"].includes(selectedMetric)
                        ? `${(point.data.y as number).toFixed(2)}%`
                        : ["cpm", "cpc", "cpv"].includes(selectedMetric)
                          ? `R$ ${(point.data.y as number).toFixed(2)}`
                          : (point.data.y as number).toLocaleString("pt-BR")}
                    </div>
                  </div>
                )}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <BarChart3 className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>Não há dados disponíveis para o período selecionado</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Painel de Controle da Métrica */}
        <div className="card-overlay rounded-lg shadow-lg p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Selecionar Métrica</h3>
          <div className="space-y-2">
            {[
              { key: "impressions", label: "Impressões", icon: TrendingUp },
              { key: "clicks", label: "Cliques", icon: MousePointer },
              { key: "views", label: "Visualizações", icon: Eye },
              { key: "cpm", label: "CPM", icon: DollarSign },
              { key: "cpv", label: "CPV", icon: DollarSign },
              { key: "ctr", label: "CTR", icon: BarChart3 },
              { key: "vtr", label: "VTR", icon: BarChart3 },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setSelectedMetric(key as typeof selectedMetric)}
                className={`w-full p-3 rounded-lg text-left transition-colors duration-200 flex items-center space-x-3 ${
                  selectedMetric === key
                    ? "bg-blue-50 border-blue-200 text-blue-700 border-2"
                    : "bg-gray-50 border-gray-200 text-gray-600 border hover:bg-gray-100"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="font-medium">{label}</span>
              </button>
            ))}
          </div>

          {/* Resumo da Métrica Selecionada */}
          <div className="mt-6 p-3 bg-gray-50 rounded-lg">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Resumo da Métrica</h4>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Atual:</span>
                <span className="font-medium">
                  {selectedMetric === "impressions" && weeklyComparison.current.impressions.toLocaleString("pt-BR")}
                  {selectedMetric === "clicks" && weeklyComparison.current.clicks.toLocaleString("pt-BR")}
                  {selectedMetric === "views" && weeklyComparison.current.views.toLocaleString("pt-BR")}
                  {selectedMetric === "cpm" && formatCurrency(weeklyComparison.current.cpm)}
                  {selectedMetric === "cpv" && formatCurrency(weeklyComparison.current.cpv)}
                  {selectedMetric === "ctr" && `${weeklyComparison.current.ctr.toFixed(2)}%`}
                  {selectedMetric === "vtr" && `${weeklyComparison.current.vtr.toFixed(2)}%`}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Anterior:</span>
                <span className="font-medium">
                  {selectedMetric === "impressions" && weeklyComparison.previous.impressions.toLocaleString("pt-BR")}
                  {selectedMetric === "clicks" && weeklyComparison.previous.clicks.toLocaleString("pt-BR")}
                  {selectedMetric === "views" && weeklyComparison.previous.views.toLocaleString("pt-BR")}
                  {selectedMetric === "cpm" && formatCurrency(weeklyComparison.previous.cpm)}
                  {selectedMetric === "cpv" && formatCurrency(weeklyComparison.previous.cpv)}
                  {selectedMetric === "ctr" && `${weeklyComparison.previous.ctr.toFixed(2)}%`}
                  {selectedMetric === "vtr" && `${weeklyComparison.previous.vtr.toFixed(2)}%`}
                </span>
              </div>
              <div className="flex justify-between text-sm pt-2 border-t border-gray-200">
                <span className="text-gray-600">Variação:</span>
                <span className={`font-semibold ${getComparisonColor(weeklyComparison.comparison[selectedMetric])}`}>
                  {weeklyComparison.comparison[selectedMetric] > 0 ? "+" : ""}
                  {weeklyComparison.comparison[selectedMetric].toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AnaliseSemanal

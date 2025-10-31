"use client"

import type React from "react"
import { useState, useEffect, useMemo } from "react"
import { BarChart3, Calendar } from "lucide-react"
import Loading from "../../components/Loading/Loading"
import { useConsolidadoData, useBenchmarkData } from "../../services/api"

interface BenchmarkData {
  platform: string
  investment: number
  impressions: number
  clicks: number
  engagements: number
  videoPlays: number
  videoCompletions: number
}

interface BenchmarkMetrics {
  cpm: number
  cpc: number
  cpv: number
  ctr: number
  vtr: number
}

interface ProcessedBenchmarkData {
  general: BenchmarkMetrics
  platforms: Record<string, BenchmarkMetrics>
}

interface BenchmarkComparison {
  metrics: BenchmarkMetrics
  isGeneral: boolean
  message: string
}

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
  videoPlays: number
  videoCompletions: number
}

interface PlatformMetrics {
  platform: string
  impressions: number
  cost: number
  reach: number
  clicks: number
  cpm: number
  frequency: number
  videoPlays: number
  videoCompletions: number
  color: string
}

interface ChartDataPoint {
  platform: string
  value: number
  color: string
}

const VisaoGeral: React.FC = () => {
  const { data: apiData, loading, error } = useConsolidadoData()
  const { data: benchmarkApiData, loading: benchmarkLoading, error: benchmarkError } = useBenchmarkData()
  const [processedData, setProcessedData] = useState<ProcessedData[]>([])
  const [benchmarkData, setBenchmarkData] = useState<ProcessedBenchmarkData | null>(null)
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: "", end: "" })
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])

  // Cores para as plataformas
  const platformColors: Record<string, string> = {
    Google: "#4285f4",
    Meta: "#0668E1",
    TikTok: "#ff0050",
    YouTube: "#ff0000",
    Kwai: "#ff6b35",
    "Globo.com": "#00a86b",
    Serasa: "#9b59b6",
    "Folha de SP": "#e91e63",
    Spotify: "#1DB954",
    LinkedIn: "#0077b5",
    Pinterest: "#bd081c",
    Default: "#6366f1",
  }

  // Processar dados de benchmark
  useEffect(() => {
    if (benchmarkApiData?.values) {
      const headers = benchmarkApiData.values[0]
      const rows = benchmarkApiData.values.slice(1)

      const parseNumber = (value: string) => {
        if (!value || value === "-" || value === "R$ -") return 0
        return Number.parseFloat(value.replace(/[R$\s.]/g, "").replace(",", ".")) || 0
      }

      const parseInteger = (value: string) => {
        if (!value || value === "-") return 0
        return Number.parseInt(value.replace(/[.\s]/g, "").replace(",", "")) || 0
      }

      const benchmarkRows: BenchmarkData[] = rows
        .map((row: string[]) => ({
          platform: row[headers.indexOf("VEÍCULO")] || "",
          investment: parseNumber(row[headers.indexOf("NEGOCIADO TOTAL LÍQUIDO")]),
          impressions: parseInteger(row[headers.indexOf("IMPRESSÕES REALIZADAS")]),
          clicks: parseInteger(row[headers.indexOf("CLICKS")]),
          engagements: parseInteger(row[headers.indexOf("ENGAJAMENTOS")]),
          videoPlays: parseInteger(row[headers.indexOf("VIDEO PLAYS")]),
          videoCompletions: parseInteger(row[headers.indexOf("VIDEO COMPLETIONS")]),
        }))
        .filter((item: BenchmarkData) => item.platform && item.investment > 0)

      // Calcular métricas gerais
      const totalInvestment = benchmarkRows.reduce((sum, item) => sum + item.investment, 0)
      const totalImpressions = benchmarkRows.reduce((sum, item) => sum + item.impressions, 0)
      const totalClicks = benchmarkRows.reduce((sum, item) => sum + item.clicks, 0)
      const totalVideoPlays = benchmarkRows.reduce((sum, item) => sum + item.videoPlays, 0)
      const totalVideoCompletions = benchmarkRows.reduce((sum, item) => sum + item.videoCompletions, 0)

      const generalMetrics: BenchmarkMetrics = {
        cpm: totalImpressions > 0 ? totalInvestment / (totalImpressions / 1000) : 0,
        cpc: totalClicks > 0 ? totalInvestment / totalClicks : 0,
        cpv: totalVideoCompletions > 0 ? totalInvestment / totalVideoCompletions : 0,
        ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
        vtr: totalVideoPlays > 0 ? (totalVideoCompletions / totalVideoPlays) * 100 : 0,
      }

      // Calcular métricas por plataforma
      const platformMetrics: Record<string, BenchmarkMetrics> = {}

      // Agrupar por plataforma
      const platformGroups: Record<string, BenchmarkData[]> = {}
      benchmarkRows.forEach((item) => {
        const platformKey = item.platform.toUpperCase()
        if (!platformGroups[platformKey]) {
          platformGroups[platformKey] = []
        }
        platformGroups[platformKey].push(item)
      })

      // Calcular métricas para cada plataforma
      Object.entries(platformGroups).forEach(([platform, items]) => {
        const platformInvestment = items.reduce((sum, item) => sum + item.investment, 0)
        const platformImpressions = items.reduce((sum, item) => sum + item.impressions, 0)
        const platformClicks = items.reduce((sum, item) => sum + item.clicks, 0)
        const platformVideoPlays = items.reduce((sum, item) => sum + item.videoPlays, 0)
        const platformVideoCompletions = items.reduce((sum, item) => sum + item.videoCompletions, 0)

        platformMetrics[platform] = {
          cpm: platformImpressions > 0 ? platformInvestment / (platformImpressions / 1000) : 0,
          cpc: platformClicks > 0 ? platformInvestment / platformClicks : 0,
          cpv: platformVideoCompletions > 0 ? platformInvestment / platformVideoCompletions : 0,
          ctr: platformImpressions > 0 ? (platformClicks / platformImpressions) * 100 : 0,
          vtr: platformVideoPlays > 0 ? (platformVideoCompletions / platformVideoPlays) * 100 : 0,
        }
      })

      setBenchmarkData({
        general: generalMetrics,
        platforms: platformMetrics,
      })
    }
  }, [benchmarkApiData])

  // Função para obter benchmark apropriado - com tipagem correta
  const getBenchmarkForPlatforms = (platforms: string[]): BenchmarkComparison => {
    const defaultMetrics: BenchmarkMetrics = {
      cpm: 0,
      cpc: 0,
      cpv: 0,
      ctr: 0,
      vtr: 0,
    }

    if (!benchmarkData) {
      return { metrics: defaultMetrics, isGeneral: true, message: "" }
    }

    if (platforms.length === 0) {
      return { metrics: benchmarkData.general, isGeneral: true, message: "" }
    }

    if (platforms.length === 1) {
      const platform = platforms[0].toUpperCase()
      const platformBenchmark = benchmarkData.platforms[platform]

      if (platformBenchmark) {
        return {
          metrics: platformBenchmark,
          isGeneral: false,
          message: `Comparando com benchmark de ${platforms[0]} em campanhas massivas para o Banco do Brasil`,
        }
      } else {
        return {
          metrics: benchmarkData.general,
          isGeneral: true,
          message: `Comparando com campanhas massivas gerais (${platforms[0]} não encontrado no benchmark)`,
        }
      }
    }

    // Múltiplas plataformas - usar benchmark geral
    return {
      metrics: benchmarkData.general,
      isGeneral: true,
      message: "Comparando com benchmark geral de campanhas massivas",
    }
  }

  const currentBenchmark = getBenchmarkForPlatforms(selectedPlatforms)

  const availablePlatforms = useMemo(() => {
    const platforms = new Set<string>()
    processedData.forEach((item) => {
      platforms.add(item.platform)
    })
    return Array.from(platforms)
  }, [processedData])

  const togglePlatform = (platform: string) => {
    setSelectedPlatforms((prev) => {
      if (prev.includes(platform)) {
        return prev.filter((p) => p !== platform)
      } else {
        return [...prev, platform]
      }
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

          return {
            date: row[headers.indexOf("Date")] || "",
            platform: row[headers.indexOf("Veículo")] || "Outros",
            campaignName: row[headers.indexOf("Campaign name")] || "",
            impressions: parseInteger(row[headers.indexOf("Impressions")]),
            cost: parseNumber(row[headers.indexOf("Total spent")]),
            reach: parseInteger(row[headers.indexOf("Reach")]),
            clicks: parseInteger(row[headers.indexOf("Clicks")]),
            frequency: parseNumber(row[headers.indexOf("Frequency")]) || 1,
            cpm: parseNumber(row[headers.indexOf("CPM")]),
            videoPlays: parseInteger(
              row[headers.indexOf("Video views ")] || row[headers.indexOf("Video starts")] || "0",
            ),
            videoCompletions: parseInteger(row[headers.indexOf("Video completions ")] || "0"),
          } as ProcessedData
        })
        .filter((item: ProcessedData) => item.date && item.impressions > 0)

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
    }
  }, [apiData])

  // Filtrar dados por data
  const filteredData = useMemo(() => {
    if (!dateRange.start || !dateRange.end) return processedData

    return processedData
      .filter((item) => {
        const itemDateISO = convertBrazilianDate(item.date)
        if (!itemDateISO) return false

        const itemDate = new Date(itemDateISO)
        const startDate = new Date(dateRange.start)
        const endDate = new Date(dateRange.end)
        return itemDate >= startDate && itemDate <= endDate
      })
      .filter((item) => selectedPlatforms.length === 0 || selectedPlatforms.includes(item.platform))
  }, [processedData, dateRange, selectedPlatforms])

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
          videoPlays: 0,
          videoCompletions: 0,
          color: platformColors[item.platform] || platformColors.Default,
        }
      }

      metrics[item.platform].impressions += item.impressions
      metrics[item.platform].cost += item.cost
      metrics[item.platform].reach += item.reach
      metrics[item.platform].clicks += item.clicks
      metrics[item.platform].videoPlays += item.videoPlays
      metrics[item.platform].videoCompletions += item.videoCompletions
    })

    // Calcular médias
    Object.values(metrics).forEach((metric) => {
      const platformData = filteredData.filter((item) => item.platform === metric.platform)
      if (platformData.length > 0) {
        metric.cpm = metric.cost / (metric.impressions / 1000)
        metric.frequency = metric.reach > 0 ? metric.impressions / metric.reach : 0
      }
    })

    return Object.values(metrics).sort((a, b) => b.impressions - a.impressions)
  }, [filteredData])

  // Calcular totais
  const totals = useMemo(() => {
    const investment = filteredData.reduce((sum, item) => sum + item.cost, 0)
    const impressions = filteredData.reduce((sum, item) => sum + item.impressions, 0)
    const reach = Math.max(...filteredData.map((item) => item.reach), 0)
    const clicks = filteredData.reduce((sum, item) => sum + item.clicks, 0)
    const videoPlays = filteredData.reduce((sum, item) => sum + item.videoPlays, 0)
    const videoCompletions = filteredData.reduce((sum, item) => sum + item.videoCompletions, 0)

    const frequency = filteredData.length > 0 && reach > 0 ? impressions / reach : 0
    const cpm = impressions > 0 ? investment / (impressions / 1000) : 0
    const cpc = clicks > 0 ? investment / clicks : 0
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0
    const cpv = videoCompletions > 0 ? investment / videoCompletions : 0
    const vtr = videoPlays > 0 ? (videoCompletions / videoPlays) * 100 : 0 // Fixed VTR calculation

    return {
      investment,
      impressions,
      reach,
      clicks,
      videoPlays,
      videoCompletions,
      frequency,
      cpm,
      cpc,
      ctr,
      cpv,
      vtr, // Now using real calculated VTR
    }
  }, [filteredData])

  // Preparar dados para gráficos
  const impressionsChartData: ChartDataPoint[] = platformMetrics.map((metric) => ({
    platform: metric.platform,
    value: metric.impressions,
    color: metric.color,
  }))

  const reachChartData: ChartDataPoint[] = platformMetrics.map((metric) => ({
    platform: metric.platform,
    value: metric.reach,
    color: metric.color,
  }))

  const frequencyChartData: ChartDataPoint[] = platformMetrics.map((metric) => ({
    platform: metric.platform,
    value: metric.frequency,
    color: metric.color,
  }))

  const cpmChartData: ChartDataPoint[] = platformMetrics.map((metric) => ({
    platform: metric.platform,
    value: metric.cpm,
    color: metric.color,
  }))

  const clicksChartData: ChartDataPoint[] = platformMetrics.map((metric) => ({
    platform: metric.platform,
    value: metric.clicks,
    color: metric.color,
  }))

  const videoPlaysChartData: ChartDataPoint[] = platformMetrics.map((metric) => ({
    platform: metric.platform,
    value: metric.videoPlays,
    color: metric.color,
  }))

  const videoCompletionsChartData: ChartDataPoint[] = platformMetrics.map((metric) => ({
    platform: metric.platform,
    value: metric.videoCompletions,
    color: metric.color,
  }))

  const vtrChartData: ChartDataPoint[] = platformMetrics.map((metric) => ({
    platform: metric.platform,
    value: metric.videoPlays > 0 ? (metric.videoCompletions / metric.videoPlays) * 100 : 0,
    color: metric.color,
  }))

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

  // Componente de gráfico de barras horizontal
  const HorizontalBarChart: React.FC<{
    data: ChartDataPoint[]
    title: string
    format?: (value: number) => string
  }> = ({ data, title, format = formatNumber }) => {
    const maxValue = Math.max(...data.map((d) => d.value))

    return (
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-gray-700">{title}</h4>
        <div className="space-y-2">
          {data.map((item, index) => (
            <div key={index} className="flex items-center space-x-3">
              <div className="w-16 text-xs text-gray-600 truncate">{item.platform}</div>
              <div className="flex-1 relative">
                <div className="h-6 bg-gray-100 rounded">
                  <div
                    className="h-full rounded transition-all duration-500"
                    style={{
                      width: `${(item.value / maxValue) * 100}%`,
                      backgroundColor: item.color,
                    }}
                  />
                </div>
                <div className="absolute right-2 top-0 h-6 flex items-center">
                  <span className="text-xs font-medium text-gray-700">{format(item.value)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Componente para exibir métrica comparativa (updated)
  const MetricComparison: React.FC<{
    label: string
    value: number
    benchmark: number
    format: (val: number) => string
    isHigherBetter: boolean
    showWarning?: boolean
    warningMessage?: string
  }> = ({ label, value, benchmark, format, isHigherBetter, showWarning, warningMessage }) => {
    const isBetter = isHigherBetter ? value >= benchmark : value <= benchmark
    const colorClass = isBetter ? "text-green-600" : "text-red-600"
    const arrowIcon = isBetter ? "↑" : "↓"

    return (
      <div className="py-2 border-b border-gray-100 last:border-b-0">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-700">{label}</span>
          <div className="flex items-center space-x-2">
            <span className={`text-sm font-medium ${colorClass}`}>{format(value)}</span>
            <span className="text-xs text-gray-500">
              ({format(benchmark)} {arrowIcon})
            </span>
          </div>
        </div>
        {showWarning && warningMessage && (
          <div className="mt-1 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">{warningMessage}</div>
        )}
      </div>
    )
  }

  // Update the loading condition
  if (loading || benchmarkLoading) {
    return <Loading message="Carregando visão geral..." />
  }

  if (error || benchmarkError) {
    return (
      <div className="bg-red-50/90 backdrop-blur-sm border border-red-200 rounded-lg p-4">
        <p className="text-red-600">Erro ao carregar dados: {error?.message || benchmarkError?.message}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <BarChart3 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 text-enhanced">Visão Geral da Campanha</h1>
            <p className="text-gray-600">Dashboard de performance</p>
          </div>
        </div>
        <div className="text-sm text-gray-600 bg-white/80 backdrop-blur-sm px-3 py-1 rounded-lg">
          Última atualização: {new Date().toLocaleString("pt-BR")}
        </div>
      </div>

      {/* Filtro de Data */}
      <div className="card-overlay rounded-lg shadow-lg p-4">
        <div className="flex items-center space-x-4">
          <label className="block text-sm font-medium text-gray-700 flex items-center">
            <Calendar className="w-4 h-4 mr-2" />
            Período:
          </label>
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value }))}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
          <span className="text-gray-500">até</span>
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
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

      {/* Métricas Principais */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
        <div className="card-overlay rounded-lg shadow-lg p-4 text-center min-h-[80px] flex flex-col justify-center">
          <div className="text-sm text-gray-600 mb-1">Investimento Total</div>
          <div className="text-xl font-bold text-green-600">R$ {formatNumber(totals.investment)}</div>
        </div>

        <div className="card-overlay rounded-lg shadow-lg p-4 text-center min-h-[80px] flex flex-col justify-center">
          <div className="text-sm text-gray-600 mb-1">Impressões</div>
          <div className="text-xl font-bold text-blue-600">{formatNumber(totals.impressions)}</div>
        </div>

        <div className="card-overlay rounded-lg shadow-lg p-4 text-center min-h-[80px] flex flex-col justify-center">
          <div className="text-sm text-gray-600 mb-1">CPM</div>
          <div className="text-xl font-bold text-purple-600">R$ {totals.cpm.toFixed(2)}</div>
        </div>

        <div className="card-overlay rounded-lg shadow-lg p-4 text-center min-h-[80px] flex flex-col justify-center">
          <div className="text-sm text-gray-600 mb-1">Alcance</div>
          <div className="text-xl font-bold text-orange-600">{formatNumber(totals.reach)}</div>
        </div>

        <div className="card-overlay rounded-lg shadow-lg p-4 text-center min-h-[80px] flex flex-col justify-center">
          <div className="text-sm text-gray-600 mb-1">Frequência</div>
          <div className="text-xl font-bold text-red-600">{totals.frequency.toFixed(2)}</div>
        </div>

        <div className="card-overlay rounded-lg shadow-lg p-4 text-center min-h-[80px] flex flex-col justify-center">
          <div className="text-sm text-gray-600 mb-1">Cliques</div>
          <div className="text-xl font-bold text-teal-600">{formatNumber(totals.clicks)}</div>
        </div>

        <div className="card-overlay rounded-lg shadow-lg p-4 text-center min-h-[80px] flex flex-col justify-center">
          <div className="text-sm text-gray-600 mb-1">Video Plays</div>
          <div className="text-xl font-bold text-indigo-600">{formatNumber(totals.videoPlays)}</div>
        </div>

        <div className="card-overlay rounded-lg shadow-lg p-4 text-center min-h-[80px] flex flex-col justify-center">
          <div className="text-sm text-gray-600 mb-1">VTR</div>
          <div className="text-xl font-bold text-pink-600">{totals.vtr.toFixed(2)}%</div>
        </div>
      </div>

      {/* Gráficos de Barras */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 flex-1">
        {/* Impressões por Plataforma */}
        <div className="card-overlay rounded-lg shadow-lg p-4">
          <HorizontalBarChart data={impressionsChartData} title="Impressões" />
        </div>

        {/* Alcance por Plataforma */}
        <div className="card-overlay rounded-lg shadow-lg p-4">
          <HorizontalBarChart data={reachChartData} title="Alcance" />
        </div>

        {/* Frequência por Plataforma */}
        <div className="card-overlay rounded-lg shadow-lg p-4">
          <HorizontalBarChart data={frequencyChartData} title="Frequência" format={(value) => value.toFixed(2)} />
        </div>

        {/* CPM por Plataforma */}
        <div className="card-overlay rounded-lg shadow-lg p-4">
          <HorizontalBarChart data={cpmChartData} title="CPM Médio" format={(value) => formatCurrency(value)} />
        </div>

        {/* Cliques por Plataforma */}
        <div className="card-overlay rounded-lg shadow-lg p-4">
          <HorizontalBarChart data={clicksChartData} title="Cliques" />
        </div>

        {/* Video Plays por Plataforma */}
        <div className="card-overlay rounded-lg shadow-lg p-4">
          <HorizontalBarChart data={videoPlaysChartData} title="Video Plays" />
        </div>

        {/* Video Completions por Plataforma */}
        <div className="card-overlay rounded-lg shadow-lg p-4">
          <HorizontalBarChart data={videoCompletionsChartData} title="Video Completions" />
        </div>

        {/* VTR por Plataforma */}
        <div className="card-overlay rounded-lg shadow-lg p-4">
          <HorizontalBarChart data={vtrChartData} title="VTR (%)" format={(value) => `${value.toFixed(2)}%`} />
        </div>

        {/* Quadro Comparativo de Métricas com Benchmark */}
        <div className="card-overlay rounded-lg shadow-lg p-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Comparativo com Benchmark</h4>
          {currentBenchmark.message && (
            <div className="mb-3 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">{currentBenchmark.message}</div>
          )}
          <div className="space-y-1">
            <MetricComparison
              label="CPM"
              value={totals.cpm}
              benchmark={currentBenchmark.metrics.cpm}
              format={(val) => `R$ ${val.toFixed(2)}`}
              isHigherBetter={false}
              showWarning={currentBenchmark.isGeneral && selectedPlatforms.length === 1}
              warningMessage={
                currentBenchmark.isGeneral && selectedPlatforms.length === 1
                  ? "Usando benchmark geral - plataforma específica não encontrada"
                  : undefined
              }
            />
            <MetricComparison
              label="CPC"
              value={totals.cpc}
              benchmark={currentBenchmark.metrics.cpc}
              format={(val) => `R$ ${val.toFixed(2)}`}
              isHigherBetter={false}
              showWarning={currentBenchmark.isGeneral && selectedPlatforms.length === 1}
              warningMessage={
                currentBenchmark.isGeneral && selectedPlatforms.length === 1
                  ? "Usando benchmark geral - plataforma específica não encontrada"
                  : undefined
              }
            />
            <MetricComparison
              label="CPV (Custo por Visualização 100%)"
              value={totals.cpv}
              benchmark={currentBenchmark.metrics.cpv}
              format={(val) => `R$ ${val.toFixed(2)}`}
              isHigherBetter={false}
              showWarning={currentBenchmark.isGeneral && selectedPlatforms.length === 1}
              warningMessage={
                currentBenchmark.isGeneral && selectedPlatforms.length === 1
                  ? "Usando benchmark geral - plataforma específica não encontrada"
                  : undefined
              }
            />
            <MetricComparison
              label="CTR"
              value={totals.ctr}
              benchmark={currentBenchmark.metrics.ctr}
              format={(val) => `${val.toFixed(2)}%`}
              isHigherBetter={true}
              showWarning={currentBenchmark.isGeneral && selectedPlatforms.length === 1}
              warningMessage={
                currentBenchmark.isGeneral && selectedPlatforms.length === 1
                  ? "Usando benchmark geral - plataforma específica não encontrada"
                  : undefined
              }
            />
            <MetricComparison
              label="VTR"
              value={totals.vtr}
              benchmark={currentBenchmark.metrics.vtr}
              format={(val) => `${val.toFixed(2)}%`}
              isHigherBetter={true}
              showWarning={currentBenchmark.isGeneral && selectedPlatforms.length === 1}
              warningMessage={
                currentBenchmark.isGeneral && selectedPlatforms.length === 1
                  ? "Usando benchmark geral - plataforma específica não encontrada"
                  : undefined
              }
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default VisaoGeral

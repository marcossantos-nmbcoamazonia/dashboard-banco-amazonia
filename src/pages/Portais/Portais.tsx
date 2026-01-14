"use client"

import type React from "react"
import { useState, useEffect, useMemo } from "react"
import { ResponsiveLine } from "@nivo/line"
import { Activity, Megaphone, ChevronDown, ChevronUp, BarChart3, TrendingUp, MousePointerClick, Eye, Video } from "lucide-react"
import Loading from "../../components/Loading/Loading"

interface SheetInfo {
  id: number
  title: string
  index: number
  rowCount: number
  columnCount: number
}

interface AdServerData {
  data: string
  idCampanha: string
  nomeCampanha: string
  inicioCampanha: string
  fimCampanha: string
  nomeSite: string
  website: string
  descricaoCanal: string
  qtdComprada: number
  nomePlacement: string
  plataforma: string
  formatoCompra: string
  status: string
  urlDestino: string
  impressoes: number
  cliques: number
  views: number
  viewables: number
  viewability: number
  starts: number
  quartil1: number
  midpoint: number
  quartil3: number
  completes: number
  skips: number
  frequencia: number
  ctr: number
  vtr: number
}

type MetricType = "impressoes" | "cliques" | "views" | "ctr" | "vtr"

const Portais: React.FC = () => {
  const [data, setData] = useState<AdServerData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedCampanha, setSelectedCampanha] = useState<string | null>(null)
  const [selectedVeiculo, setSelectedVeiculo] = useState<string | null>(null)
  const [expandedCampanha, setExpandedCampanha] = useState<string | null>(null)
  const [selectedMetric, setSelectedMetric] = useState<MetricType>("impressoes")

  const SPREADSHEET_ID = "1uhVbAMPeJR2A1SAG3M7lyYZmjjr2aBturQeEHY1NjD8"
  const BASE_URL = "https://nmbcoamazonia-api.vercel.app/google/sheets"

  // Fetch data from API
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)

        // 1. Buscar lista de sheets (campanhas)
        const infoResponse = await fetch(`${BASE_URL}/${SPREADSHEET_ID}/info`)
        const infoResult = await infoResponse.json()

        if (!infoResult.success || !infoResult.data.sheets) {
          throw new Error("Erro ao carregar lista de campanhas")
        }

        const availableSheets: SheetInfo[] = infoResult.data.sheets

        // 2. Buscar dados de todas as sheets em paralelo
        const dataPromises = availableSheets.map(async (sheet) => {
          const response = await fetch(
            `${BASE_URL}/${SPREADSHEET_ID}/data?range=${sheet.title}!A:AQ`
          )
          const result = await response.json()
          return { sheetTitle: sheet.title, data: result }
        })

        const allSheetsData = await Promise.all(dataPromises)

        // 3. Processar dados de todas as sheets
        const parseNumber = (value: string): number => {
          if (!value || value === "0" || value === "") return 0
          const cleaned = value.toString().replace(/\./g, "").replace(",", ".")
          return parseFloat(cleaned) || 0
        }

        const processedData: AdServerData[] = []

        allSheetsData.forEach(({ data: result }) => {
          if (result.success && result.data.values) {
            const rows = result.data.values.slice(1) // Remove header

            rows.forEach((row: any[]) => {
              if (!row[0]) return // Pular linhas vazias

              processedData.push({
                data: row[0] || "",
                idCampanha: row[1] || "",
                nomeCampanha: row[2] || "",
                inicioCampanha: row[3] || "",
                fimCampanha: row[4] || "",
                nomeSite: row[10] || "",
                website: row[11] || "",
                descricaoCanal: row[13] || "",
                qtdComprada: parseNumber(row[14]), // Qtd Comprada (coluna O, índice 14)
                nomePlacement: row[19] || "",
                plataforma: row[20] || "",
                formatoCompra: row[24] || "",
                status: row[26] || "",
                urlDestino: row[28] || "",
                impressoes: parseNumber(row[29]),
                cliques: parseNumber(row[30]),
                views: parseNumber(row[31]),
                viewables: parseNumber(row[32]),
                viewability: parseNumber(row[33]),
                starts: parseNumber(row[34]),
                quartil1: parseNumber(row[35]),
                midpoint: parseNumber(row[36]),
                quartil3: parseNumber(row[37]),
                completes: parseNumber(row[38]),
                skips: parseNumber(row[39]),
                frequencia: parseNumber(row[40]),
                ctr: parseNumber(row[41]),
                vtr: parseNumber(row[42]),
              })
            })
          }
        })

        setData(processedData)
      } catch (err) {
        setError("Erro ao carregar dados do AdServer")
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  // Filtrar dados por seleções
  const filteredData = useMemo(() => {
    return data.filter((item) => {
      const campanhaMatch = !selectedCampanha || item.nomeCampanha === selectedCampanha
      const veiculoMatch = !selectedVeiculo || item.nomeSite === selectedVeiculo
      return campanhaMatch && veiculoMatch
    })
  }, [data, selectedCampanha, selectedVeiculo])

  // Processar campanhas com métricas
  const campanhasData = useMemo(() => {
    const campanhasMap = new Map<
      string,
      {
        contratado: number
        entregue: number
        cliques: number
        impressoes: number
        views: number
        completes: number
        viewabilityTotal: number
        viewabilityCount: number
        veiculos: Map<
          string,
          {
            contratado: number
            entregue: number
            cliques: number
            impressoes: number
            views: number
            completes: number
            viewabilityTotal: number
            viewabilityCount: number
          }
        >
      }
    >()

    // Para calcular contratado, precisamos agrupar por campanha/placement único
    const contratadosPorCampanha = new Map<string, Map<string, number>>()
    const contratadosPorVeiculo = new Map<string, Map<string, Map<string, number>>>()

    data.forEach((item) => {
      if (!item.nomeCampanha) return

      // Rastrear contratados únicos por placement
      if (!contratadosPorCampanha.has(item.nomeCampanha)) {
        contratadosPorCampanha.set(item.nomeCampanha, new Map())
      }
      if (item.qtdComprada > 0 && item.nomePlacement) {
        contratadosPorCampanha.get(item.nomeCampanha)!.set(item.nomePlacement, item.qtdComprada)
      }

      // Rastrear contratados por veículo
      if (!contratadosPorVeiculo.has(item.nomeCampanha)) {
        contratadosPorVeiculo.set(item.nomeCampanha, new Map())
      }
      if (!contratadosPorVeiculo.get(item.nomeCampanha)!.has(item.nomeSite)) {
        contratadosPorVeiculo.get(item.nomeCampanha)!.set(item.nomeSite, new Map())
      }
      if (item.qtdComprada > 0 && item.nomePlacement) {
        contratadosPorVeiculo.get(item.nomeCampanha)!.get(item.nomeSite)!.set(item.nomePlacement, item.qtdComprada)
      }

      if (!campanhasMap.has(item.nomeCampanha)) {
        campanhasMap.set(item.nomeCampanha, {
          contratado: 0,
          entregue: 0,
          cliques: 0,
          impressoes: 0,
          views: 0,
          completes: 0,
          viewabilityTotal: 0,
          viewabilityCount: 0,
          veiculos: new Map(),
        })
      }

      const campanhaData = campanhasMap.get(item.nomeCampanha)!

      // Processar métricas da campanha
      campanhaData.impressoes += item.impressoes
      campanhaData.views += item.views
      campanhaData.entregue += item.impressoes + item.views
      campanhaData.cliques += item.cliques
      campanhaData.completes += item.completes

      if (item.viewability > 0) {
        campanhaData.viewabilityTotal += item.viewability
        campanhaData.viewabilityCount++
      }

      // Processar veículos
      if (!campanhaData.veiculos.has(item.nomeSite)) {
        campanhaData.veiculos.set(item.nomeSite, {
          contratado: 0,
          entregue: 0,
          cliques: 0,
          impressoes: 0,
          views: 0,
          completes: 0,
          viewabilityTotal: 0,
          viewabilityCount: 0,
        })
      }

      const veiculoData = campanhaData.veiculos.get(item.nomeSite)!
      veiculoData.impressoes += item.impressoes
      veiculoData.views += item.views
      veiculoData.entregue += item.impressoes + item.views
      veiculoData.cliques += item.cliques
      veiculoData.completes += item.completes

      if (item.viewability > 0) {
        veiculoData.viewabilityTotal += item.viewability
        veiculoData.viewabilityCount++
      }
    })

    return Array.from(campanhasMap.entries())
      .map(([nome, campanhaMetrics]) => {
        // Calcular contratado total da campanha (soma dos placements únicos)
        const contratado = contratadosPorCampanha.has(nome)
          ? Array.from(contratadosPorCampanha.get(nome)!.values()).reduce((sum, val) => sum + val, 0)
          : 0

        const pacing = contratado > 0 ? Math.min((campanhaMetrics.entregue / contratado) * 100, 100) : 0
        const ctr = campanhaMetrics.impressoes > 0 ? (campanhaMetrics.cliques / campanhaMetrics.impressoes) * 100 : 0
        const vtr = campanhaMetrics.views > 0 ? (campanhaMetrics.completes / campanhaMetrics.views) * 100 : 0

        const veiculos = Array.from(campanhaMetrics.veiculos.entries()).map(([nomeVeiculo, veiculoMetrics]) => {
          // Calcular contratado do veículo
          const contratadoVeiculo = contratadosPorVeiculo.has(nome) && contratadosPorVeiculo.get(nome)!.has(nomeVeiculo)
            ? Array.from(contratadosPorVeiculo.get(nome)!.get(nomeVeiculo)!.values()).reduce((sum, val) => sum + val, 0)
            : 0

          const pacingVeiculo = contratadoVeiculo > 0 ? Math.min((veiculoMetrics.entregue / contratadoVeiculo) * 100, 100) : 0
          const ctrVeiculo = veiculoMetrics.impressoes > 0 ? (veiculoMetrics.cliques / veiculoMetrics.impressoes) * 100 : 0
          const vtrVeiculo = veiculoMetrics.views > 0 ? (veiculoMetrics.completes / veiculoMetrics.views) * 100 : 0

          return {
            nome: nomeVeiculo,
            contratado: contratadoVeiculo,
            entregue: veiculoMetrics.entregue,
            pacing: pacingVeiculo,
            cliques: veiculoMetrics.cliques,
            ctr: ctrVeiculo,
            vtr: vtrVeiculo,
            impressoes: veiculoMetrics.impressoes,
            views: veiculoMetrics.views,
          }
        })

        return {
          nome,
          contratado,
          entregue: campanhaMetrics.entregue,
          pacing,
          cliques: campanhaMetrics.cliques,
          ctr,
          vtr,
          impressoes: campanhaMetrics.impressoes,
          views: campanhaMetrics.views,
          veiculos,
        }
      })
      .sort((a, b) => b.entregue - a.entregue)
  }, [data])

  // Dados do gráfico por data
  const chartData = useMemo(() => {
    const dateMap = new Map<string, { impressoes: number; cliques: number; views: number; completes: number }>()

    filteredData.forEach((item) => {
      if (!item.data) return

      if (!dateMap.has(item.data)) {
        dateMap.set(item.data, { impressoes: 0, cliques: 0, views: 0, completes: 0 })
      }

      const dateData = dateMap.get(item.data)!
      dateData.impressoes += item.impressoes
      dateData.cliques += item.cliques
      dateData.views += item.views
      dateData.completes += item.completes
    })

    const sortedDates = Array.from(dateMap.entries())
      .map(([date, metrics]) => {
        const ctr = metrics.impressoes > 0 ? (metrics.cliques / metrics.impressoes) * 100 : 0
        const vtr = metrics.views > 0 ? (metrics.completes / metrics.views) * 100 : 0
        return {
          date,
          ...metrics,
          ctr,
          vtr,
        }
      })
      .sort((a, b) => {
        const [dayA, monthA, yearA] = a.date.split("/").map(Number)
        const [dayB, monthB, yearB] = b.date.split("/").map(Number)
        const dateA = new Date(yearA, monthA - 1, dayA)
        const dateB = new Date(yearB, monthB - 1, dayB)
        return dateA.getTime() - dateB.getTime()
      })

    const metricLabels: Record<MetricType, string> = {
      impressoes: "Impressões",
      cliques: "Cliques",
      views: "Views",
      ctr: "CTR",
      vtr: "VTR",
    }

    return [
      {
        id: metricLabels[selectedMetric],
        data: sortedDates.map((day) => ({
          x: day.date,
          y: day[selectedMetric],
        })),
      },
    ]
  }, [filteredData, selectedMetric])

  // Métricas gerais baseadas em filteredData
  const metricsGerais = useMemo(() => {
    const placementMap = new Map<string, number>()

    let impressoes = 0
    let views = 0
    let cliques = 0
    let completes = 0

    filteredData.forEach((item) => {
      // Rastrear contratados únicos por placement
      if (item.qtdComprada > 0 && item.nomePlacement && !placementMap.has(item.nomePlacement)) {
        placementMap.set(item.nomePlacement, item.qtdComprada)
      }
      impressoes += item.impressoes
      views += item.views
      cliques += item.cliques
      completes += item.completes
    })

    const contratado = Array.from(placementMap.values()).reduce((sum, val) => sum + val, 0)
    const entregue = impressoes + views
    const pacing = contratado > 0 ? Math.min((entregue / contratado) * 100, 100) : 0
    const ctr = impressoes > 0 ? (cliques / impressoes) * 100 : 0
    const vtr = views > 0 ? (completes / views) * 100 : 0

    return {
      contratado,
      entregue,
      pacing,
      impressoes,
      views,
      cliques,
      ctr,
      vtr,
    }
  }, [filteredData])

  // Dados de formatos (quando um veículo é selecionado)
  const formatosData = useMemo(() => {
    if (!selectedVeiculo) return []

    const formatosMap = new Map<
      string,
      {
        impressoes: number
        views: number
        cliques: number
        completes: number
        viewabilityTotal: number
        viewabilityCount: number
      }
    >()

    let totalImpressoes = 0
    let totalViews = 0

    filteredData
      .filter((item) => item.nomeSite === selectedVeiculo)
      .forEach((item) => {
        if (!item.plataforma) return

        if (!formatosMap.has(item.plataforma)) {
          formatosMap.set(item.plataforma, {
            impressoes: 0,
            views: 0,
            cliques: 0,
            completes: 0,
            viewabilityTotal: 0,
            viewabilityCount: 0,
          })
        }

        const formatoData = formatosMap.get(item.plataforma)!
        formatoData.impressoes += item.impressoes
        formatoData.views += item.views
        formatoData.cliques += item.cliques
        formatoData.completes += item.completes
        totalImpressoes += item.impressoes
        totalViews += item.views

        if (item.viewability > 0) {
          formatoData.viewabilityTotal += item.viewability
          formatoData.viewabilityCount++
        }
      })

    return Array.from(formatosMap.entries())
      .map(([formato, formatoMetrics]) => {
        const total = formatoMetrics.impressoes + formatoMetrics.views
        const totalGeral = totalImpressoes + totalViews
        const percentual = totalGeral > 0 ? (total / totalGeral) * 100 : 0
        const ctr = formatoMetrics.impressoes > 0 ? (formatoMetrics.cliques / formatoMetrics.impressoes) * 100 : 0
        const vtr = formatoMetrics.views > 0 ? (formatoMetrics.completes / formatoMetrics.views) * 100 : 0
        const viewability = formatoMetrics.viewabilityCount > 0 ? formatoMetrics.viewabilityTotal / formatoMetrics.viewabilityCount : 0

        return {
          formato,
          total,
          percentual,
          ctr,
          vtr,
          viewability,
        }
      })
      .sort((a, b) => b.total - a.total)
  }, [filteredData, selectedVeiculo])

  const formatNumber = (value: number): string => {
    return new Intl.NumberFormat("pt-BR").format(Math.round(value))
  }

  const formatNumberAbbreviated = (value: number): string => {
    const num = Math.round(value)
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`
    }
    return num.toString()
  }

  const formatPercentage = (value: number): string => {
    return `${value.toFixed(2)}%`
  }

  if (loading) {
    return <Loading />
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-red-500 text-lg">{error}</div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col space-y-4 overflow-auto">
      {/* Header Minimalista com Filtros Integrados */}
      <div className="card-overlay rounded-xl shadow-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Activity className="w-6 h-6 text-purple-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Portais - AdServer</h1>
              <p className="text-sm text-gray-600">Veiculações em portais digitais</p>
            </div>
          </div>

          {/* Filtros */}
          <div className="flex items-center gap-3">
            {/* Filtro Campanha */}
            <select
              value={selectedCampanha || ""}
              onChange={(e) => {
                setSelectedCampanha(e.target.value || null)
                setSelectedVeiculo(null)
                setExpandedCampanha(e.target.value || null)
              }}
              className="text-sm bg-white border border-gray-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 cursor-pointer"
            >
              <option value="">Campanha: Todas</option>
              {campanhasData.map((campanha) => (
                <option key={campanha.nome} value={campanha.nome}>
                  {campanha.nome}
                </option>
              ))}
            </select>

            {/* Filtro Veículo */}
            <select
              value={selectedVeiculo || ""}
              onChange={(e) => setSelectedVeiculo(e.target.value || null)}
              className="text-sm bg-white border border-gray-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 cursor-pointer"
              disabled={!selectedCampanha}
            >
              <option value="">Veículo: Todos</option>
              {selectedCampanha &&
                campanhasData
                  .find((c) => c.nome === selectedCampanha)
                  ?.veiculos.map((veiculo) => (
                    <option key={veiculo.nome} value={veiculo.nome}>
                      {veiculo.nome}
                    </option>
                  ))}
            </select>
          </div>
        </div>
      </div>

      {/* Cards de Métricas Gerais */}
      <div className="grid grid-cols-7 gap-3">
        {/* Contratado */}
        <div className="card-overlay rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-xs font-medium text-gray-600">Contratado</h3>
            <BarChart3 className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-xl font-bold text-gray-900">
            {formatNumberAbbreviated(metricsGerais.contratado)}
          </p>
        </div>

        {/* Entregue */}
        <div className="card-overlay rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-xs font-medium text-gray-600">Entregue</h3>
            <TrendingUp className="w-4 h-4 text-green-600" />
          </div>
          <p className="text-xl font-bold text-gray-900">
            {formatNumberAbbreviated(metricsGerais.entregue)}
          </p>
          <p className="text-[10px] text-gray-500 mt-1">
            Pacing: {formatPercentage(metricsGerais.pacing)}
          </p>
        </div>

        {/* Cliques */}
        <div className="card-overlay rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-xs font-medium text-gray-600">Cliques</h3>
            <MousePointerClick className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-xl font-bold text-gray-900">
            {formatNumberAbbreviated(metricsGerais.cliques)}
          </p>
        </div>

        {/* CTR */}
        <div className="card-overlay rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-xs font-medium text-gray-600">CTR</h3>
            <MousePointerClick className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-xl font-bold text-gray-900">
            {formatPercentage(metricsGerais.ctr)}
          </p>
        </div>

        {/* Impressões */}
        <div className="card-overlay rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-xs font-medium text-gray-600">Impressões</h3>
            <Eye className="w-4 h-4 text-cyan-600" />
          </div>
          <p className="text-xl font-bold text-gray-900">
            {formatNumberAbbreviated(metricsGerais.impressoes)}
          </p>
        </div>

        {/* Views */}
        <div className="card-overlay rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-xs font-medium text-gray-600">Views</h3>
            <Video className="w-4 h-4 text-red-600" />
          </div>
          <p className="text-xl font-bold text-gray-900">
            {formatNumberAbbreviated(metricsGerais.views)}
          </p>
        </div>

        {/* VTR */}
        <div className="card-overlay rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-xs font-medium text-gray-600">VTR</h3>
            <Video className="w-4 h-4 text-orange-600" />
          </div>
          <p className="text-xl font-bold text-gray-900">
            {formatPercentage(metricsGerais.vtr)}
          </p>
        </div>
      </div>

      {/* Grid: Campanhas (40%) + Gráfico (60%) */}
      <div className="grid grid-cols-5 gap-4">
        {/* Card de Campanhas com Accordion */}
        <div className="card-overlay rounded-xl shadow-lg p-5 h-[500px] flex flex-col col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-gray-900 flex items-center">
              <Megaphone className="w-4 h-4 mr-2 text-purple-600" />
              Campanhas ({campanhasData.length})
            </h2>
            {(selectedCampanha || selectedVeiculo) && (
              <button
                onClick={() => {
                  setSelectedCampanha(null)
                  setSelectedVeiculo(null)
                  setExpandedCampanha(null)
                }}
                className="text-xs text-blue-600 hover:text-blue-800 underline"
              >
                Limpar
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto space-y-2">
            {campanhasData.map((campanha, index) => (
              <div key={index}>
                {/* Card da Campanha */}
                <div
                  className={`p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                    selectedCampanha === campanha.nome
                      ? "bg-purple-50 border-2 border-purple-400 shadow-sm"
                      : expandedCampanha === campanha.nome
                      ? "bg-purple-50 border-2 border-purple-300"
                      : "hover:bg-gray-50 border-2 border-transparent bg-gray-50"
                  }`}
                >
                  <div
                    onClick={() => {
                      if (expandedCampanha === campanha.nome) {
                        setExpandedCampanha(null)
                        setSelectedCampanha(null)
                        setSelectedVeiculo(null)
                      } else {
                        setExpandedCampanha(campanha.nome)
                        setSelectedCampanha(campanha.nome)
                        setSelectedVeiculo(null)
                      }
                    }}
                  >
                    {/* Nome da Campanha com número de veículos */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{campanha.nome}</p>
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full flex-shrink-0">
                          {campanha.veiculos.length} {campanha.veiculos.length === 1 ? 'veículo' : 'veículos'}
                        </span>
                      </div>
                      {expandedCampanha === campanha.nome ? (
                        <ChevronUp className="w-4 h-4 text-gray-600 flex-shrink-0 ml-2" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-600 flex-shrink-0 ml-2" />
                      )}
                    </div>

                    {/* Métricas em uma linha */}
                    <div className="flex items-center text-[10px] text-gray-600 gap-2">
                      <div className="flex items-center gap-1">
                        <span className="text-gray-500">Contratado:</span>
                        <span className="font-semibold text-gray-900">{formatNumberAbbreviated(campanha.contratado)}</span>
                      </div>
                      <div className="border-l border-gray-300 h-4"></div>
                      <div className="flex items-center gap-1">
                        <span className="text-gray-500">Entregue:</span>
                        <span className="font-semibold text-green-600">{formatNumberAbbreviated(campanha.entregue)}</span>
                      </div>
                      <div className="border-l border-gray-300 h-4"></div>
                      <div className="flex items-center gap-1">
                        <span className="text-gray-500">Pacing:</span>
                        <span className="font-semibold text-purple-600">{formatPercentage(campanha.pacing)}</span>
                      </div>
                      <div className="border-l border-gray-300 h-4"></div>
                      <div className="flex items-center gap-1">
                        <span className="text-gray-500">Cliques:</span>
                        <span className="font-semibold text-blue-600">{formatNumberAbbreviated(campanha.cliques)}</span>
                      </div>
                      {campanha.impressoes > 0 && (
                        <>
                          <div className="border-l border-gray-300 h-4"></div>
                          <div className="flex items-center gap-1">
                            <span className="text-gray-500">CTR:</span>
                            <span className="font-semibold text-indigo-600">{formatPercentage(campanha.ctr)}</span>
                          </div>
                        </>
                      )}
                      {campanha.views > 0 && (
                        <>
                          <div className="border-l border-gray-300 h-4"></div>
                          <div className="flex items-center gap-1">
                            <span className="text-gray-500">VTR:</span>
                            <span className="font-semibold text-orange-600">{formatPercentage(campanha.vtr)}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Lista de Veículos (Accordion) */}
                  {expandedCampanha === campanha.nome && campanha.veiculos.length > 0 && (
                    <div className="mt-3 space-y-2 pl-3 border-l-2 border-purple-300">
                      {campanha.veiculos.map((veiculo, vIdx) => (
                        <div
                          key={vIdx}
                          onClick={(e) => {
                            e.stopPropagation()
                            if (selectedVeiculo === veiculo.nome) {
                              setSelectedVeiculo(null)
                            } else {
                              setSelectedVeiculo(veiculo.nome)
                              setSelectedCampanha(campanha.nome)
                            }
                          }}
                          className={`p-3 rounded-lg cursor-pointer transition-all duration-150 border-l-4 ${
                            selectedVeiculo === veiculo.nome
                              ? "bg-blue-50 border-blue-500 shadow-sm"
                              : "bg-white hover:bg-gray-50 border-gray-300"
                          }`}
                        >
                          {/* Nome do Veículo */}
                          <p className="text-xs font-semibold text-gray-800 mb-2 truncate">{veiculo.nome}</p>

                          {/* Métricas do Veículo */}
                          <div className="space-y-2">
                            {/* Linha 1: Valores principais */}
                            <div className="flex items-center space-x-3 text-[10px]">
                              <div>
                                <span className="text-gray-400 block mb-0.5">Contratado</span>
                                <span className="font-semibold text-gray-700 text-[11px]">
                                  {formatNumberAbbreviated(veiculo.contratado)}
                                </span>
                              </div>
                              <div className="border-l border-gray-300 pl-3">
                                <span className="text-gray-400 block mb-0.5">Entregue</span>
                                <span className="font-semibold text-green-600 text-[11px]">
                                  {formatNumberAbbreviated(veiculo.entregue)}
                                </span>
                              </div>
                              <div className="border-l border-gray-300 pl-3">
                                <span className="text-gray-400 block mb-0.5">Pacing</span>
                                <span className="font-semibold text-purple-600 text-[11px]">
                                  {formatPercentage(veiculo.pacing)}
                                </span>
                              </div>
                            </div>

                            {/* Linha 2: Cliques e taxas */}
                            <div className="flex items-center space-x-3 text-[10px] border-t border-gray-200 pt-2">
                              <div>
                                <span className="text-gray-400 block mb-0.5">Cliques</span>
                                <span className="font-semibold text-blue-600 text-[11px]">
                                  {formatNumberAbbreviated(veiculo.cliques)}
                                </span>
                              </div>
                              {veiculo.impressoes > 0 && (
                                <div className="border-l border-gray-300 pl-3">
                                  <span className="text-gray-400 block mb-0.5">CTR</span>
                                  <span className="font-semibold text-indigo-600 text-[11px]">
                                    {formatPercentage(veiculo.ctr)}
                                  </span>
                                </div>
                              )}
                              {veiculo.views > 0 && (
                                <div className="border-l border-gray-300 pl-3">
                                  <span className="text-gray-400 block mb-0.5">VTR</span>
                                  <span className="font-semibold text-orange-600 text-[11px]">
                                    {formatPercentage(veiculo.vtr)}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Gráfico de Linhas (60%) */}
        <div className="card-overlay rounded-xl shadow-lg p-5 h-[500px] flex flex-col col-span-3">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-gray-900">
              Veiculação por Data
              {selectedCampanha && <span className="text-sm font-normal text-purple-600 ml-2">• {selectedCampanha}</span>}
              {selectedVeiculo && <span className="text-sm font-normal text-blue-600 ml-2">• {selectedVeiculo}</span>}
            </h2>
            <div className="relative">
              <select
                value={selectedMetric}
                onChange={(e) => setSelectedMetric(e.target.value as MetricType)}
                className="appearance-none text-sm bg-white border border-gray-300 rounded-xl pl-3 pr-8 py-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="impressoes">Impressões</option>
                <option value="cliques">Cliques</option>
                <option value="views">Views</option>
                <option value="ctr">CTR</option>
                <option value="vtr">VTR</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          <div className="flex-1 min-h-0">
            {chartData[0].data.length > 0 ? (
              <ResponsiveLine
                data={chartData}
                margin={{ top: 20, right: 20, bottom: 50, left: 60 }}
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
                  tickValues: (() => {
                    const totalDays = chartData[0].data.length
                    if (totalDays <= 7) {
                      // Poucos dias: mostrar todos
                      return chartData[0].data.map((d) => d.x)
                    } else if (totalDays <= 31) {
                      // Até um mês: mostrar a cada 3 dias
                      return chartData[0].data.filter((_, i) => i % 3 === 0).map((d) => d.x)
                    } else if (totalDays <= 90) {
                      // Até 3 meses: mostrar a cada 7 dias
                      return chartData[0].data.filter((_, i) => i % 7 === 0).map((d) => d.x)
                    } else {
                      // Mais de 3 meses: mostrar a cada 15 dias
                      return chartData[0].data.filter((_, i) => i % 15 === 0).map((d) => d.x)
                    }
                  })(),
                  format: (value) => {
                    const totalDays = chartData[0].data.length
                    const [day, month, year] = value.split("/")

                    if (totalDays <= 7) {
                      // Poucos dias: mostrar dia/mês
                      return `${day}/${month}`
                    } else if (totalDays <= 31) {
                      // Até um mês: mostrar dia/mês
                      return `${day}/${month}`
                    } else if (totalDays <= 90) {
                      // Até 3 meses: mostrar dia/mês
                      return `${day}/${month}`
                    } else {
                      // Mais de 3 meses: mostrar mês/ano
                      const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
                      return `${monthNames[parseInt(month) - 1]}/${year}`
                    }
                  },
                }}
                axisLeft={{
                  tickSize: 5,
                  tickPadding: 8,
                  tickRotation: 0,
                  legendOffset: -50,
                  legendPosition: "middle",
                  format: (value) => {
                    if (selectedMetric === "ctr" || selectedMetric === "vtr") {
                      return `${value.toFixed(1)}%`
                    }
                    return value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value.toString()
                  },
                }}
                colors={["#9333ea"]}
                pointSize={8}
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
                    fontSize: 11,
                    fill: "#6b7280",
                  },
                  axis: {
                    ticks: {
                      text: {
                        fontSize: 11,
                        fill: "#6b7280",
                      },
                    },
                  },
                }}
                tooltip={({ point }) => (
                  <div className="bg-white px-3 py-2 shadow-lg rounded border border-gray-200">
                    <div className="text-xs">
                      <strong>{point.data.xFormatted}</strong>
                      <br />
                      {selectedMetric === "ctr" || selectedMetric === "vtr"
                        ? `${(point.data.y as number).toFixed(2)}%`
                        : formatNumber(point.data.y as number)}
                    </div>
                  </div>
                )}
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-gray-500">Sem dados disponíveis</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Card de Formatos (aparece quando veículo é selecionado) */}
      {selectedVeiculo && formatosData.length > 0 && (
        <div className="card-overlay rounded-xl shadow-lg p-5">
          <h2 className="text-base font-bold text-gray-900 mb-4">
            Formatos - {selectedVeiculo}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {formatosData.map((formato, index) => (
              <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">{formato.formato}</h3>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">% Impressões/Total</span>
                    <span className="font-semibold text-gray-900">{formatPercentage(formato.percentual)}</span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">Total</span>
                    <span className="font-semibold text-gray-900">{formatNumberAbbreviated(formato.total)}</span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">CTR / VTR</span>
                    <span className="font-semibold text-gray-900">
                      {formatPercentage(formato.ctr)} / {formatPercentage(formato.vtr)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">Viewability</span>
                    <span className="font-semibold text-gray-900">{formatPercentage(formato.viewability)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default Portais

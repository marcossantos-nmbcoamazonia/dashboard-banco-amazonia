"use client"

import type React from "react"
import { useState, useEffect, useMemo } from "react"
import { ResponsiveLine } from "@nivo/line"
import { Activity, Megaphone, ChevronDown, ChevronUp, BarChart3, TrendingUp, MousePointerClick, Eye, Video } from "lucide-react"
import Loading from "../../components/Loading/Loading"

interface AdServerData {
  agencia: string
  campanha: string
  veiculo: string
  data: string
  idCanal: string
  idPlacement: string
  idCriativo: string
  dimensao: string
  linhaCriativa: string
  tipoCompra: string
  contratado_CPM: number
  impressoes: number
  bloqueadosCPM: number
  validasCPM: number
  viewablesCPM: number
  cliquesCPM: number
  vaIABCPM: number
  contratado_CPV: number
  views: number
  bloqueadosCPV: number
  validasCPV: number
  usuariosUnicosCPV: number
  viewablesCPV: number
  play: number
  progress25: number
  progress50: number
  progress75: number
  progress100: number
  cliquesCPV: number
  vaIABCPV: number
}

type TipoCompra = "CPM" | "CPV" | "Todos"
type MetricType = "impressoes" | "cliques" | "views" | "ctr" | "vtr"

const Portais: React.FC = () => {
  const [data, setData] = useState<AdServerData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedCampanha, setSelectedCampanha] = useState<string | null>(null)
  const [selectedVeiculo, setSelectedVeiculo] = useState<string | null>(null)
  const [selectedTipoCompra, setSelectedTipoCompra] = useState<TipoCompra>("Todos")
  const [expandedCampanha, setExpandedCampanha] = useState<string | null>(null)
  const [selectedMetric, setSelectedMetric] = useState<MetricType>("impressoes")

  // Fetch data from API
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const response = await fetch(
          "https://nmbcoamazonia-api.vercel.app/google/sheets/1R1ehp35FAxdP1vhI1rT-mIYw3h9fuatHMiS__5V6Yok/data?range=AdServer"
        )
        const result = await response.json()

        if (result.success && result.data.values) {
          const rows = result.data.values.slice(1)

          const processedData: AdServerData[] = rows.map((row: any[]) => {
            const parseNumber = (value: string): number => {
              if (!value || value === "0" || value === "") return 0
              const cleaned = value.toString().replace(/\./g, "").replace(",", ".")
              return parseFloat(cleaned) || 0
            }

            return {
              agencia: row[0] || "",
              campanha: row[1] || "",
              veiculo: row[2] || "",
              data: row[3] || "",
              idCanal: row[4] || "",
              idPlacement: row[5] || "",
              idCriativo: row[6] || "",
              dimensao: row[7] || "",
              linhaCriativa: row[8] || "",
              tipoCompra: row[9] || "",
              contratado_CPM: parseNumber(row[10]),
              impressoes: parseNumber(row[11]),
              bloqueadosCPM: parseNumber(row[12]),
              validasCPM: parseNumber(row[13]),
              viewablesCPM: parseNumber(row[14]),
              cliquesCPM: parseNumber(row[15]),
              vaIABCPM: parseNumber(row[16]),
              contratado_CPV: parseNumber(row[17]),
              views: parseNumber(row[18]),
              bloqueadosCPV: parseNumber(row[19]),
              validasCPV: parseNumber(row[20]),
              usuariosUnicosCPV: parseNumber(row[21]),
              viewablesCPV: parseNumber(row[22]),
              play: parseNumber(row[23]),
              progress25: parseNumber(row[24]),
              progress50: parseNumber(row[25]),
              progress75: parseNumber(row[26]),
              progress100: parseNumber(row[27]),
              cliquesCPV: parseNumber(row[28]),
              vaIABCPV: parseNumber(row[29]),
            }
          })

          setData(processedData)
        }
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
      const campanhaMatch = !selectedCampanha || item.campanha === selectedCampanha
      const veiculoMatch = !selectedVeiculo || item.veiculo === selectedVeiculo

      let tipoCompraMatch = true
      if (selectedTipoCompra === "CPM") {
        tipoCompraMatch = item.contratado_CPM > 0 || item.impressoes > 0
      } else if (selectedTipoCompra === "CPV") {
        tipoCompraMatch = item.contratado_CPV > 0 || item.views > 0
      }

      return campanhaMatch && veiculoMatch && tipoCompraMatch
    })
  }, [data, selectedCampanha, selectedVeiculo, selectedTipoCompra])

  // Processar campanhas com métricas
  const campanhasData = useMemo(() => {
    const campanhasMap = new Map<
      string,
      {
        placementsCPM: Map<string, number>
        placementsCPV: Map<string, number>
        entregue: number
        cliques: number
        impressoes: number
        views: number
        progress100: number
        viewabilityTotal: number
        viewabilityCount: number
        veiculos: Map<
          string,
          {
            placementsCPM: Map<string, number>
            placementsCPV: Map<string, number>
            entregue: number
            cliques: number
            impressoes: number
            views: number
            progress100: number
            viewabilityTotal: number
            viewabilityCount: number
          }
        >
      }
    >()

    data.forEach((item) => {
      if (!item.campanha) return

      // Aplicar filtro de tipo de compra
      if (selectedTipoCompra === "CPM" && (item.contratado_CPM === 0 && item.impressoes === 0)) return
      if (selectedTipoCompra === "CPV" && (item.contratado_CPV === 0 && item.views === 0)) return

      if (!campanhasMap.has(item.campanha)) {
        campanhasMap.set(item.campanha, {
          placementsCPM: new Map(),
          placementsCPV: new Map(),
          entregue: 0,
          cliques: 0,
          impressoes: 0,
          views: 0,
          progress100: 0,
          viewabilityTotal: 0,
          viewabilityCount: 0,
          veiculos: new Map(),
        })
      }

      const campanhaData = campanhasMap.get(item.campanha)!

      // Processar métricas da campanha
      if (selectedTipoCompra === "CPM" || selectedTipoCompra === "Todos") {
        if (item.contratado_CPM > 0 && !campanhaData.placementsCPM.has(item.idPlacement)) {
          campanhaData.placementsCPM.set(item.idPlacement, item.contratado_CPM)
        }
        campanhaData.impressoes += item.impressoes
        campanhaData.entregue += item.impressoes
        campanhaData.cliques += item.cliquesCPM
        if (item.vaIABCPM > 0) {
          campanhaData.viewabilityTotal += item.vaIABCPM
          campanhaData.viewabilityCount++
        }
      }

      if (selectedTipoCompra === "CPV" || selectedTipoCompra === "Todos") {
        if (item.contratado_CPV > 0 && !campanhaData.placementsCPV.has(item.idPlacement)) {
          campanhaData.placementsCPV.set(item.idPlacement, item.contratado_CPV)
        }
        campanhaData.views += item.views
        campanhaData.entregue += item.views
        campanhaData.progress100 += item.progress100
        campanhaData.cliques += item.cliquesCPV
        if (item.vaIABCPV > 0) {
          campanhaData.viewabilityTotal += item.vaIABCPV
          campanhaData.viewabilityCount++
        }
      }

      // Processar veículos
      if (!campanhaData.veiculos.has(item.veiculo)) {
        campanhaData.veiculos.set(item.veiculo, {
          placementsCPM: new Map(),
          placementsCPV: new Map(),
          entregue: 0,
          cliques: 0,
          impressoes: 0,
          views: 0,
          progress100: 0,
          viewabilityTotal: 0,
          viewabilityCount: 0,
        })
      }

      const veiculoData = campanhaData.veiculos.get(item.veiculo)!

      if (selectedTipoCompra === "CPM" || selectedTipoCompra === "Todos") {
        if (item.contratado_CPM > 0 && !veiculoData.placementsCPM.has(item.idPlacement)) {
          veiculoData.placementsCPM.set(item.idPlacement, item.contratado_CPM)
        }
        veiculoData.impressoes += item.impressoes
        veiculoData.entregue += item.impressoes
        veiculoData.cliques += item.cliquesCPM
        if (item.vaIABCPM > 0) {
          veiculoData.viewabilityTotal += item.vaIABCPM
          veiculoData.viewabilityCount++
        }
      }

      if (selectedTipoCompra === "CPV" || selectedTipoCompra === "Todos") {
        if (item.contratado_CPV > 0 && !veiculoData.placementsCPV.has(item.idPlacement)) {
          veiculoData.placementsCPV.set(item.idPlacement, item.contratado_CPV)
        }
        veiculoData.views += item.views
        veiculoData.entregue += item.views
        veiculoData.progress100 += item.progress100
        veiculoData.cliques += item.cliquesCPV
        if (item.vaIABCPV > 0) {
          veiculoData.viewabilityTotal += item.vaIABCPV
          veiculoData.viewabilityCount++
        }
      }
    })

    return Array.from(campanhasMap.entries())
      .map(([nome, data]) => {
        const contratado =
          Array.from(data.placementsCPM.values()).reduce((sum, val) => sum + val, 0) +
          Array.from(data.placementsCPV.values()).reduce((sum, val) => sum + val, 0)

        const pacing = contratado > 0 ? Math.min((data.entregue / contratado) * 100, 100) : 0
        const ctr = data.impressoes > 0 ? (data.cliques / data.impressoes) * 100 : 0
        const vtr = data.views > 0 ? (data.progress100 / data.views) * 100 : 0

        const veiculos = Array.from(data.veiculos.entries()).map(([nomeVeiculo, veiculoData]) => {
          const contratadoVeiculo =
            Array.from(veiculoData.placementsCPM.values()).reduce((sum, val) => sum + val, 0) +
            Array.from(veiculoData.placementsCPV.values()).reduce((sum, val) => sum + val, 0)

          const pacingVeiculo =
            contratadoVeiculo > 0 ? Math.min((veiculoData.entregue / contratadoVeiculo) * 100, 100) : 0
          const ctrVeiculo =
            veiculoData.impressoes > 0 ? (veiculoData.cliques / veiculoData.impressoes) * 100 : 0
          const vtrVeiculo = veiculoData.views > 0 ? (veiculoData.progress100 / veiculoData.views) * 100 : 0

          return {
            nome: nomeVeiculo,
            contratado: contratadoVeiculo,
            entregue: veiculoData.entregue,
            pacing: pacingVeiculo,
            cliques: veiculoData.cliques,
            ctr: ctrVeiculo,
            vtr: vtrVeiculo,
            impressoes: veiculoData.impressoes,
            views: veiculoData.views,
          }
        })

        return {
          nome,
          contratado,
          entregue: data.entregue,
          pacing,
          cliques: data.cliques,
          ctr,
          vtr,
          impressoes: data.impressoes,
          views: data.views,
          veiculos,
        }
      })
      .sort((a, b) => b.entregue - a.entregue)
  }, [data, selectedTipoCompra])

  // Dados do gráfico por data
  const chartData = useMemo(() => {
    const dateMap = new Map<string, { impressoes: number; cliques: number; views: number; cliquesCPM: number; progress100: number }>()

    filteredData.forEach((item) => {
      if (!item.data) return

      if (!dateMap.has(item.data)) {
        dateMap.set(item.data, { impressoes: 0, cliques: 0, views: 0, cliquesCPM: 0, progress100: 0 })
      }

      const dateData = dateMap.get(item.data)!
      dateData.impressoes += item.impressoes
      dateData.cliques += item.cliquesCPM + item.cliquesCPV
      dateData.views += item.views
      dateData.cliquesCPM += item.cliquesCPM
      dateData.progress100 += item.progress100
    })

    const sortedDates = Array.from(dateMap.entries())
      .map(([date, metrics]) => {
        const ctr = metrics.impressoes > 0 ? (metrics.cliquesCPM / metrics.impressoes) * 100 : 0
        const vtr = metrics.views > 0 ? (metrics.progress100 / metrics.views) * 100 : 0
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
    const placementMapCPM = new Map<string, number>()
    const placementMapCPV = new Map<string, number>()

    let impressoes = 0
    let views = 0
    let cliques = 0
    let progress100 = 0

    filteredData.forEach((item) => {
      if (selectedTipoCompra === "CPM" || selectedTipoCompra === "Todos") {
        if (item.contratado_CPM > 0 && !placementMapCPM.has(item.idPlacement)) {
          placementMapCPM.set(item.idPlacement, item.contratado_CPM)
        }
        impressoes += item.impressoes
        cliques += item.cliquesCPM
      }

      if (selectedTipoCompra === "CPV" || selectedTipoCompra === "Todos") {
        if (item.contratado_CPV > 0 && !placementMapCPV.has(item.idPlacement)) {
          placementMapCPV.set(item.idPlacement, item.contratado_CPV)
        }
        views += item.views
        cliques += item.cliquesCPV
        progress100 += item.progress100
      }
    })

    const contratado =
      Array.from(placementMapCPM.values()).reduce((sum, val) => sum + val, 0) +
      Array.from(placementMapCPV.values()).reduce((sum, val) => sum + val, 0)

    const entregue = impressoes + views
    const pacing = contratado > 0 ? Math.min((entregue / contratado) * 100, 100) : 0
    const ctr = impressoes > 0 ? (cliques / impressoes) * 100 : 0
    const vtr = views > 0 ? (progress100 / views) * 100 : 0

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
  }, [filteredData, selectedTipoCompra])

  // Dados de formatos (quando um veículo é selecionado)
  const formatosData = useMemo(() => {
    if (!selectedVeiculo) return []

    const formatosMap = new Map<
      string,
      {
        impressoes: number
        views: number
        cliques: number
        progress100: number
        viewabilityTotal: number
        viewabilityCount: number
      }
    >()

    let totalImpressoes = 0
    let totalViews = 0

    filteredData
      .filter((item) => item.veiculo === selectedVeiculo)
      .forEach((item) => {
        if (!item.dimensao) return

        if (!formatosMap.has(item.dimensao)) {
          formatosMap.set(item.dimensao, {
            impressoes: 0,
            views: 0,
            cliques: 0,
            progress100: 0,
            viewabilityTotal: 0,
            viewabilityCount: 0,
          })
        }

        const formatoData = formatosMap.get(item.dimensao)!

        if (selectedTipoCompra === "CPM" || selectedTipoCompra === "Todos") {
          formatoData.impressoes += item.impressoes
          formatoData.cliques += item.cliquesCPM
          totalImpressoes += item.impressoes
          if (item.vaIABCPM > 0) {
            formatoData.viewabilityTotal += item.vaIABCPM
            formatoData.viewabilityCount++
          }
        }

        if (selectedTipoCompra === "CPV" || selectedTipoCompra === "Todos") {
          formatoData.views += item.views
          formatoData.progress100 += item.progress100
          formatoData.cliques += item.cliquesCPV
          totalViews += item.views
          if (item.vaIABCPV > 0) {
            formatoData.viewabilityTotal += item.vaIABCPV
            formatoData.viewabilityCount++
          }
        }
      })

    return Array.from(formatosMap.entries())
      .map(([formato, data]) => {
        const total = data.impressoes + data.views
        const totalGeral = totalImpressoes + totalViews
        const percentual = totalGeral > 0 ? (total / totalGeral) * 100 : 0
        const ctr = data.impressoes > 0 ? (data.cliques / data.impressoes) * 100 : 0
        const vtr = data.views > 0 ? (data.progress100 / data.views) * 100 : 0
        const viewability = data.viewabilityCount > 0 ? data.viewabilityTotal / data.viewabilityCount : 0

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
  }, [filteredData, selectedVeiculo, selectedTipoCompra])

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
            {/* Filtro Tipo de Compra */}
            <select
              value={selectedTipoCompra}
              onChange={(e) => {
                setSelectedTipoCompra(e.target.value as TipoCompra)
                setSelectedCampanha(null)
                setSelectedVeiculo(null)
              }}
              className="text-sm bg-white border border-gray-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 cursor-pointer"
            >
              <option value="Todos">Tipo de Compra: Todos</option>
              <option value="CPM">CPM</option>
              <option value="CPV">CPV</option>
            </select>

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

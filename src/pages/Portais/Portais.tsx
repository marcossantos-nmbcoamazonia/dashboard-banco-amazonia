"use client"

import type React from "react"
import { useState, useEffect, useMemo } from "react"
import { BarChart3, Filter, TrendingUp, MousePointerClick, Eye, Video, Activity } from "lucide-react"
import { ResponsiveBar } from "@nivo/bar"
import Loading from "../../components/Loading/Loading"

interface AdServerData {
  campanha: string
  agencia: string
  periodo: string
  veiculo: string
  data: string
  idCanal: string
  nomeFormato: string
  dimensao: string
  idPlacement: string
  praca: string
  linhaCriativa: string
  idCriativo: string
  contratadoCPM: number
  impressoesCPM: number
  bloqueadosCPM: number
  validasCPM: number
  usuariosUnicosCPM: number
  viewablesCPM: number
  cliquesCPM: number
  vaIABCPM: number
  contratadoCPV: number
  views: number
  bloqueadosCPV: number
  validasCPV: number
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

const Portais: React.FC = () => {
  const [data, setData] = useState<AdServerData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedCampanha, setSelectedCampanha] = useState<string>("Todos")
  const [selectedVeiculo, setSelectedVeiculo] = useState<string>("Todos")
  const [selectedTipoCompra, setSelectedTipoCompra] = useState<TipoCompra>("Todos")

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
          const headers = result.data.values[0]
          const rows = result.data.values.slice(1)

          const processedData: AdServerData[] = rows.map((row: any[]) => {
            const parseNumber = (value: string): number => {
              if (!value || value === "0" || value === "") return 0
              const cleaned = value.toString().replace(/\./g, "").replace(",", ".")
              return parseFloat(cleaned) || 0
            }

            return {
              campanha: row[0] || "",
              agencia: row[1] || "",
              periodo: row[2] || "",
              veiculo: row[3] || "",
              data: row[4] || "",
              idCanal: row[5] || "",
              nomeFormato: row[6] || "",
              dimensao: row[7] || "",
              idPlacement: row[8] || "",
              praca: row[9] || "",
              linhaCriativa: row[10] || "",
              idCriativo: row[11] || "",
              contratadoCPM: parseNumber(row[12]),
              impressoesCPM: parseNumber(row[13]),
              bloqueadosCPM: parseNumber(row[14]),
              validasCPM: parseNumber(row[15]),
              usuariosUnicosCPM: parseNumber(row[16]),
              viewablesCPM: parseNumber(row[17]),
              cliquesCPM: parseNumber(row[18]),
              vaIABCPM: parseNumber(row[19]),
              contratadoCPV: parseNumber(row[20]),
              views: parseNumber(row[21]),
              bloqueadosCPV: parseNumber(row[22]),
              validasCPV: parseNumber(row[23]),
              viewablesCPV: parseNumber(row[24]),
              play: parseNumber(row[25]),
              progress25: parseNumber(row[26]),
              progress50: parseNumber(row[27]),
              progress75: parseNumber(row[28]),
              progress100: parseNumber(row[29]),
              cliquesCPV: parseNumber(row[30]),
              vaIABCPV: parseNumber(row[31]),
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

  // Get unique values for filters
  const campanhas = useMemo(() => {
    const unique = Array.from(new Set(data.map((item) => item.campanha).filter(Boolean)))
    return ["Todos", ...unique.sort()]
  }, [data])

  const veiculos = useMemo(() => {
    const unique = Array.from(new Set(data.map((item) => item.veiculo).filter(Boolean)))
    return ["Todos", ...unique.sort()]
  }, [data])

  // Filter data based on selections
  const filteredData = useMemo(() => {
    return data.filter((item) => {
      const campanhaMatch = selectedCampanha === "Todos" || item.campanha === selectedCampanha
      const veiculoMatch = selectedVeiculo === "Todos" || item.veiculo === selectedVeiculo

      let tipoCompraMatch = true
      if (selectedTipoCompra === "CPM") {
        tipoCompraMatch = item.contratadoCPM > 0 || item.impressoesCPM > 0
      } else if (selectedTipoCompra === "CPV") {
        tipoCompraMatch = item.contratadoCPV > 0 || item.views > 0
      }

      return campanhaMatch && veiculoMatch && tipoCompraMatch
    })
  }, [data, selectedCampanha, selectedVeiculo, selectedTipoCompra])

  // Calculate metrics
  const metrics = useMemo(() => {
    let contratadoImpressoes = 0
    let impressoesEntregues = 0
    let cliques = 0
    let views = 0
    let progress100Total = 0
    let viewabilityTotal = 0
    let viewabilityCount = 0

    filteredData.forEach((item) => {
      if (selectedTipoCompra === "CPM" || selectedTipoCompra === "Todos") {
        contratadoImpressoes += item.contratadoCPM
        impressoesEntregues += item.validasCPM
        cliques += item.cliquesCPM
        if (item.vaIABCPM > 0) {
          viewabilityTotal += item.vaIABCPM
          viewabilityCount++
        }
      }
      if (selectedTipoCompra === "CPV" || selectedTipoCompra === "Todos") {
        views += item.views
        progress100Total += item.progress100
        cliques += item.cliquesCPV
        if (item.vaIABCPV > 0) {
          viewabilityTotal += item.vaIABCPV
          viewabilityCount++
        }
      }
    })

    const pacing = contratadoImpressoes > 0 ? (impressoesEntregues / contratadoImpressoes) * 100 : 0
    const ctr = impressoesEntregues > 0 ? (cliques / impressoesEntregues) * 100 : 0
    const vtr = impressoesEntregues > 0 ? (progress100Total / impressoesEntregues) * 100 : 0
    const viewability = viewabilityCount > 0 ? viewabilityTotal / viewabilityCount : 0

    return {
      contratadoImpressoes,
      impressoesEntregues,
      pacing,
      cliques,
      ctr,
      views,
      vtr,
      viewability,
    }
  }, [filteredData, selectedTipoCompra])

  const formatNumber = (value: number): string => {
    return new Intl.NumberFormat("pt-BR").format(Math.round(value))
  }

  const formatPercentage = (value: number): string => {
    return `${value.toFixed(2)}%`
  }

  // Chart data: Pacing por Veículo
  const pacingPorVeiculoData = useMemo(() => {
    const veiculoMap = new Map<string, { contratado: number; entregue: number }>()

    filteredData.forEach((item) => {
      const veiculo = item.veiculo || "Sem veículo"
      if (!veiculoMap.has(veiculo)) {
        veiculoMap.set(veiculo, { contratado: 0, entregue: 0 })
      }
      const veiculoData = veiculoMap.get(veiculo)!
      veiculoData.contratado += item.contratadoCPM
      veiculoData.entregue += item.validasCPM
    })

    return Array.from(veiculoMap.entries())
      .map(([veiculo, data]) => ({
        veiculo,
        pacing: data.contratado > 0 ? (data.entregue / data.contratado) * 100 : 0,
      }))
      .sort((a, b) => b.pacing - a.pacing)
      .slice(0, 10)
  }, [filteredData])

  // Chart data: Veículos com maior número de Impressões
  const impressoesPorVeiculoData = useMemo(() => {
    const veiculoMap = new Map<string, number>()

    filteredData.forEach((item) => {
      const veiculo = item.veiculo || "Sem veículo"
      const impressoes = item.validasCPM + item.validasCPV
      veiculoMap.set(veiculo, (veiculoMap.get(veiculo) || 0) + impressoes)
    })

    return Array.from(veiculoMap.entries())
      .map(([veiculo, impressoes]) => ({
        veiculo,
        impressoes,
      }))
      .sort((a, b) => b.impressoes - a.impressoes)
      .slice(0, 10)
  }, [filteredData])

  // Chart data: Veículos com melhores CTR
  const ctrPorVeiculoData = useMemo(() => {
    const veiculoMap = new Map<string, { impressoes: number; cliques: number }>()

    filteredData.forEach((item) => {
      const veiculo = item.veiculo || "Sem veículo"
      if (!veiculoMap.has(veiculo)) {
        veiculoMap.set(veiculo, { impressoes: 0, cliques: 0 })
      }
      const veiculoData = veiculoMap.get(veiculo)!
      veiculoData.impressoes += item.validasCPM + item.validasCPV
      veiculoData.cliques += item.cliquesCPM + item.cliquesCPV
    })

    return Array.from(veiculoMap.entries())
      .map(([veiculo, data]) => ({
        veiculo,
        ctr: data.impressoes > 0 ? (data.cliques / data.impressoes) * 100 : 0,
      }))
      .filter((item) => item.ctr > 0)
      .sort((a, b) => b.ctr - a.ctr)
      .slice(0, 10)
  }, [filteredData])

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
    <div className="h-full flex flex-col space-y-6 overflow-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-700 rounded-2xl shadow-lg p-6">
        <div className="flex items-center space-x-3">
          <Activity className="w-8 h-8 text-white" />
          <div>
            <h1 className="text-3xl font-bold text-white">Portais - AdServer</h1>
            <p className="text-purple-100 mt-1">Veiculações em portais digitais</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card-overlay rounded-xl shadow-lg p-5">
        <div className="flex items-center space-x-2 mb-4">
          <Filter className="w-5 h-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">Filtros</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Campanha Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Campanha</label>
            <select
              value={selectedCampanha}
              onChange={(e) => setSelectedCampanha(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            >
              {campanhas.map((campanha) => (
                <option key={campanha} value={campanha}>
                  {campanha}
                </option>
              ))}
            </select>
          </div>

          {/* Veículo Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Veículo</label>
            <select
              value={selectedVeiculo}
              onChange={(e) => setSelectedVeiculo(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            >
              {veiculos.map((veiculo) => (
                <option key={veiculo} value={veiculo}>
                  {veiculo}
                </option>
              ))}
            </select>
          </div>

          {/* Tipo de Compra Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Compra</label>
            <select
              value={selectedTipoCompra}
              onChange={(e) => setSelectedTipoCompra(e.target.value as TipoCompra)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            >
              <option value="Todos">Todos</option>
              <option value="CPM">CPM</option>
              <option value="CPV">CPV</option>
            </select>
          </div>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-7 gap-4">
        {/* Contratado Impressões */}
        <div className="card-overlay rounded-xl shadow-lg p-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Contratado</h3>
            <BarChart3 className="w-5 h-5 text-purple-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatNumber(metrics.contratadoImpressoes)}</p>
        </div>

        {/* Pacing de Entrega */}
        <div className="card-overlay rounded-xl shadow-lg p-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Pacing de Entrega</h3>
            <TrendingUp className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatPercentage(metrics.pacing)}</p>
          <p className="text-xs text-gray-500 mt-1">{formatNumber(metrics.impressoesEntregues)} entregues</p>
        </div>

        {/* Cliques */}
        <div className="card-overlay rounded-xl shadow-lg p-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Cliques</h3>
            <MousePointerClick className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatNumber(metrics.cliques)}</p>
        </div>

        {/* CTR */}
        <div className="card-overlay rounded-xl shadow-lg p-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">CTR</h3>
            <MousePointerClick className="w-5 h-5 text-indigo-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatPercentage(metrics.ctr)}</p>
        </div>

        {/* Views */}
        <div className="card-overlay rounded-xl shadow-lg p-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Views</h3>
            <Eye className="w-5 h-5 text-cyan-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatNumber(metrics.views)}</p>
        </div>

        {/* VTR */}
        <div className="card-overlay rounded-xl shadow-lg p-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">VTR</h3>
            <Video className="w-5 h-5 text-red-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatPercentage(metrics.vtr)}</p>
        </div>

        {/* Viewability */}
        <div className="card-overlay rounded-xl shadow-lg p-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Viewability (VA IAB)</h3>
            <Activity className="w-5 h-5 text-orange-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatPercentage(metrics.viewability)}</p>
          <p className="text-xs text-gray-500 mt-1">Média de viewability IAB</p>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Gráfico 1: Pacing por Veículo - Barras de Progresso */}
        <div className="card-overlay rounded-xl shadow-lg p-5 h-96">
          <div className="flex items-center space-x-2 mb-4">
            <TrendingUp className="w-5 h-5 text-green-600" />
            <h2 className="text-lg font-semibold text-gray-900">Pacing por Veículo</h2>
          </div>
          <div className="h-80 overflow-y-auto">
            {pacingPorVeiculoData.length > 0 ? (
              <div className="space-y-3">
                {pacingPorVeiculoData.map((item, index) => (
                  <div key={index} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-gray-700 truncate max-w-[70%]">{item.veiculo}</span>
                      
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-6 relative overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-green-500 to-green-600 h-6 rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                        style={{ width: `${Math.min(item.pacing, 100)}%` }}
                      >
                        {item.pacing >= 20 && (
                          <span className="text-xs font-semibold text-white">
                            {item.pacing.toFixed(1)}%
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-gray-500">Sem dados disponíveis</p>
              </div>
            )}
          </div>
        </div>

        {/* Gráfico 2: Veículos com maior número de Impressões */}
        <div className="card-overlay rounded-xl shadow-lg p-5 h-96">
          <div className="flex items-center space-x-2 mb-4">
            <Eye className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Maior Número de Impressões</h2>
          </div>
          <div className="h-80 overflow-y-auto">
            {impressoesPorVeiculoData.length > 0 ? (
              <div className="space-y-3">
                {impressoesPorVeiculoData.map((item, index) => {
                  const maxImpressoes = impressoesPorVeiculoData[0].impressoes
                  const widthPercent = (item.impressoes / maxImpressoes) * 100

                  return (
                    <div key={index} className="space-y-1">
                      <div className="text-xs font-medium text-gray-700 truncate">
                        {item.veiculo}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-7 relative overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-blue-500 to-blue-600 h-7 rounded-full transition-all duration-500"
                            style={{ width: `${widthPercent}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-blue-600 min-w-[80px] text-right">
                          {formatNumber(item.impressoes)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-gray-500">Sem dados disponíveis</p>
              </div>
            )}
          </div>
        </div>

        {/* Gráfico 3: Veículos com melhores CTR */}
        <div className="card-overlay rounded-xl shadow-lg p-5 h-96">
          <div className="flex items-center space-x-2 mb-4">
            <MousePointerClick className="w-5 h-5 text-purple-600" />
            <h2 className="text-lg font-semibold text-gray-900">Melhores CTR</h2>
          </div>
          <div className="h-80 overflow-y-auto">
            {ctrPorVeiculoData.length > 0 ? (
              <div className="space-y-3">
                {ctrPorVeiculoData.map((item, index) => {
                  const maxCTR = ctrPorVeiculoData[0].ctr
                  const widthPercent = (item.ctr / maxCTR) * 100

                  return (
                    <div key={index} className="space-y-1">
                      <div className="text-xs font-medium text-gray-700 truncate">
                        {item.veiculo}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-7 relative overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-purple-500 to-purple-600 h-7 rounded-full transition-all duration-500"
                            style={{ width: `${widthPercent}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-purple-600 min-w-[60px] text-right">
                          {item.ctr.toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-gray-500">Sem dados disponíveis</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Portais

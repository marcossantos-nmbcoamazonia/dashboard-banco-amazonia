"use client"

import type React from "react"
import { useState, useMemo, useEffect } from "react"
import { ResponsiveLine } from "@nivo/line"
import {
  TrendingUp,
  DollarSign,
  Building2,
  Megaphone,
  Radio,
  Eye,
  MousePointerClick,
  Video,
  Users,
  BarChart3,
  Target,
} from "lucide-react"
import { useConsolidadoGeral, usePlanoMidia } from "../../services/consolidadoApi"
import { useGA4ConsolidadoData } from "../../services/api"
import Loading from "../../components/Loading/Loading"
import axios from "axios"

type MetricType = "impressions" | "clicks" | "videoViews" | "spent"

interface PortaisData {
  impressoes: number
  cliques: number
  visualizacoes: number
}

const Capa: React.FC = () => {
  const { campaigns, last7Days, loading: consolidadoLoading, error: consolidadoError, data: consolidadoData } = useConsolidadoGeral()
  const { data: planoData, loading: planoLoading, error: planoError } = usePlanoMidia()
  const { data: ga4Data, loading: ga4Loading, error: ga4Error } = useGA4ConsolidadoData()

  const [selectedMetric, setSelectedMetric] = useState<MetricType>("impressions")
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null)
  const [selectedAgencia, setSelectedAgencia] = useState<string | null>(null)
  const [selectedMeio, setSelectedMeio] = useState<string | null>(null)
  const [expandedMeio, setExpandedMeio] = useState<string | null>(null)
  const [selectedVeiculo, setSelectedVeiculo] = useState<string>("")
  const [portaisData, setPortaisData] = useState<PortaisData>({ impressoes: 0, cliques: 0, visualizacoes: 0 })
  const [portaisLoading, setPortaisLoading] = useState(true)

  // Buscar dados de Portais
  useEffect(() => {
    const fetchPortaisData = async () => {
      try {
        setPortaisLoading(true)
        const response = await axios.get(
          "https://nmbcoamazonia-api.vercel.app/google/sheets/1R1ehp35FAxdP1vhI1rT-mIYw3h9fuatHMiS__5V6Yok/data?range=AdServer"
        )

        if (response.data.success && response.data.data.values) {
          const headers = response.data.data.values[0]
          const rows = response.data.data.values.slice(1)

          const validasCPMIndex = headers.indexOf("Válidas CPM")
          const cliquesCPMIndex = headers.indexOf("Cliques CPM")
          const viewsIndex = headers.indexOf("Views")
          const cliquesCPVIndex = headers.indexOf("Cliques CPV")

          const parseNumber = (value: string): number => {
            if (!value || value === "0" || value === "") return 0
            const cleaned = value.toString().replace(/\./g, "").replace(",", ".")
            return parseFloat(cleaned) || 0
          }

          let impressoes = 0
          let cliques = 0
          let visualizacoes = 0

          rows.forEach((row: any[]) => {
            impressoes += parseNumber(row[validasCPMIndex] || "0")
            cliques += parseNumber(row[cliquesCPMIndex] || "0") + parseNumber(row[cliquesCPVIndex] || "0")
            visualizacoes += parseNumber(row[viewsIndex] || "0")
          })

          setPortaisData({ impressoes, cliques, visualizacoes })
        }
      } catch (error) {
        console.error("Erro ao buscar dados de Portais:", error)
      } finally {
        setPortaisLoading(false)
      }
    }

    fetchPortaisData()
  }, [])

  // Processar dados do Plano de Mídia
  const planoMetrics = useMemo(() => {
    if (!planoData?.success || !planoData?.data?.values || planoData.data.values.length < 2) {
      return {
        investimentoTotal: 0,
        agencias: [],
        campanhas: [],
        meios: [],
        entregaPrevista: 0,
        veiculosPorMeio: new Map<string, Set<string>>(),
        veiculosTotal: 0,
      }
    }

    const headers = planoData.data.values[0]
    const rows = planoData.data.values.slice(1)

    const agenciaIndex = headers.indexOf("AGÊNCIA")
    const campanhaIndex = headers.indexOf("CAMPANHA")
    const meioIndex = headers.indexOf("MEIO")
    const veiculoIndex = headers.indexOf("VEÍCULO")
    const impressoesIndex = headers.indexOf("IMPRESSÕES / CLIQUES / DIÁRIAS")
    const valorDesembolsoIndex = headers.indexOf("VALORDESEMBOLSO95%(banco)")

    const parseBrazilianCurrency = (value: string): number => {
      if (!value || value === "0" || value === "") return 0
      const cleaned = value.toString().replace(/R\$\s?/g, '').replace(/\./g, '').replace(',', '.')
      return parseFloat(cleaned) || 0
    }

    const parseBrazilianNumber = (value: string): number => {
      if (!value || value === "0" || value === "") return 0
      const cleaned = value.toString().replace(/\./g, '').replace(',', '.')
      return parseFloat(cleaned) || 0
    }

    let investimentoTotal = 0
    let entregaPrevista = 0
    const agenciasMap = new Map<string, { nome: string; investimento: number; entrega: number; campanhas: Set<string> }>()
    const campanhasMap = new Map<string, { nome: string; investimento: number; entrega: number; meios: Set<string>; veiculos: Set<string> }>()
    const meiosMap = new Map<string, { nome: string; investimento: number; entrega: number; veiculos: Set<string> }>()
    const veiculosPorMeio = new Map<string, Set<string>>()
    const allVeiculos = new Set<string>()

    rows.forEach((row) => {
      const agencia = row[agenciaIndex]
      const campanha = row[campanhaIndex]
      const meio = row[meioIndex]
      const veiculo = row[veiculoIndex]
      const impressoes = parseBrazilianNumber(row[impressoesIndex] || "0")
      const valorDesembolso = parseBrazilianCurrency(row[valorDesembolsoIndex] || "0")

      // Aplicar filtros
      if (selectedAgencia && agencia !== selectedAgencia) return
      if (selectedMeio && meio !== selectedMeio) return
      if (selectedVeiculo && veiculo !== selectedVeiculo) return

      // Mapear veículos por meio (antes dos filtros para ter todos disponíveis)
      if (meio && meio.trim() !== "" && veiculo && veiculo.trim() !== "") {
        if (!veiculosPorMeio.has(meio)) {
          veiculosPorMeio.set(meio, new Set<string>())
        }
        veiculosPorMeio.get(meio)!.add(veiculo)
        allVeiculos.add(veiculo)
      }

      investimentoTotal += valorDesembolso
      entregaPrevista += impressoes

      // Agrupar agências
      if (agencia && agencia.trim() !== "") {
        if (!agenciasMap.has(agencia)) {
          agenciasMap.set(agencia, { nome: agencia, investimento: 0, entrega: 0, campanhas: new Set<string>() })
        }
        const agenciaData = agenciasMap.get(agencia)!
        agenciaData.investimento += valorDesembolso
        agenciaData.entrega += impressoes
        if (campanha && campanha.trim() !== "") {
          agenciaData.campanhas.add(campanha)
        }
      }

      // Agrupar campanhas
      if (campanha && campanha.trim() !== "") {
        if (!campanhasMap.has(campanha)) {
          campanhasMap.set(campanha, { nome: campanha, investimento: 0, entrega: 0, meios: new Set<string>(), veiculos: new Set<string>() })
        }
        const campanhaData = campanhasMap.get(campanha)!
        campanhaData.investimento += valorDesembolso
        campanhaData.entrega += impressoes
        if (meio && meio.trim() !== "") {
          campanhaData.meios.add(meio)
        }
        if (veiculo && veiculo.trim() !== "") {
          campanhaData.veiculos.add(veiculo)
        }
      }

      // Agrupar meios
      if (meio && meio.trim() !== "") {
        if (!meiosMap.has(meio)) {
          meiosMap.set(meio, { nome: meio, investimento: 0, entrega: 0, veiculos: new Set<string>() })
        }
        const meioData = meiosMap.get(meio)!
        meioData.investimento += valorDesembolso
        meioData.entrega += impressoes
        if (veiculo && veiculo.trim() !== "") {
          meioData.veiculos.add(veiculo)
        }
      }
    })

    return {
      investimentoTotal,
      agencias: Array.from(agenciasMap.values()).map(a => ({
        nome: a.nome,
        investimento: a.investimento,
        entrega: a.entrega,
        numCampanhas: a.campanhas.size
      })).sort((a, b) => b.investimento - a.investimento),
      campanhas: Array.from(campanhasMap.values()).map(c => ({
        nome: c.nome,
        investimento: c.investimento,
        entrega: c.entrega,
        numMeios: c.meios.size,
        numVeiculos: c.veiculos.size
      })).sort((a, b) => b.investimento - a.investimento),
      meios: Array.from(meiosMap.values()).map(m => ({
        nome: m.nome,
        investimento: m.investimento,
        entrega: m.entrega,
        numVeiculos: m.veiculos.size
      })).sort((a, b) => b.investimento - a.investimento),
      entregaPrevista,
      veiculosPorMeio,
      veiculosTotal: allVeiculos.size,
    }
  }, [planoData, selectedAgencia, selectedMeio, selectedVeiculo])

  // Obter veículos por meio para o accordion
  const veiculosPorMeioList = useMemo(() => {
    if (!planoData?.success || !planoData?.data?.values || planoData.data.values.length < 2) {
      return new Map<string, Array<{ nome: string; investimento: number; entrega: number }>>()
    }

    const headers = planoData.data.values[0]
    const rows = planoData.data.values.slice(1)

    const meioIndex = headers.indexOf("MEIO")
    const veiculoIndex = headers.indexOf("VEÍCULO")
    const impressoesIndex = headers.indexOf("IMPRESSÕES / CLIQUES / DIÁRIAS")
    const valorDesembolsoIndex = headers.indexOf("VALORDESEMBOLSO95%(banco)")

    const parseBrazilianCurrency = (value: string): number => {
      if (!value || value === "0" || value === "") return 0
      const cleaned = value.toString().replace(/R\$\s?/g, '').replace(/\./g, '').replace(',', '.')
      return parseFloat(cleaned) || 0
    }

    const parseBrazilianNumber = (value: string): number => {
      if (!value || value === "0" || value === "") return 0
      const cleaned = value.toString().replace(/\./g, '').replace(',', '.')
      return parseFloat(cleaned) || 0
    }

    const veiculosMap = new Map<string, Map<string, { investimento: number; entrega: number }>>()

    rows.forEach((row) => {
      const meio = row[meioIndex]
      const veiculo = row[veiculoIndex]
      const impressoes = parseBrazilianNumber(row[impressoesIndex] || "0")
      const valorDesembolso = parseBrazilianCurrency(row[valorDesembolsoIndex] || "0")

      if (meio && meio.trim() !== "" && veiculo && veiculo.trim() !== "") {
        if (!veiculosMap.has(meio)) {
          veiculosMap.set(meio, new Map())
        }
        const meioVeiculos = veiculosMap.get(meio)!
        if (!meioVeiculos.has(veiculo)) {
          meioVeiculos.set(veiculo, { investimento: 0, entrega: 0 })
        }
        const veiculoData = meioVeiculos.get(veiculo)!
        veiculoData.investimento += valorDesembolso
        veiculoData.entrega += impressoes
      }
    })

    const result = new Map<string, Array<{ nome: string; investimento: number; entrega: number }>>()
    veiculosMap.forEach((veiculos, meio) => {
      const veiculosArray = Array.from(veiculos.entries())
        .map(([nome, data]) => ({ nome, ...data }))
        .sort((a, b) => b.investimento - a.investimento)
      result.set(meio, veiculosArray)
    })

    return result
  }, [planoData])

  // Processar resultados de Internet (Consolidado) + Portais
  const internetResults = useMemo(() => {
    if (!consolidadoData?.success || !consolidadoData?.data?.values || consolidadoData.data.values.length < 2) {
      return {
        impressoes: portaisData.impressoes,
        cliques: portaisData.cliques,
        visualizacoes: portaisData.visualizacoes,
      }
    }

    const headers = consolidadoData.data.values[0]
    const rows = consolidadoData.data.values.slice(1)

    const impressionsIndex = headers.indexOf("Impressions")
    const clicksIndex = headers.indexOf("Clicks")
    const videoViewsIndex = headers.indexOf("Video views")

    const parseBrazilianNumber = (value: string): number => {
      if (!value || value === "0") return 0
      return parseFloat(value.replace(/\./g, '').replace(',', '.'))
    }

    let impressoes = 0
    let cliques = 0
    let visualizacoes = 0

    rows.forEach((row) => {
      impressoes += parseBrazilianNumber(row[impressionsIndex] || "0")
      cliques += parseBrazilianNumber(row[clicksIndex] || "0")
      visualizacoes += parseBrazilianNumber(row[videoViewsIndex] || "0")
    })

    // Adicionar dados de Portais
    return {
      impressoes: impressoes + portaisData.impressoes,
      cliques: cliques + portaisData.cliques,
      visualizacoes: visualizacoes + portaisData.visualizacoes,
    }
  }, [consolidadoData, portaisData])

  // Processar sessões totais de 2025 do GA4
  const sessoes2025 = useMemo(() => {
    if (!ga4Data?.data?.values || ga4Data.data.values.length < 2) {
      return 0
    }

    const headers = ga4Data.data.values[0]
    const rows = ga4Data.data.values.slice(1)

    const dateIndex = headers.indexOf("Date")
    const sessionsIndex = headers.indexOf("Sessions")

    let totalSessions = 0

    rows.forEach((row) => {
      const dateStr = row[dateIndex]
      if (dateStr && dateStr.includes("2025")) {
        const sessions = parseInt(row[sessionsIndex]) || 0
        totalSessions += sessions
      }
    })

    return totalSessions
  }, [ga4Data])

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

  // Handler para clicar em uma campanha
  const handleCampaignClick = (campaignName: string) => {
    setSelectedCampaign(selectedCampaign === campaignName ? null : campaignName)
  }

  // Handler para clicar em uma agência
  const handleAgenciaClick = (agenciaNome: string) => {
    setSelectedAgencia(selectedAgencia === agenciaNome ? null : agenciaNome)
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

  const loading = consolidadoLoading || planoLoading || ga4Loading || portaisLoading
  const error = consolidadoError || planoError || ga4Error

  if (loading) {
    return <Loading message="Carregando dashboard executivo..." />
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-red-500">Erro ao carregar dados do dashboard</div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col space-y-4 overflow-auto">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-2xl shadow-2xl h-44">
        <div className="relative h-full bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600">
          <img
            src="/images/fundo_card.webp"
            alt="Dashboard Executivo - Banco da Amazônia"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/20"></div>
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <div className="bg-white/95 backdrop-blur-sm rounded-xl p-4 shadow-lg max-w-2xl">
              <h1 className="text-2xl font-bold text-gray-900 mb-1">Dashboard Executivo - Banco da Amazônia</h1>
              <p className="text-base text-gray-700">Visão consolidada de investimentos e resultados de mídia</p>
            </div>
          </div>
        </div>
      </div>

      {/* Cards de Métricas Principais - Grid 4 colunas */}
      <div className="grid grid-cols-4 gap-4">
        {/* Investimento Total */}
        <div className="card-overlay rounded-xl shadow-lg p-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Investimento Total</h3>
            <DollarSign className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatMetricValue(planoMetrics.investimentoTotal, "spent")}</p>
          <p className="text-xs text-gray-500 mt-1">Plano de Mídia 2025</p>
          {(selectedAgencia || selectedMeio || selectedVeiculo) && (
            <button
              onClick={() => {
                setSelectedAgencia(null)
                setSelectedMeio(null)
                setSelectedVeiculo("")
              }}
              className="text-xs text-blue-600 hover:text-blue-800 mt-2 underline"
            >
              Limpar filtros
            </button>
          )}
        </div>

        {/* Entrega Prevista */}
        <div className="card-overlay rounded-xl shadow-lg p-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Entrega Prevista</h3>
            <BarChart3 className="w-5 h-5 text-indigo-600" />
          </div>
          <p className="text-2xl font-bold text-indigo-600">{formatNumber(planoMetrics.entregaPrevista)}</p>
          <p className="text-xs text-gray-500 mt-1">Impressões/Cliques/Diárias</p>
        </div>

        {/* Resultados (Internet + Portais + Sessões) - Ocupa 2 colunas */}
        <div className="card-overlay rounded-xl shadow-lg p-5 col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-600">Resultados</h3>
            <Target className="w-5 h-5 text-purple-600" />
          </div>
          <div className="grid grid-cols-4 gap-4">
            {/* Coluna 1 - Impressões */}
            <div className="space-y-1">
              <div className="flex items-center space-x-1 mb-1">
                <Eye className="w-3 h-3 text-cyan-600" />
                <p className="text-xs text-gray-600">Impressões</p>
              </div>
              <p className="text-2xl font-bold text-cyan-600">{formatNumber(internetResults.impressoes)}</p>
              <p className="text-xs text-gray-400 mt-1">Internet + Portais</p>
            </div>

            {/* Coluna 2 - Visualizações */}
            <div className="space-y-1">
              <div className="flex items-center space-x-1 mb-1">
                <Video className="w-3 h-3 text-red-600" />
                <p className="text-xs text-gray-600">Visualizações</p>
              </div>
              <p className="text-2xl font-bold text-red-600">{formatNumber(internetResults.visualizacoes)}</p>
              <p className="text-xs text-gray-400 mt-1">Internet + Portais</p>
            </div>

            {/* Coluna 3 - Cliques */}
            <div className="space-y-1">
              <div className="flex items-center space-x-1 mb-1">
                <MousePointerClick className="w-3 h-3 text-blue-600" />
                <p className="text-xs text-gray-600">Cliques</p>
              </div>
              <p className="text-2xl font-bold text-blue-600">{formatNumber(internetResults.cliques)}</p>
              <p className="text-xs text-gray-400 mt-1">Internet + Portais</p>
            </div>

            {/* Coluna 4 - Sessões */}
            <div className="space-y-1">
              <div className="flex items-center space-x-1 mb-1">
                <Users className="w-3 h-3 text-green-600" />
                <p className="text-xs text-gray-600">Sessões 2025</p>
              </div>
              <p className="text-2xl font-bold text-green-600">{formatNumber(sessoes2025)}</p>
              <p className="text-xs text-gray-400 mt-1">Google Analytics 4</p>
            </div>
          </div>
        </div>
      </div>

      {/* Listas Interativas - Agências, Campanhas e Meios */}
      <div className="grid grid-cols-3 gap-4">
        {/* Agências */}
        <div className="card-overlay rounded-xl shadow-lg p-5 h-80 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-gray-900 flex items-center">
              <Building2 className="w-4 h-4 mr-2 text-blue-600" />
              Agências ({planoMetrics.agencias.length})
            </h2>
            {selectedAgencia && (
              <button
                onClick={() => setSelectedAgencia(null)}
                className="text-xs text-blue-600 hover:text-blue-800 underline"
              >
                Limpar
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto space-y-2">
            {planoMetrics.agencias.map((agencia, index) => (
              <div
                key={index}
                onClick={() => handleAgenciaClick(agencia.nome)}
                className={`p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                  selectedAgencia === agencia.nome
                    ? "bg-blue-50 border-2 border-blue-400 shadow-sm"
                    : "hover:bg-gray-50 border-2 border-transparent bg-gray-50"
                }`}
              >
                <p className="text-sm font-medium text-gray-900 truncate">{agencia.nome}</p>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-gray-600">{formatMetricValue(agencia.investimento, "spent")}</p>
                  <p className="text-xs text-gray-500">{agencia.numCampanhas} {agencia.numCampanhas === 1 ? 'campanha' : 'campanhas'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Campanhas do Plano */}
        <div className="card-overlay rounded-xl shadow-lg p-5 h-80 flex flex-col">
          <h2 className="text-base font-bold text-gray-900 mb-3 flex items-center">
            <Megaphone className="w-4 h-4 mr-2 text-purple-600" />
            Campanhas ({planoMetrics.campanhas.length})
          </h2>
          <div className="flex-1 overflow-y-auto space-y-2">
            {planoMetrics.campanhas.map((campanha, index) => (
              <div
                key={index}
                className="p-3 rounded-lg bg-gray-50"
              >
                <p className="text-sm font-medium text-gray-900 truncate">{campanha.nome}</p>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-gray-600">{formatMetricValue(campanha.investimento, "spent")}</p>
                  <p className="text-xs text-gray-500">{campanha.numMeios} {campanha.numMeios === 1 ? 'meio' : 'meios'} • {campanha.numVeiculos} {campanha.numVeiculos === 1 ? 'veículo' : 'veículos'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Meios com Accordion de Veículos */}
        <div className="card-overlay rounded-xl shadow-lg p-5 h-80 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-gray-900 flex items-center">
              <Radio className="w-4 h-4 mr-2 text-orange-600" />
              Meios ({planoMetrics.meios.length})
            </h2>
            {(selectedMeio || selectedVeiculo) && (
              <button
                onClick={() => {
                  setSelectedMeio(null)
                  setSelectedVeiculo("")
                  setExpandedMeio(null)
                }}
                className="text-xs text-blue-600 hover:text-blue-800 underline"
              >
                Limpar
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto space-y-2">
            {planoMetrics.meios.map((meio, index) => (
              <div key={index}>
                {/* Card do Meio */}
                <div
                  className={`p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                    selectedMeio === meio.nome
                      ? "bg-orange-50 border-2 border-orange-400 shadow-sm"
                      : expandedMeio === meio.nome
                      ? "bg-orange-50 border-2 border-orange-300"
                      : "hover:bg-gray-50 border-2 border-transparent bg-gray-50"
                  }`}
                >
                  <div
                    onClick={() => {
                      if (expandedMeio === meio.nome) {
                        setExpandedMeio(null)
                      } else {
                        setExpandedMeio(meio.nome)
                      }
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900 truncate">{meio.nome}</p>
                      <svg
                        className={`w-4 h-4 transition-transform ${expandedMeio === meio.nome ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-xs text-gray-600">{formatMetricValue(meio.investimento, "spent")}</p>
                      <p className="text-xs text-gray-500">{meio.numVeiculos} {meio.numVeiculos === 1 ? 'veículo' : 'veículos'}</p>
                    </div>
                    <div className="mt-1">
                      <p className="text-xs text-gray-400">Entrega: {formatNumber(meio.entrega)}</p>
                    </div>
                  </div>

                  {/* Lista de Veículos (Accordion) */}
                  {expandedMeio === meio.nome && veiculosPorMeioList.get(meio.nome) && (
                    <div className="mt-2 space-y-1 pl-2 border-l-2 border-orange-300">
                      {veiculosPorMeioList.get(meio.nome)!.map((veiculo, vIdx) => (
                        <div
                          key={vIdx}
                          onClick={(e) => {
                            e.stopPropagation()
                            if (selectedVeiculo === veiculo.nome) {
                              setSelectedVeiculo("")
                              setSelectedMeio(null)
                            } else {
                              setSelectedVeiculo(veiculo.nome)
                              setSelectedMeio(meio.nome)
                            }
                          }}
                          className={`p-2 rounded cursor-pointer transition-all duration-150 border-l-4 ${
                            selectedVeiculo === veiculo.nome
                              ? "bg-blue-100 border-blue-500 shadow-sm"
                              : "bg-white hover:bg-gray-50 border-gray-300"
                          }`}
                        >
                          <p className="text-xs font-medium text-gray-800 truncate">{veiculo.nome}</p>
                          <div className="flex items-center justify-between mt-1">
                            <p className="text-xs text-gray-500">{formatMetricValue(veiculo.investimento, "spent")}</p>
                            <p className="text-xs text-gray-400">{formatNumber(veiculo.entrega)}</p>
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
      </div>

      {/* Análise dos Últimos 7 Dias */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Card de Campanhas Ativas */}
        <div className="card-overlay rounded-xl shadow-lg p-5 h-80 flex flex-col">
          <h2 className="text-base font-bold text-gray-900 mb-3 flex items-center">
            <BarChart3 className="w-4 h-4 mr-2 text-blue-600" />
            Campanhas Ativas
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
              {campaigns.slice(0, 8).map((campaign, index) => (
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
        <div className="card-overlay rounded-xl shadow-lg p-5 h-80 flex flex-col">
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

export default Capa

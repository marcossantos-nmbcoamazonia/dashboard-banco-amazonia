"use client"

import type React from "react"
import { useState, useMemo, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import {
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
import { useGA4Data, useProducaoData } from "../../services/api"
import Loading from "../../components/Loading/Loading"
import axios from "axios"

interface PortaisData {
  impressoes: number
  cliques: number
  visualizacoes: number
}

interface PortaisRawData {
  campanha: string
  impressoes: number
  cliques: number
  visualizacoes: number
}

const Capa: React.FC = () => {
  const navigate = useNavigate()
  const { loading: consolidadoLoading, error: consolidadoError, data: consolidadoData } = useConsolidadoGeral()
  const { data: planoData, loading: planoLoading, error: planoError } = usePlanoMidia()
  const { data: ga4Data, loading: ga4Loading, error: ga4Error } = useGA4Data()
  const { data: producaoData, loading: producaoLoading, error: producaoError } = useProducaoData()

  const [selectedAgencia, setSelectedAgencia] = useState<string | null>(null)
  const [selectedMeio, setSelectedMeio] = useState<string | null>(null)
  const [expandedMeio, setExpandedMeio] = useState<string | null>(null)
  const [selectedVeiculo, setSelectedVeiculo] = useState<string>("")
  const [selectedAcao, setSelectedAcao] = useState<string | null>(null)
  const [portaisData, setPortaisData] = useState<PortaisData>({ impressoes: 0, cliques: 0, visualizacoes: 0 })
  const [portaisRawData, setPortaisRawData] = useState<PortaisRawData[]>([])
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

          const campanhaIndex = headers.indexOf("Campanha")
          const impressoesCPMIndex = headers.indexOf("Impressões")
          const cliquesCPMIndex = headers.indexOf("Cliques")
          const viewsIndex = headers.indexOf("Views")

          // Encontrar índice do segundo "Cliques" (CPV)
          let cliquesCPVIndex = -1
          headers.forEach((header: string, index: number) => {
            if (header === "Cliques" && index !== cliquesCPMIndex) {
              cliquesCPVIndex = index
            }
          })

          const parseNumber = (value: string): number => {
            if (!value || value === "0" || value === "") return 0
            const cleaned = value.toString().replace(/\./g, "").replace(",", ".")
            return parseFloat(cleaned) || 0
          }

          let impressoes = 0
          let cliques = 0
          let visualizacoes = 0
          const rawDataArray: PortaisRawData[] = []

          rows.forEach((row: any[]) => {
            const campanha = row[campanhaIndex] || ""
            const rowImpressoes = parseNumber(row[impressoesCPMIndex] || "0")
            const rowCliques = parseNumber(row[cliquesCPMIndex] || "0") + (cliquesCPVIndex >= 0 ? parseNumber(row[cliquesCPVIndex] || "0") : 0)
            const rowVisualizacoes = parseNumber(row[viewsIndex] || "0")

            impressoes += rowImpressoes
            cliques += rowCliques
            visualizacoes += rowVisualizacoes

            if (campanha) {
              rawDataArray.push({
                campanha,
                impressoes: rowImpressoes,
                cliques: rowCliques,
                visualizacoes: rowVisualizacoes
              })
            }
          })

          setPortaisData({ impressoes, cliques, visualizacoes })
          setPortaisRawData(rawDataArray)
        }
      } catch (error) {
        console.error("Erro ao buscar dados de Portais:", error)
      } finally {
        setPortaisLoading(false)
      }
    }

    fetchPortaisData()
  }, [])

  // Ajustes de valores para campanhas específicas
  const campanhaAjustes: Record<string, number> = {
    "CARTÃO VERDINHO": -491874.13,
    "MAQUININHA": -1003827.66,
  }

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
      if (selectedAcao && campanha !== selectedAcao) return
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

    // Aplicar ajustes nas campanhas e recalcular investimento total
    let investimentoAjustado = investimentoTotal
    const campanhasAjustadas = Array.from(campanhasMap.values()).map(c => {
      const ajuste = campanhaAjustes[c.nome] || 0
      const investimentoComAjuste = c.investimento + ajuste

      // Adicionar o ajuste ao investimento total (já que é negativo, vai subtrair)
      if (ajuste !== 0) {
        investimentoAjustado += ajuste
      }

      return {
        nome: c.nome,
        investimento: investimentoComAjuste,
        entrega: c.entrega,
        numMeios: c.meios.size,
        numVeiculos: c.veiculos.size
      }
    }).sort((a, b) => b.investimento - a.investimento)

    // Aplicar ajustes nas agências (subtrair da Calix)
    const totalAjustesCalix = Object.values(campanhaAjustes).reduce((sum, valor) => sum + valor, 0)
    const agenciasAjustadas = Array.from(agenciasMap.values()).map(a => {
      let investimentoAgencia = a.investimento

      // Se for a agência Calix, aplicar os ajustes
      if (a.nome.toUpperCase().includes('CALIX')) {
        investimentoAgencia += totalAjustesCalix
      }

      return {
        nome: a.nome,
        investimento: investimentoAgencia,
        entrega: a.entrega,
        numCampanhas: a.campanhas.size
      }
    }).sort((a, b) => b.investimento - a.investimento)

    return {
      investimentoTotal: investimentoAjustado,
      agencias: agenciasAjustadas,
      campanhas: campanhasAjustadas,
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
  }, [planoData, selectedAgencia, selectedAcao, selectedMeio, selectedVeiculo, campanhaAjustes])

  // Obter veículos por meio para o accordion
  const veiculosPorMeioList = useMemo(() => {
    if (!planoData?.success || !planoData?.data?.values || planoData.data.values.length < 2) {
      return new Map<string, Array<{ nome: string; investimento: number; entrega: number }>>()
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

    const veiculosMap = new Map<string, Map<string, { investimento: number; entrega: number }>>()

    rows.forEach((row) => {
      const agencia = row[agenciaIndex]
      const campanha = row[campanhaIndex]
      const meio = row[meioIndex]
      const veiculo = row[veiculoIndex]
      const impressoes = parseBrazilianNumber(row[impressoesIndex] || "0")
      const valorDesembolso = parseBrazilianCurrency(row[valorDesembolsoIndex] || "0")

      // Aplicar os mesmos filtros do planoMetrics
      if (selectedAgencia && agencia !== selectedAgencia) return
      if (selectedAcao && campanha !== selectedAcao) return
      if (selectedVeiculo && veiculo !== selectedVeiculo) return

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
  }, [planoData, selectedAgencia, selectedAcao, selectedVeiculo])

  // Processar resultados de Internet (Consolidado) + Portais (com filtro de campanha)
  const internetResults = useMemo(() => {
    // Processar dados de Consolidado (Redes Sociais)
    let impressoesConsolidado = 0
    let cliquesConsolidado = 0
    let visualizacoesConsolidado = 0

    if (consolidadoData?.success && consolidadoData?.data?.values && consolidadoData.data.values.length >= 2) {
      const headers = consolidadoData.data.values[0]
      const rows = consolidadoData.data.values.slice(1)

      const campanhaIndex = headers.indexOf("Campanha")
      const impressionsIndex = headers.indexOf("Impressions")
      const clicksIndex = headers.indexOf("Clicks")
      const videoViewsIndex = headers.indexOf("Video views")

      const parseBrazilianNumber = (value: string): number => {
        if (!value || value === "0") return 0
        return parseFloat(value.replace(/\./g, '').replace(',', '.'))
      }

      rows.forEach((row) => {
        const campanha = row[campanhaIndex] || ""

        // Se houver filtro de campanha selecionada, aplicar
        if (selectedAcao && campanha !== selectedAcao) return

        impressoesConsolidado += parseBrazilianNumber(row[impressionsIndex] || "0")
        cliquesConsolidado += parseBrazilianNumber(row[clicksIndex] || "0")
        visualizacoesConsolidado += parseBrazilianNumber(row[videoViewsIndex] || "0")
      })
    }

    // Processar dados de Portais
    let impressoesPortais = 0
    let cliquesPortais = 0
    let visualizacoesPortais = 0

    if (selectedAcao) {
      // Se houver filtro, buscar apenas dados da campanha selecionada
      portaisRawData.forEach((item) => {
        if (item.campanha === selectedAcao) {
          impressoesPortais += item.impressoes
          cliquesPortais += item.cliques
          visualizacoesPortais += item.visualizacoes
        }
      })
    } else {
      // Sem filtro, usar totais
      impressoesPortais = portaisData.impressoes
      cliquesPortais = portaisData.cliques
      visualizacoesPortais = portaisData.visualizacoes
    }

    // Retornar soma de Consolidado + Portais
    return {
      impressoes: impressoesConsolidado + impressoesPortais,
      cliques: cliquesConsolidado + cliquesPortais,
      visualizacoes: visualizacoesConsolidado + visualizacoesPortais,
    }
  }, [consolidadoData, portaisData, portaisRawData, selectedAcao])

  // Processar dados de Produção (com filtro de campanha)
  const producaoMetrics = useMemo(() => {
    if (!producaoData?.data?.values || producaoData.data.values.length <= 1) {
      return {
        valorTotal: 0,
        totalAcoes: 0
      }
    }

    const headers = producaoData.data.values[0]
    const rows = producaoData.data.values.slice(1)

    const acaoIndex = headers.indexOf("AÇÃO")
    const campanhaIndex = headers.indexOf("Campanha")
    const valorIndex = headers.indexOf("VALOR")

    const parseCurrency = (valor: string): number => {
      if (!valor || valor === "-" || valor === "") return 0
      const cleanValue = valor
        .replace(/R\$\s?/g, "")
        .replace(/\./g, "")
        .replace(/,/g, ".")
        .trim()
      const parsed = parseFloat(cleanValue)
      return isNaN(parsed) ? 0 : parsed
    }

    let valorTotal = 0
    let totalAcoes = 0

    rows.forEach((row: string[]) => {
      const acao = row[acaoIndex] || ""
      const campanha = row[campanhaIndex] || ""
      const valorStr = row[valorIndex] || "0"

      if (!acao) return

      // Se houver filtro de campanha, aplicar (usar coluna Campanha)
      if (selectedAcao && campanha !== selectedAcao) return

      const valorNum = parseCurrency(valorStr)
      valorTotal += valorNum
      totalAcoes++
    })

    return {
      valorTotal,
      totalAcoes
    }
  }, [producaoData, selectedAcao])

  // Processar sessões totais do GA4 (sem filtro de data)
  const sessoes2025 = useMemo(() => {
    if (!ga4Data?.data?.values || ga4Data.data.values.length < 2) {
      return 0
    }

    const headers = ga4Data.data.values[0]
    const rows = ga4Data.data.values.slice(1)

    const sessionsIndex = headers.indexOf("Sessions")

    let totalSessions = 0

    rows.forEach((row) => {
      const sessions = parseInt(row[sessionsIndex]) || 0
      totalSessions += sessions
    })

    return totalSessions
  }, [ga4Data])


  // Handler para clicar em uma agência
  const handleAgenciaClick = (agenciaNome: string) => {
    setSelectedAgencia(selectedAgencia === agenciaNome ? null : agenciaNome)
  }

  // Handler para clicar em uma ação
  const handleAcaoClick = (acaoNome: string) => {
    setSelectedAcao(selectedAcao === acaoNome ? null : acaoNome)
  }

  // Separar campanhas em Projetos e Ações
  const { projetos, acoes } = useMemo(() => {
    const projetos = planoMetrics.campanhas.filter(c => c.nome.toUpperCase().includes('PROJETO'))
    const acoes = planoMetrics.campanhas.filter(c => !c.nome.toUpperCase().includes('PROJETO'))
    return { projetos, acoes }
  }, [planoMetrics.campanhas])

  // Formatar valor baseado na métrica
  const formatMetricValue = (value: number, metric?: string): string => {
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

  const loading = consolidadoLoading || planoLoading || ga4Loading || portaisLoading || producaoLoading
  const error = consolidadoError || planoError || ga4Error || producaoError

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

          {/* Investimento de Mídia */}
          <div className="mb-2">
            <p className="text-xs text-gray-500">Mídia</p>
            <p className="text-lg font-bold text-gray-900">{formatMetricValue(planoMetrics.investimentoTotal, "spent")}</p>
          </div>

          {/* Investimento de Produção */}
          <div
            className="border-t border-gray-200 pt-2 mb-2 cursor-pointer hover:bg-purple-50 p-2 -m-2 rounded transition-colors"
            onClick={() => navigate('/producao')}
            title="Clique para ver detalhes de produção"
          >
            <p className="text-xs text-gray-500">Produção</p>
            <p className="text-lg font-bold text-purple-700">{formatMetricValue(producaoMetrics.valorTotal, "spent")}</p>
            {selectedAcao && producaoMetrics.totalAcoes > 0 && (
              <p className="text-xs text-purple-600">{producaoMetrics.totalAcoes} {producaoMetrics.totalAcoes === 1 ? 'ação' : 'ações'}</p>
            )}
            <p className="text-xs text-purple-500 mt-1 underline">Ver detalhes →</p>
          </div>

          {/* Total Geral */}
          <div className="border-t border-gray-200 pt-2">
            <p className="text-xs text-gray-500">Total Geral</p>
            <p className="text-2xl font-bold text-green-600">
              {formatMetricValue(planoMetrics.investimentoTotal + producaoMetrics.valorTotal, "spent")}
            </p>
          </div>

          {(selectedAgencia || selectedAcao || selectedMeio || selectedVeiculo) && (
            <button
              onClick={() => {
                setSelectedAgencia(null)
                setSelectedAcao(null)
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
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-medium text-gray-600">Resultados</h3>
              {selectedAcao && (
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                  Filtrado: {selectedAcao}
                </span>
              )}
            </div>
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
                <p className="text-xs text-gray-600">Sessões</p>
              </div>
              <p className="text-2xl font-bold text-green-600">{formatNumber(sessoes2025)}</p>
              <p className="text-xs text-gray-400 mt-1">
                Google Analytics 4
                {selectedAcao && " (sem filtro)"}
              </p>
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

        {/* Ações do Plano (Projetos e Ações) */}
        <div className="card-overlay rounded-xl shadow-lg p-5 h-80 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-gray-900 flex items-center">
              <Megaphone className="w-4 h-4 mr-2 text-purple-600" />
              Ações ({planoMetrics.campanhas.length})
            </h2>
            {selectedAcao && (
              <button
                onClick={() => setSelectedAcao(null)}
                className="text-xs text-blue-600 hover:text-blue-800 underline"
              >
                Limpar
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto space-y-3">
            {/* Ações */}
            {acoes.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2 px-1">Ações</h3>
                <div className="space-y-2">
                  {acoes.map((acao, index) => (
                    <div
                      key={index}
                      onClick={() => handleAcaoClick(acao.nome)}
                      className={`p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                        selectedAcao === acao.nome
                          ? "bg-purple-50 border-2 border-purple-400 shadow-sm"
                          : "hover:bg-gray-50 border-2 border-transparent bg-gray-50"
                      }`}
                    >
                      <p className="text-sm font-medium text-gray-900 truncate">{acao.nome}</p>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-xs text-gray-600">{formatMetricValue(acao.investimento, "spent")}</p>
                        <p className="text-xs text-gray-500">{acao.numMeios} {acao.numMeios === 1 ? 'meio' : 'meios'} • {acao.numVeiculos} {acao.numVeiculos === 1 ? 'veículo' : 'veículos'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}


            {/* Projetos */}
            {projetos.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2 px-1">Projetos</h3>
                <div className="space-y-2">
                  {projetos.map((projeto, index) => (
                    <div
                      key={index}
                      onClick={() => handleAcaoClick(projeto.nome)}
                      className={`p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                        selectedAcao === projeto.nome
                          ? "bg-purple-50 border-2 border-purple-400 shadow-sm"
                          : "hover:bg-gray-50 border-2 border-transparent bg-gray-50"
                      }`}
                    >
                      <p className="text-sm font-medium text-gray-900 truncate">{projeto.nome}</p>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-xs text-gray-600">{formatMetricValue(projeto.investimento, "spent")}</p>
                        <p className="text-xs text-gray-500">{projeto.numMeios} {projeto.numMeios === 1 ? 'meio' : 'meios'} • {projeto.numVeiculos} {projeto.numVeiculos === 1 ? 'veículo' : 'veículos'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            
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

    </div>
  )
}

export default Capa
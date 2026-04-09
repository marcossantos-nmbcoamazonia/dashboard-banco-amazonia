"use client"

import type React from "react"
import { useState, useMemo, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import {
  DollarSign,
  Building2,
  PieChart,
} from "lucide-react"
import { usePlanoMidia } from "../../services/consolidadoApi"
import { useProducaoData } from "../../services/api"
import Loading from "../../components/Loading/Loading"
import axios from "axios"

interface AcaoData {
  acao: string
  situacao: string
  valor: number
  siref?: string
  agencia: string
  verba: string
  meios?: string
  midiaweb?: string
  pis?: string
}

const APIS = {
  2025: {
    midia: "https://nmbcoamazonia-api.vercel.app/google/sheets/1jh9U8S9gCB4LQsZJ8-Do_e6Qn2YsAECm_dyhWuVEgOc/data?range=AÇÕES%20MÍDIA",
    producao: "https://nmbcoamazonia-api.vercel.app/google/sheets/1jh9U8S9gCB4LQsZJ8-Do_e6Qn2YsAECm_dyhWuVEgOc/data?range=AÇÕES%20PRODUÇÃO",
    custos: "https://nmbcoamazonia-api.vercel.app/google/sheets/1jh9U8S9gCB4LQsZJ8-Do_e6Qn2YsAECm_dyhWuVEgOc/data?range=CUSTOS%20INTERNOS",
  },
  2026: {
    midia: "https://nmbcoamazonia-api.vercel.app/google/sheets/1-aLCEJBF9_nn8Xl_tq_dC6X6u1ZG__7eSkyUXGgfd2o/data?range=A%C3%87%C3%95ES%20M%C3%8DDIA",
    producao: "https://nmbcoamazonia-api.vercel.app/google/sheets/1-aLCEJBF9_nn8Xl_tq_dC6X6u1ZG__7eSkyUXGgfd2o/data?range=A%C3%87%C3%95ES%20PRODU%C3%87%C3%83O",
    custos: "https://nmbcoamazonia-api.vercel.app/google/sheets/1-aLCEJBF9_nn8Xl_tq_dC6X6u1ZG__7eSkyUXGgfd2o/data?range=A%C3%87%C3%95ES%20EM%20PLANEJAMENTO",
  },
} as const

const Capa: React.FC = () => {
  const navigate = useNavigate()
  const { loading: planoLoading, error: planoError } = usePlanoMidia()
  const { loading: producaoLoading, error: producaoError } = useProducaoData()

  const [selectedAno, setSelectedAno] = useState<2025 | 2026>(2025)
  const [selectedTipoVerba, setSelectedTipoVerba] = useState<string | null>(null)
  const [selectedAgencia, setSelectedAgencia] = useState<string | null>(null)

  const [acoesMidiaData, setAcoesMidiaData] = useState<AcaoData[]>([])
  const [acoesProducaoData, setAcoesProducaoData] = useState<AcaoData[]>([])
  const [custosInternosData, setCustosInternosData] = useState<AcaoData[]>([])
  const [acoesLoading, setAcoesLoading] = useState(true)

  // Buscar dados das 3 APIs
  useEffect(() => {
    const parseCurrency = (value: string): number => {
      if (!value || value === "" || value === "-" || value.includes("#REF")) return 0
      const cleaned = value
        .replace(/R\$/g, "")
        .replace(/\s/g, "")
        .replace(/\./g, "")
        .replace(/,/g, ".")
        .trim()
      return parseFloat(cleaned) || 0
    }

    // Normaliza "ESCALA" → "Escala", "CÁLIX" → "Cálix"
    const normalizeAgencia = (value: string): string => {
      const v = value.trim()
      if (v.toUpperCase() === "ESCALA") return "Escala"
      if (v.toUpperCase() === "CÁLIX" || v.toUpperCase() === "CALIX") return "Cálix"
      return v
    }

    // Normaliza "MERCADOLÓGICA" → "Mercadológica", "INSTITUCIONAL" → "Institucional"
    const normalizeVerba = (value: string): string => {
      const v = value.trim().toLowerCase()
      if (v.includes("mercadol")) return "Mercadológica"
      if (v.includes("institucional")) return "Institucional"
      return value.trim()
    }

    const fetchAllData = async () => {
      try {
        setAcoesLoading(true)

        const urls = APIS[selectedAno]
        const [midiaResponse, producaoResponse, custosResponse] = await Promise.all([
          axios.get(urls.midia),
          axios.get(urls.producao),
          axios.get(urls.custos),
        ])

        // Processar Ações de Mídia
        if (midiaResponse.data.success && midiaResponse.data.data.values) {
          const headers = midiaResponse.data.data.values[2]
          const rows = midiaResponse.data.data.values.slice(3)
          const acaoIndex = headers.indexOf("AÇÃO")
          const meiosIndex = headers.indexOf("MEIOS")
          const situacaoIndex = headers.indexOf("SITUAÇÃO")
          const valorIndex = headers.findIndex((h: string) => h.trim().startsWith("VALOR"))
          const midiawebIndex = headers.indexOf("MIDIAWEB")
          const agenciaIndex = headers.indexOf("AGÊNCIA")
          const verbaIndex = headers.indexOf("VERBA")
          const pisIndex = headers.indexOf("PIS")
          const midiaArray: AcaoData[] = []
          rows.forEach((row: any[]) => {
            const acao = row[acaoIndex] || ""
            if (!acao || acao.trim() === "") return
            midiaArray.push({
              acao,
              meios: row[meiosIndex] || "",
              situacao: row[situacaoIndex] || "",
              valor: parseCurrency(row[valorIndex] || "0"),
              midiaweb: row[midiawebIndex] || "",
              agencia: normalizeAgencia(row[agenciaIndex] || ""),
              verba: normalizeVerba(row[verbaIndex] || ""),
              pis: row[pisIndex] || ""
            })
          })
          setAcoesMidiaData(midiaArray)
        }

        // Processar Ações de Produção
        if (producaoResponse.data.success && producaoResponse.data.data.values) {
          const headers = producaoResponse.data.data.values[2]
          const rows = producaoResponse.data.data.values.slice(3)
          const acaoIndex = headers.indexOf("AÇÃO")
          const situacaoIndex = headers.indexOf("SITUAÇÃO")
          const valorIndex = headers.findIndex((h: string) => h.trim().startsWith("VALOR"))
          const sirefIndex = headers.indexOf("SIREF")
          const agenciaIndex = headers.indexOf("AGÊNCIA")
          const verbaIndex = headers.indexOf("VERBA")
          const producaoArray: AcaoData[] = []
          rows.forEach((row: any[]) => {
            const acao = row[acaoIndex] || ""
            if (!acao || acao.trim() === "") return
            producaoArray.push({
              acao,
              situacao: row[situacaoIndex] || "",
              valor: parseCurrency(row[valorIndex] || "0"),
              siref: row[sirefIndex] || "",
              agencia: normalizeAgencia(row[agenciaIndex] || ""),
              verba: normalizeVerba(row[verbaIndex] || "")
            })
          })
          setAcoesProducaoData(producaoArray)
        }

        // Processar Custos Internos / Ações em Planejamento
        if (custosResponse.data.success && custosResponse.data.data.values) {
          const headers = custosResponse.data.data.values[2]
          const rows = custosResponse.data.data.values.slice(3)
          const acaoIndex = headers.indexOf("AÇÃO")
          const situacaoIndex = headers.indexOf("SITUAÇÃO")
          const valorIndex = headers.findIndex((h: string) => h.trim().startsWith("VALOR"))
          const sirefIndex = headers.indexOf("SIREF")
          const midiawebIndex = headers.indexOf("MIDIAWEB")
          const agenciaIndex = headers.indexOf("AGÊNCIA")
          const verbaIndex = headers.indexOf("VERBA")
          const custosArray: AcaoData[] = []
          rows.forEach((row: any[]) => {
            const acao = row[acaoIndex] || ""
            if (!acao || acao.trim() === "") return
            custosArray.push({
              acao,
              situacao: row[situacaoIndex] || "",
              valor: parseCurrency(row[valorIndex] || "0"),
              siref: row[sirefIndex] || row[midiawebIndex] || "",
              agencia: normalizeAgencia(row[agenciaIndex] || ""),
              verba: normalizeVerba(row[verbaIndex] || "")
            })
          })
          setCustosInternosData(custosArray)
        }
      } catch (error) {
        console.error("Erro ao buscar dados das ações:", error)
      } finally {
        setAcoesLoading(false)
      }
    }

    fetchAllData()
    setSelectedAgencia(null)
  }, [selectedAno])



  // Calcular totais por agência
  const agenciaMetrics = useMemo(() => {
    const agenciasMap = new Map<string, {
      midia: number
      producao: number
      custos: number
      total: number
    }>()

    // Processar Mídia
    acoesMidiaData.forEach(item => {
      const agencia = item.agencia
      if (!agencia || agencia.trim() === "") return

      if (!agenciasMap.has(agencia)) {
        agenciasMap.set(agencia, { midia: 0, producao: 0, custos: 0, total: 0 })
      }

      const situacaoLower = item.situacao.toLowerCase()
      if (situacaoLower.includes("aprovada") || situacaoLower.includes("aprovado")) {
        agenciasMap.get(agencia)!.midia += item.valor
      }
    })

    // Processar Produção (Todos os status)
    acoesProducaoData.forEach(item => {
      const agencia = item.agencia
      if (!agencia || agencia.trim() === "") return

      if (!agenciasMap.has(agencia)) {
        agenciasMap.set(agencia, { midia: 0, producao: 0, custos: 0, total: 0 })
      }

      agenciasMap.get(agencia)!.producao += item.valor
    })

    // Processar Custos Internos
    custosInternosData.forEach(item => {
      const agencia = item.agencia
      if (!agencia || agencia.trim() === "") return

      if (!agenciasMap.has(agencia)) {
        agenciasMap.set(agencia, { midia: 0, producao: 0, custos: 0, total: 0 })
      }

      agenciasMap.get(agencia)!.custos += item.valor
    })

    // Calcular totais
    agenciasMap.forEach((values) => {
      values.total = values.midia + values.producao + values.custos
    })

    return Array.from(agenciasMap.entries())
      .map(([nome, values]) => ({ nome, ...values }))
      .sort((a, b) => b.total - a.total)
  }, [acoesMidiaData, acoesProducaoData, custosInternosData])

  // Calcular resumo de investimento usando os dados das APIs
  const resumoInvestimento = useMemo(() => {
    const LIMITE_INSTITUCIONAL = 20000000 // R$ 20M
    const LIMITE_MERCADOLOGICA = 30000000 // R$ 30M

    // Primeiro, calcular valores TOTAIS (sem filtro) para os saldos
    let midiaInstitucionalTotal = 0
    let midiaMercadologicaTotal = 0
    let producaoInstitucionalTotal = 0
    let producaoMercadologicaTotal = 0
    let custosInstitucionalTotal = 0
    let custosMercadologicaTotal = 0

    // Calcular totais de mídia sem filtro
    acoesMidiaData.forEach(item => {
      const verbaLower = item.verba.toLowerCase()
      const situacaoLower = item.situacao.toLowerCase()

      if (situacaoLower.includes("aprovada") || situacaoLower.includes("aprovado")) {
        if (verbaLower.includes("institucional")) {
          midiaInstitucionalTotal += item.valor
        } else if (verbaLower.includes("mercadológica") || verbaLower.includes("mercadologica")) {
          midiaMercadologicaTotal += item.valor
        }
      }
    })

    // Calcular totais de produção sem filtro
    acoesProducaoData.forEach(item => {
      const verbaLower = item.verba.toLowerCase()

      if (verbaLower.includes("institucional")) {
        producaoInstitucionalTotal += item.valor
      } else if (verbaLower.includes("mercadológica") || verbaLower.includes("mercadologica")) {
        producaoMercadologicaTotal += item.valor
      }
    })

    // Calcular totais de custos internos sem filtro
    custosInternosData.forEach(item => {
      const verbaLower = item.verba.toLowerCase()
      if (verbaLower.includes("institucional")) {
        custosInstitucionalTotal += item.valor
      } else if (verbaLower.includes("mercadológica") || verbaLower.includes("mercadologica")) {
        custosMercadologicaTotal += item.valor
      }
    })

    // Calcular saldos baseados nos totais SEM filtro
    const totalInstitucionalGeral = midiaInstitucionalTotal + producaoInstitucionalTotal + custosInstitucionalTotal
    const totalMercadologicaGeral = midiaMercadologicaTotal + producaoMercadologicaTotal + custosMercadologicaTotal
    const saldoInstitucional = LIMITE_INSTITUCIONAL - totalInstitucionalGeral
    const saldoMercadologica = LIMITE_MERCADOLOGICA - totalMercadologicaGeral

    // Agora calcular valores COM filtro de agência (para exibição)
    let midiaInstitucional = 0
    let midiaMercadologica = 0

    acoesMidiaData.forEach(item => {
      // Aplicar filtro de agência se houver
      if (selectedAgencia && item.agencia !== selectedAgencia) return

      const verbaLower = item.verba.toLowerCase()
      const situacaoLower = item.situacao.toLowerCase()

      if (situacaoLower.includes("aprovada") || situacaoLower.includes("aprovado")) {
        if (verbaLower.includes("institucional")) {
          midiaInstitucional += item.valor
        } else if (verbaLower.includes("mercadológica") || verbaLower.includes("mercadologica")) {
          midiaMercadologica += item.valor
        }
      }
    })

    // Processar Ações de Produção (Todos os status)
    let producaoInstitucional = 0
    let producaoMercadologica = 0

    acoesProducaoData.forEach(item => {
      // Aplicar filtro de agência se houver
      if (selectedAgencia && item.agencia !== selectedAgencia) return

      const verbaLower = item.verba.toLowerCase()

      if (verbaLower.includes("institucional")) {
        producaoInstitucional += item.valor
      } else if (verbaLower.includes("mercadológica") || verbaLower.includes("mercadologica")) {
        producaoMercadologica += item.valor
      }
    })

    // Processar Custos Internos (Em inclusão na SECOM)
    let custosInstitucional = 0
    let custosMercadologica = 0

    custosInternosData.forEach(item => {
      // Aplicar filtro de agência se houver
      if (selectedAgencia && item.agencia !== selectedAgencia) return

      const verbaLower = item.verba.toLowerCase()
      if (verbaLower.includes("institucional")) {
        custosInstitucional += item.valor
      } else if (verbaLower.includes("mercadológica") || verbaLower.includes("mercadologica")) {
        custosMercadologica += item.valor
      }
    })

    // APROVADO = Mídia + Produção (com filtro)
    const aprovadoInstitucional = midiaInstitucional + producaoInstitucional
    const aprovadoMercadologica = midiaMercadologica + producaoMercadologica

    // SECOM (análise) = 0 por enquanto
    const secomInstitucional = 0
    const secomMercadologica = 0

    // EM INCLUSÃO NA SECOM = Custos Internos (com filtro)
    const emInclusaoInstitucional = custosInstitucional
    const emInclusaoMercadologica = custosMercadologica

    // TOTAL = Aprovado + SECOM + Em Inclusão (com filtro)
    const totalInstitucional = aprovadoInstitucional + secomInstitucional + emInclusaoInstitucional
    const totalMercadologica = aprovadoMercadologica + secomMercadologica + emInclusaoMercadologica

    return {
      midia: {
        institucional: midiaInstitucional,
        mercadologica: midiaMercadologica,
        total: midiaInstitucional + midiaMercadologica
      },
      producao: {
        institucional: producaoInstitucional,
        mercadologica: producaoMercadologica,
        total: producaoInstitucional + producaoMercadologica
      },
      aprovado: {
        institucional: aprovadoInstitucional,
        mercadologica: aprovadoMercadologica,
        total: aprovadoInstitucional + aprovadoMercadologica
      },
      secom: {
        institucional: secomInstitucional,
        mercadologica: secomMercadologica,
        total: secomInstitucional + secomMercadologica
      },
      emInclusao: {
        institucional: emInclusaoInstitucional,
        mercadologica: emInclusaoMercadologica,
        total: emInclusaoInstitucional + emInclusaoMercadologica
      },
      totalGeral: {
        institucional: totalInstitucional,
        mercadologica: totalMercadologica,
        total: totalInstitucional + totalMercadologica
      },
      saldo: {
        institucional: saldoInstitucional,
        mercadologica: saldoMercadologica,
        total: saldoInstitucional + saldoMercadologica
      }
    }
  }, [acoesMidiaData, acoesProducaoData, custosInternosData, selectedAgencia])

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

  // Sistema de cores por agência
  const getColorScheme = () => {
    if (selectedAgencia === "Escala") {
      return {
        primary: "#4a9ece", // Azul médio (Escala) - mais escuro mas ainda vibrante
        primaryDark: "#3b7fb8",
        primaryLight: "#6bb5e0",
        secondary: "#2d6fa3", // Complementar azul mais escuro
        midia: "#5dade2",
        producao: "#3a7bc8",
        criacao: "#6bb5e0",
        totalGeral: "#2d6fa3",
        institutional: "#4a9ece",
        mercadologico: "#3b7fb8",
        barColor: "from-[#4a9ece] to-[#3b7fb8]"
      }
    } else if (selectedAgencia === "Cálix") {
      return {
        primary: "#800080", // Roxo (Cálix)
        primaryDark: "#6a0080",
        primaryLight: "#a347a3",
        secondary: "#b366b3", // Complementar roxo mais claro
        midia: "#9932cc",
        producao: "#8b008b",
        criacao: "#a347a3",
        totalGeral: "#4b0082",
        institutional: "#9932cc",
        mercadologico: "#b366b3",
        barColor: "from-[#800080] to-[#9932cc]"
      }
    } else {
      // Cores sobrias quando nenhuma agência está selecionada
      return {
        primary: "#64748b", // Cinza azulado
        primaryDark: "#475569",
        primaryLight: "#94a3b8",
        secondary: "#334155",
        midia: "#3b82f6", // Azul sóbrio
        producao: "#8b5cf6", // Roxo sóbrio
        criacao: "#6b7280", // Cinza
        totalGeral: "#059669", // Verde para destaque
        institutional: "#3b82f6",
        mercadologico: "#10b981",
        barColor: "from-blue-500 to-blue-600"
      }
    }
  }

  const colors = getColorScheme()

  const loading = planoLoading || producaoLoading || acoesLoading
  const error = planoError || producaoError

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
    <div className="h-full flex flex-col space-y-2 overflow-auto">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-2xl shadow-2xl h-44">
        <div className="relative h-full bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600">
          <img
            src="/images/fundo_card.webp"
            alt="Dashboard Executivo - Banco da Amazônia"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/20"></div>
          <div className="absolute bottom-0 left-0 right-0 p-4 flex items-end justify-between">
            <div className="bg-white/95 backdrop-blur-sm rounded-xl p-4 shadow-lg max-w-2xl">
              <h1 className="text-2xl font-bold text-gray-900 mb-1">Dashboard Executivo - Banco da Amazônia</h1>
              <p className="text-base text-gray-700">Visão consolidada de investimentos e resultados</p>
            </div>
            <div className="bg-black/40 backdrop-blur-sm rounded-lg p-0.5 flex gap-0.5">
              {([2025, 2026] as const).map((ano) => (
                <button
                  key={ano}
                  onClick={() => setSelectedAno(ano)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                    selectedAno === ano
                      ? "bg-yellow-500 text-white"
                      : "text-white/70 hover:text-white"
                  }`}
                >
                  {ano}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Linha 1: Investimento Total, Agências e Resumo de Investimento */}
      <div className="grid gap-3" style={{ gridTemplateColumns: '20% 25% 1fr' }}>
        {/* Investimento Total */}
        <div className="card-overlay rounded-xl shadow-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-gray-900">Investimento Total</h3>
            <DollarSign className="w-5 h-5 text-green-600" />
          </div>

          <div className="space-y-3">
            {/* Investimento de Mídia */}
            <div
              className="cursor-pointer hover:opacity-80 p-2 -m-2 rounded transition-colors"
              onClick={() => navigate('/midia')}
              title="Clique para ver detalhes de mídia"
            >
              <p className="text-xs text-gray-500">Mídia</p>
              <p className="text-lg font-bold" style={{ color: colors.midia }}>
                {formatMetricValue(resumoInvestimento.midia.total, "spent")}
              </p>
              <p className="text-xs mt-1 underline" style={{ color: colors.midia }}>Ver detalhes →</p>
            </div>

            {/* Investimento de Produção */}
            <div
              className="cursor-pointer hover:opacity-80 p-2 -m-2 rounded transition-colors"
              onClick={() => navigate('/producao')}
              title="Clique para ver detalhes de produção"
            >
              <p className="text-xs text-gray-500">Produção</p>
              <p className="text-lg font-bold" style={{ color: colors.producao }}>
                {formatMetricValue(resumoInvestimento.producao.total, "spent")}
              </p>
              <p className="text-xs mt-1 underline" style={{ color: colors.producao }}>Ver detalhes →</p>
            </div>

            {/* Investimento de Criação / Ações em Planejamento */}
            <div>
              <p className="text-xs text-gray-500">{selectedAno === 2026 ? "Ações em Planejamento" : "Criação"}</p>
              <p className="text-lg font-bold" style={{ color: colors.criacao }}>
                {formatMetricValue(resumoInvestimento.emInclusao.total, "spent")}
              </p>
            </div>

            {/* Total Geral */}
            <div className="pt-3 border-t border-gray-200">
              <p className="text-xs text-gray-500">Total Geral</p>
              <p className="text-xl font-bold" style={{ color: colors.totalGeral }}>
                {formatMetricValue(resumoInvestimento.totalGeral.total, "spent")}
              </p>
            </div>
          </div>
        </div>

        {/* Agências - Card Visual */}
        <div className="card-overlay rounded-xl shadow-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-gray-900 flex items-center">
              <Building2 className="w-5 h-5 mr-2 text-blue-600" />
              Agências
            </h3>
            {selectedAgencia && (
              <button
                onClick={() => setSelectedAgencia(null)}
                className="text-xs text-blue-600 hover:text-blue-800 underline"
              >
                Limpar filtro
              </button>
            )}
          </div>

          <div className="space-y-3">
            {agenciaMetrics.map((agencia, index) => {
              const totalGeral = agenciaMetrics.reduce((sum, a) => sum + a.total, 0)
              const percentage = (agencia.total / totalGeral) * 100
              const isSelected = selectedAgencia === agencia.nome

              // Definir cores específicas para cada agência
              const agenciaColor = agencia.nome === "Escala" ? "#4a9ece" :
                                   agencia.nome === "Cálix" ? "#800080" : "#64748b"
              const agenciaColorDark = agencia.nome === "Escala" ? "#3b7fb8" :
                                       agencia.nome === "Cálix" ? "#6a0080" : "#475569"

              return (
                <div
                  key={index}
                  className={`space-y-1 cursor-pointer hover:opacity-90 p-2 -m-2 rounded transition-all ${
                    isSelected ? 'ring-2' : ''
                  }`}
                  style={{
                    backgroundColor: isSelected ? `${agenciaColor}15` : 'transparent',
                    borderColor: isSelected ? agenciaColor : 'transparent'
                  }}
                  onClick={() => setSelectedAgencia(isSelected ? null : agencia.nome)}
                  title={`Clique para ${isSelected ? 'remover' : 'aplicar'} filtro por ${agencia.nome}`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-900">{agencia.nome}</p>
                    <p className="text-sm font-bold" style={{ color: agenciaColor }}>
                      {formatMetricValue(agencia.total, "spent")}
                    </p>
                  </div>

                  {/* Barra de Progresso Visual */}
                  <div className="relative h-8 bg-gray-100 rounded-lg overflow-hidden shadow-sm">
                    <div
                      className="h-full flex items-center justify-end pr-2 transition-all duration-500"
                      style={{
                        width: `${percentage}%`,
                        background: `linear-gradient(to right, ${agenciaColor}, ${agenciaColorDark})`
                      }}
                    >
                      <span className="text-xs font-semibold text-white">
                        {percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Resumo de Investimento por Tipo de Verba */}
        <div className="card-overlay rounded-xl shadow-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-gray-900 flex items-center">
              <PieChart className="w-5 h-5 mr-2 text-purple-600" />
              Resumo de Investimento por Tipo de Verba
              {selectedAgencia && (
                <span
                  className="ml-2 text-xs font-normal px-2 py-1 rounded"
                  style={{
                    color: colors.primary,
                    backgroundColor: `${colors.primary}20`
                  }}
                >
                  Filtrado: {selectedAgencia}
                </span>
              )}
            </h3>
            {selectedTipoVerba && (
              <button
                onClick={() => setSelectedTipoVerba(null)}
                className="text-xs text-blue-600 hover:text-blue-800 underline"
              >
                Limpar filtro
              </button>
            )}
          </div>

          {/* Gráfico de Barras 100% Empilhadas */}
          <div className="space-y-4">
            {/* Mídia */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-700">Mídia</span>
                <span className="text-sm font-bold" style={{ color: colors.midia }}>
                  {formatMetricValue(resumoInvestimento.midia.total, "spent")}
                </span>
              </div>
              <div className="relative h-12 bg-gray-100 rounded-lg overflow-hidden shadow-sm">
                <div
                  className="absolute left-0 top-0 h-full flex items-center justify-center text-white text-xs font-semibold transition-all duration-500"
                  style={{
                    width: `${(resumoInvestimento.midia.institucional / resumoInvestimento.midia.total) * 100}%`,
                    background: `linear-gradient(to right, ${colors.institutional}, ${colors.institutional}dd)`
                  }}
                >
                  {resumoInvestimento.midia.institucional > 0 && (
                    <span>
                      Institucional: {((resumoInvestimento.midia.institucional / resumoInvestimento.midia.total) * 100).toFixed(1)}%
                      <br />
                      {formatMetricValue(resumoInvestimento.midia.institucional, "spent")}
                    </span>
                  )}
                </div>
                <div
                  className="absolute right-0 top-0 h-full flex items-center justify-center text-white text-xs font-semibold transition-all duration-500"
                  style={{
                    width: `${(resumoInvestimento.midia.mercadologica / resumoInvestimento.midia.total) * 100}%`,
                    background: `linear-gradient(to right, ${colors.mercadologico}, ${colors.mercadologico}dd)`
                  }}
                >
                  {resumoInvestimento.midia.mercadologica > 0 && (
                    <span>
                      Mercadológico: {((resumoInvestimento.midia.mercadologica / resumoInvestimento.midia.total) * 100).toFixed(1)}%
                      <br />
                      {formatMetricValue(resumoInvestimento.midia.mercadologica, "spent")}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Produção */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-700">Produção</span>
                <span className="text-sm font-bold" style={{ color: colors.producao }}>
                  {formatMetricValue(resumoInvestimento.producao.total, "spent")}
                </span>
              </div>
              <div className="relative h-12 bg-gray-100 rounded-lg overflow-hidden shadow-sm">
                <div
                  className="absolute left-0 top-0 h-full flex items-center justify-center text-white text-xs font-semibold transition-all duration-500"
                  style={{
                    width: `${(resumoInvestimento.producao.institucional / resumoInvestimento.producao.total) * 100}%`,
                    background: `linear-gradient(to right, ${colors.institutional}, ${colors.institutional}dd)`
                  }}
                >
                  {resumoInvestimento.producao.institucional > 0 && (
                    <span>
                      Institucional: {((resumoInvestimento.producao.institucional / resumoInvestimento.producao.total) * 100).toFixed(1)}%
                      <br />
                      {formatMetricValue(resumoInvestimento.producao.institucional, "spent")}
                    </span>
                  )}
                </div>
                <div
                  className="absolute right-0 top-0 h-full flex items-center justify-center text-white text-xs font-semibold transition-all duration-500"
                  style={{
                    width: `${(resumoInvestimento.producao.mercadologica / resumoInvestimento.producao.total) * 100}%`,
                    background: `linear-gradient(to right, ${colors.mercadologico}, ${colors.mercadologico}dd)`
                  }}
                >
                  {resumoInvestimento.producao.mercadologica > 0 && (
                    <span>
                      Mercadológico: {((resumoInvestimento.producao.mercadologica / resumoInvestimento.producao.total) * 100).toFixed(1)}%
                      <br />
                      {formatMetricValue(resumoInvestimento.producao.mercadologica, "spent")}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Criação / Ações em Planejamento */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-700">{selectedAno === 2026 ? "Ações em Planejamento" : "Criação"}</span>
                <span className="text-sm font-bold" style={{ color: colors.criacao }}>
                  {formatMetricValue(resumoInvestimento.emInclusao.total, "spent")}
                </span>
              </div>
              <div className="relative h-12 bg-gray-100 rounded-lg overflow-hidden shadow-sm">
                <div
                  className="absolute left-0 top-0 h-full flex items-center justify-center text-white text-xs font-semibold transition-all duration-500"
                  style={{
                    width: `${(resumoInvestimento.emInclusao.institucional / resumoInvestimento.emInclusao.total) * 100}%`,
                    background: `linear-gradient(to right, ${colors.institutional}, ${colors.institutional}dd)`
                  }}
                >
                  {resumoInvestimento.emInclusao.institucional > 0 && (
                    <span>
                      Institucional: {((resumoInvestimento.emInclusao.institucional / resumoInvestimento.emInclusao.total) * 100).toFixed(1)}%
                      <br />
                      {formatMetricValue(resumoInvestimento.emInclusao.institucional, "spent")}
                    </span>
                  )}
                </div>
                <div
                  className="absolute right-0 top-0 h-full flex items-center justify-center text-white text-xs font-semibold transition-all duration-500"
                  style={{
                    width: `${(resumoInvestimento.emInclusao.mercadologica / resumoInvestimento.emInclusao.total) * 100}%`,
                    background: `linear-gradient(to right, ${colors.mercadologico}, ${colors.mercadologico}dd)`
                  }}
                >
                  {resumoInvestimento.emInclusao.mercadologica > 0 && (
                    <span>
                      Mercadológico: {((resumoInvestimento.emInclusao.mercadologica / resumoInvestimento.emInclusao.total) * 100).toFixed(1)}%
                      <br />
                      {formatMetricValue(resumoInvestimento.emInclusao.mercadologica, "spent")}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Legenda */}
            <div className="flex items-center justify-center gap-6 pt-3 border-t border-gray-200">
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded"
                  style={{ background: `linear-gradient(to right, ${colors.institutional}, ${colors.institutional}dd)` }}
                ></div>
                <span className="text-sm text-gray-600">Institucional</span>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded"
                  style={{ background: `linear-gradient(to right, ${colors.mercadologico}, ${colors.mercadologico}dd)` }}
                ></div>
                <span className="text-sm text-gray-600">Mercadológico</span>
              </div>
            </div>
          </div>

          {/* Resumo totais e saldo */}
          <div className="mt-4 grid grid-cols-3 gap-4 pt-4 border-t border-gray-200">
            <div className="text-center">
              <p className="text-xs text-gray-500 mb-1">Total Institucional</p>
              <p className="text-lg font-bold" style={{ color: colors.institutional }}>
                {formatMetricValue(resumoInvestimento.totalGeral.institucional, "spent")}
              </p>
              <p className="text-xs font-semibold mt-1" style={{ color: colors.primaryDark }}>
                Saldo: {formatMetricValue(resumoInvestimento.saldo.institucional, "spent")}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 mb-1">Total Mercadológico</p>
              <p className="text-lg font-bold" style={{ color: colors.mercadologico }}>
                {formatMetricValue(resumoInvestimento.totalGeral.mercadologica, "spent")}
              </p>
              <p className="text-xs font-semibold mt-1" style={{ color: colors.primaryDark }}>
                Saldo: {formatMetricValue(resumoInvestimento.saldo.mercadologica, "spent")}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 mb-1">Total Geral</p>
              <p className="text-xl font-bold" style={{ color: colors.totalGeral }}>
                {formatMetricValue(resumoInvestimento.totalGeral.total, "spent")}
              </p>
              <p className="text-xs font-semibold mt-1" style={{ color: colors.primary }}>
                Saldo: {formatMetricValue(resumoInvestimento.saldo.total, "spent")}
              </p>
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}

export default Capa
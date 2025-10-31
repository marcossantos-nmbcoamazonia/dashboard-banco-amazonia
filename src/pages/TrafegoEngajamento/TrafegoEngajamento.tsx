"use client"

import type React from "react"
import { useState, useMemo } from "react"
import { TrendingUp, Calendar, MousePointer, Clock, Users, BarChart3 } from "lucide-react"
import Loading from "../../components/Loading/Loading"
import { useGA4ResumoData, useGA4CompletoData, useGA4SourceData } from "../../services/api" // Importar nova API
import BrazilMap from "../../components/BrazilMap/BrazilMap" // Importar novo componente de mapa

type TrafegoEngajamentoProps = {}

// Mapeamento explícito dos nomes dos estados da API para os nomes no GeoJSON
const API_TO_GEOJSON_STATE_NAMES: { [key: string]: string } = {
  Ceara: "Ceará",
  "Federal District": "Distrito Federal",
  "State of Acre": "Acre",
  "State of Alagoas": "Alagoas",
  "State of Amapa": "Amapá",
  "State of Amazonas": "Amazonas",
  "State of Bahia": "Bahia",
  "State of Espirito Santo": "Espírito Santo",
  "State of Goias": "Goiás",
  "State of Maranhao": "Maranhão",
  "State of Mato Grosso": "Mato Grosso",
  "State of Mato Grosso do Sul": "Mato Grosso do Sul",
  "State of Minas Gerais": "Minas Gerais",
  "State of Para": "Pará",
  "State of Paraiba": "Paraíba",
  "State of Parana": "Paraná",
  "State of Pernambuco": "Pernambuco",
  "State of Piaui": "Piauí",
  "State of Rio de Janeiro": "Rio de Janeiro",
  "State of Rio Grande do Norte": "Rio Grande do Norte",
  "State of Rio Grande do Sul": "Rio Grande do Sul",
  "State of Rondonia": "Rondônia",
  "State of Roraima": "Roraima",
  "State of Santa Catarina": "Santa Catarina",
  "State of Sao Paulo": "São Paulo",
  "State of Sergipe": "Sergipe",
  "State of Tocantins": "Tocantins",
  "Upper Takutu-Upper Essequibo": "Outros", // This isn't a Brazilian state
}

const TrafegoEngajamento: React.FC<TrafegoEngajamentoProps> = () => {
  const { data: ga4ResumoData, loading: resumoLoading, error: resumoError } = useGA4ResumoData()
  const { data: ga4CompletoData, loading: completoLoading, error: completoError } = useGA4CompletoData()
  const { data: ga4SourceData, loading: sourceLoading, error: sourceError } = useGA4SourceData() // Nova API

  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: "2025-05-26",
    end: "2025-06-31",
  })

  // Função para verificar se uma data está dentro do range selecionado
  const isDateInRange = (dateStr: string): boolean => {
    if (!dateStr || !dateRange.start || !dateRange.end) return true

    // Converter string de data para formato comparável (YYYY-MM-DD)
    const date = new Date(dateStr).toISOString().split("T")[0]
    const startDate = new Date(dateRange.start).toISOString().split("T")[0]
    const endDate = new Date(dateRange.end).toISOString().split("T")[0]

    return date >= startDate && date <= endDate
  }

  // Função para obter cor do veículo/plataforma
  const getPlataformaColor = (plataforma: string): string => {
    const colors: { [key: string]: string } = {
      Meta: "#1877f2",
      TikTok: "#ff0050",
      YouTube: "#ff0000",
      Spotify: "#1DB954",
      Netflix: "#E50914",
      "Portal Forum": "#8b5cf6",
      "Brasil 247": "#10b981",
      Band: "#f59e0b",
      "Globo.com": "#0066cc",
      GDN: "#4285f4",
      "Demand-Gen": "#34a853",
      Orgânico: "#6b7280",
      Outros: "#9ca3af",
    }
    return colors[plataforma] || "#6b7280"
  }

  // Processamento dos dados da API GA4 Source (nova funcionalidade) com filtro de data
  const processedSourceData = useMemo(() => {
    if (!ga4SourceData?.values || ga4SourceData.values.length <= 1) {
      return {
        veiculosDetalhados: [],
        fontesPorPlataforma: {},
        totalSessions: 0,
        resumoPorData: {},
      }
    }

    const headers = ga4SourceData.values[0]
    const rows = ga4SourceData.values.slice(1)

    // Índices das colunas
    const dateIndex = headers.indexOf("Date")
    const campaignIndex = headers.indexOf("User campaign name")
    const sourceIndex = headers.indexOf("Session manual source")
    const sessionsIndex = headers.indexOf("Sessions")
    const plataformaIndex = headers.indexOf("Plataforma")

    const veiculoData: { [key: string]: number } = {}
    const plataformaData: { [key: string]: { [key: string]: number } } = {}
    const dataResumo: { [key: string]: number } = {}
    let totalSessions = 0

    rows.forEach((row: any[]) => {
      const date = row[dateIndex] || ""

      // Aplicar filtro de data
      if (!isDateInRange(date)) return

      const sessions = Number.parseInt(row[sessionsIndex]) || 0
      const plataforma = row[plataformaIndex] || "Outros"
      const source = row[sourceIndex] || "(not set)"
      const campaign = row[campaignIndex] || "(not set)"

      if (sessions > 0) {
        totalSessions += sessions

        // Agrupar por plataforma
        veiculoData[plataforma] = (veiculoData[plataforma] || 0) + sessions

        // Agrupar fontes por plataforma
        if (!plataformaData[plataforma]) {
          plataformaData[plataforma] = {}
        }
        if (source !== "(not set)") {
          plataformaData[plataforma][source] = (plataformaData[plataforma][source] || 0) + sessions
        }

        // Resumo por data
        if (date) {
          dataResumo[date] = (dataResumo[date] || 0) + sessions
        }
      }
    })

    // Converter em arrays ordenados
    const veiculosDetalhados = Object.entries(veiculoData)
      .map(([plataforma, sessoes]) => ({
        plataforma,
        sessoes,
        percentual: totalSessions > 0 ? (sessoes / totalSessions) * 100 : 0,
        cor: getPlataformaColor(plataforma),
      }))
      .sort((a, b) => b.sessoes - a.sessoes)

    return {
      veiculosDetalhados,
      fontesPorPlataforma: plataformaData,
      totalSessions,
      resumoPorData: dataResumo,
    }
  }, [ga4SourceData, dateRange])

  // Processamento dos dados da API GA4 Resumo (para o mapa e gráficos existentes) com filtro de data
  const processedResumoData = useMemo(() => {
    if (!ga4ResumoData?.values || ga4ResumoData.values.length <= 1) {
      return {
        receptivo: {
          sessoesCampanha: 0,
          cliquesSaibaMais: 0,
          cliquesCTAs: 0,
          duracaoSessoes: "00:00:00",
          taxaRejeicao: 0,
        },
        dispositivos: [],
        dadosRegiao: {},
      }
    }

    const headers = ga4ResumoData.values[0]
    const rows = ga4ResumoData.values.slice(1)

    // Índices das colunas
    const dateIndex = headers.indexOf("Date")
    const regionIndex = headers.indexOf("Region")
    const deviceIndex = headers.indexOf("Device category")
    const sessionsIndex = headers.indexOf("Sessions")
    const bounceRateIndex = headers.indexOf("Bounce rate")
    const avgDurationIndex = headers.indexOf("Average session duration")
    const saibaMaisIndex = headers.indexOf("Key event count for web_pvc_cartoes_useourocard_saibamais")
    const ctasIndex1 = headers.indexOf("Key event count for web_pvc_cartoes_useourocard_ctas")
    const ctasIndex2 = headers.indexOf("Key event count for web_pvc_cartoes_use_ourocard_ctas")

    let totalSessions = 0
    let totalSaibaMais = 0
    let totalDuration = 0
    let totalBounceRate = 0
    let validRows = 0
    let totalCTAs = 0

    const deviceData: { [key: string]: number } = {}
    const regionData: { [key: string]: number } = {}

    rows.forEach((row: any[]) => {
      const date = row[dateIndex] || ""

      // Aplicar filtro de data
      if (!isDateInRange(date)) return

      const sessions = Number.parseInt(row[sessionsIndex]) || 0
      const saibaMais = Number.parseInt(row[saibaMaisIndex]) || 0
      const duration = Number.parseFloat(row[avgDurationIndex]) || 0
      const bounceRate = Number.parseFloat(row[bounceRateIndex]) || 0
      const device = row[deviceIndex] || "Outros"
      const region = row[regionIndex] || "Outros"
      const ctas1 = Number.parseInt(row[ctasIndex1]) || 0
      const ctas2 = Number.parseInt(row[ctasIndex2]) || 0

      totalCTAs += ctas1 + ctas2

      if (sessions > 0) {
        totalSessions += sessions
        totalSaibaMais += saibaMais
        totalDuration += duration * sessions
        totalBounceRate += bounceRate * sessions
        validRows += sessions

        // Dispositivos
        deviceData[device] = (deviceData[device] || 0) + sessions

        // Regiões - Converter o nome do estado para o formato esperado pelo mapa
        if (region !== "(not set)" && region.trim() !== "" && region !== " ") {
          const normalizedRegion = API_TO_GEOJSON_STATE_NAMES[region] || region
          regionData[normalizedRegion] = (regionData[normalizedRegion] || 0) + sessions
        }
      }
    })

    // Converter em arrays ordenados
    const dispositivos = Object.entries(deviceData)
      .map(([tipo, sessoes]) => ({
        tipo,
        sessoes,
        percentual: totalSessions > 0 ? (sessoes / totalSessions) * 100 : 0,
        cor: tipo === "mobile" ? "#3b82f6" : tipo === "desktop" ? "#8b5cf6" : "#06b6d4",
      }))
      .sort((a, b) => b.sessoes - a.sessoes)

    // Converter duração para formato hh:mm:ss
    const avgDurationSec = validRows > 0 ? totalDuration / validRows : 0
    const hours = Math.floor(avgDurationSec / 3600)
    const minutes = Math.floor((avgDurationSec % 3600) / 60)
    const seconds = Math.floor(avgDurationSec % 60)
    const duracaoFormatada = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`

    const avgBounceRate = validRows > 0 ? (totalBounceRate / validRows) * 100 : 0

    return {
      receptivo: {
        sessoesCampanha: totalSessions,
        cliquesSaibaMais: totalSaibaMais,
        cliquesCTAs: totalCTAs,
        duracaoSessoes: duracaoFormatada,
        taxaRejeicao: avgBounceRate,
      },
      dispositivos,
      dadosRegiao: regionData,
    }
  }, [ga4ResumoData, dateRange])

  // Processamento dos dados da NOVA API GA4 Completo (para os novos cards) com filtro de data
  const processedCompletoData = useMemo(() => {
    if (!ga4CompletoData?.values || ga4CompletoData.values.length <= 1) {
      return {
        totalSessions: 0,
        totalEvents: 0,
      }
    }

    const headers = ga4CompletoData.values[0]
    const rows = ga4CompletoData.values.slice(1)

    const dateIndex = headers.indexOf("Date")
    const sessionsIndex = headers.indexOf("Sessions")
    const eventCountIndex = headers.indexOf("Event count")

    let totalSessions = 0
    let totalEvents = 0

    rows.forEach((row: any[]) => {
      const date = row[dateIndex] || ""

      // Aplicar filtro de data
      if (!isDateInRange(date)) return

      totalSessions += Number.parseInt(row[sessionsIndex]) || 0
      totalEvents += Number.parseInt(row[eventCountIndex]) || 0
    })

    return {
      totalSessions,
      totalEvents,
    }
  }, [ga4CompletoData, dateRange])

  // Função para formatar números
  const formatNumber = (value: number): string => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)} mi`
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)} mil`
    }
    return value.toLocaleString("pt-BR")
  }

  // Componente de gráfico de barras horizontais
  const HorizontalBarChart: React.FC<{
    title: string
    data: Array<{
      categoria?: string
      tipo?: string
      plataforma?: string
      campanha?: string
      sessoes: number
      percentual: number
      cor?: string
    }>
    showValues?: boolean
  }> = ({ title, data, showValues = true }) => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      <div className="space-y-3">
        {data.map((item, index) => (
          <div key={index} className="space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">
                {item.categoria || item.tipo || item.plataforma || item.campanha}
              </span>
              {showValues && (
                <span className="text-sm text-gray-600">
                  {formatNumber(item.sessoes)} ({item.percentual.toFixed(1)}%)
                </span>
              )}
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="h-3 rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(item.percentual, 100)}%`,
                  backgroundColor: item.cor || "#6b7280",
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  // Função para converter hex para RGB
  const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result
      ? {
          r: Number.parseInt(result[1], 16),
          g: Number.parseInt(result[2], 16),
          b: Number.parseInt(result[3], 16),
        }
      : { r: 0, g: 0, b: 0 }
  }

  // Função para converter RGB para hex
  const rgbToHex = (r: number, g: number, b: number): string => {
    return "#" + ((1 << 24) + (Math.round(r) << 16) + (Math.round(g) << 8) + Math.round(b)).toString(16).slice(1)
  }

  // Função para interpolar entre duas cores
  const interpolateColor = (color1: string, color2: string, factor: number): string => {
    const rgb1 = hexToRgb(color1)
    const rgb2 = hexToRgb(color2)

    const r = rgb1.r + (rgb2.r - rgb1.r) * factor
    const g = rgb1.g + (rgb2.g - rgb1.g) * factor
    const b = rgb1.b + (rgb2.b - rgb1.b) * factor

    return rgbToHex(r, g, b)
  }

  const getIntensityColor = (sessions: number): string => {
    // Pega todos os valores de sessões já mapeados no mapa
    const values = Object.values(processedResumoData.dadosRegiao)
    const maxSessions = values.length > 0 ? Math.max(...values) : 0

    if (sessions === 0 || maxSessions === 0) return "#e5e7eb" // Sem dados

    const intensity = sessions / maxSessions

    // Nova paleta de cores
    const colors = {
      muitoAlta: "#03045E", // Muito alta
      alta: "#023E8A", // Alta
      medio: "#0077B6", // Médio
      baixa: "#0096C7", // Baixa
      muitoBaixa: "#00B4D8", // Muito Baixa
    }

    // Criar transições suaves entre os níveis
    if (intensity >= 0.8) {
      // Entre Muito Alta (100%) e Alta (80%)
      const factor = (intensity - 0.8) / 0.2 // Normaliza entre 0 e 1
      return interpolateColor(colors.alta, colors.muitoAlta, factor)
    } else if (intensity >= 0.6) {
      // Entre Alta (80%) e Médio (60%)
      const factor = (intensity - 0.6) / 0.2
      return interpolateColor(colors.medio, colors.alta, factor)
    } else if (intensity >= 0.4) {
      // Entre Médio (60%) e Baixa (40%)
      const factor = (intensity - 0.4) / 0.2
      return interpolateColor(colors.baixa, colors.medio, factor)
    } else if (intensity >= 0.2) {
      // Entre Baixa (40%) e Muito Baixa (20%)
      const factor = (intensity - 0.2) / 0.2
      return interpolateColor(colors.muitoBaixa, colors.baixa, factor)
    } else {
      // Muito Baixa (0% - 20%)
      return colors.muitoBaixa
    }
  }

  if (resumoLoading || completoLoading || sourceLoading) {
    return <Loading message="Carregando dados de tráfego e engajamento..." />
  }

  if (resumoError || completoError || sourceError) {
    return (
      <div className="p-6 text-center">
        <div className="text-red-500 mb-2">Erro ao carregar dados</div>
        <p className="text-gray-600">Não foi possível carregar os dados do GA4. Tente novamente.</p>
        {resumoError && <p className="text-xs text-red-400">{resumoError.message}</p>}
        {completoError && <p className="text-xs text-red-400">{completoError.message}</p>}
        {sourceError && <p className="text-xs text-red-400">{sourceError.message}</p>}
      </div>
    )
  }

  return (
    <div className="space-y-6 h-full flex flex-col">
      {/* Título e Subtítulo */}
      <div className="col-span-3 flex items-center space-x-3">
        <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-blue-600 rounded-lg flex items-center justify-center">
          <TrendingUp className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Tráfego e Engajamento</h1>
          <p className="text-xs text-gray-600">Receptivo da campanha</p>
        </div>
      </div>
      {/* Header Compacto com Filtro de Data e Cards de Métricas */}
      <div className="card-overlay rounded-lg shadow-lg p-4">
        <div className="grid grid-cols-12 gap-4 items-center">
          {/* Filtro de Data */}
          <div className="col-span-3">
            <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center">
              <Calendar className="w-3 h-3 mr-1" />
              Período de Análise
            </label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value }))}
                className="px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))}
                className="px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Cards de Métricas - 6 cards ocupando 9 colunas */}
          <div className="col-span-9 grid grid-cols-6 gap-3">
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-green-600">Sessões Campanha</p>
                  <p className="text-lg font-bold text-green-900">
                    {formatNumber(processedResumoData.receptivo.sessoesCampanha)}
                  </p>
                </div>
                <Users className="w-6 h-6 text-green-600" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-blue-600">Cliques SaibaMais</p>
                  <p className="text-lg font-bold text-blue-900">
                    {formatNumber(processedResumoData.receptivo.cliquesSaibaMais)}
                  </p>
                </div>
                <MousePointer className="w-6 h-6 text-blue-600" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-orange-600">Cliques nos CTAs</p>
                  <p className="text-lg font-bold text-orange-900">
                    {formatNumber(processedResumoData.receptivo.cliquesCTAs)}
                  </p>
                </div>
                <MousePointer className="w-6 h-6 text-orange-600" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-purple-600">Duração sessões</p>
                  <p className="text-lg font-bold text-purple-900">{processedResumoData.receptivo.duracaoSessoes}</p>
                </div>
                <Clock className="w-6 h-6 text-purple-600" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-yellow-600">Sessões Totais</p>
                  <p className="text-lg font-bold text-yellow-900">{formatNumber(processedSourceData.totalSessions)}</p>
                </div>
                <BarChart3 className="w-6 h-6 text-yellow-600" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-red-600">Eventos Totais</p>
                  <p className="text-lg font-bold text-red-900">{formatNumber(processedCompletoData.totalEvents)}</p>
                </div>
                <TrendingUp className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Período selecionado - linha inferior */}
        <div className="mt-2 text-xs text-gray-500">
          Período selecionado: {new Date(dateRange.start).toLocaleDateString("pt-BR")} até{" "}
          {new Date(dateRange.end).toLocaleDateString("pt-BR")} | Última atualização:{" "}
          {new Date().toLocaleString("pt-BR")}
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {/* Dispositivos */}
        <div className="card-overlay rounded-lg shadow-lg p-6">
          <HorizontalBarChart title="Dispositivo" data={processedResumoData.dispositivos} />
        </div>

        {/* Plataformas Detalhadas (Nova funcionalidade) */}
        <div className="card-overlay rounded-lg shadow-lg p-6">
          <HorizontalBarChart title="Plataformas - Sessões Detalhadas" data={processedSourceData.veiculosDetalhados} />
        </div>

        {/* Mapa de Calor - Usando o novo componente */}
        <div className="card-overlay rounded-lg shadow-lg p-6">
          <BrazilMap
            regionData={processedResumoData.dadosRegiao}
            getIntensityColor={(sessions) => {
              const values = Object.values(processedResumoData.dadosRegiao)
              const maxSessions = values.length > 0 ? Math.max(...values) : 0

              if (sessions === 0 || maxSessions === 0) return "#e5e7eb"

              const intensity = sessions / maxSessions

              const colors = {
                muitoAlta: "#03045E",
                alta: "#023E8A",
                medio: "#0077B6",
                baixa: "#0096C7",
                muitoBaixa: "#00B4D8",
              }

              const hexToRgb = (hex: string) => {
                const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
                return result
                  ? {
                      r: Number.parseInt(result[1], 16),
                      g: Number.parseInt(result[2], 16),
                      b: Number.parseInt(result[3], 16),
                    }
                  : { r: 0, g: 0, b: 0 }
              }

              const rgbToHex = (r: number, g: number, b: number) => {
                return (
                  "#" + ((1 << 24) + (Math.round(r) << 16) + (Math.round(g) << 8) + Math.round(b)).toString(16).slice(1)
                )
              }

              const interpolateColor = (color1: string, color2: string, factor: number) => {
                const rgb1 = hexToRgb(color1)
                const rgb2 = hexToRgb(color2)

                const r = rgb1.r + (rgb2.r - rgb1.r) * factor
                const g = rgb1.g + (rgb2.g - rgb1.g) * factor
                const b = rgb1.b + (rgb2.b - rgb1.b) * factor

                return rgbToHex(r, g, b)
              }

              if (intensity >= 0.8) {
                const factor = (intensity - 0.8) / 0.2
                return interpolateColor(colors.alta, colors.muitoAlta, factor)
              } else if (intensity >= 0.6) {
                const factor = (intensity - 0.6) / 0.2
                return interpolateColor(colors.medio, colors.alta, factor)
              } else if (intensity >= 0.4) {
                const factor = (intensity - 0.4) / 0.2
                return interpolateColor(colors.baixa, colors.medio, factor)
              } else if (intensity >= 0.2) {
                const factor = (intensity - 0.2) / 0.2
                return interpolateColor(colors.muitoBaixa, colors.baixa, factor)
              } else {
                return colors.muitoBaixa
              }
            }}
          />
        </div>
      </div>

      {/* Observações */}
      <div className="card-overlay rounded-lg shadow-lg p-4">
        <p className="text-sm text-gray-600">
          <strong>Fontes:</strong> GA4 Resumo, GA4 Completo e GA4 Source. Os dados são atualizados todos os dias às 6
          horas da manhã.
        </p>
        <p className="text-xs text-gray-500 mt-2">
          <strong>Filtro de Data:</strong> Os dados são filtrados automaticamente com base no período selecionado. Todos
          os gráficos e métricas refletem apenas os dados do período escolhido.
        </p>
      </div>
    </div>
  )
}

export default TrafegoEngajamento

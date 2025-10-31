"use client"

import type React from "react"
import { useState, useEffect, useMemo } from "react"
import { Globe, BarChart3, Tv, Radio, Smartphone, Monitor, Volume2, Eye, Play, MousePointer, Users } from "lucide-react"
import { useResumoData, useGA4ResumoData, useConsolidadoData } from "../../services/api"
import Loading from "../../components/Loading/Loading"

interface VehicleData {
  veiculo: string
  dsp: string
  custoInvestido: number
  custoPrevisto: number
  mes: string
  pacing: number
  shareInvestido: number
  sharePrevisto: number
}

interface MonthlyTotals {
  mes: string
  totalInvestido: number
  totalPrevisto: number
  pacing: number
}

interface CampaignSummary {
  totalInvestimentoPrevisto: number
  totalCustoInvestido: number
  impressoesTotais: number
  cliquesTotais: number
  sessoesTotais: number
  vtr: number
}

interface AggregatedVehicleData {
  veiculo: string
  custoInvestido: number
  custoPrevisto: number
  pacing: number
  shareInvestido: number
  sharePrevisto: number
}

const EstrategiaOnline: React.FC = () => {
  const { data: resumoData, loading: resumoLoading, error: resumoError } = useResumoData()
  const { data: ga4Data, loading: ga4Loading, error: ga4Error } = useGA4ResumoData()
  const { data: consolidadoData, loading: consolidadoLoading, error: consolidadoError } = useConsolidadoData()
  const [vehicleData, setVehicleData] = useState<VehicleData[]>([])
  const [monthlyTotals, setMonthlyTotals] = useState<MonthlyTotals[]>([])
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)
  const [availableMonths, setAvailableMonths] = useState<string[]>([])
  const [campaignSummary, setCampaignSummary] = useState<CampaignSummary>({
    totalInvestimentoPrevisto: 0,
    totalCustoInvestido: 0,
    impressoesTotais: 0,
    cliquesTotais: 0,
    sessoesTotais: 0,
    vtr: 85,
  })

  const loading = resumoLoading || ga4Loading || consolidadoLoading
  const error = resumoError || ga4Error || consolidadoError

  // Ícones para diferentes plataformas
  const getPlatformIcon = (platform: string) => {
    const iconMap: Record<string, React.ReactNode> = {
      META: <Smartphone className="w-5 h-5" />,
      GOOGLE: <Globe className="w-5 h-5" />,
      GDN: <Globe className="w-5 h-5" />,
      "DEMAND-GEN": <Globe className="w-5 h-5" />,
      TIKTOK: <Play className="w-5 h-5" />,
      YOUTUBE: <Tv className="w-5 h-5" />,
      "SPOTIFY BRASIL": <Volume2 className="w-5 h-5" />,
      SPOTIFY: <Volume2 className="w-5 h-5" />,
      NETFLIX: <Monitor className="w-5 h-5" />,
      "CATRACA LIVRE": <Eye className="w-5 h-5" />,
      UBER: <Smartphone className="w-5 h-5" />,
      PINTEREST: <Eye className="w-5 h-5" />,
      LINKEDIN: <Smartphone className="w-5 h-5" />,
      "PRIME VIDEO ADS": <Monitor className="w-5 h-5" />,
      "GLOBO.COM": <Monitor className="w-5 h-5" />,
      BAND: <Radio className="w-5 h-5" />,
      "BRASIL 247": <Eye className="w-5 h-5" />,
      "PORTAL FORUM": <Eye className="w-5 h-5" />,
    }
    return iconMap[platform.toUpperCase()] || <Globe className="w-5 h-5" />
  }

  // Cores para diferentes plataformas
  const getPlatformColor = (platform: string) => {
    const colorMap: Record<string, string> = {
      META: "#1877f2",
      GOOGLE: "#4285f4",
      GDN: "#4285f4",
      "DEMAND-GEN": "#34a853",
      TIKTOK: "#ff0050",
      YOUTUBE: "#ff0000",
      "SPOTIFY BRASIL": "#1DB954",
      SPOTIFY: "#1DB954",
      NETFLIX: "#E50914",
      "CATRACA LIVRE": "#3498db",
      UBER: "#000000",
      PINTEREST: "#bd081c",
      LINKEDIN: "#0077b5",
      "PRIME VIDEO ADS": "#00a8e1",
      "GLOBO.COM": "#00a86b",
      BAND: "#ffd700",
      "BRASIL 247": "#ff4500",
      "PORTAL FORUM": "#8b4513",
    }
    return colorMap[platform.toUpperCase()] || "#6366f1"
  }

  // Função para obter cor do pacing (amarelo baixo → azul alto)
  const getPacingColor = (pacing: number) => {
    // Normalizar pacing para 0-1 (0% = 0, 100% = 1)
    const normalizedPacing = Math.min(Math.max(pacing / 100, 0), 1)

    // Cores: amarelo (#fbbf24) para baixo, azul (#3b82f6) para alto
    const yellow = { r: 251, g: 191, b: 36 }
    const blue = { r: 59, g: 130, b: 246 }

    // Interpolação linear entre as cores
    const r = Math.round(yellow.r + (blue.r - yellow.r) * normalizedPacing)
    const g = Math.round(yellow.g + (blue.g - yellow.g) * normalizedPacing)
    const b = Math.round(yellow.b + (blue.b - yellow.b) * normalizedPacing)

    return `rgb(${r}, ${g}, ${b})`
  }

  // Processar dados da API
  useEffect(() => {
    if (resumoData?.values) {
      const headers = resumoData.values[0]
      const rows = resumoData.values.slice(1)

      const processed: VehicleData[] = rows
        .map((row: any[]) => {
          const parseValue = (value: string) => {
            if (!value) return 0
            return Number.parseFloat(value.replace(/[R$\s.]/g, "").replace(",", ".")) || 0
          }

          const custoInvestido = parseValue(row[headers.indexOf("Custo Investido")])
          const custoPrevisto = parseValue(row[headers.indexOf("Custo Previsto")])
          const pacing = custoPrevisto > 0 ? (custoInvestido / custoPrevisto) * 100 : 0

          return {
            veiculo: row[headers.indexOf("Veículo")] || "",
            dsp: row[headers.indexOf("DSP")] || "",
            custoInvestido,
            custoPrevisto,
            mes: row[headers.indexOf("Mês")] || "",
            pacing,
            shareInvestido: 0, // Será calculado depois
            sharePrevisto: 0, // Será calculado depois
          }
        })
        .filter((vehicle: VehicleData) => vehicle.veiculo)

      // Calcular totais por mês
      const monthTotals: Record<string, MonthlyTotals> = {}
      processed.forEach((vehicle) => {
        if (!monthTotals[vehicle.mes]) {
          monthTotals[vehicle.mes] = {
            mes: vehicle.mes,
            totalInvestido: 0,
            totalPrevisto: 0,
            pacing: 0,
          }
        }
        monthTotals[vehicle.mes].totalInvestido += vehicle.custoInvestido
        monthTotals[vehicle.mes].totalPrevisto += vehicle.custoPrevisto
      })

      // Calcular pacing dos totais mensais
      Object.values(monthTotals).forEach((month) => {
        month.pacing = month.totalPrevisto > 0 ? (month.totalInvestido / month.totalPrevisto) * 100 : 0
      })

      setMonthlyTotals(Object.values(monthTotals))

      // Calcular shares
      const totalGeralInvestido = processed.reduce((sum, v) => sum + v.custoInvestido, 0)
      const totalGeralPrevisto = processed.reduce((sum, v) => sum + v.custoPrevisto, 0)

      processed.forEach((vehicle) => {
        vehicle.shareInvestido = totalGeralInvestido > 0 ? (vehicle.custoInvestido / totalGeralInvestido) * 100 : 0
        vehicle.sharePrevisto = totalGeralPrevisto > 0 ? (vehicle.custoPrevisto / totalGeralPrevisto) * 100 : 0
      })

      setVehicleData(processed)

      // Extrair meses únicos
      const months = Array.from(new Set(processed.map((item) => item.mes)))
        .filter(Boolean)
        .sort()
      setAvailableMonths(months)

      // Calcular resumo da campanha
      const summary: CampaignSummary = {
        totalInvestimentoPrevisto: totalGeralPrevisto,
        totalCustoInvestido: totalGeralInvestido,
        impressoesTotais: 0, // Será calculado dos dados consolidados
        cliquesTotais: 0, // Será calculado dos dados consolidados
        sessoesTotais: 0, // Será calculado dos dados do GA4
        vtr: 85, // Valor exemplo
      }

      // Processar dados do GA4 para sessões
      if (ga4Data?.values) {
        const ga4Headers = ga4Data.values[0]
        const ga4Rows = ga4Data.values.slice(1)

        const sessionsIndex = ga4Headers.indexOf("Sessions")
        if (sessionsIndex !== -1) {
          summary.sessoesTotais = ga4Rows.reduce((sum: number, row: any[]) => {
            const sessions = Number.parseInt(row[sessionsIndex]?.toString().replace(/\./g, "").replace(/,/g, "") || "0")
            return sum + sessions
          }, 0)
        }
      }

      // Processar dados consolidados para impressões e cliques
      if (consolidadoData?.values) {
        const consolidadoHeaders = consolidadoData.values[0]
        const consolidadoRows = consolidadoData.values.slice(1)

        const impressionsIndex = consolidadoHeaders.indexOf("Impressions")
        const clicksIndex = consolidadoHeaders.indexOf("Clicks")

        if (impressionsIndex !== -1) {
          summary.impressoesTotais = consolidadoRows.reduce((sum: number, row: any[]) => {
            const impressions = Number.parseInt(
              row[impressionsIndex]?.toString().replace(/\./g, "").replace(/,/g, "") || "0",
            )
            return sum + impressions
          }, 0)
        }

        if (clicksIndex !== -1) {
          summary.cliquesTotais = consolidadoRows.reduce((sum: number, row: any[]) => {
            const clicks = Number.parseInt(row[clicksIndex]?.toString().replace(/\./g, "").replace(/,/g, "") || "0")
            return sum + clicks
          }, 0)
        }
      }

      setCampaignSummary(summary)
    }
  }, [resumoData, ga4Data, consolidadoData])

  // Dados agregados por veículo para a tabela
  const aggregatedVehicleData = useMemo(() => {
    const filteredData = selectedMonth ? vehicleData.filter((vehicle) => vehicle.mes === selectedMonth) : vehicleData

    const aggregated: Record<string, AggregatedVehicleData> = {}

    filteredData.forEach((vehicle) => {
      if (!aggregated[vehicle.veiculo]) {
        aggregated[vehicle.veiculo] = {
          veiculo: vehicle.veiculo,
          custoInvestido: 0,
          custoPrevisto: 0,
          pacing: 0,
          shareInvestido: 0,
          sharePrevisto: 0,
        }
      }

      aggregated[vehicle.veiculo].custoInvestido += vehicle.custoInvestido
      aggregated[vehicle.veiculo].custoPrevisto += vehicle.custoPrevisto
    })

    // Calcular totais para shares
    const totalInvestido = Object.values(aggregated).reduce((sum, v) => sum + v.custoInvestido, 0)
    const totalPrevisto = Object.values(aggregated).reduce((sum, v) => sum + v.custoPrevisto, 0)

    // Calcular pacing e shares
    Object.values(aggregated).forEach((vehicle) => {
      vehicle.pacing = vehicle.custoPrevisto > 0 ? (vehicle.custoInvestido / vehicle.custoPrevisto) * 100 : 0
      vehicle.shareInvestido = totalInvestido > 0 ? (vehicle.custoInvestido / totalInvestido) * 100 : 0
      vehicle.sharePrevisto = totalPrevisto > 0 ? (vehicle.custoPrevisto / totalPrevisto) * 100 : 0
    })

    return Object.values(aggregated).sort((a, b) => b.custoPrevisto - a.custoPrevisto)
  }, [vehicleData, selectedMonth])

  // Calcular totais filtrados
  const filteredTotals = useMemo(() => {
    const totalInvestido = aggregatedVehicleData.reduce((sum, v) => sum + v.custoInvestido, 0)
    const totalPrevisto = aggregatedVehicleData.reduce((sum, v) => sum + v.custoPrevisto, 0)
    const pacing = totalPrevisto > 0 ? (totalInvestido / totalPrevisto) * 100 : 0

    return { totalInvestido, totalPrevisto, pacing }
  }, [aggregatedVehicleData])

  // Função para formatar valores monetários
  const formatCurrency = (value: number): string => {
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    })
  }

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

  if (loading) {
    return <Loading message="Carregando estratégia online..." />
  }

  if (error) {
    return (
      <div className="bg-red-50/90 backdrop-blur-sm border border-red-200 rounded-lg p-4">
        <p className="text-red-600">Erro ao carregar dados: {error.message}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <Globe className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 text-enhanced">Estratégia Online</h1>
            <div className="flex items-center space-x-2 text-gray-600">
              <div className="flex items-center space-x-1">
                <Globe className="w-4 h-4" />
                <span className="text-sm font-medium">Internet</span>
              </div>
              <span className="text-sm">• Massiva</span>
            </div>
          </div>
        </div>
        <div className="text-sm text-gray-600 bg-white/80 backdrop-blur-sm px-3 py-1 rounded-lg">
          Última atualização: {new Date().toLocaleString("pt-BR")}
        </div>
      </div>

      {/* Cards Principais - Nova Ordem */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Impressões */}
        <div className="card-overlay rounded-lg shadow-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Impressões</p>
              <p className="text-xl font-bold text-gray-900">{formatNumber(campaignSummary.impressoesTotais)}</p>
            </div>
            <Eye className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        {/* Cliques */}
        <div className="card-overlay rounded-lg shadow-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Cliques</p>
              <p className="text-xl font-bold text-gray-900">{formatNumber(campaignSummary.cliquesTotais)}</p>
            </div>
            <MousePointer className="w-8 h-8 text-purple-600" />
          </div>
        </div>

        {/* Sessões */}
        <div className="card-overlay rounded-lg shadow-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Sessões</p>
              <p className="text-xl font-bold text-gray-900">{formatNumber(campaignSummary.sessoesTotais)}</p>
            </div>
            <Users className="w-8 h-8 text-green-600" />
          </div>
        </div>

        {/* Realizado (Dinâmico) */}
        <div className="card-overlay rounded-lg shadow-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Realizado {selectedMonth && `(${selectedMonth})`}</p>
              <p className="text-xl font-bold text-gray-900">{filteredTotals.pacing.toFixed(2)}%</p>
            </div>
            <BarChart3 className="w-8 h-8 text-orange-600" />
          </div>
        </div>

        {/* Valor Total */}
        <div className="lg:col-span-1 card-overlay rounded-lg shadow-lg p-4 bg-gradient-to-r from-green-50 to-blue-50">
          <div className="text-center">
            <p className="text-sm font-medium text-gray-600 mb-1">Investimento Líquido da Campanha</p>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(campaignSummary.totalInvestimentoPrevisto)}
            </p>
          </div>
        </div>
      </div>

      {/* Resumo por Mês - Cards Clicáveis */}
      <div className="card-overlay rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Resumo por Mês</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {monthlyTotals.map((month, index) => (
            <div
              key={index}
              className={`rounded-lg p-4 cursor-pointer transition-all duration-200 ${
                selectedMonth === month.mes
                  ? "bg-blue-100 border-2 border-blue-500 shadow-md"
                  : "bg-gray-50 border-2 border-transparent hover:bg-gray-100 hover:shadow-sm"
              }`}
              onClick={() => setSelectedMonth(selectedMonth === month.mes ? null : month.mes)}
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{month.mes}</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Previsto:</span>
                  <span className="font-medium">{formatCurrency(month.totalPrevisto)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Investido:</span>
                  <span className="font-medium">{formatCurrency(month.totalInvestido)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Pacing:</span>
                  <span className="font-semibold" style={{ color: getPacingColor(month.pacing) }}>
                    {month.pacing.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div
                    className="h-2 rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(month.pacing, 100)}%`,
                      backgroundColor: getPacingColor(month.pacing),
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
        {selectedMonth && (
          <div className="mt-4 text-center">
            <button
              onClick={() => setSelectedMonth(null)}
              className="px-4 py-2 text-sm text-blue-600 hover:text-blue-800 underline"
            >
              Limpar seleção (ver todos os meses)
            </button>
          </div>
        )}
      </div>

      {/* Tabela de Veículos Agregados */}
      <div className="flex-1 card-overlay rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">
            Estratégia e Execução {selectedMonth && `- ${selectedMonth}`}
          </h2>
          <div className="text-sm text-gray-500">
            {selectedMonth ? `Dados do mês de ${selectedMonth}` : "Dados agregados de todos os meses"}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full table-fixed">
            {" "}
            {/* Adicionado table-fixed */}
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-semibold text-gray-700 w-[20%]">Veículo</th>{" "}
                {/* Largura percentual */}
                <th className="text-right py-3 px-4 font-semibold text-gray-700 w-[18%]">Orçamento Previsto</th>{" "}
                {/* Largura percentual */}
                <th className="text-center py-3 px-4 font-semibold text-gray-700 w-[12%]">Share (%)</th>{" "}
                {/* Largura percentual */}
                <th className="text-right py-3 px-4 font-semibold text-gray-700 w-[18%]">Orçamento Realizado</th>{" "}
                {/* Largura percentual */}
                <th className="text-center py-3 px-4 font-semibold text-gray-700 w-[32%]">Pacing</th>{" "}
                {/* Largura percentual maior */}
              </tr>
            </thead>
            <tbody>
              {aggregatedVehicleData.map((vehicle, index) => (
                <tr key={index} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                  <td className="py-4 px-4">
                    <div className="flex items-center space-x-3">
                      <div
                        className="p-2 rounded-lg"
                        style={{ backgroundColor: `${getPlatformColor(vehicle.veiculo)}20` }}
                      >
                        <div style={{ color: getPlatformColor(vehicle.veiculo) }}>
                          {getPlatformIcon(vehicle.veiculo)}
                        </div>
                      </div>
                      <span className="font-medium text-gray-900">{vehicle.veiculo}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <span className="font-semibold text-gray-900">{formatCurrency(vehicle.custoPrevisto)}</span>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <span className="text-gray-700">{vehicle.sharePrevisto.toFixed(2)}%</span>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <span className="font-semibold text-gray-900">{formatCurrency(vehicle.custoInvestido)}</span>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center space-x-3 w-full">
                      {" "}
                      {/* Adicionado w-full */}
                      <div className="flex-1 bg-gray-200 rounded-full h-3 relative overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(vehicle.pacing, 100)}%`,
                            backgroundColor: getPacingColor(vehicle.pacing),
                          }}
                        />
                        {vehicle.pacing > 100 && (
                          <div
                            className="absolute top-0 h-full opacity-70"
                            style={{
                              left: "100%",
                              width: `${Math.min(vehicle.pacing - 100, 50)}%`,
                              backgroundColor: getPacingColor(vehicle.pacing),
                            }}
                          />
                        )}
                      </div>
                      <span
                        className="text-sm font-medium text-right"
                        style={{ color: getPacingColor(vehicle.pacing) }}
                      >
                        {vehicle.pacing.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-300 bg-gray-50/50">
                <td className="py-4 px-4 font-bold text-gray-900">Total</td>
                <td className="py-4 px-4 text-right font-bold text-gray-900">
                  {formatCurrency(filteredTotals.totalPrevisto)}
                </td>
                <td className="py-4 px-4 text-center font-bold text-gray-900">100,00%</td>
                <td className="py-4 px-4 text-right font-bold text-gray-900">
                  {formatCurrency(filteredTotals.totalInvestido)}
                </td>
                <td className="py-4 px-4 text-center">
                  <span className="font-bold" style={{ color: getPacingColor(filteredTotals.pacing) }}>
                    {filteredTotals.pacing.toFixed(1)}%
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Observações */}
        <div className="mt-6 p-4 bg-blue-50/50 rounded-lg border border-blue-200">
          <h3 className="font-semibold text-gray-900 mb-2">Observações Importantes:</h3>
          <ul className="text-sm text-gray-700 space-y-1">
            <li>
              • Dados de resultados apresentados, podendo sofrer alterações para mais ou para menos após finalização da
              campanha.
            </li>
            <li>
              • Por integração não sendo 100% compatível com as diversas plataformas de entrega, há diferenças entre os
              criativos e o valor de todos os veículos.
            </li>
            <li>
              • Imagens dos dados de acompanhamento da mídia são diferentes na agenda mensal, não são os mesmos exibidos
              na campanha.
            </li>
            <li>
              • Dados de veículos são atualizados mensalmente todas as segundas-feiras de acordo com dados internos.
            </li>
          </ul>
        </div>

        {/* Legenda de Cores do Pacing */}
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-semibold text-gray-700 mb-2">Legenda do Pacing:</h4>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: getPacingColor(0) }}></div>
              <span className="text-xs text-gray-600">0% - Baixo</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: getPacingColor(50) }}></div>
              <span className="text-xs text-gray-600">50% - Médio</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: getPacingColor(100) }}></div>
              <span className="text-xs text-gray-600">100% - Alto</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default EstrategiaOnline

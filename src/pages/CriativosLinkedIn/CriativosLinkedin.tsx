"use client"

import type React from "react"
import { useState, useEffect, useMemo } from "react"
import { Linkedin, Calendar, Filter, ArrowUpDown } from "lucide-react"
import { useCartaoLinkedInData, usePontuacaoLinkedInData } from "../../services/api"
import Loading from "../../components/Loading/Loading"

interface CreativeData {
  date: string
  accountName: string
  campaignGroupName: string
  campaignName: string
  creativeTitle: string
  creativeText: string
  creativeThumbnail: string
  creativeThumbnailUrl: string
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
  pontuacaoCriativo?: number
  tipoCompra?: string
  videoEstaticoAudio?: string
}

const CriativosLinkedIn: React.FC = () => {
  const { data: apiData, loading, error } = useCartaoLinkedInData()
  const { data: pontuacaoData, loading: pontuacaoLoading, error: pontuacaoError } = usePontuacaoLinkedInData()

  const [processedData, setProcessedData] = useState<CreativeData[]>([])
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: "", end: "" })
  const [selectedCampaign, setSelectedCampaign] = useState<string>("")
  const [availableCampaigns, setAvailableCampaigns] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10)
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc")

  // New filters state
  const [selectedTipoCompra, setSelectedTipoCompra] = useState<string>("")
  const [availableTiposCompra, setAvailableTiposCompra] = useState<string[]>([])
  const [selectedVideoEstaticoAudio, setSelectedVideoEstaticoAudio] = useState<string>("")
  const [availableVideoEstaticoAudio, setAvailableVideoEstaticoAudio] = useState<string[]>([])

  // Processar dados da API
  useEffect(() => {
    if (apiData?.values && pontuacaoData?.values) {
      const pontuacaoHeaders = pontuacaoData.values[0]
      const pontuacaoRows = pontuacaoData.values.slice(1)
      const pontuacaoMap = new Map<string, any>()
      pontuacaoRows.forEach((row: string[]) => {
        const creativeTitle = row[pontuacaoHeaders.indexOf("Creative title")]
        if (creativeTitle) {
          pontuacaoMap.set(creativeTitle.trim(), {
            pontuacao: Number.parseFloat(
              row[pontuacaoHeaders.indexOf("Pontuacao de criativo")]?.replace(",", ".") || "0",
            ),
            tipoCompra: row[pontuacaoHeaders.indexOf("Tipo de Compra")],
            videoEstaticoAudio: row[pontuacaoHeaders.indexOf("video_estatico_audio")],
          })
        }
      })

      const headers = apiData.values[0]
      const rows = apiData.values.slice(1)

      const tiposCompraSet = new Set<string>()
      const videoEstaticoAudioSet = new Set<string>()

      const processed: CreativeData[] = rows
        .map((row: string[]) => {
          const parseNumber = (value: string) => {
            if (!value || value === "") return 0
            return Number.parseFloat(value.replace(/[R$\s.]/g, "").replace(",", ".")) || 0
          }

          const parseInteger = (value: string) => {
            if (!value || value === "") return 0
            return Number.parseInt(value.replace(/[.\s]/g, "").replace(",", "")) || 0
          }

          const creativeTitle = row[headers.indexOf("Creative Direct Sponsored Content name")]?.trim() || ""
          const scoreData = pontuacaoMap.get(creativeTitle)

          if (scoreData?.tipoCompra) tiposCompraSet.add(scoreData.tipoCompra)
          if (scoreData?.videoEstaticoAudio) videoEstaticoAudioSet.add(scoreData.videoEstaticoAudio)

          return {
            date: row[headers.indexOf("Date")] || "",
            accountName: row[headers.indexOf("Account name")] || "",
            campaignGroupName: row[headers.indexOf("Campaign group name")] || "",
            campaignName: row[headers.indexOf("Campaign name")] || "",
            creativeTitle,
            creativeText: row[headers.indexOf("Creative text")] || "",
            creativeThumbnail: row[headers.indexOf("Creative thumbnail")] || "",
            creativeThumbnailUrl: row[headers.indexOf("Creative thumbnail URL")] || "",
            reach: parseInteger(row[headers.indexOf("Reach")]),
            impressions: parseInteger(row[headers.indexOf("Impressions")]),
            clicks: parseInteger(row[headers.indexOf("Clicks")]),
            totalSpent: parseNumber(row[headers.indexOf("Total spent")]),
            videoViews: parseInteger(row[headers.indexOf("Video views ")]),
            videoViews25: parseInteger(row[headers.indexOf("Video views at 25%")]),
            videoViews50: parseInteger(row[headers.indexOf("Video views at 50%")]),
            videoViews75: parseInteger(row[headers.indexOf("Video views at 75%")]),
            videoCompletions: parseInteger(row[headers.indexOf("Video completions ")]),
            videoStarts: parseInteger(row[headers.indexOf("Video starts")]),
            totalEngagements: parseInteger(row[headers.indexOf("Total engagements")]),
            pontuacaoCriativo: scoreData?.pontuacao,
            tipoCompra: scoreData?.tipoCompra,
            videoEstaticoAudio: scoreData?.videoEstaticoAudio,
          } as CreativeData
        })
        .filter((item: CreativeData) => item.date && item.impressions > 0)

      setProcessedData(processed)
      setAvailableTiposCompra(Array.from(tiposCompraSet))
      setAvailableVideoEstaticoAudio(Array.from(videoEstaticoAudioSet))

      if (processed.length > 0) {
        const dates = processed.map((item) => new Date(item.date)).sort((a, b) => a.getTime() - b.getTime())
        const startDate = dates[0].toISOString().split("T")[0]
        const endDate = dates[dates.length - 1].toISOString().split("T")[0]
        setDateRange({ start: startDate, end: endDate })
      }

      const campaignSet = new Set<string>()
      processed.forEach((item) => {
        if (item.campaignName) {
          campaignSet.add(item.campaignName)
        }
      })
      setAvailableCampaigns(Array.from(campaignSet).filter(Boolean))
    }
  }, [apiData, pontuacaoData])

  // Filtrar dados
  const filteredData = useMemo(() => {
    let filtered = processedData

    if (dateRange.start && dateRange.end) {
      filtered = filtered.filter((item) => {
        const itemDate = new Date(item.date)
        const startDate = new Date(dateRange.start)
        const endDate = new Date(dateRange.end)
        return itemDate >= startDate && itemDate <= endDate
      })
    }

    if (selectedCampaign) {
      filtered = filtered.filter((item) => item.campaignName.includes(selectedCampaign))
    }

    if (selectedTipoCompra) {
      filtered = filtered.filter((item) => item.tipoCompra === selectedTipoCompra)
    }

    if (selectedVideoEstaticoAudio) {
      filtered = filtered.filter((item) => item.videoEstaticoAudio === selectedVideoEstaticoAudio)
    }

    const groupedData: Record<string, CreativeData> = {}
    filtered.forEach((item) => {
      const key = `${item.creativeTitle}_${item.creativeThumbnailUrl}`
      if (!groupedData[key]) {
        groupedData[key] = { ...item }
      } else {
        groupedData[key].reach += item.reach
        groupedData[key].impressions += item.impressions
        groupedData[key].clicks += item.clicks
        groupedData[key].totalSpent += item.totalSpent
        groupedData[key].videoViews += item.videoViews
        groupedData[key].videoViews25 += item.videoViews25
        groupedData[key].videoViews50 += item.videoViews50
        groupedData[key].videoViews75 += item.videoViews75
        groupedData[key].videoCompletions += item.videoCompletions
        groupedData[key].videoStarts += item.videoStarts
        groupedData[key].totalEngagements += item.totalEngagements
      }
    })

    const finalData = Object.values(groupedData)
    finalData.sort((a, b) => {
      const scoreA = a.pontuacaoCriativo ?? -1
      const scoreB = b.pontuacaoCriativo ?? -1
      if (sortOrder === "desc") {
        return scoreB - scoreA
      }
      return scoreA - scoreB
    })

    return finalData
  }, [processedData, selectedCampaign, dateRange, selectedTipoCompra, selectedVideoEstaticoAudio, sortOrder])

  // Paginação
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return filteredData.slice(startIndex, endIndex)
  }, [filteredData, currentPage, itemsPerPage])

  const totalPages = Math.ceil(filteredData.length / itemsPerPage)

  // Calcular totais
  const totals = useMemo(() => {
    return {
      investment: filteredData.reduce((sum, item) => sum + item.totalSpent, 0),
      impressions: filteredData.reduce((sum, item) => sum + item.impressions, 0),
      reach: filteredData.reduce((sum, item) => sum + item.reach, 0),
      clicks: filteredData.reduce((sum, item) => sum + item.clicks, 0),
      totalEngagements: filteredData.reduce((sum, item) => sum + item.totalEngagements, 0),
      avgCpm: 0,
      avgCpc: 0,
      ctr: 0,
    }
  }, [filteredData])

  // Calcular médias
  if (filteredData.length > 0) {
    totals.avgCpm = totals.impressions > 0 ? totals.investment / (totals.impressions / 1000) : 0
    totals.avgCpc = totals.clicks > 0 ? totals.investment / totals.clicks : 0
    totals.ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0
  }

  // Função para formatar números
  const formatNumber = (value: number): string => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`
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

  // Função para truncar texto
  const truncateText = (text: string, maxLength: number): string => {
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength) + "..."
  }

  if (loading || pontuacaoLoading) {
    return <Loading message="Carregando criativos LinkedIn..." />
  }

  if (error || pontuacaoError) {
    return (
      <div className="bg-red-50/90 backdrop-blur-sm border border-red-200 rounded-lg p-4">
        <p className="text-red-600">Erro ao carregar dados: {error?.message || pontuacaoError?.message}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg flex items-center justify-center">
            <Linkedin className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 text-enhanced">Criativos LinkedIn</h1>
            <p className="text-gray-600">Performance dos criativos na plataforma LinkedIn</p>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-sm text-gray-600 bg-white/80 backdrop-blur-sm px-3 py-1 rounded-lg">
            Última atualização: {new Date().toLocaleString("pt-BR")}
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="card-overlay rounded-lg shadow-lg p-4">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Filtro de Data */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
              <Calendar className="w-4 h-4 mr-2" />
              Período
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

          {/* Filtro de Campanha */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
              <Filter className="w-4 h-4 mr-2" />
              Campanha
            </label>
            <select
              value={selectedCampaign}
              onChange={(e) => setSelectedCampaign(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="">Todas as campanhas</option>
              {availableCampaigns.map((campaign, index) => (
                <option key={index} value={campaign}>
                  {truncateText(campaign, 50)}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro Tipo de Compra */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
              <Filter className="w-4 h-4 mr-2" />
              Tipo de Compra
            </label>
            <select
              value={selectedTipoCompra}
              onChange={(e) => setSelectedTipoCompra(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="">Todos</option>
              {availableTiposCompra.map((tipo, index) => (
                <option key={index} value={tipo}>
                  {tipo}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro Formato */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
              <Filter className="w-4 h-4 mr-2" />
              Formato
            </label>
            <select
              value={selectedVideoEstaticoAudio}
              onChange={(e) => setSelectedVideoEstaticoAudio(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="">Todos</option>
              {availableVideoEstaticoAudio.map((formato, index) => (
                <option key={index} value={formato}>
                  {formato}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Métricas Principais */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
        <div className="card-overlay rounded-lg shadow-lg p-4 text-center">
          <div className="text-sm text-gray-600 mb-1">Investimento</div>
          <div className="text-lg font-bold text-gray-900">{formatCurrency(totals.investment)}</div>
        </div>

        <div className="card-overlay rounded-lg shadow-lg p-4 text-center">
          <div className="text-sm text-gray-600 mb-1">Impressões</div>
          <div className="text-lg font-bold text-gray-900">{formatNumber(totals.impressions)}</div>
        </div>

        <div className="card-overlay rounded-lg shadow-lg p-4 text-center">
          <div className="text-sm text-gray-600 mb-1">Alcance</div>
          <div className="text-lg font-bold text-gray-900">{formatNumber(totals.reach)}</div>
        </div>

        <div className="card-overlay rounded-lg shadow-lg p-4 text-center">
          <div className="text-sm text-gray-600 mb-1">Cliques</div>
          <div className="text-lg font-bold text-gray-900">{formatNumber(totals.clicks)}</div>
        </div>

        <div className="card-overlay rounded-lg shadow-lg p-4 text-center">
          <div className="text-sm text-gray-600 mb-1">CPM</div>
          <div className="text-lg font-bold text-gray-900">{formatCurrency(totals.avgCpm)}</div>
        </div>

        <div className="card-overlay rounded-lg shadow-lg p-4 text-center">
          <div className="text-sm text-gray-600 mb-1">CPC</div>
          <div className="text-lg font-bold text-gray-900">{formatCurrency(totals.avgCpc)}</div>
        </div>

        <div className="card-overlay rounded-lg shadow-lg p-4 text-center">
          <div className="text-sm text-gray-600 mb-1">CTR</div>
          <div className="text-lg font-bold text-gray-900">{totals.ctr.toFixed(2)}%</div>
        </div>

        <div className="card-overlay rounded-lg shadow-lg p-4 text-center">
          <div className="text-sm text-gray-600 mb-1">Engajamentos</div>
          <div className="text-lg font-bold text-gray-900">{formatNumber(totals.totalEngagements)}</div>
        </div>
      </div>

      {/* Tabela de Criativos */}
      <div className="flex-1 card-overlay rounded-lg shadow-lg p-6">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-blue-600 text-white">
                <th className="text-left py-3 px-4 font-semibold w-[5rem]">Imagem</th>
                <th className="text-left py-3 px-4 font-semibold">Criativo</th>
                <th className="text-right py-3 px-4 font-semibold min-w-[7.5rem]">Investimento</th>
                <th className="text-right py-3 px-4 font-semibold min-w-[7.5rem]">Impressões</th>
                <th className="text-right py-3 px-4 font-semibold min-w-[7.5rem]">Cliques</th>
                <th className="text-right py-3 px-4 font-semibold min-w-[7.5rem]">CTR</th>
                <th className="text-right py-3 px-4 font-semibold min-w-[7.5rem]">Tipo Compra</th>
                <th className="text-right py-3 px-4 font-semibold min-w-[7.5rem]">Formato</th>
                <th
                  className="text-right py-3 px-4 font-semibold min-w-[7.5rem] cursor-pointer"
                  onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                >
                  <div className="flex items-center justify-end">
                    Pontuação
                    <ArrowUpDown className="w-4 h-4 ml-2" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((creative, index) => {
                const ctr = creative.impressions > 0 ? (creative.clicks / creative.impressions) * 100 : 0

                return (
                  <tr key={index} className={index % 2 === 0 ? "bg-blue-50" : "bg-white"}>
                    <td className="py-3 px-4 w-[5rem]">
                      <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
                        {creative.creativeThumbnailUrl ? (
                          <img
                            src={creative.creativeThumbnailUrl || "/placeholder.svg"}
                            alt="Criativo"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement
                              target.style.display = "none"
                              if (target.parentElement) {
                                target.parentElement.innerHTML = '<div class="text-gray-400 text-xs">Sem imagem</div>'
                              }
                            }}
                          />
                        ) : (
                          <div className="text-gray-400 text-xs">Sem imagem</div>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium text-gray-900 text-sm leading-tight whitespace-normal break-words">
                          {creative.creativeTitle}
                        </p>
                        <p className="text-xs text-gray-500 mt-1 leading-tight whitespace-normal break-words">
                          {creative.campaignName}
                        </p>
                        {creative.creativeText && (
                          <p className="text-xs text-gray-400 mt-1 leading-tight whitespace-normal break-words">
                            {truncateText(creative.creativeText, 100)}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-semibold min-w-[7.5rem]">
                      {formatCurrency(creative.totalSpent)}
                    </td>
                    <td className="py-3 px-4 text-right min-w-[7.5rem]">{formatNumber(creative.impressions)}</td>
                    <td className="py-3 px-4 text-right min-w-[7.5rem]">{formatNumber(creative.clicks)}</td>
                    <td className="py-3 px-4 text-right min-w-[7.5rem]">{ctr.toFixed(2)}%</td>
                    <td className="py-3 px-4 text-right min-w-[7.5rem]">{creative.tipoCompra || "-"}</td>
                    <td className="py-3 px-4 text-right min-w-[7.5rem]">{creative.videoEstaticoAudio || "-"}</td>
                    <td className="py-3 px-4 text-right min-w-[7.5rem] font-bold">
                      {creative.pontuacaoCriativo?.toFixed(2) ?? "-"}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        <div className="flex items-center justify-between mt-6">
          <div className="text-sm text-gray-500">
            Mostrando {(currentPage - 1) * itemsPerPage + 1} -{" "}
            {Math.min(currentPage * itemsPerPage, filteredData.length)} de {filteredData.length} criativos
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Anterior
            </button>
            <span className="px-3 py-1 text-sm text-gray-600">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Próximo
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CriativosLinkedIn

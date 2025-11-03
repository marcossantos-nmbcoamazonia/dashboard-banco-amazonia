"use client"

import type React from "react"
import { useState, useEffect, useMemo } from "react"
import { Video, Calendar, Filter } from "lucide-react"
import { useCartaoKwaiData } from "../../services/api"
import Loading from "../../components/Loading/Loading"

interface CreativeData {
  time: string
  campaignName: string
  adSetName: string
  creativeName: string
  cost: number
  impressions: number
  clicks: number
  videoPlaysComplete: number
  videoPlays3s: number
  videoPlays5s: number
  thruPlays: number
  totalEngagement: number
  newFollowers: number
  profileVisits: number
  comments: number
  shares: number
  likes: number
}

const CriativosKwai: React.FC = () => {
  const { data: apiData, loading, error } = useCartaoKwaiData()

  const [processedData, setProcessedData] = useState<CreativeData[]>([])
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: "", end: "" })
  const [selectedCampaign, setSelectedCampaign] = useState<string>("")
  const [availableCampaigns, setAvailableCampaigns] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10)
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc")

  // Processar dados da API
  useEffect(() => {
    if (apiData?.success && apiData?.data?.values) {
      const headers = apiData.data.values[0]
      const rows = apiData.data.values.slice(1)

      const parseNumber = (value: string) => {
        if (!value || value === "") return 0
        return Number.parseFloat(value.replace(/[R$\s.]/g, "").replace(",", ".")) || 0
      }

      const parseInteger = (value: string) => {
        if (!value || value === "") return 0
        return Number.parseInt(value.replace(/[.\s]/g, "").replace(",", "")) || 0
      }

      const processed: CreativeData[] = rows
        .map((row: string[]) => {
          return {
            time: row[headers.indexOf("Time")] || "",
            campaignName: row[headers.indexOf("Campaign name")] || "",
            adSetName: row[headers.indexOf("Ad Set Name")] || "",
            creativeName: row[headers.indexOf("Creative name")]?.trim() || "",
            cost: parseNumber(row[headers.indexOf("Cost(BRL)")]),
            impressions: parseInteger(row[headers.indexOf("Impression")]),
            clicks: parseInteger(row[headers.indexOf("Click")]),
            videoPlaysComplete: parseInteger(row[headers.indexOf("Counts of video played to its completion")]),
            videoPlays3s: parseInteger(row[headers.indexOf("3s Video Plays")]),
            videoPlays5s: parseInteger(row[headers.indexOf("5s Video Plays")]),
            thruPlays: parseInteger(row[headers.indexOf("ThruPlays")]),
            totalEngagement: parseInteger(row[headers.indexOf("Total Engagement")]),
            newFollowers: parseInteger(row[headers.indexOf("New Followers")]),
            profileVisits: parseInteger(row[headers.indexOf("Profile Visits")]),
            comments: parseInteger(row[headers.indexOf("Comments")]),
            shares: parseInteger(row[headers.indexOf("Shares")]),
            likes: parseInteger(row[headers.indexOf("Likes")]),
          } as CreativeData
        })
        .filter((item: CreativeData) => item.time && item.impressions > 0)

      setProcessedData(processed)

      if (processed.length > 0) {
        const dates = processed.map((item) => new Date(item.time)).sort((a, b) => a.getTime() - b.getTime())
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
  }, [apiData])

  // Filtrar dados
  const filteredData = useMemo(() => {
    let filtered = processedData

    if (dateRange.start && dateRange.end) {
      filtered = filtered.filter((item) => {
        const itemDate = new Date(item.time)
        const startDate = new Date(dateRange.start)
        const endDate = new Date(dateRange.end)
        return itemDate >= startDate && itemDate <= endDate
      })
    }

    if (selectedCampaign) {
      filtered = filtered.filter((item) => item.campaignName.includes(selectedCampaign))
    }

    const groupedData: Record<string, CreativeData> = {}
    filtered.forEach((item) => {
      const key = `${item.creativeName}_${item.adSetName}`
      if (!groupedData[key]) {
        groupedData[key] = { ...item }
      } else {
        groupedData[key].cost += item.cost
        groupedData[key].impressions += item.impressions
        groupedData[key].clicks += item.clicks
        groupedData[key].videoPlaysComplete += item.videoPlaysComplete
        groupedData[key].videoPlays3s += item.videoPlays3s
        groupedData[key].videoPlays5s += item.videoPlays5s
        groupedData[key].thruPlays += item.thruPlays
        groupedData[key].totalEngagement += item.totalEngagement
        groupedData[key].newFollowers += item.newFollowers
        groupedData[key].profileVisits += item.profileVisits
        groupedData[key].comments += item.comments
        groupedData[key].shares += item.shares
        groupedData[key].likes += item.likes
      }
    })

    const finalData = Object.values(groupedData)
    finalData.sort((a, b) => {
      if (sortOrder === "desc") {
        return b.cost - a.cost
      }
      return a.cost - b.cost
    })

    return finalData
  }, [processedData, selectedCampaign, dateRange, sortOrder])

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
      investment: filteredData.reduce((sum, item) => sum + item.cost, 0),
      impressions: filteredData.reduce((sum, item) => sum + item.impressions, 0),
      clicks: filteredData.reduce((sum, item) => sum + item.clicks, 0),
      totalEngagement: filteredData.reduce((sum, item) => sum + item.totalEngagement, 0),
      videoPlays3s: filteredData.reduce((sum, item) => sum + item.videoPlays3s, 0),
      thruPlays: filteredData.reduce((sum, item) => sum + item.thruPlays, 0),
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

  if (loading) {
    return <Loading message="Carregando criativos Kwai..." />
  }

  if (error) {
    return (
      <div className="bg-red-50/90 backdrop-blur-sm border border-red-200 rounded-lg p-4">
        <p className="text-red-600">Erro ao carregar dados: {error?.message}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-lg flex items-center justify-center">
            <Video className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 text-enhanced">Criativos Kwai</h1>
            <p className="text-gray-600">Performance dos criativos na plataforma Kwai</p>
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
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm"
              />
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm"
            >
              <option value="">Todas as campanhas</option>
              {availableCampaigns.map((campaign, index) => (
                <option key={index} value={campaign}>
                  {truncateText(campaign, 50)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Métricas Principais */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-9 gap-4">
        <div className="card-overlay rounded-lg shadow-lg p-4 text-center">
          <div className="text-sm text-gray-600 mb-1">Investimento</div>
          <div className="text-lg font-bold text-gray-900">{formatCurrency(totals.investment)}</div>
        </div>

        <div className="card-overlay rounded-lg shadow-lg p-4 text-center">
          <div className="text-sm text-gray-600 mb-1">Impressões</div>
          <div className="text-lg font-bold text-gray-900">{formatNumber(totals.impressions)}</div>
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
          <div className="text-lg font-bold text-gray-900">{formatNumber(totals.totalEngagement)}</div>
        </div>

        <div className="card-overlay rounded-lg shadow-lg p-4 text-center">
          <div className="text-sm text-gray-600 mb-1">Vídeos 3s</div>
          <div className="text-lg font-bold text-gray-900">{formatNumber(totals.videoPlays3s)}</div>
        </div>

        <div className="card-overlay rounded-lg shadow-lg p-4 text-center">
          <div className="text-sm text-gray-600 mb-1">ThruPlays</div>
          <div className="text-lg font-bold text-gray-900">{formatNumber(totals.thruPlays)}</div>
        </div>
      </div>

      {/* Tabela de Criativos */}
      <div className="flex-1 card-overlay rounded-lg shadow-lg p-6">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-yellow-500 text-white">
                <th className="text-left py-3 px-4 font-semibold">Criativo</th>
                <th className="text-right py-3 px-4 font-semibold min-w-[7.5rem]">Investimento</th>
                <th className="text-right py-3 px-4 font-semibold min-w-[7.5rem]">Impressões</th>
                <th className="text-right py-3 px-4 font-semibold min-w-[7.5rem]">Cliques</th>
                <th className="text-right py-3 px-4 font-semibold min-w-[7.5rem]">CTR</th>
                <th className="text-right py-3 px-4 font-semibold min-w-[7.5rem]">Engajamento</th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((creative, index) => {
                const ctr = creative.impressions > 0 ? (creative.clicks / creative.impressions) * 100 : 0

                return (
                  <tr key={index} className={index % 2 === 0 ? "bg-yellow-50" : "bg-white"}>
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium text-gray-900 text-sm leading-tight whitespace-normal break-words">
                          {creative.creativeName}
                        </p>
                        <p className="text-xs text-gray-500 mt-1 leading-tight whitespace-normal break-words">
                          {creative.campaignName}
                        </p>
                        <p className="text-xs text-gray-400 mt-1 leading-tight whitespace-normal break-words">
                          {creative.adSetName}
                        </p>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-semibold min-w-[7.5rem]">
                      {formatCurrency(creative.cost)}
                    </td>
                    <td className="py-3 px-4 text-right min-w-[7.5rem]">{formatNumber(creative.impressions)}</td>
                    <td className="py-3 px-4 text-right min-w-[7.5rem]">{formatNumber(creative.clicks)}</td>
                    <td className="py-3 px-4 text-right min-w-[7.5rem]">{ctr.toFixed(2)}%</td>
                    <td className="py-3 px-4 text-right min-w-[7.5rem]">{formatNumber(creative.totalEngagement)}</td>
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

export default CriativosKwai

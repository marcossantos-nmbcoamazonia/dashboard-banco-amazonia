"use client"

import type React from "react"
import { useState, useEffect, useMemo } from "react"
import { Calendar, Filter, ArrowUpDown } from "lucide-react"
import { useGoogleAdsCreatives } from "../../services/consolidadoApi"
import Loading from "../../components/Loading/Loading"

interface CreativeData {
  date: string
  campaign: string
  adGroup: string
  ad: string
  impressions: number
  clicks: number
  cost: number
  videoViews: number
  videoViews25: number
  videoViews50: number
  videoViews75: number
  videoViews100: number
  engagements: number
  tipoCompra: string
  ctr: number
  cpc: number
  cpm: number
  vtr: number
}

const CriativosGoogleAds: React.FC = () => {
  const { data: apiData, loading, error } = useGoogleAdsCreatives()

  const [processedData, setProcessedData] = useState<CreativeData[]>([])
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: "", end: "" })
  const [selectedCampaign, setSelectedCampaign] = useState<string>("")
  const [availableCampaigns, setAvailableCampaigns] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10)
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc")

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

      const dateIndex = headers.indexOf("Day")
      const campaignIndex = headers.indexOf("Campaign Name")
      const adGroupIndex = headers.indexOf("Ad Group Name")
      const adIndex = headers.indexOf("Ad Name")
      const impressionsIndex = headers.indexOf("Impressions")
      const clicksIndex = headers.indexOf("Clicks")
      const costIndex = headers.indexOf("Cost (Spend)")
      const videoViewsIndex = headers.indexOf("Video Views")
      const videoViews25Index = headers.indexOf("Video played to 25%")
      const videoViews50Index = headers.indexOf("Video played to 50%")
      const videoViews75Index = headers.indexOf("Video played to 75%")
      const videoViews100Index = headers.indexOf("Video played to 100%")
      const engagementsIndex = headers.indexOf("Engagements")
      const tipoCompraIndex = headers.indexOf("Tipo de Compra")

      const processed: CreativeData[] = rows
        .map((row: string[]) => {
          const impressions = parseInteger(row[impressionsIndex])
          const clicks = parseInteger(row[clicksIndex])
          const cost = parseNumber(row[costIndex])
          const videoViews = parseInteger(row[videoViewsIndex])

          return {
            date: row[dateIndex] || "",
            campaign: row[campaignIndex] || "",
            adGroup: row[adGroupIndex] || "",
            ad: row[adIndex] || "",
            impressions,
            clicks,
            cost,
            videoViews,
            videoViews25: parseInteger(row[videoViews25Index]),
            videoViews50: parseInteger(row[videoViews50Index]),
            videoViews75: parseInteger(row[videoViews75Index]),
            videoViews100: parseInteger(row[videoViews100Index]),
            engagements: parseInteger(row[engagementsIndex]),
            tipoCompra: row[tipoCompraIndex] || "",
            ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
            cpc: clicks > 0 ? cost / clicks : 0,
            cpm: impressions > 0 ? cost / (impressions / 1000) : 0,
            vtr: impressions > 0 ? (videoViews / impressions) * 100 : 0,
          } as CreativeData
        })
        .filter((item: CreativeData) => item.date && item.impressions > 0)

      setProcessedData(processed)

      if (processed.length > 0) {
        const dates = processed.map((item) => new Date(item.date)).sort((a, b) => a.getTime() - b.getTime())
        setDateRange({
          start: dates[0].toISOString().split("T")[0],
          end: dates[dates.length - 1].toISOString().split("T")[0],
        })
      }

      const campaignSet = new Set<string>()
      processed.forEach((item) => {
        if (item.campaign) campaignSet.add(item.campaign)
      })
      setAvailableCampaigns(Array.from(campaignSet).filter(Boolean))
    }
  }, [apiData])

  const filteredData = useMemo(() => {
    let filtered = processedData

    if (dateRange.start && dateRange.end) {
      filtered = filtered.filter((item) => {
        const itemDate = new Date(item.date)
        return itemDate >= new Date(dateRange.start) && itemDate <= new Date(dateRange.end)
      })
    }

    if (selectedCampaign) {
      filtered = filtered.filter((item) => item.campaign.includes(selectedCampaign))
    }

    const groupedData: Record<string, CreativeData> = {}
    filtered.forEach((item) => {
      const key = `${item.ad}_${item.campaign}_${item.adGroup}`
      if (!groupedData[key]) {
        groupedData[key] = { ...item }
      } else {
        groupedData[key].impressions += item.impressions
        groupedData[key].clicks += item.clicks
        groupedData[key].cost += item.cost
        groupedData[key].videoViews += item.videoViews
        groupedData[key].videoViews25 += item.videoViews25
        groupedData[key].videoViews50 += item.videoViews50
        groupedData[key].videoViews75 += item.videoViews75
        groupedData[key].videoViews100 += item.videoViews100
        groupedData[key].engagements += item.engagements
      }
    })

    const finalData = Object.values(groupedData).map((item) => ({
      ...item,
      cpm: item.impressions > 0 ? item.cost / (item.impressions / 1000) : 0,
      cpc: item.clicks > 0 ? item.cost / item.clicks : 0,
      ctr: item.impressions > 0 ? (item.clicks / item.impressions) * 100 : 0,
      vtr: item.impressions > 0 ? (item.videoViews / item.impressions) * 100 : 0,
    }))

    finalData.sort((a, b) => {
      if (sortOrder === "desc") {
        return b.cost - a.cost
      }
      return a.cost - b.cost
    })

    return finalData
  }, [processedData, selectedCampaign, dateRange, sortOrder])

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    return filteredData.slice(startIndex, startIndex + itemsPerPage)
  }, [filteredData, currentPage, itemsPerPage])

  const totalPages = Math.ceil(filteredData.length / itemsPerPage)

  const totals = useMemo(() => {
    return {
      investment: filteredData.reduce((sum, item) => sum + item.cost, 0),
      impressions: filteredData.reduce((sum, item) => sum + item.impressions, 0),
      clicks: filteredData.reduce((sum, item) => sum + item.clicks, 0),
      videoViews: filteredData.reduce((sum, item) => sum + item.videoViews, 0),
      avgCpm: 0,
      avgCpc: 0,
      ctr: 0,
      vtr: 0,
    }
  }, [filteredData])

  if (filteredData.length > 0) {
    totals.avgCpm = totals.impressions > 0 ? totals.investment / (totals.impressions / 1000) : 0
    totals.avgCpc = totals.clicks > 0 ? totals.investment / totals.clicks : 0
    totals.ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0
    totals.vtr = totals.impressions > 0 ? (totals.videoViews / totals.impressions) * 100 : 0
  }

  const formatNumber = (value: number): string => {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
    return value.toLocaleString("pt-BR")
  }

  const formatCurrency = (value: number): string =>
    value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

  const truncateText = (text: string, maxLength: number): string =>
    text.length > maxLength ? `${text.substring(0, maxLength)}...` : text

  if (loading) {
    return <Loading message="Carregando criativos Google Ads..." />
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
          <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-green-600 rounded-lg flex items-center justify-center">
            <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"/>
            </svg>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 text-enhanced">Criativos Google Ads</h1>
            <p className="text-gray-600">Performance dos criativos na plataforma Google Ads</p>
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
              />
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
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
          <div className="text-sm text-gray-600 mb-1">Cliques</div>
          <div className="text-lg font-bold text-gray-900">{formatNumber(totals.clicks)}</div>
        </div>

        <div className="card-overlay rounded-lg shadow-lg p-4 text-center">
          <div className="text-sm text-gray-600 mb-1">Video Views</div>
          <div className="text-lg font-bold text-gray-900">{formatNumber(totals.videoViews)}</div>
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
          <div className="text-sm text-gray-600 mb-1">VTR</div>
          <div className="text-lg font-bold text-gray-900">{totals.vtr.toFixed(2)}%</div>
        </div>
      </div>

      {/* Tabela de Criativos */}
      <div className="flex-1 card-overlay rounded-lg shadow-lg p-6">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-green-600 text-white">
                <th className="text-left py-3 px-4 font-semibold">Anúncio</th>
                <th className="text-right py-3 px-4 font-semibold min-w-[7.5rem]">Investimento</th>
                <th className="text-right py-3 px-4 font-semibold min-w-[7.5rem]">Impressões</th>
                <th className="text-right py-3 px-4 font-semibold min-w-[7.5rem]">Cliques</th>
                <th className="text-right py-3 px-4 font-semibold min-w-[7.5rem]">CTR</th>
                <th className="text-right py-3 px-4 font-semibold min-w-[7.5rem]">Video Views</th>
                <th className="text-right py-3 px-4 font-semibold min-w-[7.5rem]">VTR</th>
                <th className="text-right py-3 px-4 font-semibold min-w-[7.5rem]">Engajamentos</th>
                <th className="text-right py-3 px-4 font-semibold min-w-[7.5rem]">Tipo de Compra</th>
                <th
                  className="text-right py-3 px-4 font-semibold min-w-[7.5rem] cursor-pointer"
                  onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                >
                  <div className="flex items-center justify-end">
                    Custo
                    <ArrowUpDown className="w-4 h-4 ml-2" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((creative, index) => {
                return (
                  <tr key={index} className={index % 2 === 0 ? "bg-green-50" : "bg-white"}>
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium text-gray-900 text-sm leading-tight whitespace-normal break-words">
                          {creative.ad}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">{creative.campaign}</p>
                        <p className="text-xs text-gray-400 mt-1">{creative.adGroup}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-semibold min-w-[7.5rem]">
                      {formatCurrency(creative.cost)}
                    </td>
                    <td className="py-3 px-4 text-right min-w-[7.5rem]">{formatNumber(creative.impressions)}</td>
                    <td className="py-3 px-4 text-right min-w-[7.5rem]">{formatNumber(creative.clicks)}</td>
                    <td className="py-3 px-4 text-right min-w-[7.5rem]">{creative.ctr.toFixed(2)}%</td>
                    <td className="py-3 px-4 text-right min-w-[7.5rem]">{formatNumber(creative.videoViews)}</td>
                    <td className="py-3 px-4 text-right min-w-[7.5rem]">{creative.vtr.toFixed(2)}%</td>
                    <td className="py-3 px-4 text-right min-w-[7.5rem]">{formatNumber(creative.engagements)}</td>
                    <td className="py-3 px-4 text-right min-w-[7.5rem]">{creative.tipoCompra}</td>
                    <td className="py-3 px-4 text-right min-w-[7.5rem] font-bold">
                      {formatCurrency(creative.cost)}
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
            {Math.min(currentPage * itemsPerPage, filteredData.length)} de {filteredData.length} anúncios
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

export default CriativosGoogleAds

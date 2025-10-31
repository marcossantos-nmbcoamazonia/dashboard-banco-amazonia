"use client"

import type React from "react"
import { useState, useEffect, useMemo } from "react"
import { Calendar, Filter, ArrowUpDown } from "lucide-react"
import { useCartaoPinterestData, usePinterestImageData, usePontuacaoPinterestData } from "../../services/api"
import Loading from "../../components/Loading/Loading"
import CreativeModal from "./components/CreativeModal"

interface CreativeData {
  date: string
  advertiserName: string
  campaignName: string
  adGroupName: string
  adId: string
  destinationUrl: string
  promotedPinName: string
  promotedPinStatus: string
  creativeType: string
  impressions: number
  reach: number
  frequency: number
  clicks: number
  ctr: number
  outboundClicks: number
  cpm: number
  cpc: number
  cost: number
  videoStartsPaid: number
  videoViewsPaid: number
  videoAvgWatchTime: number
  videoViews100Paid: number
  videoViews25Paid: number
  videoViews50Paid: number
  videoViews75Paid: number
  engagements: number
  mediaUrl?: string
  pontuacaoCriativo?: number
  tipoCompra?: string
  videoEstaticoAudio?: string
}

const getGoogleDriveEmbedLink = (url: string): string => {
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)\/view/)
  if (match && match[1]) {
    const fileId = match[1]
    return `https://drive.google.com/file/d/${fileId}/preview`
  }
  return url
}

const CriativosPinterest: React.FC = () => {
  const { data: apiData, loading: pinterestLoading, error: pinterestError } = useCartaoPinterestData()
  const { data: imageData, loading: imageLoading, error: imageError } = usePinterestImageData()
  const { data: pontuacaoData, loading: pontuacaoLoading, error: pontuacaoError } = usePontuacaoPinterestData()

  const [processedData, setProcessedData] = useState<CreativeData[]>([])
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: "", end: "" })
  const [selectedCampaign, setSelectedCampaign] = useState<string>("")
  const [availableCampaigns, setAvailableCampaigns] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10)
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc")

  const [selectedCreative, setSelectedCreative] = useState<CreativeData | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // New filters state
  const [selectedTipoCompra, setSelectedTipoCompra] = useState<string>("")
  const [availableTiposCompra, setAvailableTiposCompra] = useState<string[]>([])
  const [selectedVideoEstaticoAudio, setSelectedVideoEstaticoAudio] = useState<string>("")
  const [availableVideoEstaticoAudio, setAvailableVideoEstaticoAudio] = useState<string[]>([])

  const openCreativeModal = (creative: CreativeData) => {
    setSelectedCreative(creative)
    setIsModalOpen(true)
  }

  const closeCreativeModal = () => {
    setSelectedCreative(null)
    setIsModalOpen(false)
  }

  useEffect(() => {
    if (apiData?.values && imageData?.values && pontuacaoData?.values) {
      const mediaMap = new Map<string, string>()
      const imageHeaders = imageData.values[0]
      const adIdColIndex = imageHeaders.indexOf("Ad ID")
      const urlColIndex = imageHeaders.indexOf("URL")
      if (adIdColIndex !== -1 && urlColIndex !== -1) {
        const imageRows = imageData.values.slice(1)
        imageRows.forEach((row: string[]) => {
          const adIdRaw = row[adIdColIndex]
          const url = row[urlColIndex]
          if (adIdRaw && url) {
            const adIdToMap = adIdRaw.split("_")[0].trim()
            mediaMap.set(adIdToMap, getGoogleDriveEmbedLink(url))
          }
        })
      }

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
          const parseNumber = (value: string) => Number.parseFloat(value.replace(/[R$\s.]/g, "").replace(",", ".")) || 0
          const parseInteger = (value: string) => Number.parseInt(value.replace(/[.\s]/g, "").replace(",", "")) || 0

          const promotedPinName = row[headers.indexOf("Promoted pin name")]?.trim() || ""
          const scoreData = pontuacaoMap.get(promotedPinName)

          if (scoreData?.tipoCompra) tiposCompraSet.add(scoreData.tipoCompra)
          if (scoreData?.videoEstaticoAudio) videoEstaticoAudioSet.add(scoreData.videoEstaticoAudio)

          const adId = row[headers.indexOf("Ad ID")]?.trim() || ""

          return {
            date: row[headers.indexOf("Date")] || "",
            advertiserName: row[headers.indexOf("Advertiser name")] || "",
            campaignName: row[headers.indexOf("Campaign name")] || "",
            adGroupName: row[headers.indexOf("Ad group name")] || "",
            adId,
            destinationUrl: row[headers.indexOf("Destination URL")] || "",
            promotedPinName,
            promotedPinStatus: row[headers.indexOf("Promoted pin status")] || "",
            creativeType: row[headers.indexOf("Creative type")] || "",
            impressions: parseInteger(row[headers.indexOf("Impressions")]),
            reach: parseInteger(row[headers.indexOf("Reach")]),
            frequency: parseNumber(row[headers.indexOf("Frequency")]),
            clicks: parseInteger(row[headers.indexOf("Clicks")]),
            ctr: parseNumber(row[headers.indexOf("CTR")]),
            outboundClicks: parseInteger(row[headers.indexOf("Outbound clicks")]),
            cpm: parseNumber(row[headers.indexOf("CPM")]),
            cpc: parseNumber(row[headers.indexOf("CPC")]),
            cost: parseNumber(row[headers.indexOf("Cost")]),
            videoStartsPaid: parseInteger(row[headers.indexOf("Video starts paid")]),
            videoViewsPaid: parseInteger(row[headers.indexOf("Video views paid")]),
            videoAvgWatchTime: parseNumber(row[headers.indexOf("Video avg. watch time (s) paid")]),
            videoViews100Paid: parseInteger(row[headers.indexOf("Video views at 100% paid")]),
            videoViews25Paid: parseInteger(row[headers.indexOf("Video views at 25% paid")]),
            videoViews50Paid: parseInteger(row[headers.indexOf("Video views at 50% paid")]),
            videoViews75Paid: parseInteger(row[headers.indexOf("Video views at 75% paid")]),
            engagements: parseInteger(row[headers.indexOf("Engagements")]),
            mediaUrl: mediaMap.get(adId),
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
        setDateRange({
          start: dates[0].toISOString().split("T")[0],
          end: dates[dates.length - 1].toISOString().split("T")[0],
        })
      }

      const campaignSet = new Set<string>()
      processed.forEach((item) => {
        if (item.campaignName) campaignSet.add(item.campaignName)
      })
      setAvailableCampaigns(Array.from(campaignSet).filter(Boolean))
    }
  }, [apiData, imageData, pontuacaoData])

  const filteredData = useMemo(() => {
    let filtered = processedData

    if (dateRange.start && dateRange.end) {
      filtered = filtered.filter((item) => {
        const itemDate = new Date(item.date)
        return itemDate >= new Date(dateRange.start) && itemDate <= new Date(dateRange.end)
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
      const key = `${item.promotedPinName}_${item.campaignName}`
      if (!groupedData[key]) {
        groupedData[key] = { ...item }
      } else {
        groupedData[key].impressions += item.impressions
        groupedData[key].reach += item.reach
        groupedData[key].clicks += item.clicks
        groupedData[key].cost += item.cost
        // ... sum other metrics
      }
    })

    const finalData = Object.values(groupedData).map((item) => ({
      ...item,
      cpm: item.impressions > 0 ? item.cost / (item.impressions / 1000) : 0,
      cpc: item.clicks > 0 ? item.cost / item.clicks : 0,
      ctr: item.impressions > 0 ? (item.clicks / item.impressions) * 100 : 0,
      frequency: item.reach > 0 ? item.impressions / item.reach : 0,
    }))

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

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    return filteredData.slice(startIndex, startIndex + itemsPerPage)
  }, [filteredData, currentPage, itemsPerPage])

  const totalPages = Math.ceil(filteredData.length / itemsPerPage)

  const totals = useMemo(() => {
    return {
      investment: filteredData.reduce((sum, item) => sum + item.cost, 0),
      impressions: filteredData.reduce((sum, item) => sum + item.impressions, 0),
      reach: filteredData.reduce((sum, item) => sum + item.reach, 0),
      clicks: filteredData.reduce((sum, item) => sum + item.clicks, 0),
      outboundClicks: filteredData.reduce((sum, item) => sum + item.outboundClicks, 0),
      engagements: filteredData.reduce((sum, item) => sum + item.engagements, 0),
      avgCpm: 0,
      avgCpc: 0,
      avgFrequency: 0,
      ctr: 0,
    }
  }, [filteredData])

  if (filteredData.length > 0) {
    totals.avgCpm = totals.impressions > 0 ? totals.investment / (totals.impressions / 1000) : 0
    totals.avgCpc = totals.clicks > 0 ? totals.investment / totals.clicks : 0
    totals.avgFrequency = totals.reach > 0 ? totals.impressions / totals.reach : 0
    totals.ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0
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

  if (pinterestLoading || imageLoading || pontuacaoLoading) {
    return <Loading message="Carregando criativos Pinterest..." />
  }

  if (pinterestError || imageError || pontuacaoError) {
    return (
      <div className="bg-red-50/90 backdrop-blur-sm border border-red-200 rounded-lg p-4">
        <p className="text-red-600">
          Erro ao carregar dados: {pinterestError?.message || imageError?.message || pontuacaoError?.message}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-r from-red-600 to-red-700 rounded-lg flex items-center justify-center">
            <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 19c-.721 0-1.418-.109-2.073-.312.286-.465.713-1.227.87-1.835l.437-1.664c.229.436.895.813 1.604.813 2.111 0 3.633-1.941 3.633-4.354 0-2.312-1.888-4.042-4.316-4.042-3.021 0-4.625 2.027-4.625 4.235 0 1.027.547 2.305 1.422 2.712.142.062.217.035.251-.097l.296-1.154c.038-.148.023-.196-.088-.322-.243-.275-.425-.713-.425-1.197 0-1.292.967-2.531 2.608-2.531 1.423 0 2.408.973 2.408 2.361 0 1.588-.632 2.713-1.425 2.713-.456 0-.796-.387-.687-.857l.313-1.228c.092-.366.277-1.495.277-1.854 0-.428-.229-.784-.706-.784-.559 0-1.006.577-1.006 1.35 0 .493.167.827.167.827s-.574 2.43-.675 2.85c-.128.538-.057 1.319-.03 1.742C5.867 18.06 2 15.414 2 12 2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
            </svg>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 text-enhanced">Criativos Pinterest</h1>
            <p className="text-gray-600">Performance dos criativos na plataforma Pinterest</p>
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
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
              />
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
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
          <div className="text-sm text-gray-600 mb-1">Cliques no Link</div>
          <div className="text-lg font-bold text-gray-900">{formatNumber(totals.outboundClicks)}</div>
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
          <div className="text-lg font-bold text-gray-900">{formatNumber(totals.engagements)}</div>
        </div>
      </div>

      {/* Tabela de Criativos */}
      <div className="flex-1 card-overlay rounded-lg shadow-lg p-6">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-red-600 text-white">
                <th className="text-left py-3 px-4 font-semibold">Mídia</th>
                <th className="text-left py-3 px-4 font-semibold">Pin</th>
                <th className="text-right py-3 px-4 font-semibold min-w-[7.5rem]">Investimento</th>
                <th className="text-right py-3 px-4 font-semibold min-w-[7.5rem]">Impressões</th>
                <th className="text-right py-3 px-4 font-semibold min-w-[7.5rem]">Cliques</th>
                <th className="text-right py-3 px-4 font-semibold min-w-[7.5rem]">CTR / VTR</th>
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
                return (
                  <tr key={index} className={index % 2 === 0 ? "bg-red-50" : "bg-white"}>
                    <td className="py-3 px-4 w-[100px] h-[100px]">
                      <div
                        className="w-full h-full flex items-center justify-center bg-gray-100 rounded-md cursor-pointer hover:bg-gray-200 transition-colors"
                        onClick={() => openCreativeModal(creative)}
                      >
                        {creative.mediaUrl ? (
                          <div className="w-full h-full rounded-md relative group">
                            <iframe
                              src={creative.mediaUrl}
                              className="w-full h-full rounded-md pointer-events-none"
                              frameBorder="0"
                              allow="autoplay"
                              sandbox="allow-scripts allow-same-origin"
                            />
                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 rounded-md flex items-center justify-center">
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-white bg-opacity-90 rounded-full p-2">
                                <svg
                                  className="w-6 h-6 text-gray-700"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"
                                  />
                                </svg>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-gray-400 text-center p-2">
                            <div>Sem mídia</div>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium text-gray-900 text-sm leading-tight whitespace-normal break-words">
                          {creative.promotedPinName}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">{creative.campaignName}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-semibold min-w-[7.5rem]">
                      {formatCurrency(creative.cost)}
                    </td>
                    <td className="py-3 px-4 text-right min-w-[7.5rem]">{formatNumber(creative.impressions)}</td>
                    <td className="py-3 px-4 text-right min-w-[7.5rem]">{formatNumber(creative.clicks)}</td>
                    <td className="py-3 px-4 text-right min-w-[7.5rem]">
                      {creative.videoEstaticoAudio?.toLowerCase().includes("video") ? (
                        <>
                          {creative.impressions > 0
                            ? ((creative.videoViews100Paid / creative.impressions) * 100).toFixed(2)
                            : "0.00"}
                          %<span className="text-xs text-gray-400 ml-1">VTR</span>
                        </>
                      ) : (
                        <>
                          {creative.ctr.toFixed(2)}%<span className="text-xs text-gray-400 ml-1">CTR</span>
                        </>
                      )}
                    </td>
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
            {Math.min(currentPage * itemsPerPage, filteredData.length)} de {filteredData.length} pins
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

      {/* Modal do Criativo */}
      <CreativeModal creative={selectedCreative} isOpen={isModalOpen} onClose={closeCreativeModal} />
    </div>
  )
}

export default CriativosPinterest

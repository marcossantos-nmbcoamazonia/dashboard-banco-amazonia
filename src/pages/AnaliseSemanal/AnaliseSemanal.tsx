"use client"

import type React from "react"
import { useState, useEffect, useMemo } from "react"
import { useData } from "../../contexts/DataContext"
import Loading from "../../components/Loading/Loading"
import AnaliseSemanalComponent from "../LinhaTempo/components/AnaliseSemanal"

interface DataPoint {
  date: string
  campaignName: string
  creativeTitle: string
  platform: string
  reach: number
  impressions: number
  clicks: number
  totalSpent: number
  videoViews: number
  videoViews25: number
  videoViews50: number
  videoViews75: number
  videoCompletions: number
  totalEngagements: number
  veiculo: string
  tipoCompra: string
}

const AnaliseSemanal: React.FC = () => {
  const { data: apiData, campaigns, loading, error } = useData()
  const [processedData, setProcessedData] = useState<DataPoint[]>([])

  // Cores para as plataformas
  const platformColors = useMemo<Record<string, string>>(
    () => ({
      Google: "#4285f4",
      Meta: "#0668E1",
      TikTok: "#ff0050",
      YouTube: "#ff0000",
      Kwai: "#ff6b35",
      "Globo.com": "#00a86b",
      Serasa: "#9b59b6",
      "Folha de SP": "#e91e63",
      Spotify: "#1DB954",
      LinkedIn: "#0077b5",
      Pinterest: "#bd081c",
      Default: "#6366f1",
    }),
    [],
  )

  // Processar dados da API
  useEffect(() => {
    if (apiData?.success && apiData?.data?.values) {
      const headers = apiData.data.values[0]
      const rows = apiData.data.values.slice(1)

      const parseNumber = (value: string | number) => {
        if (!value || value === "" || value === null || value === undefined) return 0
        const stringValue = value.toString()
        const cleanValue = stringValue
          .replace(/R\$\s*/g, "")
          .replace(/\./g, "")
          .replace(",", ".")
          .trim()
        const parsed = Number.parseFloat(cleanValue)
        return isNaN(parsed) ? 0 : parsed
      }

      const parseInteger = (value: string | number) => {
        if (!value || value === "" || value === null || value === undefined) return 0
        const stringValue = value.toString()
        const cleanValue = stringValue.replace(/\./g, "").trim()
        const parsed = Number.parseInt(cleanValue)
        return isNaN(parsed) ? 0 : parsed
      }

      const parseDate = (dateStr: string) => {
        if (!dateStr) return ""
        const parts = dateStr.split("/")
        if (parts.length !== 3) return ""
        const [day, month, year] = parts
        return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
      }

      const dateIndex = headers.indexOf("Date")
      const campaignNameIndex = headers.indexOf("Campanha")
      const creativeTitleIndex = headers.indexOf("Creative title")
      const reachIndex = headers.indexOf("Reach")
      const impressionsIndex = headers.indexOf("Impressions")
      const clicksIndex = headers.indexOf("Clicks")
      const totalSpentIndex = headers.indexOf("Total spent")
      const videoViewsIndex = headers.indexOf("Video views")
      const videoViews25Index = headers.indexOf("Video views at 25%")
      const videoViews50Index = headers.indexOf("Video views at 50%")
      const videoViews75Index = headers.indexOf("Video views at 75%")
      const videoCompletionsIndex = headers.indexOf("Video completions")
      const totalEngagementsIndex = headers.indexOf("Total engagements")
      const veiculoIndex = headers.indexOf("Veículo")
      const tipoCompraIndex = headers.indexOf("Tipo de Compra")

      const processed: DataPoint[] = rows
        .map((row: any[]) => {
          if (dateIndex === -1 || !row[dateIndex] || row[dateIndex] === "") {
            return null
          }

          const hasImpressions = row[impressionsIndex] && row[impressionsIndex] !== ""
          const hasSpent = row[totalSpentIndex] && row[totalSpentIndex] !== ""

          if (!hasImpressions && !hasSpent) {
            return null
          }

          const originalDate = row[dateIndex]
          const formattedDate = parseDate(originalDate)

          // Normalizar veículo
          let veiculo = row[veiculoIndex] || ""
          const veiculoLower = veiculo.toLowerCase()
          if (["audience network", "unknown", "threads", "messenger"].includes(veiculoLower)) {
            veiculo = "Meta"
          }

          return {
            date: formattedDate,
            campaignName: row[campaignNameIndex] || "",
            creativeTitle: row[creativeTitleIndex] || "",
            platform: veiculo,
            veiculo: veiculo,
            reach: parseInteger(row[reachIndex]),
            impressions: parseInteger(row[impressionsIndex]),
            clicks: parseInteger(row[clicksIndex]),
            totalSpent: parseNumber(row[totalSpentIndex]),
            videoViews: parseInteger(row[videoViewsIndex]),
            videoViews25: parseInteger(row[videoViews25Index]),
            videoViews50: parseInteger(row[videoViews50Index]),
            videoViews75: parseInteger(row[videoViews75Index]),
            videoCompletions: parseInteger(row[videoCompletionsIndex]),
            totalEngagements: parseInteger(row[totalEngagementsIndex]),
            tipoCompra: row[tipoCompraIndex] || "",
          }
        })
        .filter((item): item is DataPoint => item !== null && item.date !== "" && item.platform !== "")

      setProcessedData(processed)
    }
  }, [apiData])

  // Obter veículos únicos
  const availableVehicles = useMemo(() => {
    const vehicles = new Set(processedData.map((item) => item.platform))
    return Array.from(vehicles).sort()
  }, [processedData])

  if (loading) {
    return <Loading />
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-red-600 text-lg font-semibold">Erro ao carregar dados</p>
          <p className="text-gray-600 mt-2">{error.message}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 h-screen overflow-y-auto">
      <AnaliseSemanalComponent
        processedData={processedData}
        availableVehicles={availableVehicles}
        platformColors={platformColors}
        onBack={() => window.history.back()}
        campaigns={campaigns}
      />
    </div>
  )
}

export default AnaliseSemanal

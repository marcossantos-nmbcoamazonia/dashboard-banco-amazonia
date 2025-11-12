"use client"

import React, { useState } from "react"
import axios from "axios"

const API_BASE_URL = "https://nmbcoamazonia-api.vercel.app"

export const consolidadoApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
})

// Interceptor para tratamento de erros
consolidadoApi.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error("API Error:", error)
    return Promise.reject(error)
  },
)

// Interface para os dados consolidados
export interface ConsolidadoData {
  success: boolean
  data: {
    range: string
    majorDimension: string
    values: string[][]
  }
}

// Função para buscar dados consolidados da nova API
export const fetchConsolidadoGeral = async (): Promise<ConsolidadoData> => {
  try {
    const response = await consolidadoApi.get("/google/sheets/1R1ehp35FAxdP1vhI1rT-mIYw3h9fuatHMiS__5V6Yok/data?range=Consolidado")
    return response.data
  } catch (error) {
    console.error("Erro ao buscar dados consolidados gerais:", error)
    throw error
  }
}

// Função para buscar dados de criativos Meta
export const fetchMetaCreatives = async (): Promise<ConsolidadoData> => {
  try {
    const response = await consolidadoApi.get("/google/sheets/1R1ehp35FAxdP1vhI1rT-mIYw3h9fuatHMiS__5V6Yok/data?range=Meta%20-%20Teste")
    return response.data
  } catch (error) {
    console.error("Erro ao buscar dados de criativos Meta:", error)
    throw error
  }
}

// Função para buscar dados de criativos LinkedIn
export const fetchLinkedInCreatives = async (): Promise<ConsolidadoData> => {
  try {
    const response = await consolidadoApi.get("/google/sheets/1R1ehp35FAxdP1vhI1rT-mIYw3h9fuatHMiS__5V6Yok/data?range=LinkedIn")
    return response.data
  } catch (error) {
    console.error("Erro ao buscar dados de criativos LinkedIn:", error)
    throw error
  }
}

// Função para buscar dados de criativos Google Ads
export const fetchGoogleAdsCreatives = async (): Promise<ConsolidadoData> => {
  try {
    const response = await consolidadoApi.get("/google/sheets/1R1ehp35FAxdP1vhI1rT-mIYw3h9fuatHMiS__5V6Yok/data?range=Google%20ads")
    return response.data
  } catch (error) {
    console.error("Erro ao buscar dados de criativos Google Ads:", error)
    throw error
  }
}

// Função para buscar dados de criativos TikTok
export const fetchTikTokCreatives = async (): Promise<ConsolidadoData> => {
  try {
    const response = await consolidadoApi.get("/google/sheets/1R1ehp35FAxdP1vhI1rT-mIYw3h9fuatHMiS__5V6Yok/data?range=TikTok")
    return response.data
  } catch (error) {
    console.error("Erro ao buscar dados de criativos TikTok:", error)
    throw error
  }
}

// Função para buscar dados de veiculação off-line
export const fetchOfflineData = async (): Promise<ConsolidadoData> => {
  try {
    const response = await consolidadoApi.get("/google/sheets/1R1ehp35FAxdP1vhI1rT-mIYw3h9fuatHMiS__5V6Yok/data?range=Offline")
    return response.data
  } catch (error) {
    console.error("Erro ao buscar dados de veiculação off-line:", error)
    throw error
  }
}

// Interface para uma campanha processada
export interface Campaign {
  name: string
  isActive: boolean
  lastActivity: Date | null
  totalSpent: number
  impressions: number
  clicks: number
  videoViews: number
  engagements: number
  reach: number
}

// Interface para dados dos últimos 7 dias
export interface Last7DaysMetrics {
  date: string
  impressions: number
  clicks: number
  videoViews: number
  spent: number
}

// Função auxiliar para converter string brasileira de moeda para número
const parseBrazilianCurrency = (value: string): number => {
  if (!value || value === "0") return 0
  // Remove "R$", espaços e pontos de milhar, depois substitui vírgula por ponto
  return parseFloat(value.replace(/R\$\s?/g, '').replace(/\./g, '').replace(',', '.'))
}

// Função auxiliar para converter string de número brasileiro para número
const parseBrazilianNumber = (value: string): number => {
  if (!value || value === "0") return 0
  // Remove pontos de milhar e substitui vírgula por ponto
  return parseFloat(value.replace(/\./g, '').replace(',', '.'))
}

// Função para processar campanhas únicas e verificar status de atividade
export const processCampaigns = (data: ConsolidadoData): Campaign[] => {
  if (!data.success || !data.data.values || data.data.values.length < 2) {
    return []
  }

  const headers = data.data.values[0]
  const rows = data.data.values.slice(1)

  // Índices das colunas
  const dateIndex = headers.indexOf("Date")
  const campaignIndex = headers.indexOf("Campanha")
  const spentIndex = headers.indexOf("Total spent")
  const impressionsIndex = headers.indexOf("Impressions")
  const clicksIndex = headers.indexOf("Clicks")
  const videoViewsIndex = headers.indexOf("Video Views")
  const engagementsIndex = headers.indexOf("Engagements")
  const reachIndex = headers.indexOf("Reach")

  // Mapa para armazenar campanhas
  const campaignsMap = new Map<string, Campaign>()

  // Data de referência: 7 dias atrás a partir de hoje
  const today = new Date()
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(today.getDate() - 7)

  rows.forEach((row) => {
    const campaignName = row[campaignIndex]

    // Pular linhas sem nome de campanha
    if (!campaignName) return

    // Parsear a data (formato DD/MM/YYYY)
    const dateStr = row[dateIndex]
    let rowDate: Date | null = null

    if (dateStr) {
      const [day, month, year] = dateStr.split("/")
      // Criar data usando ano completo (2025, não 25)
      rowDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
    }

    // Parsear valores numéricos
    const spent = parseBrazilianCurrency(row[spentIndex] || "0")
    const impressions = parseBrazilianNumber(row[impressionsIndex] || "0")
    const clicks = parseBrazilianNumber(row[clicksIndex] || "0")
    const videoViews = parseBrazilianNumber(row[videoViewsIndex] || "0")
    const engagements = parseBrazilianNumber(row[engagementsIndex] || "0")
    const reach = parseBrazilianNumber(row[reachIndex] || "0")

    if (!campaignsMap.has(campaignName)) {
      // Criar nova campanha
      campaignsMap.set(campaignName, {
        name: campaignName,
        isActive: false,
        lastActivity: null,
        totalSpent: 0,
        impressions: 0,
        clicks: 0,
        videoViews: 0,
        engagements: 0,
        reach: 0,
      })
    }

    const campaign = campaignsMap.get(campaignName)!

    // Atualizar totais
    campaign.totalSpent += spent
    campaign.impressions += impressions
    campaign.clicks += clicks
    campaign.videoViews += videoViews
    campaign.engagements += engagements
    campaign.reach += reach

    // Verificar se está ativa (teve investimento e impressões nos últimos 7 dias)
    if (rowDate && rowDate >= sevenDaysAgo && rowDate <= today) {
      if (spent > 0 && impressions > 0) {
        campaign.isActive = true
      }
      // Atualizar última atividade
      if (!campaign.lastActivity || rowDate > campaign.lastActivity) {
        campaign.lastActivity = rowDate
      }
    }
  })

  // Converter para array e ordenar por data de última atividade (mais recente primeiro)
  return Array.from(campaignsMap.values()).sort((a, b) => {
    if (!a.lastActivity && !b.lastActivity) return 0
    if (!a.lastActivity) return 1
    if (!b.lastActivity) return -1
    return b.lastActivity.getTime() - a.lastActivity.getTime()
  })
}

// Função para obter métricas dos últimos 7 dias
export const getLast7DaysMetrics = (data: ConsolidadoData): Last7DaysMetrics[] => {
  if (!data.success || !data.data.values || data.data.values.length < 2) {
    return []
  }

  const headers = data.data.values[0]
  const rows = data.data.values.slice(1)

  const dateIndex = headers.indexOf("Date")
  const spentIndex = headers.indexOf("Total spent")
  const impressionsIndex = headers.indexOf("Impressions")
  const clicksIndex = headers.indexOf("Clicks")
  const videoViewsIndex = headers.indexOf("Video Views")

  // Data de referência: ontem (não hoje, para evitar dados parciais)
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  yesterday.setHours(0, 0, 0, 0)

  const sevenDaysAgo = new Date(yesterday)
  sevenDaysAgo.setDate(yesterday.getDate() - 6) // 7 dias incluindo ontem
  sevenDaysAgo.setHours(0, 0, 0, 0)

  // Mapa para agrupar métricas por data
  const metricsMap = new Map<string, Last7DaysMetrics>()

  rows.forEach((row) => {
    const dateStr = row[dateIndex]
    if (!dateStr) return

    // Parsear a data
    const [day, month, year] = dateStr.split("/")
    const rowDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
    rowDate.setHours(0, 0, 0, 0)

    // Filtrar apenas últimos 7 dias
    if (rowDate >= sevenDaysAgo && rowDate <= yesterday) {
      const dateKey = dateStr

      if (!metricsMap.has(dateKey)) {
        metricsMap.set(dateKey, {
          date: dateKey,
          impressions: 0,
          clicks: 0,
          videoViews: 0,
          spent: 0,
        })
      }

      const metrics = metricsMap.get(dateKey)!
      metrics.impressions += parseBrazilianNumber(row[impressionsIndex] || "0")
      metrics.clicks += parseBrazilianNumber(row[clicksIndex] || "0")
      metrics.videoViews += parseBrazilianNumber(row[videoViewsIndex] || "0")
      metrics.spent += parseBrazilianCurrency(row[spentIndex] || "0")
    }
  })

  // Converter para array e ordenar por data
  return Array.from(metricsMap.values()).sort((a, b) => {
    const [dayA, monthA, yearA] = a.date.split("/").map(Number)
    const [dayB, monthB, yearB] = b.date.split("/").map(Number)
    const dateA = new Date(yearA, monthA - 1, dayA)
    const dateB = new Date(yearB, monthB - 1, dayB)
    return dateA.getTime() - dateB.getTime()
  })
}

// Hook personalizado para usar os dados consolidados gerais
export const useConsolidadoGeral = () => {
  const [data, setData] = useState<ConsolidadoData | null>(null)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [last7Days, setLast7Days] = useState<Last7DaysMetrics[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<Error | null>(null)

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true)
      const result = await fetchConsolidadoGeral()
      setData(result)

      // Processar campanhas
      const processedCampaigns = processCampaigns(result)
      setCampaigns(processedCampaigns)

      // Processar métricas dos últimos 7 dias
      const metrics7Days = getLast7DaysMetrics(result)
      setLast7Days(metrics7Days)

      setError(null)
    } catch (err) {
      setError(err as Error)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadData()
  }, [loadData])

  return { data, campaigns, last7Days, loading, error, refetch: loadData }
}

// Hook para dados de criativos Meta
export const useMetaCreatives = () => {
  const [data, setData] = useState<ConsolidadoData | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<Error | null>(null)

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true)
      const result = await fetchMetaCreatives()
      setData(result)
      setError(null)
    } catch (err) {
      setError(err as Error)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadData()
  }, [loadData])

  return { data, loading, error, refetch: loadData }
}

// Hook para dados de criativos LinkedIn
export const useLinkedInCreatives = () => {
  const [data, setData] = useState<ConsolidadoData | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<Error | null>(null)

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true)
      const result = await fetchLinkedInCreatives()
      setData(result)
      setError(null)
    } catch (err) {
      setError(err as Error)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadData()
  }, [loadData])

  return { data, loading, error, refetch: loadData }
}

// Hook para dados de criativos Google Ads
export const useGoogleAdsCreatives = () => {
  const [data, setData] = useState<ConsolidadoData | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<Error | null>(null)

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true)
      const result = await fetchGoogleAdsCreatives()
      setData(result)
      setError(null)
    } catch (err) {
      setError(err as Error)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadData()
  }, [loadData])

  return { data, loading, error, refetch: loadData }
}

// Hook para dados de criativos TikTok
export const useTikTokCreatives = () => {
  const [data, setData] = useState<ConsolidadoData | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<Error | null>(null)

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true)
      const result = await fetchTikTokCreatives()
      setData(result)
      setError(null)
    } catch (err) {
      setError(err as Error)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadData()
  }, [loadData])

  return { data, loading, error, refetch: loadData }
}

// Função para buscar dados do Plano de Mídia
export const fetchPlanoMidia = async (): Promise<ConsolidadoData> => {
  try {
    const response = await consolidadoApi.get("/google/sheets/1R1ehp35FAxdP1vhI1rT-mIYw3h9fuatHMiS__5V6Yok/data?range=Plano")
    return response.data
  } catch (error) {
    console.error("Erro ao buscar dados do Plano de Mídia:", error)
    throw error
  }
}

// Hook para dados do Plano de Mídia
export const usePlanoMidia = () => {
  const [data, setData] = useState<ConsolidadoData | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<Error | null>(null)

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true)
      const result = await fetchPlanoMidia()
      setData(result)
      setError(null)
    } catch (err) {
      setError(err as Error)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadData()
  }, [loadData])

  return { data, loading, error, refetch: loadData }
}

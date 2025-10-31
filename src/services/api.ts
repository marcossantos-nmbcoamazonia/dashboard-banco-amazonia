"use client"

import React, { useState } from "react"
import axios from "axios"

const API_BASE_URL = "https://api-google-sheets-7zph.vercel.app"

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
})

// Interceptor para tratamento de erros
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error("API Error:", error)
    return Promise.reject(error)
  },
)

// Função para buscar dados consolidados dos cartões
export const fetchConsolidadoData = async () => {
  try {
    const response = await api.get("/cartao/consolidado")
    return response.data
  } catch (error) {
    console.error("Erro ao buscar dados consolidados:", error)
    throw error
  }
}

// Função para buscar dados do resumo dos cartões
export const fetchResumoData = async () => {
  try {
    const response = await api.get("/cartao/resumo")
    return response.data
  } catch (error) {
    console.error("Erro ao buscar dados do resumo:", error)
    throw error
  }
}

// NOVA FUNÇÃO para buscar dados off-line
export const fetchOfflineData = async () => {
  try {
    const response = await api.get("/cartao/off-line")
    return response.data
  } catch (error) {
    console.error("Erro ao buscar dados off-line:", error)
    throw error
  }
}

// NOVAS FUNÇÕES PARA OS CRIATIVOS
// Função para buscar dados do Meta
export const fetchCartaoMetaData = async () => {
  try {
    const response = await api.get("/cartao/meta")
    return response.data
  } catch (error) {
    console.error("Erro ao buscar dados do Meta:", error)
    throw error
  }
}

// Função para buscar dados do TikTok
export const fetchCartaoTikTokData = async () => {
  try {
    const response = await api.get("/cartao/tiktok")
    return response.data
  } catch (error) {
    console.error("Erro ao buscar dados do TikTok:", error)
    throw error
  }
}

// Função para buscar dados do Pinterest
export const fetchCartaoPinterestData = async () => {
  try {
    const response = await api.get("/cartao/pinterest")
    return response.data
  } catch (error) {
    console.error("Erro ao buscar dados do Pinterest:", error)
    throw error
  }
}

// Função para buscar dados do LinkedIn
export const fetchCartaoLinkedInData = async () => {
  try {
    const response = await api.get("/cartao/linkedin")
    return response.data
  } catch (error) {
    console.error("Erro ao buscar dados do LinkedIn:", error)
    throw error
  }
}

// NOVAS FUNÇÕES PARA PONTUAÇÃO
export const fetchPontuacaoTikTokData = async () => {
  try {
    const response = await api.get("/cartao/pontuacao/tiktok")
    return response.data
  } catch (error) {
    console.error("Erro ao buscar dados de pontuação do TikTok:", error)
    throw error
  }
}

export const fetchPontuacaoMetaData = async () => {
  try {
    const response = await api.get("/cartao/pontuacao/meta")
    return response.data
  } catch (error) {
    console.error("Erro ao buscar dados de pontuação do Meta:", error)
    throw error
  }
}

export const fetchPontuacaoPinterestData = async () => {
  try {
    const response = await api.get("/cartao/pontuacao/pinterest")
    return response.data
  } catch (error) {
    console.error("Erro ao buscar dados de pontuação do Pinterest:", error)
    throw error
  }
}

export const fetchPontuacaoLinkedInData = async () => {
  try {
    const response = await api.get("/cartao/pontuacao/linkedin")
    return response.data
  } catch (error) {
    console.error("Erro ao buscar dados de pontuação do LinkedIn:", error)
    throw error
  }
}

// Função para buscar dados do CCBB (manter compatibilidade)
export const fetchCCBBData = async () => {
  try {
    const response = await api.get("/ccbb")
    return response.data
  } catch (error) {
    console.error("Erro ao buscar dados do CCBB:", error)
    throw error
  }
}

// Função para buscar dados do Share CCBB
export const fetchShareCCBBData = async () => {
  try {
    const response = await api.get("/ShareCcbb")
    return response.data
  } catch (error) {
    console.error("Erro ao buscar dados do Share CCBB:", error)
    throw error
  }
}

// Função para buscar dados do Meta CCBB
export const fetchMetaCCBBData = async () => {
  try {
    const response = await api.get("/ccbbMeta")
    return response.data
  } catch (error) {
    console.error("Erro ao buscar dados do Meta CCBB:", error)
    throw error
  }
}

// Hook personalizado para usar os dados consolidados
export const useConsolidadoData = () => {
  const [data, setData] = React.useState<any>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<Error | null>(null)

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true)
      const result = await fetchConsolidadoData()
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

// NOVO Hook personalizado para usar os dados off-line
export const useOfflineData = () => {
  const [data, setData] = React.useState<any>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<Error | null>(null)

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true)
      const result = await fetchOfflineData()
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

// Função para buscar dados do GA4 resumo (corrigida)
export const fetchGA4ResumoData = async () => {
  try {
    const response = await api.get("/cartao/ga4-resumo")
    return response.data
  } catch (error) {
    console.error("Erro ao buscar dados do GA4 resumo:", error)
    throw error
  }
}

// Função para buscar dados do GA4 completo
export const fetchGA4CompletoData = async () => {
  try {
    const response = await api.get("/cartao/ga4-completo")
    return response.data
  } catch (error) {
    console.error("Erro ao buscar dados do GA4 completo:", error)
    throw error
  }
}

// NOVA FUNÇÃO para buscar dados do GA4 Source
export const fetchGA4SourceData = async () => {
  try {
    const response = await api.get("/cartao/ga4-source")
    return response.data
  } catch (error) {
    console.error("Erro ao buscar dados do GA4 source:", error)
    throw error
  }
}

// Função para buscar dados de imagem do Pinterest
export const fetchPinterestImageData = async () => {
  try {
    const response = await api.get("/cartao/pinterest-imagem")
    return response.data
  } catch (error) {
    console.error("Erro ao buscar dados de imagem do Pinterest:", error)
    throw error
  }
}

// Hook personalizado para usar os dados do resumo
export const useResumoData = () => {
  const [data, setData] = React.useState<any>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<Error | null>(null)

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true)
      const result = await fetchResumoData()
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

// NOVOS HOOKS PARA OS CRIATIVOS
// Hook personalizado para usar os dados do Meta
export const useCartaoMetaData = () => {
  const [data, setData] = React.useState<any>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<Error | null>(null)

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true)
      const result = await fetchCartaoMetaData()
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

// Hook personalizado para usar os dados do TikTok
export const useCartaoTikTokData = () => {
  const [data, setData] = React.useState<any>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<Error | null>(null)

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true)
      const result = await fetchCartaoTikTokData()
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

// Hook personalizado para usar os dados do LinkedIn
export const useCartaoLinkedInData = () => {
  const [data, setData] = React.useState<any>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<Error | null>(null)

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true)
      const result = await fetchCartaoLinkedInData()
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

// NOVOS HOOKS PARA PONTUAÇÃO
const usePontuacaoData = (fetcher: () => Promise<any>) => {
  const [data, setData] = React.useState<any>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<Error | null>(null)

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true)
      const result = await fetcher()
      setData(result)
      setError(null)
    } catch (err) {
      setError(err as Error)
    } finally {
      setLoading(false)
    }
  }, [fetcher])

  React.useEffect(() => {
    loadData()
  }, [loadData])

  return { data, loading, error, refetch: loadData }
}

export const usePontuacaoTikTokData = () => usePontuacaoData(fetchPontuacaoTikTokData)
export const usePontuacaoMetaData = () => usePontuacaoData(fetchPontuacaoMetaData)
export const usePontuacaoPinterestData = () => usePontuacaoData(fetchPontuacaoPinterestData)
export const usePontuacaoLinkedInData = () => usePontuacaoData(fetchPontuacaoLinkedInData)

// Hook personalizado para usar os dados da API CCBB (manter compatibilidade)
export const useCCBBData = () => {
  const [data, setData] = React.useState<any>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<Error | null>(null)

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true)
      const result = await fetchCCBBData()
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

// Hook personalizado para usar os dados da API Share CCBB
export const useShareCCBBData = () => {
  const [data, setData] = React.useState<any>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<Error | null>(null)

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true)
      const result = await fetchShareCCBBData()
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

// Hook personalizado para usar os dados da API Meta CCBB
export const useMetaCCBBData = () => {
  const [data, setData] = React.useState<any>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<Error | null>(null)

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true)
      const result = await fetchMetaCCBBData()
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

// Hook combinado para usar ambas as APIs
export const useCombinedData = () => {
  const ccbbData = useCCBBData()
  const shareData = useShareCCBBData()

  const loading = ccbbData.loading || shareData.loading
  const error = ccbbData.error || shareData.error

  return {
    ccbbData: ccbbData.data,
    shareData: shareData.data,
    loading,
    error,
    refetch: () => {
      ccbbData.refetch()
      shareData.refetch()
    },
  }
}

// Tipos de dados para as APIs
interface GA4ResumoData {
  range: string
  majorDimension: string
  values: string[][]
}

interface GA4CompletoData {
  range: string
  majorDimension: string
  values: string[][]
}

interface GA4SourceData {
  range: string
  majorDimension: string
  values: string[][]
}

interface CartaoPinterestData {
  range: string
  majorDimension: string
  values: string[][]
}

interface PinterestImageData {
  range: string
  majorDimension: string
  values: string[][]
}

// Hook para dados GA4 Resumo (substituir completamente)
export const useGA4ResumoData = () => {
  const [data, setData] = useState<GA4ResumoData | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<Error | null>(null)

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true)
      const result = await fetchGA4ResumoData()
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

// Hook para dados GA4 Completo (substituir completamente)
export const useGA4CompletoData = () => {
  const [data, setData] = useState<GA4CompletoData | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<Error | null>(null)

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true)
      const result = await fetchGA4CompletoData()
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

// NOVO Hook para dados GA4 Source
export const useGA4SourceData = () => {
  const [data, setData] = useState<GA4SourceData | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<Error | null>(null)

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true)
      const result = await fetchGA4SourceData()
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

// Hook para dados do Pinterest (substituir completamente)
export const useCartaoPinterestData = () => {
  const [data, setData] = useState<CartaoPinterestData | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<Error | null>(null)

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true)
      const result = await fetchCartaoPinterestData()
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

// Hook para dados de Imagem do Pinterest (substituir completamente)
export const usePinterestImageData = () => {
  const [data, setData] = useState<PinterestImageData | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<Error | null>(null)

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true)
      const result = await fetchPinterestImageData()
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

// Função para buscar dados de benchmark
export const fetchBenchmarkData = async () => {
  try {
    const response = await api.get("/cartao/benchmark")
    return response.data
  } catch (error) {
    console.error("Erro ao buscar dados de benchmark:", error)
    throw error
  }
}

// Hook personalizado para usar os dados de benchmark
export const useBenchmarkData = () => {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<Error | null>(null)

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true)
      const result = await fetchBenchmarkData()
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

import axios from "axios"

const API_BASE = "https://nmbcoamazonia-api.vercel.app"

interface CacheResponse {
  analysis: string
  cached: boolean
  timestamp: string
}

export const getCachedAnalysis = async (dataKey: string): Promise<CacheResponse | null> => {
  try {
    const res = await axios.get(`${API_BASE}/analysis/cache`, {
      params: { dataKey },
      timeout: 5000,
    })
    // O backend responde 200 mesmo sem cache: {cached:false, message:"..."}.
    // Só é cache válido quando cached === true E há texto de análise; caso contrário
    // retornamos null para que o chamador gere uma nova análise e a salve no Redis.
    if (res.data?.cached && res.data?.analysis) return res.data
    return null
  } catch (err: any) {
    if (err?.response?.status === 404) return null
    // Fallback: tenta localStorage
    const today = new Date().toISOString().split("T")[0]
    const key = `analysis:${today}:${dataKey}`
    const cached = localStorage.getItem(key)
    const timestamp = localStorage.getItem(`${key}:ts`)
    if (cached) return { analysis: cached, cached: true, timestamp: timestamp ?? "" }
    return null
  }
}

export const setCachedAnalysis = async (dataKey: string, analysis: string): Promise<void> => {
  const timestamp = new Date().toISOString()
  try {
    await axios.post(`${API_BASE}/analysis/cache`, { dataKey, analysis }, { timeout: 5000 })
  } catch {
    // Fallback: salva no localStorage
    const today = new Date().toISOString().split("T")[0]
    const key = `analysis:${today}:${dataKey}`
    localStorage.setItem(key, analysis)
    localStorage.setItem(`${key}:ts`, timestamp)
  }
}

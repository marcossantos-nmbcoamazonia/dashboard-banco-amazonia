"use client"

import type React from "react"
import { useState, useMemo, useEffect, useCallback, memo } from "react"
import { TrendingUp, Calendar, Users, Clock, BarChart3, Target, UserPlus, Filter } from "lucide-react"
import Loading from "../../components/Loading/Loading"
import {
  useGA4Data,
  useGA4EstadosData,
  useGA4ConsolidadoData,
  useGA4EventData,
  useGA4PagesData,
  useGA4PagesEstadosData,
  useGA4PagesEventsData,
  useGA4PagesSourceData,
  useGA4PagesDispositivoData,
} from "../../services/api"
import BrazilMap from "../../components/BrazilMap/BrazilMap"

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
}
 
const TrafegoEngajamento: React.FC<TrafegoEngajamentoProps> = () => {
  const { data: ga4Data, loading: ga4Loading, error: ga4Error } = useGA4Data()
  const { data: ga4EstadosData, loading: estadosLoading, error: estadosError } = useGA4EstadosData()
  const { data: ga4ConsolidadoData, loading: consolidadoLoading, error: consolidadoError } = useGA4ConsolidadoData()
  const { data: ga4EventData, loading: eventLoading, error: eventError } = useGA4EventData()
  const { data: ga4PagesData, loading: pagesLoading, error: pagesError } = useGA4PagesData()

  // Novos dados filtrados por página
  const { data: ga4PagesEstadosData, loading: pagesEstadosLoading, error: pagesEstadosError } = useGA4PagesEstadosData()
  const { data: ga4PagesEventsData, loading: pagesEventsLoading, error: pagesEventsError } = useGA4PagesEventsData()
  const { data: ga4PagesSourceData } = useGA4PagesSourceData()
  const { data: ga4PagesDispositivoData } = useGA4PagesDispositivoData()

  // Estado para o filtro de página selecionada
  const [selectedPageTitle, setSelectedPageTitle] = useState<string | null>(null)

  // Calcular a primeira data dos dados e a última data disponível como padrão
  const getDefaultDateRange = useMemo(() => {
    let firstDate = ""
    let lastDate = ""

    // Procurar a primeira e última data em qualquer um dos datasets
    if (ga4Data?.data?.values && ga4Data.data.values.length > 1) {
      const headers = ga4Data.data.values[0]
      const dateIndex = headers.indexOf("Date")
      if (dateIndex !== -1) {
        const rows = ga4Data.data.values.slice(1)
        const dates = rows
          .map((row: any[]) => row[dateIndex])
          .filter((d: string) => d && d.trim() !== "")
          .sort()

        if (dates.length > 0) {
          firstDate = dates[0]
          lastDate = dates[dates.length - 1]
        }
      }
    }

    console.log("Default Date Range:", { firstDate, lastDate })

    return {
      start: firstDate || "2025-01-01",
      end: lastDate || "2025-12-31",
    }
  }, [ga4Data])

  const [dateRange, setDateRange] = useState<{ start: string; end: string }>(getDefaultDateRange)

  // Atualizar dateRange quando os dados carregarem
  useEffect(() => {
    if (getDefaultDateRange.start && getDefaultDateRange.end) {
      setDateRange(getDefaultDateRange)
    }
  }, [getDefaultDateRange])

  // Função para verificar se uma data está dentro do range selecionado
  const isDateInRange = useCallback((dateStr: string): boolean => {
    if (!dateStr || !dateRange.start || !dateRange.end) return true

    // Normalizar datas para YYYY-MM-DD
    const date = dateStr.includes("/")
      ? dateStr.split("/").reverse().join("-")
      : dateStr

    const result = date >= dateRange.start && date <= dateRange.end
    return result
  }, [dateRange])

  // Função para obter cor da plataforma/medium
  const getMediumColor = (medium: string): string => {
    const colors: { [key: string]: string } = {
      cpc: "#1877f2",
      organic: "#34a853",
      referral: "#8b5cf6",
      "(none)": "#6b7280",
      email: "#ea4335",
      social: "#ff0050",
    }
    return colors[medium] || "#9ca3af"
  }

  // Processamento dos dados do GA4 (Source, Medium, Campaign) - alterna entre geral e filtrado
  const processedGA4Data = useMemo(() => {
    let totalSessions = 0
    let totalViews = 0
    const mediumMap: { [key: string]: number } = {}
    const sourceMap: { [key: string]: number } = {}

    if (selectedPageTitle) {
      // IMPORTANTE: Quando filtrado, usar ga4PagesData para sessões/views totais
      // para manter consistência com o card "Páginas Mais Acessadas"
      if (ga4PagesData?.data?.values && ga4PagesData.data.values.length > 1) {
        const pagesHeaders = ga4PagesData.data.values[0]
        const pagesRows = ga4PagesData.data.values.slice(1)

        const pagesDateIndex = pagesHeaders.indexOf("Date")
        const pageTitleIndex = pagesHeaders.indexOf("Page title")
        const pagesSessionsIndex = pagesHeaders.indexOf("Sessions")
        const pagesViewsIndex = pagesHeaders.indexOf("Views")

        pagesRows.forEach((row: any[]) => {
          const date = row[pagesDateIndex] || ""
          if (!isDateInRange(date)) return

          const pageTitle = row[pageTitleIndex] || ""
          if (pageTitle !== selectedPageTitle) return

          const sessions = Number.parseInt(row[pagesSessionsIndex]) || 0
          const views = pagesViewsIndex !== -1 ? Number.parseInt(row[pagesViewsIndex]) || 0 : 0

          totalSessions += sessions
          totalViews += views
        })
      }

      // Usar ga4PagesSourceData apenas para breakdown de medium/source
      if (ga4PagesSourceData?.data?.values && ga4PagesSourceData.data.values.length > 1) {
        const sourceHeaders = ga4PagesSourceData.data.values[0]
        const sourceRows = ga4PagesSourceData.data.values.slice(1)

        const sourceDateIndex = sourceHeaders.indexOf("Date")
        const sourcePageTitleIndex = sourceHeaders.indexOf("Page title")
        const sourceSessionsIndex = sourceHeaders.indexOf("Sessions")
        const mediumIndex = sourceHeaders.indexOf("Session medium")
        const sourceIndex = sourceHeaders.indexOf("Session source")

        sourceRows.forEach((row: any[]) => {
          const date = row[sourceDateIndex] || ""
          if (!isDateInRange(date)) return

          const pageTitle = row[sourcePageTitleIndex] || ""
          if (pageTitle !== selectedPageTitle) return

          const sessions = Number.parseInt(row[sourceSessionsIndex]) || 0
          const medium = mediumIndex !== -1 ? row[mediumIndex] || "(not set)" : "(not set)"
          const source = sourceIndex !== -1 ? row[sourceIndex] || "(not set)" : "(not set)"

          if (sessions > 0) {
            mediumMap[medium] = (mediumMap[medium] || 0) + sessions
            sourceMap[source] = (sourceMap[source] || 0) + sessions
          }
        })
      }
    } else {
      // Quando não filtrado, usar ga4Data normalmente
      if (!ga4Data?.data?.values || ga4Data.data.values.length <= 1) {
        return {
          totalSessions: 0,
          totalViews: 0,
          mediumData: [],
          sourceData: [],
        }
      }

      const headers = ga4Data.data.values[0]
      const rows = ga4Data.data.values.slice(1)

      const dateIndex = headers.indexOf("Date")
      const sessionsIndex = headers.indexOf("Sessions")
      const viewsIndex = headers.indexOf("Views")
      const mediumIndex = headers.indexOf("Session medium")
      const sourceIndex = headers.indexOf("Session source")

      rows.forEach((row: any[]) => {
        const date = row[dateIndex] || ""
        if (!isDateInRange(date)) return

        const sessions = Number.parseInt(row[sessionsIndex]) || 0
        const views = viewsIndex !== -1 ? Number.parseInt(row[viewsIndex]) || 0 : 0
        const medium = mediumIndex !== -1 ? row[mediumIndex] || "(not set)" : "(not set)"
        const source = sourceIndex !== -1 ? row[sourceIndex] || "(not set)" : "(not set)"

        if (sessions > 0) {
          totalSessions += sessions
          totalViews += views
          mediumMap[medium] = (mediumMap[medium] || 0) + sessions
          sourceMap[source] = (sourceMap[source] || 0) + sessions
        }
      })
    }

    const mediumData = Object.entries(mediumMap)
      .map(([medium, sessions]) => ({
        medium,
        sessions,
        percentual: totalSessions > 0 ? (sessions / totalSessions) * 100 : 0,
        cor: getMediumColor(medium),
      }))
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 10)

    const sourceDataProcessed = Object.entries(sourceMap)
      .map(([source, sessions]) => ({
        source,
        sessions,
        percentual: totalSessions > 0 ? (sessions / totalSessions) * 100 : 0,
      }))
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 10)

    return {
      totalSessions,
      totalViews,
      mediumData,
      sourceData: sourceDataProcessed,
    }
  }, [ga4Data, ga4PagesData, ga4PagesSourceData, isDateInRange, selectedPageTitle])

  // Processamento dos dados de Estados (para o mapa) - alterna entre geral e filtrado por página
  const processedEstadosData = useMemo(() => {
    // Se uma página estiver selecionada, usar os dados filtrados
    const sourceData = selectedPageTitle ? ga4PagesEstadosData : ga4EstadosData

    if (!sourceData?.data?.values || sourceData.data.values.length <= 1) {
      return {}
    }

    const headers = sourceData.data.values[0]
    const rows = sourceData.data.values.slice(1)

    const dateIndex = headers.indexOf("Date")
    const regionIndex = headers.indexOf("Region")
    const sessionsIndex = headers.indexOf("Sessions")
    const pageTitleIndex = selectedPageTitle ? headers.indexOf("Page title") : -1

    const regionMap: { [key: string]: number } = {}

    rows.forEach((row: any[]) => {
      const date = row[dateIndex] || ""
      if (!isDateInRange(date)) return

      // Se página estiver selecionada, filtrar apenas os dados dessa página
      if (selectedPageTitle && pageTitleIndex !== -1) {
        const pageTitle = row[pageTitleIndex] || ""
        if (pageTitle !== selectedPageTitle) return
      }

      const region = row[regionIndex] || ""
      const sessions = Number.parseInt(row[sessionsIndex]) || 0

      if (sessions > 0 && region && region !== "(not set)" && region.trim() !== "") {
        const normalizedRegion = API_TO_GEOJSON_STATE_NAMES[region] || region
        if (normalizedRegion && normalizedRegion.trim() !== "") {
          regionMap[normalizedRegion] = (regionMap[normalizedRegion] || 0) + sessions
        }
      }
    })

    console.log("Region Data processado:", regionMap)
    return regionMap
  }, [ga4EstadosData, ga4PagesEstadosData, isDateInRange, selectedPageTitle])

  // Processamento dos dados Consolidados (dispositivos, novos usuários, etc.) - usa dados da página se filtrado
  const processedConsolidadoData = useMemo(() => {
    // Para dispositivos, usar API específica se página estiver selecionada
    const deviceSourceData = selectedPageTitle ? ga4PagesDispositivoData : ga4ConsolidadoData
    // Para outras métricas, usar ga4PagesData
    const metricsSourceData = selectedPageTitle ? ga4PagesData : ga4ConsolidadoData

    if (!deviceSourceData?.data?.values || deviceSourceData.data.values.length <= 1) {
      return {
        totalNewUsers: 0,
        avgDuration: "00:00:00",
        deviceData: [],
        totalEngagedSessions: 0,
      }
    }

    // Processar dispositivos
    const deviceHeaders = deviceSourceData.data.values[0]
    const deviceRows = deviceSourceData.data.values.slice(1)

    const deviceDateIndex = deviceHeaders.indexOf("Date")
    const deviceIndex = deviceHeaders.indexOf("Device category")
    const deviceSessionsIndex = deviceHeaders.indexOf("Sessions")
    const devicePageTitleIndex = selectedPageTitle ? deviceHeaders.indexOf("Page title") : -1

    let totalEngagedSessions = 0
    const deviceMap: { [key: string]: number } = {}

    deviceRows.forEach((row: any[]) => {
      const date = row[deviceDateIndex] || ""
      if (!isDateInRange(date)) return

      // Se página estiver selecionada, filtrar
      if (selectedPageTitle && devicePageTitleIndex !== -1) {
        const pageTitle = row[devicePageTitleIndex] || ""
        if (pageTitle !== selectedPageTitle) return
      }

      const device = deviceIndex !== -1 ? row[deviceIndex] || "outros" : "outros"
      const sessions = deviceSessionsIndex !== -1 ? Number.parseInt(row[deviceSessionsIndex]) || 0 : 0

      totalEngagedSessions += sessions
      const deviceKey = device || "outros"
      deviceMap[deviceKey] = (deviceMap[deviceKey] || 0) + sessions
    })

    const deviceData = Object.entries(deviceMap)
      .map(([tipo, sessoes]) => ({
        tipo,
        sessoes,
        percentual: totalEngagedSessions > 0 ? (sessoes / totalEngagedSessions) * 100 : 0,
        cor: tipo === "mobile" ? "#3b82f6" : tipo === "desktop" ? "#8b5cf6" : "#06b6d4",
      }))
      .sort((a, b) => b.sessoes - a.sessoes)

    // Processar outras métricas (new users, duration)
    let totalNewUsers = 0
    let totalDuration = 0
    let validRows = 0

    if (metricsSourceData?.data?.values && metricsSourceData.data.values.length > 1) {
      const metricsHeaders = metricsSourceData.data.values[0]
      const metricsRows = metricsSourceData.data.values.slice(1)

      const metricsDateIndex = metricsHeaders.indexOf("Date")
      const newUsersIndex = metricsHeaders.indexOf("New users")
      const avgDurationIndex = metricsHeaders.indexOf("Average session duration")
      const metricsPageTitleIndex = selectedPageTitle ? metricsHeaders.indexOf("Page title") : -1

      metricsRows.forEach((row: any[]) => {
        const date = row[metricsDateIndex] || ""
        if (!isDateInRange(date)) return

        // Se página estiver selecionada, filtrar
        if (selectedPageTitle && metricsPageTitleIndex !== -1) {
          const pageTitle = row[metricsPageTitleIndex] || ""
          if (pageTitle !== selectedPageTitle) return
        }

        const newUsers = newUsersIndex !== -1 ? Number.parseInt(row[newUsersIndex]) || 0 : 0
        const duration = avgDurationIndex !== -1 ? Number.parseFloat(row[avgDurationIndex]) || 0 : 0

        totalNewUsers += newUsers
        totalDuration += duration
        validRows++
      })
    }

    const avgDurationSec = validRows > 0 ? totalDuration / validRows : 0
    const hours = Math.floor(avgDurationSec / 3600)
    const minutes = Math.floor((avgDurationSec % 3600) / 60)
    const seconds = Math.floor(avgDurationSec % 60)
    const avgDuration = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`

    console.log("✅ Consolidado processado:", { totalNewUsers, avgDuration, devices: deviceData.length })

    return {
      totalNewUsers,
      avgDuration,
      deviceData,
      totalEngagedSessions,
    }
  }, [ga4ConsolidadoData, ga4PagesData, ga4PagesDispositivoData, isDateInRange, selectedPageTitle])

  // Processamento dos dados de Eventos - alterna entre geral e filtrado por página
  const processedEventData = useMemo(() => {
    // Se uma página estiver selecionada, usar os dados filtrados
    const sourceData = selectedPageTitle ? ga4PagesEventsData : ga4EventData

    if (!sourceData?.data?.values || sourceData.data.values.length <= 1) {
      return {
        totalConversions: 0,
        topEvents: [],
      }
    }

    const headers = sourceData.data.values[0]
    const rows = sourceData.data.values.slice(1)

    const dateIndex = headers.indexOf("Date")
    const eventNameIndex = headers.indexOf("Event name")
    const eventCountIndex = headers.indexOf("Event count")
    const conversionsIndex = headers.indexOf("Conversions")
    const pageTitleIndex = selectedPageTitle ? headers.indexOf("Page title") : -1

    let totalConversions = 0
    const eventMap: { [key: string]: number } = {}

    rows.forEach((row: any[]) => {
      const date = row[dateIndex] || ""
      if (!isDateInRange(date)) return

      // Se página estiver selecionada, filtrar apenas os dados dessa página
      if (selectedPageTitle && pageTitleIndex !== -1) {
        const pageTitle = row[pageTitleIndex] || ""
        if (pageTitle !== selectedPageTitle) return
      }

      const eventName = row[eventNameIndex] || "(not set)"
      const eventCount = Number.parseInt(row[eventCountIndex]) || 0
      const conversions = conversionsIndex !== -1 ? Number.parseInt(row[conversionsIndex]) || 0 : 0

      totalConversions += conversions
      eventMap[eventName] = (eventMap[eventName] || 0) + eventCount
    })

    const topEvents = Object.entries(eventMap)
      .map(([evento, count]) => ({
        evento,
        count,
        percentual: Object.values(eventMap).reduce((a, b) => a + b, 0) > 0
          ? (count / Object.values(eventMap).reduce((a, b) => a + b, 0)) * 100
          : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    return {
      totalConversions,
      topEvents,
    }
  }, [ga4EventData, ga4PagesEventsData, isDateInRange, selectedPageTitle])

  // Processamento dos dados de Páginas - não limita mais a quantidade quando há filtro de pesquisa
  const processedPagesData = useMemo(() => {
    if (!ga4PagesData?.data?.values || ga4PagesData.data.values.length <= 1) {
      return {
        topPages: [],
        allPages: [],
      }
    }

    const headers = ga4PagesData.data.values[0]
    const rows = ga4PagesData.data.values.slice(1)

    const dateIndex = headers.indexOf("Date")
    const pageTitleIndex = headers.indexOf("Page title")
    const sessionsIndex = headers.indexOf("Sessions")

    const pageMap: { [key: string]: number } = {}

    rows.forEach((row: any[]) => {
      const date = row[dateIndex] || ""
      if (!isDateInRange(date)) return

      const pageTitle = row[pageTitleIndex] || "(not set)"
      const sessions = Number.parseInt(row[sessionsIndex]) || 0

      if (sessions > 0) {
        pageMap[pageTitle] = (pageMap[pageTitle] || 0) + sessions
      }
    })

    const totalSessions = Object.values(pageMap).reduce((a, b) => a + b, 0)

    const allPages = Object.entries(pageMap)
      .map(([pagina, sessions]) => ({
        pagina,
        sessions,
        sessoes: sessions,
        percentual: totalSessions > 0 ? (sessions / totalSessions) * 100 : 0,
      }))
      .sort((a, b) => b.sessions - a.sessions)

    // Retornar top 10 para visualização padrão e todas para pesquisa
    return {
      topPages: allPages.slice(0, 10),
      allPages: allPages,
    }
  }, [ga4PagesData, isDateInRange])

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


  // Componente de gráfico de barras horizontais com tooltip
  const HorizontalBarChart: React.FC<{
    title: string
    data: Array<{
      categoria?: string
      tipo?: string
      medium?: string
      source?: string
      evento?: string
      pagina?: string
      sessions?: number
      sessoes?: number
      count?: number
      percentual: number
      cor?: string
    }>
    showValues?: boolean
    onItemClick?: (itemName: string) => void
    clickable?: boolean
    selectedItem?: string | null
    showSearch?: boolean
    enableScroll?: boolean
    maxHeight?: string
  }> = ({
    title,
    data,
    showValues = true,
    onItemClick,
    clickable = false,
    selectedItem = null,
    showSearch = false,
    enableScroll = false,
    maxHeight = "400px"
  }) => {
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
    const [localSearchInput, setLocalSearchInput] = useState<string>("")
    const [localSearchFilter, setLocalSearchFilter] = useState<string>("")

    // Filtrar dados com base na pesquisa
    const filteredData = useMemo(() => {
      if (localSearchFilter.trim() === "") return data

      const lowerSearch = localSearchFilter.toLowerCase()
      return data.filter(item => {
        const itemName = item.categoria || item.tipo || item.medium || item.source || item.evento || item.pagina || ""
        return itemName.toLowerCase().includes(lowerSearch)
      })
    }, [data, localSearchFilter])

    const handleSearch = () => {
      setLocalSearchFilter(localSearchInput)
    }

    const handleClear = () => {
      setLocalSearchInput("")
      setLocalSearchFilter("")
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        handleSearch()
      }
    }

    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>

        {/* Campo de pesquisa simples */}
        {showSearch && (
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={localSearchInput}
                onChange={(e) => setLocalSearchInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Pesquisar páginas..."
                className="w-full px-3 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
              <svg
                className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              Pesquisar
            </button>
            {localSearchInput && (
              <button
                onClick={handleClear}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium"
              >
                Limpar
              </button>
            )}
          </div>
        )}

        <div
          className={`space-y-3 ${enableScroll ? 'overflow-y-auto pr-2' : ''}`}
          style={enableScroll ? { maxHeight } : {}}
        >
          {filteredData.length === 0 && localSearchFilter.trim() !== "" ? (
            <div className="text-center py-4 text-gray-500 text-sm">
              Nenhuma página encontrada para "{localSearchFilter}"
            </div>
          ) : (
            filteredData.map((item, index) => {
              const itemName = item.categoria || item.tipo || item.medium || item.source || item.evento || item.pagina || ""
              const isSelected = selectedItem === itemName

            return (
              <div
                key={index}
                className={`space-y-1 relative p-2 rounded-lg transition-all duration-200 ${
                  isSelected ? 'bg-blue-50 border-2 border-blue-400 shadow-md' : 'border-2 border-transparent'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span
                    className={`text-sm font-medium ${
                      isSelected
                        ? 'text-blue-800 font-bold'
                        : clickable
                        ? 'text-blue-600 hover:text-blue-800 cursor-pointer hover:underline'
                        : 'text-gray-700'
                    } ${clickable ? 'cursor-pointer' : ''}`}
                    onClick={() => clickable && onItemClick && onItemClick(itemName)}
                  >
                    {isSelected && '✓ '}{itemName}
                  </span>
                  {showValues && (
                    <span className={`text-sm ${isSelected ? 'text-blue-900 font-semibold' : 'text-gray-600'}`}>
                      {formatNumber(item.sessions || item.sessoes || item.count || 0)} ({item.percentual.toFixed(1)}%)
                    </span>
                  )}
                </div>
                <div
                  className="w-full bg-gray-200 rounded-full h-3 relative cursor-pointer"
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  <div
                    className="h-3 rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(item.percentual, 100)}%`,
                      backgroundColor: isSelected ? '#1d4ed8' : (item.cor || "#6b7280"),
                      boxShadow: isSelected ? '0 0 10px rgba(29, 78, 216, 0.5)' : 'none',
                    }}
                  />
                  {hoveredIndex === index && (
                    <div className="absolute top-full mt-2 left-0 z-10 bg-gray-900 text-white text-xs rounded px-2 py-1 shadow-lg">
                      {itemName}: {formatNumber(item.sessions || item.sessoes || item.count || 0)}
                    </div>
                  )}
                </div>
              </div>
            )
          })
          )}
        </div>
      </div>
    )
  }

  // Função para obter cor de intensidade do mapa
  const getIntensityColor = (sessions: number): string => {
    const values = Object.values(processedEstadosData)
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
      return "#" + ((1 << 24) + (Math.round(r) << 16) + (Math.round(g) << 8) + Math.round(b)).toString(16).slice(1)
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
  }

  // Handler para quando clicar em um título de página
  const handlePageTitleClick = useCallback((pageTitle: string) => {
    setSelectedPageTitle(prev => prev === pageTitle ? null : pageTitle)
  }, [])

  if (ga4Loading || estadosLoading || consolidadoLoading || eventLoading || pagesLoading || pagesEstadosLoading || pagesEventsLoading) {
    return <Loading message="Carregando dados de tráfego e engajamento..." />
  }

  if (ga4Error || estadosError || consolidadoError || eventError || pagesError || pagesEstadosError || pagesEventsError) {
    return (
      <div className="p-6 text-center">
        <div className="text-red-500 mb-2">Erro ao carregar dados</div>
        <p className="text-gray-600">Não foi possível carregar os dados do GA4. Tente novamente.</p>
        {ga4Error && <p className="text-xs text-red-400">{ga4Error.message}</p>}
        {estadosError && <p className="text-xs text-red-400">{estadosError.message}</p>}
        {consolidadoError && <p className="text-xs text-red-400">{consolidadoError.message}</p>}
        {eventError && <p className="text-xs text-red-400">{eventError.message}</p>}
        {pagesError && <p className="text-xs text-red-400">{pagesError.message}</p>}
        {pagesEstadosError && <p className="text-xs text-red-400">{pagesEstadosError.message}</p>}
        {pagesEventsError && <p className="text-xs text-red-400">{pagesEventsError.message}</p>}
      </div>
    )
  }

  return (
    <div className="space-y-6 h-full flex flex-col">
      {/* Título e Subtítulo */}
      <div className="col-span-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-blue-600 rounded-lg flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Tráfego e Engajamento</h1>
            <p className="text-xs text-gray-600">Google Analytics 4 - Banco da Amazônia</p>
          </div>
        </div>

        {/* Indicador de filtro ativo */}
        {selectedPageTitle && (
          <div className="flex items-center space-x-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
            <Filter className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-900">
              Filtrado por: <span className="font-bold">{selectedPageTitle}</span>
            </span>
            <button
              onClick={() => setSelectedPageTitle(null)}
              className="ml-2 text-blue-600 hover:text-blue-800 font-bold text-lg"
              title="Remover filtro"
            >
              ×
            </button>
          </div>
        )}
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

          {/* Cards de Métricas - 5 cards ocupando 9 colunas */}
          <div className="col-span-9 grid grid-cols-5 gap-3">
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-green-600">Sessões</p>
                  <p className="text-lg font-bold text-green-900">
                    {formatNumber(processedGA4Data.totalSessions)}
                  </p>
                </div>
                <Users className="w-6 h-6 text-green-600" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-blue-600">Novos Usuários</p>
                  <p className="text-lg font-bold text-blue-900">
                    {formatNumber(processedConsolidadoData.totalNewUsers)}
                  </p>
                </div>
                <UserPlus className="w-6 h-6 text-blue-600" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-orange-600">Conversões</p>
                  <p className="text-lg font-bold text-orange-900">
                    {formatNumber(processedEventData.totalConversions)}
                  </p>
                </div>
                <Target className="w-6 h-6 text-orange-600" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-purple-600">Duração média</p>
                  <p className="text-lg font-bold text-purple-900">{processedConsolidadoData.avgDuration}</p>
                </div>
                <Clock className="w-6 h-6 text-purple-600" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-yellow-600">Visualizações</p>
                  <p className="text-lg font-bold text-yellow-900">{formatNumber(processedGA4Data.totalViews)}</p>
                </div>
                <BarChart3 className="w-6 h-6 text-yellow-600" />
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
        <div className="card-overlay rounded-lg shadow-lg p-6 col-span-full lg:col-span-1">
          <HorizontalBarChart
            title="Páginas Mais Acessadas (clique para filtrar)"
            data={processedPagesData.allPages}
            clickable={true}
            onItemClick={handlePageTitleClick}
            selectedItem={selectedPageTitle}
            showSearch={true}
            enableScroll={true}
            maxHeight="500px"
          />
        </div>
        
        

        {/* Source */}
        <div className="card-overlay rounded-lg shadow-lg p-6">
          <HorizontalBarChart title="Origem do Tráfego (Source)" data={processedGA4Data.sourceData} />
        </div>
        {/* Mapa de Calor */}
        <div className="card-overlay rounded-lg shadow-lg p-6">
          <BrazilMap regionData={processedEstadosData} getIntensityColor={getIntensityColor} />
        </div>
        

        {/* Top Eventos e Páginas Mais Acessadas */}
        <div className="card-overlay rounded-lg shadow-lg p-6 col-span-full lg:col-span-1">
          <HorizontalBarChart title="Top 10 Eventos com Maior Interação" data={processedEventData.topEvents} />
        </div>

        
        
        {/* Dispositivos */}
        <div className="card-overlay rounded-lg shadow-lg p-6">
          <HorizontalBarChart title="Dispositivos" data={processedConsolidadoData.deviceData} />
        </div>

        

      </div>

      {/* Observações */}
      <div className="card-overlay rounded-lg shadow-lg p-4">
        <p className="text-sm text-gray-600">
          <strong>Fontes:</strong> Google Analytics 4 via Google Sheets API. Os dados são atualizados automaticamente.
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

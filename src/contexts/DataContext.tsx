import React, { createContext, useContext, ReactNode } from "react"
import { useConsolidadoGeral, Campaign, Last7DaysMetrics, ConsolidadoData } from "../services/consolidadoApi"

interface DataContextType {
  // Dados brutos
  data: ConsolidadoData | null
  campaigns: Campaign[]
  last7Days: Last7DaysMetrics[]

  // Estados
  loading: boolean
  error: Error | null

  // Funções
  refetch: () => void
}

const DataContext = createContext<DataContextType | undefined>(undefined)

interface DataProviderProps {
  children: ReactNode
}

export const DataProvider: React.FC<DataProviderProps> = ({ children }) => {
  const { data, campaigns, last7Days, loading, error, refetch } = useConsolidadoGeral()

  const value: DataContextType = {
    data,
    campaigns,
    last7Days,
    loading,
    error,
    refetch,
  }

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export const useData = (): DataContextType => {
  const context = useContext(DataContext)
  if (context === undefined) {
    throw new Error("useData must be used within a DataProvider")
  }
  return context
}

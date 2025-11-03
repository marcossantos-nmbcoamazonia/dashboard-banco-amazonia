import type React from "react"
import { Construction } from "lucide-react"

const EstrategiaOnline: React.FC = () => {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="card-overlay rounded-lg shadow-lg p-8 max-w-md text-center">
        <Construction className="w-16 h-16 mx-auto mb-4 text-yellow-600" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Página em Manutenção</h1>
        <p className="text-gray-600">
          Esta página está passando por atualizações e estará disponível em breve.
        </p>
      </div>
    </div>
  )
}

export default EstrategiaOnline

/* CÓDIGO COMENTADO PARA AJUSTES FUTUROS

"use client"

import type React from "react"
import { useState, useEffect, useMemo } from "react"
import { Globe, BarChart3, Tv, Radio, Smartphone, Monitor, Volume2, Eye, Play, MousePointer, Users, Filter } from "lucide-react"
import { useResumoData, useGA4ResumoData } from "../../services/api"
import { useData } from "../../contexts/DataContext"
import Loading from "../../components/Loading/Loading"

interface VehicleData {
  veiculo: string
  dsp: string
  custoInvestido: number
  custoPrevisto: number
  mes: string
  pacing: number
  shareInvestido: number
  sharePrevisto: number
}

interface MonthlyTotals {
  mes: string
  totalInvestido: number
  totalPrevisto: number
  pacing: number
}

interface CampaignSummary {
  totalInvestimentoPrevisto: number
  totalCustoInvestido: number
  impressoesTotais: number
  cliquesTotais: number
  sessoesTotais: number
  vtr: number
}

interface AggregatedVehicleData {
  veiculo: string
  custoInvestido: number
  custoPrevisto: number
  pacing: number
  shareInvestido: number
  sharePrevisto: number
}

const EstrategiaOnline: React.FC = () => {
  const { data: resumoData, loading: resumoLoading, error: resumoError } = useResumoData()
  const { data: ga4Data, loading: ga4Loading, error: ga4Error } = useGA4ResumoData()
  const { data: consolidadoData, campaigns, loading: consolidadoLoading, error: consolidadoError } = useData()
  const [vehicleData, setVehicleData] = useState<VehicleData[]>([])
  const [monthlyTotals, setMonthlyTotals] = useState<MonthlyTotals[]>([])
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null)
  const [availableMonths, setAvailableMonths] = useState<string[]>([])
  const [campaignSummary, setCampaignSummary] = useState<CampaignSummary>({
    totalInvestimentoPrevisto: 0,
    totalCustoInvestido: 0,
    impressoesTotais: 0,
    cliquesTotais: 0,
    sessoesTotais: 0,
    vtr: 85,
  })

  const loading = resumoLoading || ga4Loading || consolidadoLoading
  const error = resumoError || ga4Error || consolidadoError

  // ... resto do código comentado para referência futura ...

  return <div>Código original comentado</div>
}

export default EstrategiaOnline

*/

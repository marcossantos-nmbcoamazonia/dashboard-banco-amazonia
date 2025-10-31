"use client"

import type React from "react"
import { useState, useMemo } from "react"
import { ChevronDown, ChevronRight, DollarSign, Users, Radio } from "lucide-react"
import { useOfflineData } from "../../services/api"
import Loading from "../../components/Loading/Loading"

// Interfaces para tipagem
interface MeioData {
  nome: string
  valorTotal: number
  impactosTotal: number
  pracas: { [key: string]: PracaData }
}

interface PracaData {
  nome: string
  valorTotal: number
  impactosTotal: number
  redes: { [key: string]: RedeData }
}

interface RedeData {
  nome: string
  valorTotal: number
  impactosTotal: number
  trpTotal: number
}

// Função para converter string de valor para número
const parseValor = (valor: string): number => {
  if (!valor || valor === "-" || valor === "") return 0
  const cleanValue = valor
    .replace(/R\$\s?/g, "")
    .replace(/\./g, "")
    .replace(/,/g, ".")
    .trim()
  const parsed = Number.parseFloat(cleanValue)
  return isNaN(parsed) ? 0 : parsed
}

// Função para converter string de número para número
const parseNumero = (numero: string): number => {
  if (!numero || numero === "-" || numero === "") return 0
  const cleanValue = numero.replace(/\./g, "").replace(/,/g, ".").trim()
  const parsed = Number.parseFloat(cleanValue)
  return isNaN(parsed) ? 0 : parsed
}

// Função para formatar valor em reais
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
}

// Função para formatar números
const formatNumber = (value: number): string => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return new Intl.NumberFormat("pt-BR").format(value)
}

const VeiculacaoOffline: React.FC = () => {
  const { data, loading, error } = useOfflineData()
  const [expandedMeios, setExpandedMeios] = useState<{ [key: string]: boolean }>({})
  const [expandedPracas, setExpandedPracas] = useState<{ [key: string]: boolean }>({})

  // Processar dados da API
  const processedData = useMemo(() => {
    if (!data?.values || data.values.length <= 1) return { meios: {}, totais: { valor: 0, impactos: 0 } }

    const meiosData: { [key: string]: MeioData } = {}
    let totalInvestimento = 0
    let totalImpactos = 0

    const rows = data.values.slice(1)

    rows.forEach((row: string[]) => {
      const meio = row[0] || ""
      const rede = row[1] || ""
      const praca = row[3] || ""
      const valorDesembolso = row[4] || "0"
      const trp = row[5] || "0"
      const impactos = row[6] || "0"

      if (!meio) return

      const valorNum = parseValor(valorDesembolso)
      const impactosNum = parseNumero(impactos)
      const trpNum = parseNumero(trp)

      totalInvestimento += valorNum
      totalImpactos += impactosNum

      if (!meiosData[meio]) {
        meiosData[meio] = { nome: meio, valorTotal: 0, impactosTotal: 0, pracas: {} }
      }
      if (!meiosData[meio].pracas[praca]) {
        meiosData[meio].pracas[praca] = { nome: praca, valorTotal: 0, impactosTotal: 0, redes: {} }
      }
      if (!meiosData[meio].pracas[praca].redes[rede]) {
        meiosData[meio].pracas[praca].redes[rede] = { nome: rede, valorTotal: 0, impactosTotal: 0, trpTotal: 0 }
      }

      meiosData[meio].valorTotal += valorNum
      meiosData[meio].impactosTotal += impactosNum
      meiosData[meio].pracas[praca].valorTotal += valorNum
      meiosData[meio].pracas[praca].impactosTotal += impactosNum
      meiosData[meio].pracas[praca].redes[rede].valorTotal += valorNum
      meiosData[meio].pracas[praca].redes[rede].impactosTotal += impactosNum
      meiosData[meio].pracas[praca].redes[rede].trpTotal += trpNum
    })

    return { meios: meiosData, totais: { valor: totalInvestimento, impactos: totalImpactos } }
  }, [data])

  const toggleMeio = (meio: string) => {
    setExpandedMeios((prev) => ({ ...prev, [meio]: !prev[meio] }))
  }

  const togglePraca = (meioNome: string, pracaNome: string) => {
    const key = `${meioNome}-${pracaNome}`
    setExpandedPracas((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  if (loading) {
    return <Loading message="Carregando dados de veiculação off-line..." />
  }

  if (error) {
    return (
      <div className="bg-red-50/90 backdrop-blur-sm border border-red-200 rounded-lg p-4">
        <p className="text-red-600">Erro ao carregar dados: {error.message}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-r from-gray-600 to-gray-800 rounded-lg flex items-center justify-center">
            <Radio className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 text-enhanced">Veiculação Off-line</h1>
            <p className="text-gray-600">Análise de investimentos em mídias tradicionais</p>
          </div>
        </div>
        <div className="text-sm text-gray-600 bg-white/80 backdrop-blur-sm px-3 py-1 rounded-lg">
          Última atualização: {new Date().toLocaleString("pt-BR")}
        </div>
      </div>

      {/* Métricas Gerais */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card-overlay rounded-lg shadow-lg p-6 flex items-center space-x-4">
          <div className="p-3 bg-green-100 rounded-full">
            <DollarSign className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <div className="text-sm text-gray-600">Investimento Total</div>
            <div className="text-2xl font-bold text-gray-900">{formatCurrency(processedData.totais.valor)}</div>
          </div>
        </div>
        <div className="card-overlay rounded-lg shadow-lg p-6 flex items-center space-x-4">
          <div className="p-3 bg-blue-100 rounded-full">
            <Users className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <div className="text-sm text-gray-600">Impactos Totais</div>
            <div className="text-2xl font-bold text-gray-900">{formatNumber(processedData.totais.impactos)}</div>
          </div>
        </div>
      </div>

      {/* Conteúdo Principal */}
      <div className="flex-1 card-overlay rounded-lg shadow-lg p-6">
        <div className="space-y-4">
          {Object.values(processedData.meios).map((meio) => (
            <div key={meio.nome} className="border border-gray-200 rounded-lg overflow-hidden">
              <div
                className="flex items-center justify-between p-4 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => toggleMeio(meio.nome)}
              >
                <div className="flex items-center space-x-3">
                  {expandedMeios[meio.nome] ? (
                    <ChevronDown className="w-5 h-5 text-gray-500" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-500" />
                  )}
                  <h3 className="text-lg font-semibold text-gray-900">{meio.nome}</h3>
                </div>
                <div className="flex space-x-6 text-sm text-right">
                  <div>
                    <p className="text-gray-500">Valor Total</p>
                    <p className="font-semibold text-gray-800">{formatCurrency(meio.valorTotal)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Impactos Total</p>
                    <p className="font-semibold text-gray-800">{formatNumber(meio.impactosTotal)}</p>
                  </div>
                </div>
              </div>

              {expandedMeios[meio.nome] && (
                <div className="p-4 space-y-3 bg-white">
                  {Object.values(meio.pracas).map((praca) => (
                    <div key={praca.nome} className="border border-gray-100 rounded-md">
                      <div
                        className="flex items-center justify-between p-3 bg-gray-25 hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => togglePraca(meio.nome, praca.nome)}
                      >
                        <div className="flex items-center space-x-3">
                          {expandedPracas[`${meio.nome}-${praca.nome}`] ? (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                          )}
                          <h4 className="text-md font-medium text-gray-800">{praca.nome}</h4>
                        </div>
                        <div className="flex space-x-4 text-sm text-right">
                          <div>
                            <p className="text-gray-500">Valor</p>
                            <p className="font-medium text-gray-700">{formatCurrency(praca.valorTotal)}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Impactos</p>
                            <p className="font-medium text-gray-700">{formatNumber(praca.impactosTotal)}</p>
                          </div>
                        </div>
                      </div>

                      {expandedPracas[`${meio.nome}-${praca.nome}`] && (
                        <div className="p-3">
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-gray-200">
                                  <th className="text-left py-2 px-3 font-semibold text-gray-600">Rede</th>
                                  <th className="text-right py-2 px-3 font-semibold text-gray-600">Valor</th>
                                  <th className="text-right py-2 px-3 font-semibold text-gray-600">Impactos</th>
                                  <th className="text-right py-2 px-3 font-semibold text-gray-600">TRP</th>
                                </tr>
                              </thead>
                              <tbody>
                                {Object.values(praca.redes).map((rede) => (
                                  <tr
                                    key={rede.nome}
                                    className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50"
                                  >
                                    <td className="py-2 px-3 text-gray-800">{rede.nome}</td>
                                    <td className="py-2 px-3 text-right font-medium text-green-700">
                                      {formatCurrency(rede.valorTotal)}
                                    </td>
                                    <td className="py-2 px-3 text-right font-medium text-blue-700">
                                      {formatNumber(rede.impactosTotal)}
                                    </td>
                                    <td className="py-2 px-3 text-right font-medium text-purple-700">
                                      {rede.trpTotal > 0 ? formatNumber(rede.trpTotal) : "-"}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default VeiculacaoOffline

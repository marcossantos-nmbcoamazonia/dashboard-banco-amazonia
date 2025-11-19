"use client"

import type React from "react"
import { useState, useMemo, useEffect } from "react"
import { FileText, DollarSign, ChevronDown, ChevronUp, Megaphone, TrendingUp, Search } from "lucide-react"
import { useProducaoData } from "../../services/api"
import Loading from "../../components/Loading/Loading"

// Interfaces para tipagem
interface AcaoData {
  acao: string
  situacao: string
  valor: number
  siref: string
  agencia: string
  verba: string
  campanha: string
}

interface CampanhaData {
  nome: string
  acoes: AcaoData[]
  totalValor: number
  totalAcoes: number
}

// Função para converter string de moeda brasileira para número
const parseCurrency = (valor: string): number => {
  if (!valor || valor === "-" || valor === "") return 0
  const cleanValue = valor
    .replace(/R\$\s?/g, "")
    .replace(/\./g, "")
    .replace(/,/g, ".")
    .trim()
  const parsed = Number.parseFloat(cleanValue)
  return isNaN(parsed) ? 0 : parsed
}

// Função para formatar moeda
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

// Função para formatar moeda abreviada
const formatCurrencyAbbreviated = (value: number): string => {
  if (value >= 1000000) {
    return `R$ ${(value / 1000000).toFixed(1)}M`
  } else if (value >= 1000) {
    return `R$ ${(value / 1000).toFixed(1)}K`
  }
  return formatCurrency(value)
}

// Função para obter cor com base na situação
const getSituacaoColor = (situacao: string): string => {
  const situacaoLower = situacao.toLowerCase()
  if (situacaoLower.includes("aprovado")) return "text-green-600 bg-green-50"
  if (situacaoLower.includes("andamento") || situacaoLower.includes("em análise")) return "text-yellow-600 bg-yellow-50"
  if (situacaoLower.includes("cancelado") || situacaoLower.includes("rejeitado")) return "text-red-600 bg-red-50"
  return "text-gray-600 bg-gray-50"
}

const Producao: React.FC = () => {
  const { data, loading, error } = useProducaoData()
  const [selectedVerba, setSelectedVerba] = useState<string | null>(null)
  const [selectedCampanha, setSelectedCampanha] = useState<string | null>(null)
  const [selectedAgencia, setSelectedAgencia] = useState<string | null>(null)
  const [expandedCampanha, setExpandedCampanha] = useState<string | null>(null)
  const [pesquisa, setPesquisa] = useState<string>("")

  // Processar dados da API
  const processedData = useMemo(() => {
    if (!data?.data?.values || data.data.values.length <= 1) {
      return {
        campanhas: [],
        acoesSemCampanha: [],
        totais: { acoes: 0, valorTotal: 0 },
        agencias: [],
        verbas: [],
        topAcoes: []
      }
    }

    const campanhasMap = new Map<string, CampanhaData>()
    const acoesSemCampanha: AcaoData[] = []
    const agenciasSet = new Set<string>()
    const verbasSet = new Set<string>()
    const acoesMap = new Map<string, number>()

    let totalValor = 0
    let totalAcoes = 0

    const headers = data.data.values[0]
    const rows = data.data.values.slice(1)

    // Mapear índices das colunas
    const acaoIndex = headers.indexOf("AÇÃO")
    const situacaoIndex = headers.indexOf("SITUAÇÃO")
    const valorIndex = headers.indexOf("VALOR")
    const sirefIndex = headers.indexOf("SIREF")
    const agenciaIndex = headers.indexOf("AGÊNCIA")
    const verbaIndex = headers.indexOf("VERBA")
    const campanhaIndex = headers.indexOf("Campanha")

    rows.forEach((row: string[]) => {
      const acao = row[acaoIndex] || ""
      const situacao = row[situacaoIndex] || ""
      const valorStr = row[valorIndex] || "0"
      const siref = row[sirefIndex] || ""
      const agencia = row[agenciaIndex] || ""
      const verba = row[verbaIndex] || ""
      const campanha = row[campanhaIndex] || ""

      if (!acao) return

      // Adicionar aos conjuntos para filtros
      if (agencia) agenciasSet.add(agencia)
      if (verba) verbasSet.add(verba)

      // Aplicar filtros
      if (selectedVerba && verba !== selectedVerba) return
      if (selectedAgencia && agencia !== selectedAgencia) return
      if (selectedCampanha && campanha !== selectedCampanha) return

      // Aplicar pesquisa (busca em ação e SIREF)
      if (pesquisa) {
        const termoPesquisa = pesquisa.toLowerCase()
        const acaoMatch = acao.toLowerCase().includes(termoPesquisa)
        const sirefMatch = siref.toLowerCase().includes(termoPesquisa)
        if (!acaoMatch && !sirefMatch) return
      }

      const valorNum = parseCurrency(valorStr)

      totalAcoes++
      totalValor += valorNum

      // Rastrear valor total por ação
      const currentValue = acoesMap.get(acao) || 0
      acoesMap.set(acao, currentValue + valorNum)

      const acaoData: AcaoData = {
        acao,
        situacao,
        valor: valorNum,
        siref,
        agencia,
        verba,
        campanha
      }

      // Separar ações com e sem campanha
      if (campanha && campanha.trim() !== "") {
        if (!campanhasMap.has(campanha)) {
          campanhasMap.set(campanha, {
            nome: campanha,
            acoes: [],
            totalValor: 0,
            totalAcoes: 0
          })
        }

        const campanhaData = campanhasMap.get(campanha)!
        campanhaData.acoes.push(acaoData)
        campanhaData.totalValor += valorNum
        campanhaData.totalAcoes++
      } else {
        acoesSemCampanha.push(acaoData)
      }
    })

    // Ordenar ações dentro de cada campanha por nome
    campanhasMap.forEach((campanha) => {
      campanha.acoes.sort((a, b) => a.acao.localeCompare(b.acao))
    })

    // Ordenar ações sem campanha por valor (decrescente)
    acoesSemCampanha.sort((a, b) => b.valor - a.valor)

    // Converter campanhas para array e ordenar por valor total (decrescente)
    const campanhasArray = Array.from(campanhasMap.values()).sort((a, b) => b.totalValor - a.totalValor)

    // Obter top 10 ações com maiores investimentos
    const topAcoes = Array.from(acoesMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([acao, valor]) => ({ acao, valor }))

    return {
      campanhas: campanhasArray,
      acoesSemCampanha,
      totais: {
        acoes: totalAcoes,
        valorTotal: totalValor
      },
      agencias: Array.from(agenciasSet).sort(),
      verbas: Array.from(verbasSet).sort(),
      topAcoes
    }
  }, [data, selectedVerba, selectedCampanha, selectedAgencia, pesquisa])

  // Expandir automaticamente campanhas com resultados de pesquisa
  useEffect(() => {
    if (pesquisa && pesquisa.length > 0) {
      // Encontrar campanhas que contêm ações correspondentes à pesquisa
      const campanhaComResultado = processedData.campanhas.find((campanha) =>
        campanha.acoes.some((acao) => {
          const termoPesquisa = pesquisa.toLowerCase()
          return acao.acao.toLowerCase().includes(termoPesquisa) ||
                 acao.siref.toLowerCase().includes(termoPesquisa)
        })
      )

      if (campanhaComResultado) {
        setExpandedCampanha(campanhaComResultado.nome)
      }

      // Verificar se há resultados em ações sem campanha
      const temResultadoSemCampanha = processedData.acoesSemCampanha.some((acao) => {
        const termoPesquisa = pesquisa.toLowerCase()
        return acao.acao.toLowerCase().includes(termoPesquisa) ||
               acao.siref.toLowerCase().includes(termoPesquisa)
      })

      if (temResultadoSemCampanha && processedData.campanhas.length === 0) {
        setExpandedCampanha("SEM_CAMPANHA")
      }
    }
  }, [pesquisa, processedData.campanhas, processedData.acoesSemCampanha])

  if (loading) {
    return <Loading message="Carregando dados de produção..." />
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-red-500 text-lg">Erro ao carregar dados: {error.message}</div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col space-y-4 overflow-auto">
      {/* Header Minimalista com Filtros Integrados */}
      <div className="card-overlay rounded-xl shadow-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <FileText className="w-6 h-6 text-purple-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Produção</h1>
              <p className="text-sm text-gray-600">Análise de investimentos em produção por campanha e ação</p>
            </div>
          </div>

          {/* Filtros */}
          <div className="flex items-center gap-3">
            {/* Filtro Tipo de Campanha (Verba) */}
            <select
              value={selectedVerba || ""}
              onChange={(e) => {
                setSelectedVerba(e.target.value || null)
                setSelectedCampanha(null)
              }}
              className="text-sm bg-white border border-gray-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 cursor-pointer"
            >
              <option value="">Tipo de Campanha: Todas</option>
              {processedData.verbas.map((verba) => (
                <option key={verba} value={verba}>
                  {verba}
                </option>
              ))}
            </select>

            {/* Filtro Campanha */}
            <select
              value={selectedCampanha || ""}
              onChange={(e) => {
                setSelectedCampanha(e.target.value || null)
                setExpandedCampanha(e.target.value || null)
              }}
              className="text-sm bg-white border border-gray-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 cursor-pointer"
            >
              <option value="">Campanha: Todas</option>
              {processedData.campanhas.map((campanha) => (
                <option key={campanha.nome} value={campanha.nome}>
                  {campanha.nome}
                </option>
              ))}
            </select>

            {/* Filtro Agência */}
            <select
              value={selectedAgencia || ""}
              onChange={(e) => setSelectedAgencia(e.target.value || null)}
              className="text-sm bg-white border border-gray-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 cursor-pointer"
            >
              <option value="">Agência: Todas</option>
              {processedData.agencias.map((agencia) => (
                <option key={agencia} value={agencia}>
                  {agencia}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Cards de Métricas Gerais + Pesquisa */}
      <div className="grid grid-cols-4 gap-3">

        {/* Total de Ações */}
        <div className="card-overlay rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-xs font-medium text-gray-600">Total de Ações</h3>
            <FileText className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-xl font-bold text-gray-900">{processedData.totais.acoes}</p>
        </div>

        {/* Investimento Total */}
        <div className="card-overlay rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-xs font-medium text-gray-600">Investimento Total</h3>
            <DollarSign className="w-4 h-4 text-green-600" />
          </div>
          <p className="text-lg font-bold text-gray-900">
            {formatCurrency(processedData.totais.valorTotal)}
          </p>
        </div>
        
        {/* Barra de Pesquisa */}
        <div className="card-overlay rounded-lg shadow p-4 col-span-2">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-xs font-medium text-gray-600">Pesquisar Ação ou SIREF</h3>
            <Search className="w-4 h-4 text-purple-600" />
          </div>
          <div className="relative">
            <input
              type="text"
              value={pesquisa}
              onChange={(e) => setPesquisa(e.target.value)}
              placeholder="Digite o nome da ação ou número do SIREF..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
            {pesquisa && (
              <button
                onClick={() => setPesquisa("")}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        
      </div>

      {/* Grid: Campanhas + Top 10 */}
      <div className="grid grid-cols-5 gap-4">
        {/* Card de Campanhas com Accordion */}
        <div className="card-overlay rounded-xl shadow-lg p-5 h-[500px] flex flex-col col-span-3">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-gray-900 flex items-center">
              <Megaphone className="w-4 h-4 mr-2 text-purple-600" />
              Ações ({processedData.campanhas.length})
            </h2>
            {(selectedVerba || selectedCampanha || selectedAgencia) && (
              <button
                onClick={() => {
                  setSelectedVerba(null)
                  setSelectedCampanha(null)
                  setSelectedAgencia(null)
                  setExpandedCampanha(null)
                }}
                className="text-xs text-blue-600 hover:text-blue-800 underline"
              >
                Limpar
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto space-y-2">
            {processedData.campanhas.map((campanha, index) => (
              <div key={index}>
                {/* Card da Campanha */}
                <div
                  className={`p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                    selectedCampanha === campanha.nome
                      ? "bg-purple-50 border-2 border-purple-400 shadow-sm"
                      : expandedCampanha === campanha.nome
                      ? "bg-purple-50 border-2 border-purple-300"
                      : "hover:bg-gray-50 border-2 border-transparent bg-gray-50"
                  }`}
                >
                  <div
                    onClick={() => {
                      if (expandedCampanha === campanha.nome) {
                        setExpandedCampanha(null)
                        setSelectedCampanha(null)
                      } else {
                        setExpandedCampanha(campanha.nome)
                        setSelectedCampanha(campanha.nome)
                      }
                    }}
                  >
                    {/* Nome da Campanha com número de ações */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{campanha.nome}</p>
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full flex-shrink-0">
                          {campanha.totalAcoes} {campanha.totalAcoes === 1 ? 'ação' : 'ações'}
                        </span>
                      </div>
                      {expandedCampanha === campanha.nome ? (
                        <ChevronUp className="w-4 h-4 text-gray-600 flex-shrink-0 ml-2" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-600 flex-shrink-0 ml-2" />
                      )}
                    </div>

                    {/* Métricas em uma linha */}
                    <div className="flex items-center text-[10px] text-gray-600 gap-2">
                      <div className="flex items-center gap-1">
                        <span className="text-gray-500">Investimento:</span>
                        <span className="font-semibold text-green-600">{formatCurrency(campanha.totalValor)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Lista de Ações (Accordion) */}
                  {expandedCampanha === campanha.nome && campanha.acoes.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="text-left py-2 px-2 font-semibold text-gray-600">Ação</th>
                              <th className="text-left py-2 px-2 font-semibold text-gray-600">Situação</th>
                              <th className="text-left py-2 px-2 font-semibold text-gray-600">SIREF</th>
                              <th className="text-left py-2 px-2 font-semibold text-gray-600">Agência</th>
                              <th className="text-left py-2 px-2 font-semibold text-gray-600">Tipo</th>
                              <th className="text-right py-2 px-2 font-semibold text-gray-600">Investimento</th>
                            </tr>
                          </thead>
                          <tbody>
                            {campanha.acoes.map((acao, acaoIndex) => {
                              const isMatch = pesquisa && (
                                acao.acao.toLowerCase().includes(pesquisa.toLowerCase()) ||
                                acao.siref.toLowerCase().includes(pesquisa.toLowerCase())
                              )
                              return (
                              <tr
                                key={acaoIndex}
                                className={`border-b border-gray-100 last:border-b-0 hover:bg-purple-50 ${
                                  isMatch ? 'bg-yellow-50 hover:bg-yellow-100' : ''
                                }`}
                              >
                                <td className="py-2 px-2 text-gray-800 font-medium">{acao.acao}</td>
                                <td className="py-2 px-2">
                                  <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${getSituacaoColor(acao.situacao)}`}>
                                    {acao.situacao}
                                  </span>
                                </td>
                                <td className="py-2 px-2 text-gray-600">{acao.siref}</td>
                                <td className="py-2 px-2 text-gray-600">{acao.agencia}</td>
                                <td className="py-2 px-2 text-gray-600">{acao.verba}</td>
                                <td className="py-2 px-2 text-right font-semibold text-green-700">
                                  {formatCurrency(acao.valor)}
                                </td>
                              </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Ações sem Campanha */}
            {processedData.acoesSemCampanha.length > 0 && (
              <div>
                <div className="p-3 rounded-lg bg-gray-100 border-2 border-gray-300">
                  <div
                    onClick={() => {
                      if (expandedCampanha === "SEM_CAMPANHA") {
                        setExpandedCampanha(null)
                      } else {
                        setExpandedCampanha("SEM_CAMPANHA")
                      }
                    }}
                    className="cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900">Ações sem Campanha</p>
                        <span className="text-xs text-gray-500 bg-white px-2 py-0.5 rounded-full flex-shrink-0">
                          {processedData.acoesSemCampanha.length} {processedData.acoesSemCampanha.length === 1 ? 'ação' : 'ações'}
                        </span>
                      </div>
                      {expandedCampanha === "SEM_CAMPANHA" ? (
                        <ChevronUp className="w-4 h-4 text-gray-600 flex-shrink-0 ml-2" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-600 flex-shrink-0 ml-2" />
                      )}
                    </div>

                    <div className="flex items-center text-[10px] text-gray-600 gap-2">
                      <div className="flex items-center gap-1">
                        <span className="text-gray-500">Investimento:</span>
                        <span className="font-semibold text-green-600">
                          {formatCurrency(processedData.acoesSemCampanha.reduce((sum, acao) => sum + acao.valor, 0))}
                        </span>
                      </div>
                    </div>
                  </div>

                  {expandedCampanha === "SEM_CAMPANHA" && (
                    <div className="mt-3 space-y-2">
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="text-left py-2 px-2 font-semibold text-gray-600">Ação</th>
                              <th className="text-left py-2 px-2 font-semibold text-gray-600">Situação</th>
                              <th className="text-left py-2 px-2 font-semibold text-gray-600">SIREF</th>
                              <th className="text-left py-2 px-2 font-semibold text-gray-600">Agência</th>
                              <th className="text-left py-2 px-2 font-semibold text-gray-600">Tipo</th>
                              <th className="text-right py-2 px-2 font-semibold text-gray-600">Investimento</th>
                            </tr>
                          </thead>
                          <tbody>
                            {processedData.acoesSemCampanha.map((acao, acaoIndex) => {
                              const isMatch = pesquisa && (
                                acao.acao.toLowerCase().includes(pesquisa.toLowerCase()) ||
                                acao.siref.toLowerCase().includes(pesquisa.toLowerCase())
                              )
                              return (
                              <tr
                                key={acaoIndex}
                                className={`border-b border-gray-100 last:border-b-0 hover:bg-gray-50 ${
                                  isMatch ? 'bg-yellow-50 hover:bg-yellow-100' : ''
                                }`}
                              >
                                <td className="py-2 px-2 text-gray-800 font-medium">{acao.acao}</td>
                                <td className="py-2 px-2">
                                  <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${getSituacaoColor(acao.situacao)}`}>
                                    {acao.situacao}
                                  </span>
                                </td>
                                <td className="py-2 px-2 text-gray-600">{acao.siref}</td>
                                <td className="py-2 px-2 text-gray-600">{acao.agencia}</td>
                                <td className="py-2 px-2 text-gray-600">{acao.verba}</td>
                                <td className="py-2 px-2 text-right font-semibold text-green-700">
                                  {formatCurrency(acao.valor)}
                                </td>
                              </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Top 10 Ações */}
        <div className="card-overlay rounded-xl shadow-lg p-5 h-[500px] flex flex-col col-span-2">
          <div className="flex items-center space-x-3 mb-3">
            <TrendingUp className="w-4 h-4 text-purple-600" />
            <h2 className="text-base font-bold text-gray-900">Top 10 Ações</h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-2 font-semibold text-gray-600">Pos.</th>
                  <th className="text-left py-2 px-2 font-semibold text-gray-600">Ação</th>
                  <th className="text-right py-2 px-2 font-semibold text-gray-600">Investimento</th>
                </tr>
              </thead>
              <tbody>
                {processedData.topAcoes.map((item, index) => (
                  <tr
                    key={item.acao}
                    className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50"
                  >
                    <td className="py-2 px-2">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-purple-100 text-purple-600 font-semibold text-[10px]">
                        {index + 1}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-gray-800 font-medium">{item.acao}</td>
                    <td className="py-2 px-2 text-right font-semibold text-green-700">
                      {formatCurrency(item.valor)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Producao

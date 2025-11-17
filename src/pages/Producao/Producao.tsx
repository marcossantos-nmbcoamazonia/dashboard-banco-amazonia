"use client"

import type React from "react"
import { useState, useMemo, useEffect } from "react"
import { ChevronDown, ChevronRight, FileText, DollarSign, TrendingUp, CheckCircle, Search } from "lucide-react"
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
}

interface AgenciaData {
  nome: string
  acoes: AcaoData[]
  totalValor: number
  totalAcoes: number
}

interface VerbaData {
  nome: string
  agencias: { [key: string]: AgenciaData }
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

// Função para obter cor com base na situação
const getSituacaoColor = (situacao: string): string => {
  const situacaoLower = situacao.toLowerCase()
  if (situacaoLower.includes("aprovado")) return "text-green-600 bg-green-50"
  if (situacaoLower.includes("andamento") || situacaoLower.includes("em análise")) return "text-yellow-600 bg-yellow-50"
  if (situacaoLower.includes("cancelado") || situacaoLower.includes("rejeitado")) return "text-red-600 bg-red-50"
  return "text-gray-600 bg-gray-50"
}

// Função para verificar se a ação corresponde à pesquisa
const matchPesquisa = (texto: string, termoPesquisa: string): boolean => {
  if (!termoPesquisa) return false
  return texto.toLowerCase().includes(termoPesquisa.toLowerCase())
}

const Producao: React.FC = () => {
  const { data, loading, error } = useProducaoData()
  const [expandedVerbas, setExpandedVerbas] = useState<{ [key: string]: boolean }>({})
  const [expandedAgencias, setExpandedAgencias] = useState<{ [key: string]: boolean }>({})

  // Estados para filtros
  const [filtroAgencia, setFiltroAgencia] = useState<string>("")
  const [filtroVerba, setFiltroVerba] = useState<string>("")
  const [filtroSituacao, setFiltroSituacao] = useState<string>("")
  const [pesquisa, setPesquisa] = useState<string>("")

  // Processar dados da API
  const processedData = useMemo(() => {
    if (!data?.data?.values || data.data.values.length <= 1) {
      return {
        verbas: {},
        totais: { acoes: 0, valorTotal: 0 },
        agencias: [],
        verbas_list: [],
        situacoes: [],
        topAcoes: []
      }
    }

    const verbasData: { [key: string]: VerbaData } = {}
    const agenciasSet = new Set<string>()
    const verbasSet = new Set<string>()
    const situacoesSet = new Set<string>()
    const acoesMap = new Map<string, number>() // Para rastrear o valor total por ação

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

    rows.forEach((row: string[]) => {
      const acao = row[acaoIndex] || ""
      const situacao = row[situacaoIndex] || ""
      const valorStr = row[valorIndex] || "0"
      const siref = row[sirefIndex] || ""
      const agencia = row[agenciaIndex] || ""
      const verba = row[verbaIndex] || ""

      if (!acao || !verba || !agencia) return

      // Adicionar aos conjuntos para filtros
      if (agencia) agenciasSet.add(agencia)
      if (verba) verbasSet.add(verba)
      if (situacao) situacoesSet.add(situacao)

      // Aplicar filtros
      if (filtroAgencia && agencia !== filtroAgencia) return
      if (filtroVerba && verba !== filtroVerba) return
      if (filtroSituacao && situacao !== filtroSituacao) return

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

      // Estrutura: Verba -> Agência -> Ações
      if (!verbasData[verba]) {
        verbasData[verba] = {
          nome: verba,
          agencias: {},
          totalValor: 0,
          totalAcoes: 0
        }
      }

      if (!verbasData[verba].agencias[agencia]) {
        verbasData[verba].agencias[agencia] = {
          nome: agencia,
          acoes: [],
          totalValor: 0,
          totalAcoes: 0
        }
      }

      const acaoData: AcaoData = {
        acao,
        situacao,
        valor: valorNum,
        siref,
        agencia,
        verba
      }

      verbasData[verba].agencias[agencia].acoes.push(acaoData)
      verbasData[verba].agencias[agencia].totalValor += valorNum
      verbasData[verba].agencias[agencia].totalAcoes++
      verbasData[verba].totalValor += valorNum
      verbasData[verba].totalAcoes++
    })

    // Obter top 10 ações com maiores investimentos
    const topAcoes = Array.from(acoesMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([acao, valor]) => ({ acao, valor }))

    return {
      verbas: verbasData,
      totais: {
        acoes: totalAcoes,
        valorTotal: totalValor
      },
      agencias: Array.from(agenciasSet).sort(),
      verbas_list: Array.from(verbasSet).sort(),
      situacoes: Array.from(situacoesSet).sort(),
      topAcoes
    }
  }, [data, filtroAgencia, filtroVerba, filtroSituacao, pesquisa])

  const toggleVerba = (verba: string) => {
    setExpandedVerbas((prev) => ({ ...prev, [verba]: !prev[verba] }))
  }

  const toggleAgencia = (verbaNome: string, agenciaKey: string) => {
    const key = `${verbaNome}-${agenciaKey}`
    setExpandedAgencias((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const limparFiltros = () => {
    setFiltroAgencia("")
    setFiltroVerba("")
    setFiltroSituacao("")
    setPesquisa("")
  }

  // Expandir automaticamente seções com resultados de pesquisa
  useEffect(() => {
    if (pesquisa && pesquisa.length > 0) {
      const newExpandedVerbas: { [key: string]: boolean } = {}
      const newExpandedAgencias: { [key: string]: boolean } = {}

      Object.entries(processedData.verbas).forEach(([verbaKey, verba]) => {
        let verbaTemResultado = false

        Object.entries(verba.agencias).forEach(([agenciaKey, agencia]) => {
          const agenciaTemResultado = agencia.acoes.some(acao => {
            const termoPesquisa = pesquisa.toLowerCase()
            return acao.acao.toLowerCase().includes(termoPesquisa) ||
                   acao.siref.toLowerCase().includes(termoPesquisa)
          })

          if (agenciaTemResultado) {
            verbaTemResultado = true
            newExpandedAgencias[`${verbaKey}-${agenciaKey}`] = true
          }
        })

        if (verbaTemResultado) {
          newExpandedVerbas[verbaKey] = true
        }
      })

      setExpandedVerbas(newExpandedVerbas)
      setExpandedAgencias(newExpandedAgencias)
    }
  }, [pesquisa, processedData.verbas])

  if (loading) {
    return <Loading message="Carregando dados de produção..." />
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
          <div className="w-10 h-10 bg-gradient-to-r from-purple-600 to-purple-800 rounded-lg flex items-center justify-center">
            <FileText className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 text-enhanced">Produção</h1>
            <p className="text-gray-600">Análise de investimentos em produção por ação e agência</p>
          </div>
        </div>
        <div className="text-sm text-gray-600 bg-white/80 backdrop-blur-sm px-3 py-1 rounded-lg">
          Última atualização: {new Date().toLocaleString("pt-BR")}
        </div>
      </div>

      {/* Campo de Pesquisa */}
      <div className="card-overlay rounded-lg shadow-lg p-4">
        <div className="space-y-2">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              value={pesquisa}
              onChange={(e) => setPesquisa(e.target.value)}
              placeholder="Pesquisar por ação ou SIREF..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
            {pesquisa && (
              <button
                onClick={() => setPesquisa("")}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          {pesquisa && processedData.totais.acoes > 0 && (
            <div className="flex items-center space-x-2 text-sm text-purple-600">
              <CheckCircle className="h-4 w-4" />
              <span>
                {processedData.totais.acoes} {processedData.totais.acoes === 1 ? 'resultado encontrado' : 'resultados encontrados'}
              </span>
            </div>
          )}
          {pesquisa && processedData.totais.acoes === 0 && (
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Nenhum resultado encontrado para "{pesquisa}"</span>
            </div>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="card-overlay rounded-lg shadow-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Agência</label>
            <select
              value={filtroAgencia}
              onChange={(e) => setFiltroAgencia(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            >
              <option value="">Todas</option>
              {processedData.agencias.map((agencia) => (
                <option key={agencia} value={agencia}>
                  {agencia}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Campanha (Verba)</label>
            <select
              value={filtroVerba}
              onChange={(e) => setFiltroVerba(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            >
              <option value="">Todas</option>
              {processedData.verbas_list.map((verba) => (
                <option key={verba} value={verba}>
                  {verba}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Situação</label>
            <select
              value={filtroSituacao}
              onChange={(e) => setFiltroSituacao(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            >
              <option value="">Todas</option>
              {processedData.situacoes.map((situacao) => (
                <option key={situacao} value={situacao}>
                  {situacao}
                </option>
              ))}
            </select>
          </div>
        </div>
        {(filtroAgencia || filtroVerba || filtroSituacao || pesquisa) && (
          <div className="mt-4 flex justify-end">
            <button
              onClick={limparFiltros}
              className="px-4 py-2 text-sm font-medium text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded-lg transition-colors"
            >
              Limpar Todos os Filtros
            </button>
          </div>
        )}
      </div>

      {/* Métricas Gerais */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card-overlay rounded-lg shadow-lg p-6 flex items-center space-x-4">
          <div className="p-3 bg-purple-100 rounded-full">
            <FileText className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <div className="text-sm text-gray-600">Total de Ações</div>
            <div className="text-2xl font-bold text-gray-900">{processedData.totais.acoes}</div>
          </div>
        </div>
        <div className="card-overlay rounded-lg shadow-lg p-6 flex items-center space-x-4">
          <div className="p-3 bg-blue-100 rounded-full">
            <DollarSign className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <div className="text-sm text-gray-600">Investimento Total</div>
            <div className="text-2xl font-bold text-gray-900">{formatCurrency(processedData.totais.valorTotal)}</div>
          </div>
        </div>
      </div>

      {/* Top 10 Ações com Maiores Investimentos */}
      <div className="card-overlay rounded-lg shadow-lg p-6">
        <div className="flex items-center space-x-3 mb-4">
          <TrendingUp className="w-5 h-5 text-purple-600" />
          <h2 className="text-xl font-semibold text-gray-900">Top 10 Ações com Maiores Investimentos</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-semibold text-gray-600">Posição</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-600">Ação</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-600">Investimento</th>
              </tr>
            </thead>
            <tbody>
              {processedData.topAcoes.map((item, index) => (
                <tr
                  key={item.acao}
                  className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50"
                >
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-purple-100 text-purple-600 font-semibold">
                      {index + 1}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-800 font-medium">{item.acao}</td>
                  <td className="py-3 px-4 text-right font-semibold text-blue-700">
                    {formatCurrency(item.valor)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Conteúdo Principal - Detalhamento por Verba e Agência */}
      <div className="flex-1 card-overlay rounded-lg shadow-lg p-6 overflow-auto">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Detalhamento por Tipo de Campanha</h2>
        <div className="space-y-4">
          {Object.values(processedData.verbas).map((verba) => (
            <div key={verba.nome} className="border border-gray-200 rounded-lg overflow-hidden">
              <div
                className="flex items-center justify-between p-4 bg-purple-50 cursor-pointer hover:bg-purple-100 transition-colors"
                onClick={() => toggleVerba(verba.nome)}
              >
                <div className="flex items-center space-x-3">
                  {expandedVerbas[verba.nome] ? (
                    <ChevronDown className="w-5 h-5 text-gray-500" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-500" />
                  )}
                  <h3 className="text-lg font-semibold text-gray-900">{verba.nome}</h3>
                </div>
                <div className="flex space-x-6 text-sm text-right">
                  <div>
                    <p className="text-gray-500">Ações</p>
                    <p className="font-semibold text-gray-800">{verba.totalAcoes}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Investimento</p>
                    <p className="font-semibold text-gray-800">{formatCurrency(verba.totalValor)}</p>
                  </div>
                </div>
              </div>

              {expandedVerbas[verba.nome] && (
                <div className="p-4 space-y-3 bg-white">
                  {Object.entries(verba.agencias).map(([agenciaKey, agencia]) => (
                    <div key={agenciaKey} className="border border-gray-100 rounded-md">
                      <div
                        className="flex items-center justify-between p-3 bg-gray-25 hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => toggleAgencia(verba.nome, agenciaKey)}
                      >
                        <div className="flex items-center space-x-3">
                          {expandedAgencias[`${verba.nome}-${agenciaKey}`] ? (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                          )}
                          <h4 className="text-md font-medium text-gray-800">
                            {agencia.nome}
                          </h4>
                        </div>
                        <div className="flex space-x-4 text-sm text-right">
                          <div>
                            <p className="text-gray-500">Ações</p>
                            <p className="font-medium text-gray-700">{agencia.totalAcoes}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Investimento</p>
                            <p className="font-medium text-gray-700">{formatCurrency(agencia.totalValor)}</p>
                          </div>
                        </div>
                      </div>

                      {expandedAgencias[`${verba.nome}-${agenciaKey}`] && (
                        <div className="p-3">
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-gray-200">
                                  <th className="text-left py-2 px-3 font-semibold text-gray-600">Ação</th>
                                  <th className="text-left py-2 px-3 font-semibold text-gray-600">Situação</th>
                                  <th className="text-left py-2 px-3 font-semibold text-gray-600">SIREF</th>
                                  <th className="text-right py-2 px-3 font-semibold text-gray-600">Investimento</th>
                                </tr>
                              </thead>
                              <tbody>
                                {agencia.acoes.map((acao, index) => {
                                  const isMatch = pesquisa && (matchPesquisa(acao.acao, pesquisa) || matchPesquisa(acao.siref, pesquisa))
                                  return (
                                    <tr
                                      key={`${acao.acao}-${index}`}
                                      className={`border-b border-gray-100 last:border-b-0 hover:bg-gray-50 ${
                                        isMatch ? 'bg-purple-50 hover:bg-purple-100' : ''
                                      }`}
                                    >
                                      <td className={`py-2 px-3 ${isMatch ? 'text-gray-900 font-semibold' : 'text-gray-800'}`}>
                                        {acao.acao}
                                      </td>
                                      <td className="py-2 px-3">
                                        <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getSituacaoColor(acao.situacao)}`}>
                                          {acao.situacao}
                                        </span>
                                      </td>
                                      <td className={`py-2 px-3 ${isMatch ? 'text-gray-900 font-semibold' : 'text-gray-600'}`}>
                                        {acao.siref}
                                      </td>
                                      <td className="py-2 px-3 text-right font-medium text-blue-700">
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

export default Producao

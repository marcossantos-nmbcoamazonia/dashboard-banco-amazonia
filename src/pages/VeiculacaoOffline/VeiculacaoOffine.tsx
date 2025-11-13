"use client"

import type React from "react"
import { useState, useMemo } from "react"
import { ChevronDown, ChevronRight, FileText, Radio, TrendingUp } from "lucide-react"
import { useOfflineData } from "../../services/api"
import Loading from "../../components/Loading/Loading"

// Interfaces para tipagem
interface VeiculoData {
  campanha: string
  insercoes: number
  impactos: number
  investimento: number
  tipoCompra: string
}

interface PracaUFData {
  nome: string
  uf: string
  veiculos: { [key: string]: VeiculoData }
  totalInsercoes: number
  totalImpactos: number
  totalInvestimento: number
}

interface MeioData {
  nome: string
  pracas: { [key: string]: PracaUFData }
  totalInsercoes: number
  totalImpactos: number
  totalInvestimento: number
}

// Função para converter string de número para número
const parseNumero = (numero: string): number => {
  if (!numero || numero === "-" || numero === "") return 0
  const cleanValue = numero.replace(/\./g, "").replace(/,/g, ".").trim()
  const parsed = Number.parseFloat(cleanValue)
  return isNaN(parsed) ? 0 : parsed
}

// Função para formatar números
const formatNumber = (value: number): string => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return new Intl.NumberFormat("pt-BR").format(value)
}

// Função para formatar moeda
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
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

// Função para categorizar praças
const categorizarPraca = (praca: string): string => {
  const pracaUpper = praca.toUpperCase().trim()

  // Categoria: Abrangência
  if (pracaUpper === "NACIONAL") return "Abrangência|Nacional"
  if (pracaUpper === "INTERNACIONAL") return "Abrangência|Internacional"
  if (pracaUpper === "LOCAL") return "Abrangência|Local"
  if (pracaUpper === "REGIONAL") return "Abrangência|Regional"
  if (pracaUpper === "REGIÃO NORTE") return "Abrangência|Região Norte"

  // Categoria: Estados (siglas de 2 letras)
  const siglas = ["AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO"]
  if (siglas.includes(pracaUpper)) return "Estados|" + praca

  // Categoria: Regiões especiais (com vírgula ou múltiplos estados)
  if (pracaUpper.includes(",") || pracaUpper.includes(" E ")) return "Regiões|" + praca

  // Categoria: Cidades (todo o resto)
  return "Cidades|" + praca
}

// Interface para praças categorizadas
interface PracasCategorized {
  "Abrangência": string[]
  "Regiões": string[]
  "Estados": string[]
  "Cidades": string[]
}

const VeiculacaoOffline: React.FC = () => {
  const { data, loading, error } = useOfflineData()
  const [expandedMeios, setExpandedMeios] = useState<{ [key: string]: boolean }>({})
  const [expandedPracas, setExpandedPracas] = useState<{ [key: string]: boolean }>({})

  // Estados para filtros
  const [filtroCampanha, setFiltroCampanha] = useState<string>("")
  const [filtroAgencia, setFiltroAgencia] = useState<string>("")
  const [filtroPraca, setFiltroPraca] = useState<string>("")

  // Processar dados da API
  const processedData = useMemo(() => {
    if (!data?.data?.values || data.data.values.length <= 1) {
      return {
        meios: {},
        totais: { campanhas: 0, veiculos: 0, insercoes: 0, impactos: 0, investimento: 0 },
        campanhas: [],
        agencias: [],
        pracas: [],
        pracasCategorized: {
          "Abrangência": [],
          "Regiões": [],
          "Estados": [],
          "Cidades": []
        },
        tiposCompra: new Set<string>()
      }
    }

    const meiosData: { [key: string]: MeioData } = {}
    const campanhasSet = new Set<string>()
    const agenciasSet = new Set<string>()
    const pracasSet = new Set<string>()
    const veiculosSet = new Set<string>()
    const tiposCompraSet = new Set<string>()

    // Conjuntos separados para os dados filtrados
    const campanhasFiltradas = new Set<string>()
    const veiculosFiltrados = new Set<string>()

    let totalInsercoes = 0
    let totalImpactos = 0
    let totalInvestimento = 0

    const headers = data.data.values[0]
    const rows = data.data.values.slice(1)

    // Mapear índices das colunas conforme a nova API
    const agenciaIndex = headers.indexOf("AGÊNCIA")
    const campanhaIndex = headers.indexOf("CAMPANHA")
    const meioIndex = headers.indexOf("MEIO")
    const pracaIndex = headers.indexOf("PRAÇA")
    const veiculoIndex = headers.indexOf("VEÍCULO")
    const impressoesIndex = headers.indexOf("IMPRESSÕES / CLIQUES / DIÁRIAS")
    const tipoCompraIndex = headers.indexOf("TIPO DE COMPRA")
    const valorDesembolsoIndex = headers.indexOf("VALORDESEMBOLSO95%(banco)")

    rows.forEach((row: string[]) => {
      const agencia = row[agenciaIndex] || ""
      const campanha = row[campanhaIndex] || ""
      const meio = row[meioIndex] || ""
      const praca = row[pracaIndex] || ""
      const veiculo = row[veiculoIndex] || ""
      const impressoes = row[impressoesIndex] || "0"
      const tipoCompra = row[tipoCompraIndex] || ""
      const valorDesembolso = row[valorDesembolsoIndex] || "0"

      if (!meio || !veiculo) return

      // Filtrar dados de Internet
      if (meio.toLowerCase() === "internet") return

      // Adicionar aos conjuntos para filtros (sempre adiciona, independente dos filtros)
      if (campanha) campanhasSet.add(campanha)
      if (agencia) agenciasSet.add(agencia)
      if (praca) pracasSet.add(praca)
      if (veiculo) veiculosSet.add(veiculo)
      if (tipoCompra) tiposCompraSet.add(tipoCompra)

      // Aplicar filtros
      if (filtroCampanha && campanha !== filtroCampanha) return
      if (filtroAgencia && agencia !== filtroAgencia) return
      if (filtroPraca && praca !== filtroPraca) return

      // Adicionar aos conjuntos filtrados (apenas dados que passaram pelos filtros)
      if (campanha) campanhasFiltradas.add(campanha)
      if (veiculo) veiculosFiltrados.add(veiculo)

      const insercoesNum = parseNumero(impressoes)
      const impactosNum = 0 // Não temos mais a coluna de impactos na nova API
      const investimentoNum = parseCurrency(valorDesembolso)

      totalInsercoes += insercoesNum
      totalImpactos += impactosNum
      totalInvestimento += investimentoNum

      // Estrutura: Meio -> Praça -> Veículo
      if (!meiosData[meio]) {
        meiosData[meio] = {
          nome: meio,
          pracas: {},
          totalInsercoes: 0,
          totalImpactos: 0,
          totalInvestimento: 0
        }
      }

      const pracaKey = praca
      if (!meiosData[meio].pracas[pracaKey]) {
        meiosData[meio].pracas[pracaKey] = {
          nome: praca,
          uf: "",
          veiculos: {},
          totalInsercoes: 0,
          totalImpactos: 0,
          totalInvestimento: 0
        }
      }

      if (!meiosData[meio].pracas[pracaKey].veiculos[veiculo]) {
        meiosData[meio].pracas[pracaKey].veiculos[veiculo] = {
          campanha: campanha,
          insercoes: 0,
          impactos: 0,
          investimento: 0,
          tipoCompra: tipoCompra
        }
      }

      meiosData[meio].totalInsercoes += insercoesNum
      meiosData[meio].totalImpactos += impactosNum
      meiosData[meio].totalInvestimento += investimentoNum
      meiosData[meio].pracas[pracaKey].totalInsercoes += insercoesNum
      meiosData[meio].pracas[pracaKey].totalImpactos += impactosNum
      meiosData[meio].pracas[pracaKey].totalInvestimento += investimentoNum
      meiosData[meio].pracas[pracaKey].veiculos[veiculo].insercoes += insercoesNum
      meiosData[meio].pracas[pracaKey].veiculos[veiculo].impactos += impactosNum
      meiosData[meio].pracas[pracaKey].veiculos[veiculo].investimento += investimentoNum
    })

    // Categorizar praças
    const pracasCategorized: PracasCategorized = {
      "Abrangência": [],
      "Regiões": [],
      "Estados": [],
      "Cidades": []
    }

    Array.from(pracasSet).forEach((praca) => {
      const categorized = categorizarPraca(praca)
      const [categoria, valor] = categorized.split("|")

      if (categoria === "Abrangência") {
        pracasCategorized["Abrangência"].push(valor)
      } else if (categoria === "Regiões") {
        pracasCategorized["Regiões"].push(valor)
      } else if (categoria === "Estados") {
        pracasCategorized["Estados"].push(valor)
      } else if (categoria === "Cidades") {
        pracasCategorized["Cidades"].push(valor)
      }
    })

    // Ordenar cada categoria
    pracasCategorized["Abrangência"].sort()
    pracasCategorized["Regiões"].sort()
    pracasCategorized["Estados"].sort()
    pracasCategorized["Cidades"].sort()

    return {
      meios: meiosData,
      totais: {
        campanhas: campanhasFiltradas.size,
        veiculos: veiculosFiltrados.size,
        insercoes: totalInsercoes,
        impactos: totalImpactos,
        investimento: totalInvestimento
      },
      campanhas: Array.from(campanhasSet).sort(),
      agencias: Array.from(agenciasSet).sort(),
      pracas: Array.from(pracasSet).sort(),
      pracasCategorized: pracasCategorized,
      tiposCompra: tiposCompraSet
    }
  }, [data, filtroCampanha, filtroAgencia, filtroPraca])

  const toggleMeio = (meio: string) => {
    setExpandedMeios((prev) => ({ ...prev, [meio]: !prev[meio] }))
  }

  const togglePraca = (meioNome: string, pracaKey: string) => {
    const key = `${meioNome}-${pracaKey}`
    setExpandedPracas((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const limparFiltros = () => {
    setFiltroCampanha("")
    setFiltroAgencia("")
    setFiltroPraca("")
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
            <p className="text-gray-600">Análise de inserções e impactos em mídias tradicionais</p>
          </div>
        </div>
        <div className="text-sm text-gray-600 bg-white/80 backdrop-blur-sm px-3 py-1 rounded-lg">
          Última atualização: {new Date().toLocaleString("pt-BR")}
        </div>
      </div>

      {/* Filtros */}
      <div className="card-overlay rounded-lg shadow-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Campanha</label>
            <select
              value={filtroCampanha}
              onChange={(e) => setFiltroCampanha(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Todas</option>
              {processedData.campanhas.map((campanha) => (
                <option key={campanha} value={campanha}>
                  {campanha}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Agência</label>
            <select
              value={filtroAgencia}
              onChange={(e) => setFiltroAgencia(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Praça</label>
            <select
              value={filtroPraca}
              onChange={(e) => setFiltroPraca(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Todas</option>

              {processedData.pracasCategorized["Abrangência"].length > 0 && (
                <optgroup label="Abrangência">
                  {processedData.pracasCategorized["Abrangência"].map((praca) => (
                    <option key={praca} value={praca}>
                      {praca}
                    </option>
                  ))}
                </optgroup>
              )}

              {processedData.pracasCategorized["Regiões"].length > 0 && (
                <optgroup label="Regiões">
                  {processedData.pracasCategorized["Regiões"].map((praca) => (
                    <option key={praca} value={praca}>
                      {praca}
                    </option>
                  ))}
                </optgroup>
              )}

              {processedData.pracasCategorized["Estados"].length > 0 && (
                <optgroup label="Estados">
                  {processedData.pracasCategorized["Estados"].map((praca) => (
                    <option key={praca} value={praca}>
                      {praca}
                    </option>
                  ))}
                </optgroup>
              )}

              {processedData.pracasCategorized["Cidades"].length > 0 && (
                <optgroup label="Cidades">
                  {processedData.pracasCategorized["Cidades"].map((praca) => (
                    <option key={praca} value={praca}>
                      {praca}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
        </div>
        {(filtroCampanha || filtroAgencia || filtroPraca) && (
          <div className="mt-4 flex justify-end">
            <button
              onClick={limparFiltros}
              className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
            >
              Limpar Filtros
            </button>
          </div>
        )}
      </div>

      {/* Métricas Gerais */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card-overlay rounded-lg shadow-lg p-6 flex items-center space-x-4">
          <div className="p-3 bg-purple-100 rounded-full">
            <FileText className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <div className="text-sm text-gray-600">Campanhas/Projetos</div>
            <div className="text-2xl font-bold text-gray-900">{processedData.totais.campanhas}</div>
          </div>
        </div>
        <div className="card-overlay rounded-lg shadow-lg p-6 flex items-center space-x-4">
          <div className="p-3 bg-orange-100 rounded-full">
            <Radio className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <div className="text-sm text-gray-600">Veículos</div>
            <div className="text-2xl font-bold text-gray-900">{processedData.totais.veiculos}</div>
          </div>
        </div>
        <div className="card-overlay rounded-lg shadow-lg p-6 flex items-center space-x-4">
          <div className="p-3 bg-green-100 rounded-full">
            <TrendingUp className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <div className="text-sm text-gray-600">Entrega</div>
            <div className="text-2xl font-bold text-gray-900">{formatNumber(processedData.totais.insercoes)}</div>
          </div>
        </div>
        <div className="card-overlay rounded-lg shadow-lg p-6 flex items-center space-x-4">
          <div className="p-3 bg-blue-100 rounded-full">
            <TrendingUp className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <div className="text-sm text-gray-600">Investimento Total</div>
            <div className="text-2xl font-bold text-gray-900">{formatCurrency(processedData.totais.investimento)}</div>
          </div>
        </div>
      </div>

      {/* Conteúdo Principal */}
      <div className="flex-1 card-overlay rounded-lg shadow-lg p-6 overflow-auto">
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
                    <p className="text-gray-500">Entrega</p>
                    <p className="font-semibold text-gray-800">{formatNumber(meio.totalInsercoes)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Investimento</p>
                    <p className="font-semibold text-gray-800">{formatCurrency(meio.totalInvestimento)}</p>
                  </div>
                </div>
              </div>

              {expandedMeios[meio.nome] && (
                <div className="p-4 space-y-3 bg-white">
                  {Object.entries(meio.pracas).map(([pracaKey, praca]) => (
                    <div key={pracaKey} className="border border-gray-100 rounded-md">
                      <div
                        className="flex items-center justify-between p-3 bg-gray-25 hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => togglePraca(meio.nome, pracaKey)}
                      >
                        <div className="flex items-center space-x-3">
                          {expandedPracas[`${meio.nome}-${pracaKey}`] ? (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                          )}
                          <h4 className="text-md font-medium text-gray-800">
                            {praca.nome}
                          </h4>
                        </div>
                        <div className="flex space-x-4 text-sm text-right">
                          <div>
                            <p className="text-gray-500">Entrega</p>
                            <p className="font-medium text-gray-700">{formatNumber(praca.totalInsercoes)}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Investimento</p>
                            <p className="font-medium text-gray-700">{formatCurrency(praca.totalInvestimento)}</p>
                          </div>
                        </div>
                      </div>

                      {expandedPracas[`${meio.nome}-${pracaKey}`] && (
                        <div className="p-3">
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-gray-200">
                                  <th className="text-left py-2 px-3 font-semibold text-gray-600">Veículo</th>
                                  <th className="text-left py-2 px-3 font-semibold text-gray-600">Campanha/Projeto</th>
                                  <th className="text-left py-2 px-3 font-semibold text-gray-600">Tipo de Compra</th>
                                  <th className="text-right py-2 px-3 font-semibold text-gray-600">Entrega</th>
                                  <th className="text-right py-2 px-3 font-semibold text-gray-600">Investimento</th>
                                </tr>
                              </thead>
                              <tbody>
                                {Object.entries(praca.veiculos).map(([veiculoNome, veiculo]) => (
                                  <tr
                                    key={veiculoNome}
                                    className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50"
                                  >
                                    <td className="py-2 px-3 text-gray-800">{veiculoNome}</td>
                                    <td className="py-2 px-3 text-gray-600">{veiculo.campanha}</td>
                                    <td className="py-2 px-3 text-gray-600">{veiculo.tipoCompra}</td>
                                    <td className="py-2 px-3 text-right font-medium text-green-700">
                                      {formatNumber(veiculo.insercoes)}
                                    </td>
                                    <td className="py-2 px-3 text-right font-medium text-blue-700">
                                      {formatCurrency(veiculo.investimento)}
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

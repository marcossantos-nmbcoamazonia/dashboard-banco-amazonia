"use client"

import type React from "react"
import { useState } from "react"
import { Search, BookOpen } from "lucide-react"

interface GlossaryTerm {
  term: string
  definition: string
}

const glossaryTerms: GlossaryTerm[] = [
  {
    term: "CPM (Custo por Mil Impressões)",
    definition:
      "Métrica que indica quanto você paga por cada mil visualizações do seu anúncio. É uma das principais formas de precificação em publicidade digital.",
  },
  {
    term: "CPC (Custo por Clique)",
    definition:
      "Valor pago cada vez que alguém clica no seu anúncio. É uma métrica fundamental para campanhas focadas em direcionamento de tráfego.",
  },
  {
    term: "CTR (Taxa de Cliques)",
    definition:
      "Percentual de pessoas que clicaram no seu anúncio em relação ao número total de pessoas que o viram. Indica a relevância e atratividade do seu conteúdo.",
  },
  {
    term: "VTR (View Through Rate)",
    definition:
      "Taxa que mede quantas pessoas assistiram seu vídeo até o final em relação ao número total de visualizações iniciadas.",
  },
  {
    term: "Impressões",
    definition: "Número total de vezes que seu anúncio foi exibido, independentemente de ter sido clicado ou não.",
  },
  {
    term: "Alcance",
    definition: "Número de pessoas únicas que viram seu anúncio pelo menos uma vez durante o período da campanha.",
  },
  {
    term: "Frequência",
    definition: "Número médio de vezes que cada pessoa viu seu anúncio. Calculada dividindo impressões pelo alcance.",
  },
  {
    term: "Engajamento",
    definition:
      "Interações dos usuários com seu conteúdo, incluindo curtidas, comentários, compartilhamentos e cliques.",
  },
  {
    term: "Taxa de Engajamento",
    definition:
      "Percentual de engajamento em relação ao alcance ou impressões. Indica o nível de interesse do público no seu conteúdo.",
  },
  {
    term: "ROAS (Return on Ad Spend)",
    definition:
      "Retorno sobre o investimento em publicidade. Mostra quantos reais de receita você obteve para cada real investido em anúncios.",
  },
  {
    term: "Sistema de Pontuação Personalizado para Criativos",
    definition:
      "Essa fórmula complexa atua como um sistema de pontuação para suas campanhas de marketing, gerando um valor entre 0 e 1, onde 0 é a nota mínima e 1 a máxima. Ela avalia uma combinação de três métricas essenciais: uma de custo (como CPM ou CPC) e duas de taxa (como CTR ou VTR). A escolha dessas métricas é feita com base nas características de formato e tipo de compra da sua campanha. No final, a fórmula calcula uma média ponderada dessas pontuações, gerando uma nota que ajuda a classificar e identificar os melhores criativos.",
  },
]

const Glossario: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState("")

  const filteredTerms = glossaryTerms.filter(
    (item) =>
      item.term.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.definition.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-4">
            <BookOpen className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Glossário</h1>
          </div>
          <p className="text-gray-600">
            Definições e explicações dos principais termos utilizados em marketing digital e análise de dados.
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar termos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Glossary Terms */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6">
            {filteredTerms.length > 0 ? (
              <div className="space-y-6">
                {filteredTerms.map((item, index) => (
                  <div key={index} className="border-b border-gray-100 last:border-b-0 pb-6 last:pb-0">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{item.term}</h3>
                    <p className="text-gray-600 leading-relaxed">{item.definition}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">Nenhum termo encontrado para "{searchTerm}"</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">Total de {glossaryTerms.length} termos disponíveis</p>
        </div>
      </div>
    </div>
  )
}

export default Glossario

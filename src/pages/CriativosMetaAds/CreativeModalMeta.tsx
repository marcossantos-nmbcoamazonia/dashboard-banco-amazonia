"use client"

import type React from "react"
import { X } from "lucide-react"
import { PostEmbed } from "./components/PostEmbed"
import type { CreativeData } from "../../types/index"

interface CreativeModalProps {
  creative: CreativeData | null
  isOpen: boolean
  onClose: () => void
}

const CreativeModalMeta: React.FC<CreativeModalProps> = ({ creative, isOpen, onClose }) => {
  if (!isOpen || !creative) return null

  const formatNumber = (value: number): string => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`
    }
    return value.toLocaleString("pt-BR")
  }

  const formatCurrency = (value: number): string => {
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    })
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header do Modal */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-900 mb-1">{creative.adName}</h2>
            <p className="text-sm text-gray-600">{creative.campaignName}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Área do Criativo */}
            <div className="space-y-4">
              <div
                className="relative bg-gray-100 rounded-lg overflow-hidden"
                style={{ aspectRatio: "9/16", maxHeight: "500px" }}
              >
                {creative.linkToPromotedInstagramPost ? (
                  <PostEmbed url={creative.linkToPromotedInstagramPost} />
                ) : creative.adCreativeImageUrl || creative.adCreativeThumbnailUrl ? (
                  <img
                    src={creative.adCreativeImageUrl || creative.adCreativeThumbnailUrl || "/placeholder.svg"}
                    alt="Criativo"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement
                      target.style.display = "none"
                      if (target.parentElement) {
                        target.parentElement.innerHTML = '<div class="text-gray-400 text-xs">Sem imagem</div>'
                      }
                    }}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center text-gray-400">
                      <div className="text-lg mb-2">Sem mídia disponível</div>
                      <div className="text-sm">ID: {creative.adName}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Informações do Criativo */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-2">Informações do Pin</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Ad ID:</span>
                    <span className="font-mono text-gray-900">{creative.adName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Campanha:</span>
                    <span className="text-gray-900 text-right max-w-[200px] truncate">{creative.campaignName}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Métricas de Performance */}
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900">Performance</h3>

              {/* Métricas Principais */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-red-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-red-600">{formatCurrency(creative.cost)}</div>
                  <div className="text-sm text-gray-600">Investimento</div>
                </div>
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-blue-600">{formatNumber(creative.impressions)}</div>
                  <div className="text-sm text-gray-600">Impressões</div>
                </div>
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-green-600">{formatNumber(creative.linkClicks)}</div>
                  <div className="text-sm text-gray-600">Cliques no Link</div>
                </div>
                <div className="bg-purple-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-purple-600">{(creative.cpc || 0).toFixed(2)}%</div>
                  <div className="text-sm text-gray-600">CPC</div>
                </div>
              </div>

              {/* Métricas Detalhadas */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3">Métricas Detalhadas</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Alcance:</span>
                    <span className="font-semibold">{formatNumber(creative.reach)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Frequência:</span>
                    <span className="font-semibold">{(creative.frequency || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Engajamentos:</span>
                    <span className="font-semibold">{formatNumber(creative.pageEngagements)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Visualizações 25%:</span>
                    <span className="font-semibold">{formatNumber(creative.videoWatches25)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Visualizações 50%:</span>
                    <span className="font-semibold">{formatNumber(creative.videoWatches50)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Visualizações 75%:</span>
                    <span className="font-semibold">{formatNumber(creative.videoWatches75)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Visualizações 100%:</span>
                    <span className="font-semibold">{formatNumber(creative.videoWatches100)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer do Modal */}
        <div className="border-t p-4 bg-gray-50 rounded-b-lg">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">Última atualização: {new Date().toLocaleString("pt-BR")}</div>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CreativeModalMeta
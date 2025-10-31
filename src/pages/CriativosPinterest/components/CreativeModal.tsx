"use client"

import type React from "react"
import { useState } from "react"
import { X, Play, Pause, Volume2, VolumeX } from "lucide-react"

interface CreativeData {
  date: string
  advertiserName: string
  campaignName: string
  adGroupName: string
  adId: string
  destinationUrl: string
  promotedPinName: string
  promotedPinStatus: string
  creativeType: string
  impressions: number
  reach: number
  frequency: number
  clicks: number
  ctr: number
  outboundClicks: number
  cpm: number
  cpc: number
  cost: number
  videoStartsPaid: number
  videoViewsPaid: number
  videoAvgWatchTime: number
  videoViews100Paid: number
  videoViews25Paid: number
  videoViews50Paid: number
  videoViews75Paid: number
  engagements: number
  mediaUrl?: string
}

interface CreativeModalProps {
  creative: CreativeData | null
  isOpen: boolean
  onClose: () => void
}

// Componente de gráfico de retenção de vídeo
const VideoRetentionChart: React.FC<{ creative: CreativeData }> = ({ creative }) => {
  const formatNumber = (value: number): string => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)} mi`
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(0)} mil`
    }
    return value.toLocaleString("pt-BR")
  }

  const formatCurrency = (value: number): string => {
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    })
  }

  // Calcular percentuais de retenção
  const totalViews = creative.videoViewsPaid || creative.videoStartsPaid
  const retention25 = totalViews > 0 ? (creative.videoViews25Paid / totalViews) * 100 : 0
  const retention50 = totalViews > 0 ? (creative.videoViews50Paid / totalViews) * 100 : 0
  const retention75 = totalViews > 0 ? (creative.videoViews75Paid / totalViews) * 100 : 0
  const retention100 = totalViews > 0 ? (creative.videoViews100Paid / totalViews) * 100 : 0

  // VTR (Video Through Rate) - percentual de visualizações completas em relação às impressões
  const vtr = creative.impressions > 0 ? (creative.videoViews100Paid / creative.impressions) * 100 : 0

  // CPV (Cost Per View)
  const cpv = totalViews > 0 ? creative.cost / totalViews : 0

  // Determine if 25%, 50%, 75% data is available
  const hasIntermediateData =
    creative.videoViews25Paid > 0 || creative.videoViews50Paid > 0 || creative.videoViews75Paid > 0

  const retentionPoints = hasIntermediateData
    ? [
        { x: 0, y: 100, label: "Início", value: totalViews },
        { x: 25, y: retention25, label: "25%", value: creative.videoViews25Paid },
        { x: 50, y: retention50, label: "50%", value: creative.videoViews50Paid },
        { x: 75, y: retention75, label: "75%", value: creative.videoViews75Paid },
        { x: 100, y: retention100, label: "100%", value: creative.videoViews100Paid },
      ]
    : [
        { x: 0, y: 100, label: "Início", value: totalViews },
        { x: 100, y: retention100, label: "100%", value: creative.videoViews100Paid },
      ]

  const chartWidth = 400
  const chartHeight = 120
  const barWidth = hasIntermediateData ? 40 : 80
  const barSpacing = hasIntermediateData ? 25 : 120
  const totalBarsWidth = retentionPoints.length * barWidth + (retentionPoints.length - 1) * barSpacing
  const startX = (chartWidth - totalBarsWidth) / 2

  return (
    <div className="bg-red-50 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-red-600 rounded-full"></div>
          <h4 className="font-semibold text-gray-900">Pinterest</h4>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-600">VTR</div>
          <div className="text-xl font-bold text-red-600">{vtr.toFixed(2)}%</div>
        </div>
      </div>

      {/* Gráfico de barras */}
      <div className="relative h-40 bg-white rounded-lg p-4 mb-4 flex items-end justify-center">
        <svg width="100%" height="100%" viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="overflow-visible">
          {/* Y-axis labels */}
          {[0, 25, 50, 75, 100].map((value) => (
            <text key={value} x={-10} y={chartHeight - value + 3} textAnchor="end" className="text-xs fill-gray-500">
              {value}%
            </text>
          ))}

          {/* Bars */}
          {retentionPoints.map((point, i) => {
            const barHeight = (point.y / 100) * chartHeight
            const xPos = startX + i * (barWidth + barSpacing)
            const yPos = chartHeight - barHeight
            return (
              <g key={i}>
                <rect x={xPos} y={yPos} width={barWidth} height={barHeight} fill="#dc2626" rx="4" ry="4" />
                <text
                  x={xPos + barWidth / 2}
                  y={yPos - 5}
                  textAnchor="middle"
                  className="text-xs font-medium fill-red-600"
                >
                  {point.y.toFixed(2)}%
                </text>
                <text
                  x={xPos + barWidth / 2}
                  y={chartHeight + 15}
                  textAnchor="middle"
                  className="text-xs fill-gray-500"
                >
                  {point.label}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      {/* Métricas resumidas */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-gray-600">Total Views:</span>
          <span className="font-semibold ml-2">{formatNumber(totalViews)}</span>
        </div>
        <div>
          <span className="text-gray-600">Completions:</span>
          <span className="font-semibold ml-2">{formatNumber(creative.videoViews100Paid)}</span>
        </div>
        <div>
          <span className="text-gray-600">CPV:</span>
          <span className="font-semibold ml-2">{formatCurrency(cpv)}</span>
        </div>
        <div>
          <span className="text-gray-600">Investimento:</span>
          <span className="font-semibold ml-2">{formatCurrency(creative.cost)}</span>
        </div>
      </div>

      {/* Métricas detalhadas */}
      <div className="mt-4 pt-4 border-t border-red-200">
        <h5 className="font-medium text-gray-900 mb-3">Métricas Detalhadas</h5>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Reproduções:</span>
            <span className="font-semibold">{formatNumber(creative.videoStartsPaid)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Visualizações:</span>
            <span className="font-semibold">{formatNumber(creative.videoViewsPaid)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Tempo Médio:</span>
            <span className="font-semibold">{creative.videoAvgWatchTime.toFixed(1)}s</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">25% Completos:</span>
            <span className="font-semibold">{formatNumber(creative.videoViews25Paid)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">50% Completos:</span>
            <span className="font-semibold">{formatNumber(creative.videoViews50Paid)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">75% Completos:</span>
            <span className="font-semibold">{formatNumber(creative.videoViews75Paid)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">100% Completos:</span>
            <span className="font-semibold">{formatNumber(creative.videoViews100Paid)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

const CreativeModal: React.FC<CreativeModalProps> = ({ creative, isOpen, onClose }) => {
  const [isVideoPlaying, setIsVideoPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(true)

  if (!isOpen || !creative) return null

  const isVideo =
    creative.creativeType?.toLowerCase().includes("video") ||
    creative.videoStartsPaid > 0 ||
    creative.videoViewsPaid > 0

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
            <h2 className="text-xl font-bold text-gray-900 mb-1">{creative.promotedPinName}</h2>
            <p className="text-sm text-gray-600">{creative.campaignName}</p>
            <div className="flex items-center mt-2 space-x-4">
              <span
                className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                  creative.promotedPinStatus === "ACTIVE"
                    ? "bg-green-100 text-green-800"
                    : creative.promotedPinStatus === "PAUSED"
                      ? "bg-yellow-100 text-yellow-800"
                      : "bg-gray-100 text-gray-800"
                }`}
              >
                {creative.promotedPinStatus || "N/A"}
              </span>
              <span className="text-xs text-gray-500">{creative.creativeType || "REGULAR"}</span>
              {isVideo && <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full">VÍDEO</span>}
            </div>
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
                {creative.mediaUrl ? (
                  <div className="relative w-full h-full">
                    <iframe
                      src={creative.mediaUrl}
                      className="w-full h-full"
                      frameBorder="0"
                      allow="autoplay; encrypted-media"
                      sandbox="allow-scripts allow-same-origin allow-presentation"
                      onError={(e) => {
                        console.error(`Erro ao carregar mídia para Ad ID: ${creative.adId}`, e)
                        const target = e.target as HTMLIFrameElement
                        if (target.parentElement) {
                          target.parentElement.innerHTML = `
                            <div class="flex items-center justify-center h-full">
                              <div class="text-center text-gray-400">
                                <div class="text-lg mb-2">Mídia não disponível</div>
                                <div class="text-sm">ID: ${creative.adId}</div>
                              </div>
                            </div>
                          `
                        }
                      }}
                    />

                    {/* Controles de vídeo (se for vídeo) */}
                    {isVideo && (
                      <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between bg-black bg-opacity-50 rounded-lg p-2">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => setIsVideoPlaying(!isVideoPlaying)}
                            className="p-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full transition-colors"
                          >
                            {isVideoPlaying ? (
                              <Pause className="w-4 h-4 text-white" />
                            ) : (
                              <Play className="w-4 h-4 text-white" />
                            )}
                          </button>
                          <button
                            onClick={() => setIsMuted(!isMuted)}
                            className="p-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full transition-colors"
                          >
                            {isMuted ? (
                              <VolumeX className="w-4 h-4 text-white" />
                            ) : (
                              <Volume2 className="w-4 h-4 text-white" />
                            )}
                          </button>
                        </div>
                        <div className="text-white text-xs bg-black bg-opacity-50 px-2 py-1 rounded">
                          Tempo médio: {creative.videoAvgWatchTime.toFixed(1)}s
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center text-gray-400">
                      <div className="text-lg mb-2">Sem mídia disponível</div>
                      <div className="text-sm">ID: {creative.adId}</div>
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
                    <span className="font-mono text-gray-900">{creative.adId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Grupo de Anúncios:</span>
                    <span className="text-gray-900 text-right max-w-[200px] truncate">{creative.adGroupName}</span>
                  </div>
                  {creative.destinationUrl && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">URL de Destino:</span>
                      <a
                        href={creative.destinationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-red-600 hover:text-red-700 text-right max-w-[200px] truncate"
                      >
                        Ver página
                      </a>
                    </div>
                  )}
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
                  <div className="text-2xl font-bold text-green-600">{formatNumber(creative.outboundClicks)}</div>
                  <div className="text-sm text-gray-600">Cliques no Link</div>
                </div>
                <div className="bg-purple-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-purple-600">{creative.ctr.toFixed(2)}%</div>
                  <div className="text-sm text-gray-600">CTR</div>
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
                    <span className="font-semibold">{creative.frequency.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Cliques Totais:</span>
                    <span className="font-semibold">{formatNumber(creative.clicks)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Engajamentos:</span>
                    <span className="font-semibold">{formatNumber(creative.engagements)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">CPM:</span>
                    <span className="font-semibold">{formatCurrency(creative.cpm)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">CPC:</span>
                    <span className="font-semibold">{formatCurrency(creative.cpc)}</span>
                  </div>
                </div>
              </div>

              {/* Gráfico de Retenção de Vídeo (se aplicável) */}
              {isVideo && <VideoRetentionChart creative={creative} />}
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

export default CreativeModal
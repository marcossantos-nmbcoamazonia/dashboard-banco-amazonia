// src/types/index.ts

export interface ProcessedData {
  date: string
  platform: string
  campaignName: string
  impressions: number
  cost: number
  reach: number
  clicks: number
  frequency: number
  cpm: number
  videoPlays: number
  videoCompletions: number
  linkToPromotedInstagramPost?: string
}

export interface CreativeData {
  date: string
  adName: string
  adCreativeImageUrl: string
  adCreativeThumbnailUrl: string
  campaignName: string
  reach: number
  frequency: number
  impressions: number
  cost: number
  linkClicks: number
  cpc: number
  pageEngagements: number
  postEngagements: number
  postReactions: number
  costPerPostEngagement: number
  videoWatches25: number
  videoWatches50: number
  videoWatches75: number
  videoWatches100: number
  videoPlayActions: number
  landingPageViews: number
  cpm: number
  pontuacaoCriativo?: number
  tipoCompra?: string
  videoEstaticoAudio?: string
  linkToPromotedInstagramPost?: string
}

// D3 Module declarations
declare module "d3" {
  export * from "d3-selection"
  export * from "d3-scale"
  export * from "d3-axis"
  export * from "d3-geo"
  // adicione outros módulos conforme necessário
}
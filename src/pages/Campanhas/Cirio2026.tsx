"use client"

import type React from "react"
import { Fragment, useRef, useState, useEffect, useMemo, useCallback } from "react"
import {
  DollarSign, MousePointerClick, Eye, Play, Sparkles, RefreshCw, Radio, ChevronRight, ChevronDown,
  Calendar, X, ArrowRight, Globe2, MapPin, Activity, Image as ImageIcon, MonitorPlay, Target,
  TrendingUp, Layers,
} from "lucide-react"
import axios from "axios"
import { ResponsiveLine } from "@nivo/line"
import Loading from "../../components/Loading/Loading"
import PDFDownloadButton from "../../components/PDFDownloadButton/PDFDownloadButton"
import BrazilMap from "../../components/BrazilMap/BrazilMap"
import { analyzeCirio2026 } from "../../services/gemini"
import { getCachedAnalysis, setCachedAnalysis } from "../../services/analysisCache"
import { parseGA4Int, parseGA4Rate, prettySource, normalizeRegionToPT, ufSigla, blueRamp } from "./custeioGa4"
import { ADSERVER_CIRIO_2026, buildAdServerUrl, type AdCampaign, type AdDailyPoint } from "./adserverGraphql"

// ─── Constantes ─────────────────────────────────────────────────────────────
// Planilha "Banco da Amazonia | Escala | Círio | 2026": consolidado (Meta + YouTube),
// GA4, GA4 - Region e Plano de Midia. Campanha SEM leads (alcance/visualização/tráfego).
const SHEET = "1xNvDBFUoPsS0g9h68vljLJ-XkBi-LTDX0dNwFy-_UQQ"
const SHEET_BASE = `https://nmbcoamazonia-api.vercel.app/google/sheets/${SHEET}/data`

// Paleta Escala (Banco da Amazônia)
const BLUE_DARK = "#2d6fa3"
const BLUE = "#3b7fb8"
const BLUE_LIGHT = "#4a9ece"

// Cores por veículo (gráfico de evolução: Redes + Display)
const VEICULO_COLOR: Record<string, string> = {
  Facebook: "#1877F2",
  Instagram: "#C13584",
  YouTube: "#FF0000",
  IDEAL: "#059669",
  "Zoox Midia": "#d97706",
}
const colorForVeiculo = (v: string, i: number) => VEICULO_COLOR[v] ?? ["#2d6fa3", "#3b7fb8", "#4a9ece", "#6bb5e0", "#7c3aed"][i % 5]

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface ConsolidadoRow {
  date: string
  adSetName: string
  adName: string
  cost: number
  impressions: number
  clicks: number
  videoViews: number
  videoCompletions: number
  veiculo: string
  placement: string
  image: string
  formato: string
}

interface GA4Row { date: string; newUsers: number; sessions: number; engagement: number; source: string; medium: string; bounce: number }
interface GA4RegionRow { date: string; region: string; sessions: number; city: string }

// ─── Helpers ──────────────────────────────────────────────────────────────────

const pacingColor = (pct: number): string => {
  const t = Math.min(pct, 100) / 100
  const r = Math.round(234 + (88  - 234) * t)
  const g = Math.round(179 + (28  - 179) * t)
  const b = Math.round(8   + (135 - 8  ) * t)
  return `rgb(${r},${g},${b})`
}

const parseNum = (v: unknown): number => {
  if (v === null || v === undefined || v === "" || v === "-") return 0
  if (typeof v === "number") return v
  const s = String(v).replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".")
  return parseFloat(s) || 0
}

// DD/MM/YYYY (consolidado e AdServer) ou ISO (GA4) → "YYYY-MM-DD"
const toISODate = (d: string): string => {
  if (!d) return ""
  if (d.includes("/")) {
    const [dd, mm, yy] = d.split("/")
    if (!dd || !mm || !yy) return ""
    return `${yy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`
  }
  return d.slice(0, 10)
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)

const formatNum = (v: number) =>
  new Intl.NumberFormat("pt-BR").format(Math.round(v))

const formatCompact = (v: number) =>
  new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(v)

const formatPct = (v: number) => `${(v * 100).toFixed(2)}%`

const formatDuration = (sec: number) => {
  if (!sec || sec < 0) return "0s"
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

// "2026-07-06" → "06/07"
const shortBR = (iso: string) => {
  const [, m, d] = iso.split("-")
  return d && m ? `${d}/${m}` : iso
}

// O "Session medium" do GA4 (= utm_medium) carrega a peça/formato, ex.:
// `320x50_cpm_cirio_2026`, `video_30"_cpv_cirio_2026`, `retangulo_medio_-_300x50_cpm_cirio_2026`.
// Separa o tipo de compra (badge) do rótulo do formato.
const MEDIUM_WORDS: Record<string, string> = {
  video: "vídeo", retangulo: "retângulo", medio: "médio", cirio: "Círio", cartao: "cartão",
  esta: "está", periodo: "período", qrcode: "QR Code",
}
const PURCHASE_TOKEN = /^(cpm|cpv|cpc|cpa)$/
const parseMedium = (raw: string): { label: string; tipo: string } => {
  const s = (raw || "").toLowerCase().trim().replace(/_?cirio_2026$/, "")
  if (!s || /^\(.*\)$/.test(s)) return { label: "", tipo: "" }
  const tokens = s.split(/_-_|_/).filter(Boolean)
  const tipo = (tokens.find((t) => PURCHASE_TOKEN.test(t)) ?? "").toUpperCase()
  const label = tokens.filter((t) => !PURCHASE_TOKEN.test(t)).map((t) => MEDIUM_WORDS[t] ?? t).join(" ")
  return { label: label ? label.charAt(0).toUpperCase() + label.slice(1) : "", tipo }
}

// Formato do placement no AdServer = utm_medium da URL de destino do criativo
const formatoFromUrl = (url: string | null): string => {
  const m = (url || "").match(/[?&]utm_medium=([^&]+)/)
  if (!m) return ""
  try { return parseMedium(decodeURIComponent(m[1])).label } catch { return parseMedium(m[1]).label }
}

// ─── AdServer: agregação ──────────────────────────────────────────────────────
// CPM (display): exposição e entrega = impressão.
// CPV (vídeo, Zoox): a API quase não registra impressão — a exposição é a view e a
// entrega contratada é o vídeo completo. CTR e viewability são calculados sobre a exposição.
type AdAgg = { impressions: number; clicks: number; viewables: number; views: number; starts: number; completes: number }
const blankAd = (): AdAgg => ({ impressions: 0, clicks: 0, viewables: 0, views: 0, starts: 0, completes: 0 })
const addAd = (a: AdAgg, x: AdDailyPoint) => {
  a.impressions += x.impressions || 0
  a.clicks += x.clicks || 0
  a.viewables += x.viewables || 0
  a.views += x.views || 0
  a.starts += x.starts || 0
  a.completes += x.completes || 0
}
const adMetrics = (a: AdAgg, isCPV: boolean) => {
  const exposicoes = isCPV ? a.views : a.impressions
  return {
    exposicoes,
    entregue: isCPV ? a.completes : a.impressions,
    ctr: exposicoes > 0 ? a.clicks / exposicoes : 0,
    viewability: exposicoes > 0 ? a.viewables / exposicoes : 0,
    vtr: a.views > 0 ? a.completes / a.views : 0,
  }
}

// ─── Componentes auxiliares ───────────────────────────────────────────────────

// Passo do funil (big number com sub-métrica)
interface FunnelStepProps { label: string; value: string; sub?: string; icon: React.ReactNode; tooltip?: string }
const FunnelStep: React.FC<FunnelStepProps> = ({ label, value, sub, icon, tooltip }) => (
  <div className="flex-1 min-w-[140px] relative group">
    <div className="rounded-xl p-3.5 h-full flex flex-col gap-1.5 border border-white/40 shadow-sm"
         style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.96), rgba(240,247,253,0.96))" }}>
      <div className="flex items-center gap-1.5">
        <div className="w-6 h-6 rounded-md flex items-center justify-center text-white shrink-0"
             style={{ background: `linear-gradient(135deg, ${BLUE}, ${BLUE_LIGHT})` }}>
          {icon}
        </div>
        <p className="text-[11px] text-gray-500 font-semibold uppercase tracking-wide leading-tight">{label}</p>
      </div>
      <p className="text-2xl font-bold text-gray-900 leading-none">{value}</p>
      {sub && <p className="text-[11px] text-gray-400 leading-tight">{sub}</p>}
    </div>
    {tooltip && (
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 bg-gray-900 text-white text-[10px] rounded-lg px-2.5 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 leading-relaxed">
        {tooltip}
      </div>
    )}
  </div>
)

// Barra horizontal de magnitude (ranking) — hue sequencial azul
const RankBar: React.FC<{ label: string; value: number; max: number; total: number; t: number; suffix?: string }> =
  ({ label, value, max, total, t, suffix }) => {
    const w = max > 0 ? (value / max) * 100 : 0
    const pct = total > 0 ? (value / total) * 100 : 0
    return (
      <div className="group">
        <div className="flex items-center justify-between mb-1 gap-2">
          <span className="text-xs text-gray-700 font-medium truncate">{label}</span>
          <span className="text-xs font-bold text-gray-900 shrink-0 tabular-nums">
            {formatNum(value)}{suffix} <span className="text-gray-400 font-normal">· {pct.toFixed(1)}%</span>
          </span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(w, 2)}%`, backgroundColor: blueRamp(t) }} />
        </div>
      </div>
    )
  }

// Miniatura do criativo: tenta as fontes em ordem (imagem local de /public/creatives
// primeiro; depois uma URL de imagem, se a planilha trouxer) e cai em "Sem imagem".
const CreativeThumb: React.FC<{ sources: (string | null | undefined)[]; alt: string }> = ({ sources, alt }) => {
  const list = sources.filter((s): s is string => !!s)
  const listKey = list.join("|")
  const [idx, setIdx] = useState(0)
  useEffect(() => { setIdx(0) }, [listKey]) // reseta ao trocar de criativo
  const current = list[idx]
  if (!current) {
    return (
      <div className="w-full aspect-square rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 flex flex-col items-center justify-center gap-1">
        <ImageIcon className="w-7 h-7 text-blue-300" />
        <span className="text-[10px] text-blue-400 font-medium">Sem imagem</span>
      </div>
    )
  }
  return (
    <img src={current} alt={alt} loading="lazy" onError={() => setIdx((i) => i + 1)}
         className="w-full aspect-square rounded-lg object-cover bg-gray-100" />
  )
}

// Badge do tipo de compra
const TipoBadge: React.FC<{ tipo: string }> = ({ tipo }) => {
  if (!tipo) return null
  const cls = tipo === "CPM" ? "bg-indigo-100 text-indigo-700"
    : tipo === "CPV" ? "bg-teal-100 text-teal-700"
    : tipo === "CPC" ? "bg-rose-100 text-rose-700"
    : "bg-gray-100 text-gray-600"
  return <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0 ${cls}`}>{tipo}</span>
}

// ─── Página principal ─────────────────────────────────────────────────────────

const Cirio2026: React.FC = () => {
  const contentRef = useRef<HTMLDivElement>(null)
  const [consolidado, setConsolidado] = useState<ConsolidadoRow[]>([])
  const [ga4, setGa4] = useState<GA4Row[]>([])
  const [ga4Region, setGa4Region] = useState<GA4RegionRow[]>([])
  const [planoRaw, setPlanoRaw] = useState<string[][]>([])
  const [adCampaign, setAdCampaign] = useState<AdCampaign | null>(null)
  const [loading, setLoading] = useState(true)
  const [aiAnalysis, setAiAnalysis] = useState<string>("")
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: "", end: "" })
  const [expandedSites, setExpandedSites] = useState<Record<string, boolean>>({})
  const [collapsedMeios, setCollapsedMeios] = useState<Record<string, boolean>>({})
  const [creativeSort, setCreativeSort] = useState<"impressions" | "videoViews" | "ctr" | "cost">("impressions")
  const [creativeVeiculo, setCreativeVeiculo] = useState<string>("Todos")
  const [selectedCreative, setSelectedCreative] = useState<string | null>(null) // Ad Name do criativo aberto no modal
  const [modalMetric, setModalMetric] = useState<"impressions" | "clicks" | "videoViews" | "cost">("impressions")
  // Gráfico de evolução (Redes + Display): métrica + filtro por veículo
  type EvoMetric = "impressions" | "clicks" | "ctr" | "videoViews" | "cost" | "viewability"
  const [chartMetric, setChartMetric] = useState<EvoMetric>("impressions")
  const [evoVeiculo, setEvoVeiculo] = useState<string>("") // "" = todos os veículos

  // ─── Fetch (Consolidado + GA4 x2 + Plano de Mídia + AdServer) ────────────────
  // Cada fonte tem fallback próprio: a falha de uma não derruba as outras.
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const [consRes, ga4Res, ga4RgRes, planoRes, adRes] = await Promise.all([
          axios.get(`${SHEET_BASE}?range=consolidado`).catch(() => ({ data: { success: false } })),
          axios.get(`${SHEET_BASE}?range=GA4`).catch(() => ({ data: { success: false } })),
          axios.get(`${SHEET_BASE}?range=GA4%20-%20Region`).catch(() => ({ data: { success: false } })),
          axios.get(`${SHEET_BASE}?range=Plano%20de%20Midia`).catch(() => ({ data: { success: false } })),
          axios.get(buildAdServerUrl(ADSERVER_CIRIO_2026.filterB64)).catch(() => ({ data: { campaigns: null } })),
        ])

        // Consolidado — Meta (Facebook/Instagram) + YouTube.
        // Nesta planilha a coluna "Image" traz o POSICIONAMENTO (ex.: "facebook_reels",
        // "Feed: News Feed"), não uma URL — só é tratada como imagem se começar com http.
        if (consRes.data?.success && consRes.data?.data?.values) {
          const rows: any[][] = consRes.data.data.values
          const header = rows[0]
          const idx = (col: string) => header.indexOf(col)
          const iVeic = idx("Veículo") >= 0 ? idx("Veículo") : 14 // acento gera mismatch de índice em alguns ambientes
          const iImage = idx("Image")
          const parsed: ConsolidadoRow[] = rows.slice(1).map((r) => {
            const rawImage = String(r[iImage] || "")
            const isUrl = /^https?:\/\//i.test(rawImage)
            return {
              date: r[idx("Date")] || "",
              adSetName: r[idx("Ad Set Name")] || "",
              adName: r[idx("Ad Name")] || "",
              cost: parseNum(r[idx("Cost")] ?? "0"),
              impressions: parseNum(r[idx("Impressions")] || "0"),
              clicks: parseNum(r[idx("Clicks")] || "0"),
              videoViews: parseNum(r[idx("Video views")] || "0"),
              videoCompletions: parseNum(r[idx("Video completions")] || "0"),
              veiculo: r[iVeic] || "",
              placement: isUrl ? "" : rawImage,
              image: isUrl ? rawImage : "",
              formato: r[idx("video_estatico_audio")] || "",
            }
          })
          // Linhas "unknown" do Meta sem custo nem impressão são ruído (só views residuais)
          setConsolidado(parsed.filter((r) => !(/^unknown$/i.test(r.veiculo) && r.cost === 0 && r.impressions === 0)))
        }

        // GA4 — sessões (a aba já vem filtrada pela campanha 2026_cirio_2026)
        if (ga4Res.data?.success && ga4Res.data?.data?.values) {
          const rows: string[][] = ga4Res.data.data.values
          const h = rows[0]
          const gi = (c: string) => h.indexOf(c)
          const iNew = gi("New users"), iSess = gi("Sessions"), iEng = gi("User engagement")
          const iSrc = gi("Session source"), iMed = gi("Session medium"), iBounce = gi("Bounce rate")
          setGa4(rows.slice(1).map((r) => ({
            date: (r[0] || "").slice(0, 10),
            newUsers: parseGA4Int(r[iNew]),
            sessions: parseGA4Int(r[iSess]),
            engagement: parseGA4Int(r[iEng]),
            source: r[iSrc] || "",
            medium: iMed >= 0 ? (r[iMed] || "") : "",
            bounce: parseGA4Rate(r[iBounce]),
          })))
        }
        // GA4 — regiões e cidades
        if (ga4RgRes.data?.success && ga4RgRes.data?.data?.values) {
          const rows: string[][] = ga4RgRes.data.data.values
          const h = rows[0]
          const iRg = h.indexOf("Region"), iSs = h.indexOf("Sessions"), iCity = h.indexOf("City")
          setGa4Region(rows.slice(1).map((r) => ({
            date: (r[0] || "").slice(0, 10),
            region: r[iRg] || "",
            sessions: parseGA4Int(r[iSs]),
            city: iCity >= 0 ? (r[iCity] || "") : "",
          })))
        }

        if (planoRes.data?.success && planoRes.data?.data?.values) setPlanoRaw(planoRes.data.data.values)

        // AdServer — a query retorna `campaigns` (array); filtramos por 1 campaign_id.
        const camp = adRes.data?.campaigns?.[0]
        if (camp) setAdCampaign(camp)
      } catch (err) {
        console.error("Erro ao buscar dados Círio 2026:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  // ─── Filtro de período ───────────────────────────────────────────────────────
  const inDateRange = useCallback(
    (rawDate: string): boolean => {
      if (!dateRange.start && !dateRange.end) return true
      const iso = toISODate(rawDate)
      if (!iso) return false
      if (dateRange.start && iso < dateRange.start) return false
      if (dateRange.end && iso > dateRange.end) return false
      return true
    },
    [dateRange]
  )

  // ─── Redes Sociais (consolidado) ─────────────────────────────────────────────
  const consolidadoPorData = useMemo(
    () => consolidado.filter((r) => inDateRange(r.date)),
    [consolidado, inDateRange]
  )

  const redesTotals = useMemo(() => {
    const t = consolidadoPorData.reduce(
      (acc, r) => ({
        cost: acc.cost + r.cost,
        impressions: acc.impressions + r.impressions,
        clicks: acc.clicks + r.clicks,
        videoViews: acc.videoViews + r.videoViews,
        videoCompletions: acc.videoCompletions + r.videoCompletions,
      }),
      { cost: 0, impressions: 0, clicks: 0, videoViews: 0, videoCompletions: 0 }
    )
    return {
      ...t,
      ctr: t.impressions > 0 ? t.clicks / t.impressions : 0,
      cpm: t.impressions > 0 ? (t.cost / t.impressions) * 1000 : 0,
      vtr: t.videoViews > 0 ? t.videoCompletions / t.videoViews : 0,
    }
  }, [consolidadoPorData])
  const hasRedes = consolidadoPorData.length > 0

  const veiculos = useMemo(
    () => Array.from(new Set(consolidadoPorData.map((r) => r.veiculo).filter(Boolean))),
    [consolidadoPorData]
  )

  const byVeiculo = useMemo(() => {
    const map = new Map<string, { cost: number; impressions: number; clicks: number; videoViews: number; videoCompletions: number; ctr: number; cpm: number; vtr: number }>()
    veiculos.forEach((v) => {
      const t = consolidadoPorData.filter((r) => r.veiculo === v).reduce(
        (acc, r) => ({
          cost: acc.cost + r.cost, impressions: acc.impressions + r.impressions, clicks: acc.clicks + r.clicks,
          videoViews: acc.videoViews + r.videoViews, videoCompletions: acc.videoCompletions + r.videoCompletions,
        }),
        { cost: 0, impressions: 0, clicks: 0, videoViews: 0, videoCompletions: 0 }
      )
      map.set(v, {
        ...t,
        ctr: t.impressions > 0 ? t.clicks / t.impressions : 0,
        cpm: t.impressions > 0 ? (t.cost / t.impressions) * 1000 : 0,
        vtr: t.videoViews > 0 ? t.videoCompletions / t.videoViews : 0,
      })
    })
    return map
  }, [consolidadoPorData, veiculos])

  // ─── Criativos (Redes) ───────────────────────────────────────────────────────
  // Nesta planilha o Ad Name é a peça (ex.: "VIDEO-TEM-CIRIO-TEM-MOVIMENTO_1080X1080_PA_...")
  // e o Ad Set é o público. A imagem vem de /public/creatives/<Ad Name>.png quando existir.
  const creativeVeiculos = useMemo(
    () => Array.from(new Set(consolidadoPorData.filter((r) => r.adName).map((r) => r.veiculo).filter(Boolean))),
    [consolidadoPorData]
  )

  const creatives = useMemo(() => {
    type Agg = { key: string; image: string; veiculos: Set<string>; placements: Set<string>; formato: string; impressions: number; clicks: number; cost: number; videoViews: number; videoCompletions: number }
    const map = new Map<string, Agg>()
    consolidadoPorData.forEach((r) => {
      const key = r.adName
      if (!key) return
      if (creativeVeiculo !== "Todos" && r.veiculo !== creativeVeiculo) return
      const cur = map.get(key) ?? { key, image: "", veiculos: new Set<string>(), placements: new Set<string>(), formato: "", impressions: 0, clicks: 0, cost: 0, videoViews: 0, videoCompletions: 0 }
      cur.impressions += r.impressions
      cur.clicks += r.clicks
      cur.cost += r.cost
      cur.videoViews += r.videoViews
      cur.videoCompletions += r.videoCompletions
      if (r.veiculo) cur.veiculos.add(r.veiculo)
      if (r.placement) cur.placements.add(r.placement)
      if (!cur.image && r.image) cur.image = r.image
      if (!cur.formato && r.formato) cur.formato = r.formato
      map.set(key, cur)
    })
    const arr = Array.from(map.values()).map((c) => {
      const veics = Array.from(c.veiculos)
      return {
        key: c.key,
        // Ad Name genérico (ex.: "Video" do YouTube) ganha o veículo como prefixo
        name: /_/.test(c.key) ? c.key : `${veics[0] ? `${veics[0]} · ` : ""}${c.key}`,
        image: c.image,
        localImage: `/creatives/${c.key}.png`,
        veiculos: veics,
        placements: Array.from(c.placements),
        formato: c.formato,
        impressions: c.impressions, clicks: c.clicks, cost: c.cost,
        videoViews: c.videoViews, videoCompletions: c.videoCompletions,
        ctr: c.impressions > 0 ? c.clicks / c.impressions : 0,
        vtr: c.videoViews > 0 ? c.videoCompletions / c.videoViews : 0,
        cpm: c.impressions > 0 ? (c.cost / c.impressions) * 1000 : 0,
      }
    })
    arr.sort((a, b) => {
      if (creativeSort === "ctr") return b.ctr - a.ctr
      if (creativeSort === "videoViews") return b.videoViews - a.videoViews
      if (creativeSort === "cost") return b.cost - a.cost
      return b.impressions - a.impressions
    })
    return arr
  }, [consolidadoPorData, creativeSort, creativeVeiculo])

  // Criativo aberto no modal + sua série diária
  const activeCreative = useMemo(
    () => (selectedCreative ? creatives.find((c) => c.key === selectedCreative) ?? null : null),
    [selectedCreative, creatives]
  )

  const creativeDaily = useMemo(() => {
    if (!selectedCreative) return [] as { iso: string; impressions: number; clicks: number; videoViews: number; cost: number }[]
    const map = new Map<string, { impressions: number; clicks: number; videoViews: number; cost: number }>()
    consolidadoPorData.forEach((r) => {
      if (r.adName !== selectedCreative) return
      const iso = toISODate(r.date)
      if (!iso) return
      const cur = map.get(iso) ?? { impressions: 0, clicks: 0, videoViews: 0, cost: 0 }
      cur.impressions += r.impressions; cur.clicks += r.clicks; cur.videoViews += r.videoViews; cur.cost += r.cost
      map.set(iso, cur)
    })
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([iso, v]) => ({ iso, ...v }))
  }, [selectedCreative, consolidadoPorData])

  const modalMetricLabel: Record<typeof modalMetric, string> = { impressions: "Impressões", clicks: "Cliques", videoViews: "Visualizações", cost: "Investimento" }
  const modalLineData = useMemo(
    () => [{ id: modalMetricLabel[modalMetric], color: BLUE, data: creativeDaily.map((d) => ({ x: shortBR(d.iso), y: d[modalMetric] })) }],
    [creativeDaily, modalMetric] // eslint-disable-line react-hooks/exhaustive-deps
  )
  const modalTicks = useMemo(() => {
    const xs = creativeDaily.map((d) => shortBR(d.iso))
    const step = Math.ceil(xs.length / 8) || 1
    return xs.filter((_, i) => i % step === 0)
  }, [creativeDaily])

  // Fecha o modal de criativo com Escape
  useEffect(() => {
    if (!selectedCreative) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setSelectedCreative(null) }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [selectedCreative])

  // ─── AdServer (Display + vídeo programático) ─────────────────────────────────
  const adSites = useMemo(() => {
    if (!adCampaign) return []
    return (adCampaign.sites || []).map((s) => {
      let contratado = 0
      let tipo = ""
      const total = blankAd()
      const byDay = new Map<string, AdAgg>()
      const placements: { id: number; formato: string; agg: AdAgg }[] = []
      ;(s.channels || []).forEach((ch) => {
        contratado += ch.channel_purchased_quantity || 0
        ;(ch.placements || []).forEach((p) => {
          if (!tipo) tipo = (p.purchase_type?.purchase_type_format || "").toUpperCase()
          const agg = blankAd()
          let formato = ""
          ;(p.creatives || []).forEach((cr) => {
            if (!formato) formato = formatoFromUrl(cr.creative_redirect_url)
            ;(cr.data_by_date || []).forEach((x) => {
              const iso = toISODate(x._id?.datetime || "")
              if (!iso || !inDateRange(iso)) return
              addAd(agg, x)
              addAd(total, x)
              const day = byDay.get(iso) ?? blankAd()
              addAd(day, x)
              byDay.set(iso, day)
            })
          })
          placements.push({ id: p.placement_id, formato: formato || (p.placement_name || "").trim() || `Placement ${p.placement_id}`, agg })
        })
      })
      const isCPV = tipo === "CPV"
      const m = adMetrics(total, isCPV)
      return {
        name: (s.site_name || "").trim(),
        tipo, isCPV, contratado, total, byDay, ...m,
        pacingPct: contratado > 0 ? (m.entregue / contratado) * 100 : 0,
        placements: placements
          .map((p) => ({ ...p, ...adMetrics(p.agg, isCPV) }))
          .sort((a, b) => b.entregue - a.entregue),
      }
    }).sort((a, b) => b.exposicoes - a.exposicoes)
  }, [adCampaign, inDateRange])

  const adTotals = useMemo(() => {
    const t = adSites.reduce(
      (acc, s) => ({
        impressoesDisplay: acc.impressoesDisplay + (s.isCPV ? 0 : s.total.impressions),
        viewsVideo: acc.viewsVideo + (s.isCPV ? s.total.views : 0),
        completosVideo: acc.completosVideo + (s.isCPV ? s.total.completes : 0),
        views: acc.views + s.total.views,
        completes: acc.completes + s.total.completes,
        clicks: acc.clicks + s.total.clicks,
        viewables: acc.viewables + s.total.viewables,
        exposicoes: acc.exposicoes + s.exposicoes,
      }),
      { impressoesDisplay: 0, viewsVideo: 0, completosVideo: 0, views: 0, completes: 0, clicks: 0, viewables: 0, exposicoes: 0 }
    )
    return {
      ...t,
      ctr: t.exposicoes > 0 ? t.clicks / t.exposicoes : 0,
      viewability: t.exposicoes > 0 ? t.viewables / t.exposicoes : 0,
    }
  }, [adSites])

  // Datas da campanha no AdServer (hero / cabeçalho do Display)
  const adPeriodo = useMemo(
    () => (adCampaign?.campaign_start_datetime ? `${adCampaign.campaign_start_datetime} → ${adCampaign.campaign_end_datetime}` : ""),
    [adCampaign]
  )

  // ─── GA4 ─────────────────────────────────────────────────────────────────────
  const ga4PorData = useMemo(() => ga4.filter((r) => inDateRange(r.date)), [ga4, inDateRange])
  const ga4RegionPorData = useMemo(() => ga4Region.filter((r) => inDateRange(r.date)), [ga4Region, inDateRange])

  const ga4Totals = useMemo(() => {
    const t = ga4PorData.reduce(
      (acc, r) => ({
        sessions: acc.sessions + r.sessions,
        newUsers: acc.newUsers + r.newUsers,
        engagement: acc.engagement + r.engagement,
        bounceW: acc.bounceW + r.bounce * r.sessions,
      }),
      { sessions: 0, newUsers: 0, engagement: 0, bounceW: 0 }
    )
    return {
      sessions: t.sessions,
      newUsers: t.newUsers,
      avgEngagement: t.sessions > 0 ? t.engagement / t.sessions : 0,
      bounceRate: t.sessions > 0 ? t.bounceW / t.sessions : 0,
    }
  }, [ga4PorData])
  const hasGa4 = ga4Totals.sessions > 0

  const sessionsByDay = useMemo(() => {
    const map = new Map<string, number>()
    ga4PorData.forEach((r) => { if (r.date) map.set(r.date, (map.get(r.date) || 0) + r.sessions) })
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [ga4PorData])

  const sessionsLineData = useMemo(
    () => [{ id: "Sessões", color: BLUE, data: sessionsByDay.map(([d, v]) => ({ x: shortBR(d), y: v })) }],
    [sessionsByDay]
  )
  const sessionsTicks = useMemo(() => {
    const xs = sessionsByDay.map(([d]) => shortBR(d))
    const step = Math.ceil(xs.length / 8) || 1
    return xs.filter((_, i) => i % step === 0)
  }, [sessionsByDay])

  // Desempenho por canal (origem da sessão)
  const channelStats = useMemo(() => {
    const map = new Map<string, { sessions: number; newUsers: number; engagement: number; bounceW: number }>()
    ga4PorData.forEach((r) => {
      const name = prettySource(r.source)
      const cur = map.get(name) ?? { sessions: 0, newUsers: 0, engagement: 0, bounceW: 0 }
      cur.sessions += r.sessions
      cur.newUsers += r.newUsers
      cur.engagement += r.engagement
      cur.bounceW += r.bounce * r.sessions
      map.set(name, cur)
    })
    return Array.from(map.entries())
      .map(([name, v]) => ({
        name,
        sessions: v.sessions,
        newUsers: v.newUsers,
        avgEngagement: v.sessions > 0 ? v.engagement / v.sessions : 0,
        bounceRate: v.sessions > 0 ? v.bounceW / v.sessions : 0,
      }))
      .sort((a, b) => b.sessions - a.sessions)
  }, [ga4PorData])
  const channelMax = useMemo(() => Math.max(...channelStats.map((c) => c.sessions), 1), [channelStats])

  // Sessões por formato/peça (origem + utm_medium)
  const formatoStats = useMemo(() => {
    const map = new Map<string, { key: string; label: string; tipo: string; origem: string; sessions: number; newUsers: number; engagement: number; bounceW: number }>()
    ga4PorData.forEach((r) => {
      const origem = prettySource(r.source)
      const key = `${origem}||${r.medium}`
      const cur = map.get(key) ?? { key, ...parseMedium(r.medium), origem, sessions: 0, newUsers: 0, engagement: 0, bounceW: 0 }
      cur.sessions += r.sessions
      cur.newUsers += r.newUsers
      cur.engagement += r.engagement
      cur.bounceW += r.bounce * r.sessions
      map.set(key, cur)
    })
    return Array.from(map.values())
      .filter((v) => v.sessions > 0)
      .map((v) => ({
        ...v,
        avgEngagement: v.sessions > 0 ? v.engagement / v.sessions : 0,
        bounceRate: v.sessions > 0 ? v.bounceW / v.sessions : 0,
      }))
      .sort((a, b) => b.sessions - a.sessions)
  }, [ga4PorData])
  const formatoMax = useMemo(() => Math.max(...formatoStats.map((f) => f.sessions), 1), [formatoStats])

  const sessionsByRegion = useMemo(() => {
    const map = new Map<string, number>()
    ga4RegionPorData.forEach((r) => {
      const pt = normalizeRegionToPT(r.region)
      if (pt) map.set(pt, (map.get(pt) || 0) + r.sessions)
    })
    return map
  }, [ga4RegionPorData])

  const regionData = useMemo(() => Object.fromEntries(sessionsByRegion), [sessionsByRegion])
  const regionRanking = useMemo(
    () => Array.from(sessionsByRegion.entries()).map(([name, sessions]) => ({ name, sessions })).sort((a, b) => b.sessions - a.sessions),
    [sessionsByRegion]
  )
  const regionMax = useMemo(() => Math.max(...regionRanking.map((r) => r.sessions), 1), [regionRanking])
  const regionTotal = useMemo(() => regionRanking.reduce((a, r) => a + r.sessions, 0), [regionRanking])

  const getRegionColor = useCallback((s: number) => (s <= 0 ? "#e5e7eb" : blueRamp(regionMax > 0 ? s / regionMax : 0)), [regionMax])

  // Top cidades — exclui "(not set)"/vazio
  const topCities = useMemo(() => {
    const map = new Map<string, number>()
    ga4RegionPorData.forEach((r) => {
      const c = (r.city || "").trim()
      if (!c || /^\(.*\)$/.test(c)) return
      map.set(c, (map.get(c) || 0) + r.sessions)
    })
    return Array.from(map.entries()).map(([name, sessions]) => ({ name, sessions })).sort((a, b) => b.sessions - a.sessions)
  }, [ga4RegionPorData])
  const cityMax = useMemo(() => Math.max(...topCities.map((c) => c.sessions), 1), [topCities])
  const cityTotal = useMemo(() => topCities.reduce((a, c) => a + c.sessions, 0), [topCities])

  // ─── Evolução no tempo (Redes + Display, combinado) ──────────────────────────
  // Métricas exclusivas de uma fonte ficam null na outra (a linha some p/ aquela métrica).
  type EvoSource = "display" | "redes"
  type EvoDay = { impressions: number; clicks: number; viewables: number; cost: number; videoViews: number }
  const evoVeiculos = useMemo(() => {
    const blank = (): EvoDay => ({ impressions: 0, clicks: 0, viewables: 0, cost: 0, videoViews: 0 })
    const map = new Map<string, { veiculo: string; source: EvoSource; byDay: Map<string, EvoDay> }>()
    adSites.forEach((s) => {
      const e = { veiculo: s.name, source: "display" as EvoSource, byDay: new Map<string, EvoDay>() }
      s.byDay.forEach((d, iso) => {
        // No CPV a exposição é a view (a impressão quase não é registrada)
        e.byDay.set(iso, { impressions: s.isCPV ? d.views : d.impressions, clicks: d.clicks, viewables: d.viewables, cost: 0, videoViews: d.views })
      })
      map.set(s.name, e)
    })
    consolidadoPorData.forEach((r) => {
      const iso = toISODate(r.date)
      if (!iso || !r.veiculo) return
      const e = map.get(r.veiculo) ?? { veiculo: r.veiculo, source: "redes" as EvoSource, byDay: new Map<string, EvoDay>() }
      const cur = e.byDay.get(iso) ?? blank()
      cur.impressions += r.impressions; cur.clicks += r.clicks; cur.cost += r.cost; cur.videoViews += r.videoViews
      e.byDay.set(iso, cur)
      map.set(r.veiculo, e)
    })
    return Array.from(map.values())
  }, [adSites, consolidadoPorData])

  const evoVeiculoOptions = useMemo(() => evoVeiculos.map((e) => e.veiculo).sort((a, b) => a.localeCompare(b)), [evoVeiculos])
  // Cor estável por veículo (não muda ao filtrar)
  const evoColor = useMemo(() => {
    const m = new Map<string, string>()
    evoVeiculos.forEach((e, i) => m.set(e.veiculo, colorForVeiculo(e.veiculo, i)))
    return m
  }, [evoVeiculos])

  const chartMetricLabel: Record<EvoMetric, string> = {
    impressions: "Impressões", clicks: "Cliques", ctr: "CTR",
    videoViews: "Visualizações", cost: "Investimento", viewability: "Viewability",
  }
  const chartIsPct = chartMetric === "ctr" || chartMetric === "viewability"
  const chartIsCurrency = chartMetric === "cost"

  const chartData = useMemo(() => {
    const allDates = new Set<string>()
    evoVeiculos.forEach((e) => e.byDay.forEach((_v, iso) => allDates.add(iso)))
    // Domínio X global e ordenado: dias sem dado do veículo viram null → lacuna
    const sortedDates = Array.from(allDates).sort((a, b) => a.localeCompare(b))
    const value = (d: EvoDay, source: EvoSource): number | null => {
      switch (chartMetric) {
        case "impressions": return d.impressions
        case "clicks": return d.clicks
        case "ctr": return d.impressions > 0 ? (d.clicks / d.impressions) * 100 : 0
        case "videoViews": return d.videoViews
        case "cost": return source === "redes" ? d.cost : null
        case "viewability": return source === "display" ? (d.impressions > 0 ? (d.viewables / d.impressions) * 100 : 0) : null
        default: return null
      }
    }
    const list = evoVeiculo ? evoVeiculos.filter((e) => e.veiculo === evoVeiculo) : evoVeiculos
    return list
      .map((e) => ({
        id: e.veiculo,
        color: evoColor.get(e.veiculo) || BLUE,
        data: sortedDates.map((iso) => {
          const d = e.byDay.get(iso)
          const y = d ? value(d, e.source) : null
          return { x: iso, y: y === null ? null : Number(y.toFixed(chartIsPct || chartIsCurrency ? 2 : 0)) }
        }),
      }))
      .filter((s) => s.data.some((p) => p.y !== null))
      .sort((a, b) => a.id.localeCompare(b.id))
  }, [evoVeiculos, evoVeiculo, evoColor, chartMetric, chartIsPct, chartIsCurrency])

  const chartColors = useMemo(() => chartData.map((s) => s.color), [chartData])
  const chartTicks = useMemo(() => {
    const set = new Set<string>()
    evoVeiculos.forEach((e) => e.byDay.forEach((_v, iso) => set.add(iso)))
    const xs = Array.from(set).sort((a, b) => a.localeCompare(b))
    const step = Math.ceil(xs.length / 8) || 1
    return xs.filter((_, i) => i % step === 0)
  }, [evoVeiculos])

  // ─── Plano de Mídia ──────────────────────────────────────────────────────────
  const planoData = useMemo(() => {
    type Row = { veiculo: string; praca: string; tipo: string; contratado: string; investimento: number; execucao: number }
    type Meio = { rows: Row[]; investimento: number; execucao: number }
    const meios: Record<string, Meio> = {}
    let totalInvestimento = 0, totalExecucao = 0
    if (planoRaw.length < 2) return { meios, totalInvestimento, totalExecucao }
    const h = planoRaw[0]
    const iMeio = h.indexOf("MEIO"), iVeic = h.indexOf("VEÍCULO"), iPraca = h.indexOf("PRAÇA")
    const iTipo = h.indexOf("TIPO DE COMPRA"), iContr = h.indexOf("TOTAL CONTRATADO")
    const iInv = h.indexOf("INVESTIMENTO"), iExec = h.indexOf("EXECUÇÃO PROJETO")
    planoRaw.slice(1).forEach((r) => {
      const meio = r[iMeio] || "", veiculo = r[iVeic] || ""
      if (!meio || !veiculo) return
      const inv = parseNum(r[iInv]), exec = iExec >= 0 ? parseNum(r[iExec]) : 0
      totalInvestimento += inv; totalExecucao += exec
      if (!meios[meio]) meios[meio] = { rows: [], investimento: 0, execucao: 0 }
      meios[meio].investimento += inv
      meios[meio].execucao += exec
      meios[meio].rows.push({ veiculo, praca: r[iPraca] || "-", tipo: r[iTipo] || "-", contratado: r[iContr] || "-", investimento: inv, execucao: exec })
    })
    return { meios, totalInvestimento, totalExecucao }
  }, [planoRaw])

  // ─── Funil (big numbers) ─────────────────────────────────────────────────────
  // Investimento = Redes (realizado, respeita o período) + Plano de Mídia (contratado, total).
  // No Display em CPV (Zoox) a view conta como impressão (a API quase não registra impressão).
  const funnel = useMemo(() => {
    const investRedes = redesTotals.cost
    const investPlano = planoData.totalInvestimento + planoData.totalExecucao
    const impressoes = redesTotals.impressions + adTotals.exposicoes
    const visualizacoes = redesTotals.videoViews + adTotals.views
    const completos = redesTotals.videoCompletions + adTotals.completes
    const cliques = redesTotals.clicks + adTotals.clicks
    return {
      investimento: investRedes + investPlano, investRedes, investPlano,
      impressoes, visualizacoes, cliques, sessoes: ga4Totals.sessions,
      ctr: impressoes > 0 ? cliques / impressoes : 0,
      vtr: visualizacoes > 0 ? completos / visualizacoes : 0,
    }
  }, [redesTotals, planoData, adTotals, ga4Totals])

  // ─── Análise IA ──────────────────────────────────────────────────────────────
  const DATA_KEY = "cirio-2026"

  const buildAnalysisPayload = () => ({
    periodo: adPeriodo,
    investimento: { plano: funnel.investPlano, redes: funnel.investRedes, total: funnel.investimento },
    redes: hasRedes ? {
      cost: redesTotals.cost, impressions: redesTotals.impressions, clicks: redesTotals.clicks, ctr: redesTotals.ctr,
      cpm: redesTotals.cpm, videoViews: redesTotals.videoViews, vtr: redesTotals.vtr,
      byVeiculo: veiculos.map((v) => {
        const t = byVeiculo.get(v)!
        return { name: v, cost: t.cost, impressions: t.impressions, clicks: t.clicks, ctr: t.ctr, cpm: t.cpm, videoViews: t.videoViews, vtr: t.vtr }
      }),
    } : null,
    display: adSites.length > 0 ? {
      sites: adSites.map((s) => ({
        name: s.name, tipo: s.tipo, contratado: s.contratado, entregue: s.entregue, pacingPct: s.pacingPct,
        clicks: s.total.clicks, ctr: s.ctr, viewability: s.viewability, vtr: s.vtr,
      })),
    } : null,
    ga4: hasGa4 ? {
      sessions: ga4Totals.sessions, newUsers: ga4Totals.newUsers, avgEngagementSec: ga4Totals.avgEngagement, bounceRate: ga4Totals.bounceRate,
      topSources: channelStats.slice(0, 8).map((c) => ({ name: c.name, sessions: c.sessions })),
      topFormatos: formatoStats.slice(0, 8).map((f) => ({ name: `${f.origem} · ${f.label || f.tipo || "sem formato"}`, sessions: f.sessions })),
      topRegions: regionRanking.slice(0, 8), topCities: topCities.slice(0, 8),
    } : null,
  })

  const runAiAnalysis = async (forceRefresh = false) => {
    setAiLoading(true)
    setAiError(null)
    try {
      if (!forceRefresh) {
        const cached = await getCachedAnalysis(DATA_KEY)
        if (cached) { setAiAnalysis(cached.analysis); setAiLoading(false); return }
      }
      const result = await analyzeCirio2026(buildAnalysisPayload())
      setAiAnalysis(result)
      await setCachedAnalysis(DATA_KEY, result)
    } catch {
      setAiError("Não foi possível gerar a análise. Tente novamente.")
    } finally {
      setAiLoading(false)
    }
  }

  useEffect(() => {
    if (!loading && !aiAnalysis && !aiLoading) runAiAnalysis()
  }, [loading]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <Loading message="Carregando dados da campanha..." />

  const sortedMeios = Object.entries(planoData.meios).sort((a, b) => (b[1].investimento + b[1].execucao) - (a[1].investimento + a[1].execucao))
  const hasExecucao = planoData.totalExecucao > 0

  return (
    <div ref={contentRef} className="h-full flex flex-col space-y-3 overflow-auto">

      {/* ── Hero ── */}
      <div className="relative overflow-hidden rounded-2xl shadow-2xl h-36">
        <div className="relative h-full" style={{ background: `linear-gradient(to right, ${BLUE_DARK}, ${BLUE}, ${BLUE_LIGHT})` }}>
          <img src="/images/fundo_card.webp" alt="Círio 2026" className="w-full h-full object-cover mix-blend-overlay opacity-30" />
          <div className="absolute inset-0" style={{ background: "linear-gradient(to right, rgba(30,90,140,0.6), rgba(45,111,163,0.3))" }} />
          <div className="absolute top-3 right-3 z-10">
            <PDFDownloadButton contentRef={contentRef} fileName="cirio-2026" />
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-4 flex items-end justify-between">
            <div>
              <p className="text-blue-100 text-xs font-medium mb-1 uppercase tracking-wider">Campanhas · Escala</p>
              <h1 className="text-2xl font-bold text-white">Círio 2026</h1>
              <p className="text-blue-100 text-sm">{adPeriodo ? `Report geral de performance · ${adPeriodo}` : "Report geral de performance"}</p>
            </div>
            <div className="text-right flex gap-5">
              <div>
                <p className="text-blue-100 text-xs">Investimento</p>
                <p className="text-2xl font-bold text-white">{formatCompact(funnel.investimento)}</p>
              </div>
              <div>
                <p className="text-blue-100 text-xs">Impressões</p>
                <p className="text-2xl font-bold text-white">{formatCompact(funnel.impressoes)}</p>
              </div>
              <div>
                <p className="text-blue-100 text-xs">Sessões no site</p>
                <p className="text-2xl font-bold text-white">{hasGa4 ? formatCompact(funnel.sessoes) : "—"}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Filtro de período ── */}
      <div className="card-overlay rounded-xl shadow-lg p-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-gray-700">
          <Calendar className="w-4 h-4" style={{ color: BLUE }} />
          <span className="text-sm font-semibold">Período</span>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={dateRange.start} max={dateRange.end || undefined}
            onChange={(e) => setDateRange((p) => ({ ...p, start: e.target.value }))}
            className="px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
          <span className="text-gray-500 text-sm">até</span>
          <input type="date" value={dateRange.end} min={dateRange.start || undefined}
            onChange={(e) => setDateRange((p) => ({ ...p, end: e.target.value }))}
            className="px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
        </div>
        {(dateRange.start || dateRange.end) && (
          <button onClick={() => setDateRange({ start: "", end: "" })}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors">
            <X className="w-3.5 h-3.5" /> Limpar
          </button>
        )}
        <span className="text-[11px] text-gray-400 ml-auto">
          Filtra Redes Sociais, Display e Site (GA4). O Plano de Mídia mostra sempre o planejamento completo.
        </span>
      </div>

      {/* ── Funil (big numbers) ── */}
      <div className="card-overlay rounded-xl shadow-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Target className="w-4 h-4" style={{ color: BLUE }} />
          <h3 className="text-sm font-bold text-gray-900">Funil da Campanha</h3>
          <span className="text-[11px] text-gray-400">Da mídia ao site</span>
        </div>
        <div className="flex flex-wrap items-stretch gap-2">
          {[
            { el: <FunnelStep key="inv" label="Investimento" value={formatCurrency(funnel.investimento)} sub={`Plano ${formatCompact(funnel.investPlano)} + Redes ${formatCompact(funnel.investRedes)}`} icon={<DollarSign className="w-3.5 h-3.5" />} tooltip="Plano de Mídia (valor contratado: TV, DOOH e internet) + Redes Sociais (gasto realizado em Meta e YouTube no período)." /> },
            { el: <FunnelStep key="imp" label="Impressões" value={formatCompact(funnel.impressoes)} sub="Redes + Display" icon={<Eye className="w-3.5 h-3.5" />} tooltip="Impressões das Redes Sociais (Meta + YouTube) e do AdServer. No vídeo em CPV (Zoox) a visualização conta como impressão." /> },
            { el: <FunnelStep key="vv" label="Visualizações" value={formatCompact(funnel.visualizacoes)} sub={`VTR ${formatPct(funnel.vtr)}`} icon={<Play className="w-3.5 h-3.5" />} tooltip="Vídeos iniciados nas Redes Sociais e no vídeo programático (Zoox). VTR = vídeos completos ÷ visualizações." /> },
            { el: <FunnelStep key="clk" label="Cliques" value={formatCompact(funnel.cliques)} sub={`CTR ${formatPct(funnel.ctr)}`} icon={<MousePointerClick className="w-3.5 h-3.5" />} tooltip="Cliques somando Redes Sociais e AdServer. CTR = cliques ÷ impressões." /> },
            { el: <FunnelStep key="ses" label="Sessões" value={hasGa4 ? formatCompact(funnel.sessoes) : "—"} sub={hasGa4 ? `${formatCompact(ga4Totals.newUsers)} novos` : "GA4"} icon={<Globe2 className="w-3.5 h-3.5" />} tooltip="Sessões no site com a UTM da campanha (2026_cirio_2026), medidas pelo Google Analytics 4." /> },
          ].map((s, i, arr) => (
            <div key={i} className="flex items-stretch gap-2 flex-1 min-w-[140px]">
              {s.el}
              {i < arr.length - 1 && <div className="hidden lg:flex items-center"><ArrowRight className="w-4 h-4 text-gray-300" /></div>}
            </div>
          ))}
        </div>
      </div>

      {/* ── Performance por Veículo (Redes) ── */}
      {veiculos.length > 0 && (
        <div className="card-overlay rounded-xl shadow-lg p-4">
          <h3 className="text-sm font-bold text-gray-900 mb-3">Performance por Veículo · Redes Sociais</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 text-gray-500 font-medium">Veículo</th>
                  <th className="text-right py-2 text-gray-500 font-medium">Invest.</th>
                  <th className="text-right py-2 text-gray-500 font-medium">Impressões</th>
                  <th className="text-right py-2 text-gray-500 font-medium">CPM</th>
                  <th className="text-right py-2 text-gray-500 font-medium">Cliques</th>
                  <th className="text-right py-2 text-gray-500 font-medium">CTR</th>
                  <th className="text-right py-2 text-gray-500 font-medium">Visualizações</th>
                  <th className="text-right py-2 text-gray-500 font-medium">VTR</th>
                </tr>
              </thead>
              <tbody>
                {veiculos.map((v) => {
                  const t = byVeiculo.get(v)!
                  return (
                    <tr key={v} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 font-semibold text-gray-800">{v}</td>
                      <td className="py-2 text-right text-gray-700">{formatCurrency(t.cost)}</td>
                      <td className="py-2 text-right text-gray-700">{formatNum(t.impressions)}</td>
                      <td className="py-2 text-right text-gray-700">{t.impressions > 0 ? formatCurrency(t.cpm) : "-"}</td>
                      <td className="py-2 text-right text-gray-700">{formatNum(t.clicks)}</td>
                      <td className="py-2 text-right text-blue-600 font-semibold">{formatPct(t.ctr)}</td>
                      <td className="py-2 text-right text-indigo-600 font-bold">{formatNum(t.videoViews)}</td>
                      <td className="py-2 text-right text-gray-700">{t.videoViews > 0 ? formatPct(t.vtr) : "-"}</td>
                    </tr>
                  )
                })}
                <tr className="bg-gray-50 font-bold">
                  <td className="py-2 text-gray-900">Total</td>
                  <td className="py-2 text-right text-blue-700">{formatCurrency(redesTotals.cost)}</td>
                  <td className="py-2 text-right text-gray-900">{formatNum(redesTotals.impressions)}</td>
                  <td className="py-2 text-right text-gray-900">{redesTotals.impressions > 0 ? formatCurrency(redesTotals.cpm) : "-"}</td>
                  <td className="py-2 text-right text-gray-900">{formatNum(redesTotals.clicks)}</td>
                  <td className="py-2 text-right text-blue-700">{formatPct(redesTotals.ctr)}</td>
                  <td className="py-2 text-right text-indigo-700">{formatNum(redesTotals.videoViews)}</td>
                  <td className="py-2 text-right text-gray-900">{redesTotals.videoViews > 0 ? formatPct(redesTotals.vtr) : "-"}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5">VTR = vídeos completos ÷ visualizações. CPM = investimento ÷ impressões × 1.000.</p>
        </div>
      )}

      {/* ── Evolução no tempo (Redes + Display) ── */}
      {evoVeiculos.length > 0 && (
        <div className="card-overlay rounded-xl shadow-lg p-4">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${BLUE}, ${BLUE_LIGHT})` }}>
                <TrendingUp className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">Evolução no Tempo</h3>
                <p className="text-[10px] text-gray-400">{chartMetricLabel[chartMetric]} por dia, por veículo (Redes Sociais + Display)</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <select value={evoVeiculo} onChange={(e) => setEvoVeiculo(e.target.value)}
                className="text-[11px] border border-gray-200 rounded-md px-2 py-1 text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[200px] truncate"
                title={evoVeiculo || "Todos os veículos"}>
                <option value="">Todos os veículos ({evoVeiculoOptions.length})</option>
                {evoVeiculoOptions.map((v) => (<option key={v} value={v}>{v}</option>))}
              </select>
              {(["impressions", "clicks", "ctr", "videoViews", "cost", "viewability"] as const).map((m) => (
                <button key={m} onClick={() => setChartMetric(m)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all ${chartMetric === m ? "text-white shadow" : "bg-white text-gray-600 border border-gray-200 hover:border-blue-400"}`}
                  style={chartMetric === m ? { backgroundColor: BLUE } : {}}>
                  {chartMetricLabel[m]}
                </button>
              ))}
            </div>
          </div>
          {chartData.length > 0 ? (
            <div style={{ height: 300 }}>
              <ResponsiveLine
                data={chartData}
                colors={chartColors}
                margin={{ top: 16, right: 24, bottom: 68, left: 64 }}
                xScale={{ type: "point" }}
                yScale={{ type: "linear", min: 0, max: "auto" }}
                curve="monotoneX"
                axisTop={null}
                axisRight={null}
                axisBottom={{ tickSize: 5, tickPadding: 8, tickRotation: -45, tickValues: chartTicks, format: (v) => shortBR(String(v)) }}
                axisLeft={{ tickSize: 5, tickPadding: 8, format: (v) => (chartIsCurrency ? `R$ ${formatCompact(Number(v))}` : chartIsPct ? `${Number(v).toFixed(0)}%` : formatCompact(Number(v))) }}
                enableGridX={false}
                enablePoints={chartTicks.length <= 40}
                pointSize={5}
                pointBorderWidth={1}
                pointBorderColor={{ from: "seriesColor" }}
                pointColor="#ffffff"
                useMesh
                enableSlices="x"
                sliceTooltip={({ slice }) => (
                  <div className="bg-white rounded-lg shadow-xl border border-gray-100 px-3 py-2">
                    <p className="text-[11px] font-bold text-gray-900 mb-1">{shortBR(String(slice.points[0]?.data.x))}</p>
                    {slice.points.map((p) => (
                      <div key={p.id} className="flex items-center gap-2 text-[11px]">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.seriesColor }} />
                        <span className="text-gray-600">{String(p.seriesId)}:</span>
                        <span className="font-semibold text-gray-900">
                          {chartIsCurrency ? formatCurrency(Number(p.data.y)) : chartIsPct ? `${Number(p.data.y).toFixed(2)}%` : formatNum(Number(p.data.y))}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                legends={[{
                  anchor: "bottom", direction: "row", translateY: 60, itemsSpacing: 12,
                  itemWidth: 110, itemHeight: 16, symbolSize: 10, symbolShape: "circle", itemTextColor: "#6b7280",
                }]}
              />
            </div>
          ) : (
            <p className="text-xs text-gray-400 py-8 text-center">Sem dados de {chartMetricLabel[chartMetric].toLowerCase()} para {evoVeiculo || "os veículos"} no período.</p>
          )}
          <p className="text-[10px] text-gray-400 mt-1">Investimento só existe nas Redes Sociais; Viewability só no Display. No vídeo em CPV (Zoox) a visualização conta como impressão.</p>
        </div>
      )}

      {/* ── Análise IA ── */}
      <div className="card-overlay rounded-xl shadow-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${BLUE}, ${BLUE_LIGHT})` }}>
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Análise de Performance</h3>
              <p className="text-[10px] text-gray-400">Gerado por IA com base nos dados da campanha</p>
            </div>
          </div>
          <button onClick={() => runAiAnalysis(true)} disabled={aiLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-white text-xs font-medium rounded-lg transition-all disabled:opacity-50"
            style={{ backgroundColor: BLUE }}>
            <RefreshCw className={`w-3.5 h-3.5 ${aiLoading ? "animate-spin" : ""}`} />
            {aiLoading ? "Analisando..." : aiAnalysis ? "Reanalisar" : "Analisar"}
          </button>
        </div>
        {!aiAnalysis && !aiLoading && !aiError && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Sparkles className="w-8 h-8 text-blue-200 mb-2" />
            <p className="text-sm text-gray-400">Clique em <strong>Analisar</strong> para gerar uma análise inteligente da campanha</p>
          </div>
        )}
        {aiLoading && (
          <div className="flex items-center justify-center py-8 gap-3">
            <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: BLUE, animationDelay: "0ms" }} />
            <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: BLUE, animationDelay: "150ms" }} />
            <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: BLUE, animationDelay: "300ms" }} />
            <span className="text-sm text-gray-400 ml-1">Processando dados com IA...</span>
          </div>
        )}
        {aiError && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{aiError}</div>}
        {aiAnalysis && !aiLoading && (
          <div className="rounded-lg p-4" style={{ background: "linear-gradient(135deg, #eff6ff, #e0f2fe)", border: "1px solid #bfdbfe" }}>
            <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{aiAnalysis}</p>
          </div>
        )}
      </div>

      {/* ── Criativos (Redes) ── */}
      {creatives.length > 0 && (
        <div className="card-overlay rounded-xl shadow-lg p-4">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${BLUE}, ${BLUE_LIGHT})` }}>
                <ImageIcon className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">Criativos · Redes Sociais</h3>
                <p className="text-[10px] text-gray-400">Performance por peça (Meta + YouTube) · clique para detalhes</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {["Todos", ...creativeVeiculos].map((v) => (
                <button key={v} onClick={() => setCreativeVeiculo(v)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all ${creativeVeiculo === v ? "text-white shadow" : "bg-white text-gray-600 border border-gray-200 hover:border-blue-400"}`}
                  style={creativeVeiculo === v ? { backgroundColor: BLUE } : {}}>{v}</button>
              ))}
              <select value={creativeSort} onChange={(e) => setCreativeSort(e.target.value as typeof creativeSort)}
                className="text-[11px] border border-gray-200 rounded-md px-2 py-1 text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="impressions">Ordenar: Impressões</option>
                <option value="videoViews">Ordenar: Visualizações</option>
                <option value="ctr">Ordenar: CTR</option>
                <option value="cost">Ordenar: Investimento</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            {creatives.slice(0, 12).map((c) => (
              <button key={c.key} type="button" onClick={() => { setSelectedCreative(c.key); setModalMetric("impressions") }}
                className="text-left border border-gray-100 rounded-lg p-2 hover:shadow-md hover:border-blue-300 transition-all cursor-pointer">
                <CreativeThumb sources={[c.localImage, c.image]} alt={c.name} />
                <div className="mt-2 space-y-1">
                  <p className="text-[11px] font-bold text-gray-800 leading-tight line-clamp-2 min-h-[28px]" title={c.name}>{c.name.replace(/_/g, " ")}</p>
                  <div className="flex items-center gap-1 flex-wrap">
                    {c.veiculos.map((v) => (
                      <span key={v} className="text-[8px] px-1 py-0.5 rounded bg-blue-50 text-blue-600 font-medium">{v}</span>
                    ))}
                    {c.formato && <span className="text-[8px] px-1 py-0.5 rounded bg-gray-100 text-gray-500 font-medium">{c.formato}</span>}
                  </div>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] pt-1">
                    <span className="text-gray-400">Impr.</span><span className="text-right font-semibold text-gray-700">{formatCompact(c.impressions)}</span>
                    <span className="text-gray-400">CTR</span><span className="text-right font-semibold text-blue-600">{formatPct(c.ctr)}</span>
                    <span className="text-gray-400">Views</span><span className="text-right font-semibold text-indigo-600">{c.videoViews > 0 ? formatCompact(c.videoViews) : "—"}</span>
                    <span className="text-gray-400">Invest.</span><span className="text-right font-semibold text-gray-700">{formatCompact(c.cost)}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Site / GA4 ── */}
      {hasGa4 && (
        <div className="card-overlay rounded-xl shadow-lg p-4 space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${BLUE}, ${BLUE_LIGHT})` }}>
              <Globe2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Site · Google Analytics 4</h3>
              <p className="text-[10px] text-gray-400">Sessões com a UTM da campanha: engajamento, origem, formato e regiões</p>
            </div>
          </div>

          {/* Big numbers GA4 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-blue-700">{formatNum(ga4Totals.sessions)}</p>
              <p className="text-[10px] text-gray-500">Sessões</p>
            </div>
            <div className="bg-indigo-50 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-indigo-700">{formatNum(ga4Totals.newUsers)}</p>
              <p className="text-[10px] text-gray-500">Novos usuários</p>
            </div>
            <div className="bg-cyan-50 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-cyan-700">{formatDuration(ga4Totals.avgEngagement)}</p>
              <p className="text-[10px] text-gray-500">Engajamento médio</p>
            </div>
            <div className="bg-emerald-50 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-emerald-700">{(ga4Totals.bounceRate * 100).toFixed(1)}%</p>
              <p className="text-[10px] text-gray-500">Taxa de rejeição</p>
            </div>
          </div>

          {/* Sessões por dia */}
          {sessionsByDay.length > 1 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Activity className="w-3.5 h-3.5" style={{ color: BLUE }} />
                <h4 className="text-xs font-bold text-gray-700">Sessões por dia</h4>
              </div>
              <div style={{ height: 240 }}>
                <ResponsiveLine
                  data={sessionsLineData}
                  colors={[BLUE]}
                  margin={{ top: 12, right: 20, bottom: 44, left: 52 }}
                  xScale={{ type: "point" }}
                  yScale={{ type: "linear", min: 0, max: "auto" }}
                  curve="monotoneX"
                  axisTop={null}
                  axisRight={null}
                  axisBottom={{ tickSize: 5, tickPadding: 8, tickRotation: -40, tickValues: sessionsTicks }}
                  axisLeft={{ tickSize: 5, tickPadding: 8, format: (v) => formatCompact(Number(v)) }}
                  enableGridX={false}
                  enableArea
                  areaOpacity={0.12}
                  pointSize={6}
                  pointBorderWidth={2}
                  pointBorderColor={{ from: "seriesColor" }}
                  pointColor="#ffffff"
                  useMesh
                  enableSlices="x"
                  sliceTooltip={({ slice }) => (
                    <div className="bg-white rounded-lg shadow-xl border border-gray-100 px-3 py-2">
                      <p className="text-[11px] font-bold text-gray-900 mb-1">{String(slice.points[0]?.data.x)}</p>
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: BLUE }} />
                        <span className="text-gray-600">Sessões:</span>
                        <span className="font-semibold text-gray-900">{formatNum(Number(slice.points[0]?.data.y))}</span>
                      </div>
                    </div>
                  )}
                />
              </div>
            </div>
          )}

          {/* Desempenho por Canal */}
          {channelStats.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-3">
                <MonitorPlay className="w-3.5 h-3.5" style={{ color: BLUE }} />
                <h4 className="text-xs font-bold text-gray-700">Desempenho por Canal</h4>
                <span className="text-[10px] text-gray-400">origem das sessões no site</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 text-gray-500 font-medium">Canal</th>
                      <th className="text-left py-2 text-gray-500 font-medium w-2/5">Sessões</th>
                      <th className="text-right py-2 text-gray-500 font-medium">Usuários</th>
                      <th className="text-right py-2 text-gray-500 font-medium">Engaj. médio</th>
                      <th className="text-right py-2 text-gray-500 font-medium">Tx. rejeição</th>
                    </tr>
                  </thead>
                  <tbody>
                    {channelStats.slice(0, 10).map((c) => (
                      <tr key={c.name} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2 font-semibold text-gray-800">{c.name}</td>
                        <td className="py-2 pr-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${Math.max((c.sessions / channelMax) * 100, 2)}%`, background: `linear-gradient(to right, ${BLUE}, ${BLUE_LIGHT})` }} />
                            </div>
                            <span className="text-gray-800 font-semibold tabular-nums w-14 text-right">{formatNum(c.sessions)}</span>
                          </div>
                        </td>
                        <td className="py-2 text-right text-gray-700">{formatNum(c.newUsers)}</td>
                        <td className="py-2 text-right text-gray-700">{formatDuration(c.avgEngagement)}</td>
                        <td className="py-2 text-right text-gray-700">{(c.bounceRate * 100).toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-gray-400 mt-1.5">"Usuários" = novos usuários (métrica disponível no GA4). Engaj. médio = tempo de engajamento ÷ sessões.</p>
            </div>
          )}

          {/* Sessões por formato / peça (utm_medium) */}
          {formatoStats.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-3">
                <Layers className="w-3.5 h-3.5" style={{ color: BLUE }} />
                <h4 className="text-xs font-bold text-gray-700">Sessões por Formato</h4>
                <span className="text-[10px] text-gray-400">peça/formato da UTM (utm_medium) por origem</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 text-gray-500 font-medium">Formato / peça</th>
                      <th className="text-left py-2 text-gray-500 font-medium">Origem</th>
                      <th className="text-left py-2 text-gray-500 font-medium w-1/3">Sessões</th>
                      <th className="text-right py-2 text-gray-500 font-medium">Engaj. médio</th>
                      <th className="text-right py-2 text-gray-500 font-medium">Tx. rejeição</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formatoStats.slice(0, 12).map((f) => (
                      <tr key={f.key} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2 pr-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <TipoBadge tipo={f.tipo} />
                            <span className="font-semibold text-gray-800 truncate max-w-[280px]" title={f.label}>{f.label || "Sem formato na UTM"}</span>
                          </div>
                        </td>
                        <td className="py-2 text-gray-600 whitespace-nowrap">{f.origem}</td>
                        <td className="py-2 pr-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${Math.max((f.sessions / formatoMax) * 100, 2)}%`, background: `linear-gradient(to right, ${BLUE}, ${BLUE_LIGHT})` }} />
                            </div>
                            <span className="text-gray-800 font-semibold tabular-nums w-14 text-right">{formatNum(f.sessions)}</span>
                          </div>
                        </td>
                        <td className="py-2 text-right text-gray-700">{formatDuration(f.avgEngagement)}</td>
                        <td className="py-2 text-right text-gray-700">{(f.bounceRate * 100).toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Distribuição geográfica: mapa + estados + cidades */}
          {regionRanking.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <MapPin className="w-3.5 h-3.5" style={{ color: BLUE }} />
                <h4 className="text-xs font-bold text-gray-700">Distribuição geográfica</h4>
              </div>
              <div className="grid gap-4 md:grid-cols-2 items-start">
                <div className="-mt-2">
                  <BrazilMap regionData={regionData} getIntensityColor={getRegionColor} />
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="text-[11px] font-bold text-gray-600 mb-2">Sessões por estado</p>
                    <div className="space-y-2.5">
                      {regionRanking.slice(0, 8).map((r, i) => (
                        <RankBar key={r.name} label={`${r.name} (${ufSigla(r.name)})`} value={r.sessions} max={regionMax} total={regionTotal}
                          t={1 - i / Math.max(Math.min(regionRanking.length, 8) - 1, 1)} />
                      ))}
                    </div>
                  </div>
                  {topCities.length > 0 && (
                    <div>
                      <p className="text-[11px] font-bold text-gray-600 mb-2">Top cidades</p>
                      <div className="space-y-2.5">
                        {topCities.slice(0, 8).map((c, i) => (
                          <RankBar key={c.name} label={c.name} value={c.sessions} max={cityMax} total={cityTotal}
                            t={1 - i / Math.max(Math.min(topCities.length, 8) - 1, 1)} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Display · AdServer ── */}
      {adSites.length > 0 && (
        <div className="card-overlay rounded-xl shadow-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-900">Display e Vídeo · AdServer</h3>
            <span className="text-xs text-gray-500">{adPeriodo}</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <p className="text-lg font-bold text-blue-700">{formatNum(adTotals.impressoesDisplay)}</p>
              <p className="text-[10px] text-gray-500">Impressões (display)</p>
            </div>
            <div className="bg-teal-50 rounded-lg p-3 text-center">
              <p className="text-lg font-bold text-teal-700">{formatNum(adTotals.viewsVideo)}</p>
              <p className="text-[10px] text-gray-500">Views de vídeo · {formatNum(adTotals.completosVideo)} completos</p>
            </div>
            <div className="bg-cyan-50 rounded-lg p-3 text-center">
              <p className="text-lg font-bold text-cyan-700">{formatNum(adTotals.clicks)}</p>
              <p className="text-[10px] text-gray-500">Cliques</p>
            </div>
            <div className="bg-indigo-50 rounded-lg p-3 text-center">
              <p className="text-lg font-bold text-indigo-700">{formatPct(adTotals.ctr)}</p>
              <p className="text-[10px] text-gray-500">CTR</p>
            </div>
            <div className="bg-emerald-50 rounded-lg p-3 text-center">
              <p className="text-lg font-bold text-emerald-700">{(adTotals.viewability * 100).toFixed(1)}%</p>
              <p className="text-[10px] text-gray-500">Viewability</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 text-gray-500 font-medium">Veículo</th>
                  <th className="text-right py-2 text-gray-500 font-medium">Contratado</th>
                  <th className="text-right py-2 text-gray-500 font-medium">Entregue</th>
                  <th className="pl-3 py-2 text-left text-gray-500 font-medium">Pacing</th>
                  <th className="text-right py-2 text-gray-500 font-medium">Cliques</th>
                  <th className="text-right py-2 text-gray-500 font-medium">CTR</th>
                  <th className="text-right py-2 text-gray-500 font-medium">Viewability</th>
                  <th className="text-right py-2 text-gray-500 font-medium">VTR</th>
                </tr>
              </thead>
              <tbody>
                {adSites.map((s) => {
                  const open = !!expandedSites[s.name]
                  const unit = s.isCPV ? "views compl." : "impr."
                  return (
                    <Fragment key={s.name}>
                      <tr className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                        onClick={() => setExpandedSites((p) => ({ ...p, [s.name]: !p[s.name] }))}>
                        <td className="py-2 font-semibold text-gray-800">
                          <div className="flex items-center gap-1.5">
                            {s.placements.length > 1
                              ? (open ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />)
                              : <span className="w-3.5" />}
                            <TipoBadge tipo={s.tipo} />
                            <span className="truncate max-w-[200px]" title={s.name}>{s.name}</span>
                          </div>
                        </td>
                        <td className="py-2 text-right text-gray-500 whitespace-nowrap">
                          {s.contratado > 0 ? <>{formatNum(s.contratado)} <span className="text-[9px] text-gray-400">{unit}</span></> : "—"}
                        </td>
                        <td className="py-2 text-right text-blue-700 font-semibold">{formatNum(s.entregue)}</td>
                        <td className="py-2 pl-3 w-36">
                          {s.contratado > 0 ? (
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${Math.min(s.pacingPct, 100)}%`, backgroundColor: pacingColor(s.pacingPct) }} />
                              </div>
                              <span className="text-[10px] text-gray-500 w-9 text-right">{s.pacingPct.toFixed(0)}%</span>
                            </div>
                          ) : <span className="text-[10px] text-gray-400">s/ meta</span>}
                        </td>
                        <td className="py-2 text-right text-gray-700">{formatNum(s.total.clicks)}</td>
                        <td className="py-2 text-right text-indigo-600 font-semibold">{formatPct(s.ctr)}</td>
                        <td className="py-2 text-right text-blue-600">{(s.viewability * 100).toFixed(1)}%</td>
                        <td className="py-2 text-right text-gray-700">{s.isCPV ? formatPct(s.vtr) : "—"}</td>
                      </tr>
                      {open && s.placements.length > 1 && s.placements.map((p) => (
                        <tr key={`${s.name}__${p.id}`} className="border-b border-gray-50 bg-gray-50/60">
                          <td className="py-1.5 pl-9 text-gray-600" title={p.formato}>
                            <span className="text-gray-400 mr-1">↳</span>{p.formato}
                          </td>
                          <td className="py-1.5 text-right text-gray-300">—</td>
                          <td className="py-1.5 text-right text-gray-700">{formatNum(p.entregue)}</td>
                          <td className="py-1.5 pl-3 text-[10px] text-gray-400">
                            {s.entregue > 0 ? `${((p.entregue / s.entregue) * 100).toFixed(0)}% do veículo` : ""}
                          </td>
                          <td className="py-1.5 text-right text-gray-700">{formatNum(p.agg.clicks)}</td>
                          <td className="py-1.5 text-right text-indigo-600">{formatPct(p.ctr)}</td>
                          <td className="py-1.5 text-right text-blue-600">{(p.viewability * 100).toFixed(1)}%</td>
                          <td className="py-1.5 text-right text-gray-700">{s.isCPV ? formatPct(p.vtr) : "—"}</td>
                        </tr>
                      ))}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5">
            CPM: entrega = impressões. CPV (vídeo): entrega = vídeos completos; CTR e viewability são calculados sobre as views. VTR = completos ÷ views. Clique no veículo para ver os formatos.
          </p>
        </div>
      )}

      {/* ── Plano de Mídia ── */}
      {sortedMeios.length > 0 && (
        <div className="card-overlay rounded-xl shadow-lg p-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${BLUE_DARK}, ${BLUE})` }}>
              <Radio className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Plano de Mídia</h3>
              <p className="text-[10px] text-gray-400">Planejamento contratado: TV, DOOH e internet</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-green-700">{formatCurrency(funnel.investPlano)}</p>
              <p className="text-xs text-gray-500 mt-0.5">Plano de mídia (contratado)</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-blue-700">{formatCurrency(funnel.investRedes)}</p>
              <p className="text-xs text-gray-500 mt-0.5">Redes sociais (realizado)</p>
            </div>
            <div className="bg-indigo-50 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-indigo-700">{formatCurrency(funnel.investimento)}</p>
              <p className="text-xs text-gray-500 mt-0.5">Total da campanha</p>
            </div>
          </div>
          <div className="space-y-2">
            {sortedMeios.map(([meioNome, meio]) => {
              const open = !collapsedMeios[meioNome]
              const meioTotal = meio.investimento + meio.execucao
              return (
                <div key={meioNome} className="border-2 border-gray-200 rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between p-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                    onClick={() => setCollapsedMeios((prev) => ({ ...prev, [meioNome]: !prev[meioNome] }))}>
                    <div className="flex items-center gap-2">
                      {open ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
                      <span className="text-sm font-semibold text-gray-900">{meioNome}</span>
                      <span className="text-xs text-gray-400 bg-gray-200 px-2 py-0.5 rounded-full">{meio.rows.length} {meio.rows.length === 1 ? "veículo" : "veículos"}</span>
                    </div>
                    <div className="flex gap-4 text-xs text-right">
                      <div>
                        <p className="text-gray-400">Investimento</p>
                        <p className="font-semibold text-gray-700">{formatCurrency(meioTotal)}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">% do plano</p>
                        <p className="font-semibold text-gray-700">{funnel.investPlano > 0 ? `${((meioTotal / funnel.investPlano) * 100).toFixed(1)}%` : "—"}</p>
                      </div>
                    </div>
                  </div>
                  {open && (
                    <div className="px-3 py-2 bg-white overflow-x-auto">
                      <table className="w-full text-[11px]">
                        <thead>
                          <tr className="border-b border-gray-100">
                            <th className="text-left py-1 text-gray-500 font-medium">Veículo</th>
                            <th className="text-left py-1 text-gray-500 font-medium">Praça</th>
                            <th className="text-left py-1 text-gray-500 font-medium">Tipo de compra</th>
                            <th className="text-right py-1 text-gray-500 font-medium">Contratado</th>
                            <th className="text-right py-1 text-gray-500 font-medium">Investimento</th>
                            {hasExecucao && <th className="text-right py-1 text-amber-600 font-medium">Projetos</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {meio.rows.map((row, ri) => (
                            <tr key={ri} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                              <td className="py-1.5 text-gray-800 font-medium">{row.veiculo}</td>
                              <td className="py-1.5 text-gray-600">{row.praca}</td>
                              <td className="py-1.5 text-gray-500">{row.tipo}</td>
                              <td className="py-1.5 text-right text-gray-700 font-semibold">{row.contratado}</td>
                              <td className="py-1.5 text-right text-green-700 font-semibold">{row.investimento > 0 ? formatCurrency(row.investimento) : <span className="text-gray-300">—</span>}</td>
                              {hasExecucao && <td className="py-1.5 text-right text-amber-700 font-semibold">{row.execucao > 0 ? formatCurrency(row.execucao) : <span className="text-gray-300">—</span>}</td>}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Modal de criativo ── */}
      {activeCreative && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setSelectedCreative(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-start justify-between gap-3 p-4 border-b border-gray-100 sticky top-0 bg-white z-10">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `linear-gradient(135deg, ${BLUE}, ${BLUE_LIGHT})` }}>
                  <ImageIcon className="w-4 h-4 text-white" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-gray-900 truncate" title={activeCreative.name}>{activeCreative.name.replace(/_/g, " ")}</h3>
                  <p className="text-[11px] text-gray-400 truncate">{activeCreative.veiculos.join(" · ") || "Criativo"}</p>
                </div>
              </div>
              <button onClick={() => setSelectedCreative(null)} className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 shrink-0" aria-label="Fechar">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 grid gap-4 md:grid-cols-[220px_1fr]">
              {/* Esquerda: imagem + veículos + posições */}
              <div>
                <CreativeThumb sources={[activeCreative.localImage, activeCreative.image]} alt={activeCreative.name} />
                <div className="mt-2 flex flex-wrap gap-1">
                  {activeCreative.veiculos.map((v) => (
                    <span key={v} className="text-[9px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-medium">{v}</span>
                  ))}
                  {activeCreative.formato && <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-medium">{activeCreative.formato}</span>}
                </div>
                {activeCreative.placements.length > 0 && (
                  <div className="mt-2">
                    <p className="text-[10px] text-gray-400 mb-1">Posicionamentos</p>
                    <div className="flex flex-wrap gap-1">
                      {activeCreative.placements.map((p) => (
                        <span key={p} className="text-[9px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{p}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Direita: resultados + comportamento no tempo */}
              <div className="space-y-4 min-w-0">
                <div>
                  <p className="text-[11px] font-bold text-gray-700 mb-2">Resultados gerais</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-blue-50 rounded-lg p-2 text-center">
                      <p className="text-base font-bold text-blue-700">{formatCompact(activeCreative.impressions)}</p>
                      <p className="text-[9px] text-gray-500">Impressões</p>
                    </div>
                    <div className="bg-cyan-50 rounded-lg p-2 text-center">
                      <p className="text-base font-bold text-cyan-700">{formatNum(activeCreative.clicks)}</p>
                      <p className="text-[9px] text-gray-500">Cliques</p>
                    </div>
                    <div className="bg-indigo-50 rounded-lg p-2 text-center">
                      <p className="text-base font-bold text-indigo-700">{formatPct(activeCreative.ctr)}</p>
                      <p className="text-[9px] text-gray-500">CTR</p>
                    </div>
                    <div className="bg-violet-50 rounded-lg p-2 text-center">
                      <p className="text-base font-bold text-violet-700">{activeCreative.videoViews > 0 ? formatCompact(activeCreative.videoViews) : "—"}</p>
                      <p className="text-[9px] text-gray-500">Visualizações</p>
                    </div>
                    <div className="bg-emerald-50 rounded-lg p-2 text-center">
                      <p className="text-base font-bold text-emerald-700">{formatCurrency(activeCreative.cost)}</p>
                      <p className="text-[9px] text-gray-500">Investimento · CPM {formatCurrency(activeCreative.cpm)}</p>
                    </div>
                    <div className="bg-amber-50 rounded-lg p-2 text-center">
                      <p className="text-base font-bold text-amber-700">{activeCreative.videoViews > 0 ? formatPct(activeCreative.vtr) : "—"}</p>
                      <p className="text-[9px] text-gray-500">{activeCreative.videoViews > 0 ? "VTR" : "Sem vídeo"}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                    <p className="text-[11px] font-bold text-gray-700">Comportamento ao longo do tempo</p>
                    <div className="flex gap-1">
                      {(["impressions", "clicks", "videoViews", "cost"] as const).map((m) => (
                        <button key={m} onClick={() => setModalMetric(m)}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold transition-all ${modalMetric === m ? "text-white shadow" : "bg-white text-gray-500 border border-gray-200 hover:border-blue-400"}`}
                          style={modalMetric === m ? { backgroundColor: BLUE } : {}}>{modalMetricLabel[m]}</button>
                      ))}
                    </div>
                  </div>
                  {creativeDaily.length > 1 ? (
                    <div style={{ height: 220 }}>
                      <ResponsiveLine
                        data={modalLineData}
                        colors={[BLUE]}
                        margin={{ top: 12, right: 20, bottom: 44, left: 56 }}
                        xScale={{ type: "point" }}
                        yScale={{ type: "linear", min: 0, max: "auto" }}
                        curve="monotoneX"
                        axisTop={null}
                        axisRight={null}
                        axisBottom={{ tickSize: 5, tickPadding: 8, tickRotation: -40, tickValues: modalTicks }}
                        axisLeft={{ tickSize: 5, tickPadding: 8, format: (v) => (modalMetric === "cost" ? `R$ ${formatCompact(Number(v))}` : formatCompact(Number(v))) }}
                        enableGridX={false}
                        enableArea
                        areaOpacity={0.12}
                        pointSize={6}
                        pointBorderWidth={2}
                        pointBorderColor={{ from: "seriesColor" }}
                        pointColor="#ffffff"
                        useMesh
                        enableSlices="x"
                        sliceTooltip={({ slice }) => (
                          <div className="bg-white rounded-lg shadow-xl border border-gray-100 px-3 py-2">
                            <p className="text-[11px] font-bold text-gray-900 mb-1">{String(slice.points[0]?.data.x)}</p>
                            <div className="flex items-center gap-2 text-[11px]">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: BLUE }} />
                              <span className="text-gray-600">{modalMetricLabel[modalMetric]}:</span>
                              <span className="font-semibold text-gray-900">
                                {modalMetric === "cost" ? formatCurrency(Number(slice.points[0]?.data.y)) : formatNum(Number(slice.points[0]?.data.y))}
                              </span>
                            </div>
                          </div>
                        )}
                      />
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 py-8 text-center">Este criativo tem apenas um dia de veiculação no período — sem série temporal para exibir.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default Cirio2026

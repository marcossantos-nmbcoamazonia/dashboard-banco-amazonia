"use client"

import type React from "react"
import { useRef, useState, useEffect, useMemo, useCallback } from "react"
import {
  DollarSign, Users, MousePointerClick, Eye, Play, Sparkles, RefreshCw,
  ArrowUpDown, Radio, ChevronRight, ChevronDown, Calendar, X, ArrowRight, Globe2,
  MapPin, Activity, Image as ImageIcon, MonitorPlay, Target, TrendingUp,
} from "lucide-react"
import axios from "axios"
import { ResponsiveLine } from "@nivo/line"
import Loading from "../../components/Loading/Loading"
import PDFDownloadButton from "../../components/PDFDownloadButton/PDFDownloadButton"
import BrazilMap from "../../components/BrazilMap/BrazilMap"
import { analyzeCusteioAgricola } from "../../services/gemini"
import { getCachedAnalysis, setCachedAnalysis } from "../../services/analysisCache"
import { CONTRATOS_CUSTEIO_AGRICOLA, DIARIA_MIN_IMPRESSOES, diasRestantesNoMes, type TipoCompra, type ContratoVeiculo } from "../../data/adserverContratos"
import {
  parseGA4Int, parseGA4Rate, prettySource, normalizeRegionToPT, ufSigla, blueRamp,
} from "./custeioGa4"

// ─── Constantes ─────────────────────────────────────────────────────────────
const SHEET = "1zxvpiES5XndqmRm36Ix2Nck1YR5WD6cJcttoimJzgas"
const SHEET_BASE = `https://nmbcoamazonia-api.vercel.app/google/sheets/${SHEET}/data`
const LP_URL = "http://basablog.rds.land/custeio"
const RD_LEADS_PAGES = 20 // páginas de 100 leads paginadas do RD para o gráfico diário

// Paleta Escala (Banco da Amazônia)
const BLUE_DARK = "#2d6fa3"
const BLUE = "#3b7fb8"
const BLUE_LIGHT = "#4a9ece"

// Cores por veículo (para o gráfico de evolução no tempo)
const VEICULO_COLOR: Record<string, string> = {
  Facebook: "#1877F2",
  Instagram: "#C13584",
  YouTube: "#FF0000",
  "Google Ads - PMAX": "#34A853",
  "Google Ads - Demand Gen": "#4285F4",
  "Google Ads": "#4285F4",
}
const colorForVeiculo = (v: string, i: number) => VEICULO_COLOR[v] ?? ["#2d6fa3", "#3b7fb8", "#4a9ece", "#6bb5e0", "#7c3aed"][i % 5]

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface ConsolidadoRow {
  date: string
  campaignName: string
  adSetName: string
  adName: string
  cost: number
  impressions: number
  clicks: number
  videoViews: number
  videoCompletions: number
  engagements: number
  leads: number
  veiculo: string
  tipoCompra: string
  image: string
  campanha: string
}

interface LpSummary {
  visits_count: number
  conversion_count: number
  conversion_rate: number
  period: { start_date: string; end_date: string }
}

interface AdServerRow {
  date: string
  publisher_name: string
  impressions: string
  clicks: string
  vieweables: string
  ctr: string
  va: string
  quantidade_contratada: number
  inicio_campanha: string
  fim_campanha: string
  type: string
  dimension: string
}

interface GA4Row { date: string; newUsers: number; sessions: number; engagement: number; source: string; bounce: number }
interface GA4RegionRow { date: string; region: string; sessions: number; city: string }
interface RdLead { uuid: string; created_at: string }

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

// Normaliza datas de origens diferentes (DD/MM/YYYY do Consolidado, ISO do restante)
// para "YYYY-MM-DD", usado na comparação com o filtro de período.
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

// Miniatura de criativo com fallback quando a URL da imagem falha (hotlink fbcdn)
const CreativeThumb: React.FC<{ src: string; alt: string }> = ({ src, alt }) => {
  const [err, setErr] = useState(false)
  if (!src || err) {
    return (
      <div className="w-full aspect-square rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
        <ImageIcon className="w-8 h-8 text-blue-300" />
      </div>
    )
  }
  return (
    <img src={src} alt={alt} loading="lazy" onError={() => setErr(true)}
         className="w-full aspect-square rounded-lg object-cover bg-gray-100" />
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

const CusteioAgricola: React.FC = () => {
  const contentRef = useRef<HTMLDivElement>(null)
  const [consolidado, setConsolidado] = useState<ConsolidadoRow[]>([])
  const [aiAnalysis, setAiAnalysis] = useState<string>("")
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [lpSummary, setLpSummary] = useState<LpSummary | null>(null)
  const [lpLoading, setLpLoading] = useState(false)
  const [adServer, setAdServer] = useState<AdServerRow[]>([])
  const [adServer2, setAdServer2] = useState<AdServerRow[]>([])
  const [adServer3, setAdServer3] = useState<AdServerRow[]>([])
  const [adServer4, setAdServer4] = useState<AdServerRow[]>([])
  const [offlineRaw, setOfflineRaw] = useState<string[][]>([])
  const [ga4, setGa4] = useState<GA4Row[]>([])
  const [ga4Region, setGa4Region] = useState<GA4RegionRow[]>([])
  const [rdLeads, setRdLeads] = useState<RdLead[]>([])
  const [rdLeadsLoading, setRdLeadsLoading] = useState(true)
  const [expandedMeios, setExpandedMeios] = useState<Record<string, boolean>>({})
  const [expandedPracas, setExpandedPracas] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [selectedVeiculo, setSelectedVeiculo] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: "", end: "" })
  const [creativeSort, setCreativeSort] = useState<"impressions" | "leads" | "ctr" | "cost">("impressions")
  const [creativeVeiculo, setCreativeVeiculo] = useState<"Todos" | "Facebook" | "Instagram">("Todos")
  const [selectedCreative, setSelectedCreative] = useState<string | null>(null) // image URL do criativo aberto no modal
  const [modalMetric, setModalMetric] = useState<"impressions" | "clicks" | "leads" | "cost">("impressions")
  // Gráfico de evolução (redes sociais)
  type ChartMetric = "impressions" | "clicks" | "cost" | "leads" | "videoViews" | "ctr" | "vtr"
  const [chartMetric, setChartMetric] = useState<ChartMetric>("impressions")
  type SortCol = "publisher" | "contratado" | "impressions" | "pacingPct" | "clicks" | "ctr" | "va"
  const [sortCol, setSortCol] = useState<SortCol>("impressions")
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc")

  const toggleSort = (col: SortCol) => {
    if (sortCol === col) setSortDir((d) => (d === "desc" ? "asc" : "desc"))
    else { setSortCol(col); setSortDir("desc") }
  }

  // ─── Fetch principal (Consolidado + AdServer + Off-line + GA4 x2) ────────────
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const [consRes, ad1, ad2, ad3, ad4, offRes, ga4Res, ga4RgRes] = await Promise.all([
          axios.get(`${SHEET_BASE}?range=consolidado`),
          axios.get("https://dashbrasiladserver.com.br/api/templates/310/bi?token=NOP2VowjgW").catch(() => ({ data: [] })),
          axios.get("https://dashbrasiladserver.com.br/api/templates/315/bi?token=EJb3iiYWom").catch(() => ({ data: [] })),
          axios.get("https://dashbrasiladserver.com.br/api/templates/343/bi?token=wBNTzINzMq").catch(() => ({ data: [] })),
          axios.get("https://dashbrasiladserver.com.br/api/templates/342/bi?token=sw2qFEMv17").catch(() => ({ data: [] })),
          axios.get("https://nmbcoamazonia-api.vercel.app/google/sheets/1gyIm-B64gY7nEuJ_VGchcEzAvINEHgFSmoAbL5RYMLo/data?range=Offline%20-%20Consolidado").catch(() => ({ data: { success: false } })),
          axios.get(`${SHEET_BASE}?range=GA4`).catch(() => ({ data: { success: false } })),
          axios.get(`${SHEET_BASE}?range=GA4%20-%20Region`).catch(() => ({ data: { success: false } })),
        ])

        // Consolidado — Meta + Google (col. Image = criativo)
        if (consRes.data.success && consRes.data.data.values) {
          const rows: any[][] = consRes.data.data.values
          const header = rows[0]
          const idx = (col: string) => header.indexOf(col)
          const iVeic = 14 // "Veículo" (acento gera mismatch de índice em alguns ambientes)
          const parsed: ConsolidadoRow[] = rows.slice(1).map((r) => ({
            date: r[idx("Date")] || "",
            campaignName: r[idx("Campaign name")] || "",
            adSetName: r[idx("Ad Set Name")] || "",
            adName: r[idx("Ad Name")] || "",
            cost: parseNum(r[idx("Cost")] ?? "0"),
            impressions: parseNum(r[idx("Impressions")] || "0"),
            clicks: parseNum(r[idx("Clicks")] || "0"),
            videoViews: parseNum(r[idx("Video views")] || "0"),
            videoCompletions: parseNum(r[idx("Video completions")] || "0"),
            engagements: parseNum(r[idx("Total engagements")] || "0"),
            leads: parseNum(r[idx("Leads")] || "0"),
            veiculo: r[iVeic] || "",
            tipoCompra: r[idx("Tipo de Compra")] || "",
            image: r[idx("Image")] || "",
            campanha: r[idx("Campanha")] || "",
          }))
          setConsolidado(parsed)
        }

        if (Array.isArray(ad1.data) && ad1.data.length > 0) setAdServer(ad1.data)
        if (Array.isArray(ad2.data) && ad2.data.length > 0) setAdServer2(ad2.data)
        if (Array.isArray(ad3.data) && ad3.data.length > 0) setAdServer3(ad3.data)
        if (Array.isArray(ad4.data) && ad4.data.length > 0) setAdServer4(ad4.data)
        if (offRes.data?.success && offRes.data?.data?.values) setOfflineRaw(offRes.data.data.values)

        // GA4 — sessões
        if (ga4Res.data?.success && ga4Res.data?.data?.values) {
          const rows: string[][] = ga4Res.data.data.values
          const h = rows[0]
          const gi = (c: string) => h.indexOf(c)
          const iNew = gi("New users"), iSess = gi("Sessions"), iEng = gi("User engagement")
          const iSrc = gi("Session source"), iBounce = gi("Bounce rate")
          setGa4(rows.slice(1).map((r) => ({
            date: (r[0] || "").slice(0, 10),
            newUsers: parseGA4Int(r[iNew]),
            sessions: parseGA4Int(r[iSess]),
            engagement: parseGA4Int(r[iEng]),
            source: r[iSrc] || "",
            bounce: parseGA4Rate(r[iBounce]),
          })))
        }
        // GA4 — regiões (agora com City)
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
      } catch (err) {
        console.error("Erro ao buscar dados Custeio Agrícola:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  // ─── Fetch RD leads (paginado) — só para o gráfico diário; total vem do lp-summary ──
  useEffect(() => {
    const fetchLeads = async () => {
      try {
        setRdLeadsLoading(true)
        const pages = Array.from({ length: RD_LEADS_PAGES }, (_, i) => i + 1)
        const results = await Promise.all(
          pages.map((p) =>
            axios
              .get(`https://nmbcoamazonia-api.vercel.app/rdstation/leads?url=${encodeURIComponent(LP_URL)}&page=${p}`)
              .catch(() => ({ data: { data: { contacts: [] } } }))
          )
        )
        const seen = new Set<string>()
        const leads: RdLead[] = []
        results.forEach((res) => {
          const contacts = res.data?.data?.contacts ?? []
          contacts.forEach((c: any) => {
            if (c?.uuid && !seen.has(c.uuid)) {
              seen.add(c.uuid)
              leads.push({ uuid: c.uuid, created_at: c.created_at || "" })
            }
          })
        })
        setRdLeads(leads)
      } catch (err) {
        console.error("Erro ao buscar leads (RD Station):", err)
      } finally {
        setRdLeadsLoading(false)
      }
    }
    fetchLeads()
  }, [])

  // ─── LP summary (RD Station) — total de leads/conversões, reage ao período ──
  useEffect(() => {
    const fetchLpSummary = async () => {
      try {
        setLpLoading(true)
        const params = new URLSearchParams({ url: LP_URL })
        if (dateRange.start || dateRange.end) {
          const today = new Date().toISOString().slice(0, 10)
          params.set("start_date", dateRange.start || "2025-01-01")
          params.set("end_date", dateRange.end || today)
        }
        const res = await axios.get(`https://nmbcoamazonia-api.vercel.app/rdstation/lp-summary?${params.toString()}`)
        if (res.data?.success && res.data?.data) setLpSummary(res.data.data)
        else setLpSummary(null)
      } catch (err) {
        console.error("Erro ao buscar LP summary (RD Station):", err)
        setLpSummary(null)
      } finally {
        setLpLoading(false)
      }
    }
    fetchLpSummary()
  }, [dateRange])

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

  // ─── Base Consolidado (Meta+Google) ──────────────────────────────────────────
  const consolidadoPorData = useMemo(
    () => consolidado.filter((r) => inDateRange(r.date)),
    [consolidado, inDateRange]
  )

  const totals = useMemo(() => {
    const t = consolidadoPorData.reduce(
      (acc, r) => ({
        cost: acc.cost + r.cost,
        impressions: acc.impressions + r.impressions,
        clicks: acc.clicks + r.clicks,
        videoViews: acc.videoViews + r.videoViews,
        videoCompletions: acc.videoCompletions + r.videoCompletions,
        leads: acc.leads + r.leads,
        engagements: acc.engagements + r.engagements,
      }),
      { cost: 0, impressions: 0, clicks: 0, videoViews: 0, videoCompletions: 0, leads: 0, engagements: 0 }
    )
    return {
      ...t,
      ctr: t.impressions > 0 ? t.clicks / t.impressions : 0,
      cpc: t.clicks > 0 ? t.cost / t.clicks : 0,
      vtr: t.videoViews > 0 ? t.videoCompletions / t.videoViews : 0,
    }
  }, [consolidadoPorData])

  const veiculos = useMemo(
    () => Array.from(new Set(consolidadoPorData.map((r) => r.veiculo).filter(Boolean))),
    [consolidadoPorData]
  )

  const byVeiculo = useMemo(() => {
    const map = new Map<string, { cost: number; impressions: number; clicks: number; leads: number; ctr: number; cpl: number }>()
    veiculos.forEach((v) => {
      const rows = consolidadoPorData.filter((r) => r.veiculo === v)
      const t = rows.reduce(
        (acc, r) => ({ cost: acc.cost + r.cost, impressions: acc.impressions + r.impressions, clicks: acc.clicks + r.clicks, leads: acc.leads + r.leads }),
        { cost: 0, impressions: 0, clicks: 0, leads: 0 }
      )
      map.set(v, {
        ...t,
        ctr: t.impressions > 0 ? t.clicks / t.impressions : 0,
        cpl: t.leads > 0 ? t.cost / t.leads : 0,
      })
    })
    return map
  }, [consolidadoPorData, veiculos])

  const metaLeadsByPlatform = useMemo(() => {
    const map = new Map<string, number>()
    consolidadoPorData.forEach((r) => {
      if (r.leads > 0) map.set(r.veiculo || "Desconhecido", (map.get(r.veiculo || "Desconhecido") || 0) + r.leads)
    })
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1])
  }, [consolidadoPorData])

  const metaLeadsTotal = useMemo(() => consolidadoPorData.reduce((a, r) => a + r.leads, 0), [consolidadoPorData])

  // Leads do Google Ads (PMAX / Demand Gen) — já contabilizados nas conversões do RD.
  // São descontados dos leads de redes sociais no total para evitar dupla contagem;
  // YouTube (veículo à parte) NÃO é Google Ads e permanece somando.
  const googleAdsLeads = useMemo(
    () => consolidadoPorData.filter((r) => /google/i.test(r.veiculo)).reduce((a, r) => a + r.leads, 0),
    [consolidadoPorData]
  )

  // ─── Criativos (Meta) ────────────────────────────────────────────────────────
  // O identificador distintivo do criativo é o Ad Set Name (ex.: "PECUÁRIA_1080X1350_SP...").
  // O Ad Name é apenas o placement ("Feed: News Feed", "Instagram Stories").
  const creatives = useMemo(() => {
    type Agg = { image: string; name: string; veiculos: Set<string>; placements: Set<string>; campanhas: Set<string>; impressions: number; clicks: number; cost: number; leads: number; videoViews: number; videoCompletions: number }
    const map = new Map<string, Agg>()
    consolidadoPorData.forEach((r) => {
      if (!r.image) return
      if (creativeVeiculo !== "Todos" && r.veiculo !== creativeVeiculo) return
      const key = r.image
      const cur = map.get(key) ?? { image: r.image, name: "", veiculos: new Set<string>(), placements: new Set<string>(), campanhas: new Set<string>(), impressions: 0, clicks: 0, cost: 0, leads: 0, videoViews: 0, videoCompletions: 0 }
      cur.impressions += r.impressions
      cur.clicks += r.clicks
      cur.cost += r.cost
      cur.leads += r.leads
      cur.videoViews += r.videoViews
      cur.videoCompletions += r.videoCompletions
      if (r.veiculo) cur.veiculos.add(r.veiculo)
      if (r.adName) cur.placements.add(r.adName)
      if (r.campaignName) cur.campanhas.add(r.campaignName)
      if (!cur.name && r.adSetName) cur.name = r.adSetName
      map.set(key, cur)
    })
    const arr = Array.from(map.values()).map((c) => ({
      image: c.image,
      name: c.name || Array.from(c.placements)[0] || "Criativo",
      veiculos: Array.from(c.veiculos),
      placements: Array.from(c.placements),
      campanhas: Array.from(c.campanhas),
      impressions: c.impressions, clicks: c.clicks, cost: c.cost, leads: c.leads,
      videoViews: c.videoViews, videoCompletions: c.videoCompletions,
      ctr: c.impressions > 0 ? c.clicks / c.impressions : 0,
      vtr: c.videoViews > 0 ? c.videoCompletions / c.videoViews : 0,
    }))
    arr.sort((a, b) => {
      if (creativeSort === "ctr") return b.ctr - a.ctr
      if (creativeSort === "leads") return b.leads - a.leads
      if (creativeSort === "cost") return b.cost - a.cost
      return b.impressions - a.impressions
    })
    return arr
  }, [consolidadoPorData, creativeSort, creativeVeiculo])

  // Criativo aberto no modal + sua série diária (comportamento ao longo do tempo)
  const activeCreative = useMemo(
    () => (selectedCreative ? creatives.find((c) => c.image === selectedCreative) ?? null : null),
    [selectedCreative, creatives]
  )

  const creativeDaily = useMemo(() => {
    if (!selectedCreative) return [] as { iso: string; impressions: number; clicks: number; leads: number; cost: number }[]
    const map = new Map<string, { impressions: number; clicks: number; leads: number; cost: number }>()
    consolidadoPorData.forEach((r) => {
      if (r.image !== selectedCreative) return
      const iso = toISODate(r.date)
      if (!iso) return
      const cur = map.get(iso) ?? { impressions: 0, clicks: 0, leads: 0, cost: 0 }
      cur.impressions += r.impressions; cur.clicks += r.clicks; cur.leads += r.leads; cur.cost += r.cost
      map.set(iso, cur)
    })
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([iso, v]) => ({ iso, ...v }))
  }, [selectedCreative, consolidadoPorData])

  const modalMetricLabel: Record<typeof modalMetric, string> = { impressions: "Impressões", clicks: "Cliques", leads: "Leads", cost: "Investimento" }
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

  // Desempenho por canal (origem da sessão): sessões, novos usuários, engajamento
  // médio (engagement/sessões) e taxa de rejeição (ponderada por sessões).
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

  // Top cidades (novo campo City da API de region) — exclui "(not set)"/vazio
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

  // ─── Gráfico de evolução no tempo (redes sociais) ────────────────────────────
  const chartMetricLabel: Record<ChartMetric, string> = {
    impressions: "Impressões", clicks: "Cliques", cost: "Investimento",
    leads: "Leads", videoViews: "Visualizações", ctr: "CTR", vtr: "VTR",
  }
  const chartIsPct = chartMetric === "ctr" || chartMetric === "vtr"
  const chartIsCurrency = chartMetric === "cost"

  const chartData = useMemo(() => {
    type DaySum = { cost: number; impressions: number; clicks: number; leads: number; videoViews: number; videoCompletions: number }
    const perVeic = new Map<string, Map<string, DaySum>>()
    consolidadoPorData.forEach((r) => {
      const iso = toISODate(r.date)
      if (!iso || !r.veiculo) return
      if (!perVeic.has(r.veiculo)) perVeic.set(r.veiculo, new Map())
      const days = perVeic.get(r.veiculo)!
      const cur = days.get(iso) ?? { cost: 0, impressions: 0, clicks: 0, leads: 0, videoViews: 0, videoCompletions: 0 }
      cur.cost += r.cost; cur.impressions += r.impressions; cur.clicks += r.clicks
      cur.leads += r.leads; cur.videoViews += r.videoViews; cur.videoCompletions += r.videoCompletions
      days.set(iso, cur)
    })
    const value = (s: DaySum): number => {
      switch (chartMetric) {
        case "impressions": return s.impressions
        case "clicks": return s.clicks
        case "cost": return s.cost
        case "leads": return s.leads
        case "videoViews": return s.videoViews
        case "ctr": return s.impressions > 0 ? (s.clicks / s.impressions) * 100 : 0
        case "vtr": return s.videoViews > 0 ? (s.videoCompletions / s.videoViews) * 100 : 0
        default: return 0
      }
    }
    return Array.from(perVeic.entries())
      .map(([veic, days], i) => ({
        id: veic,
        color: colorForVeiculo(veic, i),
        data: Array.from(days.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([iso, s]) => ({ x: iso, y: Number(value(s).toFixed(chartIsPct || chartIsCurrency ? 2 : 0)) })),
      }))
      .sort((a, b) => a.id.localeCompare(b.id))
  }, [consolidadoPorData, chartMetric, chartIsPct, chartIsCurrency])

  const chartColors = useMemo(() => chartData.map((s) => s.color), [chartData])
  const chartHasData = chartData.some((s) => s.data.length > 0)
  const chartTicks = useMemo(() => {
    const set = new Set<string>()
    consolidadoPorData.forEach((r) => { const iso = toISODate(r.date); if (iso) set.add(iso) })
    const xs = Array.from(set).sort((a, b) => a.localeCompare(b))
    const step = Math.ceil(xs.length / 8) || 1
    return xs.filter((_, i) => i % step === 0)
  }, [consolidadoPorData])

  // ─── Leads por dia (RD, agregando created_at) ────────────────────────────────
  const rdLeadsPorData = useMemo(() => rdLeads.filter((l) => inDateRange(l.created_at)), [rdLeads, inDateRange])

  const leadsByDay = useMemo(() => {
    const map = new Map<string, number>()
    rdLeadsPorData.forEach((l) => {
      const iso = toISODate(l.created_at)
      if (iso) map.set(iso, (map.get(iso) || 0) + 1)
    })
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [rdLeadsPorData])
  const maxLeadsDay = useMemo(() => Math.max(...leadsByDay.map((d) => d[1]), 1), [leadsByDay])

  // ─── AdServer ────────────────────────────────────────────────────────────────
  const allAdServer = useMemo(
    () => [...adServer, ...adServer2, ...adServer3, ...adServer4].filter((r) => inDateRange(r.date)),
    [adServer, adServer2, adServer3, adServer4, inDateRange]
  )

  const adServerByPublisher = useMemo(() => {
    const normalize = (s: string) => s.toUpperCase().trim()
    const contratosPorPublisher = new Map<string, ContratoVeiculo[]>()
    CONTRATOS_CUSTEIO_AGRICOLA.forEach((c) => {
      const key = normalize(c.publisher)
      const arr = contratosPorPublisher.get(key) ?? []
      arr.push(c)
      contratosPorPublisher.set(key, arr)
    })

    type DayMap = Map<string, number>
    const map = new Map<string, { impressions: number; clicks: number; vieweables: number; byDay: DayMap; inicioPublisher: string }>()

    const resolvePublisherName = (raw: string): string => {
      const lower = raw.toLowerCase().trim()
      if (lower.startsWith("spotify") || lower.startsWith("spotfy")) return "Spotify"
      if (lower.startsWith("deezer")) return "Deezer"
      if (lower.startsWith("alright")) return "Alright"
      if (lower.startsWith("zap")) return "Zap Media"
      return raw.trim()
    }

    allAdServer.forEach((r) => {
      const key = resolvePublisherName(r.publisher_name)
      const imp = parseInt(r.impressions) || 0
      const cur = map.get(key) ?? { impressions: 0, clicks: 0, vieweables: 0, byDay: new Map(), inicioPublisher: r.date }
      const dayImp = (cur.byDay.get(r.date) ?? 0) + imp
      cur.byDay.set(r.date, dayImp)
      map.set(key, {
        impressions: cur.impressions + imp,
        clicks: cur.clicks + (parseInt(r.clicks) || 0),
        vieweables: cur.vieweables + (parseInt(r.vieweables) || 0),
        byDay: cur.byDay,
        inicioPublisher: r.date < cur.inicioPublisher ? r.date : cur.inicioPublisher,
      })
    })

    const rows: {
      name: string; rowKey: string; impressions: number; clicks: number; vieweables: number
      diasValidos: number; metaDias: number | null; inicioPublisher: string; tipo: TipoCompra | null
      contrato: ContratoVeiculo | null; pacingPct: number; ctr: number; va: number; isSubrow: boolean
    }[] = []

    Array.from(map.entries()).forEach(([name, v]) => {
      const normName = normalize(name)
      const normNameClean = normName.replace(/\.COM$/, "").replace(/\.COM\.BR$/, "").trim()
      const contratos =
        contratosPorPublisher.get(normName) ??
        contratosPorPublisher.get(normNameClean) ??
        (Array.from(contratosPorPublisher.entries()).find(([k]) => normNameClean.includes(k) || k.includes(normNameClean))?.[1] ?? [])

      const diasValidos = Array.from(v.byDay.entries()).filter(([date, imp]) => date >= v.inicioPublisher && imp > DIARIA_MIN_IMPRESSOES).length
      const ctr = v.impressions > 0 ? (v.clicks / v.impressions) * 100 : 0
      const va = v.impressions > 0 ? (v.vieweables / v.impressions) * 100 : 0

      if (contratos.length === 0) {
        rows.push({ name, rowKey: name, impressions: v.impressions, clicks: v.clicks, vieweables: v.vieweables, diasValidos, metaDias: null, inicioPublisher: v.inicioPublisher, tipo: null, contrato: null, pacingPct: 0, ctr, va, isSubrow: false })
        return
      }
      contratos.forEach((contrato, i) => {
        const metaDias = contrato.tipo === "DIARIA" ? (contrato.quantidade !== null ? contrato.quantidade : diasRestantesNoMes(v.inicioPublisher)) : null
        const pacingPct = (contrato.tipo === "CPM" || contrato.tipo === "CPV")
          ? Math.min((v.impressions / (contrato.quantidade ?? 1)) * 100, 100)
          : contrato.tipo === "CPC"
          ? Math.min((v.clicks / (contrato.quantidade ?? 1)) * 100, 100)
          : Math.min((diasValidos / (metaDias ?? 1)) * 100, 100)
        rows.push({
          name, rowKey: `${name}__${contrato.tipo}__${i}`,
          impressions: i === 0 ? v.impressions : 0, clicks: v.clicks, vieweables: v.vieweables,
          diasValidos, metaDias, inicioPublisher: v.inicioPublisher, tipo: contrato.tipo, contrato,
          pacingPct, ctr: i === 0 ? ctr : 0, va: i === 0 ? va : 0, isSubrow: i > 0,
        })
      })
    })
    return rows
  }, [allAdServer])

  const adServerSorted = useMemo(() => {
    const valMap = new Map<string, number | string>()
    adServerByPublisher.forEach((r) => {
      if (r.isSubrow) return
      let v: number | string = 0
      if (sortCol === "publisher") v = r.name
      else if (sortCol === "impressions") v = r.impressions
      else if (sortCol === "clicks") v = r.clicks
      else if (sortCol === "ctr") v = r.ctr
      else if (sortCol === "va") v = r.va
      else if (sortCol === "pacingPct") v = r.pacingPct
      else if (sortCol === "contratado") v = r.contrato?.quantidade ?? 0
      valMap.set(r.name, v)
    })
    return [...adServerByPublisher].sort((a, b) => {
      if (a.name === b.name) return a.isSubrow ? 1 : -1
      const vA = valMap.get(a.name) ?? 0
      const vB = valMap.get(b.name) ?? 0
      const cmp = typeof vA === "string" ? vA.localeCompare(vB as string) : (vB as number) - (vA as number)
      return sortDir === "asc" ? -cmp : cmp
    })
  }, [adServerByPublisher, sortCol, sortDir])

  const adServerTotals = useMemo(() => {
    const t = allAdServer.reduce(
      (acc, r) => ({
        impressions: acc.impressions + (parseInt(r.impressions) || 0),
        clicks: acc.clicks + (parseInt(r.clicks) || 0),
        vieweables: acc.vieweables + (parseInt(r.vieweables) || 0),
      }),
      { impressions: 0, clicks: 0, vieweables: 0 }
    )
    const meta = allAdServer[0]
    return {
      ...t,
      ctr: t.impressions > 0 ? (t.clicks / t.impressions) * 100 : 0,
      va: t.impressions > 0 ? (t.vieweables / t.impressions) * 100 : 0,
      quantidade_contratada: meta?.quantidade_contratada ?? 0,
      inicio_campanha: meta?.inicio_campanha ?? "",
      fim_campanha: meta?.fim_campanha ?? "",
    }
  }, [allAdServer])

  // ─── Off-line ─────────────────────────────────────────────────────────────────
  const offlineData = useMemo(() => {
    if (offlineRaw.length < 2) return { meios: {} as Record<string, any>, totalInsercoes: 0, totalInvestimento: 0 }
    const headers = offlineRaw[0]
    const iMeio = headers.indexOf("MEIO"), iVeiculo = headers.indexOf("VEÍCULO"), iPraca = headers.indexOf("PRAÇA")
    const iInsercoes = headers.indexOf("Total Inserções"), iInvest = headers.indexOf("Investimento")
    const parseCur = (v: string): number => {
      if (!v || v === "-") return 0
      return parseFloat(v.replace(/R\$\s?/g, "").replace(/\./g, "").replace(",", ".")) || 0
    }
    type PracaEntry = { insercoes: number; investimento: number }
    type VeiculoEntry = { pracas: Record<string, PracaEntry>; insercoes: number; investimento: number }
    type MeioEntry = { veiculos: Record<string, VeiculoEntry>; insercoes: number; investimento: number }
    const meios: Record<string, MeioEntry> = {}
    let totalInsercoes = 0, totalInvestimento = 0
    offlineRaw.slice(1).forEach((row) => {
      const meio = row[iMeio] || "", veiculo = row[iVeiculo] || "", praca = row[iPraca] || ""
      const ins = parseInt((row[iInsercoes] || "0").replace(/\./g, "").replace(",", ".")) || 0
      const inv = parseCur(row[iInvest] || "0")
      if (!meio || !veiculo) return
      totalInsercoes += ins; totalInvestimento += inv
      if (!meios[meio]) meios[meio] = { veiculos: {}, insercoes: 0, investimento: 0 }
      meios[meio].insercoes += ins; meios[meio].investimento += inv
      if (!meios[meio].veiculos[veiculo]) meios[meio].veiculos[veiculo] = { pracas: {}, insercoes: 0, investimento: 0 }
      meios[meio].veiculos[veiculo].insercoes += ins; meios[meio].veiculos[veiculo].investimento += inv
      if (!meios[meio].veiculos[veiculo].pracas[praca]) meios[meio].veiculos[veiculo].pracas[praca] = { insercoes: 0, investimento: 0 }
      meios[meio].veiculos[veiculo].pracas[praca].insercoes += ins
      meios[meio].veiculos[veiculo].pracas[praca].investimento += inv
    })
    return { meios, totalInsercoes, totalInvestimento }
  }, [offlineRaw])

  // ─── Funil (big numbers) ─────────────────────────────────────────────────────
  const funnel = useMemo(() => {
    const investimento = totals.cost
    const impressoes = totals.impressions + adServerTotals.impressions
    const visualizacoes = totals.videoViews
    const cliques = totals.clicks + adServerTotals.clicks
    const sessoes = ga4Totals.sessions
    // Leads totais = RD (conversões da LP) + leads de redes sociais (Meta + YouTube),
    // descontando os leads do Google Ads (PMAX/Demand Gen), que já entram no RD.
    const rdLeads = lpSummary?.conversion_count ?? rdLeadsPorData.length
    const leads = rdLeads + Math.max(metaLeadsTotal - googleAdsLeads, 0)
    return {
      investimento, impressoes, visualizacoes, cliques, sessoes, leads, rdLeads,
      ctr: impressoes > 0 ? cliques / impressoes : 0,
      cpl: leads > 0 ? investimento / leads : 0,
    }
  }, [totals, adServerTotals, ga4Totals, lpSummary, rdLeadsPorData, metaLeadsTotal, googleAdsLeads])

  // ─── Análise IA ──────────────────────────────────────────────────────────────
  const DATA_KEY = "custeio-agricola"

  const buildAnalysisPayload = () => {
    const byVeiculoArr = veiculos.map((v) => {
      const t = byVeiculo.get(v)!
      return { name: v, impressions: t.impressions, clicks: t.clicks, leads: t.leads, cost: t.cost, ctr: t.ctr, cpl: t.cpl }
    })
    return {
      totals: { cost: totals.cost, leads: totals.leads, impressions: totals.impressions, clicks: totals.clicks, videoViews: totals.videoViews, ctr: totals.ctr, cpl: totals.leads > 0 ? totals.cost / totals.leads : 0, vtr: totals.vtr },
      adServerTotals: { impressions: adServerTotals.impressions, clicks: adServerTotals.clicks, vieweables: adServerTotals.vieweables, ctr: adServerTotals.ctr, va: adServerTotals.va, quantidade_contratada: adServerTotals.quantidade_contratada },
      metaLeadsTotal, googleAdsLeads, lpSummary, byVeiculo: byVeiculoArr,
      adServerByPublisher: adServerByPublisher.filter((r) => !r.isSubrow).map((p) => ({ name: p.name, impressions: p.impressions, clicks: p.clicks, ctr: p.ctr, va: p.va })),
      ga4: {
        sessions: ga4Totals.sessions, newUsers: ga4Totals.newUsers, avgEngagementSec: ga4Totals.avgEngagement, bounceRate: ga4Totals.bounceRate,
        topSources: channelStats.slice(0, 8).map((c) => ({ name: c.name, sessions: c.sessions })), topRegions: regionRanking.slice(0, 8),
      },
      leadsTotal: funnel.leads,
    }
  }

  const runAiAnalysis = async (forceRefresh = false) => {
    setAiLoading(true)
    setAiError(null)
    try {
      if (!forceRefresh) {
        const cached = await getCachedAnalysis(DATA_KEY)
        if (cached) { setAiAnalysis(cached.analysis); setAiLoading(false); return }
      }
      const result = await analyzeCusteioAgricola(buildAnalysisPayload())
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

  const hasGa4 = ga4Totals.sessions > 0

  return (
    <div ref={contentRef} className="h-full flex flex-col space-y-3 overflow-auto">

      {/* ── Hero ── */}
      <div className="relative overflow-hidden rounded-2xl shadow-2xl h-36">
        <div className="relative h-full" style={{ background: `linear-gradient(to right, ${BLUE_DARK}, ${BLUE}, ${BLUE_LIGHT})` }}>
          <img src="/images/fundo_card.webp" alt="Custeio Agrícola" className="w-full h-full object-cover mix-blend-overlay opacity-30" />
          <div className="absolute inset-0" style={{ background: "linear-gradient(to right, rgba(30,90,140,0.6), rgba(45,111,163,0.3))" }} />
          <div className="absolute top-3 right-3 z-10">
            <PDFDownloadButton contentRef={contentRef} fileName="custeio-agricola" />
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-4 flex items-end justify-between">
            <div>
              <p className="text-blue-100 text-xs font-medium mb-1 uppercase tracking-wider">Campanhas · Escala</p>
              <h1 className="text-2xl font-bold text-white">Custeio Agrícola</h1>
              <p className="text-blue-100 text-sm">Report geral de performance</p>
            </div>
            <div className="text-right flex gap-5">
              <div>
                <p className="text-blue-100 text-xs">Investimento</p>
                <p className="text-2xl font-bold text-white">{formatCompact(funnel.investimento)}</p>
              </div>
              <div>
                <p className="text-blue-100 text-xs">Sessões no site</p>
                <p className="text-2xl font-bold text-white">{hasGa4 ? formatCompact(funnel.sessoes) : "—"}</p>
              </div>
              <div>
                <p className="text-blue-100 text-xs">Leads</p>
                <p className="text-2xl font-bold text-white">{lpSummary ? formatNum(funnel.leads) : "—"}</p>
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
          Filtra Redes Sociais, Display, Site (GA4) e Leads. Off-line não possui data por registro.
        </span>
      </div>

      {/* ── Funil (big numbers) ── */}
      <div className="card-overlay rounded-xl shadow-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Target className="w-4 h-4" style={{ color: BLUE }} />
          <h3 className="text-sm font-bold text-gray-900">Funil da Campanha</h3>
          <span className="text-[11px] text-gray-400">Da mídia ao lead</span>
        </div>
        <div className="flex flex-wrap items-stretch gap-2">
          {[
            { el: <FunnelStep key="inv" label="Investimento" value={formatCurrency(funnel.investimento)} sub="Meta + Google" icon={<DollarSign className="w-3.5 h-3.5" />} tooltip="Investimento em mídia paga nas Redes Sociais (Meta) e Google, do consolidado." /> },
            { el: <FunnelStep key="imp" label="Impressões" value={formatCompact(funnel.impressoes)} sub="Redes + Display" icon={<Eye className="w-3.5 h-3.5" />} tooltip="Impressões somando Redes Sociais (Meta/Google) e Display programático (AdServer)." /> },
            { el: <FunnelStep key="vv" label="Visualizações" value={formatCompact(funnel.visualizacoes)} sub={`VTR ${formatPct(totals.vtr)}`} icon={<Play className="w-3.5 h-3.5" />} tooltip="Vídeos iniciados nas Redes Sociais. VTR = conclusões ÷ inícios." /> },
            { el: <FunnelStep key="clk" label="Cliques" value={formatCompact(funnel.cliques)} sub={`CTR ${formatPct(funnel.ctr)}`} icon={<MousePointerClick className="w-3.5 h-3.5" />} tooltip="Cliques somando Redes Sociais e Display. CTR = cliques ÷ impressões." /> },
            { el: <FunnelStep key="ses" label="Sessões" value={hasGa4 ? formatCompact(funnel.sessoes) : "—"} sub={hasGa4 ? `${formatCompact(ga4Totals.newUsers)} novos` : "GA4"} icon={<Globe2 className="w-3.5 h-3.5" />} tooltip="Sessões na Landing Page medidas pelo Google Analytics 4 (GA4)." /> },
            { el: <FunnelStep key="lead" label="Leads" value={lpSummary ? formatNum(funnel.leads) : "—"} sub={funnel.cpl > 0 ? `CPL ${formatCurrency(funnel.cpl)}` : "RD Station"} icon={<Users className="w-3.5 h-3.5" />} tooltip="Leads totais = conversões da LP (RD Station) + leads de redes sociais (Meta e YouTube). Os leads do Google Ads (PMAX/Demand Gen) são descontados por já entrarem no RD. CPL = investimento ÷ leads." /> },
          ].map((s, i, arr) => (
            <div key={i} className="flex items-stretch gap-2 flex-1 min-w-[140px]">
              {s.el}
              {i < arr.length - 1 && <div className="hidden lg:flex items-center"><ArrowRight className="w-4 h-4 text-gray-300" /></div>}
            </div>
          ))}
        </div>
      </div>

      {/* ── Performance por Veículo (Meta) ── */}
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
                  <th className="text-right py-2 text-gray-500 font-medium">Cliques</th>
                  <th className="text-right py-2 text-gray-500 font-medium">CTR</th>
                  <th className="text-right py-2 text-gray-500 font-medium">Leads</th>
                  <th className="text-right py-2 text-gray-500 font-medium">CPL</th>
                </tr>
              </thead>
              <tbody>
                {veiculos.map((v) => {
                  const t = byVeiculo.get(v)!
                  const isSelected = selectedVeiculo === v
                  return (
                    <tr key={v}
                      className={`border-b border-gray-100 cursor-pointer transition-colors ${isSelected ? "bg-blue-50" : "hover:bg-gray-50"}`}
                      onClick={() => setSelectedVeiculo(isSelected ? null : v)}>
                      <td className="py-2 font-semibold text-gray-800">{v}</td>
                      <td className="py-2 text-right text-gray-700">{formatCurrency(t.cost)}</td>
                      <td className="py-2 text-right text-gray-700">{formatNum(t.impressions)}</td>
                      <td className="py-2 text-right text-gray-700">{formatNum(t.clicks)}</td>
                      <td className="py-2 text-right text-blue-600 font-semibold">{formatPct(t.ctr)}</td>
                      <td className="py-2 text-right text-indigo-600 font-bold">{formatNum(t.leads)}</td>
                      <td className="py-2 text-right text-gray-700">{t.leads > 0 ? formatCurrency(t.cpl) : "-"}</td>
                    </tr>
                  )
                })}
                <tr className="bg-gray-50 font-bold">
                  <td className="py-2 text-gray-900">Total</td>
                  <td className="py-2 text-right text-blue-700">{formatCurrency(totals.cost)}</td>
                  <td className="py-2 text-right text-gray-900">{formatNum(totals.impressions)}</td>
                  <td className="py-2 text-right text-gray-900">{formatNum(totals.clicks)}</td>
                  <td className="py-2 text-right text-blue-700">{formatPct(totals.ctr)}</td>
                  <td className="py-2 text-right text-indigo-700">{formatNum(metaLeadsTotal)}</td>
                  <td className="py-2 text-right text-gray-900">{metaLeadsTotal > 0 ? formatCurrency(totals.cost / metaLeadsTotal) : "-"}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Evolução no tempo (redes sociais) ── */}
      {chartHasData && (
        <div className="card-overlay rounded-xl shadow-lg p-4">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${BLUE}, ${BLUE_LIGHT})` }}>
                <TrendingUp className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">Evolução no Tempo · Redes Sociais</h3>
                <p className="text-[10px] text-gray-400">{chartMetricLabel[chartMetric]} por dia, por veículo (consolidado)</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {(["impressions", "clicks", "cost", "leads", "videoViews", "ctr", "vtr"] as const).map((m) => (
                <button key={m} onClick={() => setChartMetric(m)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all ${chartMetric === m ? "text-white shadow" : "bg-white text-gray-600 border border-gray-200 hover:border-blue-400"}`}
                  style={chartMetric === m ? { backgroundColor: BLUE } : {}}>
                  {chartMetricLabel[m]}
                </button>
              ))}
            </div>
          </div>
          <div style={{ height: 300 }}>
            <ResponsiveLine
              data={chartData}
              colors={chartColors}
              margin={{ top: 16, right: 24, bottom: 68, left: 60 }}
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

      {/* ── Criativos (Meta) ── */}
      {creatives.length > 0 && (
        <div className="card-overlay rounded-xl shadow-lg p-4">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${BLUE}, ${BLUE_LIGHT})` }}>
                <ImageIcon className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">Criativos · Redes Sociais</h3>
                <p className="text-[10px] text-gray-400">Performance por peça (Facebook + Instagram) · clique para detalhes</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {(["Todos", "Facebook", "Instagram"] as const).map((v) => (
                <button key={v} onClick={() => setCreativeVeiculo(v)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all ${creativeVeiculo === v ? "text-white shadow" : "bg-white text-gray-600 border border-gray-200 hover:border-blue-400"}`}
                  style={creativeVeiculo === v ? { backgroundColor: BLUE } : {}}>{v}</button>
              ))}
              <select value={creativeSort} onChange={(e) => setCreativeSort(e.target.value as any)}
                className="text-[11px] border border-gray-200 rounded-md px-2 py-1 text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="impressions">Ordenar: Impressões</option>
                <option value="leads">Ordenar: Leads</option>
                <option value="ctr">Ordenar: CTR</option>
                <option value="cost">Ordenar: Investimento</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            {creatives.slice(0, 12).map((c, i) => (
              <button key={i} type="button" onClick={() => { setSelectedCreative(c.image); setModalMetric("impressions") }}
                className="text-left border border-gray-100 rounded-lg p-2 hover:shadow-md hover:border-blue-300 transition-all cursor-pointer">
                <CreativeThumb src={c.image} alt={c.name} />
                <div className="mt-2 space-y-1">
                  <p className="text-[11px] font-bold text-gray-800 leading-tight line-clamp-2 min-h-[28px]" title={c.name}>{c.name.replace(/_/g, " ")}</p>
                  <div className="flex items-center gap-1 flex-wrap">
                    {c.veiculos.map((v) => (
                      <span key={v} className="text-[8px] px-1 py-0.5 rounded bg-blue-50 text-blue-600 font-medium">{v}</span>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] pt-1">
                    <span className="text-gray-400">Impr.</span><span className="text-right font-semibold text-gray-700">{formatCompact(c.impressions)}</span>
                    <span className="text-gray-400">CTR</span><span className="text-right font-semibold text-blue-600">{formatPct(c.ctr)}</span>
                    <span className="text-gray-400">Leads</span><span className="text-right font-semibold text-indigo-600">{formatNum(c.leads)}</span>
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
              <p className="text-[10px] text-gray-400">Sessões, engajamento, origem e regiões da Landing Page</p>
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
                <span className="text-[10px] text-gray-400">origem das sessões na Landing Page</span>
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

      {/* ── Leads (RD Station) ── */}
      <div className="card-overlay rounded-xl shadow-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${BLUE_DARK}, ${BLUE})` }}>
              <Users className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Leads · RD Station</h3>
              <p className="text-[10px] text-gray-400">Conversões da Landing Page</p>
            </div>
          </div>
          {lpLoading && (
            <span className="flex items-center gap-1 text-[10px]" style={{ color: BLUE }}>
              <RefreshCw className="w-3 h-3 animate-spin" /> atualizando…
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <p className="text-xl font-bold text-blue-700">{lpSummary ? formatNum(lpSummary.conversion_count) : "—"}</p>
            <p className="text-[10px] text-gray-500">Total de leads</p>
          </div>
          <div className="bg-indigo-50 rounded-lg p-3 text-center">
            <p className="text-xl font-bold text-indigo-700">{lpSummary && lpSummary.conversion_rate <= 100 ? `${lpSummary.conversion_rate.toFixed(1)}%` : "—"}</p>
            <p className="text-[10px] text-gray-500">Taxa de conversão</p>
          </div>
          <div className="bg-emerald-50 rounded-lg p-3 text-center">
            <p className="text-xl font-bold text-emerald-700">{funnel.cpl > 0 ? formatCurrency(funnel.cpl) : "—"}</p>
            <p className="text-[10px] text-gray-500">CPL</p>
          </div>
        </div>

        {/* Leads por dia (amostra RD) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold text-gray-700">Leads por dia</h4>
            <span className="text-[10px] text-gray-400">
              {rdLeadsLoading ? "carregando amostra…" : `amostra de ${formatNum(rdLeads.length)} leads recentes do RD`}
            </span>
          </div>
          {leadsByDay.length > 0 ? (
            <>
              <div className="flex items-end gap-1" style={{ height: 96 }}>
                {leadsByDay.map(([day, count]) => (
                  <div key={day} className="flex-1 rounded-t-sm transition-all cursor-default hover:opacity-80"
                    style={{ height: `${(count / maxLeadsDay) * 100}%`, minHeight: 3, background: `linear-gradient(to top, ${BLUE_DARK}, ${BLUE_LIGHT})` }}
                    title={`${shortBR(day)}: ${count} leads`} />
                ))}
              </div>
              <div className="flex gap-1 mt-1">
                {leadsByDay.map(([day], i) => {
                  const step = Math.ceil(leadsByDay.length / 12) || 1
                  return (
                    <div key={day} className="flex-1 text-center">
                      <span className="text-[8px] text-gray-400">{i % step === 0 ? shortBR(day) : ""}</span>
                    </div>
                  )
                })}
              </div>
            </>
          ) : (
            <p className="text-xs text-gray-400 py-4 text-center">{rdLeadsLoading ? "Carregando leads…" : "Sem leads no período."}</p>
          )}
          <p className="text-[10px] text-gray-400 italic mt-2 leading-snug">
            O RD não expõe leads agregados por dia nem a origem por lead — o gráfico usa a data de criação dos leads mais recentes; o total acima vem do resumo oficial da LP.
          </p>
        </div>

        {/* Leads de formulário Meta (complementar) */}
        {metaLeadsByPlatform.length > 0 && (
          <div className="pt-3 border-t border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold text-gray-700">Leads de formulário (Meta) · por veículo</h4>
              <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-1 rounded-full">{formatNum(metaLeadsTotal)} leads</span>
            </div>
            <div className="space-y-2">
              {metaLeadsByPlatform.map(([platform, count]) => (
                <RankBar key={platform} label={platform} value={count} max={metaLeadsByPlatform[0][1]} total={metaLeadsTotal} t={0.7} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── AdServer ── */}
      {allAdServer.length > 0 && (
        <div className="card-overlay rounded-xl shadow-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-900">Display · AdServer</h3>
            <div className="flex gap-3 text-xs text-gray-500">
              <span>{adServerTotals.inicio_campanha} → {adServerTotals.fim_campanha}</span>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3 mb-4">
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <p className="text-lg font-bold text-blue-700">{formatNum(adServerTotals.impressions)}</p>
              <p className="text-[10px] text-gray-500">Impressões</p>
            </div>
            <div className="bg-cyan-50 rounded-lg p-3 text-center">
              <p className="text-lg font-bold text-cyan-700">{formatNum(adServerTotals.clicks)}</p>
              <p className="text-[10px] text-gray-500">Cliques</p>
            </div>
            <div className="bg-indigo-50 rounded-lg p-3 text-center">
              <p className="text-lg font-bold text-indigo-700">{adServerTotals.ctr.toFixed(2)}%</p>
              <p className="text-[10px] text-gray-500">CTR</p>
            </div>
            <div className="bg-emerald-50 rounded-lg p-3 text-center">
              <p className="text-lg font-bold text-emerald-700">{adServerTotals.va.toFixed(1)}%</p>
              <p className="text-[10px] text-gray-500">Viewability</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200">
                  {(["publisher", "contratado", "impressions", "pacingPct", "clicks", "ctr", "va"] as const).map((col) => {
                    const isActive = sortCol === col
                    const label: Record<string, string> = { publisher: "Veículo", impressions: "Entregue", pacingPct: "Pacing", contratado: "Contratado", clicks: "Cliques", ctr: "CTR", va: "Viewability" }
                    const isLeft = col === "publisher"
                    const isPacing = col === "pacingPct"
                    return (
                      <th key={col} onClick={() => toggleSort(col)}
                        className={`py-2 font-medium cursor-pointer select-none ${isLeft ? "text-left" : isPacing ? "pl-3" : "text-right"} ${isActive ? "text-blue-700" : "text-gray-500"}`}>
                        <div className={`flex items-center gap-1 ${isLeft ? "" : isPacing ? "" : "justify-end"}`}>
                          {label[col]}
                          <ArrowUpDown className={`w-3 h-3 shrink-0 ${isActive ? "text-blue-700" : "text-gray-300"}`} />
                        </div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {adServerSorted.map((p) => (
                  <tr key={p.rowKey} className={`border-b border-gray-50 hover:bg-gray-50 ${p.isSubrow ? "bg-gray-50/60" : ""}`}>
                    <td className="py-2 font-semibold text-gray-800">
                      {p.isSubrow ? <span className="pl-4 text-gray-400 font-normal">↳</span> : p.name}
                    </td>
                    <td className="py-2 text-right text-gray-500 whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        {p.tipo && (
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${p.tipo === "CPM" ? "bg-indigo-100 text-indigo-700" : p.tipo === "CPV" ? "bg-teal-100 text-teal-700" : p.tipo === "CPC" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>{p.tipo}</span>
                        )}
                        <span>
                          {(p.tipo === "CPM" || p.tipo === "CPV") && p.contrato ? formatNum(p.contrato.quantidade ?? 0)
                            : p.tipo === "CPC" && p.contrato ? `${formatNum(p.contrato.quantidade ?? 0)} cliques`
                            : p.tipo === "DIARIA" && p.contrato ? `${p.diasValidos} / ${p.metaDias} dias` : "—"}
                        </span>
                      </div>
                    </td>
                    <td className="py-2 text-right text-blue-700 font-semibold">
                      {!p.isSubrow ? (p.contrato?.tipo === "CPC" ? formatNum(p.clicks) : formatNum(p.impressions))
                        : p.contrato?.tipo === "CPC" ? formatNum(p.clicks) : p.contrato?.tipo === "CPV" ? formatNum(p.vieweables) : ""}
                    </td>
                    <td className="py-2 pl-3 w-36">
                      {p.contrato ? (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${p.pacingPct}%`, backgroundColor: pacingColor(p.pacingPct) }} />
                          </div>
                          <span className="text-[10px] text-gray-500 w-8 text-right">{p.pacingPct.toFixed(0)}%</span>
                        </div>
                      ) : <span className="text-[10px] text-gray-400">s/ contrato</span>}
                    </td>
                    <td className="py-2 text-right text-gray-700">{!p.isSubrow ? formatNum(p.clicks) : ""}</td>
                    <td className="py-2 text-right text-indigo-600 font-semibold">{!p.isSubrow ? `${p.ctr.toFixed(2)}%` : ""}</td>
                    <td className="py-2 text-right text-blue-600">{!p.isSubrow ? `${p.va.toFixed(1)}%` : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Veiculação Off-line ── */}
      {offlineRaw.length > 1 && (
        <div className="card-overlay rounded-xl shadow-lg p-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-purple-600">
              <Radio className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Veiculação Off-line</h3>
              <p className="text-[10px] text-gray-400">Inserções e investimento em mídias tradicionais</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-green-700">{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(offlineData.totalInvestimento)}</p>
              <p className="text-xs text-gray-500 mt-0.5">Investimento</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-blue-700">{new Intl.NumberFormat("pt-BR").format(offlineData.totalInsercoes)}</p>
              <p className="text-xs text-gray-500 mt-0.5">Inserções</p>
            </div>
          </div>
          <div className="space-y-2">
            {Object.entries(offlineData.meios).map(([meioNome, meio]: [string, any]) => (
              <div key={meioNome} className="border-2 border-gray-200 rounded-lg overflow-hidden">
                <div className="flex items-center justify-between p-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => setExpandedMeios((prev) => ({ ...prev, [meioNome]: !prev[meioNome] }))}>
                  <div className="flex items-center gap-2">
                    {expandedMeios[meioNome] ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
                    <span className="text-sm font-semibold text-gray-900">{meioNome}</span>
                    <span className="text-xs text-gray-400 bg-gray-200 px-2 py-0.5 rounded-full">{Object.keys(meio.veiculos).length} veículos</span>
                  </div>
                  <div className="flex gap-4 text-xs text-right">
                    <div><p className="text-gray-400">Inserções</p><p className="font-semibold text-gray-700">{new Intl.NumberFormat("pt-BR").format(meio.insercoes)}</p></div>
                    <div><p className="text-gray-400">Investimento</p><p className="font-semibold text-gray-700">{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(meio.investimento)}</p></div>
                  </div>
                </div>
                {expandedMeios[meioNome] && (
                  <div className="p-3 space-y-1.5 bg-white">
                    {Object.entries(meio.veiculos).map(([veiculoNome, veiculo]: [string, any]) => {
                      const veiculoKey = `${meioNome}__${veiculoNome}`
                      return (
                        <div key={veiculoNome} className="border border-gray-100 rounded-md">
                          <div className="flex items-center justify-between p-2 hover:bg-gray-50 cursor-pointer transition-colors"
                            onClick={() => setExpandedPracas((prev) => ({ ...prev, [veiculoKey]: !prev[veiculoKey] }))}>
                            <div className="flex items-center gap-1.5">
                              {expandedPracas[veiculoKey] ? <ChevronDown className="w-3 h-3 text-gray-400" /> : <ChevronRight className="w-3 h-3 text-gray-400" />}
                              <span className="text-xs font-medium text-gray-800">{veiculoNome}</span>
                              <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">{Object.keys(veiculo.pracas).length} praças</span>
                            </div>
                            <div className="flex gap-3 text-[10px] text-right">
                              <div><span className="text-gray-400">Inserções: </span><span className="font-medium text-gray-700">{new Intl.NumberFormat("pt-BR").format(veiculo.insercoes)}</span></div>
                              <div><span className="text-gray-400">Invest.: </span><span className="font-medium text-gray-700">{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(veiculo.investimento)}</span></div>
                            </div>
                          </div>
                          {expandedPracas[veiculoKey] && (
                            <div className="px-3 pb-2">
                              <table className="w-full text-[10px]">
                                <thead>
                                  <tr className="border-b border-gray-100">
                                    <th className="text-left py-1 text-gray-500 font-medium">Praça</th>
                                    <th className="text-right py-1 text-gray-500 font-medium">Inserções</th>
                                    <th className="text-right py-1 text-gray-500 font-medium">Investimento</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {Object.entries(veiculo.pracas).map(([pracaNome, p]: [string, any]) => (
                                    <tr key={pracaNome} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                                      <td className="py-1 text-gray-700">{pracaNome}</td>
                                      <td className="py-1 text-right text-blue-600 font-semibold">{new Intl.NumberFormat("pt-BR").format(p.insercoes)}</td>
                                      <td className="py-1 text-right text-green-700 font-semibold">{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(p.investimento)}</td>
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
                )}
              </div>
            ))}
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
                  <p className="text-[11px] text-gray-400 truncate">{activeCreative.campanhas.join(" · ") || activeCreative.placements.join(" · ") || "Criativo"}</p>
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
                <CreativeThumb src={activeCreative.image} alt={activeCreative.name} />
                <div className="mt-2 flex flex-wrap gap-1">
                  {activeCreative.veiculos.map((v) => (
                    <span key={v} className="text-[9px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-medium">{v}</span>
                  ))}
                </div>
                {activeCreative.placements.length > 0 && (
                  <div className="mt-2">
                    <p className="text-[10px] text-gray-400 mb-1">Formatos / posições</p>
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
                      <p className="text-base font-bold text-violet-700">{formatNum(activeCreative.leads)}</p>
                      <p className="text-[9px] text-gray-500">Leads</p>
                    </div>
                    <div className="bg-emerald-50 rounded-lg p-2 text-center">
                      <p className="text-base font-bold text-emerald-700">{formatCurrency(activeCreative.cost)}</p>
                      <p className="text-[9px] text-gray-500">Investimento</p>
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
                      {(["impressions", "clicks", "leads", "cost"] as const).map((m) => (
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

export default CusteioAgricola

"use client"

import type React from "react"
import { useRef, useState, useEffect, useMemo, useCallback } from "react"
import {
  DollarSign, Eye, MousePointerClick, Globe2, Target, TrendingUp, Sparkles, RefreshCw,
  Calendar, X, ArrowRight, MapPin, Activity, MonitorPlay, Radio, ChevronRight, ChevronDown,
  Users, Play, Image as ImageIcon,
} from "lucide-react"
import axios from "axios"
import { ResponsiveLine } from "@nivo/line"
import Loading from "../../components/Loading/Loading"
import PDFDownloadButton from "../../components/PDFDownloadButton/PDFDownloadButton"
import BrazilMap from "../../components/BrazilMap/BrazilMap"
import { analyzeCapitalGiroEtapa2 } from "../../services/gemini"
import { getCachedAnalysis, setCachedAnalysis } from "../../services/analysisCache"
import { parseGA4Int, parseGA4Rate, prettySource, normalizeRegionToPT, ufSigla } from "./custeioGa4"
import { ADSERVER_CAMPAIGNS, buildAdServerUrl, type AdCampaign, type AdCategoria } from "./adserverGraphql"

// ─── Constantes ─────────────────────────────────────────────────────────────
const SHEET = "1ZxEMl8wed6ChnUJA08Xwy7eqZUCPsHxJT5483lZ-NDs"
const SHEET_BASE = `https://nmbcoamazonia-api.vercel.app/google/sheets/${SHEET}/data`

// Paleta Cálix (roxo/indigo)
const PURPLE = "#7c3aed"
const PURPLE_LIGHT = "#a855f7"

// Cores distintas por veículo (gráfico de evolução)
const LINE_PALETTE = ["#7c3aed", "#2563eb", "#0891b2", "#059669", "#d97706", "#dc2626", "#db2777", "#4f46e5", "#0d9488", "#65a30d", "#9333ea", "#e11d48"]
const colorForVeiculo = (_v: string, i: number) => LINE_PALETTE[i % LINE_PALETTE.length]

// ─── Helpers ──────────────────────────────────────────────────────────────────
const parseCur = (v: unknown): number => {
  if (v === null || v === undefined || v === "" || v === "-") return 0
  if (typeof v === "number") return v
  const s = String(v).replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".")
  return parseFloat(s) || 0
}

// DD/MM/YYYY (planilha e GraphQL) ou ISO → "YYYY-MM-DD"
const toISODate = (d: string): string => {
  if (!d) return ""
  if (d.includes("/")) {
    const [dd, mm, yy] = d.split("/")
    if (!dd || !mm || !yy) return ""
    return `${yy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`
  }
  return d.slice(0, 10)
}

const formatCurrency = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)
const formatNum = (v: number) => new Intl.NumberFormat("pt-BR").format(Math.round(v))
const formatCompact = (v: number) => new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(v)
const formatPct = (v: number) => `${(v * 100).toFixed(2)}%`
const formatDuration = (sec: number) => {
  if (!sec || sec < 0) return "0s"
  const m = Math.floor(sec / 60), s = Math.round(sec % 60)
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}
const shortBR = (iso: string) => { const [, m, d] = iso.split("-"); return d && m ? `${d}/${m}` : iso }

// Audience Network é entrega da própria Meta → tratamos como Facebook (agrega junto).
const normVeiculo = (v: string) => (/audience\s*network/i.test(v) ? "Facebook" : v)

// Pacing: amarelo (0%) → roxo escuro (100%)
const pacingColor = (pct: number): string => {
  const t = Math.min(pct, 100) / 100
  return `rgb(${Math.round(234 + (88 - 234) * t)},${Math.round(179 + (28 - 179) * t)},${Math.round(8 + (135 - 8) * t)})`
}
// Rampa roxa sequencial (barras de magnitude)
const purpleRamp = (t: number): string => {
  const c = Math.max(0, Math.min(1, t))
  const lerp = (a: number, b: number) => Math.round(a + (b - a) * c)
  return `rgb(${lerp(0xe9, 0x6d)},${lerp(0xd5, 0x28)},${lerp(0xff, 0xd9)})` // #e9d5ff → #6d28d9
}

// ─── Componentes auxiliares ───────────────────────────────────────────────────
interface FunnelStepProps { label: string; value: string; sub?: string; icon: React.ReactNode; tooltip?: string }
const FunnelStep: React.FC<FunnelStepProps> = ({ label, value, sub, icon, tooltip }) => (
  <div className="flex-1 min-w-[140px] relative group">
    <div className="rounded-xl p-3.5 h-full flex flex-col gap-1.5 border border-white/40 shadow-sm"
      style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.96), rgba(245,243,255,0.96))" }}>
      <div className="flex items-center gap-1.5">
        <div className="w-6 h-6 rounded-md flex items-center justify-center text-white shrink-0" style={{ background: `linear-gradient(135deg, ${PURPLE}, ${PURPLE_LIGHT})` }}>{icon}</div>
        <p className="text-[11px] text-gray-500 font-semibold uppercase tracking-wide leading-tight">{label}</p>
      </div>
      <p className="text-2xl font-bold text-gray-900 leading-none">{value}</p>
      {sub && <p className="text-[11px] text-gray-400 leading-tight">{sub}</p>}
    </div>
    {tooltip && (
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 bg-gray-900 text-white text-[10px] rounded-lg px-2.5 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 leading-relaxed">{tooltip}</div>
    )}
  </div>
)

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
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(w, 2)}%`, backgroundColor: purpleRamp(t) }} />
        </div>
      </div>
    )
  }

// Miniatura de criativo com fallback "Sem imagem" (URL ausente ou hotlink fbcdn bloqueado)
const CreativeThumb: React.FC<{ src: string; alt: string }> = ({ src, alt }) => {
  const [err, setErr] = useState(false)
  if (!src || err) {
    return (
      <div className="w-full aspect-square rounded-lg bg-gradient-to-br from-purple-50 to-indigo-100 flex flex-col items-center justify-center gap-1">
        <ImageIcon className="w-7 h-7 text-purple-300" />
        <span className="text-[10px] text-purple-400 font-medium">Sem imagem</span>
      </div>
    )
  }
  return <img src={src} alt={alt} loading="lazy" onError={() => setErr(true)} className="w-full aspect-square rounded-lg object-cover bg-gray-100" />
}

// ─── Consolidado (redes sociais) ───────────────────────────────────────────────
interface ConsolidadoRow {
  date: string; adSetName: string; adName: string; cost: number; impressions: number; clicks: number
  videoViews: number; videoCompletions: number; leads: number; veiculo: string; image: string; campanha: string
}

// ─── Página principal ─────────────────────────────────────────────────────────
const CapitalDeGiroEtapa2: React.FC = () => {
  const contentRef = useRef<HTMLDivElement>(null)
  const [adCampaigns, setAdCampaigns] = useState<{ campaign: AdCampaign; categoria: AdCategoria }[]>([])
  const [planoRaw, setPlanoRaw] = useState<string[][]>([])
  const [ga4, setGa4] = useState<{ date: string; newUsers: number; sessions: number; engagement: number; source: string; bounce: number }[]>([])
  const [ga4Region, setGa4Region] = useState<{ date: string; region: string; sessions: number; city: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: "", end: "" })
  // Evolução no tempo (Display + Redes): métrica + filtro por veículo
  type EvoMetric = "impressions" | "clicks" | "ctr" | "viewability" | "leads" | "cost" | "videoViews"
  const [chartMetric, setChartMetric] = useState<EvoMetric>("impressions")
  const [evoVeiculo, setEvoVeiculo] = useState<string>("") // "" = todos os veículos
  const [consolidado, setConsolidado] = useState<ConsolidadoRow[]>([])
  const [creativeSort, setCreativeSort] = useState<"impressions" | "leads" | "ctr" | "cost">("impressions")
  const [creativeVeiculo, setCreativeVeiculo] = useState<string>("Todos")
  const [selectedCreative, setSelectedCreative] = useState<string | null>(null)
  const [modalMetric, setModalMetric] = useState<"impressions" | "clicks" | "leads" | "cost">("impressions")
  const [expandedMeios, setExpandedMeios] = useState<Record<string, boolean>>({})
  const [expandedVeics, setExpandedVeics] = useState<Record<string, boolean>>({})
  const [aiAnalysis, setAiAnalysis] = useState<string>("")
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  // ─── Fetch (AdServer x2 + Plano de Mídia + GA4 x2) ───────────────────────────
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const [ad1, ad2, planoRes, ga4Res, ga4RgRes, consRes] = await Promise.all([
          axios.get(buildAdServerUrl(ADSERVER_CAMPAIGNS[0].filterB64)).catch(() => ({ data: { campaigns: null } })),
          axios.get(buildAdServerUrl(ADSERVER_CAMPAIGNS[1].filterB64)).catch(() => ({ data: { campaigns: null } })),
          axios.get(`${SHEET_BASE}?range=Plano%20de%20Midia`).catch(() => ({ data: { success: false } })),
          axios.get(`${SHEET_BASE}?range=GA4`).catch(() => ({ data: { success: false } })),
          axios.get(`${SHEET_BASE}?range=GA4%20-%20Region`).catch(() => ({ data: { success: false } })),
          axios.get(`${SHEET_BASE}?range=consolidado`).catch(() => ({ data: { success: false } })),
        ])

        // A query nova retorna `campaigns` (array); pegamos a 1ª (filtramos por 1 campaign_id).
        const camps: { campaign: AdCampaign; categoria: AdCategoria }[] = []
        const c1 = ad1.data?.campaigns?.[0]
        const c2 = ad2.data?.campaigns?.[0]
        if (c1) camps.push({ campaign: c1, categoria: ADSERVER_CAMPAIGNS[0].categoria })
        if (c2) camps.push({ campaign: c2, categoria: ADSERVER_CAMPAIGNS[1].categoria })
        setAdCampaigns(camps)

        if (planoRes.data?.success && planoRes.data?.data?.values) setPlanoRaw(planoRes.data.data.values)

        if (ga4Res.data?.success && ga4Res.data?.data?.values) {
          const rows: string[][] = ga4Res.data.data.values
          const h = rows[0]
          const gi = (c: string) => h.indexOf(c)
          const iNew = gi("New users"), iSess = gi("Sessions"), iEng = gi("User engagement"), iSrc = gi("Session source"), iBounce = gi("Bounce rate")
          setGa4(rows.slice(1).map((r) => ({
            date: (r[0] || "").slice(0, 10),
            newUsers: parseGA4Int(r[iNew]), sessions: parseGA4Int(r[iSess]), engagement: parseGA4Int(r[iEng]),
            source: r[iSrc] || "", bounce: parseGA4Rate(r[iBounce]),
          })))
        }
        if (ga4RgRes.data?.success && ga4RgRes.data?.data?.values) {
          const rows: string[][] = ga4RgRes.data.data.values
          const h = rows[0]
          const iRg = h.indexOf("Region"), iSs = h.indexOf("Sessions"), iCity = h.indexOf("City")
          setGa4Region(rows.slice(1).map((r) => ({
            date: (r[0] || "").slice(0, 10), region: r[iRg] || "", sessions: parseGA4Int(r[iSs]), city: iCity >= 0 ? (r[iCity] || "") : "",
          })))
        }

        // Consolidado — redes sociais (só linhas da Etapa 2)
        if (consRes.data?.success && consRes.data?.data?.values) {
          const rows: any[][] = consRes.data.data.values
          const h = rows[0]
          const idx = (c: string) => h.indexOf(c)
          const iVeic = idx("Veículo") >= 0 ? idx("Veículo") : 14
          const iCamp = idx("Campanha")
          const parsed: ConsolidadoRow[] = rows.slice(1)
            .filter((r) => (r[iCamp] || "").toLowerCase().includes("etapa 2"))
            .map((r) => ({
              date: r[idx("Date")] || "",
              adSetName: r[idx("Ad Set Name")] || "",
              adName: r[idx("Ad Name")] || "",
              cost: parseCur(r[idx("Cost")] ?? "0"),
              impressions: parseCur(r[idx("Impressions")] || "0"),
              clicks: parseCur(r[idx("Clicks")] || "0"),
              videoViews: parseCur(r[idx("Video views")] || "0"),
              videoCompletions: parseCur(r[idx("Video completions")] || "0"),
              leads: parseCur(r[idx("Leads")] || "0"),
              veiculo: normVeiculo(r[iVeic] || ""),
              image: r[idx("Image")] || "",
              campanha: r[iCamp] || "",
            }))
          setConsolidado(parsed)
        }
      } catch (err) {
        console.error("Erro ao buscar dados Capital de Giro Etapa 2:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  // ─── Filtro de período ───────────────────────────────────────────────────────
  const inDateRange = useCallback((rawDate: string): boolean => {
    if (!dateRange.start && !dateRange.end) return true
    const iso = toISODate(rawDate)
    if (!iso) return false
    if (dateRange.start && iso < dateRange.start) return false
    if (dateRange.end && iso > dateRange.end) return false
    return true
  }, [dateRange])

  // ─── AdServer: achatar sites (veículos) + entrega por dia ────────────────────
  const adSites = useMemo(() => {
    type SiteAgg = { site: string; categoria: AdCategoria; contratado: number; impressions: number; clicks: number; viewables: number; byDay: Map<string, { impressions: number; clicks: number; viewables: number }> }
    const map = new Map<string, SiteAgg>()
    adCampaigns.forEach(({ campaign, categoria }) => {
      (campaign.sites || []).forEach((s) => {
        const cur = map.get(s.site_name) ?? { site: s.site_name, categoria, contratado: 0, impressions: 0, clicks: 0, viewables: 0, byDay: new Map() }
        ;(s.channels || []).forEach((ch) => {
          cur.contratado += ch.channel_purchased_quantity || 0
          ;(ch.placements || []).forEach((p) => {
            (p.creatives || []).forEach((cr) => {
              (cr.data_by_date || []).forEach((x) => {
                const iso = toISODate((x._id || { datetime: "" }).datetime || "")
                if (!iso || !inDateRange(iso)) return
                const imp = x.impressions || 0, clk = x.clicks || 0, vw = x.viewables || 0
                cur.impressions += imp; cur.clicks += clk; cur.viewables += vw
                const day = cur.byDay.get(iso) ?? { impressions: 0, clicks: 0, viewables: 0 }
                day.impressions += imp; day.clicks += clk; day.viewables += vw
                cur.byDay.set(iso, day)
              })
            })
          })
        })
        map.set(s.site_name, cur)
      })
    })
    return Array.from(map.values())
      .map((s) => ({
        ...s,
        ctr: s.impressions > 0 ? s.clicks / s.impressions : 0,
        viewability: s.impressions > 0 ? s.viewables / s.impressions : 0,
        pacingPct: s.contratado > 0 ? Math.min((s.impressions / s.contratado) * 100, 100) : 0,
      }))
      .sort((a, b) => b.impressions - a.impressions)
  }, [adCampaigns, inDateRange])

  const adTotals = useMemo(() => {
    const t = adSites.reduce((acc, s) => ({
      impressions: acc.impressions + s.impressions, clicks: acc.clicks + s.clicks,
      viewables: acc.viewables + s.viewables, contratado: acc.contratado + s.contratado,
    }), { impressions: 0, clicks: 0, viewables: 0, contratado: 0 })
    return {
      ...t,
      ctr: t.impressions > 0 ? t.clicks / t.impressions : 0,
      viewability: t.impressions > 0 ? t.viewables / t.impressions : 0,
      pacingPct: t.contratado > 0 ? Math.min((t.impressions / t.contratado) * 100, 100) : 0,
    }
  }, [adSites])

  // Datas da campanha (para o hero)
  const adPeriodo = useMemo(() => {
    const c = adCampaigns[0]?.campaign
    return c ? `${c.campaign_start_datetime} → ${c.campaign_end_datetime}` : ""
  }, [adCampaigns])

  // ─── GA4 ─────────────────────────────────────────────────────────────────────
  const ga4PorData = useMemo(() => ga4.filter((r) => inDateRange(r.date)), [ga4, inDateRange])
  const ga4RegionPorData = useMemo(() => ga4Region.filter((r) => inDateRange(r.date)), [ga4Region, inDateRange])

  const ga4Totals = useMemo(() => {
    const t = ga4PorData.reduce((acc, r) => ({
      sessions: acc.sessions + r.sessions, newUsers: acc.newUsers + r.newUsers,
      engagement: acc.engagement + r.engagement, bounceW: acc.bounceW + r.bounce * r.sessions,
    }), { sessions: 0, newUsers: 0, engagement: 0, bounceW: 0 })
    return {
      sessions: t.sessions, newUsers: t.newUsers,
      avgEngagement: t.sessions > 0 ? t.engagement / t.sessions : 0,
      bounceRate: t.sessions > 0 ? t.bounceW / t.sessions : 0,
    }
  }, [ga4PorData])

  const sessionsByDay = useMemo(() => {
    const map = new Map<string, number>()
    ga4PorData.forEach((r) => { if (r.date) map.set(r.date, (map.get(r.date) || 0) + r.sessions) })
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [ga4PorData])
  const sessionsLineData = useMemo(() => [{ id: "Sessões", color: PURPLE, data: sessionsByDay.map(([d, v]) => ({ x: shortBR(d), y: v })) }], [sessionsByDay])
  const sessionsTicks = useMemo(() => {
    const xs = sessionsByDay.map(([d]) => shortBR(d))
    const step = Math.ceil(xs.length / 8) || 1
    return xs.filter((_, i) => i % step === 0)
  }, [sessionsByDay])

  const channelStats = useMemo(() => {
    const map = new Map<string, { sessions: number; newUsers: number; engagement: number; bounceW: number }>()
    ga4PorData.forEach((r) => {
      const name = prettySource(r.source)
      const cur = map.get(name) ?? { sessions: 0, newUsers: 0, engagement: 0, bounceW: 0 }
      cur.sessions += r.sessions; cur.newUsers += r.newUsers; cur.engagement += r.engagement; cur.bounceW += r.bounce * r.sessions
      map.set(name, cur)
    })
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, sessions: v.sessions, newUsers: v.newUsers, avgEngagement: v.sessions > 0 ? v.engagement / v.sessions : 0, bounceRate: v.sessions > 0 ? v.bounceW / v.sessions : 0 }))
      .sort((a, b) => b.sessions - a.sessions)
  }, [ga4PorData])
  const channelMax = useMemo(() => Math.max(...channelStats.map((c) => c.sessions), 1), [channelStats])

  const sessionsByRegion = useMemo(() => {
    const map = new Map<string, number>()
    ga4RegionPorData.forEach((r) => { const pt = normalizeRegionToPT(r.region); if (pt) map.set(pt, (map.get(pt) || 0) + r.sessions) })
    return map
  }, [ga4RegionPorData])
  const regionData = useMemo(() => Object.fromEntries(sessionsByRegion), [sessionsByRegion])
  const regionRanking = useMemo(() => Array.from(sessionsByRegion.entries()).map(([name, sessions]) => ({ name, sessions })).sort((a, b) => b.sessions - a.sessions), [sessionsByRegion])
  const regionMax = useMemo(() => Math.max(...regionRanking.map((r) => r.sessions), 1), [regionRanking])
  const regionTotal = useMemo(() => regionRanking.reduce((a, r) => a + r.sessions, 0), [regionRanking])
  const getRegionColor = useCallback((s: number) => (s <= 0 ? "#e5e7eb" : purpleRamp(regionMax > 0 ? s / regionMax : 0)), [regionMax])

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

  const hasGa4 = ga4Totals.sessions > 0

  // ─── Redes Sociais (consolidado) ─────────────────────────────────────────────
  const consolidadoPorData = useMemo(() => consolidado.filter((r) => inDateRange(r.date)), [consolidado, inDateRange])

  const redesTotals = useMemo(() => {
    const t = consolidadoPorData.reduce((acc, r) => ({
      cost: acc.cost + r.cost, impressions: acc.impressions + r.impressions, clicks: acc.clicks + r.clicks,
      videoViews: acc.videoViews + r.videoViews, videoCompletions: acc.videoCompletions + r.videoCompletions, leads: acc.leads + r.leads,
    }), { cost: 0, impressions: 0, clicks: 0, videoViews: 0, videoCompletions: 0, leads: 0 })
    return {
      ...t,
      ctr: t.impressions > 0 ? t.clicks / t.impressions : 0,
      cpl: t.leads > 0 ? t.cost / t.leads : 0,
      vtr: t.videoViews > 0 ? t.videoCompletions / t.videoViews : 0,
    }
  }, [consolidadoPorData])
  const hasRedes = consolidadoPorData.length > 0

  const redesVeiculos = useMemo(() => Array.from(new Set(consolidadoPorData.map((r) => r.veiculo).filter(Boolean))), [consolidadoPorData])
  const byVeiculo = useMemo(() => {
    const map = new Map<string, { cost: number; impressions: number; clicks: number; leads: number; ctr: number; cpl: number }>()
    redesVeiculos.forEach((v) => {
      const rows = consolidadoPorData.filter((r) => r.veiculo === v)
      const t = rows.reduce((acc, r) => ({ cost: acc.cost + r.cost, impressions: acc.impressions + r.impressions, clicks: acc.clicks + r.clicks, leads: acc.leads + r.leads }), { cost: 0, impressions: 0, clicks: 0, leads: 0 })
      map.set(v, { ...t, ctr: t.impressions > 0 ? t.clicks / t.impressions : 0, cpl: t.leads > 0 ? t.cost / t.leads : 0 })
    })
    return map
  }, [consolidadoPorData, redesVeiculos])

  // Criativos (Meta) — agrupa por URL de imagem; nome = Ad Name (distintivo)
  const creatives = useMemo(() => {
    type Agg = { image: string; name: string; veiculos: Set<string>; impressions: number; clicks: number; cost: number; leads: number; videoViews: number; videoCompletions: number }
    const map = new Map<string, Agg>()
    consolidadoPorData.forEach((r) => {
      if (!r.image) return
      if (creativeVeiculo !== "Todos" && r.veiculo !== creativeVeiculo) return
      const cur = map.get(r.image) ?? { image: r.image, name: "", veiculos: new Set<string>(), impressions: 0, clicks: 0, cost: 0, leads: 0, videoViews: 0, videoCompletions: 0 }
      cur.impressions += r.impressions; cur.clicks += r.clicks; cur.cost += r.cost; cur.leads += r.leads
      cur.videoViews += r.videoViews; cur.videoCompletions += r.videoCompletions
      if (r.veiculo) cur.veiculos.add(r.veiculo)
      if (!cur.name && (r.adName || r.adSetName)) cur.name = r.adName || r.adSetName
      map.set(r.image, cur)
    })
    const arr = Array.from(map.values()).map((c) => ({
      image: c.image, name: c.name || "Criativo", veiculos: Array.from(c.veiculos),
      impressions: c.impressions, clicks: c.clicks, cost: c.cost, leads: c.leads, videoViews: c.videoViews, videoCompletions: c.videoCompletions,
      ctr: c.impressions > 0 ? c.clicks / c.impressions : 0, vtr: c.videoViews > 0 ? c.videoCompletions / c.videoViews : 0,
    }))
    arr.sort((a, b) => {
      if (creativeSort === "ctr") return b.ctr - a.ctr
      if (creativeSort === "leads") return b.leads - a.leads
      if (creativeSort === "cost") return b.cost - a.cost
      return b.impressions - a.impressions
    })
    return arr
  }, [consolidadoPorData, creativeSort, creativeVeiculo])

  const activeCreative = useMemo(() => (selectedCreative ? creatives.find((c) => c.image === selectedCreative) ?? null : null), [selectedCreative, creatives])
  const creativeDaily = useMemo(() => {
    if (!selectedCreative) return [] as { iso: string; impressions: number; clicks: number; leads: number; cost: number }[]
    const map = new Map<string, { impressions: number; clicks: number; leads: number; cost: number }>()
    consolidadoPorData.forEach((r) => {
      if (r.image !== selectedCreative) return
      const iso = toISODate(r.date); if (!iso) return
      const cur = map.get(iso) ?? { impressions: 0, clicks: 0, leads: 0, cost: 0 }
      cur.impressions += r.impressions; cur.clicks += r.clicks; cur.leads += r.leads; cur.cost += r.cost
      map.set(iso, cur)
    })
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([iso, v]) => ({ iso, ...v }))
  }, [selectedCreative, consolidadoPorData])
  const modalMetricLabel: Record<typeof modalMetric, string> = { impressions: "Impressões", clicks: "Cliques", leads: "Leads", cost: "Investimento" }
  const modalLineData = useMemo(() => [{ id: modalMetricLabel[modalMetric], color: PURPLE, data: creativeDaily.map((d) => ({ x: shortBR(d.iso), y: d[modalMetric] })) }], [creativeDaily, modalMetric]) // eslint-disable-line react-hooks/exhaustive-deps
  const modalTicks = useMemo(() => {
    const xs = creativeDaily.map((d) => shortBR(d.iso)); const step = Math.ceil(xs.length / 8) || 1
    return xs.filter((_, i) => i % step === 0)
  }, [creativeDaily])

  useEffect(() => {
    if (!selectedCreative) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setSelectedCreative(null) }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [selectedCreative])

  // ─── Evolução no tempo (Display + Redes, combinado) ──────────────────────────
  // Une veículos do Display (AdServer) e das Redes (consolidado) num só gráfico.
  // Métricas exclusivas de uma fonte ficam null na outra (a linha some p/ aquela métrica).
  type EvoSource = "display" | "redes"
  type EvoDay = { impressions: number; clicks: number; viewables: number; cost: number; leads: number; videoViews: number }
  const evoVeiculos = useMemo(() => {
    const blank = (): EvoDay => ({ impressions: 0, clicks: 0, viewables: 0, cost: 0, leads: 0, videoViews: 0 })
    const map = new Map<string, { veiculo: string; source: EvoSource; byDay: Map<string, EvoDay> }>()
    adSites.forEach((s) => {
      const e = map.get(s.site) ?? { veiculo: s.site, source: "display" as EvoSource, byDay: new Map<string, EvoDay>() }
      s.byDay.forEach((d, iso) => {
        const cur = e.byDay.get(iso) ?? blank()
        cur.impressions += d.impressions; cur.clicks += d.clicks; cur.viewables += d.viewables
        e.byDay.set(iso, cur)
      })
      map.set(s.site, e)
    })
    consolidadoPorData.forEach((r) => {
      const iso = toISODate(r.date); if (!iso || !r.veiculo) return
      const e = map.get(r.veiculo) ?? { veiculo: r.veiculo, source: "redes" as EvoSource, byDay: new Map<string, EvoDay>() }
      const cur = e.byDay.get(iso) ?? blank()
      cur.impressions += r.impressions; cur.clicks += r.clicks; cur.cost += r.cost; cur.leads += r.leads; cur.videoViews += r.videoViews
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
    impressions: "Impressões", clicks: "Cliques", ctr: "CTR", viewability: "Viewability",
    leads: "Leads", cost: "Investimento", videoViews: "Visualizações",
  }
  const chartIsPct = chartMetric === "ctr" || chartMetric === "viewability"
  const chartIsCurrency = chartMetric === "cost"

  const adChartData = useMemo(() => {
    const allDates = new Set<string>()
    evoVeiculos.forEach((e) => e.byDay.forEach((_v, iso) => allDates.add(iso)))
    const sortedDates = Array.from(allDates).sort((a, b) => a.localeCompare(b))
    const value = (d: EvoDay, source: EvoSource): number | null => {
      switch (chartMetric) {
        case "impressions": return d.impressions
        case "clicks": return d.clicks
        case "ctr": return d.impressions > 0 ? (d.clicks / d.impressions) * 100 : 0
        case "viewability": return source === "display" ? (d.impressions > 0 ? (d.viewables / d.impressions) * 100 : 0) : null
        case "leads": return source === "redes" ? d.leads : null
        case "cost": return source === "redes" ? d.cost : null
        case "videoViews": return source === "redes" ? d.videoViews : null
        default: return null
      }
    }
    const list = evoVeiculo ? evoVeiculos.filter((e) => e.veiculo === evoVeiculo) : evoVeiculos
    return list
      .map((e) => ({
        id: e.veiculo,
        color: evoColor.get(e.veiculo) || PURPLE,
        data: sortedDates.map((iso) => {
          const d = e.byDay.get(iso)
          const y = d ? value(d, e.source) : null
          return { x: iso, y: y === null ? null : Number(y.toFixed(chartIsPct || chartIsCurrency ? 2 : 0)) }
        }),
      }))
      .sort((a, b) => a.id.localeCompare(b.id))
  }, [evoVeiculos, evoVeiculo, evoColor, chartMetric, chartIsPct, chartIsCurrency])
  const adChartColors = useMemo(() => adChartData.map((s) => s.color), [adChartData])
  const adChartHasData = adChartData.some((s) => s.data.some((p) => p.y !== null))
  const adChartTicks = useMemo(() => {
    const set = new Set<string>()
    evoVeiculos.forEach((e) => e.byDay.forEach((_v, iso) => set.add(iso)))
    const xs = Array.from(set).sort((a, b) => a.localeCompare(b))
    const step = Math.ceil(xs.length / 8) || 1
    return xs.filter((_, i) => i % step === 0)
  }, [evoVeiculos])

  // ─── Plano de Mídia ──────────────────────────────────────────────────────────
  const planoData = useMemo(() => {
    if (planoRaw.length < 2) return { meios: {} as Record<string, any>, totalInvestimento: 0, totalExecucao: 0 }
    const h = planoRaw[0]
    const iMeio = h.indexOf("MEIO"), iVeic = h.indexOf("VEÍCULO"), iPraca = h.indexOf("PRAÇA")
    const iTipo = h.indexOf("TIPO DE COMPRA"), iContr = h.indexOf("TOTAL CONTRATADO"), iInv = h.indexOf("INVESTIMENTO"), iExec = h.indexOf("EXECUÇÃO PROJETO")
    type Row = { praca: string; tipo: string; contratado: string; investimento: number; execucao: number }
    type Veic = { rows: Row[]; investimento: number; execucao: number }
    type Meio = { veiculos: Record<string, Veic>; investimento: number; execucao: number }
    const meios: Record<string, Meio> = {}
    let totalInvestimento = 0, totalExecucao = 0
    planoRaw.slice(1).forEach((r) => {
      const meio = r[iMeio] || "", veic = r[iVeic] || ""
      if (!meio || !veic) return
      const inv = parseCur(r[iInv]), exec = parseCur(r[iExec])
      totalInvestimento += inv; totalExecucao += exec
      if (!meios[meio]) meios[meio] = { veiculos: {}, investimento: 0, execucao: 0 }
      meios[meio].investimento += inv; meios[meio].execucao += exec
      if (!meios[meio].veiculos[veic]) meios[meio].veiculos[veic] = { rows: [], investimento: 0, execucao: 0 }
      meios[meio].veiculos[veic].investimento += inv; meios[meio].veiculos[veic].execucao += exec
      meios[meio].veiculos[veic].rows.push({ praca: r[iPraca] || "-", tipo: r[iTipo] || "-", contratado: r[iContr] || "-", investimento: inv, execucao: exec })
    })
    return { meios, totalInvestimento, totalExecucao }
  }, [planoRaw])

  // ─── Funil ───────────────────────────────────────────────────────────────────
  const funnel = useMemo(() => {
    const investimento = planoData.totalInvestimento + planoData.totalExecucao
    const impressoes = adTotals.impressions + redesTotals.impressions
    const cliques = adTotals.clicks + redesTotals.clicks
    return {
      investimento, impressoes, cliques, visualizacoes: redesTotals.videoViews, sessoes: ga4Totals.sessions, leads: redesTotals.leads,
      ctr: impressoes > 0 ? cliques / impressoes : 0,
      pacing: adTotals.pacingPct, viewability: adTotals.viewability,
      vtr: redesTotals.vtr, cpl: redesTotals.leads > 0 ? redesTotals.cost / redesTotals.leads : 0,
    }
  }, [planoData, adTotals, ga4Totals, redesTotals])

  // ─── Análise IA ──────────────────────────────────────────────────────────────
  const DATA_KEY = "capital-de-giro-etapa-2"
  const buildAnalysisPayload = () => ({
    adServer: {
      impressions: adTotals.impressions, clicks: adTotals.clicks, ctr: adTotals.ctr,
      viewability: adTotals.viewability, contratado: adTotals.contratado, pacing: adTotals.pacingPct,
      topVeiculos: adSites.slice(0, 10).map((s) => ({ name: s.site, categoria: s.categoria, contratado: s.contratado, impressions: s.impressions, clicks: s.clicks, ctr: s.ctr, viewability: s.viewability, pacingPct: s.pacingPct })),
    },
    redes: hasRedes ? {
      cost: redesTotals.cost, impressions: redesTotals.impressions, clicks: redesTotals.clicks, ctr: redesTotals.ctr, leads: redesTotals.leads, cpl: redesTotals.cpl,
      byVeiculo: redesVeiculos.map((v) => { const t = byVeiculo.get(v)!; return { name: v, cost: t.cost, impressions: t.impressions, clicks: t.clicks, ctr: t.ctr, leads: t.leads, cpl: t.cpl } }),
    } : null,
    ga4: hasGa4 ? {
      sessions: ga4Totals.sessions, newUsers: ga4Totals.newUsers, avgEngagementSec: ga4Totals.avgEngagement, bounceRate: ga4Totals.bounceRate,
      topSources: channelStats.slice(0, 8).map((c) => ({ name: c.name, sessions: c.sessions })),
      topRegions: regionRanking.slice(0, 8), topCities: topCities.slice(0, 8),
    } : null,
    plano: { investimento: planoData.totalInvestimento, execucao: planoData.totalExecucao, total: funnel.investimento },
  })

  const runAiAnalysis = async (forceRefresh = false) => {
    setAiLoading(true); setAiError(null)
    try {
      if (!forceRefresh) {
        const cached = await getCachedAnalysis(DATA_KEY)
        if (cached) { setAiAnalysis(cached.analysis); setAiLoading(false); return }
      }
      const result = await analyzeCapitalGiroEtapa2(buildAnalysisPayload())
      setAiAnalysis(result)
      await setCachedAnalysis(DATA_KEY, result)
    } catch {
      setAiError("Não foi possível gerar a análise. Tente novamente.")
    } finally {
      setAiLoading(false)
    }
  }
  useEffect(() => {
    if (!loading && !aiAnalysis && !aiLoading && adSites.length > 0) runAiAnalysis()
  }, [loading]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <Loading message="Carregando dados da campanha..." />

  const sortedMeios = Object.entries(planoData.meios).sort((a: any, b: any) => (b[1].investimento + b[1].execucao) - (a[1].investimento + a[1].execucao))

  return (
    <div ref={contentRef} className="h-full flex flex-col space-y-3 overflow-auto">

      {/* ── Hero ── */}
      <div className="relative overflow-hidden rounded-2xl shadow-2xl h-36">
        <div className="relative h-full bg-gradient-to-r from-purple-700 via-purple-600 to-indigo-600">
          <img src="/images/fundo_card.webp" alt="Capital de Giro Etapa 2" className="w-full h-full object-cover mix-blend-overlay opacity-30" />
          <div className="absolute inset-0 bg-gradient-to-r from-purple-900/60 to-indigo-800/40" />
          <div className="absolute top-3 right-3 z-10">
            <PDFDownloadButton contentRef={contentRef} fileName="capital-de-giro-etapa-2" />
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-4 flex items-end justify-between">
            <div>
              <p className="text-purple-200 text-xs font-medium mb-1 uppercase tracking-wider">Campanhas · Cálix</p>
              <h1 className="text-2xl font-bold text-white">Capital de Giro <span className="text-purple-200 font-semibold">| Etapa 2</span></h1>
              <p className="text-purple-200 text-sm">{adPeriodo || "Consolidado de performance"}</p>
            </div>
            <div className="text-right flex gap-5">
              <div>
                <p className="text-purple-200 text-xs">Investimento</p>
                <p className="text-2xl font-bold text-white">{formatCompact(funnel.investimento)}</p>
              </div>
              <div>
                <p className="text-purple-200 text-xs">Impressões</p>
                <p className="text-2xl font-bold text-white">{formatCompact(funnel.impressoes)}</p>
              </div>
              <div>
                <p className="text-purple-200 text-xs">Sessões</p>
                <p className="text-2xl font-bold text-white">{hasGa4 ? formatCompact(funnel.sessoes) : "—"}</p>
              </div>
              <div>
                <p className="text-purple-200 text-xs">Leads</p>
                <p className="text-2xl font-bold text-white">{hasRedes ? formatNum(funnel.leads) : "—"}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Filtro de período ── */}
      <div className="card-overlay rounded-xl shadow-lg p-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-gray-700">
          <Calendar className="w-4 h-4 text-purple-600" />
          <span className="text-sm font-semibold">Período</span>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={dateRange.start} max={dateRange.end || undefined}
            onChange={(e) => setDateRange((p) => ({ ...p, start: e.target.value }))}
            className="px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm" />
          <span className="text-gray-500 text-sm">até</span>
          <input type="date" value={dateRange.end} min={dateRange.start || undefined}
            onChange={(e) => setDateRange((p) => ({ ...p, end: e.target.value }))}
            className="px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm" />
        </div>
        {(dateRange.start || dateRange.end) && (
          <button onClick={() => setDateRange({ start: "", end: "" })}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors">
            <X className="w-3.5 h-3.5" /> Limpar
          </button>
        )}
        <span className="text-[11px] text-gray-400 ml-auto">O período filtra os dados de entrega (Display, Redes Sociais e Site). O Plano de Mídia mostra sempre o planejamento completo da campanha.</span>
      </div>

      {/* ── Funil ── */}
      <div className="card-overlay rounded-xl shadow-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Target className="w-4 h-4 text-purple-600" />
          <h3 className="text-sm font-bold text-gray-900">Funil da Campanha</h3>
          <span className="text-[11px] text-gray-400">Da mídia ao site</span>
        </div>
        <div className="flex flex-wrap items-stretch gap-2">
          {[
            { el: <FunnelStep key="inv" label="Investimento" value={formatCurrency(funnel.investimento)} sub="Plano de mídia" icon={<DollarSign className="w-3.5 h-3.5" />} tooltip="Investimento planejado (Plano de Mídia): mídia + execução de projetos." /> },
            { el: <FunnelStep key="imp" label="Impressões" value={formatCompact(funnel.impressoes)} sub="Display + Redes" icon={<Eye className="w-3.5 h-3.5" />} tooltip="Impressões somando Display (AdServer) e Redes Sociais (Meta)." /> },
            { el: <FunnelStep key="vv" label="Visualizações" value={formatCompact(funnel.visualizacoes)} sub={funnel.visualizacoes > 0 ? `VTR ${formatPct(funnel.vtr)}` : "Redes"} icon={<Play className="w-3.5 h-3.5" />} tooltip="Vídeos iniciados nas Redes Sociais. VTR = conclusões ÷ inícios." /> },
            { el: <FunnelStep key="clk" label="Cliques" value={formatCompact(funnel.cliques)} sub={`CTR ${formatPct(funnel.ctr)}`} icon={<MousePointerClick className="w-3.5 h-3.5" />} tooltip="Cliques somando Display e Redes Sociais. CTR = cliques ÷ impressões." /> },
            { el: <FunnelStep key="ses" label="Sessões" value={hasGa4 ? formatCompact(funnel.sessoes) : "—"} sub={hasGa4 ? `${formatCompact(ga4Totals.newUsers)} novos` : "GA4"} icon={<Globe2 className="w-3.5 h-3.5" />} tooltip="Sessões na Landing Page medidas pelo Google Analytics 4 (GA4)." /> },
            { el: <FunnelStep key="lead" label="Leads" value={hasRedes ? formatNum(funnel.leads) : "—"} sub={funnel.cpl > 0 ? `CPL ${formatCurrency(funnel.cpl)}` : "Redes"} icon={<Users className="w-3.5 h-3.5" />} tooltip="Leads de formulário nas Redes Sociais (Meta). CPL = investimento em redes ÷ leads." /> },
          ].map((s, i, arr) => (
            <div key={i} className="flex items-stretch gap-2 flex-1 min-w-[140px]">
              {s.el}
              {i < arr.length - 1 && <div className="hidden lg:flex items-center"><ArrowRight className="w-4 h-4 text-gray-300" /></div>}
            </div>
          ))}
        </div>
      </div>

      {/* ── Performance por Veículo · Redes Sociais ── */}
      {hasRedes && (
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
                {redesVeiculos.map((v) => {
                  const t = byVeiculo.get(v)!
                  return (
                    <tr key={v} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 font-semibold text-gray-800">{v}</td>
                      <td className="py-2 text-right text-gray-700">{formatCurrency(t.cost)}</td>
                      <td className="py-2 text-right text-gray-700">{formatNum(t.impressions)}</td>
                      <td className="py-2 text-right text-gray-700">{formatNum(t.clicks)}</td>
                      <td className="py-2 text-right text-purple-600 font-semibold">{formatPct(t.ctr)}</td>
                      <td className="py-2 text-right text-indigo-600 font-bold">{formatNum(t.leads)}</td>
                      <td className="py-2 text-right text-gray-700">{t.leads > 0 ? formatCurrency(t.cpl) : "-"}</td>
                    </tr>
                  )
                })}
                <tr className="bg-gray-50 font-bold">
                  <td className="py-2 text-gray-900">Total</td>
                  <td className="py-2 text-right text-purple-700">{formatCurrency(redesTotals.cost)}</td>
                  <td className="py-2 text-right text-gray-900">{formatNum(redesTotals.impressions)}</td>
                  <td className="py-2 text-right text-gray-900">{formatNum(redesTotals.clicks)}</td>
                  <td className="py-2 text-right text-purple-700">{formatPct(redesTotals.ctr)}</td>
                  <td className="py-2 text-right text-indigo-700">{formatNum(redesTotals.leads)}</td>
                  <td className="py-2 text-right text-gray-900">{redesTotals.leads > 0 ? formatCurrency(redesTotals.cpl) : "-"}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Criativos · Redes Sociais ── */}
      {creatives.length > 0 && (
        <div className="card-overlay rounded-xl shadow-lg p-4">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-purple-500 to-indigo-600"><ImageIcon className="w-4 h-4 text-white" /></div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">Criativos · Redes Sociais</h3>
                <p className="text-[10px] text-gray-400">Performance por peça (Meta) · clique para detalhes</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {["Todos", ...redesVeiculos].map((v) => (
                <button key={v} onClick={() => setCreativeVeiculo(v)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all ${creativeVeiculo === v ? "bg-purple-600 text-white shadow" : "bg-white text-gray-600 border border-gray-200 hover:border-purple-400"}`}>{v}</button>
              ))}
              <select value={creativeSort} onChange={(e) => setCreativeSort(e.target.value as any)}
                className="text-[11px] border border-gray-200 rounded-md px-2 py-1 text-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500">
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
                className="text-left border border-gray-100 rounded-lg p-2 hover:shadow-md hover:border-purple-300 transition-all cursor-pointer">
                <CreativeThumb src={c.image} alt={c.name} />
                <div className="mt-2 space-y-1">
                  <p className="text-[11px] font-bold text-gray-800 leading-tight line-clamp-2 min-h-[28px]" title={c.name}>{c.name.replace(/_/g, " ")}</p>
                  <div className="flex items-center gap-1 flex-wrap">
                    {c.veiculos.map((v) => (<span key={v} className="text-[8px] px-1 py-0.5 rounded bg-purple-50 text-purple-600 font-medium">{v}</span>))}
                  </div>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] pt-1">
                    <span className="text-gray-400">Impr.</span><span className="text-right font-semibold text-gray-700">{formatCompact(c.impressions)}</span>
                    <span className="text-gray-400">CTR</span><span className="text-right font-semibold text-purple-600">{formatPct(c.ctr)}</span>
                    <span className="text-gray-400">Leads</span><span className="text-right font-semibold text-indigo-600">{formatNum(c.leads)}</span>
                    <span className="text-gray-400">Invest.</span><span className="text-right font-semibold text-gray-700">{formatCompact(c.cost)}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Display · AdServer ── */}
      {adSites.length > 0 && (
        <div className="card-overlay rounded-xl shadow-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-900">Display · AdServer</h3>
            <span className="text-xs text-gray-500">{adPeriodo}</span>
          </div>
          <div className="grid grid-cols-4 gap-3 mb-4">
            <div className="bg-purple-50 rounded-lg p-3 text-center"><p className="text-lg font-bold text-purple-700">{formatNum(adTotals.impressions)}</p><p className="text-[10px] text-gray-500">Impressões</p></div>
            <div className="bg-indigo-50 rounded-lg p-3 text-center"><p className="text-lg font-bold text-indigo-700">{formatNum(adTotals.clicks)}</p><p className="text-[10px] text-gray-500">Cliques</p></div>
            <div className="bg-fuchsia-50 rounded-lg p-3 text-center"><p className="text-lg font-bold text-fuchsia-700">{(adTotals.ctr * 100).toFixed(2)}%</p><p className="text-[10px] text-gray-500">CTR</p></div>
            <div className="bg-emerald-50 rounded-lg p-3 text-center"><p className="text-lg font-bold text-emerald-700">{(adTotals.viewability * 100).toFixed(1)}%</p><p className="text-[10px] text-gray-500">Viewability</p></div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 text-gray-500 font-medium">Veículo</th>
                  <th className="text-right py-2 text-gray-500 font-medium">Contratado</th>
                  <th className="text-right py-2 text-gray-500 font-medium">Entregue</th>
                  <th className="pl-3 py-2 text-gray-500 font-medium">Pacing</th>
                  <th className="text-right py-2 text-gray-500 font-medium">Cliques</th>
                  <th className="text-right py-2 text-gray-500 font-medium">CTR</th>
                  <th className="text-right py-2 text-gray-500 font-medium">Viewability</th>
                </tr>
              </thead>
              <tbody>
                {adSites.map((s) => (
                  <tr key={s.site} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2 font-semibold text-gray-800">
                      <div className="flex items-center gap-2">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold ${s.categoria === "nacional" ? "bg-indigo-100 text-indigo-700" : "bg-purple-100 text-purple-700"}`}>{s.categoria === "nacional" ? "NAC" : "REG"}</span>
                        <span className="truncate max-w-[220px]" title={s.site}>{s.site}</span>
                      </div>
                    </td>
                    <td className="py-2 text-right text-gray-500 whitespace-nowrap">{s.contratado > 0 ? formatNum(s.contratado) : "—"}</td>
                    <td className="py-2 text-right text-purple-700 font-semibold">{formatNum(s.impressions)}</td>
                    <td className="py-2 pl-3 w-36">
                      {s.contratado > 0 ? (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${s.pacingPct}%`, backgroundColor: pacingColor(s.pacingPct) }} />
                          </div>
                          <span className="text-[10px] text-gray-500 w-8 text-right">{s.pacingPct.toFixed(0)}%</span>
                        </div>
                      ) : <span className="text-[10px] text-gray-400">s/ meta</span>}
                    </td>
                    <td className="py-2 text-right text-gray-700">{formatNum(s.clicks)}</td>
                    <td className="py-2 text-right text-indigo-600 font-semibold">{(s.ctr * 100).toFixed(2)}%</td>
                    <td className="py-2 text-right text-purple-600">{(s.viewability * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Evolução no Tempo (Display + Redes) ── */}
      {adChartHasData && (
        <div className="card-overlay rounded-xl shadow-lg p-4">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${PURPLE}, ${PURPLE_LIGHT})` }}><TrendingUp className="w-4 h-4 text-white" /></div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">Evolução no Tempo</h3>
                <p className="text-[10px] text-gray-400">{chartMetricLabel[chartMetric]} por dia, por veículo (Display + Redes Sociais)</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <select value={evoVeiculo} onChange={(e) => setEvoVeiculo(e.target.value)}
                className="text-[11px] border border-gray-200 rounded-md px-2 py-1 text-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500 max-w-[200px] truncate"
                title={evoVeiculo || "Todos os veículos"}>
                <option value="">Todos os veículos ({evoVeiculoOptions.length})</option>
                {evoVeiculoOptions.map((v) => (<option key={v} value={v}>{v}</option>))}
              </select>
              {(["impressions", "clicks", "ctr", "viewability", "leads", "cost", "videoViews"] as const).map((m) => (
                <button key={m} onClick={() => setChartMetric(m)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all ${chartMetric === m ? "text-white shadow" : "bg-white text-gray-600 border border-gray-200 hover:border-purple-400"}`}
                  style={chartMetric === m ? { backgroundColor: PURPLE } : {}}>{chartMetricLabel[m]}</button>
              ))}
            </div>
          </div>
          <div style={{ height: 300 }}>
            <ResponsiveLine
              data={adChartData}
              colors={adChartColors}
              margin={{ top: 16, right: 24, bottom: 68, left: 64 }}
              xScale={{ type: "point" }}
              yScale={{ type: "linear", min: 0, max: "auto" }}
              curve="monotoneX"
              axisTop={null}
              axisRight={null}
              axisBottom={{ tickSize: 5, tickPadding: 8, tickRotation: -45, tickValues: adChartTicks, format: (v) => shortBR(String(v)) }}
              axisLeft={{ tickSize: 5, tickPadding: 8, format: (v) => (chartIsCurrency ? `R$ ${formatCompact(Number(v))}` : chartIsPct ? `${Number(v).toFixed(0)}%` : formatCompact(Number(v))) }}
              enableGridX={false}
              enablePoints={adChartTicks.length <= 40}
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
                      <span className="font-semibold text-gray-900">{chartIsCurrency ? formatCurrency(Number(p.data.y)) : chartIsPct ? `${Number(p.data.y).toFixed(2)}%` : formatNum(Number(p.data.y))}</span>
                    </div>
                  ))}
                </div>
              )}
              legends={[{ anchor: "bottom", direction: "row", translateY: 60, itemsSpacing: 10, itemWidth: 120, itemHeight: 16, symbolSize: 10, symbolShape: "circle", itemTextColor: "#6b7280" }]}
            />
          </div>
        </div>
      )}

      {/* ── Site · GA4 ── */}
      {hasGa4 && (
        <div className="card-overlay rounded-xl shadow-lg p-4 space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${PURPLE}, ${PURPLE_LIGHT})` }}><Globe2 className="w-4 h-4 text-white" /></div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Site · Google Analytics 4</h3>
              <p className="text-[10px] text-gray-400">Sessões, engajamento, canais e regiões da Landing Page</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-purple-50 rounded-lg p-3 text-center"><p className="text-xl font-bold text-purple-700">{formatNum(ga4Totals.sessions)}</p><p className="text-[10px] text-gray-500">Sessões</p></div>
            <div className="bg-indigo-50 rounded-lg p-3 text-center"><p className="text-xl font-bold text-indigo-700">{formatNum(ga4Totals.newUsers)}</p><p className="text-[10px] text-gray-500">Novos usuários</p></div>
            <div className="bg-fuchsia-50 rounded-lg p-3 text-center"><p className="text-xl font-bold text-fuchsia-700">{formatDuration(ga4Totals.avgEngagement)}</p><p className="text-[10px] text-gray-500">Engajamento médio</p></div>
            <div className="bg-emerald-50 rounded-lg p-3 text-center"><p className="text-xl font-bold text-emerald-700">{(ga4Totals.bounceRate * 100).toFixed(1)}%</p><p className="text-[10px] text-gray-500">Taxa de rejeição</p></div>
          </div>

          {sessionsByDay.length > 1 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2"><Activity className="w-3.5 h-3.5 text-purple-600" /><h4 className="text-xs font-bold text-gray-700">Sessões por dia</h4></div>
              <div style={{ height: 240 }}>
                <ResponsiveLine
                  data={sessionsLineData} colors={[PURPLE]}
                  margin={{ top: 12, right: 20, bottom: 44, left: 52 }}
                  xScale={{ type: "point" }} yScale={{ type: "linear", min: 0, max: "auto" }} curve="monotoneX"
                  axisTop={null} axisRight={null}
                  axisBottom={{ tickSize: 5, tickPadding: 8, tickRotation: -40, tickValues: sessionsTicks }}
                  axisLeft={{ tickSize: 5, tickPadding: 8, format: (v) => formatCompact(Number(v)) }}
                  enableGridX={false} enableArea areaOpacity={0.12} pointSize={6} pointBorderWidth={2} pointBorderColor={{ from: "seriesColor" }} pointColor="#ffffff" useMesh enableSlices="x"
                  sliceTooltip={({ slice }) => (
                    <div className="bg-white rounded-lg shadow-xl border border-gray-100 px-3 py-2">
                      <p className="text-[11px] font-bold text-gray-900 mb-1">{String(slice.points[0]?.data.x)}</p>
                      <div className="flex items-center gap-2 text-[11px]"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: PURPLE }} /><span className="text-gray-600">Sessões:</span><span className="font-semibold text-gray-900">{formatNum(Number(slice.points[0]?.data.y))}</span></div>
                    </div>
                  )}
                />
              </div>
            </div>
          )}

          {channelStats.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-3"><MonitorPlay className="w-3.5 h-3.5 text-purple-600" /><h4 className="text-xs font-bold text-gray-700">Desempenho por Canal</h4><span className="text-[10px] text-gray-400">origem das sessões na Landing Page</span></div>
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
                            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.max((c.sessions / channelMax) * 100, 2)}%`, background: `linear-gradient(to right, ${PURPLE}, ${PURPLE_LIGHT})` }} /></div>
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
            </div>
          )}

          {regionRanking.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2"><MapPin className="w-3.5 h-3.5 text-purple-600" /><h4 className="text-xs font-bold text-gray-700">Distribuição geográfica</h4></div>
              <div className="grid gap-4 md:grid-cols-2 items-start">
                <div className="-mt-2"><BrazilMap regionData={regionData} getIntensityColor={getRegionColor} /></div>
                <div className="space-y-4">
                  <div>
                    <p className="text-[11px] font-bold text-gray-600 mb-2">Sessões por estado</p>
                    <div className="space-y-2.5">
                      {regionRanking.slice(0, 8).map((r, i) => (
                        <RankBar key={r.name} label={`${r.name} (${ufSigla(r.name)})`} value={r.sessions} max={regionMax} total={regionTotal} t={1 - i / Math.max(Math.min(regionRanking.length, 8) - 1, 1)} />
                      ))}
                    </div>
                  </div>
                  {topCities.length > 0 && (
                    <div>
                      <p className="text-[11px] font-bold text-gray-600 mb-2">Top cidades</p>
                      <div className="space-y-2.5">
                        {topCities.slice(0, 8).map((c, i) => (
                          <RankBar key={c.name} label={c.name} value={c.sessions} max={cityMax} total={cityTotal} t={1 - i / Math.max(Math.min(topCities.length, 8) - 1, 1)} />
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

      {/* ── Análise IA ── */}
      <div className="card-overlay rounded-xl shadow-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center"><Sparkles className="w-4 h-4 text-white" /></div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Análise de Performance</h3>
              <p className="text-[10px] text-gray-400">Gerado por IA · campanha em andamento (dados parciais)</p>
            </div>
          </div>
          <button onClick={() => runAiAnalysis(true)} disabled={aiLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white text-xs font-medium rounded-lg transition-all">
            <RefreshCw className={`w-3.5 h-3.5 ${aiLoading ? "animate-spin" : ""}`} />
            {aiLoading ? "Analisando..." : aiAnalysis ? "Reanalisar" : "Analisar"}
          </button>
        </div>
        {!aiAnalysis && !aiLoading && !aiError && (
          <div className="flex flex-col items-center justify-center py-8 text-center"><Sparkles className="w-8 h-8 text-purple-200 mb-2" /><p className="text-sm text-gray-400">Clique em <strong>Analisar</strong> para gerar uma leitura da campanha</p></div>
        )}
        {aiLoading && (
          <div className="flex items-center justify-center py-8 gap-3">
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            <span className="text-sm text-gray-400 ml-1">Processando dados com IA...</span>
          </div>
        )}
        {aiError && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{aiError}</div>}
        {aiAnalysis && !aiLoading && (
          <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-100 rounded-lg p-4"><p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{aiAnalysis}</p></div>
        )}
      </div>

      {/* ── Plano de Mídia ── */}
      {Object.keys(planoData.meios).length > 0 && (
        <div className="card-overlay rounded-xl shadow-lg p-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-purple-600"><Radio className="w-4 h-4 text-white" /></div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Plano de Mídia</h3>
              <p className="text-[10px] text-gray-400">Planejamento: contratado, investimento e execução de projetos</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-green-50 rounded-lg p-3 text-center"><p className="text-xl font-bold text-green-700">{formatCurrency(planoData.totalInvestimento)}</p><p className="text-xs text-gray-500 mt-0.5">Investimento</p></div>
            <div className="bg-amber-50 rounded-lg p-3 text-center"><p className="text-xl font-bold text-amber-700">{formatCurrency(planoData.totalExecucao)}</p><p className="text-xs text-gray-500 mt-0.5">Execução Projeto</p></div>
            <div className="bg-purple-50 rounded-lg p-3 text-center"><p className="text-xl font-bold text-purple-700">{formatCurrency(planoData.totalInvestimento + planoData.totalExecucao)}</p><p className="text-xs text-gray-500 mt-0.5">Total</p></div>
          </div>
          <div className="space-y-2">
            {sortedMeios.map(([meioNome, meio]: [string, any]) => (
              <div key={meioNome} className="border-2 border-gray-200 rounded-lg overflow-hidden">
                <div className="flex items-center justify-between p-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => setExpandedMeios((prev) => ({ ...prev, [meioNome]: !prev[meioNome] }))}>
                  <div className="flex items-center gap-2">
                    {expandedMeios[meioNome] ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
                    <span className="text-sm font-semibold text-gray-900">{meioNome}</span>
                    <span className="text-xs text-gray-400 bg-gray-200 px-2 py-0.5 rounded-full">{Object.keys(meio.veiculos).length} veículos</span>
                  </div>
                  <div className="flex gap-4 text-xs text-right">
                    <div><p className="text-gray-400">Investimento</p><p className="font-semibold text-gray-700">{formatCurrency(meio.investimento)}</p></div>
                    {meio.execucao > 0 && <div><p className="text-amber-600">Projetos</p><p className="font-semibold text-amber-700">{formatCurrency(meio.execucao)}</p></div>}
                  </div>
                </div>
                {expandedMeios[meioNome] && (
                  <div className="p-3 space-y-1.5 bg-white">
                    {Object.entries(meio.veiculos).map(([veicNome, veic]: [string, any]) => {
                      const key = `${meioNome}__${veicNome}`
                      return (
                        <div key={veicNome} className="border border-gray-100 rounded-md">
                          <div className="flex items-center justify-between p-2 hover:bg-gray-50 cursor-pointer transition-colors"
                            onClick={() => setExpandedVeics((prev) => ({ ...prev, [key]: !prev[key] }))}>
                            <div className="flex items-center gap-1.5">
                              {expandedVeics[key] ? <ChevronDown className="w-3 h-3 text-gray-400" /> : <ChevronRight className="w-3 h-3 text-gray-400" />}
                              <span className="text-xs font-medium text-gray-800">{veicNome}</span>
                              <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">{veic.rows.length} praças</span>
                            </div>
                            <div className="flex gap-3 text-[10px] text-right">
                              <div><span className="text-gray-400">Invest.: </span><span className="font-medium text-gray-700">{formatCurrency(veic.investimento)}</span></div>
                              {veic.execucao > 0 && <div><span className="text-amber-600">Projetos: </span><span className="font-medium text-amber-700">{formatCurrency(veic.execucao)}</span></div>}
                            </div>
                          </div>
                          {expandedVeics[key] && (
                            <div className="px-3 pb-2">
                              <table className="w-full text-[10px]">
                                <thead>
                                  <tr className="border-b border-gray-100">
                                    <th className="text-left py-1 text-gray-500 font-medium">Praça</th>
                                    <th className="text-left py-1 text-gray-500 font-medium">Tipo</th>
                                    <th className="text-right py-1 text-gray-500 font-medium">Contratado</th>
                                    <th className="text-right py-1 text-gray-500 font-medium">Investimento</th>
                                    <th className="text-right py-1 text-amber-600 font-medium">Projetos</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {veic.rows.map((row: any, ri: number) => (
                                    <tr key={ri} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                                      <td className="py-1 text-gray-700">{row.praca}</td>
                                      <td className="py-1 text-gray-500">{row.tipo}</td>
                                      <td className="py-1 text-right text-gray-700 font-semibold">{row.contratado}</td>
                                      <td className="py-1 text-right text-green-700 font-semibold">{row.investimento > 0 ? formatCurrency(row.investimento) : <span className="text-gray-300">—</span>}</td>
                                      <td className="py-1 text-right text-amber-700 font-semibold">{row.execucao > 0 ? formatCurrency(row.execucao) : <span className="text-gray-300">—</span>}</td>
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedCreative(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 p-4 border-b border-gray-100 sticky top-0 bg-white z-10">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-gradient-to-br from-purple-500 to-indigo-600"><ImageIcon className="w-4 h-4 text-white" /></div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-gray-900 truncate" title={activeCreative.name}>{activeCreative.name.replace(/_/g, " ")}</h3>
                  <p className="text-[11px] text-gray-400 truncate">{activeCreative.veiculos.join(" · ") || "Criativo"}</p>
                </div>
              </div>
              <button onClick={() => setSelectedCreative(null)} className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 shrink-0" aria-label="Fechar"><X className="w-4 h-4" /></button>
            </div>

            <div className="p-4 grid gap-4 md:grid-cols-[220px_1fr]">
              <div>
                <CreativeThumb src={activeCreative.image} alt={activeCreative.name} />
                <div className="mt-2 flex flex-wrap gap-1">
                  {activeCreative.veiculos.map((v) => (<span key={v} className="text-[9px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-600 font-medium">{v}</span>))}
                </div>
              </div>

              <div className="space-y-4 min-w-0">
                <div>
                  <p className="text-[11px] font-bold text-gray-700 mb-2">Resultados gerais</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-purple-50 rounded-lg p-2 text-center"><p className="text-base font-bold text-purple-700">{formatCompact(activeCreative.impressions)}</p><p className="text-[9px] text-gray-500">Impressões</p></div>
                    <div className="bg-indigo-50 rounded-lg p-2 text-center"><p className="text-base font-bold text-indigo-700">{formatNum(activeCreative.clicks)}</p><p className="text-[9px] text-gray-500">Cliques</p></div>
                    <div className="bg-fuchsia-50 rounded-lg p-2 text-center"><p className="text-base font-bold text-fuchsia-700">{formatPct(activeCreative.ctr)}</p><p className="text-[9px] text-gray-500">CTR</p></div>
                    <div className="bg-violet-50 rounded-lg p-2 text-center"><p className="text-base font-bold text-violet-700">{formatNum(activeCreative.leads)}</p><p className="text-[9px] text-gray-500">Leads</p></div>
                    <div className="bg-emerald-50 rounded-lg p-2 text-center"><p className="text-base font-bold text-emerald-700">{formatCurrency(activeCreative.cost)}</p><p className="text-[9px] text-gray-500">Investimento</p></div>
                    <div className="bg-amber-50 rounded-lg p-2 text-center"><p className="text-base font-bold text-amber-700">{activeCreative.videoViews > 0 ? formatPct(activeCreative.vtr) : "—"}</p><p className="text-[9px] text-gray-500">{activeCreative.videoViews > 0 ? "VTR" : "Sem vídeo"}</p></div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                    <p className="text-[11px] font-bold text-gray-700">Comportamento ao longo do tempo</p>
                    <div className="flex gap-1">
                      {(["impressions", "clicks", "leads", "cost"] as const).map((m) => (
                        <button key={m} onClick={() => setModalMetric(m)}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold transition-all ${modalMetric === m ? "bg-purple-600 text-white shadow" : "bg-white text-gray-500 border border-gray-200 hover:border-purple-400"}`}>{modalMetricLabel[m]}</button>
                      ))}
                    </div>
                  </div>
                  {creativeDaily.length > 1 ? (
                    <div style={{ height: 220 }}>
                      <ResponsiveLine
                        data={modalLineData} colors={[PURPLE]}
                        margin={{ top: 12, right: 20, bottom: 44, left: 56 }}
                        xScale={{ type: "point" }} yScale={{ type: "linear", min: 0, max: "auto" }} curve="monotoneX"
                        axisTop={null} axisRight={null}
                        axisBottom={{ tickSize: 5, tickPadding: 8, tickRotation: -40, tickValues: modalTicks }}
                        axisLeft={{ tickSize: 5, tickPadding: 8, format: (v) => (modalMetric === "cost" ? `R$ ${formatCompact(Number(v))}` : formatCompact(Number(v))) }}
                        enableGridX={false} enableArea areaOpacity={0.12} pointSize={6} pointBorderWidth={2} pointBorderColor={{ from: "seriesColor" }} pointColor="#ffffff" useMesh enableSlices="x"
                        sliceTooltip={({ slice }) => (
                          <div className="bg-white rounded-lg shadow-xl border border-gray-100 px-3 py-2">
                            <p className="text-[11px] font-bold text-gray-900 mb-1">{String(slice.points[0]?.data.x)}</p>
                            <div className="flex items-center gap-2 text-[11px]"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: PURPLE }} /><span className="text-gray-600">{modalMetricLabel[modalMetric]}:</span><span className="font-semibold text-gray-900">{modalMetric === "cost" ? formatCurrency(Number(slice.points[0]?.data.y)) : formatNum(Number(slice.points[0]?.data.y))}</span></div>
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

export default CapitalDeGiroEtapa2

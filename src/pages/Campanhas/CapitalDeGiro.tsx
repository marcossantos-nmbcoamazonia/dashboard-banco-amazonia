"use client"

import type React from "react"
import { useRef, useState, useEffect, useMemo, useCallback } from "react"
import { DollarSign, Users, MousePointerClick, Eye, Play, HelpCircle, Sparkles, RefreshCw, ArrowUpDown, Radio, ChevronRight, ChevronDown, Calendar, X, Image as ImageIcon, TrendingUp } from "lucide-react"
import axios from "axios"
import { ResponsiveLine } from "@nivo/line"
import Loading from "../../components/Loading/Loading"
import PDFDownloadButton from "../../components/PDFDownloadButton/PDFDownloadButton"
import { analyzeCapitalDeGiro } from "../../services/gemini"
import { getCachedAnalysis, setCachedAnalysis } from "../../services/analysisCache"
import { CONTRATOS_CAPITAL_DE_GIRO, DIARIA_MIN_IMPRESSOES, diasRestantesNoMes, type TipoCompra, type ContratoVeiculo } from "../../data/adserverContratos"

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
  videoViews25: number
  videoViews50: number
  videoViews75: number
  videoCompletions: number
  engagements: number
  leads: number
  veiculo: string
  tipoCompra: string
  videoEstatico: string
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Interpola entre amarelo (0%) e roxo escuro (100%) → cor sólida por percentual
const pacingColor = (pct: number): string => {
  const t = Math.min(pct, 100) / 100
  const r = Math.round(234 + (88  - 234) * t)  // 234→88
  const g = Math.round(179 + (28  - 179) * t)  // 179→28
  const b = Math.round(8   + (135 - 8  ) * t)  //   8→135
  return `rgb(${r},${g},${b})`
}

const parseNum = (v: string): number => {
  if (!v || v === "-" || v === "") return 0
  return parseFloat(v.replace(/\./g, "").replace(",", ".")) || 0
}

// Normaliza datas de origens diferentes (DD/MM/YYYY do Consolidado, ISO do AdServer)
// para o formato "YYYY-MM-DD", usado na comparação com o filtro de período.
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

const formatPct = (v: number) => `${(v * 100).toFixed(2)}%`

const formatCompact = (v: number) =>
  new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(v)

// "2026-07-06" → "06/07"
const shortBR = (iso: string) => {
  const [, m, d] = iso.split("-")
  return d && m ? `${d}/${m}` : iso
}

// Cores por plataforma (tema roxo/marca das redes)
const VEICULO_COLOR: Record<string, string> = {
  Facebook: "#1877F2",
  Instagram: "#C13584",
  "Google Ads": "#4285F4",
  LinkedIn: "#0A66C2",
}
const colorForVeiculo = (v: string, i: number) => VEICULO_COLOR[v] ?? ["#7c3aed", "#a855f7", "#6366f1", "#8b5cf6"][i % 4]

// ─── Componentes auxiliares ───────────────────────────────────────────────────

interface KpiCardProps {
  label: string
  value: string
  sub?: string
  icon: React.ReactNode
  color: string
  tooltip?: string
}

const KpiCard: React.FC<KpiCardProps> = ({ label, value, sub, icon, color, tooltip }) => (
  <div className="card-overlay rounded-xl shadow-lg p-4 flex flex-col gap-2">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1">
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        {tooltip && (
          <div className="relative group">
            <HelpCircle className="w-3 h-3 text-gray-400 cursor-help" />
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-gray-900 text-white text-[10px] rounded-lg px-2.5 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 leading-relaxed">
              {tooltip}
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
            </div>
          </div>
        )}
      </div>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>{icon}</div>
    </div>
    <p className="text-xl font-bold text-gray-900">{value}</p>
    {sub && <p className="text-xs text-gray-500">{sub}</p>}
  </div>
)

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
  return (
    <img src={src} alt={alt} loading="lazy" onError={() => setErr(true)}
         className="w-full aspect-square rounded-lg object-cover bg-gray-100" />
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

const CapitalDeGiro: React.FC = () => {
  const contentRef = useRef<HTMLDivElement>(null)
  const [consolidado, setConsolidado] = useState<ConsolidadoRow[]>([])
  const [aiAnalysis, setAiAnalysis] = useState<string>("")
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  const [lpSummary, setLpSummary] = useState<LpSummary | null>(null)
  const [lpLoading, setLpLoading] = useState(false)
  const [adServer, setAdServer] = useState<AdServerRow[]>([])
  const [adServer2, setAdServer2] = useState<AdServerRow[]>([])
  const [offlineRaw, setOfflineRaw] = useState<string[][]>([])
  const [expandedMeios, setExpandedMeios] = useState<Record<string, boolean>>({})
  const [expandedPracas, setExpandedPracas] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [selectedVeiculo, setSelectedVeiculo] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: "", end: "" })
  type SortCol = "publisher" | "contratado" | "impressions" | "pacingPct" | "clicks" | "ctr" | "va"
  const [sortCol, setSortCol] = useState<SortCol>("impressions")
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc")

  // Gráfico de evolução (redes sociais)
  type ChartMetric = "impressions" | "clicks" | "cost" | "leads" | "videoViews" | "ctr" | "vtr"
  const [chartMetric, setChartMetric] = useState<ChartMetric>("impressions")

  // Criativos + modal
  const [creativeSort, setCreativeSort] = useState<"impressions" | "leads" | "ctr" | "cost">("impressions")
  const [creativeVeiculo, setCreativeVeiculo] = useState<"Todos" | "Facebook" | "Instagram">("Todos")
  const [selectedCreative, setSelectedCreative] = useState<string | null>(null) // URL da imagem do criativo aberto
  const [modalMetric, setModalMetric] = useState<"impressions" | "clicks" | "leads" | "cost">("impressions")

  const toggleSort = (col: SortCol) => {
    if (sortCol === col) setSortDir((d) => (d === "desc" ? "asc" : "desc"))
    else { setSortCol(col); setSortDir("desc") }
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const [consRes, adServerRes, adServer2Res, offlineRes] = await Promise.all([
          axios.get(
            "https://nmbcoamazonia-api.vercel.app/google/sheets/1ZPKSZQTwylGl3MQHVA-Ee_htmjAPO0QEEYep1Rk_J1o/data?range=Consolidado"
          ),
          axios.get("https://dashbrasiladserver.com.br/api/templates/274/bi?token=VxSzRmqc2M").catch(() => ({ data: [] })),
          axios.get("https://dashbrasiladserver.com.br/api/templates/279/bi?token=QY9jKtmfzD").catch(() => ({ data: [] })),
          axios.get("https://nmbcoamazonia-api.vercel.app/google/sheets/1ZPKSZQTwylGl3MQHVA-Ee_htmjAPO0QEEYep1Rk_J1o/data?range=Offline").catch(() => ({ data: { success: false } })),
        ])

        // Processar Consolidado
        if (consRes.data.success && consRes.data.data.values) {
          const rows: any[][] = consRes.data.data.values
          const header = rows[0]
          const idx = (col: string) => header.indexOf(col)

          const parsed: ConsolidadoRow[] = rows.slice(1)
            .filter((r) => (r[idx("Campanha")] || "").toLowerCase().includes("capital de giro"))
            .map((r) => ({
              date: r[idx("Date")] || "",
              campaignName: r[idx("Campaign name")] || "",
              adSetName: r[idx("Ad Set Name")] || "",
              adName: r[idx("Ad Name")] || "",
              cost: parseNum(r[idx("Cost")] || "0"),
              impressions: parseNum(r[idx("Impressions")] || "0"),
              clicks: parseNum(r[idx("Clicks")] || "0"),
              videoViews: parseNum(r[idx("Video views")] || "0"),
              videoViews25: parseNum(r[idx("Video views 25%")] || "0"),
              videoViews50: parseNum(r[idx("Video views 50%")] || "0"),
              videoViews75: parseNum(r[idx("Video views 75%")] || "0"),
              videoCompletions: parseNum(r[idx("Video completions")] || "0"),
              engagements: parseNum(r[idx("Total engagements")] || "0"),
              leads: parseNum(r[idx("Leads")] || "0"),
              veiculo: r[idx("Veículo")] || "",
              tipoCompra: r[idx("Tipo de Compra")] || "",
              videoEstatico: r[idx("video_estatico_audio")] || "",
              image: r[idx("Image")] || "",
              campanha: r[idx("Campanha")] || "",
            }))
          setConsolidado(parsed)
        }

        // AdServer
        if (Array.isArray(adServerRes.data) && adServerRes.data.length > 0) {
          setAdServer(adServerRes.data)
        }
        if (Array.isArray(adServer2Res.data) && adServer2Res.data.length > 0) {
          setAdServer2(adServer2Res.data)
        }

        // Veiculação Off-line
        if (offlineRes.data?.success && offlineRes.data?.data?.values) {
          setOfflineRaw(offlineRes.data.data.values)
        }
      } catch (err) {
        console.error("Erro ao buscar dados Capital de Giro:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  // Busca o resumo da LP (RD Station) reagindo ao filtro de período.
  // A rota aceita start_date/end_date (ISO); sem filtro, retorna o período completo.
  useEffect(() => {
    const fetchLpSummary = async () => {
      try {
        setLpLoading(true)
        const base = "https://nmbcoamazonia-api.vercel.app/rdstation/lp-summary"
        const params = new URLSearchParams()
        if (dateRange.start || dateRange.end) {
          const today = new Date().toISOString().slice(0, 10)
          params.set("start_date", dateRange.start || "2025-01-01")
          params.set("end_date", dateRange.end || today)
        }
        const url = params.toString() ? `${base}?${params.toString()}` : base
        const res = await axios.get(url)
        if (res.data?.success && res.data?.data) {
          setLpSummary(res.data.data)
        } else {
          setLpSummary(null)
        }
      } catch (err) {
        console.error("Erro ao buscar LP summary (RD Station):", err)
        setLpSummary(null)
      } finally {
        setLpLoading(false)
      }
    }
    fetchLpSummary()
  }, [dateRange])

  // ─── Métricas agregadas ──────────────────────────────────────────────────────

  // Verifica se uma data bruta (de qualquer origem) cai dentro do período selecionado.
  // Sem período definido, todos os registros passam.
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

  // Base do Consolidado já filtrada por período (alimenta todas as métricas de redes sociais)
  const consolidadoPorData = useMemo(
    () => consolidado.filter((r) => inDateRange(r.date)),
    [consolidado, inDateRange]
  )

  const filtered = useMemo(
    () => (selectedVeiculo ? consolidadoPorData.filter((r) => r.veiculo === selectedVeiculo) : consolidadoPorData),
    [consolidadoPorData, selectedVeiculo]
  )

  const totals = useMemo(() => {
    const t = filtered.reduce(
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
      cpl: t.leads > 0 ? t.cost / t.leads : 0,
      cpc: t.clicks > 0 ? t.cost / t.clicks : 0,
      vtr: t.videoViews > 0 ? t.videoCompletions / t.videoViews : 0,
    }
  }, [filtered])

  // Leads do Google Ads (fonte Google no consolidado). No TOTAL geral eles são
  // descontados, pois esses mesmos leads já entram nas conversões da LP (RD Station)
  // — o Google rastreia a conversão no envio do formulário da LP. Evita dupla contagem.
  const googleAdsLeads = useMemo(
    () => filtered.filter((r) => /google/i.test(r.veiculo)).reduce((acc, r) => acc + r.leads, 0),
    [filtered]
  )

  // Leads de Meta por plataforma (veículo) — derivado do consolidado
  const metaLeadsByPlatform = useMemo(() => {
    const map = new Map<string, number>()
    consolidadoPorData.forEach((r) => {
      if (r.leads > 0) map.set(r.veiculo || "Desconhecido", (map.get(r.veiculo || "Desconhecido") || 0) + r.leads)
    })
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1])
  }, [consolidadoPorData])

  // Veículos únicos
  const veiculos = useMemo(
    () => Array.from(new Set(consolidadoPorData.map((r) => r.veiculo).filter(Boolean))),
    [consolidadoPorData]
  )

  // Por veículo
  const byVeiculo = useMemo(() => {
    const map = new Map<string, typeof totals>()
    veiculos.forEach((v) => {
      const rows = consolidadoPorData.filter((r) => r.veiculo === v)
      const t = rows.reduce(
        (acc, r) => ({
          cost: acc.cost + r.cost,
          impressions: acc.impressions + r.impressions,
          clicks: acc.clicks + r.clicks,
          videoViews: acc.videoViews + r.videoViews,
          videoCompletions: acc.videoCompletions + r.videoCompletions,
          leads: acc.leads + r.leads,
          engagements: acc.engagements + r.engagements,
          ctr: 0, cpl: 0, cpc: 0, vtr: 0,
        }),
        { cost: 0, impressions: 0, clicks: 0, videoViews: 0, videoCompletions: 0, leads: 0, engagements: 0, ctr: 0, cpl: 0, cpc: 0, vtr: 0 }
      )
      t.ctr = t.impressions > 0 ? t.clicks / t.impressions : 0
      t.cpl = t.leads > 0 ? t.cost / t.leads : 0
      t.cpc = t.clicks > 0 ? t.cost / t.clicks : 0
      t.vtr = t.videoViews > 0 ? t.videoCompletions / t.videoViews : 0
      map.set(v, t)
    })
    return map
  }, [consolidadoPorData, veiculos])

  // Leads por dia — derivado do consolidado
  const leadsByDay = useMemo(() => {
    const map = new Map<string, number>()
    consolidadoPorData.forEach((r) => {
      if (r.leads <= 0 || !r.date) return
      // Normalizar para YYYY-MM-DD independente do formato da planilha (DD/MM/YYYY ou YYYY-MM-DD)
      let key = r.date
      if (r.date.includes("/")) {
        const [d, m, y] = r.date.split("/")
        key = `${y}-${m}-${d}`
      }
      map.set(key, (map.get(key) || 0) + r.leads)
    })
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-14)
  }, [consolidadoPorData])

  const maxLeadsDay = useMemo(() => Math.max(...leadsByDay.map((d) => d[1]), 1), [leadsByDay])

  // ─── Gráfico de evolução no tempo (redes sociais) ────────────────────────────
  // Uma linha por veículo; métricas compostas (CTR/VTR) calculadas a partir das
  // somas do dia (nunca média de razões), no espírito da página Linha do Tempo.
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

  // ─── Criativos (Meta) ────────────────────────────────────────────────────────
  // Coluna "Image" traz a URL da peça (só FB/IG). O Ad Name é o nome distintivo.
  const creatives = useMemo(() => {
    type Agg = { image: string; name: string; veiculos: Set<string>; campanhas: Set<string>; impressions: number; clicks: number; cost: number; leads: number; videoViews: number; videoCompletions: number }
    const map = new Map<string, Agg>()
    consolidadoPorData.forEach((r) => {
      if (!r.image) return
      if (creativeVeiculo !== "Todos" && r.veiculo !== creativeVeiculo) return
      const cur = map.get(r.image) ?? { image: r.image, name: "", veiculos: new Set<string>(), campanhas: new Set<string>(), impressions: 0, clicks: 0, cost: 0, leads: 0, videoViews: 0, videoCompletions: 0 }
      cur.impressions += r.impressions; cur.clicks += r.clicks; cur.cost += r.cost; cur.leads += r.leads
      cur.videoViews += r.videoViews; cur.videoCompletions += r.videoCompletions
      if (r.veiculo) cur.veiculos.add(r.veiculo)
      if (r.campaignName) cur.campanhas.add(r.campaignName)
      if (!cur.name && (r.adName || r.adSetName)) cur.name = r.adName || r.adSetName
      map.set(r.image, cur)
    })
    const arr = Array.from(map.values()).map((c) => ({
      image: c.image,
      name: c.name || "Criativo",
      veiculos: Array.from(c.veiculos),
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
    () => [{ id: modalMetricLabel[modalMetric], color: "#7c3aed", data: creativeDaily.map((d) => ({ x: shortBR(d.iso), y: d[modalMetric] })) }],
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

  // AdServer — combinar as três fontes, deduplicando por publisher+date para evitar
  // dupla contagem nos publishers que aparecem em mais de um template.
  // AdServer — combinar as duas fontes
  const allAdServer = useMemo(
    () => [...adServer, ...adServer2].filter((r) => inDateRange(r.date)),
    [adServer, adServer2, inDateRange]
  )

  // AdServer — agregar por publisher e cruzar com contratos fixos
  const adServerByPublisher = useMemo(() => {
    const normalize = (s: string) => s.toUpperCase().trim()

    // agrupa contratos por publisher normalizado → pode haver CPM + DIARIA
    const contratosPorPublisher = new Map<string, ContratoVeiculo[]>()
    CONTRATOS_CAPITAL_DE_GIRO.forEach((c) => {
      const key = normalize(c.publisher)
      const arr = contratosPorPublisher.get(key) ?? []
      arr.push(c)
      contratosPorPublisher.set(key, arr)
    })

    // acumula métricas POR publisher E POR dia
    type DayMap = Map<string, number>
    const map = new Map<string, {
      impressions: number
      clicks: number
      vieweables: number
      byDay: DayMap
      inicioPublisher: string
    }>()

    allAdServer.forEach((r) => {
      const key = r.publisher_name
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
      name: string
      rowKey: string
      impressions: number
      clicks: number
      vieweables: number
      diasValidos: number
      metaDias: number | null   // meta calculada para DIARIA (fixo ou dias do mês)
      inicioPublisher: string
      tipo: TipoCompra | null
      contrato: ContratoVeiculo | null
      pacingPct: number
      ctr: number
      va: number
      isSubrow: boolean
    }[] = []

    Array.from(map.entries()).forEach(([name, v]) => {
      const contratos = contratosPorPublisher.get(normalize(name)) ?? []

      const diasValidos = Array.from(v.byDay.entries())
        .filter(([date, imp]) => date >= v.inicioPublisher && imp > DIARIA_MIN_IMPRESSOES)
        .length

      const ctr = v.impressions > 0 ? (v.clicks / v.impressions) * 100 : 0
      const va  = v.impressions > 0 ? (v.vieweables / v.impressions) * 100 : 0

      if (contratos.length === 0) {
        rows.push({ name, rowKey: name, impressions: v.impressions, clicks: v.clicks, vieweables: v.vieweables, diasValidos, metaDias: null, inicioPublisher: v.inicioPublisher, tipo: null, contrato: null, pacingPct: 0, ctr, va, isSubrow: false })
        return
      }

      contratos.forEach((contrato, i) => {
        const metaDias = contrato.tipo === "DIARIA"
          ? (contrato.quantidade !== null ? contrato.quantidade : diasRestantesNoMes(v.inicioPublisher))
          : null

        const pacingPct = contrato.tipo === "CPM"
          ? Math.min((v.impressions / (contrato.quantidade ?? 1)) * 100, 100)
          : contrato.tipo === "CPC"
          ? Math.min((v.clicks / (contrato.quantidade ?? 1)) * 100, 100)
          : Math.min((diasValidos / (metaDias ?? 1)) * 100, 100)

        rows.push({
          name,
          rowKey: `${name}__${contrato.tipo}__${i}`,   // índice garante rowKey único
          impressions: i === 0 ? v.impressions : 0,
          clicks:      v.clicks,
          vieweables:  i === 0 ? v.vieweables  : 0,
          diasValidos,
          metaDias,
          inicioPublisher: v.inicioPublisher,
          tipo: contrato.tipo,
          contrato,
          pacingPct,
          ctr:  i === 0 ? ctr : 0,
          va:   i === 0 ? va  : 0,
          isSubrow: i > 0,
        })
      })
    })

    return rows
  }, [allAdServer])

  const adServerSorted = useMemo(() => {
    // pré-computa o valor de ordenação por publisher (baseado na linha principal, i=0)
    const valMap = new Map<string, number | string>()
    adServerByPublisher.forEach((r) => {
      if (r.isSubrow) return
      let v: number | string = 0
      if (sortCol === "publisher")   v = r.name
      else if (sortCol === "impressions") v = r.impressions
      else if (sortCol === "clicks")      v = r.clicks
      else if (sortCol === "ctr")         v = r.ctr
      else if (sortCol === "va")          v = r.va
      else if (sortCol === "pacingPct")   v = r.pacingPct
      else if (sortCol === "contratado")  v = r.contrato?.quantidade ?? 0
      valMap.set(r.name, v)
    })

    return [...adServerByPublisher].sort((a, b) => {
      if (a.name === b.name) return a.isSubrow ? 1 : -1

      const vA = valMap.get(a.name) ?? 0
      const vB = valMap.get(b.name) ?? 0
      const cmp = typeof vA === "string"
        ? vA.localeCompare(vB as string)
        : (vB as number) - (vA as number)

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

  // Veiculação Off-line — agrupa por Meio → Veículo → Praça
  const offlineData = useMemo(() => {
    if (offlineRaw.length < 2) return { meios: {}, totalInsercoes: 0, totalInvestimento: 0, totalExecucaoProjeto: 0 }

    const headers = offlineRaw[0]
    const iMeio      = headers.indexOf("MEIO")
    const iVeiculo   = headers.indexOf("VEÍCULO")
    const iPraca     = headers.indexOf("PRAÇA")
    // O cabeçalho pode vir como "Total Inserções" ou "Total Inserções/Impactos"
    const iInsercoes = headers.findIndex((h) => h.startsWith("Total Inserções"))
    const iInvest    = headers.indexOf("Investimento")
    const iExecucao  = headers.findIndex((h) => h.includes("Projeto"))

    const parseCur = (v: string): number => {
      if (!v || v === "-") return 0
      return parseFloat(v.replace(/R\$\s?/g, "").replace(/\./g, "").replace(",", ".")) || 0
    }

    type PracaEntry   = { insercoes: number; investimento: number; execucaoProjeto: number }
    type VeiculoEntry = { pracas: Record<string, PracaEntry>; insercoes: number; investimento: number; execucaoProjeto: number }
    type MeioEntry    = { veiculos: Record<string, VeiculoEntry>; insercoes: number; investimento: number; execucaoProjeto: number }

    const meios: Record<string, MeioEntry> = {}
    let totalInsercoes = 0
    let totalInvestimento = 0
    let totalExecucaoProjeto = 0

    offlineRaw.slice(1).forEach((row) => {
      const meio    = row[iMeio]    || ""
      const veiculo = row[iVeiculo] || ""
      const praca   = row[iPraca]   || ""
      const ins     = parseInt((row[iInsercoes] || "0").replace(/\./g, "").replace(",", ".")) || 0
      const inv     = parseCur(row[iInvest] || "0")
      const exec    = iExecucao >= 0 ? parseCur(row[iExecucao] || "0") : 0

      if (!meio || !veiculo) return

      totalInsercoes       += ins
      totalInvestimento    += inv
      totalExecucaoProjeto += exec

      if (!meios[meio]) meios[meio] = { veiculos: {}, insercoes: 0, investimento: 0, execucaoProjeto: 0 }
      meios[meio].insercoes       += ins
      meios[meio].investimento    += inv
      meios[meio].execucaoProjeto += exec

      if (!meios[meio].veiculos[veiculo]) meios[meio].veiculos[veiculo] = { pracas: {}, insercoes: 0, investimento: 0, execucaoProjeto: 0 }
      meios[meio].veiculos[veiculo].insercoes       += ins
      meios[meio].veiculos[veiculo].investimento    += inv
      meios[meio].veiculos[veiculo].execucaoProjeto += exec

      if (!meios[meio].veiculos[veiculo].pracas[praca]) meios[meio].veiculos[veiculo].pracas[praca] = { insercoes: 0, investimento: 0, execucaoProjeto: 0 }
      meios[meio].veiculos[veiculo].pracas[praca].insercoes       += ins
      meios[meio].veiculos[veiculo].pracas[praca].investimento    += inv
      meios[meio].veiculos[veiculo].pracas[praca].execucaoProjeto += exec
    })

    return { meios, totalInsercoes, totalInvestimento, totalExecucaoProjeto }
  }, [offlineRaw])

  const DATA_KEY = "capital-de-giro"

  const buildAnalysisPayload = () => {
    const byVeiculoArr = veiculos.map((v) => {
      const t = byVeiculo.get(v)!
      return { name: v, impressions: t.impressions, clicks: t.clicks, leads: t.leads, cost: t.cost, ctr: t.ctr, cpl: t.cpl }
    })
    return { totals, adServerTotals, metaLeadsTotal: totals.leads, googleAdsLeads, lpSummary, byVeiculo: byVeiculoArr, adServerByPublisher }
  }

  const runAiAnalysis = async (forceRefresh = false) => {
    setAiLoading(true)
    setAiError(null)
    try {
      // Tenta cache primeiro (exceto se for reanálise forçada)
      if (!forceRefresh) {
        const cached = await getCachedAnalysis(DATA_KEY)
        if (cached) {
          setAiAnalysis(cached.analysis)
          setAiLoading(false)
          return
        }
      }
      // Gera nova análise
      const result = await analyzeCapitalDeGiro(buildAnalysisPayload())
      setAiAnalysis(result)
      // Salva no cache
      await setCachedAnalysis(DATA_KEY, result)
    } catch {
      setAiError("Não foi possível gerar a análise. Tente novamente.")
    } finally {
      setAiLoading(false)
    }
  }

  // Auto-análise: dispara quando os dados principais terminam de carregar
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!loading && !aiAnalysis && !aiLoading) {
      runAiAnalysis()
    }
  }, [loading]) // dispara uma vez quando loading muda para false

  if (loading) return <Loading message="Carregando dados da campanha..." />

  // Caso anômalo do RD Station: leads registrados sem visitas rastreadas no período
  // (leads podem vir de Lead Ads / importação, sem acesso à LP). Evita exibir 0 visitas / 0% enganosos.
  const lpUntracked = !!lpSummary && lpSummary.visits_count === 0 && lpSummary.conversion_count > 0

  return (
    <div ref={contentRef} className="h-full flex flex-col space-y-3 overflow-auto">

      {/* ── Hero ── */}
      <div className="relative overflow-hidden rounded-2xl shadow-2xl h-36">
        <div className="relative h-full bg-gradient-to-r from-purple-700 via-purple-600 to-indigo-600">
          <img
            src="/images/fundo_card.webp"
            alt="Capital de Giro"
            className="w-full h-full object-cover mix-blend-overlay opacity-30"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-purple-900/60 to-indigo-800/40" />
          <div className="absolute top-3 right-3 z-10">
            <PDFDownloadButton contentRef={contentRef} fileName="capital-de-giro" />
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-4 flex items-end justify-between">
            <div>
              <p className="text-purple-200 text-xs font-medium mb-1 uppercase tracking-wider">Campanhas · Cálix</p>
              <h1 className="text-2xl font-bold text-white">Capital de Giro</h1>
              <p className="text-purple-200 text-sm">Consolidado de performance</p>
            </div>
            <div className="text-right flex gap-4">
              <div>
                <p className="text-purple-200 text-xs">Leads de Veículos</p>
                <p className="text-2xl font-bold text-white">{formatNum(totals.leads)}</p>
              </div>
              <div>
                <p className="text-purple-200 text-xs">Visitantes LP</p>
                <p className="text-2xl font-bold text-white">
                  {lpSummary ? (lpUntracked ? "—" : formatNum(lpSummary.visits_count)) : "—"}
                </p>
              </div>
              <div>
                <p className="text-purple-200 text-xs">Conversões LP</p>
                <p className="text-2xl font-bold text-white">
                  {lpSummary ? formatNum(lpSummary.conversion_count) : "—"}
                </p>
                {lpSummary && !lpUntracked && lpSummary.conversion_rate <= 100 && (
                  <p className="text-purple-200 text-xs">{lpSummary.conversion_rate.toFixed(1)}% tx. conv.</p>
                )}
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
          <input
            type="date"
            value={dateRange.start}
            max={dateRange.end || undefined}
            onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value }))}
            className="px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
          />
          <span className="text-gray-500 text-sm">até</span>
          <input
            type="date"
            value={dateRange.end}
            min={dateRange.start || undefined}
            onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))}
            className="px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
          />
        </div>
        {(dateRange.start || dateRange.end) && (
          <button
            onClick={() => setDateRange({ start: "", end: "" })}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Limpar
          </button>
        )}
        <span className="text-[11px] text-gray-400 ml-auto">
          Filtra Redes Sociais, Display e LP (RD Station). Off-line não possui data por registro.
        </span>
      </div>

      {/* ── Filtro de veículo ── */}
      {veiculos.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setSelectedVeiculo(null)}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
              !selectedVeiculo
                ? "bg-purple-600 text-white shadow"
                : "bg-white text-gray-600 border border-gray-200 hover:border-purple-400"
            }`}
          >
            Todos
          </button>
          {veiculos.map((v) => (
            <button
              key={v}
              onClick={() => setSelectedVeiculo(selectedVeiculo === v ? null : v)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                selectedVeiculo === v
                  ? "bg-purple-600 text-white shadow"
                  : "bg-white text-gray-600 border border-gray-200 hover:border-purple-400"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      )}

      {/* ── KPIs principais ── */}
      {(() => {
        const totalImpressions = totals.impressions + adServerTotals.impressions
        const totalClicks = totals.clicks + adServerTotals.clicks
        const totalVideoViews = totals.videoViews
        // Desconta os leads do Google Ads para não duplicar (já contam nas conversões da LP)
        const totalLeads = totals.leads - googleAdsLeads + (lpSummary?.conversion_count ?? 0)
        const totalCpl = totalLeads > 0 ? totals.cost / totalLeads : 0
        const totalCtr = totalImpressions > 0 ? totalClicks / totalImpressions : 0
        return (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <KpiCard
              label="Investimento"
              value={formatCurrency(totals.cost)}
              icon={<DollarSign className="w-4 h-4 text-white" />}
              color="bg-purple-500"
              tooltip="Total investido em mídia paga nas redes sociais (Meta e LinkedIn) no período da campanha."
            />
            <KpiCard
              label="Leads"
              value={formatNum(totalLeads)}
              sub={`CPL: ${formatCurrency(totalCpl)}`}
              icon={<Users className="w-4 h-4 text-white" />}
              color="bg-indigo-500"
              tooltip="Total de leads captados: leads dos anúncios (formulários Meta/LinkedIn) + conversões da Landing Page (RD Station). Os leads do Google Ads são descontados aqui para não contar em dobro, pois já entram nas conversões da LP. CPL = Custo por Lead. Média de mercado: R$ 50 a R$ 420 — varia conforme canal, formulário, produto financeiro e nível de qualificação do lead."
            />
            <KpiCard
              label="Impressões"
              value={formatNum(totalImpressions)}
              sub="Redes Sociais + Display"
              icon={<Eye className="w-4 h-4 text-white" />}
              color="bg-blue-500"
              tooltip="Número total de vezes que os anúncios foram exibidos, somando redes sociais (Meta/LinkedIn) e display programático (AdServer)."
            />
            <KpiCard
              label="Cliques"
              value={formatNum(totalClicks)}
              sub={`CTR: ${formatPct(totalCtr)}`}
              icon={<MousePointerClick className="w-4 h-4 text-white" />}
              color="bg-cyan-500"
              tooltip="Total de cliques nos anúncios. CTR (Click-Through Rate) = cliques ÷ impressões. Mede o engajamento com os criativos. Média de mercado: Social/Display 0,6% a 1,5% (campanhas de tráfego, awareness ou consideração) · Search 1% a 8% (usuário em busca ativa)."
            />
            <KpiCard
              label="Visualizações"
              value={formatNum(totalVideoViews)}
              sub={`VTR: ${formatPct(totals.vtr)}`}
              icon={<Play className="w-4 h-4 text-white" />}
              color="bg-emerald-500"
              tooltip="Quantidade de vezes que os vídeos foram iniciados nas redes sociais. VTR (View-Through Rate) = views completas ÷ total de views iniciadas. Referência: 0,89% a 15% (faixa saudável para vídeo em mídia digital ampla) · Acima de 15%: acima da média, comum em vídeos curtos, criativos objetivos ou segmentações mais qualificadas."
            />
          </div>
        )
      })()}

      {/* ── Linha 2: Por veículo + Leads RD Station ── */}
      <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr" }}>

        {/* Por veículo */}
        <div className="card-overlay rounded-xl shadow-lg p-4">
          <h3 className="text-sm font-bold text-gray-900 mb-3">Performance por Veículo</h3>
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
                    <tr
                      key={v}
                      className={`border-b border-gray-100 cursor-pointer transition-colors ${
                        isSelected ? "bg-purple-50" : "hover:bg-gray-50"
                      }`}
                      onClick={() => setSelectedVeiculo(isSelected ? null : v)}
                    >
                      <td className="py-2 font-semibold text-gray-800">{v}</td>
                      <td className="py-2 text-right text-gray-700">{formatCurrency(t.cost)}</td>
                      <td className="py-2 text-right text-gray-700">{formatNum(t.impressions)}</td>
                      <td className="py-2 text-right text-gray-700">{formatNum(t.clicks)}</td>
                      <td className="py-2 text-right text-purple-600 font-semibold">{formatPct(t.ctr)}</td>
                      <td className="py-2 text-right text-indigo-600 font-bold">
                        {t.leads === 0 && t.cost > 0 ? (
                          <div className="relative group inline-block cursor-help">
                            <span className="text-gray-400 border-b border-dashed border-gray-400">-</span>
                            <div className="absolute bottom-full right-0 mb-2 w-56 bg-gray-900 text-white text-[10px] rounded-lg px-2.5 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 leading-relaxed text-left">
                              Os leads do LinkedIn foram contabilizados na Landing Page
                              <div className="absolute top-full right-3 border-4 border-transparent border-t-gray-900" />
                            </div>
                          </div>
                        ) : formatNum(t.leads)}
                      </td>
                      <td className="py-2 text-right text-gray-700">{t.leads > 0 ? formatCurrency(t.cpl) : "-"}</td>
                    </tr>
                  )
                })}
                {/* Total */}
                <tr className="bg-gray-50 font-bold">
                  <td className="py-2 text-gray-900">Total</td>
                  <td className="py-2 text-right text-purple-700">{formatCurrency(totals.cost)}</td>
                  <td className="py-2 text-right text-gray-900">{formatNum(totals.impressions)}</td>
                  <td className="py-2 text-right text-gray-900">{formatNum(totals.clicks)}</td>
                  <td className="py-2 text-right text-purple-700">{formatPct(totals.ctr)}</td>
                  <td className="py-2 text-right text-indigo-700">{formatNum(totals.leads)}</td>
                  <td className="py-2 text-right text-gray-900">{totals.leads > 0 ? formatCurrency(totals.cpl) : "-"}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Leads de Veículos (Formulário) */}
        <div className="card-overlay rounded-xl shadow-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-900">Leads de Veículos · Por Veículo</h3>
            <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-1 rounded-full">
              {formatNum(totals.leads)} leads
            </span>
          </div>

          {/* Por plataforma */}
          <div className="space-y-2 mb-4">
            {metaLeadsByPlatform.map(([platform, count]) => {
              const pct = (count / totals.leads) * 100
              const label = platform === "ig" ? "Instagram" : platform === "fb" ? "Facebook" : platform
              return (
                <div key={platform}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-600 font-medium">{label}</span>
                    <span className="text-xs font-bold text-indigo-700">{count}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Mini gráfico de barras — leads por dia */}
          {leadsByDay.length > 0 && (
            <>
              <p className="text-xs text-gray-500 font-medium mb-2">Leads por dia (últimos 14 dias)</p>
              {/* Container de barras com altura fixa */}
              <div className="flex items-end gap-1" style={{ height: 64 }}>
                {leadsByDay.map(([day, count]) => (
                  <div
                    key={day}
                    className="flex-1 rounded-sm bg-gradient-to-t from-indigo-600 to-purple-400 transition-all cursor-default"
                    style={{ height: `${(count / maxLeadsDay) * 100}%`, minHeight: 3 }}
                    title={`${day}: ${count} leads`}
                  />
                ))}
              </div>
              {/* Labels de data separadas */}
              <div className="flex gap-1 mt-1">
                {leadsByDay.map(([day]) => (
                  <div key={day} className="flex-1 text-center">
                    <span className="text-[8px] text-gray-400">
                      {(() => { const [y, m, d] = day.split("-"); return `${d}/${m}/${y.slice(2)}` })()}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* RD Station — LP Summary */}
          <div className="mt-4 pt-3 border-t border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1">
                <h4 className="text-xs font-bold text-gray-700">LP Capital de Giro · RD Station</h4>
                <div className="relative group">
                  <HelpCircle className="w-3 h-3 text-gray-400 cursor-help" />
                  <div className="absolute bottom-full left-0 mb-2 w-60 bg-gray-900 text-white text-[10px] rounded-lg px-2.5 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 leading-relaxed">
                    “Conversões” conta os eventos de conversão da LP (um mesmo contato pode converter mais de uma vez), por isso difere do card “Leads” (contatos únicos) do RD Station.
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {lpLoading && (
                  <span className="flex items-center gap-1 text-[10px] text-purple-500">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    atualizando…
                  </span>
                )}
                {lpSummary && (
                  <span className="text-[10px] text-gray-400">
                    {lpSummary.period.start_date} → {lpSummary.period.end_date}
                  </span>
                )}
              </div>
            </div>
            {lpSummary ? (
              <>
                <div className={`grid grid-cols-3 gap-2 transition-opacity ${lpLoading ? "opacity-50" : ""}`}>
                  <div className="bg-purple-50 rounded-lg p-2 text-center">
                    <p className="text-lg font-bold text-purple-700">{lpUntracked ? "—" : formatNum(lpSummary.visits_count)}</p>
                    <p className="text-[10px] text-gray-500">Visitantes</p>
                  </div>
                  <div className="bg-indigo-50 rounded-lg p-2 text-center">
                    <p className="text-lg font-bold text-indigo-700">{formatNum(lpSummary.conversion_count)}</p>
                    <p className="text-[10px] text-gray-500">Conversões</p>
                  </div>
                  <div className="bg-emerald-50 rounded-lg p-2 text-center">
                    <p className="text-lg font-bold text-emerald-700">{lpUntracked || lpSummary.conversion_rate > 100 ? "—" : `${lpSummary.conversion_rate.toFixed(1)}%`}</p>
                    <p className="text-[10px] text-gray-500">Tx. Conversão</p>
                  </div>
                </div>
                {lpUntracked && (
                  <p className="text-[10px] text-gray-400 italic mt-2 leading-snug">
                    Sem visitas rastreadas no período
                  </p>
                )}
              </>
            ) : (
              <p className="text-xs text-gray-400">{lpLoading ? "Carregando dados da LP..." : "Sem dados da LP para o período."}</p>
            )}
          </div>
        </div>
      </div>


      {/* ── Evolução no tempo (redes sociais) ── */}
      {chartHasData && (
        <div className="card-overlay rounded-xl shadow-lg p-4">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
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
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all ${chartMetric === m ? "bg-purple-600 text-white shadow" : "bg-white text-gray-600 border border-gray-200 hover:border-purple-400"}`}>
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
                itemWidth: 96, itemHeight: 16, symbolSize: 10, symbolShape: "circle", itemTextColor: "#6b7280",
              }]}
            />
          </div>
        </div>
      )}

      {/* ── Criativos (Meta) ── */}
      {creatives.length > 0 && (
        <div className="card-overlay rounded-xl shadow-lg p-4">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-purple-500 to-indigo-600">
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
                    {c.veiculos.map((v) => (
                      <span key={v} className="text-[8px] px-1 py-0.5 rounded bg-purple-50 text-purple-600 font-medium">{v}</span>
                    ))}
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

      {/* ── Análise IA ── */}
      <div className="card-overlay rounded-xl shadow-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Análise de Performance</h3>
              <p className="text-[10px] text-gray-400">Gerado por IA com base nos dados da campanha</p>
            </div>
          </div>
          <button
            onClick={() => runAiAnalysis(true)}
            disabled={aiLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white text-xs font-medium rounded-lg transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${aiLoading ? "animate-spin" : ""}`} />
            {aiLoading ? "Analisando..." : aiAnalysis ? "Reanalisar" : "Analisar"}
          </button>
        </div>

        {!aiAnalysis && !aiLoading && !aiError && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Sparkles className="w-8 h-8 text-purple-200 mb-2" />
            <p className="text-sm text-gray-400">Clique em <strong>Analisar</strong> para gerar uma análise inteligente da campanha</p>
          </div>
        )}

        {aiLoading && (
          <div className="flex items-center justify-center py-8 gap-3">
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            <span className="text-sm text-gray-400 ml-1">Processando dados com IA...</span>
          </div>
        )}

        {aiError && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
            {aiError}
          </div>
        )}

        {aiAnalysis && !aiLoading && (
          <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-100 rounded-lg p-4">
            <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{aiAnalysis}</p>
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

          {/* KPIs AdServer */}
          <div className="grid grid-cols-4 gap-3 mb-4">
            <div className="bg-purple-50 rounded-lg p-3 text-center">
              <p className="text-lg font-bold text-purple-700">{formatNum(adServerTotals.impressions)}</p>
              <p className="text-[10px] text-gray-500">Impressões</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <p className="text-lg font-bold text-blue-700">{formatNum(adServerTotals.clicks)}</p>
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

          {/* Tabela por publisher */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200">
                  {(["publisher", "contratado", "impressions", "pacingPct", "clicks", "ctr", "va"] as const).map((col) => {
                    const isActive = sortCol === col
                    const label: Record<string, string> = {
                      publisher: "Publisher", impressions: "Entregue", pacingPct: "Pacing",
                      contratado: "Contratado", clicks: "Cliques", ctr: "CTR", va: "Viewability",
                    }
                    const isLeft = col === "publisher"
                    const isPacing = col === "pacingPct"
                    return (
                      <th
                        key={col}
                        onClick={() => toggleSort(col)}
                        className={`py-2 font-medium cursor-pointer select-none ${isLeft ? "text-left" : isPacing ? "pl-3" : "text-right"} ${isActive ? "text-purple-700" : "text-gray-500"}`}
                      >
                        <div className={`flex items-center gap-1 ${isLeft ? "" : isPacing ? "" : "justify-end"}`}>
                          {label[col]}
                          <ArrowUpDown className={`w-3 h-3 shrink-0 ${isActive ? "text-purple-700" : "text-gray-300"}`} />
                        </div>
                      </th>
                    )
                  })}
                  <th className="text-right py-2 text-gray-500 font-medium">Tipo</th>
                </tr>
              </thead>
              <tbody>
                {adServerSorted.map((p) => {
                  const isPush = p.name.toUpperCase().includes("ZAP")
                  return (
                    <tr
                      key={p.rowKey}
                      className={`border-b border-gray-50 hover:bg-gray-50 ${p.isSubrow ? "bg-gray-50/60" : ""}`}
                    >
                      {/* Publisher */}
                      <td className="py-2 font-semibold text-gray-800">
                        {p.isSubrow ? <span className="pl-4 text-gray-400 font-normal">↳</span> : p.name}
                      </td>

                      {/* Contratado */}
                      <td className="py-2 text-right text-gray-500 whitespace-nowrap">
                        {p.tipo === "CPM" && p.contrato ? (
                          formatNum(p.contrato.quantidade ?? 0)
                        ) : p.tipo === "CPC" && p.contrato ? (
                          <span>{formatNum(p.contrato.quantidade ?? 0)} cliques</span>
                        ) : p.tipo === "DIARIA" && p.contrato ? (
                          <div className="flex flex-col items-end gap-0.5">
                            <span>{p.diasValidos} / {p.metaDias} dias</span>
                            <span className="text-[10px] text-gray-400">desde {p.inicioPublisher}</span>
                          </div>
                        ) : "—"}
                      </td>

                      {/* Entregue */}
                      <td className="py-2 text-right text-purple-700 font-semibold">
                        {!p.isSubrow
                          ? formatNum(p.impressions)
                          : p.contrato?.tipo === "CPC"
                          ? formatNum(p.clicks)
                          : ""}
                      </td>

                      {/* Pacing */}
                      <td className="py-2 pl-3 w-36">
                        {p.contrato ? (
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{ width: `${p.pacingPct}%`, backgroundColor: pacingColor(p.pacingPct) }}
                              />
                            </div>
                            <span className="text-[10px] text-gray-500 w-8 text-right">{p.pacingPct.toFixed(0)}%</span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-gray-400">s/ contrato</span>
                        )}
                      </td>

                      {/* Cliques */}
                      <td className="py-2 text-right text-gray-700">
                        {!p.isSubrow ? formatNum(p.clicks) : ""}
                      </td>

                      {/* CTR */}
                      <td className="py-2 text-right text-indigo-600 font-semibold">
                        {!p.isSubrow ? (isPush ? "-" : `${p.ctr.toFixed(2)}%`) : ""}
                      </td>

                      {/* Viewability */}
                      <td className="py-2 text-right text-blue-600">
                        {!p.isSubrow ? `${p.va.toFixed(1)}%` : ""}
                      </td>

                      {/* Tipo */}
                      <td className="py-2 text-right">
                        {p.tipo ? (
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            p.tipo === "CPM"   ? "bg-indigo-100 text-indigo-700"
                            : p.tipo === "CPC" ? "bg-rose-100 text-rose-700"
                            : "bg-amber-100 text-amber-700"
                          }`}>
                            {p.tipo}
                          </span>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                    </tr>
                  )
                })}
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

          {/* KPIs */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-green-700">
                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(offlineData.totalInvestimento)}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">Investimento</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-amber-700">
                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(offlineData.totalExecucaoProjeto)}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">Investimento Projetos</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-blue-700">
                {new Intl.NumberFormat("pt-BR").format(offlineData.totalInsercoes)}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">Inserções</p>
            </div>
          </div>

          {/* Accordion Meio → Praça → Veículo */}
          <div className="space-y-2">
            {Object.entries(offlineData.meios).map(([meioNome, meio]) => (
              <div key={meioNome} className="border-2 border-gray-200 rounded-lg overflow-hidden">
                <div
                  className="flex items-center justify-between p-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => setExpandedMeios((prev) => ({ ...prev, [meioNome]: !prev[meioNome] }))}
                >
                  <div className="flex items-center gap-2">
                    {expandedMeios[meioNome]
                      ? <ChevronDown className="w-4 h-4 text-gray-500" />
                      : <ChevronRight className="w-4 h-4 text-gray-500" />
                    }
                    <span className="text-sm font-semibold text-gray-900">{meioNome}</span>
                    <span className="text-xs text-gray-400 bg-gray-200 px-2 py-0.5 rounded-full">
                      {Object.keys(meio.veiculos).length} veículos
                    </span>
                  </div>
                  <div className="flex gap-4 text-xs text-right">
                    <div>
                      <p className="text-gray-400">Inserções</p>
                      <p className="font-semibold text-gray-700">{new Intl.NumberFormat("pt-BR").format(meio.insercoes)}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Investimento</p>
                      <p className="font-semibold text-gray-700">
                        {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(meio.investimento)}
                      </p>
                    </div>
                    {meio.execucaoProjeto > 0 && (
                      <div>
                        <p className="text-amber-600">Projetos</p>
                        <p className="font-semibold text-amber-700">
                          {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(meio.execucaoProjeto)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {expandedMeios[meioNome] && (
                  <div className="p-3 space-y-1.5 bg-white">
                    {Object.entries(meio.veiculos).map(([veiculoNome, veiculo]) => {
                      const veiculoKey = `${meioNome}__${veiculoNome}`
                      return (
                        <div key={veiculoNome} className="border border-gray-100 rounded-md">
                          <div
                            className="flex items-center justify-between p-2 hover:bg-gray-50 cursor-pointer transition-colors"
                            onClick={() => setExpandedPracas((prev) => ({ ...prev, [veiculoKey]: !prev[veiculoKey] }))}
                          >
                            <div className="flex items-center gap-1.5">
                              {expandedPracas[veiculoKey]
                                ? <ChevronDown className="w-3 h-3 text-gray-400" />
                                : <ChevronRight className="w-3 h-3 text-gray-400" />
                              }
                              <span className="text-xs font-medium text-gray-800">{veiculoNome}</span>
                              <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                                {Object.keys(veiculo.pracas).length} praças
                              </span>
                            </div>
                            <div className="flex gap-3 text-[10px] text-right">
                              <div>
                                <span className="text-gray-400">Inserções: </span>
                                <span className="font-medium text-gray-700">{new Intl.NumberFormat("pt-BR").format(veiculo.insercoes)}</span>
                              </div>
                              <div>
                                <span className="text-gray-400">Invest.: </span>
                                <span className="font-medium text-gray-700">
                                  {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(veiculo.investimento)}
                                </span>
                              </div>
                              {veiculo.execucaoProjeto > 0 && (
                                <div>
                                  <span className="text-amber-600">Projetos: </span>
                                  <span className="font-medium text-amber-700">
                                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(veiculo.execucaoProjeto)}
                                  </span>
                                </div>
                              )}
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
                                    <th className="text-right py-1 text-amber-600 font-medium">Projetos</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {Object.entries(veiculo.pracas).map(([pracaNome, p]) => (
                                    <tr key={pracaNome} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                                      <td className="py-1 text-gray-700">{pracaNome}</td>
                                      <td className="py-1 text-right text-blue-600 font-semibold">{new Intl.NumberFormat("pt-BR").format(p.insercoes)}</td>
                                      <td className="py-1 text-right text-green-700 font-semibold">
                                        {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(p.investimento)}
                                      </td>
                                      <td className="py-1 text-right text-amber-700 font-semibold">
                                        {p.execucaoProjeto > 0
                                          ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(p.execucaoProjeto)
                                          : <span className="text-gray-300">—</span>}
                                      </td>
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
            <div className="flex items-start justify-between gap-3 p-4 border-b border-gray-100 sticky top-0 bg-white z-10">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-gradient-to-br from-purple-500 to-indigo-600">
                  <ImageIcon className="w-4 h-4 text-white" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-gray-900 truncate" title={activeCreative.name}>{activeCreative.name.replace(/_/g, " ")}</h3>
                  <p className="text-[11px] text-gray-400 truncate">{activeCreative.campanhas.join(" · ") || "Criativo"}</p>
                </div>
              </div>
              <button onClick={() => setSelectedCreative(null)} className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 shrink-0" aria-label="Fechar">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 grid gap-4 md:grid-cols-[220px_1fr]">
              <div>
                <CreativeThumb src={activeCreative.image} alt={activeCreative.name} />
                <div className="mt-2 flex flex-wrap gap-1">
                  {activeCreative.veiculos.map((v) => (
                    <span key={v} className="text-[9px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-600 font-medium">{v}</span>
                  ))}
                </div>
              </div>

              <div className="space-y-4 min-w-0">
                <div>
                  <p className="text-[11px] font-bold text-gray-700 mb-2">Resultados gerais</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-purple-50 rounded-lg p-2 text-center">
                      <p className="text-base font-bold text-purple-700">{formatCompact(activeCreative.impressions)}</p>
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
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold transition-all ${modalMetric === m ? "bg-purple-600 text-white shadow" : "bg-white text-gray-500 border border-gray-200 hover:border-purple-400"}`}>{modalMetricLabel[m]}</button>
                      ))}
                    </div>
                  </div>
                  {creativeDaily.length > 1 ? (
                    <div style={{ height: 220 }}>
                      <ResponsiveLine
                        data={modalLineData}
                        colors={["#7c3aed"]}
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
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "#7c3aed" }} />
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

export default CapitalDeGiro

"use client"

import type React from "react"
import { useRef, useState, useEffect, useMemo } from "react"
import { DollarSign, Users, MousePointerClick, Eye, Play, HelpCircle, Sparkles, RefreshCw, ArrowUpDown } from "lucide-react"
import axios from "axios"
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

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)

const formatNum = (v: number) =>
  new Intl.NumberFormat("pt-BR").format(Math.round(v))

const formatPct = (v: number) => `${(v * 100).toFixed(2)}%`

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

// ─── Página principal ─────────────────────────────────────────────────────────

const CapitalDeGiro: React.FC = () => {
  const contentRef = useRef<HTMLDivElement>(null)
  const [consolidado, setConsolidado] = useState<ConsolidadoRow[]>([])
  const [aiAnalysis, setAiAnalysis] = useState<string>("")
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  const [lpSummary, setLpSummary] = useState<LpSummary | null>(null)
  const [adServer, setAdServer] = useState<AdServerRow[]>([])
  const [adServer2, setAdServer2] = useState<AdServerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedVeiculo, setSelectedVeiculo] = useState<string | null>(null)
  type SortCol = "publisher" | "contratado" | "impressions" | "pacingPct" | "clicks" | "ctr" | "va"
  const [sortCol, setSortCol] = useState<SortCol>("impressions")
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc")

  const toggleSort = (col: SortCol) => {
    if (sortCol === col) setSortDir((d) => (d === "desc" ? "asc" : "desc"))
    else { setSortCol(col); setSortDir("desc") }
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const [consRes, lpSummaryRes, adServerRes, adServer2Res] = await Promise.all([
          axios.get(
            "https://nmbcoamazonia-api.vercel.app/google/sheets/1ZPKSZQTwylGl3MQHVA-Ee_htmjAPO0QEEYep1Rk_J1o/data?range=Consolidado"
          ),
          axios.get("https://nmbcoamazonia-api.vercel.app/rdstation/lp-summary").catch(() => ({ data: { success: false } })),
          axios.get("https://dashbrasiladserver.com.br/api/templates/274/bi?token=VxSzRmqc2M").catch(() => ({ data: [] })),
          axios.get("https://dashbrasiladserver.com.br/api/templates/279/bi?token=QY9jKtmfzD").catch(() => ({ data: [] })),
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
              campanha: r[idx("Campanha")] || "",
            }))
          setConsolidado(parsed)
        }

        // LP Summary (visitantes + conversões RD Station)
        if (lpSummaryRes.data?.success && lpSummaryRes.data?.data) {
          setLpSummary(lpSummaryRes.data.data)
        }

        // AdServer
        if (Array.isArray(adServerRes.data) && adServerRes.data.length > 0) {
          setAdServer(adServerRes.data)
        }
        if (Array.isArray(adServer2Res.data) && adServer2Res.data.length > 0) {
          setAdServer2(adServer2Res.data)
        }



      } catch (err) {
        console.error("Erro ao buscar dados Capital de Giro:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  // ─── Métricas agregadas ──────────────────────────────────────────────────────

  const filtered = useMemo(
    () => (selectedVeiculo ? consolidado.filter((r) => r.veiculo === selectedVeiculo) : consolidado),
    [consolidado, selectedVeiculo]
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

  // Leads de Meta por plataforma (veículo) — derivado do consolidado
  const metaLeadsByPlatform = useMemo(() => {
    const map = new Map<string, number>()
    consolidado.forEach((r) => {
      if (r.leads > 0) map.set(r.veiculo || "Desconhecido", (map.get(r.veiculo || "Desconhecido") || 0) + r.leads)
    })
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1])
  }, [consolidado])

  // Veículos únicos
  const veiculos = useMemo(
    () => Array.from(new Set(consolidado.map((r) => r.veiculo).filter(Boolean))),
    [consolidado]
  )

  // Por veículo
  const byVeiculo = useMemo(() => {
    const map = new Map<string, typeof totals>()
    veiculos.forEach((v) => {
      const rows = consolidado.filter((r) => r.veiculo === v)
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
  }, [consolidado, veiculos])

  // Leads por dia — derivado do consolidado
  const leadsByDay = useMemo(() => {
    const map = new Map<string, number>()
    consolidado.forEach((r) => {
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
  }, [consolidado])

  const maxLeadsDay = useMemo(() => Math.max(...leadsByDay.map((d) => d[1]), 1), [leadsByDay])

  // AdServer — combinar as duas fontes
  const allAdServer = useMemo(() => [...adServer, ...adServer2], [adServer, adServer2])

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



  const DATA_KEY = "capital-de-giro"

  const buildAnalysisPayload = () => {
    const byVeiculoArr = veiculos.map((v) => {
      const t = byVeiculo.get(v)!
      return { name: v, impressions: t.impressions, clicks: t.clicks, leads: t.leads, cost: t.cost, ctr: t.ctr, cpl: t.cpl }
    })
    return { totals, adServerTotals, metaLeadsTotal: totals.leads, lpSummary, byVeiculo: byVeiculoArr, adServerByPublisher }
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
    if (!loading && consolidado.length > 0 && !aiAnalysis && !aiLoading) {
      runAiAnalysis()
    }
  }, [loading]) // dispara uma vez quando loading muda para false

  if (loading) return <Loading message="Carregando dados da campanha..." />

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
                <p className="text-purple-200 text-xs">Leads Meta</p>
                <p className="text-2xl font-bold text-white">{formatNum(totals.leads)}</p>
              </div>
              <div>
                <p className="text-purple-200 text-xs">Visitantes LP</p>
                <p className="text-2xl font-bold text-white">
                  {lpSummary ? formatNum(lpSummary.visits_count) : "—"}
                </p>
              </div>
              <div>
                <p className="text-purple-200 text-xs">Leads LP</p>
                <p className="text-2xl font-bold text-white">
                  {lpSummary ? formatNum(lpSummary.conversion_count) : "—"}
                </p>
                {lpSummary && (
                  <p className="text-purple-200 text-xs">{lpSummary.conversion_rate.toFixed(1)}% tx. conv.</p>
                )}
              </div>
            </div>
          </div>
        </div>
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
        const totalLeads = totals.leads + (lpSummary?.conversion_count ?? 0)
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
              tooltip="Total de leads captados: soma dos leads dos anúncios (formulários Meta/LinkedIn) com os leads da Landing Page (RD Station). CPL = Custo por Lead. Média de mercado: R$ 50 a R$ 420 — varia conforme canal, formulário, produto financeiro e nível de qualificação do lead."
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

        {/* Leads Meta (Formulário) */}
        <div className="card-overlay rounded-xl shadow-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-900">Leads Meta · Por Veículo</h3>
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
              <h4 className="text-xs font-bold text-gray-700">LP Capital de Giro · RD Station</h4>
              {lpSummary && (
                <span className="text-[10px] text-gray-400">
                  {lpSummary.period.start_date} → {lpSummary.period.end_date}
                </span>
              )}
            </div>
            {lpSummary ? (
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-purple-50 rounded-lg p-2 text-center">
                  <p className="text-lg font-bold text-purple-700">{formatNum(lpSummary.visits_count)}</p>
                  <p className="text-[10px] text-gray-500">Visitantes</p>
                </div>
                <div className="bg-indigo-50 rounded-lg p-2 text-center">
                  <p className="text-lg font-bold text-indigo-700">{formatNum(lpSummary.conversion_count)}</p>
                  <p className="text-[10px] text-gray-500">Leads</p>
                </div>
                <div className="bg-emerald-50 rounded-lg p-2 text-center">
                  <p className="text-lg font-bold text-emerald-700">{lpSummary.conversion_rate.toFixed(1)}%</p>
                  <p className="text-[10px] text-gray-500">Tx. Conversão</p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-400">Carregando dados da LP...</p>
            )}
          </div>
        </div>
      </div>


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

    </div>
  )
}

export default CapitalDeGiro

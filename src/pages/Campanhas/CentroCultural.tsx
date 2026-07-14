"use client"

import type React from "react"
import { useRef, useState, useEffect, useMemo, useCallback } from "react"
import { ResponsiveLine } from "@nivo/line"
import {
  DollarSign,
  Eye,
  Users,
  MousePointerClick,
  Play,
  Heart,
  Calendar,
  X,
  HelpCircle,
  Film,
  ImageIcon,
  Search,
  Landmark,
  Flag,
  Receipt,
} from "lucide-react"
import axios from "axios"
import Loading from "../../components/Loading/Loading"
import PDFDownloadButton from "../../components/PDFDownloadButton/PDFDownloadButton"

const SHEET_URL =
  "https://nmbcoamazonia-api.vercel.app/google/sheets/1R1ehp35FAxdP1vhI1rT-mIYw3h9fuatHMiS__5V6Yok/data?range=consolidado"

// Só a campanha CCBA (Centro Cultural Banco da Amazônia)
const CAMPANHA = "CCBA"

// O "Total spent" da planilha é o investimento LÍQUIDO.
// O BRUTO é composto: aplica 13,83% (imposto) sobre o líquido e, sobre esse
// subtotal, mais 10% (comissão). Fator = 1,1383 × 1,10 = 1,25213.
const IMPOSTO_PCT = 0.1383
const COMISSAO_PCT = 0.1

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Row {
  date: string // ISO (YYYY-MM-DD)
  campaignName: string
  creativeTitle: string
  spent: number
  impressions: number
  clicks: number
  reach: number
  videoViews: number
  videoCompletions: number
  engagements: number
  veiculo: string
  formato: string // video | estatico | audio
}

type Metric = "impressions" | "spent" | "reach" | "clicks" | "engagements"
type Gran = "dia" | "semana" | "mes"
type CreativeSort = "impressions" | "spent" | "clicks" | "ctr" | "engagements"

// ─── Helpers ──────────────────────────────────────────────────────────────────

// "R$ 1.234,56" → 1234.56
const parseNumber = (v: unknown): number => {
  if (v === null || v === undefined || v === "") return 0
  const s = String(v).replace(/R\$\s*/g, "").replace(/\./g, "").replace(",", ".").trim()
  const n = Number.parseFloat(s)
  return isNaN(n) ? 0 : n
}

// "21.360" → 21360
const parseInteger = (v: unknown): number => {
  if (v === null || v === undefined || v === "") return 0
  const s = String(v).replace(/\./g, "").replace(/\s/g, "").trim()
  const n = Number.parseInt(s, 10)
  return isNaN(n) ? 0 : n
}

// "11/10/2025" → "2025-10-11"
const parseDate = (v: string): string => {
  if (!v) return ""
  if (v.includes("/")) {
    const [d, m, y] = v.split("/")
    if (!d || !m || !y) return ""
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`
  }
  return v.slice(0, 10)
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)
const formatNum = (v: number) => new Intl.NumberFormat("pt-BR").format(Math.round(v))
// Compacta números grandes no eixo do gráfico (21.360.538 → 21,4M)
const formatCompact = (v: number): string => {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(".", ",")}M`
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(0)}k`
  return String(Math.round(v))
}
const brDate = (iso: string) => {
  if (!iso) return "—"
  const [y, m, d] = iso.split("-")
  return `${d}/${m}/${y}`
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]

// Segunda-feira da semana de uma data ISO
const startOfWeek = (iso: string): string => {
  const d = new Date(`${iso}T00:00:00`)
  const day = d.getDay() // 0 = domingo
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  return d.toISOString().slice(0, 10)
}

const periodKey = (iso: string, gran: Gran): string =>
  gran === "dia" ? iso : gran === "semana" ? startOfWeek(iso) : iso.slice(0, 7)

const periodLabel = (key: string, gran: Gran): string => {
  if (gran === "mes") {
    const [y, m] = key.split("-")
    return `${MESES[Number(m) - 1]}/${y.slice(2)}`
  }
  const [, m, d] = key.split("-")
  return `${d}/${m}`
}

// Paleta por veículo (com fallback para veículos novos)
const VEICULO_COLORS: Record<string, string> = {
  Instagram: "#E4405F",
  Facebook: "#1877F2",
  "LinkedIn Ads": "#0A66C2",
  LinkedIn: "#0A66C2",
  Meta: "#0668E1",
  "Não informado": "#9CA3AF",
}
const FALLBACK_COLORS = ["#F59E0B", "#8B5CF6", "#10B981", "#EF4444", "#06B6D4", "#EC4899"]
const colorFor = (veiculo: string, i: number) => VEICULO_COLORS[veiculo] ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length]

const METRIC_LABEL: Record<Metric, string> = {
  impressions: "Impressões",
  spent: "Investimento",
  reach: "Alcance",
  clicks: "Cliques",
  engagements: "Engajamentos",
}

// ─── KPI ──────────────────────────────────────────────────────────────────────

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

// ─── Página ───────────────────────────────────────────────────────────────────

const CentroCultural: React.FC = () => {
  const contentRef = useRef<HTMLDivElement>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: "", end: "" })
  const [selectedVeiculo, setSelectedVeiculo] = useState<string | null>(null)

  const [metric, setMetric] = useState<Metric>("impressions")
  const [gran, setGran] = useState<Gran>("semana")

  const [creativeSort, setCreativeSort] = useState<CreativeSort>("impressions")
  const [search, setSearch] = useState("")
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const res = await axios.get(SHEET_URL)
        if (!res.data?.success || !res.data?.data?.values) return

        const values: string[][] = res.data.data.values
        const header = values[0]
        const idx = (c: string) => header.indexOf(c)
        const iDate = idx("Date")
        const iCampanha = idx("Campanha")

        const parsed: Row[] = values
          .slice(1)
          // Só a campanha CCBA
          .filter((r) => (r[iCampanha] ?? "").trim().toUpperCase() === CAMPANHA)
          .map((r) => ({
            date: parseDate(r[iDate] ?? ""),
            campaignName: r[idx("Campaign name")] ?? "",
            creativeTitle: (r[idx("Creative title")] ?? "").trim(),
            spent: parseNumber(r[idx("Total spent")]),
            impressions: parseInteger(r[idx("Impressions")]),
            clicks: parseInteger(r[idx("Clicks")]),
            reach: parseInteger(r[idx("Reach")]),
            videoViews: parseInteger(r[idx("Video views")]),
            videoCompletions: parseInteger(r[idx("Video completions")]),
            engagements: parseInteger(r[idx("Total engagements")]),
            // Fallback só como rede de segurança: a planilha é a fonte da verdade
            veiculo: (r[idx("Veículo")] ?? "").trim() || "Não informado",
            formato: (r[idx("video_estatico_audio")] ?? "").trim().toLowerCase(),
          }))
          .filter((r) => r.date !== "")

        setRows(parsed)
      } catch (err) {
        console.error("Erro ao buscar dados do Centro Cultural (CCBA):", err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  // ─── Filtros ────────────────────────────────────────────────────────────────
  const inDateRange = useCallback(
    (iso: string) => {
      if (!dateRange.start && !dateRange.end) return true
      if (!iso) return false
      if (dateRange.start && iso < dateRange.start) return false
      if (dateRange.end && iso > dateRange.end) return false
      return true
    },
    [dateRange]
  )

  const porData = useMemo(() => rows.filter((r) => inDateRange(r.date)), [rows, inDateRange])

  const veiculos = useMemo(
    () => Array.from(new Set(porData.map((r) => r.veiculo))).sort(),
    [porData]
  )

  const filtered = useMemo(
    () => (selectedVeiculo ? porData.filter((r) => r.veiculo === selectedVeiculo) : porData),
    [porData, selectedVeiculo]
  )

  // ─── Big numbers ────────────────────────────────────────────────────────────
  const totals = useMemo(() => {
    const t = filtered.reduce(
      (a, r) => ({
        spent: a.spent + r.spent,
        impressions: a.impressions + r.impressions,
        clicks: a.clicks + r.clicks,
        reach: a.reach + r.reach,
        videoViews: a.videoViews + r.videoViews,
        videoCompletions: a.videoCompletions + r.videoCompletions,
        engagements: a.engagements + r.engagements,
      }),
      { spent: 0, impressions: 0, clicks: 0, reach: 0, videoViews: 0, videoCompletions: 0, engagements: 0 }
    )
    return {
      ...t,
      // Bruto = líquido × 1,1383 (imposto) × 1,10 (comissão)
      spentBruto: t.spent * (1 + IMPOSTO_PCT) * (1 + COMISSAO_PCT),
      ctr: t.impressions > 0 ? (t.clicks / t.impressions) * 100 : 0,
      cpm: t.impressions > 0 ? (t.spent / t.impressions) * 1000 : 0,
      cpc: t.clicks > 0 ? t.spent / t.clicks : 0,
      vtr: t.videoViews > 0 ? (t.videoCompletions / t.videoViews) * 100 : 0,
      engRate: t.impressions > 0 ? (t.engagements / t.impressions) * 100 : 0,
      frequencia: t.reach > 0 ? t.impressions / t.reach : 0,
    }
  }, [filtered])

  // ─── Início de cada veículo (para a linha do tempo) ─────────────────────────
  const veiculoInfo = useMemo(() => {
    const map = new Map<string, { inicio: string; fim: string; impressions: number; spent: number }>()
    porData.forEach((r) => {
      const cur = map.get(r.veiculo) ?? { inicio: r.date, fim: r.date, impressions: 0, spent: 0 }
      if (r.date < cur.inicio) cur.inicio = r.date
      if (r.date > cur.fim) cur.fim = r.date
      cur.impressions += r.impressions
      cur.spent += r.spent
      map.set(r.veiculo, cur)
    })
    return Array.from(map.entries())
      .map(([veiculo, v]) => ({ veiculo, ...v }))
      .sort((a, b) => a.inicio.localeCompare(b.inicio))
  }, [porData])

  // ─── Série temporal por veículo ─────────────────────────────────────────────
  const chartData = useMemo(() => {
    // valor por veículo × período
    const byVeiculoPeriodo = new Map<string, Map<string, number>>()
    const allPeriods = new Set<string>()

    porData.forEach((r) => {
      const p = periodKey(r.date, gran)
      allPeriods.add(p)
      const m = byVeiculoPeriodo.get(r.veiculo) ?? new Map<string, number>()
      m.set(p, (m.get(p) ?? 0) + r[metric])
      byVeiculoPeriodo.set(r.veiculo, m)
    })

    const periods = Array.from(allPeriods).sort()

    return Array.from(byVeiculoPeriodo.entries())
      // ordena pela data de início → a legenda segue a ordem de entrada dos veículos
      .sort((a, b) => {
        const ai = Math.min(...Array.from(a[1].keys()).map((k) => periods.indexOf(k)))
        const bi = Math.min(...Array.from(b[1].keys()).map((k) => periods.indexOf(k)))
        return ai - bi
      })
      .map(([veiculo, m], i) => {
        const own = Array.from(m.keys()).sort()
        const first = own[0]
        const last = own[own.length - 1]
        // Do início ao fim do veículo: períodos sem dado viram 0 (mostra pausas)
        const data = periods
          .filter((p) => p >= first && p <= last)
          .map((p) => ({ x: periodLabel(p, gran), y: m.get(p) ?? 0 }))
        return { id: veiculo, color: colorFor(veiculo, i), data }
      })
  }, [porData, gran, metric])

  const chartColors = useMemo(() => chartData.map((s) => s.color), [chartData])

  // ─── Criativos ──────────────────────────────────────────────────────────────
  const criativos = useMemo(() => {
    const map = new Map<
      string,
      {
        title: string
        veiculos: Set<string>
        formato: string
        spent: number
        impressions: number
        clicks: number
        reach: number
        videoViews: number
        engagements: number
      }
    >()

    filtered.forEach((r) => {
      const key = r.creativeTitle || "(sem título)"
      const cur =
        map.get(key) ?? {
          title: key,
          veiculos: new Set<string>(),
          formato: r.formato,
          spent: 0,
          impressions: 0,
          clicks: 0,
          reach: 0,
          videoViews: 0,
          engagements: 0,
        }
      cur.veiculos.add(r.veiculo)
      if (!cur.formato && r.formato) cur.formato = r.formato
      cur.spent += r.spent
      cur.impressions += r.impressions
      cur.clicks += r.clicks
      cur.reach += r.reach
      cur.videoViews += r.videoViews
      cur.engagements += r.engagements
      map.set(key, cur)
    })

    const arr = Array.from(map.values()).map((c) => ({
      ...c,
      ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0,
      engRate: c.impressions > 0 ? (c.engagements / c.impressions) * 100 : 0,
    }))

    const q = search.trim().toLowerCase()
    const searched = q ? arr.filter((c) => c.title.toLowerCase().includes(q)) : arr

    return searched.sort((a, b) => b[creativeSort] - a[creativeSort])
  }, [filtered, creativeSort, search])

  const maxCriativoImpr = useMemo(
    () => Math.max(...criativos.map((c) => c.impressions), 1),
    [criativos]
  )

  const criativosVisiveis = showAll ? criativos : criativos.slice(0, 9)

  if (loading) return <Loading message="Carregando dados do Centro Cultural..." />

  const periodoLabel =
    porData.length > 0
      ? `${brDate(porData.reduce((a, r) => (r.date < a ? r.date : a), porData[0].date))} → ${brDate(
          porData.reduce((a, r) => (r.date > a ? r.date : a), porData[0].date)
        )}`
      : "—"

  return (
    <div ref={contentRef} className="h-full flex flex-col space-y-3 overflow-auto">
      {/* ── Hero ── */}
      <div className="relative overflow-hidden rounded-2xl shadow-2xl h-36">
        <div className="relative h-full bg-gradient-to-r from-amber-700 via-orange-600 to-rose-600">
          <img
            src="/images/fundo_card.webp"
            alt="Centro Cultural Banco da Amazônia"
            className="w-full h-full object-cover mix-blend-overlay opacity-30"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-amber-900/60 to-rose-800/40" />
          <div className="absolute top-3 right-3 z-10">
            <PDFDownloadButton contentRef={contentRef} fileName="centro-cultural" />
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-4 flex items-end justify-between">
            <div>
              <p className="text-amber-100 text-xs font-medium mb-1 uppercase tracking-wider">Campanhas · CCBA</p>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <Landmark className="w-6 h-6" /> Centro Cultural Banco da Amazônia
              </h1>
              <p className="text-amber-100 text-sm">{periodoLabel}</p>
            </div>
            <div className="text-right flex gap-4">
              <div>
                <p className="text-amber-100 text-xs">Invest. Bruto</p>
                <p className="text-2xl font-bold text-white">{formatCurrency(totals.spentBruto)}</p>
                <p className="text-amber-100 text-[10px]">líquido {formatCurrency(totals.spent)}</p>
              </div>
              <div>
                <p className="text-amber-100 text-xs">Alcance</p>
                <p className="text-2xl font-bold text-white">{formatNum(totals.reach)}</p>
              </div>
              <div>
                <p className="text-amber-100 text-xs">Criativos</p>
                <p className="text-2xl font-bold text-white">{criativos.length}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Filtro de período ── */}
      <div className="card-overlay rounded-xl shadow-lg p-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-gray-700">
          <Calendar className="w-4 h-4 text-amber-600" />
          <span className="text-sm font-semibold">Período</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dateRange.start}
            max={dateRange.end || undefined}
            onChange={(e) => setDateRange((p) => ({ ...p, start: e.target.value }))}
            className="px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
          />
          <span className="text-gray-500 text-sm">até</span>
          <input
            type="date"
            value={dateRange.end}
            min={dateRange.start || undefined}
            onChange={(e) => setDateRange((p) => ({ ...p, end: e.target.value }))}
            className="px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
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
          {formatNum(filtered.length)} registros · campanha “{CAMPANHA}”
        </span>
      </div>

      {/* ── Filtro de veículo ── */}
      {veiculos.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setSelectedVeiculo(null)}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
              !selectedVeiculo
                ? "bg-amber-600 text-white shadow"
                : "bg-white text-gray-600 border border-gray-200 hover:border-amber-400"
            }`}
          >
            Todos
          </button>
          {veiculos.map((v) => (
            <button
              key={v}
              onClick={() => setSelectedVeiculo(selectedVeiculo === v ? null : v)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                selectedVeiculo === v
                  ? "bg-amber-600 text-white shadow"
                  : "bg-white text-gray-600 border border-gray-200 hover:border-amber-400"
              }`}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: VEICULO_COLORS[v] ?? "#9CA3AF" }}
              />
              {v}
            </button>
          ))}
        </div>
      )}

      {/* ── Big numbers ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        <KpiCard
          label="Investimento Bruto"
          value={formatCurrency(totals.spentBruto)}
          sub="Líquido +13,83% +10% com."
          icon={<Receipt className="w-4 h-4 text-white" />}
          color="bg-amber-600"
          tooltip="Investimento bruto: sobre o líquido aplica-se 13,83% (imposto) e, sobre esse subtotal, mais 10% (comissão). Fator 1,2521."
        />
        <KpiCard
          label="Investimento Líquido"
          value={formatCurrency(totals.spent)}
          sub={`CPM: ${formatCurrency(totals.cpm)}`}
          icon={<DollarSign className="w-4 h-4 text-white" />}
          color="bg-amber-500"
          tooltip="Investimento em mídia paga sem imposto (valor da planilha). É a base de cálculo do CPM e do CPC."
        />
        <KpiCard
          label="Impressões"
          value={formatNum(totals.impressions)}
          sub={`Freq.: ${totals.frequencia.toFixed(1)}x`}
          icon={<Eye className="w-4 h-4 text-white" />}
          color="bg-orange-500"
          tooltip="Número de vezes que os anúncios foram exibidos. Frequência = impressões ÷ alcance (quantas vezes, em média, cada pessoa viu)."
        />
        <KpiCard
          label="Alcance"
          value={formatNum(totals.reach)}
          sub="Pessoas únicas"
          icon={<Users className="w-4 h-4 text-white" />}
          color="bg-rose-500"
          tooltip="Número de pessoas únicas alcançadas pela campanha."
        />
        <KpiCard
          label="Cliques"
          value={formatNum(totals.clicks)}
          sub={`CTR: ${totals.ctr.toFixed(2)}% · CPC: ${formatCurrency(totals.cpc)}`}
          icon={<MousePointerClick className="w-4 h-4 text-white" />}
          color="bg-cyan-500"
          tooltip="Total de cliques. CTR = cliques ÷ impressões. CPC = custo por clique."
        />
        <KpiCard
          label="Visualizações"
          value={formatNum(totals.videoViews)}
          sub={`VTR: ${totals.vtr.toFixed(1)}%`}
          icon={<Play className="w-4 h-4 text-white" />}
          color="bg-violet-500"
          tooltip="Vídeos iniciados. VTR = visualizações completas ÷ visualizações iniciadas."
        />
        <KpiCard
          label="Engajamentos"
          value={formatNum(totals.engagements)}
          sub={`Taxa: ${totals.engRate.toFixed(2)}%`}
          icon={<Heart className="w-4 h-4 text-white" />}
          color="bg-pink-500"
          tooltip="Interações com os anúncios (curtidas, comentários, compartilhamentos, salvamentos). Taxa = engajamentos ÷ impressões."
        />
      </div>

      {/* ── Linha do tempo por veículo ── */}
      <div className="card-overlay rounded-xl shadow-lg p-4">
        <div className="flex items-start justify-between mb-3 flex-wrap gap-3">
          <div>
            <h3 className="text-sm font-bold text-gray-900">Linha do Tempo · Entrada de cada Veículo</h3>
            <p className="text-[10px] text-gray-400">
              Cada linha começa quando o veículo entrou na campanha
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {/* Métrica */}
            <select
              value={metric}
              onChange={(e) => setMetric(e.target.value as Metric)}
              className="px-3 py-1.5 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              {(Object.keys(METRIC_LABEL) as Metric[]).map((m) => (
                <option key={m} value={m}>
                  {METRIC_LABEL[m]}
                </option>
              ))}
            </select>
            {/* Granularidade */}
            <div className="flex rounded-md overflow-hidden border border-gray-300">
              {(["dia", "semana", "mes"] as Gran[]).map((g) => (
                <button
                  key={g}
                  onClick={() => setGran(g)}
                  className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                    gran === g ? "bg-amber-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {g === "dia" ? "Dia" : g === "semana" ? "Semana" : "Mês"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Badges de início de cada veículo */}
        <div className="flex gap-2 flex-wrap mb-3">
          {veiculoInfo.map((v) => (
            <div
              key={v.veiculo}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-50 border border-gray-100"
            >
              <Flag className="w-3 h-3" style={{ color: VEICULO_COLORS[v.veiculo] ?? "#9CA3AF" }} />
              <span className="text-[11px] font-semibold text-gray-700">{v.veiculo}</span>
              <span className="text-[10px] text-gray-400">início {brDate(v.inicio)}</span>
            </div>
          ))}
        </div>

        {chartData.length > 0 ? (
          <div style={{ height: 340 }}>
            <ResponsiveLine
              data={chartData}
              colors={chartColors}
              margin={{ top: 20, right: 24, bottom: 70, left: 64 }}
              xScale={{ type: "point" }}
              yScale={{ type: "linear", min: 0, max: "auto" }}
              curve="monotoneX"
              axisTop={null}
              axisRight={null}
              axisBottom={{
                tickSize: 5,
                tickPadding: 8,
                tickRotation: -45,
                // Evita eixo poluído: mostra no máx. ~14 rótulos
                tickValues: (() => {
                  const xs = Array.from(new Set(chartData.flatMap((s) => s.data.map((d) => String(d.x)))))
                  const step = Math.max(1, Math.ceil(xs.length / 14))
                  return xs.filter((_, i) => i % step === 0)
                })(),
              }}
              axisLeft={{
                tickSize: 5,
                tickPadding: 8,
                format: (v) => (metric === "spent" ? `R$ ${formatCompact(Number(v))}` : formatCompact(Number(v))),
              }}
              enableGridX={false}
              pointSize={4}
              pointBorderWidth={1}
              pointBorderColor={{ from: "seriesColor" }}
              pointColor={{ theme: "background" }}
              useMesh
              enableSlices="x"
              sliceTooltip={({ slice }) => (
                <div className="bg-white rounded-lg shadow-xl border border-gray-100 px-3 py-2">
                  <p className="text-[11px] font-bold text-gray-900 mb-1">{String(slice.points[0]?.data.x)}</p>
                  {slice.points.map((p) => (
                    <div key={p.id} className="flex items-center gap-2 text-[11px]">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.seriesColor }} />
                      <span className="text-gray-600">{String(p.seriesId)}:</span>
                      <span className="font-semibold text-gray-900">
                        {metric === "spent"
                          ? formatCurrency(Number(p.data.y))
                          : formatNum(Number(p.data.y))}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              legends={[
                {
                  anchor: "bottom",
                  direction: "row",
                  translateY: 64,
                  itemsSpacing: 12,
                  itemWidth: 110,
                  itemHeight: 16,
                  symbolSize: 10,
                  symbolShape: "circle",
                  itemTextColor: "#6b7280",
                },
              ]}
              theme={{
                axis: { ticks: { text: { fontSize: 10, fill: "#9ca3af" } } },
                grid: { line: { stroke: "#f3f4f6" } },
                legends: { text: { fontSize: 11 } },
              }}
            />
          </div>
        ) : (
          <p className="text-xs text-gray-400 text-center py-10">Sem dados para o período selecionado.</p>
        )}
      </div>

      {/* ── Criativos ── */}
      <div className="card-overlay rounded-xl shadow-lg p-4">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <h3 className="text-sm font-bold text-gray-900">
              Criativos <span className="text-gray-400 font-medium">· {criativos.length}</span>
            </h3>
            <p className="text-[10px] text-gray-400">Performance por peça criativa</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar criativo..."
                className="pl-8 pr-3 py-1.5 border border-gray-300 rounded-md text-xs w-48 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <select
              value={creativeSort}
              onChange={(e) => setCreativeSort(e.target.value as CreativeSort)}
              className="px-3 py-1.5 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="impressions">Ordenar: Impressões</option>
              <option value="spent">Ordenar: Investimento</option>
              <option value="clicks">Ordenar: Cliques</option>
              <option value="ctr">Ordenar: CTR</option>
              <option value="engagements">Ordenar: Engajamentos</option>
            </select>
          </div>
        </div>

        {criativos.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-10">Nenhum criativo encontrado.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {criativosVisiveis.map((c) => {
                const isVideo = c.formato === "video"
                return (
                  <div
                    key={c.title}
                    className="border border-gray-100 rounded-xl p-3 hover:shadow-md hover:border-amber-200 transition-all bg-white flex flex-col gap-2.5"
                  >
                    {/* Cabeçalho: tipo + título */}
                    <div className="flex items-start gap-2">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          isVideo ? "bg-violet-100" : "bg-amber-100"
                        }`}
                      >
                        {isVideo ? (
                          <Film className="w-4 h-4 text-violet-600" />
                        ) : (
                          <ImageIcon className="w-4 h-4 text-amber-600" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p
                          className="text-xs font-bold text-gray-900 leading-snug line-clamp-2"
                          title={c.title}
                        >
                          {c.title}
                        </p>
                        <div className="flex items-center gap-1 mt-1 flex-wrap">
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              isVideo ? "bg-violet-100 text-violet-700" : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {isVideo ? "VÍDEO" : c.formato ? c.formato.toUpperCase() : "ESTÁTICO"}
                          </span>
                          {Array.from(c.veiculos).map((v) => (
                            <span
                              key={v}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-gray-100 text-gray-600"
                            >
                              <span
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ backgroundColor: VEICULO_COLORS[v] ?? "#9CA3AF" }}
                              />
                              {v}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Barra de participação nas impressões */}
                    <div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-amber-500 to-rose-500"
                          style={{ width: `${(c.impressions / maxCriativoImpr) * 100}%` }}
                        />
                      </div>
                    </div>

                    {/* Métricas */}
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-[13px] font-bold text-gray-900">{formatNum(c.impressions)}</p>
                        <p className="text-[9px] text-gray-400">Impressões</p>
                      </div>
                      <div>
                        <p className="text-[13px] font-bold text-cyan-700">{formatNum(c.clicks)}</p>
                        <p className="text-[9px] text-gray-400">Cliques</p>
                      </div>
                      <div>
                        <p className="text-[13px] font-bold text-indigo-700">{c.ctr.toFixed(2)}%</p>
                        <p className="text-[9px] text-gray-400">CTR</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t border-gray-50">
                      <div>
                        <p className="text-[13px] font-bold text-amber-700">{formatCurrency(c.spent)}</p>
                        <p className="text-[9px] text-gray-400">Investimento</p>
                      </div>
                      <div>
                        <p className="text-[13px] font-bold text-pink-700">{formatNum(c.engagements)}</p>
                        <p className="text-[9px] text-gray-400">Engajam.</p>
                      </div>
                      <div>
                        <p className="text-[13px] font-bold text-violet-700">{formatNum(c.videoViews)}</p>
                        <p className="text-[9px] text-gray-400">Views</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {criativos.length > 9 && (
              <div className="flex justify-center mt-4">
                <button
                  onClick={() => setShowAll((s) => !s)}
                  className="px-4 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors"
                >
                  {showAll ? "Mostrar menos" : `Mostrar todos os ${criativos.length} criativos`}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default CentroCultural

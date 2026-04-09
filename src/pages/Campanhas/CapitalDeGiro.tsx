"use client"

import type React from "react"
import { useRef, useState, useEffect, useMemo } from "react"
import { DollarSign, Users, MousePointerClick, Eye, Play } from "lucide-react"
import axios from "axios"
import Loading from "../../components/Loading/Loading"
import PDFDownloadButton from "../../components/PDFDownloadButton/PDFDownloadButton"

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

// Leads de Meta (via Sheets - formulário em tempo real)
interface MetaLeadRow {
  id: string
  createdTime: string
  adName: string
  adsetName: string
  campaignName: string
  platform: string
  fullName: string
  phone: string
  email: string
  leadStatus: string
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
}

const KpiCard: React.FC<KpiCardProps> = ({ label, value, sub, icon, color }) => (
  <div className="card-overlay rounded-xl shadow-lg p-4 flex flex-col gap-2">
    <div className="flex items-center justify-between">
      <p className="text-xs text-gray-500 font-medium">{label}</p>
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
  const [metaLeads, setMetaLeads] = useState<MetaLeadRow[]>([])
  const [lpSummary, setLpSummary] = useState<LpSummary | null>(null)
  const [adServer, setAdServer] = useState<AdServerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedVeiculo, setSelectedVeiculo] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const [consRes, metaLeadsRes, lpSummaryRes, adServerRes] = await Promise.all([
          axios.get(
            "https://nmbcoamazonia-api.vercel.app/google/sheets/1ZPKSZQTwylGl3MQHVA-Ee_htmjAPO0QEEYep1Rk_J1o/data?range=Consolidado"
          ),
          axios.get(
            "https://nmbcoamazonia-api.vercel.app/google/sheets/1ZPKSZQTwylGl3MQHVA-Ee_htmjAPO0QEEYep1Rk_J1o/data?range=FORMUL%C3%81RIO%20-%20CAPITAL%20DE%20GIRO-2"
          ),
          axios.get("https://nmbcoamazonia-api.vercel.app/rdstation/lp-summary").catch(() => ({ data: { success: false } })),
          axios.get("https://dashbrasiladserver.com.br/api/templates/274/bi?token=VxSzRmqc2M").catch(() => ({ data: [] })),
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

        // Processar Leads de Meta (Formulário Sheets)
        if (metaLeadsRes.data.success && metaLeadsRes.data.data.values) {
          const rows: any[][] = metaLeadsRes.data.data.values
          const header = rows[0]
          const idx = (col: string) => header.indexOf(col)

          const parsed: MetaLeadRow[] = rows.slice(1).map((r) => ({
            id: r[idx("id")] || "",
            createdTime: r[idx("created_time")] || "",
            adName: r[idx("ad_name")] || "",
            adsetName: r[idx("adset_name")] || "",
            campaignName: r[idx("campaign_name")] || "",
            platform: r[idx("platform")] || "",
            fullName: r[idx("full_name")] || "",
            phone: r[idx("phone_number")] || "",
            email: r[idx("email")] || "",
            leadStatus: r[idx("lead_status")] || "",
          }))
          setMetaLeads(parsed)
        }

        // LP Summary (visitantes + conversões RD Station)
        if (lpSummaryRes.data?.success && lpSummaryRes.data?.data) {
          setLpSummary(lpSummaryRes.data.data)
        }

        // AdServer
        if (Array.isArray(adServerRes.data) && adServerRes.data.length > 0) {
          setAdServer(adServerRes.data)
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

  // Totais de leads de Meta por plataforma
  const metaLeadsByPlatform = useMemo(() => {
    const map = new Map<string, number>()
    metaLeads.forEach((l) => {
      const p = l.platform || "Desconhecido"
      map.set(p, (map.get(p) || 0) + 1)
    })
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1])
  }, [metaLeads])

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

  // Leads por dia — Meta
  const leadsByDay = useMemo(() => {
    const map = new Map<string, number>()
    metaLeads.forEach((l) => {
      const day = l.createdTime.slice(0, 10)
      map.set(day, (map.get(day) || 0) + 1)
    })
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-14)
  }, [metaLeads])

  const maxLeadsDay = useMemo(() => Math.max(...leadsByDay.map((d) => d[1]), 1), [leadsByDay])

  // AdServer — agregar por publisher
  const adServerByPublisher = useMemo(() => {
    const map = new Map<string, { impressions: number; clicks: number; vieweables: number }>()
    adServer.forEach((r) => {
      const key = r.publisher_name
      const cur = map.get(key) ?? { impressions: 0, clicks: 0, vieweables: 0 }
      map.set(key, {
        impressions: cur.impressions + (parseInt(r.impressions) || 0),
        clicks: cur.clicks + (parseInt(r.clicks) || 0),
        vieweables: cur.vieweables + (parseInt(r.vieweables) || 0),
      })
    })
    return Array.from(map.entries())
      .map(([name, v]) => ({
        name,
        ...v,
        ctr: v.impressions > 0 ? (v.clicks / v.impressions) * 100 : 0,
        va: v.impressions > 0 ? (v.vieweables / v.impressions) * 100 : 0,
      }))
      .sort((a, b) => b.impressions - a.impressions)
  }, [adServer])

  const adServerTotals = useMemo(() => {
    const t = adServer.reduce(
      (acc, r) => ({
        impressions: acc.impressions + (parseInt(r.impressions) || 0),
        clicks: acc.clicks + (parseInt(r.clicks) || 0),
        vieweables: acc.vieweables + (parseInt(r.vieweables) || 0),
      }),
      { impressions: 0, clicks: 0, vieweables: 0 }
    )
    const meta = adServer[0]
    return {
      ...t,
      ctr: t.impressions > 0 ? (t.clicks / t.impressions) * 100 : 0,
      va: t.impressions > 0 ? (t.vieweables / t.impressions) * 100 : 0,
      quantidade_contratada: meta?.quantidade_contratada ?? 0,
      inicio_campanha: meta?.inicio_campanha ?? "",
      fim_campanha: meta?.fim_campanha ?? "",
    }
  }, [adServer])



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
                <p className="text-2xl font-bold text-white">{formatNum(metaLeads.length)}</p>
              </div>
              <div>
                <p className="text-purple-200 text-xs">Visitantes LP</p>
                <p className="text-2xl font-bold text-white">
                  {lpSummary ? formatNum(lpSummary.visits_count) : "—"}
                </p>
              </div>
              <div>
                <p className="text-purple-200 text-xs">Conversões LP</p>
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
            />
            <KpiCard
              label="Leads"
              value={formatNum(totalLeads)}
              sub={`CPL: ${formatCurrency(totalCpl)}`}
              icon={<Users className="w-4 h-4 text-white" />}
              color="bg-indigo-500"
            />
            <KpiCard
              label="Impressões"
              value={formatNum(totalImpressions)}
              sub="Redes Sociais + Display"
              icon={<Eye className="w-4 h-4 text-white" />}
              color="bg-blue-500"
            />
            <KpiCard
              label="Cliques"
              value={formatNum(totalClicks)}
              sub={`CTR: ${formatPct(totalCtr)}`}
              icon={<MousePointerClick className="w-4 h-4 text-white" />}
              color="bg-cyan-500"
            />
            <KpiCard
              label="Visualizações"
              value={formatNum(totalVideoViews)}
              sub={`VTR: ${formatPct(totals.vtr)}`}
              icon={<Play className="w-4 h-4 text-white" />}
              color="bg-emerald-500"
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
                      <td className="py-2 text-right text-indigo-600 font-bold">{formatNum(t.leads)}</td>
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
            <h3 className="text-sm font-bold text-gray-900">Leads Meta · Formulário (Tempo Real)</h3>
            <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-1 rounded-full">
              {formatNum(metaLeads.length)} leads
            </span>
          </div>

          {/* Por plataforma */}
          <div className="space-y-2 mb-4">
            {metaLeadsByPlatform.map(([platform, count]) => {
              const pct = (count / metaLeads.length) * 100
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
              <div className="flex items-end gap-1 h-16">
                {leadsByDay.map(([day, count]) => (
                  <div key={day} className="flex-1 flex flex-col items-center gap-0.5">
                    <div
                      className="w-full rounded-sm bg-gradient-to-t from-indigo-600 to-purple-400 transition-all"
                      style={{ height: `${(count / maxLeadsDay) * 100}%`, minHeight: 2 }}
                      title={`${day}: ${count} leads`}
                    />
                    <span className="text-[8px] text-gray-400 rotate-45 origin-left hidden sm:block">
                      {day.slice(5)}
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
                  <p className="text-[10px] text-gray-500">Conversões</p>
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


      {/* ── AdServer ── */}
      {adServer.length > 0 && (
        <div className="card-overlay rounded-xl shadow-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-900">Display · AdServer</h3>
            <div className="flex gap-3 text-xs text-gray-500">
              <span>{adServerTotals.inicio_campanha} → {adServerTotals.fim_campanha}</span>
              <span className="font-semibold text-purple-700">
                {formatNum(adServerTotals.impressions)} / {formatNum(adServerTotals.quantidade_contratada)} imp. contratadas
              </span>
              <span className="font-bold text-emerald-600">
                {((adServerTotals.impressions / adServerTotals.quantidade_contratada) * 100).toFixed(1)}% entregue
              </span>
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
                  <th className="text-left py-2 text-gray-500 font-medium">Publisher</th>
                  <th className="text-right py-2 text-gray-500 font-medium">Impressões</th>
                  <th className="text-right py-2 text-gray-500 font-medium">Cliques</th>
                  <th className="text-right py-2 text-gray-500 font-medium">CTR</th>
                  <th className="text-right py-2 text-gray-500 font-medium">Viewability</th>
                  <th className="py-2 pl-3 text-gray-500 font-medium">Entrega</th>
                </tr>
              </thead>
              <tbody>
                {adServerByPublisher.map((p) => {
                  const pct = adServerTotals.impressions > 0
                    ? (p.impressions / adServerTotals.impressions) * 100
                    : 0
                  return (
                    <tr key={p.name} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2 font-semibold text-gray-800">{p.name}</td>
                      <td className="py-2 text-right text-gray-700">{formatNum(p.impressions)}</td>
                      <td className="py-2 text-right text-gray-700">{formatNum(p.clicks)}</td>
                      <td className="py-2 text-right text-purple-600 font-semibold">{p.ctr.toFixed(2)}%</td>
                      <td className="py-2 text-right text-blue-600">{p.va.toFixed(1)}%</td>
                      <td className="py-2 pl-3 w-32">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-purple-500 to-indigo-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-gray-500 w-8 text-right">{pct.toFixed(0)}%</span>
                        </div>
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

"use client"

import type React from "react"
import { useRef, useState, useEffect, useMemo, useCallback } from "react"
import {
  MousePointerClick,
  Eye,
  Play,
  Gauge,
  ArrowUpDown,
  Calendar,
  X,
  Globe,
  MapPin,
  Radio,
  Sparkles,
  RefreshCw,
  DollarSign,
} from "lucide-react"
import axios from "axios"
import Loading from "../../components/Loading/Loading"
import PDFDownloadButton from "../../components/PDFDownloadButton/PDFDownloadButton"
import { analyzePortais } from "../../services/gemini"
import { getCachedAnalysis, setCachedAnalysis } from "../../services/analysisCache"
import {
  CONTRATOS_CAPITAL_DE_GIRO,
  CONTRATOS_CUSTEIO_AGRICOLA,
  DIARIA_MIN_IMPRESSOES,
  diasRestantesNoMes,
  type TipoCompra,
  type ContratoVeiculo,
} from "../../data/adserverContratos"

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface AdServerRow {
  date: string
  publisher_name: string
  impressions: string
  clicks: string
  vieweables: string
  ctr: string
  va: string
  vtr: string | null
  start: string | null // VAST: vídeos/áudios iniciados
  complete: string | null // VAST: concluídos
  type: string
  dimension: string
}

type Categoria = "nacional" | "regional" | "outros"

type SortCol =
  | "publisher"
  | "investimento"
  | "contratado"
  | "impressions"
  | "pacingPct"
  | "clicks"
  | "ctr"
  | "vtr"
  | "va"

interface PubRow {
  groupKey: string
  name: string
  rowKey: string
  investimento: number
  impressions: number
  clicks: number
  vieweables: number
  diasValidos: number
  metaDias: number | null
  inicioPublisher: string
  tipo: TipoCompra | null
  contrato: ContratoVeiculo | null
  pacingPct: number
  ctr: number
  va: number
  vtr: number | null
  isSubrow: boolean
  categoria: Categoria
}

interface Kpis {
  investimento: number
  impressions: number
  clicks: number
  ctr: number
  vtr: number
  va: number
}

// Todos os templates do AdServer (Capital de Giro + Custeio Agrícola), sem distinção de campanha.
const SOURCES: { id: number; token: string }[] = [
  { id: 274, token: "VxSzRmqc2M" }, // Capital de Giro
  { id: 279, token: "QY9jKtmfzD" }, // Capital de Giro
  { id: 310, token: "NOP2VowjgW" }, // Custeio Agrícola (Alright/Spotify/Zap)
  { id: 315, token: "EJb3iiYWom" }, // Custeio Agrícola (Deezer/Spotify — VAST/áudio)
  { id: 343, token: "wBNTzINzMq" }, // Custeio Agrícola (portais regionais)
  { id: 342, token: "sw2qFEMv17" }, // Custeio Agrícola (portais nacionais)
]

// Planilhas de projetos: classificam os veículos (Nacional x Regional) e trazem o investimento.
const SHEET_BASE =
  "https://nmbcoamazonia-api.vercel.app/google/sheets/1-aLCEJBF9_nn8Xl_tq_dC6X6u1ZG__7eSkyUXGgfd2o/data?range="
const SHEET_NACIONAL = `${SHEET_BASE}${encodeURIComponent("PROJETOS - PORTAIS NET")}`
const SHEET_REGIONAL = `${SHEET_BASE}${encodeURIComponent("PROJETOS - PORTAIS")}`
// Fonte secundária de investimento (linhas "PROPOSTA <veículo>" com meio Internet).
const SHEET_ACOES = `${SHEET_BASE}${encodeURIComponent("AÇÕES MÍDIA")}`

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Barra de pacing: amarelo (0%) → roxo escuro (100%)
const pacingColor = (pct: number): string => {
  const t = Math.min(pct, 100) / 100
  const r = Math.round(234 + (88 - 234) * t)
  const g = Math.round(179 + (28 - 179) * t)
  const b = Math.round(8 + (135 - 8) * t)
  return `rgb(${r},${g},${b})`
}

const toInt = (v: unknown): number => {
  const n = parseInt(String(v ?? ""), 10)
  return isNaN(n) ? 0 : n
}

// "R$ 9.409,40" → 9409.4
const parseCurrency = (v: string): number => {
  if (!v || v.trim() === "" || v.trim() === "-") return 0
  const s = v.replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".")
  return parseFloat(s) || 0
}

const toISODate = (d: string): string => {
  if (!d) return ""
  if (d.includes("/")) {
    const [dd, mm, yy] = d.split("/")
    if (!dd || !mm || !yy) return ""
    return `${yy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`
  }
  return d.slice(0, 10)
}

const formatNum = (v: number) => new Intl.NumberFormat("pt-BR").format(Math.round(v))
const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)

const stripAccents = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "")

// Chave canônica: funde as variações de nome do MESMO portal que aparecem entre os
// 6 templates, as 2 listas de contrato e as 2 planilhas de projetos
// (ex.: "DOL" / "RBA - DOL" / "Diário do Pará - DOL"). Rodamos TODOS os nomes por aqui → colidem.
const normKey = (raw: string): string => {
  let s = stripAccents(String(raw ?? "")).toUpperCase().trim()
  s = s.replace(/\.COM(\.BR)?/g, "").replace(/\s+/g, " ").trim()

  // Áudio/Vídeo (VAST)
  if (s.startsWith("SPOT")) return "SPOTIFY" // SPOTIFY, SPOTFY (typo do adserver)
  if (s.startsWith("DEEZER")) return "DEEZER"
  if (s.startsWith("ALRIGHT")) return "ALRIGHT"
  if (s.startsWith("ZAP")) return "ZAP MEDIA"

  // Famílias com nomes divergentes entre templates/contratos/planilhas
  if (s.includes("DOL")) return "DOL" // DOL, RBA - DOL, DIARIO DO PARA - DOL
  if (s.includes("DIARIO DO PARA")) return "DOL" // "Diário do Pará" (AÇÕES MÍDIA) = portal DOL
  if (s.includes("PEGN")) return "PEGN" // REVISTA PEGN, PEGN (GLOBO)
  if (s.startsWith("O GLOBO")) return "O GLOBO" // jornal O Globo — distinto do portal Globo.com
  if (s.startsWith("GLOBO")) return "GLOBO" // GLOBO, GLOBO.COM
  if (s.startsWith("ESTAD")) return "ESTADAO" // ESTADAO, ESTADAO.COM
  if (s.startsWith("FOLHA DE S")) return "FOLHA DE SAO PAULO" // ...SP, ...SAO PAULO
  if (s.startsWith("CONEX")) return "CONEXAO TOCANTINS"
  if (s.includes("IMPARCIAL")) return "O IMPARCIAL"
  if (s.startsWith("DIARIO DA AMAZ")) return "DIARIO DA AMAZONIA"
  return s
}

// Nome de exibição preferido para as chaves fundidas (as demais herdam o 1º nome visto)
const PRETTY: Record<string, string> = {
  SPOTIFY: "Spotify",
  DEEZER: "Deezer",
  ALRIGHT: "Alright",
  "ZAP MEDIA": "Zap Media",
  DOL: "DOL",
  PEGN: "PEGN",
  GLOBO: "Globo.com",
  "O GLOBO": "O Globo",
  ESTADAO: "Estadão",
  "FOLHA DE SAO PAULO": "Folha de São Paulo",
  "CONEXAO TOCANTINS": "Conexão Tocantins",
  "O IMPARCIAL": "O Imparcial (MA)",
  "DIARIO DA AMAZONIA": "Diário da Amazônia",
}

// Projetos especiais — REMOVIDOS desta página (tratados à parte). Excluídos de tudo
// (cards, KPIs e totais). "GO ON" é como vem no adserver; "GOON" incluso por segurança.
const PROJETOS_ESPECIAIS = new Set<string>(["GO ON", "GOON", "ALRIGHT", "DEEZER", "IDEAL", "SPOTIFY", "ZAP MEDIA"])

// Classificação manual dos veículos que NÃO constam nas planilhas de projetos.
// Decisão do time: Roma News é regional. Só vale para chaves fora das planilhas.
const MANUAL_OVERRIDE: Record<string, Categoria> = {
  "ROMA NEWS": "regional",
}

// Extrai da planilha de projetos: chaves de veículo (normalizadas) + investimento por veículo.
// O cabeçalho não está na 1ª linha (há um título mesclado antes), então localizamos as
// colunas "Veículo" e "Investimento". Um mesmo veículo pode ter várias linhas → soma.
const extractProjetos = (sheetBody: any): { keys: Set<string>; invest: Map<string, number> } => {
  const keys = new Set<string>()
  const invest = new Map<string, number>()
  const vals: string[][] | undefined = sheetBody?.data?.values
  if (!Array.isArray(vals)) return { keys, invest }

  let hr = -1
  let hcVeic = -1
  let hcInvest = -1
  for (let ri = 0; ri < Math.min(6, vals.length) && hr < 0; ri++) {
    for (let ci = 0; ci < vals[ri].length; ci++) {
      const t = stripAccents(vals[ri][ci] || "").trim().toLowerCase()
      if (t === "veiculo") {
        hr = ri
        hcVeic = ci
      }
      if (t === "investimento") hcInvest = ci
    }
  }
  if (hr < 0) return { keys, invest }

  for (let ri = hr + 1; ri < vals.length; ri++) {
    const nome = vals[ri]?.[hcVeic]
    if (!nome || !nome.trim()) continue
    const key = normKey(nome)
    keys.add(key)
    const inv = hcInvest >= 0 ? parseCurrency(vals[ri][hcInvest] || "") : 0
    invest.set(key, (invest.get(key) ?? 0) + inv)
  }
  return { keys, invest }
}

// Investimento de fallback (aba "AÇÕES MÍDIA"): linhas "PROPOSTA <veículo>" com meio
// Internet e o valor em "VALOR (94%)". Usado só para veículos sem investimento na planilha PROJETOS.
const extractAcoesFallback = (sheetBody: any): Map<string, number> => {
  const fb = new Map<string, number>()
  const vals: string[][] | undefined = sheetBody?.data?.values
  if (!Array.isArray(vals)) return fb

  let hr = -1
  let cAcao = -1
  let cMeio = -1
  let cValor = -1
  for (let ri = 0; ri < Math.min(8, vals.length) && hr < 0; ri++) {
    for (let ci = 0; ci < vals[ri].length; ci++) {
      const t = stripAccents(vals[ri][ci] || "").trim().toLowerCase()
      if (t === "acao") {
        hr = ri
        cAcao = ci
      }
      if (t === "meios") cMeio = ci
      if (t.includes("valor") && t.includes("94")) cValor = ci // "VALOR (94%)"
    }
  }
  if (hr < 0 || cValor < 0) return fb

  for (let ri = hr + 1; ri < vals.length; ri++) {
    const acao = vals[ri]?.[cAcao] || ""
    if (!/^\s*proposta\s+/i.test(stripAccents(acao))) continue
    const meio = cMeio >= 0 ? stripAccents(vals[ri][cMeio] || "").toUpperCase() : ""
    if (!meio.includes("INTERNET")) continue
    const nome = acao.trim().replace(/^proposta\s+/i, "")
    const val = parseCurrency(vals[ri][cValor] || "")
    if (val > 0) {
      const key = normKey(nome)
      fb.set(key, (fb.get(key) ?? 0) + val)
    }
  }
  return fb
}

// Contratos unificados: junta as duas campanhas e, por chave de veículo, SOMA as metas
// de mesmo tipo (CPM+CPM, DIARIA+DIARIA...). Metas numéricas vencem "null" (dias do mês).
const TYPE_ORDER: Record<TipoCompra, number> = { CPM: 0, CPV: 1, CPC: 2, DIARIA: 3 }

const CONTRATOS_PORTAIS: Map<string, ContratoVeiculo[]> = (() => {
  type Acc = { sum: number; hasNum: boolean; hasNull: boolean; formato?: string }
  const byKey = new Map<string, Map<TipoCompra, Acc>>()

  ;[...CONTRATOS_CAPITAL_DE_GIRO, ...CONTRATOS_CUSTEIO_AGRICOLA].forEach((c) => {
    const key = normKey(c.publisher)
    const tMap = byKey.get(key) ?? new Map<TipoCompra, Acc>()
    const acc = tMap.get(c.tipo) ?? { sum: 0, hasNum: false, hasNull: false }
    if (c.quantidade === null) acc.hasNull = true
    else {
      acc.sum += c.quantidade
      acc.hasNum = true
    }
    if (c.formato) acc.formato = c.formato
    tMap.set(c.tipo, acc)
    byKey.set(key, tMap)
  })

  const out = new Map<string, ContratoVeiculo[]>()
  byKey.forEach((tMap, key) => {
    const arr: ContratoVeiculo[] = []
    tMap.forEach((acc, tipo) => {
      arr.push({ publisher: key, tipo, quantidade: acc.hasNum ? acc.sum : null, formato: acc.formato })
    })
    arr.sort((a, b) => TYPE_ORDER[a.tipo] - TYPE_ORDER[b.tipo])
    out.set(key, arr)
  })
  return out
})()

// ─── Card reutilizável ────────────────────────────────────────────────────────

interface PortalCardProps {
  title: string
  subtitle: string
  icon: React.ReactNode
  rows: PubRow[] // já ordenadas
  kpis: Kpis
  sortCol: SortCol
  onToggleSort: (c: SortCol) => void
}

const PortalCard: React.FC<PortalCardProps> = ({ title, subtitle, icon, rows, kpis, sortCol, onToggleSort }) => {
  const veiculos = rows.filter((r) => !r.isSubrow).length
  const labels: Record<SortCol, string> = {
    publisher: "Veículo",
    investimento: "Investimento",
    impressions: "Entregue",
    pacingPct: "Pacing",
    contratado: "Contratado",
    clicks: "Cliques",
    ctr: "CTR",
    vtr: "VTR",
    va: "Viewability",
  }
  const cols: SortCol[] = ["publisher", "investimento", "contratado", "impressions", "pacingPct", "clicks", "ctr", "vtr", "va"]

  return (
    <div className="card-overlay rounded-xl shadow-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-600 text-white">{icon}</div>
        <div>
          <h3 className="text-sm font-bold text-gray-900">
            {title} <span className="text-gray-400 font-medium">· {veiculos} veículos</span>
          </h3>
          <p className="text-[10px] text-gray-400">{subtitle}</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
        <div className="bg-green-50 rounded-lg p-3 text-center">
          <p className="text-lg font-bold text-green-700">{formatCurrency(kpis.investimento)}</p>
          <p className="text-[10px] text-gray-500">Investimento</p>
        </div>
        <div className="bg-emerald-50 rounded-lg p-3 text-center">
          <p className="text-lg font-bold text-emerald-700">{formatNum(kpis.impressions)}</p>
          <p className="text-[10px] text-gray-500">Impressões</p>
        </div>
        <div className="bg-cyan-50 rounded-lg p-3 text-center">
          <p className="text-lg font-bold text-cyan-700">{formatNum(kpis.clicks)}</p>
          <p className="text-[10px] text-gray-500">Cliques</p>
        </div>
        <div className="bg-indigo-50 rounded-lg p-3 text-center">
          <p className="text-lg font-bold text-indigo-700">{kpis.ctr.toFixed(2)}%</p>
          <p className="text-[10px] text-gray-500">CTR</p>
        </div>
        <div className="bg-teal-50 rounded-lg p-3 text-center">
          <p className="text-lg font-bold text-teal-700">{kpis.vtr.toFixed(1)}%</p>
          <p className="text-[10px] text-gray-500">VTR</p>
        </div>
        <div className="bg-blue-50 rounded-lg p-3 text-center">
          <p className="text-lg font-bold text-blue-700">{kpis.va.toFixed(1)}%</p>
          <p className="text-[10px] text-gray-500">Viewability</p>
        </div>
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200">
              {cols.map((col) => {
                const isActive = sortCol === col
                const isLeft = col === "publisher"
                const isPacing = col === "pacingPct"
                return (
                  <th
                    key={col}
                    onClick={() => onToggleSort(col)}
                    className={`py-2 font-medium cursor-pointer select-none ${
                      isLeft ? "text-left" : isPacing ? "pl-3" : "text-right"
                    } ${isActive ? "text-emerald-700" : "text-gray-500"}`}
                  >
                    <div className={`flex items-center gap-1 ${isLeft ? "" : isPacing ? "" : "justify-end"}`}>
                      {labels[col]}
                      <ArrowUpDown className={`w-3 h-3 shrink-0 ${isActive ? "text-emerald-700" : "text-gray-300"}`} />
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr
                key={p.rowKey}
                className={`border-b border-gray-50 hover:bg-gray-50 ${p.isSubrow ? "bg-gray-50/60" : ""}`}
              >
                {/* Veículo */}
                <td className="py-2 font-semibold text-gray-800">
                  {p.isSubrow ? <span className="pl-4 text-gray-400 font-normal">↳</span> : p.name}
                </td>

                {/* Investimento */}
                <td className="py-2 text-right text-green-700 font-semibold whitespace-nowrap">
                  {!p.isSubrow ? (p.investimento > 0 ? formatCurrency(p.investimento) : "—") : ""}
                </td>

                {/* Contratado (com badge de tipo) */}
                <td className="py-2 text-right text-gray-500 whitespace-nowrap">
                  <div className="flex items-center justify-end gap-2">
                    {p.tipo && (
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          p.tipo === "CPM"
                            ? "bg-indigo-100 text-indigo-700"
                            : p.tipo === "CPV"
                            ? "bg-teal-100 text-teal-700"
                            : p.tipo === "CPC"
                            ? "bg-rose-100 text-rose-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {p.tipo}
                      </span>
                    )}
                    <span>
                      {(p.tipo === "CPM" || p.tipo === "CPV") && p.contrato ? (
                        formatNum(p.contrato.quantidade ?? 0)
                      ) : p.tipo === "CPC" && p.contrato ? (
                        `${formatNum(p.contrato.quantidade ?? 0)} cliques`
                      ) : p.tipo === "DIARIA" && p.contrato ? (
                        `${p.diasValidos} / ${p.metaDias} dias`
                      ) : (
                        "—"
                      )}
                    </span>
                  </div>
                </td>

                {/* Entregue */}
                <td className="py-2 text-right text-emerald-700 font-semibold">
                  {!p.isSubrow
                    ? p.contrato?.tipo === "CPC"
                      ? formatNum(p.clicks)
                      : formatNum(p.impressions)
                    : p.contrato?.tipo === "CPC"
                    ? formatNum(p.clicks)
                    : p.contrato?.tipo === "CPV"
                    ? formatNum(p.vieweables)
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
                <td className="py-2 text-right text-gray-700">{!p.isSubrow ? formatNum(p.clicks) : ""}</td>

                {/* CTR — oculto p/ mídia push (ZAP): cliques não vêm de impressão */}
                <td className="py-2 text-right text-indigo-600 font-semibold">
                  {!p.isSubrow ? (p.name.toUpperCase().includes("ZAP") ? "-" : `${p.ctr.toFixed(2)}%`) : ""}
                </td>

                {/* VTR */}
                <td className="py-2 text-right text-teal-600 font-semibold">
                  {!p.isSubrow ? (p.vtr !== null ? `${p.vtr.toFixed(1)}%` : "—") : ""}
                </td>

                {/* Viewability */}
                <td className="py-2 text-right text-blue-600">{!p.isSubrow ? `${p.va.toFixed(1)}%` : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

const Portais2026: React.FC = () => {
  const contentRef = useRef<HTMLDivElement>(null)
  const [rows, setRows] = useState<AdServerRow[]>([])
  const [natKeys, setNatKeys] = useState<Set<string>>(new Set())
  const [regKeys, setRegKeys] = useState<Set<string>>(new Set())
  const [investByKey, setInvestByKey] = useState<Map<string, number>>(new Map())
  const [investFallback, setInvestFallback] = useState<Map<string, number>>(new Map())
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: "", end: "" })

  const [aiAnalysis, setAiAnalysis] = useState<string>("")
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  const [sortCol, setSortCol] = useState<SortCol>("impressions")
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc")

  const toggleSort = (col: SortCol) => {
    if (sortCol === col) setSortDir((d) => (d === "desc" ? "asc" : "desc"))
    else {
      setSortCol(col)
      setSortDir("desc")
    }
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const [tplResults, natSheet, regSheet, acoesSheet] = await Promise.all([
          Promise.all(
            SOURCES.map((s) =>
              axios
                .get(`https://dashbrasiladserver.com.br/api/templates/${s.id}/bi?token=${s.token}`)
                .catch(() => ({ data: [] }))
            )
          ),
          axios.get(SHEET_NACIONAL).catch(() => ({ data: { success: false } })),
          axios.get(SHEET_REGIONAL).catch(() => ({ data: { success: false } })),
          axios.get(SHEET_ACOES).catch(() => ({ data: { success: false } })),
        ])

        const merged: AdServerRow[] = []
        tplResults.forEach((res) => {
          if (Array.isArray(res.data)) merged.push(...(res.data as AdServerRow[]))
        })
        setRows(merged)

        const nat = extractProjetos(natSheet.data)
        const reg = extractProjetos(regSheet.data)
        setNatKeys(nat.keys)
        setRegKeys(reg.keys)
        // Merge somando (o veículo pode estar nas duas planilhas, ex.: DOL)
        const inv = new Map(nat.invest)
        reg.invest.forEach((v, k) => inv.set(k, (inv.get(k) ?? 0) + v))
        setInvestByKey(inv)
        setInvestFallback(extractAcoesFallback(acoesSheet.data))
      } catch (err) {
        console.error("Erro ao buscar dados Portais 2026:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  // Prioridade: planilha Nacional → planilha Regional → classificação manual → "outros".
  // (Nacional vence Regional quando o veículo aparece nas duas planilhas, ex.: DOL.)
  const classify = useCallback(
    (key: string): Categoria =>
      natKeys.has(key) ? "nacional" : regKeys.has(key) ? "regional" : MANUAL_OVERRIDE[key] ?? "outros",
    [natKeys, regKeys]
  )

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

  const allAdServer = useMemo(
    () => rows.filter((r) => inDateRange(r.date) && !PROJETOS_ESPECIAIS.has(normKey(r.publisher_name))),
    [rows, inDateRange]
  )

  // ─── Agregação por veículo (chave canônica) ──────────────────────────────────
  const adServerByPublisher = useMemo(() => {
    type DayMap = Map<string, number>
    const map = new Map<
      string,
      {
        name: string
        impressions: number
        clicks: number
        vieweables: number
        vStart: number
        vComplete: number
        byDay: DayMap
        inicioPublisher: string
      }
    >()

    allAdServer.forEach((r) => {
      const key = normKey(r.publisher_name)
      const imp = toInt(r.impressions)
      const cur =
        map.get(key) ?? {
          name: PRETTY[key] ?? r.publisher_name.trim(),
          impressions: 0,
          clicks: 0,
          vieweables: 0,
          vStart: 0,
          vComplete: 0,
          byDay: new Map(),
          inicioPublisher: r.date,
        }
      cur.byDay.set(r.date, (cur.byDay.get(r.date) ?? 0) + imp)
      cur.impressions += imp
      cur.clicks += toInt(r.clicks)
      cur.vieweables += toInt(r.vieweables)
      cur.vStart += toInt(r.start)
      cur.vComplete += toInt(r.complete)
      if (r.date < cur.inicioPublisher) cur.inicioPublisher = r.date
      map.set(key, cur)
    })

    const rowsOut: PubRow[] = []

    Array.from(map.entries()).forEach(([key, v]) => {
      const contratos = CONTRATOS_PORTAIS.get(key) ?? []
      const categoria = classify(key)
      // Primário: planilha PROJETOS. Fallback: aba AÇÕES MÍDIA (se PROJETOS não preencheu).
      const primaryInvest = investByKey.get(key) ?? 0
      const investimento = primaryInvest > 0 ? primaryInvest : investFallback.get(key) ?? 0

      const diasValidos = Array.from(v.byDay.entries()).filter(
        ([date, imp]) => date >= v.inicioPublisher && imp > DIARIA_MIN_IMPRESSOES
      ).length

      const ctr = v.impressions > 0 ? (v.clicks / v.impressions) * 100 : 0
      const va = v.impressions > 0 ? (v.vieweables / v.impressions) * 100 : 0
      const vtr = v.vStart > 0 ? (v.vComplete / v.vStart) * 100 : null

      if (contratos.length === 0) {
        rowsOut.push({
          groupKey: key,
          name: v.name,
          rowKey: key,
          investimento,
          impressions: v.impressions,
          clicks: v.clicks,
          vieweables: v.vieweables,
          diasValidos,
          metaDias: null,
          inicioPublisher: v.inicioPublisher,
          tipo: null,
          contrato: null,
          pacingPct: 0,
          ctr,
          va,
          vtr,
          isSubrow: false,
          categoria,
        })
        return
      }

      contratos.forEach((contrato, i) => {
        const metaDias =
          contrato.tipo === "DIARIA"
            ? contrato.quantidade !== null
              ? contrato.quantidade
              : diasRestantesNoMes(v.inicioPublisher)
            : null

        const pacingPct =
          contrato.tipo === "CPM" || contrato.tipo === "CPV"
            ? Math.min((v.impressions / (contrato.quantidade ?? 1)) * 100, 100)
            : contrato.tipo === "CPC"
            ? Math.min((v.clicks / (contrato.quantidade ?? 1)) * 100, 100)
            : Math.min((diasValidos / (metaDias ?? 1)) * 100, 100)

        rowsOut.push({
          groupKey: key,
          name: v.name,
          rowKey: `${key}__${contrato.tipo}__${i}`,
          investimento: i === 0 ? investimento : 0,
          impressions: i === 0 ? v.impressions : 0,
          clicks: v.clicks,
          vieweables: v.vieweables,
          diasValidos,
          metaDias,
          inicioPublisher: v.inicioPublisher,
          tipo: contrato.tipo,
          contrato,
          pacingPct,
          ctr: i === 0 ? ctr : 0,
          va: i === 0 ? va : 0,
          vtr: i === 0 ? vtr : null,
          isSubrow: i > 0,
          categoria,
        })
      })
    })

    return rowsOut
  }, [allAdServer, classify, investByKey, investFallback])

  // Ordena um subconjunto de linhas mantendo subrows logo abaixo da sua linha principal.
  const sortRows = useCallback(
    (subset: PubRow[]): PubRow[] => {
      const valMap = new Map<string, number | string>()
      subset.forEach((r) => {
        if (r.isSubrow) return
        let v: number | string = 0
        if (sortCol === "publisher") v = r.name
        else if (sortCol === "investimento") v = r.investimento
        else if (sortCol === "impressions") v = r.impressions
        else if (sortCol === "clicks") v = r.clicks
        // ZAP é mídia push/CPC (cliques ≫ impressões) → CTR não faz sentido; joga p/ o fim
        else if (sortCol === "ctr") v = /zap/i.test(r.name) ? -1 : r.ctr
        else if (sortCol === "vtr") v = r.vtr ?? -1
        else if (sortCol === "va") v = r.va
        else if (sortCol === "pacingPct") v = r.pacingPct
        else if (sortCol === "contratado") v = r.contrato?.quantidade ?? 0
        valMap.set(r.groupKey, v)
      })

      return [...subset].sort((a, b) => {
        if (a.groupKey === b.groupKey) return a.isSubrow ? 1 : -1
        const vA = valMap.get(a.groupKey) ?? 0
        const vB = valMap.get(b.groupKey) ?? 0
        const cmp = typeof vA === "string" ? vA.localeCompare(vB as string) : (vB as number) - (vA as number)
        return sortDir === "asc" ? -cmp : cmp
      })
    },
    [sortCol, sortDir]
  )

  const byCategoria = useMemo(() => {
    const g: Record<Categoria, PubRow[]> = { nacional: [], regional: [], outros: [] }
    adServerByPublisher.forEach((r) => g[r.categoria].push(r))
    return {
      nacional: sortRows(g.nacional),
      regional: sortRows(g.regional),
      outros: sortRows(g.outros),
    }
  }, [adServerByPublisher, sortRows])

  // KPIs por categoria — métricas das linhas cruas + investimento das linhas agregadas
  const kpisByCategoria = useMemo(() => {
    const mk = () => ({ investimento: 0, impressions: 0, clicks: 0, vieweables: 0, vStart: 0, vComplete: 0 })
    const g: Record<Categoria, ReturnType<typeof mk>> = { nacional: mk(), regional: mk(), outros: mk() }
    allAdServer.forEach((r) => {
      const t = g[classify(normKey(r.publisher_name))]
      t.impressions += toInt(r.impressions)
      t.clicks += toInt(r.clicks)
      t.vieweables += toInt(r.vieweables)
      t.vStart += toInt(r.start)
      t.vComplete += toInt(r.complete)
    })
    // Investimento: uma vez por veículo (linha principal)
    adServerByPublisher.forEach((r) => {
      if (!r.isSubrow) g[r.categoria].investimento += r.investimento
    })
    const fin = (t: ReturnType<typeof mk>): Kpis => ({
      investimento: t.investimento,
      impressions: t.impressions,
      clicks: t.clicks,
      ctr: t.impressions > 0 ? (t.clicks / t.impressions) * 100 : 0,
      va: t.impressions > 0 ? (t.vieweables / t.impressions) * 100 : 0,
      vtr: t.vStart > 0 ? (t.vComplete / t.vStart) * 100 : 0,
    })
    return { nacional: fin(g.nacional), regional: fin(g.regional), outros: fin(g.outros) }
  }, [allAdServer, classify, adServerByPublisher])

  const totalVeiculos = useMemo(
    () => new Set(adServerByPublisher.filter((r) => !r.isSubrow).map((r) => r.groupKey)).size,
    [adServerByPublisher]
  )
  const totalImpressions = allAdServer.reduce((a, r) => a + toInt(r.impressions), 0)

  const dateSpan = useMemo(() => {
    let min = ""
    let max = ""
    allAdServer.forEach((r) => {
      const d = toISODate(r.date)
      if (!d) return
      if (!min || d < min) min = d
      if (!max || d > max) max = d
    })
    const br = (iso: string) => {
      if (!iso) return "—"
      const [y, m, d] = iso.split("-")
      return `${d}/${m}/${y}`
    }
    return { min: br(min), max: br(max) }
  }, [allAdServer])

  // ─── Análise IA ──────────────────────────────────────────────────────────────
  const DATA_KEY = "portais-2026"

  const buildAnalysisPayload = () => {
    const bloco = (cat: Categoria) => {
      const veiculos = byCategoria[cat]
        .filter((r) => !r.isSubrow)
        .map((r) => ({
          name: r.name,
          impressions: r.impressions,
          clicks: r.clicks,
          ctr: r.ctr,
          va: r.va,
          vtr: r.vtr,
          pacingPct: r.pacingPct,
          investimento: r.investimento,
        }))
      const k = kpisByCategoria[cat]
      return {
        veiculos,
        impressions: k.impressions,
        clicks: k.clicks,
        ctr: k.ctr,
        va: k.va,
        vtr: k.vtr,
        investimento: k.investimento,
      }
    }
    return {
      nacional: bloco("nacional"),
      regional: bloco("regional"),
      periodo: { inicio: dateSpan.min, fim: dateSpan.max },
    }
  }

  const runAiAnalysis = async (forceRefresh = false) => {
    setAiLoading(true)
    setAiError(null)
    try {
      if (!forceRefresh) {
        const cached = await getCachedAnalysis(DATA_KEY)
        if (cached) {
          setAiAnalysis(cached.analysis)
          setAiLoading(false)
          return
        }
      }
      const result = await analyzePortais(buildAnalysisPayload())
      setAiAnalysis(result)
      await setCachedAnalysis(DATA_KEY, result)
    } catch {
      setAiError("Não foi possível gerar a análise. Tente novamente.")
    } finally {
      setAiLoading(false)
    }
  }

  // Auto-análise quando os dados terminam de carregar (só se houver veículos,
  // p/ não cachear no Redis uma análise vazia caso os templates falhem)
  useEffect(() => {
    if (!loading && !aiAnalysis && !aiLoading && adServerByPublisher.length > 0) runAiAnalysis()
  }, [loading]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <Loading message="Carregando portais do AdServer..." />

  const QUICK: { col: SortCol; label: string; icon: React.ReactNode }[] = [
    { col: "ctr", label: "Melhor CTR", icon: <MousePointerClick className="w-3.5 h-3.5" /> },
    { col: "vtr", label: "Melhor VTR", icon: <Play className="w-3.5 h-3.5" /> },
    { col: "impressions", label: "Maior Entrega", icon: <Eye className="w-3.5 h-3.5" /> },
    { col: "pacingPct", label: "Melhor Pacing", icon: <Gauge className="w-3.5 h-3.5" /> },
    { col: "investimento", label: "Maior Investimento", icon: <DollarSign className="w-3.5 h-3.5" /> },
  ]

  return (
    <div ref={contentRef} className="h-full flex flex-col space-y-3 overflow-auto">
      {/* ── Hero ── */}
      <div className="relative overflow-hidden rounded-2xl shadow-2xl h-36">
        <div className="relative h-full bg-gradient-to-r from-emerald-700 via-green-600 to-teal-600">
          <img
            src="/images/fundo_card.webp"
            alt="Portais 2026"
            className="w-full h-full object-cover mix-blend-overlay opacity-30"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-900/60 to-teal-800/40" />
          <div className="absolute top-3 right-3 z-10">
            <PDFDownloadButton contentRef={contentRef} fileName="portais-2026" />
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-4 flex items-end justify-between">
            <div>
              <p className="text-emerald-100 text-xs font-medium mb-1 uppercase tracking-wider">
                Campanhas · Display AdServer
              </p>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <Globe className="w-6 h-6" /> Portais - 2026
              </h1>
              <p className="text-emerald-100 text-sm">Nacionais e Regionais, consolidados</p>
            </div>
            <div className="text-right flex gap-4">
              <div>
                <p className="text-emerald-100 text-xs">Veículos</p>
                <p className="text-2xl font-bold text-white">{totalVeiculos}</p>
              </div>
              <div>
                <p className="text-emerald-100 text-xs">Impressões</p>
                <p className="text-2xl font-bold text-white">{formatNum(totalImpressions)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Filtro de período ── */}
      <div className="card-overlay rounded-xl shadow-lg p-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-gray-700">
          <Calendar className="w-4 h-4 text-emerald-600" />
          <span className="text-sm font-semibold">Período</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dateRange.start}
            max={dateRange.end || undefined}
            onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value }))}
            className="px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
          />
          <span className="text-gray-500 text-sm">até</span>
          <input
            type="date"
            value={dateRange.end}
            min={dateRange.start || undefined}
            onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))}
            className="px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
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
          Entrega com dados de {dateSpan.min} a {dateSpan.max}
        </span>
      </div>

      {/* ── Filtros rápidos (ordenam os cards) ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold text-gray-500">Ordenar por:</span>
        {QUICK.map((q) => {
          const active = sortCol === q.col && sortDir === "desc"
          return (
            <button
              key={q.col}
              onClick={() => {
                setSortCol(q.col)
                setSortDir("desc")
              }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                active
                  ? "bg-emerald-600 text-white shadow"
                  : "bg-white text-gray-600 border border-gray-200 hover:border-emerald-400"
              }`}
            >
              {q.icon}
              {q.label}
            </button>
          )
        })}
      </div>

      {allAdServer.length === 0 ? (
        <div className="card-overlay rounded-xl shadow-lg p-8 text-center text-gray-400 text-sm">
          Nenhum dado de AdServer para o período selecionado.
        </div>
      ) : (
        <>
          {byCategoria.nacional.length > 0 && (
            <PortalCard
              title="Portais Nacionais"
              subtitle="Veículos de alcance nacional (planilha PROJETOS - PORTAIS NET)"
              icon={<Globe className="w-4 h-4" />}
              rows={byCategoria.nacional}
              kpis={kpisByCategoria.nacional}
              sortCol={sortCol}
              onToggleSort={toggleSort}
            />
          )}

          {byCategoria.regional.length > 0 && (
            <PortalCard
              title="Portais Regionais"
              subtitle="Veículos de alcance regional (planilha PROJETOS - PORTAIS)"
              icon={<MapPin className="w-4 h-4" />}
              rows={byCategoria.regional}
              kpis={kpisByCategoria.regional}
              sortCol={sortCol}
              onToggleSort={toggleSort}
            />
          )}

          {byCategoria.outros.length > 0 && (
            <PortalCard
              title="Outros"
              subtitle="Veículos fora das planilhas de projetos"
              icon={<Radio className="w-4 h-4" />}
              rows={byCategoria.outros}
              kpis={kpisByCategoria.outros}
              sortCol={sortCol}
              onToggleSort={toggleSort}
            />
          )}

          {/* ── Análise IA ── */}
          <div className="card-overlay rounded-xl shadow-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Leitura de Performance dos Veículos</h3>
                  <p className="text-[10px] text-gray-400">Gerado por IA com base nos dados de Nacionais e Regionais</p>
                </div>
              </div>
              <button
                onClick={() => runAiAnalysis(true)}
                disabled={aiLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white text-xs font-medium rounded-lg transition-all"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${aiLoading ? "animate-spin" : ""}`} />
                {aiLoading ? "Analisando..." : aiAnalysis ? "Reanalisar" : "Analisar"}
              </button>
            </div>

            {!aiAnalysis && !aiLoading && !aiError && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Sparkles className="w-8 h-8 text-emerald-200 mb-2" />
                <p className="text-sm text-gray-400">
                  Clique em <strong>Analisar</strong> para gerar a leitura de performance dos veículos
                </p>
              </div>
            )}

            {aiLoading && (
              <div className="flex items-center justify-center py-8 gap-3">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <div
                  className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce"
                  style={{ animationDelay: "150ms" }}
                />
                <div
                  className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce"
                  style={{ animationDelay: "300ms" }}
                />
                <span className="text-sm text-gray-400 ml-1">Processando dados com IA...</span>
              </div>
            )}

            {aiError && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{aiError}</div>
            )}

            {aiAnalysis && !aiLoading && (
              <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 rounded-lg p-4">
                <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{aiAnalysis}</p>
              </div>
            )}
          </div>

          <p className="text-[11px] text-gray-400 leading-snug px-1">
            Classificação Nacional × Regional e investimento vindos das planilhas de projetos (colunas “Veículo” e
            “Investimento”); quando não preenchido, o investimento cai para a aba “AÇÕES MÍDIA” (linhas “PROPOSTA”).
            Pacing capado em 100%; metas de veículos contratados em mais de uma campanha são somadas. VTR só para
            formatos de áudio/vídeo (VAST).
          </p>
        </>
      )}
    </div>
  )
}

export default Portais2026

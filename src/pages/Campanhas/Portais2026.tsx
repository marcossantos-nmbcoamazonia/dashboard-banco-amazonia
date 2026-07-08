"use client"

import type React from "react"
import { useRef, useState, useEffect, useMemo, useCallback } from "react"
import { MousePointerClick, Eye, Play, Gauge, ArrowUpDown, Calendar, X, Globe } from "lucide-react"
import axios from "axios"
import Loading from "../../components/Loading/Loading"
import PDFDownloadButton from "../../components/PDFDownloadButton/PDFDownloadButton"
import {
  CONTRATOS_CAPITAL_DE_GIRO,
  CONTRATOS_CUSTEIO_AGRICOLA,
  DIARIA_MIN_IMPRESSOES,
  diasRestantesNoMes,
  type TipoCompra,
  type ContratoVeiculo,
} from "../../data/adserverContratos"

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface AdServerRow {
  date: string
  publisher_name: string
  impressions: string
  clicks: string
  vieweables: string
  ctr: string
  va: string
  vtr: string | null
  start: string | null        // VAST: vídeos/áudios iniciados
  complete: string | null     // VAST: concluídos
  type: string
  dimension: string
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

const stripAccents = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "")

// Chave canônica: funde as variações de nome do MESMO portal que aparecem entre os
// 6 templates e as 2 listas de contrato (ex.: "DOL" / "RBA - DOL" / "Diário do Pará - DOL").
// Rodamos tanto os nomes do AdServer quanto os dos contratos por aqui → eles colidem.
const normKey = (raw: string): string => {
  let s = stripAccents(String(raw ?? "")).toUpperCase().trim()
  s = s.replace(/\.COM(\.BR)?/g, "").replace(/\s+/g, " ").trim()

  // Áudio/Vídeo (VAST)
  if (s.startsWith("SPOT")) return "SPOTIFY" // SPOTIFY, SPOTFY (typo do adserver)
  if (s.startsWith("DEEZER")) return "DEEZER"
  if (s.startsWith("ALRIGHT")) return "ALRIGHT"
  if (s.startsWith("ZAP")) return "ZAP MEDIA"

  // Famílias com nomes divergentes entre templates/contratos
  if (s.includes("DOL")) return "DOL" // DOL, RBA - DOL, DIARIO DO PARA - DOL
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
      arr.push({
        publisher: key,
        tipo,
        quantidade: acc.hasNum ? acc.sum : null,
        formato: acc.formato,
      })
    })
    arr.sort((a, b) => TYPE_ORDER[a.tipo] - TYPE_ORDER[b.tipo])
    out.set(key, arr)
  })
  return out
})()

// ─── Página principal ─────────────────────────────────────────────────────────

const Portais2026: React.FC = () => {
  const contentRef = useRef<HTMLDivElement>(null)
  const [rows, setRows] = useState<AdServerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: "", end: "" })

  type SortCol = "publisher" | "contratado" | "impressions" | "pacingPct" | "clicks" | "ctr" | "vtr" | "va"
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
        const results = await Promise.all(
          SOURCES.map((s) =>
            axios
              .get(`https://dashbrasiladserver.com.br/api/templates/${s.id}/bi?token=${s.token}`)
              .catch(() => ({ data: [] }))
          )
        )
        const merged: AdServerRow[] = []
        results.forEach((res) => {
          if (Array.isArray(res.data)) merged.push(...(res.data as AdServerRow[]))
        })
        setRows(merged)
      } catch (err) {
        console.error("Erro ao buscar dados Portais 2026:", err)
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

  const allAdServer = useMemo(() => rows.filter((r) => inDateRange(r.date)), [rows, inDateRange])

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

    const rowsOut: {
      groupKey: string
      name: string
      rowKey: string
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
    }[] = []

    Array.from(map.entries()).forEach(([key, v]) => {
      const contratos = CONTRATOS_PORTAIS.get(key) ?? []

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
        })
      })
    })

    return rowsOut
  }, [allAdServer])

  const adServerSorted = useMemo(() => {
    // valor de ordenação por veículo (linha principal, i=0)
    const valMap = new Map<string, number | string>()
    adServerByPublisher.forEach((r) => {
      if (r.isSubrow) return
      let v: number | string = 0
      if (sortCol === "publisher") v = r.name
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

    return [...adServerByPublisher].sort((a, b) => {
      if (a.groupKey === b.groupKey) return a.isSubrow ? 1 : -1
      const vA = valMap.get(a.groupKey) ?? 0
      const vB = valMap.get(b.groupKey) ?? 0
      const cmp = typeof vA === "string" ? vA.localeCompare(vB as string) : (vB as number) - (vA as number)
      return sortDir === "asc" ? -cmp : cmp
    })
  }, [adServerByPublisher, sortCol, sortDir])

  const totals = useMemo(() => {
    const t = allAdServer.reduce(
      (acc, r) => ({
        impressions: acc.impressions + toInt(r.impressions),
        clicks: acc.clicks + toInt(r.clicks),
        vieweables: acc.vieweables + toInt(r.vieweables),
        vStart: acc.vStart + toInt(r.start),
        vComplete: acc.vComplete + toInt(r.complete),
      }),
      { impressions: 0, clicks: 0, vieweables: 0, vStart: 0, vComplete: 0 }
    )
    return {
      ...t,
      ctr: t.impressions > 0 ? (t.clicks / t.impressions) * 100 : 0,
      va: t.impressions > 0 ? (t.vieweables / t.impressions) * 100 : 0,
      vtr: t.vStart > 0 ? (t.vComplete / t.vStart) * 100 : 0,
    }
  }, [allAdServer])

  const veiculosCount = useMemo(
    () => new Set(adServerByPublisher.filter((r) => !r.isSubrow).map((r) => r.groupKey)).size,
    [adServerByPublisher]
  )

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

  if (loading) return <Loading message="Carregando portais do AdServer..." />

  const QUICK: { col: SortCol; label: string; icon: React.ReactNode }[] = [
    { col: "ctr", label: "Melhor CTR", icon: <MousePointerClick className="w-3.5 h-3.5" /> },
    { col: "vtr", label: "Melhor VTR", icon: <Play className="w-3.5 h-3.5" /> },
    { col: "impressions", label: "Maior Entrega", icon: <Eye className="w-3.5 h-3.5" /> },
    { col: "pacingPct", label: "Melhor Pacing", icon: <Gauge className="w-3.5 h-3.5" /> },
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
              <p className="text-emerald-100 text-xs font-medium mb-1 uppercase tracking-wider">Campanhas · Display AdServer</p>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <Globe className="w-6 h-6" /> Portais - 2026
              </h1>
              <p className="text-emerald-100 text-sm">Todos os veículos de display, consolidados</p>
            </div>
            <div className="text-right flex gap-4">
              <div>
                <p className="text-emerald-100 text-xs">Veículos</p>
                <p className="text-2xl font-bold text-white">{veiculosCount}</p>
              </div>
              <div>
                <p className="text-emerald-100 text-xs">Impressões</p>
                <p className="text-2xl font-bold text-white">{formatNum(totals.impressions)}</p>
              </div>
              <div>
                <p className="text-emerald-100 text-xs">Cliques</p>
                <p className="text-2xl font-bold text-white">{formatNum(totals.clicks)}</p>
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

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="card-overlay rounded-xl shadow-lg p-4 text-center">
          <p className="text-xl font-bold text-emerald-700">{formatNum(totals.impressions)}</p>
          <p className="text-xs text-gray-500 mt-1">Impressões</p>
        </div>
        <div className="card-overlay rounded-xl shadow-lg p-4 text-center">
          <p className="text-xl font-bold text-cyan-700">{formatNum(totals.clicks)}</p>
          <p className="text-xs text-gray-500 mt-1">Cliques</p>
        </div>
        <div className="card-overlay rounded-xl shadow-lg p-4 text-center">
          <p className="text-xl font-bold text-indigo-700">{totals.ctr.toFixed(2)}%</p>
          <p className="text-xs text-gray-500 mt-1">CTR</p>
        </div>
        <div className="card-overlay rounded-xl shadow-lg p-4 text-center">
          <p className="text-xl font-bold text-teal-700">{totals.vtr.toFixed(1)}%</p>
          <p className="text-xs text-gray-500 mt-1">VTR (áudio/vídeo)</p>
        </div>
        <div className="card-overlay rounded-xl shadow-lg p-4 text-center">
          <p className="text-xl font-bold text-blue-700">{totals.va.toFixed(1)}%</p>
          <p className="text-xs text-gray-500 mt-1">Viewability</p>
        </div>
      </div>

      {/* ── AdServer — tabela consolidada ── */}
      {allAdServer.length > 0 ? (
        <div className="card-overlay rounded-xl shadow-lg p-4">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h3 className="text-sm font-bold text-gray-900">Display · AdServer — {veiculosCount} veículos</h3>
            {/* Filtros rápidos */}
            <div className="flex gap-2 flex-wrap">
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
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200">
                  {(["publisher", "contratado", "impressions", "pacingPct", "clicks", "ctr", "vtr", "va"] as const).map(
                    (col) => {
                      const isActive = sortCol === col
                      const label: Record<string, string> = {
                        publisher: "Veículo",
                        impressions: "Entregue",
                        pacingPct: "Pacing",
                        contratado: "Contratado",
                        clicks: "Cliques",
                        ctr: "CTR",
                        vtr: "VTR",
                        va: "Viewability",
                      }
                      const isLeft = col === "publisher"
                      const isPacing = col === "pacingPct"
                      return (
                        <th
                          key={col}
                          onClick={() => toggleSort(col)}
                          className={`py-2 font-medium cursor-pointer select-none ${
                            isLeft ? "text-left" : isPacing ? "pl-3" : "text-right"
                          } ${isActive ? "text-emerald-700" : "text-gray-500"}`}
                        >
                          <div className={`flex items-center gap-1 ${isLeft ? "" : isPacing ? "" : "justify-end"}`}>
                            {label[col]}
                            <ArrowUpDown
                              className={`w-3 h-3 shrink-0 ${isActive ? "text-emerald-700" : "text-gray-300"}`}
                            />
                          </div>
                        </th>
                      )
                    }
                  )}
                </tr>
              </thead>
              <tbody>
                {adServerSorted.map((p) => (
                  <tr
                    key={p.rowKey}
                    className={`border-b border-gray-50 hover:bg-gray-50 ${p.isSubrow ? "bg-gray-50/60" : ""}`}
                  >
                    {/* Veículo */}
                    <td className="py-2 font-semibold text-gray-800">
                      {p.isSubrow ? <span className="pl-4 text-gray-400 font-normal">↳</span> : p.name}
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

          <p className="text-[11px] text-gray-400 mt-3 leading-snug">
            Pacing capado em 100%. Metas de veículos contratados em mais de uma campanha são somadas. VTR calculado
            somente para formatos de áudio/vídeo (VAST) — display exibe “—”.
          </p>
        </div>
      ) : (
        <div className="card-overlay rounded-xl shadow-lg p-8 text-center text-gray-400 text-sm">
          Nenhum dado de AdServer para o período selecionado.
        </div>
      )}
    </div>
  )
}

export default Portais2026

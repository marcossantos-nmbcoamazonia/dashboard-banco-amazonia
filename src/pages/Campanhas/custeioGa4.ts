// ─── Helpers do GA4 (LP Custeio Agrícola) ───────────────────────────────────
// O GA4 do LP vive na MESMA planilha do consolidado, em três ranges:
//   • "GA4"          → sessões, novos usuários, engajamento, origem (Session source)
//   • "GA4 - Events" → eventos da página (page_view, session_start, form_start...)
//   • "GA4 - Region" → sessões por estado (nomes em inglês, ex. "State of Sao Paulo")
// Cuidados de parsing observados nos dados reais:
//   • Sessions / New users / User engagement / Event count vêm como inteiros em string.
//   • "Average session duration" vem CORROMPIDA (separador de milhar explodido) →
//     não usar; o tempo médio é derivado de (User engagement / Sessions).
//   • "Bounce rate" é decimal pt-BR ("0,55") → parse com vírgula.

// Inteiro do GA4 ("199", "1.085" ou "" → number). Aceita separador de milhar pt-BR.
export const parseGA4Int = (v: unknown): number => {
  if (v === null || v === undefined || v === "") return 0
  const s = String(v).replace(/\./g, "").replace(/,/g, ".").trim()
  const n = parseFloat(s)
  return Number.isFinite(n) ? Math.round(n) : 0
}

// Taxa de rejeição pt-BR ("0,55" → 0.55; "1" → 1). Já vem como fração (0–1).
export const parseGA4Rate = (v: unknown): number => {
  if (v === null || v === undefined || v === "") return 0
  const s = String(v).replace(/\./g, "").replace(/,/g, ".").trim()
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

// Origem de tráfego "suja" do GA4 → rótulo limpo e amigável.
// Ex.: "ig" → "Instagram", "google" → "Google", "bancoamazonia.com.br" → "Banco da Amazônia".
export const prettySource = (raw: string): string => {
  const s = (raw || "").toLowerCase().trim()
  if (!s || s === "(not set)" || s === "(data not available)" || s === "(direct)") return "Direto / não definido"
  if (s === "google") return "Google"
  if (s === "ig" || s.startsWith("instagram")) return "Instagram"
  if (s === "fb" || s.startsWith("facebook")) return "Facebook"
  if (s.startsWith("zap")) return "Zap Media"
  if (s.startsWith("spotify") || s.startsWith("spotfy")) return "Spotify"
  if (s.startsWith("deezer")) return "Deezer"
  if (s.startsWith("alright")) return "Alright"
  if (s.startsWith("bancoamazonia")) return "Banco da Amazônia"
  if (s === "r7") return "R7"
  if (s === "uol") return "UOL"
  if (s === "cnn") return "CNN"
  if (s === "o_globo" || s === "globo") return "O Globo"
  if (s === "estadao") return "Estadão"
  if (s === "valor_economico") return "Valor Econômico"
  if (s === "infomoney") return "InfoMoney"
  if (s === "metropoles") return "Metrópoles"
  if (s === "veja") return "Veja"
  if (s === "exame") return "Exame"
  if (s === "ideal") return "Ideal"
  if (s === "terra") return "Terra"
  // fallback: capitaliza tokens separados por _ ou espaço
  return s.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

// Estados brasileiros (nomes canônicos que casam com o GeoJSON usado pelo BrazilMap).
const PT_STATES = [
  "Acre", "Alagoas", "Amapá", "Amazonas", "Bahia", "Ceará", "Distrito Federal",
  "Espírito Santo", "Goiás", "Maranhão", "Mato Grosso", "Mato Grosso do Sul",
  "Minas Gerais", "Pará", "Paraíba", "Paraná", "Pernambuco", "Piauí",
  "Rio de Janeiro", "Rio Grande do Norte", "Rio Grande do Sul", "Rondônia",
  "Roraima", "Santa Catarina", "São Paulo", "Sergipe", "Tocantins",
]

// Remove acentos comparando de forma robusta (sem depender de faixa de combining marks literal).
const DIACRITIC = /[̀-ͯ]/g
const asciiKey = (s: string): string =>
  s.normalize("NFD").replace(DIACRITIC, "").toLowerCase().trim()

const PT_BY_ASCII = new Map(PT_STATES.map((n) => [asciiKey(n), n]))

// "State of Sao Paulo" → "São Paulo"; "Federal District" → "Distrito Federal";
// "Ceara" → "Ceará". Retorna null para regiões fora do Brasil (New York, Friesland...).
export const normalizeRegionToPT = (region: string): string | null => {
  if (!region) return null
  let s = region.replace(/^state of\s+/i, "").trim()
  if (asciiKey(s) === "federal district") s = "Distrito Federal"
  return PT_BY_ASCII.get(asciiKey(s)) ?? null
}

// Sigla de UF a partir do nome PT (para rótulos compactos no ranking).
export const ufSigla = (nomePT: string): string => {
  const M: Record<string, string> = {
    "Acre": "AC", "Alagoas": "AL", "Amapá": "AP", "Amazonas": "AM", "Bahia": "BA",
    "Ceará": "CE", "Distrito Federal": "DF", "Espírito Santo": "ES", "Goiás": "GO",
    "Maranhão": "MA", "Mato Grosso": "MT", "Mato Grosso do Sul": "MS", "Minas Gerais": "MG",
    "Pará": "PA", "Paraíba": "PB", "Paraná": "PR", "Pernambuco": "PE", "Piauí": "PI",
    "Rio de Janeiro": "RJ", "Rio Grande do Norte": "RN", "Rio Grande do Sul": "RS",
    "Rondônia": "RO", "Roraima": "RR", "Santa Catarina": "SC", "São Paulo": "SP",
    "Sergipe": "SE", "Tocantins": "TO",
  }
  return M[nomePT] ?? nomePT
}

// Rótulos amigáveis + ordem canônica do funil de eventos da página.
export const EVENT_LABELS: Record<string, string> = {
  "session_start": "Sessões iniciadas",
  "page_view": "Visualizações de página",
  "first_visit": "Primeiras visitas",
  "user_engagement": "Engajamento",
  "scroll": "Rolagem (90%)",
  "form_start": "Início de formulário",
  "RD Landing Pages": "RD Landing Pages",
}

// Rampa sequencial azul (Banco da Amazônia) para barras de magnitude.
// t ∈ [0,1] → do azul claro ao azul escuro da marca.
export const blueRamp = (t: number): string => {
  const c = Math.max(0, Math.min(1, t))
  const lerp = (a: number, b: number) => Math.round(a + (b - a) * c)
  // #cfe6f5 (claro) → #2d6fa3 (escuro)
  const r = lerp(0xcf, 0x2d)
  const g = lerp(0xe6, 0x6f)
  const b = lerp(0xf5, 0xa3)
  return `rgb(${r},${g},${b})`
}

import axios from "axios"

const API_KEY = process.env.REACT_APP_GEMINI_API
const MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
]

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const callGemini = async (prompt: string): Promise<string> => {
  const payload = { contents: [{ parts: [{ text: prompt }] }] }

  let lastError: Error | null = null

  for (let i = 0; i < MODELS.length; i++) {
    const model = MODELS[i]
    try {
      console.log(`[${i + 1}/${MODELS.length}] Tentando modelo: ${model}...`)
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`
      const res = await axios.post(url, payload, {
        headers: { "Content-Type": "application/json" },
        timeout: 30000,
      })
      if (res.status === 200 && res.data.candidates?.length > 0) {
        console.log(`✅ Sucesso com modelo: ${model}`)
        return res.data.candidates[0].content.parts[0].text
      }
      lastError = new Error(`Modelo ${model} não retornou conteúdo válido`)
    } catch (err: any) {
      const status = err?.response?.status
      const msg = err?.response?.data?.error?.message || err.message
      console.warn(`⚠️ Modelo ${model} falhou: ${status} - ${msg}`)
      lastError = err

      if (status === 400 || status === 403 || status === 401) {
        throw new Error(`Erro fatal na API Gemini (${status}): ${msg}`)
      }

      // 429/503/500 → aguarda e tenta próximo modelo
      if (i < MODELS.length - 1) {
        const delay = status === 429 ? 5000 : 2000
        console.log(`🔄 Aguardando ${delay}ms antes de tentar próximo modelo...`)
        await sleep(delay)
      }
    }
  }

  throw new Error(
    `Todos os modelos Gemini falharam. Último erro: ${lastError?.message || "Desconhecido"}. Tente novamente em alguns minutos.`
  )
}

interface CapitalDeGiroData {
  totals: {
    cost: number
    leads: number
    impressions: number
    clicks: number
    videoViews: number
    ctr: number
    cpl: number
    vtr: number
  }
  adServerTotals: {
    impressions: number
    clicks: number
    vieweables: number
    ctr: number
    va: number
    quantidade_contratada: number
  }
  metaLeadsTotal: number
  lpSummary: { visits_count: number; conversion_count: number; conversion_rate: number } | null
  byVeiculo: { name: string; impressions: number; clicks: number; leads: number; cost: number; ctr: number; cpl: number }[]
  adServerByPublisher: { name: string; impressions: number; clicks: number; ctr: number; va: number }[]
}

export const analyzeCapitalDeGiro = async (data: CapitalDeGiroData): Promise<string> => {
  const fmt = (n: number) => new Intl.NumberFormat("pt-BR").format(Math.round(n))
  const fmtPct = (n: number) => `${(n * 100).toFixed(2)}%`
  const fmtCur = (n: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n)

  const totalImpressions = data.totals.impressions + data.adServerTotals.impressions
  const totalClicks = data.totals.clicks + data.adServerTotals.clicks
  const totalLeads = data.totals.leads + (data.lpSummary?.conversion_count ?? 0)
  const entregaPct = data.adServerTotals.quantidade_contratada > 0
    ? ((data.adServerTotals.impressions / data.adServerTotals.quantidade_contratada) * 100).toFixed(1)
    : "—"

  const veiculosTexto = data.byVeiculo.map(v =>
    `  • ${v.name}: ${fmt(v.impressions)} imp, ${fmt(v.clicks)} cliques, CTR ${fmtPct(v.ctr)}, ${fmt(v.leads)} leads, CPL ${fmtCur(v.cpl)}`
  ).join("\n")

  const publishersTexto = data.adServerByPublisher.slice(0, 8).map(p =>
    `  • ${p.name}: ${fmt(p.impressions)} imp, CTR ${p.ctr.toFixed(2)}%, Viewability ${p.va.toFixed(1)}%`
  ).join("\n")

  const prompt = `Você é um analista de performance de mídia digital especializado em campanhas de crédito bancário.
Analise a campanha "Capital de Giro" do Banco da Amazônia com base nos dados abaixo.

═══════════════════════════════════════
DADOS CONSOLIDADOS DA CAMPANHA
═══════════════════════════════════════

📊 REDES SOCIAIS (Meta/LinkedIn):
  Investimento: ${fmtCur(data.totals.cost)}
  Impressões: ${fmt(data.totals.impressions)}
  Cliques: ${fmt(data.totals.clicks)}
  CTR: ${fmtPct(data.totals.ctr)}
  Leads (formulário): ${fmt(data.totals.leads)}
  Visualizações de vídeo: ${fmt(data.totals.videoViews)}
  VTR: ${fmtPct(data.totals.vtr)}
  CPL (Custo por Lead): ${fmtCur(data.totals.cpl)}

📊 PERFORMANCE POR VEÍCULO (Redes Sociais):
${veiculosTexto}

📊 DISPLAY (AdServer):
  Impressões entregues: ${fmt(data.adServerTotals.impressions)}
  Impressões contratadas: ${fmt(data.adServerTotals.quantidade_contratada)}
  Entrega: ${entregaPct}%
  Cliques: ${fmt(data.adServerTotals.clicks)}
  CTR: ${data.adServerTotals.ctr.toFixed(2)}%
  Viewability: ${data.adServerTotals.va.toFixed(1)}%

📊 TOP PUBLISHERS (Display):
${publishersTexto}

📊 LANDING PAGE (RD Station):
  Visitantes: ${fmt(data.lpSummary?.visits_count ?? 0)}
  Leads LP: ${fmt(data.lpSummary?.conversion_count ?? 0)}
  Taxa de Conversão LP: ${data.lpSummary?.conversion_rate.toFixed(1) ?? "—"}%

📊 LEADS META (Formulário Tempo Real): ${fmt(data.metaLeadsTotal)}

📊 TOTAIS COMBINADOS:
  Total Impressões (Social + Display): ${fmt(totalImpressions)}
  Total Cliques: ${fmt(totalClicks)}
  Total Leads: ${fmt(totalLeads)}

═══════════════════════════════════════
REGRAS PARA ANÁLISE
═══════════════════════════════════════
- Compare a performance entre os canais (Social vs Display vs LP)
- Identifique quais veículos e publishers estão performando melhor/pior
- Avalie a eficiência de conversão (Lead → LP)
- Comente sobre a entrega do Display vs meta contratada
- Identifique pontos de atenção e destaques positivos
- Use benchmarks típicos do mercado financeiro: CTR Social ~1-2%, CTR Display ~0.1-0.3%, Viewability Display >50%, Taxa Conversão LP ~10-20%
- Seja direto e factual, foque na leitura dos dados
- NÃO dê sugestões ou recomendações
- Use português profissional
- Cite números específicos

FORMATO: Exatamente 3 parágrafos curtos:
1. Performance geral e investimento
2. Análise por canal (Social vs Display vs LP)
3. Destaques positivos e pontos de atenção`

  return callGemini(prompt)
}

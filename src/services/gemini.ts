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
  if (!API_KEY) {
    throw new Error(
      "Chave da API Gemini não configurada. Verifique a variável REACT_APP_GEMINI_API no arquivo .env e reinicie o servidor de desenvolvimento."
    )
  }

  const payload = { contents: [{ parts: [{ text: prompt }] }] }

  let lastError: Error | null = null

  for (let i = 0; i < MODELS.length; i++) {
    const model = MODELS[i]
    try {
      console.log(`[${i + 1}/${MODELS.length}] Tentando modelo: ${model}...`)
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
      const res = await axios.post(url, payload, {
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": API_KEY,
        },
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

      if (status === 403 || status === 401) {
        throw new Error(`Erro fatal na API Gemini (${status}): ${msg}`)
      }

      // 400/429/503/500 → aguarda e tenta próximo modelo
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
  googleAdsLeads?: number
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
  // Desconta os leads do Google Ads (já contabilizados nas conversões da LP) para não duplicar
  const totalLeads = data.totals.leads - (data.googleAdsLeads ?? 0) + (data.lpSummary?.conversion_count ?? 0)
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
  Conversões LP: ${fmt(data.lpSummary?.conversion_count ?? 0)}
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

// ─── Portais 2026 (Display AdServer — Nacionais x Regionais) ────────────────────

interface PortaisVeiculo {
  name: string
  impressions: number
  clicks: number
  ctr: number
  va: number
  vtr: number | null
  pacingPct: number
  investimento: number
}

interface PortaisBloco {
  veiculos: PortaisVeiculo[]
  impressions: number
  clicks: number
  ctr: number
  va: number
  vtr: number
  investimento: number
}

interface PortaisData {
  nacional: PortaisBloco
  regional: PortaisBloco
  periodo: { inicio: string; fim: string }
}

export const analyzePortais = async (data: PortaisData): Promise<string> => {
  const fmt = (n: number) => new Intl.NumberFormat("pt-BR").format(Math.round(n))
  const fmtCur = (n: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n)

  const bloco = (b: PortaisBloco) =>
    b.veiculos
      .slice(0, 15)
      .map(
        (v) =>
          `  • ${v.name}: ${fmt(v.impressions)} imp, ${fmt(v.clicks)} cliques, CTR ${v.ctr.toFixed(2)}%, VTR ${
            v.vtr !== null ? v.vtr.toFixed(1) + "%" : "—"
          }, Viewab. ${v.va.toFixed(1)}%, Pacing ${v.pacingPct.toFixed(0)}%, Invest. ${
            v.investimento > 0 ? fmtCur(v.investimento) : "—"
          }`
      )
      .join("\n")

  const prompt = `Você é um analista de performance de mídia digital (display programático / AdServer).
Faça a leitura de performance dos PORTAIS da campanha do Banco da Amazônia em 2026, separados em Nacionais e Regionais.

═══════════════════════════════════════
PERÍODO: ${data.periodo.inicio} a ${data.periodo.fim}
═══════════════════════════════════════

📊 PORTAIS NACIONAIS (${data.nacional.veiculos.length} veículos)
  Investimento total: ${fmtCur(data.nacional.investimento)}
  Impressões: ${fmt(data.nacional.impressions)} | Cliques: ${fmt(data.nacional.clicks)} | CTR ${data.nacional.ctr.toFixed(2)}% | VTR ${data.nacional.vtr.toFixed(1)}% | Viewability ${data.nacional.va.toFixed(1)}%
${bloco(data.nacional)}

📊 PORTAIS REGIONAIS (${data.regional.veiculos.length} veículos)
  Investimento total: ${fmtCur(data.regional.investimento)}
  Impressões: ${fmt(data.regional.impressions)} | Cliques: ${fmt(data.regional.clicks)} | CTR ${data.regional.ctr.toFixed(2)}% | VTR ${data.regional.vtr.toFixed(1)}% | Viewability ${data.regional.va.toFixed(1)}%
${bloco(data.regional)}

═══════════════════════════════════════
REGRAS PARA ANÁLISE
═══════════════════════════════════════
- Compare Portais Nacionais vs Regionais (entrega, CTR, viewability, pacing e investimento)
- Aponte os veículos com melhor e pior performance em CTR, VTR e Viewability
- Comente o pacing (entrega vs contratado) — destaque quem está claramente abaixo do esperado
- Quando houver investimento informado, comente eficiência (relação investimento x entrega/cliques)
- Benchmarks display: CTR ~0,05% a 0,30%, Viewability acima de 50%
- Seja direto e factual, foque na leitura dos dados; cite números específicos
- NÃO dê sugestões ou recomendações
- Use português profissional

FORMATO: Exatamente 3 parágrafos curtos:
1. Panorama geral (nacionais + regionais, entrega e investimento)
2. Comparação Nacionais x Regionais e destaques por veículo (CTR / VTR / Viewability)
3. Pacing e pontos de atenção`

  return callGemini(prompt)
}

interface CusteioAgricolaData {
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
  googleAdsLeads?: number
  lpSummary: { visits_count: number; conversion_count: number; conversion_rate: number } | null
  byVeiculo: { name: string; impressions: number; clicks: number; leads: number; cost: number; ctr: number; cpl: number }[]
  adServerByPublisher: { name: string; impressions: number; clicks: number; ctr: number; va: number }[]
}

export const analyzeCusteioAgricola = async (data: CusteioAgricolaData): Promise<string> => {
  const fmt = (n: number) => new Intl.NumberFormat("pt-BR").format(Math.round(n))
  const fmtPct = (n: number) => `${(n * 100).toFixed(2)}%`
  const fmtCur = (n: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n)

  const totalImpressions = data.totals.impressions + data.adServerTotals.impressions
  const totalClicks = data.totals.clicks + data.adServerTotals.clicks
  // Desconta os leads do Google Ads (já contabilizados nas conversões da LP) para não duplicar
  const totalLeads = data.totals.leads - (data.googleAdsLeads ?? 0) + (data.lpSummary?.conversion_count ?? 0)
  const entregaPct = data.adServerTotals.quantidade_contratada > 0
    ? ((data.adServerTotals.impressions / data.adServerTotals.quantidade_contratada) * 100).toFixed(1)
    : "—"

  const veiculosTexto = data.byVeiculo.map(v =>
    `  • ${v.name}: ${fmt(v.impressions)} imp, ${fmt(v.clicks)} cliques, CTR ${fmtPct(v.ctr)}, ${fmt(v.leads)} leads, CPL ${fmtCur(v.cpl)}`
  ).join("\n")

  const publishersTexto = data.adServerByPublisher.slice(0, 8).map(p =>
    `  • ${p.name}: ${fmt(p.impressions)} imp, CTR ${p.ctr.toFixed(2)}%, Viewability ${p.va.toFixed(1)}%`
  ).join("\n")

  const prompt = `Você é um analista de performance de mídia digital especializado em campanhas de crédito rural e agronegócio.
Analise a campanha "Custeio Agrícola" do Banco da Amazônia, gerenciada pela agência Escala, com base nos dados abaixo.

═══════════════════════════════════════
DADOS CONSOLIDADOS DA CAMPANHA
═══════════════════════════════════════

📊 REDES SOCIAIS (Meta):
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

📊 DISPLAY/ÁUDIO (AdServer):
  Impressões entregues: ${fmt(data.adServerTotals.impressions)}
  Impressões contratadas: ${fmt(data.adServerTotals.quantidade_contratada)}
  Entrega: ${entregaPct}%
  Cliques: ${fmt(data.adServerTotals.clicks)}
  CTR: ${data.adServerTotals.ctr.toFixed(2)}%
  Viewability: ${data.adServerTotals.va.toFixed(1)}%

📊 TOP PUBLISHERS (Display/Áudio):
${publishersTexto}

📊 LANDING PAGE (RD Station):
  Visitantes: ${fmt(data.lpSummary?.visits_count ?? 0)}
  Conversões LP: ${fmt(data.lpSummary?.conversion_count ?? 0)}
  Taxa de Conversão LP: ${data.lpSummary?.conversion_rate.toFixed(1) ?? "—"}%

📊 LEADS META (Formulário): ${fmt(data.metaLeadsTotal)}

📊 TOTAIS COMBINADOS:
  Total Impressões (Social + Display): ${fmt(totalImpressions)}
  Total Cliques: ${fmt(totalClicks)}
  Total Leads: ${fmt(totalLeads)}

═══════════════════════════════════════
REGRAS PARA ANÁLISE
═══════════════════════════════════════
- Compare a performance entre os canais (Social vs Display/Áudio vs LP)
- Identifique quais veículos e publishers estão performando melhor/pior
- Avalie a eficiência de conversão (Lead → LP)
- Comente sobre a entrega do Display vs meta contratada
- Identifique pontos de atenção e destaques positivos
- Use benchmarks típicos do mercado financeiro/agronegócio: CTR Social ~1-2%, CTR Display ~0.1-0.3%, Viewability Display >50%, Taxa Conversão LP ~10-20%
- Seja direto e factual, foque na leitura dos dados
- NÃO dê sugestões ou recomendações
- Use português profissional
- Cite números específicos

FORMATO: Exatamente 3 parágrafos curtos:
1. Performance geral e investimento
2. Análise por canal (Social vs Display/Áudio vs LP)
3. Destaques positivos e pontos de atenção`

  return callGemini(prompt)
}

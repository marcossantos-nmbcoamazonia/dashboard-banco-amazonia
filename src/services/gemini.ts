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
  // ── Site (GA4) e leads (RD) — opcionais para retrocompatibilidade ──
  ga4?: {
    sessions: number
    newUsers: number
    avgEngagementSec: number
    bounceRate: number
    topSources: { name: string; sessions: number }[]
    topRegions: { name: string; sessions: number }[]
    events?: { name: string; count: number }[]
  }
  leadsTotal?: number
}

export const analyzeCusteioAgricola = async (data: CusteioAgricolaData): Promise<string> => {
  const fmt = (n: number) => new Intl.NumberFormat("pt-BR").format(Math.round(n))
  const fmtPct = (n: number) => `${(n * 100).toFixed(2)}%`
  const fmtCur = (n: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n)

  const totalImpressions = data.totals.impressions + data.adServerTotals.impressions
  const totalClicks = data.totals.clicks + data.adServerTotals.clicks
  // Leads da campanha = conversões da LP (RD Station). Fonte única de leads do site.
  const totalLeads = data.leadsTotal ?? data.lpSummary?.conversion_count ?? 0
  const entregaPct = data.adServerTotals.quantidade_contratada > 0
    ? ((data.adServerTotals.impressions / data.adServerTotals.quantidade_contratada) * 100).toFixed(1)
    : "—"

  const veiculosTexto = data.byVeiculo.map(v =>
    `  • ${v.name}: ${fmt(v.impressions)} imp, ${fmt(v.clicks)} cliques, CTR ${fmtPct(v.ctr)}, ${fmt(v.leads)} leads, CPL ${fmtCur(v.cpl)}`
  ).join("\n")

  const publishersTexto = data.adServerByPublisher.slice(0, 8).map(p =>
    `  • ${p.name}: ${fmt(p.impressions)} imp, CTR ${p.ctr.toFixed(2)}%, Viewability ${p.va.toFixed(1)}%`
  ).join("\n")

  // ── Site (GA4) ──
  const ga4Texto = data.ga4 && data.ga4.sessions > 0
    ? `📊 SITE / LANDING PAGE (Google Analytics 4):
  Sessões: ${fmt(data.ga4.sessions)}
  Novos usuários: ${fmt(data.ga4.newUsers)}
  Tempo médio de engajamento: ${Math.round(data.ga4.avgEngagementSec)}s
  Taxa de rejeição: ${(data.ga4.bounceRate * 100).toFixed(1)}%
  Veículos que mais trouxeram acessos:
${data.ga4.topSources.slice(0, 6).map(s => `    • ${s.name}: ${fmt(s.sessions)} sessões`).join("\n")}
  Regiões com mais acessos:
${data.ga4.topRegions.slice(0, 6).map(r => `    • ${r.name}: ${fmt(r.sessions)} sessões`).join("\n")}${data.ga4.events?.length ? `
  Principais eventos na página:
${data.ga4.events.slice(0, 6).map(e => `    • ${e.name}: ${fmt(e.count)}`).join("\n")}` : ""}
`
    : ""

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

${ga4Texto}
📊 LEADS (RD Station — Landing Page):
  Total de leads (conversões): ${fmt(totalLeads)}
  Taxa de Conversão LP: ${data.lpSummary?.conversion_rate.toFixed(1) ?? "—"}%

📊 LEADS META (Formulário): ${fmt(data.metaLeadsTotal)}

📊 TOTAIS COMBINADOS:
  Total Impressões (Social + Display): ${fmt(totalImpressions)}
  Total Cliques: ${fmt(totalClicks)}
  Sessões no site (GA4): ${fmt(data.ga4?.sessions ?? 0)}
  Total Leads (RD): ${fmt(totalLeads)}

═══════════════════════════════════════
REGRAS PARA ANÁLISE
═══════════════════════════════════════
- Compare a performance entre os canais (Social vs Display/Áudio vs Site/GA4 vs Leads)
- Identifique quais veículos e publishers estão performando melhor/pior
- Comente a origem dos acessos ao site (GA4) e as regiões de maior audiência
- Avalie a eficiência do funil: impressões → cliques → sessões no site → leads
- Comente sobre a entrega do Display vs meta contratada
- Identifique pontos de atenção e destaques positivos
- Use benchmarks típicos do mercado financeiro/agronegócio: CTR Social ~1-2%, CTR Display ~0.1-0.3%, Viewability Display >50%, Taxa de rejeição site <60%
- Seja direto e factual, foque na leitura dos dados
- NÃO dê sugestões ou recomendações
- Use português profissional
- Cite números específicos

FORMATO: Exatamente 3 parágrafos curtos:
1. Performance geral, investimento e funil (mídia → site → leads)
2. Análise por canal (Social vs Display/Áudio) e do site/GA4 (sessões, origem, regiões)
3. Destaques positivos e pontos de atenção`

  return callGemini(prompt)
}

// ─── Capital de Giro | Etapa 2 (campanha em andamento: AdServer + Plano + GA4) ──

interface CapitalGiroEtapa2Data {
  adServer: {
    impressions: number
    clicks: number
    ctr: number
    viewability: number
    contratado: number
    pacing: number
    topVeiculos: { name: string; categoria: string; contratado: number; impressions: number; clicks: number; ctr: number; viewability: number; pacingPct: number }[]
  }
  ga4: {
    sessions: number
    newUsers: number
    avgEngagementSec: number
    bounceRate: number
    topSources: { name: string; sessions: number }[]
    topRegions: { name: string; sessions: number }[]
    topCities: { name: string; sessions: number }[]
  } | null
  redes?: {
    cost: number; impressions: number; clicks: number; ctr: number; leads: number; cpl: number
    byVeiculo: { name: string; cost: number; impressions: number; clicks: number; ctr: number; leads: number; cpl: number }[]
  } | null
  plano: { investimento: number; execucao: number; total: number }
}

export const analyzeCapitalGiroEtapa2 = async (data: CapitalGiroEtapa2Data): Promise<string> => {
  const fmt = (n: number) => new Intl.NumberFormat("pt-BR").format(Math.round(n))
  const fmtCur = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n)

  const veiculosTexto = data.adServer.topVeiculos.map(v =>
    `  • ${v.name} (${v.categoria}): ${fmt(v.impressions)} imp de ${fmt(v.contratado)} contratadas (pacing ${v.pacingPct.toFixed(0)}%), CTR ${(v.ctr * 100).toFixed(2)}%, Viewability ${(v.viewability * 100).toFixed(1)}%`
  ).join("\n")

  const temRedes = !!data.redes && data.redes.impressions > 0
  const redesTexto = temRedes
    ? `📊 REDES SOCIAIS (Meta — consolidado):
  Investimento: ${fmtCur(data.redes!.cost)}
  Impressões: ${fmt(data.redes!.impressions)}
  Cliques: ${fmt(data.redes!.clicks)}  ·  CTR: ${(data.redes!.ctr * 100).toFixed(2)}%
  Leads (formulário): ${fmt(data.redes!.leads)}  ·  CPL: ${fmtCur(data.redes!.cpl)}
  Por veículo:
${data.redes!.byVeiculo.map(v => `    • ${v.name}: ${fmt(v.impressions)} imp, CTR ${(v.ctr * 100).toFixed(2)}%, ${fmt(v.leads)} leads, CPL ${fmtCur(v.cpl)}`).join("\n")}
`
    : ""

  const ga4Texto = data.ga4 && data.ga4.sessions > 0
    ? `📊 SITE / LANDING PAGE (Google Analytics 4):
  Sessões: ${fmt(data.ga4.sessions)}
  Novos usuários: ${fmt(data.ga4.newUsers)}
  Tempo médio de engajamento: ${Math.round(data.ga4.avgEngagementSec)}s
  Taxa de rejeição: ${(data.ga4.bounceRate * 100).toFixed(1)}%
  Canais que mais trouxeram acessos:
${data.ga4.topSources.slice(0, 6).map(s => `    • ${s.name}: ${fmt(s.sessions)} sessões`).join("\n")}
  Regiões com mais acessos:
${data.ga4.topRegions.slice(0, 6).map(r => `    • ${r.name}: ${fmt(r.sessions)} sessões`).join("\n")}
  Cidades com mais acessos:
${data.ga4.topCities.slice(0, 6).map(c => `    • ${c.name}: ${fmt(c.sessions)} sessões`).join("\n")}
`
    : "📊 SITE / GA4: sem dados de sessões no período.\n"

  const prompt = `Você é um analista de performance de mídia digital especializado em campanhas de crédito e produtos financeiros (linha "Capital de Giro" do Banco da Amazônia, gerenciada pela agência Cálix).
Esta é a "Etapa 2" da campanha, que AINDA ESTÁ EM ANDAMENTO — os dados são parciais: Display (AdServer), Plano de Mídia (planejamento), site (GA4)${temRedes ? " e Redes Sociais (Meta)" : ""}.${temRedes ? "" : " Ainda NÃO há dados de redes sociais nem de leads; NÃO invente esses números."}

═══════════════════════════════════════
DADOS DISPONÍVEIS
═══════════════════════════════════════

📊 PLANO DE MÍDIA (planejado):
  Investimento em mídia: ${fmtCur(data.plano.investimento)}
  Execução de projetos: ${fmtCur(data.plano.execucao)}
  Total planejado: ${fmtCur(data.plano.total)}

📊 DISPLAY (AdServer):
  Impressões entregues: ${fmt(data.adServer.impressions)}
  Impressões contratadas: ${fmt(data.adServer.contratado)}
  Pacing geral: ${data.adServer.pacing.toFixed(1)}%
  Cliques: ${fmt(data.adServer.clicks)}
  CTR: ${(data.adServer.ctr * 100).toFixed(2)}%
  Viewability: ${(data.adServer.viewability * 100).toFixed(1)}%

📊 VEÍCULOS (Display):
${veiculosTexto}

${redesTexto}${ga4Texto}
═══════════════════════════════════════
REGRAS PARA ANÁLISE
═══════════════════════════════════════
- Deixe claro que a campanha está em andamento e os dados são parciais
- Avalie a entrega vs contratado (pacing) e a qualidade (CTR, Viewability) do Display
- Destaque veículos adiantados/atrasados no pacing
${temRedes ? "- Comente as Redes Sociais (Meta): investimento, CTR, leads e CPL, e o veículo de melhor desempenho\n" : ""}- Comente os acessos ao site (GA4): volume, canais de origem e regiões/cidades de maior audiência
- Use benchmarks: CTR Display ~0.1-0.3%, CTR Social ~1-2%, Viewability Display >50%, Taxa de rejeição site <60%
- Seja direto e factual; NÃO dê recomendações; use português profissional; cite números
${temRedes ? "" : "- NÃO mencione redes sociais nem leads (não há dados)\n"}
FORMATO: Exatamente 3 parágrafos curtos:
1. Visão geral (campanha em andamento), investimento planejado e entrega do Display (pacing)
2. ${temRedes ? "Qualidade do Display (CTR/Viewability) e desempenho das Redes Sociais (leads/CPL)" : "Qualidade do Display (CTR/Viewability) e destaques por veículo"}
3. Acessos ao site (GA4): canais, regiões/cidades e pontos de atenção`

  return callGemini(prompt)
}

// ─── Círio 2026 (Escala — campanha de alcance/visualização, SEM leads) ──────────

interface Cirio2026Data {
  periodo: string
  investimento: { plano: number; redes: number; total: number }
  redes: {
    cost: number; impressions: number; clicks: number; ctr: number; cpm: number; videoViews: number; vtr: number
    byVeiculo: { name: string; cost: number; impressions: number; clicks: number; ctr: number; cpm: number; videoViews: number; vtr: number }[]
  } | null
  display: {
    sites: { name: string; tipo: string; contratado: number; entregue: number; pacingPct: number; clicks: number; ctr: number; viewability: number; vtr: number }[]
  } | null
  ga4: {
    sessions: number
    newUsers: number
    avgEngagementSec: number
    bounceRate: number
    topSources: { name: string; sessions: number }[]
    topFormatos: { name: string; sessions: number }[]
    topRegions: { name: string; sessions: number }[]
    topCities: { name: string; sessions: number }[]
  } | null
}

export const analyzeCirio2026 = async (data: Cirio2026Data): Promise<string> => {
  const fmt = (n: number) => new Intl.NumberFormat("pt-BR").format(Math.round(n))
  const fmtPct = (n: number) => `${(n * 100).toFixed(2)}%`
  const fmtCur = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n)

  const redesTexto = data.redes && data.redes.impressions > 0
    ? `📊 REDES SOCIAIS (Meta + YouTube — consolidado, realizado):
  Investimento: ${fmtCur(data.redes.cost)}
  Impressões: ${fmt(data.redes.impressions)}  ·  CPM: ${fmtCur(data.redes.cpm)}
  Cliques: ${fmt(data.redes.clicks)}  ·  CTR: ${fmtPct(data.redes.ctr)}
  Visualizações de vídeo: ${fmt(data.redes.videoViews)}  ·  VTR: ${fmtPct(data.redes.vtr)}
  Por veículo:
${data.redes.byVeiculo.map(v => `    • ${v.name}: ${fmtCur(v.cost)}, ${fmt(v.impressions)} imp (CPM ${fmtCur(v.cpm)}), CTR ${fmtPct(v.ctr)}, ${fmt(v.videoViews)} views, VTR ${fmtPct(v.vtr)}`).join("\n")}
`
    : ""

  const displayTexto = data.display && data.display.sites.length > 0
    ? `📊 DISPLAY / VÍDEO PROGRAMÁTICO (AdServer):
${data.display.sites.map(s => `  • ${s.name} (${s.tipo}): ${fmt(s.entregue)} ${s.tipo === "CPV" ? "vídeos completos" : "impressões"} de ${fmt(s.contratado)} contratados (pacing ${s.pacingPct.toFixed(0)}%), ${fmt(s.clicks)} cliques, CTR ${fmtPct(s.ctr)}, Viewability ${fmtPct(s.viewability)}${s.tipo === "CPV" ? `, VTR ${fmtPct(s.vtr)}` : ""}`).join("\n")}
`
    : ""

  const ga4Texto = data.ga4 && data.ga4.sessions > 0
    ? `📊 SITE (Google Analytics 4 — tráfego da campanha):
  Sessões: ${fmt(data.ga4.sessions)}
  Novos usuários: ${fmt(data.ga4.newUsers)}
  Tempo médio de engajamento: ${Math.round(data.ga4.avgEngagementSec)}s
  Taxa de rejeição: ${(data.ga4.bounceRate * 100).toFixed(1)}%
  Origens que mais trouxeram acessos:
${data.ga4.topSources.slice(0, 6).map(s => `    • ${s.name}: ${fmt(s.sessions)} sessões`).join("\n")}
  Formatos/peças que mais trouxeram acessos:
${data.ga4.topFormatos.slice(0, 6).map(f => `    • ${f.name}: ${fmt(f.sessions)} sessões`).join("\n")}
  Estados com mais acessos:
${data.ga4.topRegions.slice(0, 6).map(r => `    • ${r.name}: ${fmt(r.sessions)} sessões`).join("\n")}
  Cidades com mais acessos:
${data.ga4.topCities.slice(0, 6).map(c => `    • ${c.name}: ${fmt(c.sessions)} sessões`).join("\n")}
`
    : "📊 SITE / GA4: sem dados de sessões no período.\n"

  const prompt = `Você é um analista de performance de mídia especializado em campanhas institucionais e de marca.
Analise a campanha "Círio 2026" do Banco da Amazônia (Círio de Nazaré, Belém/PA), gerenciada pela agência Escala.
A campanha está EM ANDAMENTO (${data.periodo || "período não informado"}) e tem objetivo de alcance, visualização de vídeo e tráfego para o site. NÃO há leads nem conversões nesta campanha.

═══════════════════════════════════════
DADOS DA CAMPANHA
═══════════════════════════════════════

📊 INVESTIMENTO:
  Plano de mídia (contratado — TV, DOOH e internet): ${fmtCur(data.investimento.plano)}
  Redes sociais (realizado): ${fmtCur(data.investimento.redes)}
  Total: ${fmtCur(data.investimento.total)}

${redesTexto}
${displayTexto}
${ga4Texto}
═══════════════════════════════════════
REGRAS PARA ANÁLISE
═══════════════════════════════════════
- Deixe claro que a campanha está em andamento e os dados são parciais
- Avalie alcance e eficiência de mídia: impressões, CPM, visualizações e VTR dos vídeos
- Avalie a entrega do AdServer vs contratado (pacing) e a qualidade (CTR, Viewability)
- Comente os acessos ao site (GA4): volume, origens, formatos/peças e regiões/cidades
- Use benchmarks: CTR Display ~0.1-0.3%, CTR Social ~1-2%, Viewability Display >50%, Taxa de rejeição site <60%
- NÃO mencione leads, conversões, CPL ou formulários (não fazem parte desta campanha)
- Seja direto e factual; NÃO dê recomendações; use português profissional; cite números

FORMATO: Exatamente 3 parágrafos curtos:
1. Visão geral (campanha em andamento), investimento e alcance total (impressões e visualizações)
2. Redes sociais (YouTube/Meta) e Display/vídeo programático (pacing, CTR, Viewability, VTR)
3. Acessos ao site (GA4): origens, formatos, regiões/cidades, destaques e pontos de atenção`

  return callGemini(prompt)
}

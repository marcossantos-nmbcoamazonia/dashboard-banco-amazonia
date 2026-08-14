// Proxy serverless (Vercel) para a API GraphQL do AdServer (graphql.00px.com.br).
// Resolve o CORS (a API não envia Access-Control-Allow-Origin) e injeta o
// User-Agent exigido pela API (sem ele responde 403). Host fixo → não é proxy aberto.
//
// Frontend chama: /api/adserver?path=<QUERY_B64/FILTER_B64 (url-encoded)>&s=<signature>
// e recebe o JSON { campaign: {...} } já com CORS liberado.

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS")
  if (req.method === "OPTIONS") { res.status(204).end(); return }

  const path = typeof req.query.path === "string" ? req.query.path : ""
  const s = typeof req.query.s === "string" ? req.query.s : ""
  if (!path) { res.status(400).json({ error: "missing path" }); return }

  // Host travado: só proxeia a API do AdServer.
  const url = `https://graphql.00px.com.br/bi/${path}?s=${s}&`
  try {
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; NMB-Dashboard/1.0)" } })
    const text = await r.text()
    res.setHeader("Content-Type", "application/json; charset=utf-8")
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600")
    res.status(r.status).send(text)
  } catch (e) {
    res.status(502).json({ error: String((e && e.message) || e) })
  }
}

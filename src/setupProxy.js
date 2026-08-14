// Proxy do dev server (react-scripts / `npm start`) — espelha a função Vercel
// `/api/adserver` para o AdServer GraphQL (graphql.00px.com.br), resolvendo o CORS
// e injetando o User-Agent exigido. Em produção quem responde é `api/adserver.js` (Vercel).
const axios = require("axios")

module.exports = function (app) {
  app.get("/api/adserver", async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*")
    const path = typeof req.query.path === "string" ? req.query.path : ""
    const s = typeof req.query.s === "string" ? req.query.s : ""
    if (!path) { res.status(400).json({ error: "missing path" }); return }
    const url = `https://graphql.00px.com.br/bi/${path}?s=${s}&`
    try {
      const r = await axios.get(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; NMB-Dashboard/1.0)" },
        responseType: "json",
        timeout: 90000,
      })
      res.status(200).json(r.data)
    } catch (e) {
      res.status(502).json({ error: String((e && e.message) || e) })
    }
  })
}

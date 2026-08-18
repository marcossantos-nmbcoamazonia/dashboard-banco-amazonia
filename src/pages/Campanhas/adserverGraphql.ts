// ─── AdServer (GraphQL 00px) — Capital de Giro | Etapa 2 ────────────────────────
// A API entrega a query e o filtro em base64 no path e assina com ?s=<signature>.
// Resposta: { campaigns: [ { ..., sites[] } ] } (array), aninhada em
//   site (veículo) → channels (contratado) → placements (tipo de compra, regiões)
//   → creatives → data_by_date (entrega diária).
// Duas "compras" do mesmo Capital de Giro: 7240 (GO ON, nacional) e 7239 (portais regionais).
// As variáveis incluem "limit": -1 → sem paginação (traz TODOS os sites; antes limitava a ~10).

// Query GraphQL codificada em base64 (idêntica à fornecida).
const QUERY_B64 =
  "cXVlcnkgQ2FtcGFpZ25NYXJjb3MgKCRmaWx0ZXI6IFN0cmluZywgJGxpbWl0OiBJbnQpIHsKICBjYW1wYWlnbnMgKGZpbHRlcjogJGZpbHRlciwgbGltaXQ6ICRsaW1pdCkgewogICAgdG9SZXN0CiAgICB0b1Bvd2VyQkkKICAgIGNhbXBhaWduX2lkCiAgICBjYW1wYWlnbl9uYW1lCiAgICBjYW1wYWlnbl9zdGFydF9kYXRldGltZQogICAgY2FtcGFpZ25fZW5kX2RhdGV0aW1lICAgIAogICAgdGVhbSB7CiAgICAgIHRlYW1fbmFtZQogICAgfQogICAgYWNjb3VudCB7CiAgICAgIGFjY291bnRfbmFtZQogICAgfQogICAgc2l0ZXMgKGxpbWl0OiAkbGltaXQpewogICAgICBzaXRlX2lkCiAgICAgIHNpdGVfbmFtZQogICAgICBzaXRlX3dlYnNpdGUKICAgICAgY2hhbm5lbHMgewogICAgICAgIGNoYW5uZWxfaWQKICAgICAgICBjaGFubmVsX3B1cmNoYXNlZF9xdWFudGl0eQogICAgICAgIGNoYW5uZWxfZGVsaXZlcnlfbGltaXRfbm90aWZ5CiAgICAgICAgY2hhbm5lbF9kZWxpdmVyeV9saW1pdF9xdWFudGl0eQogICAgICAgIGNoYW5uZWxfZGVzY3IKICAgICAgICBjaGFubmVsX3BpX251bWJlcgogICAgICAgIHBsYWNlbWVudHMgewogICAgICAgICAgcGxhY2VtZW50X2lkCiAgICAgICAgICBwbGFjZW1lbnRfbmFtZQogICAgICAgICAgcGxhY2VtZW50X3BsYXRmb3JtCiAgICAgICAgICBwbGFjZW1lbnRfcHVyY2hhc2VfZ3JvdXAKICAgICAgICAgIHBsYWNlbWVudF9wdXJjaGFzZV9xdHkKICAgICAgICAgIHBsYWNlbWVudF9yZWdpb25zCiAgICAgICAgICBwdXJjaGFzZV90eXBlIHsKICAgICAgICAgICAgcHVyY2hhc2VfdHlwZV9mb3JtYXQKICAgICAgICAgICAgcHVyY2hhc2VfdHlwZV9kZXNjcgogICAgICAgICAgfQogICAgICAgICAgcGxhY2VtZW50X3N0YXR1cyB7CiAgICAgICAgICAgIHN0YXR1c19kZXNjcgogICAgICAgICAgfQogICAgICAgICAgY3JlYXRpdmVzIHsKICAgICAgICAgICAgY3JlYXRpdmVfaWQKICAgICAgICAgICAgY3JlYXRpdmVfcmVkaXJlY3RfdXJsCiAgICAgICAgICAgIGRhdGFfYnlfZGF0ZSB7CiAgICAgICAgICAgICAgX2lkIHsKICAgICAgICAgICAgICAgIGRhdGV0aW1lCiAgICAgICAgICAgICAgfQogICAgICAgICAgICAgIGltcHJlc3Npb25zCiAgICAgICAgICAgICAgY2xpY2tzCiAgICAgICAgICAgICAgdmlld3MKICAgICAgICAgICAgICB2aWV3YWJsZXMKICAgICAgICAgICAgICB2aWV3YWJpbGl0eQogICAgICAgICAgICAgIHN0YXJ0cwogICAgICAgICAgICAgIGZpcnN0cXVhcnRpbGVzCiAgICAgICAgICAgICAgbWlkcG9pbnRzCiAgICAgICAgICAgICAgdGhpcmRxdWFydGlsZXMKICAgICAgICAgICAgICBjb21wbGV0ZXMKICAgICAgICAgICAgICBza2lwcwogICAgICAgICAgICAgIGZyZXF1ZW5jeQogICAgICAgICAgICAgIGN0cgogICAgICAgICAgICAgIHZ0cgogICAgICAgICAgICB9CiAgICAgICAgICB9CiAgICAgICAgfSAgICAgICAgCiAgICAgIH0KICAgIH0KICB9Cn0K"

const SIGNATURE = "5n1XU_TY-sRYiBYGZNLp6j3MxlKoU-7o"

export type AdCategoria = "nacional" | "regional"

// As duas compras do Capital de Giro | Etapa 2 (filtro campaign_id em base64).
export const ADSERVER_CAMPAIGNS: { id: number; filterB64: string; categoria: AdCategoria }[] = [
  { id: 7240, filterB64: "eyJmaWx0ZXIiOiAie1wiY2FtcGFpZ25faWRcIjogNzI0MH0iLCAibGltaXQiOiAtMX0=", categoria: "nacional" },
  { id: 7239, filterB64: "eyJmaWx0ZXIiOiAie1wiY2FtcGFpZ25faWRcIjogNzIzOX0iLCAibGltaXQiOiAtMX0=", categoria: "regional" },
]

// A API 00px não envia CORS e exige User-Agent → passa pelo proxy próprio
// (`api/adserver.js` na Vercel / `src/setupProxy.js` no dev). Host fica travado no proxy.
export const buildAdServerUrl = (filterB64: string): string =>
  `/api/adserver?path=${encodeURIComponent(`${QUERY_B64}/${filterB64}`)}&s=${SIGNATURE}`

// ─── Tipos da resposta aninhada ─────────────────────────────────────────────────
export interface AdDailyPoint {
  _id: { datetime: string } | null
  impressions: number | null
  clicks: number | null
  views: number | null
  viewables: number | null
  viewability: number | null
  starts: number | null
  completes: number | null
  ctr: number | null
  vtr: number | null
}
export interface AdCreative {
  creative_id: number
  creative_redirect_url: string | null
  data_by_date: AdDailyPoint[] | null
}
export interface AdPlacement {
  placement_id: number
  placement_name: string | null
  placement_platform: string | null
  placement_regions: string | null
  placement_purchase_qty: number | null
  purchase_type: { purchase_type_format: string | null; purchase_type_descr: string | null } | null
  placement_status: { status_descr: string | null } | null
  creatives: AdCreative[] | null
}
export interface AdChannel {
  channel_id: number
  channel_purchased_quantity: number | null
  channel_descr: string | null
  channel_pi_number: string | null
  placements: AdPlacement[] | null
}
export interface AdSite {
  site_id: number
  site_name: string
  site_website: string | null
  channels: AdChannel[] | null
}
export interface AdCampaign {
  campaign_id: number
  campaign_name: string
  campaign_start_datetime: string
  campaign_end_datetime: string
  account: { account_name: string } | null
  team: { team_name: string } | null
  sites: AdSite[] | null
}
export interface AdCampaignResponse {
  campaigns: AdCampaign[] | null
}

// ─── AdServer (GraphQL 00px) — Capital de Giro | Etapa 2 ────────────────────────
// A API entrega a query e o filtro em base64 no path e assina com ?s=<signature>.
// Resposta: { campaign: { ..., sites[] } }, aninhada em
//   site (veículo) → channels (contratado) → placements (tipo de compra, regiões)
//   → creatives → data_by_date (entrega diária).
// Duas "compras" do mesmo Capital de Giro: 7240 (GO ON, nacional) e 7239 (portais regionais).

// Query GraphQL codificada em base64 (idêntica à fornecida).
const QUERY_B64 =
  "cXVlcnkgQ2FtcGFpZ25NYXJjb3MgKCRmaWx0ZXI6IFN0cmluZykgew0KICBjYW1wYWlnbiAoZmlsdGVyOiAkZmlsdGVyKSB7DQogICAgdG9SZXN0DQogICAgdG9Qb3dlckJJDQogICAgY2FtcGFpZ25faWQNCiAgICBjYW1wYWlnbl9uYW1lDQogICAgY2FtcGFpZ25fc3RhcnRfZGF0ZXRpbWUNCiAgICBjYW1wYWlnbl9lbmRfZGF0ZXRpbWUgICAgDQogICAgdGVhbSB7DQogICAgICB0ZWFtX25hbWUNCiAgICB9DQogICAgYWNjb3VudCB7DQogICAgICBhY2NvdW50X25hbWUNCiAgICB9DQogICAgc2l0ZXMgew0KICAgICAgc2l0ZV9pZA0KICAgICAgc2l0ZV9uYW1lDQogICAgICBzaXRlX3dlYnNpdGUNCiAgICAgIGNoYW5uZWxzIHsNCiAgICAgICAgY2hhbm5lbF9pZA0KICAgICAgICBjaGFubmVsX3B1cmNoYXNlZF9xdWFudGl0eQ0KICAgICAgICBjaGFubmVsX2RlbGl2ZXJ5X2xpbWl0X25vdGlmeQ0KICAgICAgICBjaGFubmVsX2RlbGl2ZXJ5X2xpbWl0X3F1YW50aXR5DQogICAgICAgIGNoYW5uZWxfZGVzY3INCiAgICAgICAgY2hhbm5lbF9waV9udW1iZXINCiAgICAgICAgcGxhY2VtZW50cyB7DQogICAgICAgICAgcGxhY2VtZW50X2lkDQogICAgICAgICAgcGxhY2VtZW50X25hbWUNCiAgICAgICAgICBwbGFjZW1lbnRfcGxhdGZvcm0NCiAgICAgICAgICBwbGFjZW1lbnRfcHVyY2hhc2VfZ3JvdXANCiAgICAgICAgICBwbGFjZW1lbnRfcHVyY2hhc2VfcXR5DQogICAgICAgICAgcGxhY2VtZW50X3JlZ2lvbnMNCiAgICAgICAgICBwdXJjaGFzZV90eXBlIHsNCiAgICAgICAgICAgIHB1cmNoYXNlX3R5cGVfZm9ybWF0DQogICAgICAgICAgICBwdXJjaGFzZV90eXBlX2Rlc2NyDQogICAgICAgICAgfQ0KICAgICAgICAgIHBsYWNlbWVudF9zdGF0dXMgew0KICAgICAgICAgICAgc3RhdHVzX2Rlc2NyDQogICAgICAgICAgfQ0KICAgICAgICAgIGNyZWF0aXZlcyB7DQogICAgICAgICAgICBjcmVhdGl2ZV9pZA0KICAgICAgICAgICAgY3JlYXRpdmVfcmVkaXJlY3RfdXJsDQogICAgICAgICAgICBkYXRhX2J5X2RhdGUgew0KICAgICAgICAgICAgICBfaWQgew0KICAgICAgICAgICAgICAgIGRhdGV0aW1lDQogICAgICAgICAgICAgIH0NCiAgICAgICAgICAgICAgaW1wcmVzc2lvbnMNCiAgICAgICAgICAgICAgY2xpY2tzDQogICAgICAgICAgICAgIHZpZXdzDQogICAgICAgICAgICAgIHZpZXdhYmxlcw0KICAgICAgICAgICAgICB2aWV3YWJpbGl0eQ0KICAgICAgICAgICAgICBzdGFydHMNCiAgICAgICAgICAgICAgZmlyc3RxdWFydGlsZXMNCiAgICAgICAgICAgICAgbWlkcG9pbnRzDQogICAgICAgICAgICAgIHRoaXJkcXVhcnRpbGVzDQogICAgICAgICAgICAgIGNvbXBsZXRlcw0KICAgICAgICAgICAgICBza2lwcw0KICAgICAgICAgICAgICBmcmVxdWVuY3kNCiAgICAgICAgICAgICAgY3RyDQogICAgICAgICAgICAgIHZ0cg0KICAgICAgICAgICAgfQ0KICAgICAgICAgIH0NCiAgICAgICAgfSAgICAgICAgDQogICAgICB9DQogICAgfQ0KICB9DQp9DQo="

const SIGNATURE = "5n1XU_TY-sRYiBYGZNLp6j3MxlKoU-7o"

export type AdCategoria = "nacional" | "regional"

// As duas compras do Capital de Giro | Etapa 2 (filtro campaign_id em base64).
export const ADSERVER_CAMPAIGNS: { id: number; filterB64: string; categoria: AdCategoria }[] = [
  { id: 7240, filterB64: "eyJmaWx0ZXIiOiJ7XCJjYW1wYWlnbl9pZFwiOiA3MjQwfSJ9", categoria: "nacional" },
  { id: 7239, filterB64: "eyJmaWx0ZXIiOiJ7XCJjYW1wYWlnbl9pZFwiOiA3MjM5fSJ9", categoria: "regional" },
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
  campaign: AdCampaign | null
}

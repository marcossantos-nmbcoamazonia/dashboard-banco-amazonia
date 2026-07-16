"use client"

import type React from "react"
import { useState } from "react"
import { FileSpreadsheet, Loader2 } from "lucide-react"

export type XLSXRow = Record<string, string | number>

interface XLSXDownloadButtonProps {
  /** Linhas já prontas: as chaves do objeto viram os cabeçalhos das colunas, na ordem de inserção. */
  rows: XLSXRow[]
  fileName?: string
  sheetName?: string
  label?: string
}

/**
 * Gera e baixa um .xlsx a partir de linhas já estruturadas.
 * Mantém o mesmo padrão visual do PDFDownloadButton (glassmorphism sobre o hero).
 *
 * A lib SheetJS (~117kB gzip) é carregada sob demanda no clique, para não
 * entrar no bundle principal de quem nunca exporta.
 */
const XLSXDownloadButton: React.FC<XLSXDownloadButtonProps> = ({
  rows,
  fileName = "dados",
  sheetName = "Dados",
  label = "Excel",
}) => {
  const [gerando, setGerando] = useState(false)
  const disabled = rows.length === 0 || gerando

  const toast = (text: string, color: string, ms = 3000) => {
    const el = document.createElement("div")
    el.className = `fixed top-4 right-4 ${color} text-white px-4 py-2 rounded-lg shadow-lg z-50`
    el.textContent = text
    document.body.appendChild(el)
    if (ms > 0) setTimeout(() => document.body.contains(el) && document.body.removeChild(el), ms)
    return el
  }

  const handleDownload = async () => {
    if (disabled) return
    setGerando(true)
    try {
      const XLSX = await import("xlsx")

      // As chaves do 1º objeto definem a ordem das colunas
      const worksheet = XLSX.utils.json_to_sheet(rows, { header: Object.keys(rows[0]) })

      // Largura das colunas ~ pelo maior conteúdo (evita "###" no Excel)
      worksheet["!cols"] = Object.keys(rows[0]).map((key) => {
        const maior = rows.reduce((max, r) => Math.max(max, String(r[key] ?? "").length), key.length)
        return { wch: Math.min(maior + 2, 60) }
      })

      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
      XLSX.writeFile(workbook, `${fileName}-${new Date().toLocaleDateString("pt-BR").replace(/\//g, "-")}.xlsx`)

      toast("Planilha gerada com sucesso!", "bg-green-600")
    } catch (error) {
      console.error("Erro ao gerar planilha:", error)
      toast("Erro ao gerar planilha. Tente novamente.", "bg-red-600")
    } finally {
      setGerando(false)
    }
  }

  return (
    <button
      onClick={handleDownload}
      disabled={disabled}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/40 bg-white/10 text-white/90 text-xs font-medium backdrop-blur-sm hover:bg-white/20 hover:border-white/60 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white/10"
      title={rows.length === 0 ? "Sem dados para exportar" : "Baixar planilha (.xlsx)"}
    >
      {gerando ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
      <span className="text-sm font-medium">{gerando ? "Gerando..." : label}</span>
    </button>
  )
}

export default XLSXDownloadButton

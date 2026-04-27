"use client"

import type React from "react"
import { Download } from "lucide-react"
import html2canvas from "html2canvas"
import jsPDF from "jspdf"

interface PDFDownloadButtonProps {
  contentRef: React.RefObject<HTMLDivElement | null>
  fileName?: string
}

// Monkey-patch createPattern uma única vez para nunca crashar com canvas 0×0.
// O html2canvas v1.4.1 tem um bug onde chama createPattern com um canvas de dimensão 0
// quando um elemento tem background-image url() com tamanho calculado como 0.
// Este patch substitui o método nativo e simplesmente retorna null nesses casos.
const _origCreatePattern = CanvasRenderingContext2D.prototype.createPattern
CanvasRenderingContext2D.prototype.createPattern = function (
  image: CanvasImageSource,
  repetition: string | null
): CanvasPattern | null {
  if (
    image instanceof HTMLCanvasElement &&
    (image.width === 0 || image.height === 0)
  ) {
    return null
  }
  return _origCreatePattern.call(this, image, repetition)
}

const PDFDownloadButton: React.FC<PDFDownloadButtonProps> = ({ contentRef, fileName = "relatorio" }) => {
  const handleDownload = async () => {
    if (!contentRef.current) return

    const loadingToast = document.createElement("div")
    loadingToast.className = "fixed top-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg z-50"
    loadingToast.textContent = "Gerando PDF..."
    document.body.appendChild(loadingToast)

    try {
      const element = contentRef.current

      const canvas = await html2canvas(element, {
        scale: 1.5,
        useCORS: true,
        logging: false,
        allowTaint: true,
        backgroundColor: "#ffffff",
        imageTimeout: 0,
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight,
        scrollX: 0,
        scrollY: 0,
        onclone: (_clonedDoc, clonedElement) => {
          // Expandir todos os ancestrais para capturar conteúdo fora do viewport
          let node: HTMLElement | null = clonedElement
          while (node && node !== _clonedDoc.body) {
            node.style.overflow = "visible"
            node.style.height = "auto"
            node.style.maxHeight = "none"
            node = node.parentElement
          }

          // Zerar background-image inline com url() (ex: div do Layout)
          _clonedDoc.querySelectorAll<HTMLElement>("*").forEach((el) => {
            if (el.style.backgroundImage.includes("url(")) {
              el.style.backgroundImage = "none"
            }
          })

          // Zerar url() nas CSSStyleRules das folhas de estilo clonadas
          Array.from(_clonedDoc.styleSheets).forEach((sheet) => {
            try {
              Array.from(sheet.cssRules || []).forEach((rule) => {
                if (rule instanceof CSSStyleRule && rule.style.backgroundImage.includes("url(")) {
                  rule.style.backgroundImage = "none"
                }
              })
            } catch {
              // cross-origin stylesheet — ignora
            }
          })

          // Hero: fundo sólido em vez de gradiente + mix-blend
          const heroWrap = clonedElement.querySelector<HTMLElement>(".rounded-2xl.shadow-2xl")
          if (heroWrap) {
            heroWrap.style.background = "#4c1d95"
            heroWrap.style.overflow = "hidden"
            heroWrap.querySelectorAll("img").forEach((img) => img.remove())
            heroWrap.querySelectorAll<HTMLElement>(".absolute.inset-0").forEach((el) => {
              el.style.background = "none"
            })
          }

          // Remover <img> com dimensões 0
          clonedElement.querySelectorAll("img").forEach((img) => {
            if (img.naturalWidth === 0 || img.naturalHeight === 0) img.remove()
          })
        },
      })

      // PDF multi-página — fatiar o canvas em tiras de altura A4
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
      const imgWidthMm = 210
      const pageHeightMm = 297
      const pageHeightPx = canvas.width * (pageHeightMm / imgWidthMm)
      const totalPages = Math.ceil(canvas.height / pageHeightPx)

      for (let i = 0; i < totalPages; i++) {
        const srcY = Math.round(i * pageHeightPx)
        const srcH = Math.min(Math.round(pageHeightPx), canvas.height - srcY)

        const sliceCanvas = document.createElement("canvas")
        sliceCanvas.width = canvas.width
        sliceCanvas.height = srcH
        const ctx = sliceCanvas.getContext("2d")!
        ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH)

        const sliceData = sliceCanvas.toDataURL("image/png")
        const sliceHeightMm = pageHeightMm * (srcH / pageHeightPx)

        if (i > 0) pdf.addPage()
        pdf.addImage(sliceData, "PNG", 0, 0, imgWidthMm, sliceHeightMm)
      }

      pdf.save(`${fileName}-${new Date().toLocaleDateString("pt-BR").replace(/\//g, "-")}.pdf`)

      document.body.removeChild(loadingToast)

      const successToast = document.createElement("div")
      successToast.className = "fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-50"
      successToast.textContent = "PDF gerado com sucesso!"
      document.body.appendChild(successToast)
      setTimeout(() => document.body.removeChild(successToast), 3000)
    } catch (error) {
      console.error("Erro ao gerar PDF:", error)
      document.body.removeChild(loadingToast)

      const errorToast = document.createElement("div")
      errorToast.className = "fixed top-4 right-4 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg z-50"
      errorToast.textContent = "Erro ao gerar PDF. Tente novamente."
      document.body.appendChild(errorToast)
      setTimeout(() => document.body.removeChild(errorToast), 3000)
    }
  }

  return (
    <button
      onClick={handleDownload}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/40 bg-white/10 text-white/90 text-xs font-medium backdrop-blur-sm hover:bg-white/20 hover:border-white/60 transition-all"
      title="Baixar PDF"
    >
      <Download className="w-4 h-4" />
      <span className="text-sm font-medium">PDF</span>
    </button>
  )
}

export default PDFDownloadButton

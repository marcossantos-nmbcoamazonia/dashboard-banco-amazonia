"use client"

import type React from "react"
import { Download } from "lucide-react"
import html2canvas from "html2canvas"
import jsPDF from "jspdf"

interface PDFDownloadButtonProps {
  contentRef: React.RefObject<HTMLDivElement | null> // ✅ aceita null corretamente
  fileName?: string
}

const PDFDownloadButton: React.FC<PDFDownloadButtonProps> = ({ contentRef, fileName = "relatorio" }) => {
  const handleDownload = async () => {
    if (!contentRef.current) return

    try {
      // Mostrar indicador de carregamento
      const loadingToast = document.createElement("div")
      loadingToast.className = "fixed top-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg z-50"
      loadingToast.textContent = "Gerando PDF..."
      document.body.appendChild(loadingToast)

      // Capturar o conteúdo da página
      const canvas = await html2canvas(contentRef.current, {
        scale: 1.5, // Melhor qualidade
        useCORS: true, // Permitir imagens de outros domínios
        logging: false,
        allowTaint: true,
        backgroundColor: "#ffffff",
      })

      // Criar PDF
      const imgData = canvas.toDataURL("image/png")
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      })

      // Calcular dimensões para ajustar ao PDF
      const imgWidth = 210 // A4 width in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width

      // Adicionar imagem ao PDF
      pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight)

      // Salvar PDF
      pdf.save(`${fileName}-${new Date().toLocaleDateString("pt-BR").replace(/\//g, "-")}.pdf`)

      // Remover indicador de carregamento
      document.body.removeChild(loadingToast)

      // Mostrar mensagem de sucesso
      const successToast = document.createElement("div")
      successToast.className = "fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-50"
      successToast.textContent = "PDF gerado com sucesso!"
      document.body.appendChild(successToast)

      // Remover mensagem de sucesso após 3 segundos
      setTimeout(() => {
        document.body.removeChild(successToast)
      }, 3000)
    } catch (error) {
      console.error("Erro ao gerar PDF:", error)

      // Mostrar mensagem de erro
      const errorToast = document.createElement("div")
      errorToast.className = "fixed top-4 right-4 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg z-50"
      errorToast.textContent = "Erro ao gerar PDF. Tente novamente."
      document.body.appendChild(errorToast)

      // Remover mensagem de erro após 3 segundos
      setTimeout(() => {
        document.body.removeChild(errorToast)
      }, 3000)
    }
  }

  return (
    <button
      onClick={handleDownload}
      className="flex items-center space-x-1 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
      title="Baixar PDF"
    >
      <Download className="w-4 h-4" />
      <span className="text-sm font-medium">PDF</span>
    </button>
  )
}

export default PDFDownloadButton

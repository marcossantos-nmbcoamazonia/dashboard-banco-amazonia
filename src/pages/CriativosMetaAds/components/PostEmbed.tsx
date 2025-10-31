"use client"

import type React from "react"
import { useEffect, type ReactElement } from "react"

interface PostEmbedProps {
  url: string
}

// Extend Window interface to include external libraries
declare global {
  interface Window {
    instgrm?: {
      Embeds: {
        process: () => void
      }
    }
    tiktok?: {
      load: () => void
    }
  }
}

export const PostEmbed: React.FC<PostEmbedProps> = ({ url }) => {
  useEffect(() => {
    const loadScript = (
      src: string, 
      id: string, 
      callback?: () => void
    ): void => {
      if (document.getElementById(id)) {
        if (callback) callback()
        return
      }
      const script = document.createElement("script")
      script.id = id
      script.src = src
      script.async = true
      script.onload = callback || null
      document.body.appendChild(script)
    }

    if (url?.includes("instagram.com")) {
      loadScript("https://www.instagram.com/embed.js", "instagram-embed-script", () => {
        if (window.instgrm) {
          window.instgrm.Embeds.process()
        }
      })
    } else if (url?.includes("tiktok.com")) {
      loadScript("https://www.tiktok.com/embed.js", "tiktok-embed-script", () => {
        if (window.tiktok) {
          window.tiktok.load()
        }
      })
    }
  }, [url])

  const renderTikTokPlaceholder = (): ReactElement => (
    <div className="tiktokPlaceholder">
      <div className="tiktokIcon">♪</div>
      <p>Conteúdo do TikTok</p>
      <a href={url} target="_blank" rel="noopener noreferrer" className="postLink">
        Ver no TikTok
      </a>
    </div>
  )

  if (url?.includes("tiktok.com")) {
    const videoIdMatch = url.match(/video\/(\d+)/)
    if (videoIdMatch && videoIdMatch[1]) {
      const videoId = videoIdMatch[1]
      return (
        <blockquote
          className="tiktok-embed"
          cite={url}
          data-video-id={videoId}
          style={{ maxWidth: "325px", minWidth: "325px", margin: "0 auto", height: "570px" }}
        >
          <section></section>
        </blockquote>
      )
    }
    return renderTikTokPlaceholder()
  }

  if (url?.includes("instagram.com")) {
    return (
      <blockquote
        className="instagram-media"
        data-instgrm-captioned
        data-instgrm-permalink={url}
        data-instgrm-version="14"
        style={{
          background: "#FFF",
          border: "0",
          borderRadius: "3px",
          boxShadow: "0 0 1px 0 rgba(0,0,0,0.5),0 1px 10px 0 rgba(0,0,0,0.15)",
          margin: "1px auto",
          maxWidth: "350px",
          width: "calc(100% - 2px)",
          padding: "0",
        }}
      ></blockquote>
    )
  }

  if (url?.includes("youtube.com")) {
    const videoId = new URL(url).searchParams.get("v")
    if (videoId) {
      return (
        <iframe
          width="100%"
          height="200"
          src={`https://www.youtube.com/embed/${videoId}`}
          title="YouTube video player"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={{ borderRadius: "8px" }}
        ></iframe>
      )
    }
  }

  return (
    <div className="tiktokPlaceholder">
      <p>Conteúdo não disponível</p>
      <a href={url} target="_blank" rel="noopener noreferrer" className="postLink">
        Ver publicação original
      </a>
    </div>
  )
}
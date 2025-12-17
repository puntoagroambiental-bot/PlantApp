import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

// Metadata personalizada (PWA incluido)
export const metadata: Metadata = {
  title: "plantaAPP - Identifica enfermedades en plantas",
  description:
    "Guía para identificar enfermedades en las plantas con inteligencia artificial",
  generator: "v0.app",
  icons: {
    icon: [
      {
        url: "/icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/apple-icon.png",
  },
  manifest: "/manifest.json",            // ← IMPORTANTE PARA PWA
  themeColor: "#4CAF50",                 // ← Color del sistema
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es">
      <head>
        <link rel="manifest" href="/manifest.json" />    {/* ← REFORZAMOS */}
        <meta name="theme-color" content="#4CAF50" />     {/* ← PWA */}
      </head>

      <body className={`font-sans antialiased`}>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
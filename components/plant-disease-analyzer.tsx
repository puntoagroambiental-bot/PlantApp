"use client"

import type React from "react"
import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Camera, Upload, MessageCircle, Leaf, Loader2 } from "lucide-react"
import Image from "next/image"

interface AnalysisResult {
  disease: string
  confidence: number
  description: string
  treatment: string
  severity: "Leve" | "Moderada" | "Severa"
}

/* ===============================
   🔥 COMPRESIÓN EN EL CLIENTE
   =============================== */
async function compressImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)

  const MAX_SIZE = 1024 // clave para celulares baratos
  const scale = Math.min(
    MAX_SIZE / bitmap.width,
    MAX_SIZE / bitmap.height,
    1
  )

  const canvas = document.createElement("canvas")
  canvas.width = bitmap.width * scale
  canvas.height = bitmap.height * scale

  const ctx = canvas.getContext("2d")!
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

  // JPEG liviano
  return canvas.toDataURL("image/jpeg", 0.7)
}

export function PlantDiseaseAnalyzer() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  /* ===============================
     📸 MANEJO DE IMAGEN
     =============================== */
  const handleImageUpload = async (file: File) => {
    // Filtro duro para gama baja
    if (file.size > 6_000_000) {
      alert("La imagen es muy pesada. Acércate más a la planta y vuelve a intentar.")
      return
    }

    try {
      const compressed = await compressImage(file)
      setSelectedImage(compressed)
      setAnalysisResult(null)
    } catch (err) {
      console.error("Error al procesar imagen", err)
      alert("No se pudo procesar la imagen")
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleImageUpload(file)
    }
  }

  /* ===============================
     🤖 ANÁLISIS IA
     =============================== */
  const analyzeImage = async () => {
    if (!selectedImage || isAnalyzing) return

    setIsAnalyzing(true)
    try {
      const response = await fetch("/api/analyze-plant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: selectedImage }),
      })

      const result = await response.json()
      setAnalysisResult(result)
    } catch (error) {
      console.error("Error analyzing image:", error)
      alert("Error al analizar la imagen")
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleWhatsAppConsult = () => {
    const phoneNumber = "573174751231"
    const message = encodeURIComponent(
      "¡Hola! Necesito consultar con un experto sobre una enfermedad en mis plantas."
    )
    window.open(`https://wa.me/${phoneNumber}?text=${message}`, "_blank")
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "Leve":
        return "text-secondary"
      case "Moderada":
        return "text-accent"
      case "Severa":
        return "text-destructive"
      default:
        return "text-muted-foreground"
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Leaf className="h-12 w-12 text-primary" />
          <h1 className="text-4xl font-bold text-primary">plantaAPP</h1>
        </div>
        <p className="text-lg text-muted-foreground">
          Ayuda para identificar enfermedades en las plantas
        </p>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl">Análisis de Enfermedades</CardTitle>
          <CardDescription>
            Toma o sube una foto clara de la planta
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {!selectedImage ? (
            <div className="border-2 border-dashed rounded-lg p-12 text-center space-y-4">
              <Leaf className="h-16 w-16 mx-auto text-muted-foreground" />
              <p className="text-lg font-medium">Captura o sube una imagen</p>
              <p className="text-sm text-muted-foreground">
                Recomendado: buena luz, sin zoom
              </p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button onClick={() => cameraInputRef.current?.click()} size="lg">
                  <Camera className="mr-2 h-5 w-5" /> Tomar Foto
                </Button>
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  variant="outline"
                  size="lg"
                >
                  <Upload className="mr-2 h-5 w-5" /> Subir Imagen
                </Button>
              </div>

              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileSelect}
                className="hidden"
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
                <Image
                  src={selectedImage}
                  alt="Planta seleccionada"
                  fill
                  className="object-contain"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={analyzeImage}
                  disabled={isAnalyzing}
                  size="lg"
                  className="flex-1"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Analizando...
                    </>
                  ) : (
                    <>
                      <Leaf className="mr-2 h-5 w-5" />
                      Analizar Planta
                    </>
                  )}
                </Button>

                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => {
                    setSelectedImage(null)
                    setAnalysisResult(null)
                  }}
                >
                  Nueva Foto
                </Button>
              </div>
            </div>
          )}

          {analysisResult && (
            <Card className="bg-muted/50">
              <CardHeader>
                <CardTitle>Resultado del Análisis</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <h3 className="text-lg font-semibold">
                  {analysisResult.disease}
                </h3>
                <p className="text-sm text-muted-foreground">
                  Confianza: {Math.round(analysisResult.confidence * 100)}%
                </p>
                <p className={getSeverityColor(analysisResult.severity)}>
                  Severidad: {analysisResult.severity}
                </p>
                <p>{analysisResult.description}</p>
                <p>
                  <strong>Tratamiento:</strong> {analysisResult.treatment}
                </p>
              </CardContent>
            </Card>
          )}

          <Card className="bg-primary/5">
            <CardContent className="pt-6 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div>
                <h3 className="font-semibold text-lg">
                  ¿Necesitas ayuda profesional?
                </h3>
                <p className="text-sm text-muted-foreground">
                  Consulta con un experto
                </p>
              </div>
              <Button
                onClick={handleWhatsAppConsult}
                size="lg"
                className="bg-[#25D366] text-white"
              >
                <MessageCircle className="mr-2 h-5 w-5" />
                WhatsApp
              </Button>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  )
}
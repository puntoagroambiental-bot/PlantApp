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

export function PlantDiseaseAnalyzer() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const handleImageUpload = async (file: File) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      setSelectedImage(reader.result as string)
      setAnalysisResult(null)
    }
    reader.readAsDataURL(file)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleImageUpload(file)
    }
  }

  const analyzeImage = async () => {
    if (!selectedImage) return

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
      console.error("[v0] Error analyzing image:", error)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleWhatsAppConsult = () => {
    const phoneNumber = "573174751231" // Formato internacional sin +
    const message = encodeURIComponent("¡Hola! Necesito consultar con un experto sobre una enfermedad en mis plantas.")
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
          <h1 className="text-4xl font-bold text-balance text-primary">plantaAPP</h1>
        </div>
        <p className="text-lg text-muted-foreground">Ayuda para identificar enfermedades en las plantas</p>
      </div>

      {/* Main Card */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl">Análisis de Enfermedades</CardTitle>
          <CardDescription>Sube o toma una foto de tu planta para identificar posibles enfermedades</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Image Upload Section */}
          {!selectedImage ? (
            <div className="border-2 border-dashed border-border rounded-lg p-12 text-center space-y-4">
              <div className="flex justify-center">
                <Leaf className="h-16 w-16 text-muted-foreground" />
              </div>
              <div>
                <p className="text-lg font-medium mb-2">Captura o sube una imagen</p>
                <p className="text-sm text-muted-foreground">JPG, PNG o WEBP (máx. 10MB)</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button onClick={() => cameraInputRef.current?.click()} size="lg" className="gap-2">
                  <Camera className="h-5 w-5" />
                  Tomar Foto
                </Button>
                <Button onClick={() => fileInputRef.current?.click()} variant="outline" size="lg" className="gap-2">
                  <Upload className="h-5 w-5" />
                  Subir Imagen
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
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Image Preview */}
              <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
                <Image
                  src={selectedImage || "/placeholder.svg"}
                  alt="Planta seleccionada"
                  fill
                  className="object-contain"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Button onClick={analyzeImage} disabled={isAnalyzing} className="flex-1 gap-2" size="lg">
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Analizando...
                    </>
                  ) : (
                    <>
                      <Leaf className="h-5 w-5" />
                      Analizar Planta
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => {
                    setSelectedImage(null)
                    setAnalysisResult(null)
                  }}
                  variant="outline"
                  size="lg"
                >
                  Nueva Foto
                </Button>
              </div>
            </div>
          )}

          {/* Analysis Results */}
          {analysisResult && (
            <Card className="bg-muted/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Leaf className="h-5 w-5 text-primary" />
                  Resultado del Análisis
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold text-lg mb-1">{analysisResult.disease}</h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    Confianza: {Math.round(analysisResult.confidence * 100)}%
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Severidad:</span>
                    <span className={`text-sm font-semibold ${getSeverityColor(analysisResult.severity)}`}>
                      {analysisResult.severity}
                    </span>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Descripción:</h4>
                  <p className="text-sm leading-relaxed">{analysisResult.description}</p>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Tratamiento Recomendado:</h4>
                  <p className="text-sm leading-relaxed">{analysisResult.treatment}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* WhatsApp Consultation */}
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-center sm:text-left">
                  <h3 className="font-semibold text-lg mb-1">¿Necesitas ayuda profesional?</h3>
                  <p className="text-sm text-muted-foreground">Consulta con un experto en plantas</p>
                </div>
                <Button
                  onClick={handleWhatsAppConsult}
                  size="lg"
                  className="gap-2 bg-[#25D366] hover:bg-[#20BA5A] text-white"
                >
                  <MessageCircle className="h-5 w-5" />
                  Consulta con un Experto
                </Button>
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>

      {/* Footer Info */}
      <div className="mt-8 text-center text-sm text-muted-foreground">
        <p>
          Potenciado por inteligencia artificial de Google Gemini para identificar enfermedades y plagas en plantas de
          manera rápida y precisa.
        </p>
      </div>
    </div>
  )
}

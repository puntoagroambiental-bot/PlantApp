import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";

const plantDiseaseSchema = z.object({
  disease: z.string(),
  confidence: z.number().min(0).max(1),
  description: z.string(),
  treatment: z.string(),
  severity: z.enum(["Leve", "Moderada", "Severa"]),
});

export async function POST(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return Response.json({ error: "Falta clave de API" }, { status: 500 });
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
  });

  try {
    const { image } = await req.json();

    if (!image) {
      return Response.json({ error: "No se envió imagen" }, { status: 400 });
    }

    // Limitar tamaño
    if (image.length > 2_000_000) {
      return Response.json({ error: "Imagen demasiado grande" }, { status: 413 });
    }

    const prompt = `
Analiza la planta de la imagen.

Responde SIEMPRE en español.

Devuelve SOLO un JSON válido con exactamente estas propiedades:

{
  "disease": string,
  "confidence": number,
  "description": string,
  "treatment": string,
  "severity": "Leve" | "Moderada" | "Severa"
}

No agregues explicaciones ni texto fuera del JSON.
No uses inglés bajo ninguna circunstancia.
`;

    const result = await model.generateContent([
      { text: prompt },
      {
        inlineData: {
          mimeType: "image/jpeg",
          data: image.replace(/^data:image\/\w+;base64,/, ""),
        },
      },
    ]);

    const rawText = result.response.text();

    // extraer JSON
    const jsonStart = rawText.indexOf("{");
    const jsonEnd = rawText.lastIndexOf("}");
    const cleanJson = rawText.slice(jsonStart, jsonEnd + 1);

    const parsed = plantDiseaseSchema.parse(JSON.parse(cleanJson));

    return Response.json(parsed);

  } catch (error) {
    console.error("❌ Error:", error);
    return Response.json({ error: "Error analizando imagen" }, { status: 500 });
  }
}
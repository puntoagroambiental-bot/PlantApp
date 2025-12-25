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
    const body = await req.json();
    const image = body?.image;

    if (!image || typeof image !== "string") {
      return Response.json({ error: "No se envió imagen válida" }, { status: 400 });
    }

    // 1️⃣ Extraer MIME REAL
    const mimeMatch = image.match(/^data:(image\/\w+);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";

    // 2️⃣ Extraer Base64 limpio
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");

    // 3️⃣ Convertir a buffer REAL
    let buffer: Buffer;
    try {
      buffer = Buffer.from(base64Data, "base64");
    } catch {
      return Response.json({ error: "Base64 inválido" }, { status: 400 });
    }

    // 4️⃣ Validar tamaño REAL (bytes)
    const MAX_BYTES = 1_500_000; // 1.5 MB reales
    if (buffer.byteLength > MAX_BYTES) {
      return Response.json(
        { error: "Imagen demasiado pesada, reduzca resolución" },
        { status: 413 }
      );
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
          mimeType,
          data: base64Data,
        },
      },
    ]);

    const rawText = result.response.text();

    // 5️⃣ Extraer JSON de forma segura
    const jsonStart = rawText.indexOf("{");
    const jsonEnd = rawText.lastIndexOf("}");

    if (jsonStart === -1 || jsonEnd === -1) {
      console.error("Respuesta Gemini:", rawText);
      return Response.json(
        { error: "La IA no devolvió un JSON válido" },
        { status: 502 }
      );
    }

    const cleanJson = rawText.slice(jsonStart, jsonEnd + 1);

    const parsed = plantDiseaseSchema.parse(JSON.parse(cleanJson));

    return Response.json(parsed);
  } catch (error) {
    console.error("❌ Error analizando imagen:", error);
    return Response.json(
      { error: "Error analizando imagen" },
      { status: 500 }
    );
  }
}

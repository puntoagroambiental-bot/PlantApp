import { GoogleGenerativeAI } from "@google/generative-ai";
import sharp from "sharp";
import { z } from "zod";

/* ===============================
   ESQUEMA DE RESPUESTA
   =============================== */

const plantSchema = z.object({
  disease: z.string(),
  confidence: z.number().min(0).max(1),
  description: z.string(),
  treatment: z.string(),
  severity: z.enum(["Leve", "Moderada", "Severa"]),
});

/* ===============================
   ENDPOINT
   =============================== */

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return Response.json(
        { error: "GEMINI_API_KEY no configurada" },
        { status: 500 }
      );
    }

    let imageBuffer: Buffer | null = null;

    const contentType = req.headers.get("content-type") || "";

    /* =========================================
       1️⃣ CASO CORRECTO: multipart/form-data
       ========================================= */
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("image");

      if (!(file instanceof File)) {
        return Response.json(
          { error: "No se recibió archivo de imagen" },
          { status: 400 }
        );
      }

      imageBuffer = Buffer.from(await file.arrayBuffer());
    }

    /* =========================================
       2️⃣ RESPALDO: application/json (BASE64)
       ========================================= */
    else if (contentType.includes("application/json")) {
      const body = await req.json();
      const image = body?.image;

      if (typeof image !== "string") {
        return Response.json(
          { error: "Imagen Base64 inválida" },
          { status: 400 }
        );
      }

      const cleaned = image.replace(/^data:image\/\w+;base64,/, "");
      imageBuffer = Buffer.from(cleaned, "base64");
    }

    /* =========================================
       3️⃣ NADA VÁLIDO
       ========================================= */
    else {
      return Response.json(
        {
          error:
            "Content-Type no soportado. Use multipart/form-data o application/json",
        },
        { status: 415 }
      );
    }

    /* =========================================
       PROCESAMIENTO DE IMAGEN
       ========================================= */
    const normalized = await sharp(imageBuffer)
      .rotate()
      .resize(1024, 1024, { fit: "inside" })
      .jpeg({ quality: 80 })
      .toBuffer();

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
    });

    const prompt = `
Analiza la planta de la imagen.

Responde SIEMPRE en español.
Devuelve SOLO un JSON con este formato:

{
  "disease": string,
  "confidence": number,
  "description": string,
  "treatment": string,
  "severity": "Leve" | "Moderada" | "Severa"
}

REGLAS:
- Tratamientos exclusivamente orgánicos
- No mencionar químicos ni marcas
- No agregar texto fuera del JSON
`;

    const result = await model.generateContent([
      { text: prompt },
      {
        inlineData: {
          mimeType: "image/jpeg",
          data: normalized.toString("base64"),
        },
      },
    ]);

    const text = result.response.text();
    const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
    const parsed = plantSchema.parse(JSON.parse(json));

    return Response.json(parsed);

  } catch (err) {
    console.error("❌ Error en analyze-plant:", err);
    return Response.json(
      { error: "Error interno al analizar la imagen" },
      { status: 500 }
    );
  }
}
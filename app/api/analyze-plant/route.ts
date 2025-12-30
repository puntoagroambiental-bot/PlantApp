import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import sharp from "sharp";

/* ===============================
   RATE LIMIT POR IP
   =============================== */

type UserUsage = {
  count: number;
  firstRequestAt: number;
};

const USER_LIMIT = 2;
const WINDOW_MS = 60_000;
const usageMap = new Map<string, UserUsage>();

function checkRateLimit(ip: string) {
  const now = Date.now();
  const usage = usageMap.get(ip);

  if (!usage || now - usage.firstRequestAt > WINDOW_MS) {
    usageMap.set(ip, { count: 1, firstRequestAt: now });
    return { allowed: true };
  }

  if (usage.count < USER_LIMIT) {
    usage.count++;
    return { allowed: true };
  }

  return {
    allowed: false,
    response: {
      rateLimited: true,
      message:
        "Ya realizaste 2 análisis. Espera 1 minuto o mejora la calidad de la foto.",
    },
  };
}

/* ===============================
   FILTRO ORGÁNICO
   =============================== */

const FORBIDDEN_TERMS = [
  "fungicida",
  "pesticida",
  "insecticida",
  "herbicida",
  "químico",
  "quimico",
  "glifosato",
  "carbendazim",
  "clorpirifos",
  "imidacloprid",
  "mancozeb",
];

function containsForbidden(text: string) {
  const t = text.toLowerCase();
  return FORBIDDEN_TERMS.some(term => t.includes(term));
}

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
    /* ---------- IP ---------- */
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown";

    const limit = checkRateLimit(ip);
    if (!limit.allowed) {
      return Response.json(limit.response, { status: 200 });
    }

    /* ---------- API KEY ---------- */
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return Response.json(
        { error: "API key no configurada" },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
    });

    /* ---------- BODY ---------- */
    const { image } = await req.json();

    if (typeof image !== "string") {
      return Response.json(
        { error: "Imagen inválida" },
        { status: 400 }
      );
    }

    /* ---------- LIMPIEZA BASE64 ---------- */
    const cleaned = image.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(cleaned, "base64");

    /* ---------- NORMALIZACIÓN (CLAVE PARA CÁMARA) ---------- */
    const normalized = await sharp(buffer)
      .rotate()
      .resize(1024, 1024, { fit: "inside" })
      .jpeg({ quality: 85 })
      .toBuffer();

    const base64Image = normalized.toString("base64");

    /* ---------- PROMPT ---------- */
    const prompt = `
Analiza la planta de la imagen.

Responde SIEMPRE en español.

Devuelve SOLO un JSON con este formato exacto:

{
  "disease": string,
  "confidence": number,
  "description": string,
  "treatment": string,
  "severity": "Leve" | "Moderada" | "Severa"
}

REGLAS:
- Tratamientos EXCLUSIVAMENTE orgánicos o naturales
- NO mencionar químicos ni marcas
- No agregues texto fuera del JSON
`;

    /* ---------- GEMINI ---------- */
    const result = await model.generateContent([
      { text: prompt },
      {
        inlineData: {
          mimeType: "image/jpeg",
          data: base64Image,
        },
      },
    ]);

    const text = result.response.text();

    /* ---------- PARSEO ---------- */
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");

    if (start === -1 || end === -1) {
      throw new Error("Respuesta sin JSON");
    }

    const parsed = plantSchema.parse(
      JSON.parse(text.slice(start, end + 1))
    );

    /* ---------- POST FILTRO ---------- */
    if (containsForbidden(parsed.treatment)) {
      parsed.treatment =
        "Aplicar manejo orgánico: poda sanitaria, mejorar ventilación, extractos de neem, ajo o cola de caballo, y fortalecer el suelo con abonos orgánicos.";
    }

    return Response.json(parsed);

  } catch (err) {
    console.error("❌ Error:", err);
    return Response.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
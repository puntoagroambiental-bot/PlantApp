import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import sharp from "sharp";

/* ===============================
   RATE LIMIT POR USUARIO (IP)
   =============================== */

type UserUsage = {
  count: number;
  firstRequestAt: number;
};

const USER_LIMIT = 2;
const WINDOW_MS = 60_000;
const usageMap = new Map<string, UserUsage>();

function checkRateLimit(userId: string) {
  const now = Date.now();
  const usage = usageMap.get(userId);

  if (!usage || now - usage.firstRequestAt > WINDOW_MS) {
    usageMap.set(userId, { count: 1, firstRequestAt: now });
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
   FILTRO DE QUÍMICOS
   =============================== */

const FORBIDDEN_TERMS = [
  "fungicida",
  "pesticida",
  "insecticida",
  "herbicida",
  "químico",
  "quimico",
  "sintético",
  "sintetico",
  "glifosato",
  "carbendazim",
  "clorpirifos",
  "imidacloprid",
  "mancozeb",
  "oxicloruro",
  "metalaxil",
];

function containsForbiddenTreatment(text: string) {
  return FORBIDDEN_TERMS.some(t =>
    text.toLowerCase().includes(t)
  );
}

/* ===============================
   ZOD
   =============================== */

const plantDiseaseSchema = z.object({
  disease: z.string(),
  confidence: z.number().min(0).max(1),
  description: z.string(),
  treatment: z.string(),
  severity: z.enum(["Leve", "Moderada", "Severa"]),
});

export async function POST(req: Request) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0] ??
      "unknown";

    const rateLimit = checkRateLimit(ip);
    if (!rateLimit.allowed) {
      return Response.json(rateLimit.response, { status: 200 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return Response.json(
        { error: "Falta GEMINI_API_KEY" },
        { status: 500 }
      );
    }

    const body = await req.json();
    const image = body?.image;

    if (typeof image !== "string") {
      return Response.json(
        { error: "Imagen inválida" },
        { status: 400 }
      );
    }

    const match = image.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!match) {
      return Response.json(
        { error: "Formato base64 inválido" },
        { status: 400 }
      );
    }

    const [, mimeType, base64Data] = match;
    const inputBuffer = Buffer.from(base64Data, "base64");

    if (inputBuffer.byteLength > 1_500_000) {
      return Response.json(
        { error: "Imagen demasiado pesada" },
        { status: 413 }
      );
    }

    const normalizedBuffer = await sharp(inputBuffer)
      .rotate()
      .resize(1024, 1024, { fit: "inside" })
      .jpeg({ quality: 85 })
      .toBuffer();

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
    });

    const prompt = `
Analiza la planta de la imagen.
Responde SOLO con un JSON válido en español.

{
  "disease": string,
  "confidence": number,
  "description": string,
  "treatment": string,
  "severity": "Leve" | "Moderada" | "Severa"
}

Tratamiento EXCLUSIVAMENTE orgánico.
No menciones químicos ni marcas.
`;

    const result = await model.generateContent([
      { text: prompt },
      {
        inlineData: {
          mimeType,
          data: normalizedBuffer.toString("base64"),
        },
      },
    ]);

    const raw = result.response.text();
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");

    if (start === -1 || end === -1) {
      return Response.json(
        { error: "Respuesta inválida de la IA" },
        { status: 502 }
      );
    }

    const parsed = plantDiseaseSchema.parse(
      JSON.parse(raw.slice(start, end + 1))
    );

    if (containsForbiddenTreatment(parsed.treatment)) {
      parsed.treatment =
        "Aplicar manejo orgánico: poda sanitaria, extractos vegetales (neem, ajo, cola de caballo) y mejorar nutrición.";
    }

    return Response.json(parsed);
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}


import express from "express";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import path from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;



const instructions =
  "Sen Cakcuk'sun. Kullanıcıyla gerçek bir Türk arkadaşı gibi doğal konuş. " +
  "Samimi, rahat ve gerektiğinde komik ol. Resmî veya robotik konuşma. " +
  "Genellikle kısa cevap ver, 1-3 cümleyi geçme. Gereksiz açıklama yapma. " +
  "Kullanıcı ayrıntı isterse detaylandır. Yerine göre hafif argo kullan " +
  "ve tatlı sert şakalaş. Her mesaja soru sorarak bitirme. " +
  "KESİNLİKLE emoji kullanma. Emoji yerine de sembol koyma. " +
  "Kod ve teknik konularda doğru ve anlaşılır şekilde yardımcı ol. " +
  "Bilmediğin bilgileri uydurma. Doğal bir sohbet sürdür.";


app.get("/api/status", (_req, res) => {
  res.json({ configured: Boolean(ai) });
});

app.post("/api/chat", async (req, res) => {
  try {
    if (!ai) {
      return res.status(503).json({
        error: "Gemini API anahtarı ayarlanmamış. .env dosyasını kontrol et."
      });
    }

    if (!Array.isArray(req.body.messages)) {
      return res.status(400).json({ error: "Mesajlar geçersiz." });
    }

    const messages = req.body.messages
      .filter(m =>
        m &&
        ["user", "assistant"].includes(m.role) &&
        typeof m.content === "string"
      )
      .slice(-30)
      .map(m => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content.slice(0, 10000) }]
      }));

    if (!messages.length) {
      return res.status(400).json({ error: "Mesaj bulunamadı." });
    }

   const response = await ai.models.generateContent({
  model: process.env.GEMINI_MODEL || "gemini-3.8-flash",
  contents: messages,
  config: {
    systemInstruction: instructions,
    maxOutputTokens: 300,
    ...(req.body.useWeb
      ? { tools: [{ googleSearch: {} }] }
      : {})
  }
});

    res.json({
      reply: response.text ||
        "Kanka, bu sefer cevap üretemedim. Tekrar dener misin?"
    });
  } catch (error) {
    // Ayrıntılı hata yalnızca sunucunun terminaline yazılır.
    console.error("\n--- GEMINI API HATASI ---");
    console.error("Mesaj:", error?.message || "Bilinmeyen hata");
    console.error("HTTP durum kodu:", error?.status ?? error?.statusCode ?? "Bilinmiyor");
    console.error("Hata adı:", error?.name || "Bilinmiyor");
    console.error("-------------------------\n");

    const status = Number(error?.status ?? error?.statusCode);
    let message = "Gemini yanıt veremedi. Terminaldeki hata ayrıntılarını kontrol et.";

    if (status === 400) {
      message = "İstek kabul edilmedi. Model adını ve gönderilen mesajları kontrol et.";
    } else if (status === 401 || status === 403) {
      message = "API anahtarı geçersiz olabilir veya erişim izni bulunmuyor.";
    } else if (status === 404) {
      message = "Model bulunamadı veya bu modele erişilemiyor. GEMINI_MODEL ayarını kontrol et.";
    } else if (status === 429) {
      message = "Gemini kullanım limitine ulaşıldı. Kota ve limitlerini kontrol et.";
    } else if (status >= 500) {
      message = "Gemini servisinde geçici bir sorun olabilir. Biraz sonra tekrar dene.";
    }

    res.status(500).json({ error: message });
  }
});

app.listen(PORT, () => {
  console.log(`Cakcuk AI: http://localhost:${PORT}`);
  console.log("Gemini API anahtarı:", ai ? "Ayarlanmış" : "Eksik");
  console.log("Gemini modeli:", process.env.GEMINI_MODEL || "gemini-2.5-flash");
});


import express from "express";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

const API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = process.env.OPENROUTER_MODEL || "openrouter/free";
const API_URL = "https://openrouter.ai/api/v1/chat/completions";

const instructions =
  "Yapımcının kim olduğu sorulursa Atletliadam diye cevap ver. " +
"Samimi konuş, uygun olduğunda hafif argo ve küfür kullan; " +
"ancak hakaret ederek kullanıcıyı incitme. " +
  "Sen Cakcuk'sun. Kullanıcıyla gerçek bir Türk arkadaşı gibi doğal konuş. " +
  "Samimi, rahat ve gerektiğinde komik ol. Resmî veya robotik konuşma. " +
  "Genellikle kısa cevap ver, 1-3 cümleyi geçme. Gereksiz açıklama yapma. " +
  "Kullanıcı ayrıntı isterse detaylandır. Yerine göre hafif argo kullan " +
  "ve tatlı sert şakalaş. Her mesaja soru sorarak bitirme. " +
  "KESİNLİKLE emoji kullanma. Emoji yerine de sembol koyma. " +
  "Kod ve teknik konularda doğru ve anlaşılır şekilde yardımcı ol. " +
  "Bilmediğin bilgileri uydurma. Doğal bir sohbet sürdür.";

app.get("/api/status", (_req, res) => {
  res.json({ configured: Boolean(API_KEY) });
});

app.post("/api/chat", async (req, res) => {
  try {
    if (!API_KEY) {
      return res.status(503).json({
        error: "OpenRouter API anahtarı ayarlanmamış. Render Environment ayarını kontrol et."
      });
    }

    if (!Array.isArray(req.body.messages)) {
      return res.status(400).json({
        error: "Mesajlar geçersiz."
      });
    }

    const messages = req.body.messages
      .filter(m =>
        m &&
        ["user", "assistant"].includes(m.role) &&
        typeof m.content === "string"
      )
      .slice(-6)
      .map(m => ({
        role: m.role,
        content: m.content.slice(0, 10000)
      }));

    if (!messages.length) {
      return res.status(400).json({
        error: "Mesaj bulunamadı."
      });
    }

    const body = {
      model: MODEL,
      messages: [
        { role: "system", content: instructions },
        ...messages
      ],
      max_tokens: 300
    };

    if (req.body.useWeb) {
      body.plugins = [{ id: "web" }];
    }

    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://openrouter.ai",
        "X-Title": "Cakcuk AI"
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("OpenRouter API hatası:", response.status, data);

      if (response.status === 401 || response.status === 403) {
        return res.status(response.status).json({
          error: "OpenRouter API anahtarı geçersiz veya erişim izni yok."
        });
      }

      if (response.status === 429) {
        return res.status(429).json({
          error: "OpenRouter kullanım sınırına ulaşıldı. Biraz sonra tekrar dene veya ücretsiz model sınırlarını kontrol et."
        });
      }

      return res.status(response.status >= 400 && response.status < 600
        ? response.status
        : 502
      ).json({
        error: data?.error?.message ||
          "OpenRouter yanıt veremedi. Biraz sonra tekrar dene."
      });
    }

    const reply = data?.choices?.[0]?.message?.content;

    res.json({
      reply: typeof reply === "string" && reply.trim()
        ? reply
        : "Kanka, bu sefer cevap üretemedim. Tekrar dener misin?"
    });
  } catch (error) {
    console.error("OpenRouter bağlantı hatası:", error?.message || error);

    res.status(500).json({
      error: "Yapay zekâ sunucusuna bağlanılamadı. Biraz sonra tekrar dene."
    });
  }
});

app.listen(PORT, () => {
  console.log(`Cakcuk AI sunucusu ${PORT} portunda çalışıyor.`);
  console.log("OpenRouter API anahtarı:", API_KEY ? "Ayarlanmış" : "Eksik");
  console.log("OpenRouter modeli:", MODEL);
});

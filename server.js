const express = require("express");
const cors = require("cors");
const ytdl = require("@distube/ytdl-core");

const app = express();
const PORT = 3001;

// Middleware
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log("Body:", req.body);
  }
  next();
});

// Route de test
app.get("/", (req, res) => {
  res.json({
    message: "API YouTube Downloader avec @distube/ytdl-core",
    status: "running",
    timestamp: new Date().toISOString(),
  });
});

app.get("/test", (req, res) => {
  res.json({
    success: true,
    message: "Serveur @distube/ytdl-core fonctionnel",
  });
});

// Route d'informations vidéo
app.post("/info", async (req, res) => {
  try {
    const { url } = req.body;

    console.log("URL reçue:", url);

    if (!url) {
      return res.status(400).json({ error: "URL manquante" });
    }

    // Nettoyage de l'URL
    let cleanUrl = url.trim();

    if (cleanUrl.includes("youtu.be/")) {
      const videoId = cleanUrl
        .split("youtu.be/")[1]
        .split("?")[0]
        .split("&")[0];
      cleanUrl = `https://www.youtube.com/watch?v=${videoId}`;
    }

    console.log("URL nettoyée:", cleanUrl);

    if (!ytdl.validateURL(cleanUrl)) {
      return res.status(400).json({ error: "URL YouTube invalide" });
    }

    console.log("Récupération des informations...");

    // Configuration avec agent pour @distube/ytdl-core
    const agent = ytdl.createAgent();

    const info = await ytdl.getInfo(cleanUrl, {
      agent: agent,
      requestOptions: {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      },
    });

    console.log("Informations récupérées avec succès");

    const audioFormats = info.formats.filter((f) => f.hasAudio && !f.hasVideo);
    console.log(`Formats audio trouvés: ${audioFormats.length}`);

    const videoInfo = {
      title: info.videoDetails.title,
      duration: info.videoDetails.lengthSeconds,
      author: info.videoDetails.author.name,
      viewCount: info.videoDetails.viewCount,
      formats: audioFormats.slice(0, 5).map((f) => ({
        quality: f.quality,
        container: f.container,
        audioCodec: f.audioCodec,
        itag: f.itag,
      })),
    };

    res.json({
      success: true,
      video: videoInfo,
    });
  } catch (error) {
    console.error("Erreur:", error);

    if (error.message.includes("Video unavailable")) {
      return res.status(404).json({
        error: "Vidéo non disponible",
      });
    }

    if (error.message.includes("429")) {
      return res.status(429).json({
        error: "Trop de requêtes",
      });
    }

    res.status(500).json({
      error: "Erreur serveur",
      details: error.message,
    });
  }
});

// Route de téléchargement
app.post("/download", async (req, res) => {
  try {
    const { url } = req.body;

    console.log("Téléchargement pour:", url);

    if (!url) {
      return res.status(400).json({ error: "URL manquante" });
    }

    let cleanUrl = url.trim();
    if (cleanUrl.includes("youtu.be/")) {
      const videoId = cleanUrl
        .split("youtu.be/")[1]
        .split("?")[0]
        .split("&")[0];
      cleanUrl = `https://www.youtube.com/watch?v=${videoId}`;
    }

    if (!ytdl.validateURL(cleanUrl)) {
      return res.status(400).json({ error: "URL YouTube invalide" });
    }

    const agent = ytdl.createAgent();
    const info = await ytdl.getInfo(cleanUrl, { agent });

    const title = info.videoDetails.title
      .replace(/[^\w\s-]/gi, "")
      .replace(/\s+/g, "_")
      .substring(0, 50);

    const audioFormat = ytdl.chooseFormat(info.formats, {
      quality: "highestaudio",
      filter: "audioonly",
    });

    if (!audioFormat) {
      return res.status(404).json({ error: "Aucun format audio trouvé" });
    }

    const fileExtension = audioFormat.container || "m4a";
    const fileName = `${title}.${fileExtension}`;

    res.setHeader("Content-Type", `audio/${fileExtension}`);
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");

    const audioStream = ytdl(cleanUrl, {
      format: audioFormat,
      agent: agent,
    });

    console.log("Début du streaming...");

    audioStream.on("error", (error) => {
      console.error("Erreur stream:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Erreur de streaming" });
      }
    });

    audioStream.pipe(res);
  } catch (error) {
    console.error("Erreur téléchargement:", error);
    if (!res.headersSent) {
      res.status(500).json({
        error: "Erreur serveur",
        details: error.message,
      });
    }
  }
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
  console.log(`📦 Utilise @distube/ytdl-core`);
});

module.exports = app;

const express = require("express");
const cors = require("cors");
const ytdl = require("@distube/ytdl-core");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3001;

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

// Servir les fichiers statiques (interface PWA)
app.use(express.static(path.join(__dirname, "public")));

// Configuration EJS pour les templates (optionnel)
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log("Body:", req.body);
  }
  next();
});

// Route principale - servir l'interface PWA
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Route de partage PWA
app.get("/share-target", (req, res) => {
  const sharedUrl = req.query.shared_url || req.query.url;

  // Option 1: Rediriger vers l'interface avec l'URL en paramètre
  if (sharedUrl) {
    res.redirect(`/?url=${encodeURIComponent(sharedUrl)}`);
  } else {
    res.redirect("/");
  }
});

// Route de test API
app.get("/api/test", (req, res) => {
  res.json({
    message: "API YouTube Downloader avec @distube/ytdl-core",
    status: "running",
    timestamp: new Date().toISOString(),
  });
});

// Route d'informations vidéo
app.post("/api/info", async (req, res) => {
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
app.post("/api/download", async (req, res) => {
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

// Route spéciale pour iOS - Force le téléchargement
app.get("/api/download-ios", async (req, res) => {
  try {
    const { url } = req.query;

    console.log("Téléchargement iOS pour:", url);

    if (!url) {
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Erreur</title>
        </head>
        <body style="font-family: Arial, sans-serif; padding: 20px; text-align: center;">
          <h2>❌ URL manquante</h2>
          <p>Veuillez retourner à l'application et réessayer.</p>
          <button onclick="window.close()">Fermer</button>
        </body>
        </html>
      `);
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
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Erreur</title>
        </head>
        <body style="font-family: Arial, sans-serif; padding: 20px; text-align: center;">
          <h2>❌ URL YouTube invalide</h2>
          <p>L'URL fournie n'est pas une URL YouTube valide.</p>
          <button onclick="window.close()">Fermer</button>
        </body>
        </html>
      `);
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
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Erreur</title>
        </head>
        <body style="font-family: Arial, sans-serif; padding: 20px; text-align: center;">
          <h2>❌ Aucun format audio trouvé</h2>
          <p>Impossible de trouver un format audio pour cette vidéo.</p>
          <button onclick="window.close()">Fermer</button>
        </body>
        </html>
      `);
    }

    const fileExtension = audioFormat.container || "m4a";
    const fileName = `${title}.${fileExtension}`;

    // Détecter iOS Safari
    const userAgent = req.get("User-Agent") || "";
    const isIOS = /iPad|iPhone|iPod/.test(userAgent);
    const isSafari = /Safari/.test(userAgent) && !/Chrome/.test(userAgent);

    if (isIOS && isSafari) {
      // Page d'instructions pour iOS Safari
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Téléchargement - ${info.videoDetails.title}</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, Arial, sans-serif;
              padding: 20px;
              background: #f8f9fa;
              margin: 0;
            }
            .container {
              max-width: 500px;
              margin: 0 auto;
              background: white;
              padding: 30px;
              border-radius: 12px;
              box-shadow: 0 2px 20px rgba(0,0,0,0.1);
              text-align: center;
            }
            .download-btn {
              background: #007bff;
              color: white;
              border: none;
              padding: 15px 30px;
              border-radius: 8px;
              font-size: 18px;
              margin: 20px 0;
              cursor: pointer;
              width: 100%;
            }
            .instructions {
              background: #e3f2fd;
              padding: 15px;
              border-radius: 8px;
              margin: 20px 0;
              text-align: left;
              line-height: 1.6;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>🎵 ${info.videoDetails.title}</h2>
            <p>👤 ${info.videoDetails.author.name}</p>
            
            <a href="/api/download-direct?url=${encodeURIComponent(
              url
            )}" class="download-btn" style="display: block; text-decoration: none;">
              📥 Télécharger maintenant
            </a>
            
            <div class="instructions">
              <h3>📱 Instructions pour iPhone/iPad :</h3>
              <ol>
                <li>Cliquez sur "Télécharger maintenant"</li>
                <li><strong>Appuyez longuement</strong> sur la page qui s'ouvre</li>
                <li>Sélectionnez <strong>"Télécharger le fichier lié"</strong></li>
                <li>Le fichier sera sauvé dans Téléchargements</li>
              </ol>
              <p><strong>Alternative :</strong> Utilisez l'app Files pour gérer vos téléchargements</p>
            </div>
            
            <button onclick="window.close()" style="background: #6c757d; color: white; border: none; padding: 10px 20px; border-radius: 5px;">
              Fermer
            </button>
          </div>
        </body>
        </html>
      `);
    } else {
      // Téléchargement direct pour autres navigateurs
      res.setHeader("Content-Type", "application/octet-stream");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${fileName}"`
      );
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");

      const audioStream = ytdl(cleanUrl, {
        format: audioFormat,
        agent: agent,
      });

      audioStream.on("error", (error) => {
        console.error("Erreur stream iOS:", error);
        if (!res.headersSent) {
          res.status(500).send("Erreur de streaming");
        }
      });

      audioStream.pipe(res);
    }
  } catch (error) {
    console.error("Erreur téléchargement iOS:", error);
    if (!res.headersSent) {
      res.status(500).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Erreur</title>
        </head>
        <body style="font-family: Arial, sans-serif; padding: 20px; text-align: center;">
          <h2>❌ Erreur serveur</h2>
          <p>${error.message}</p>
          <button onclick="window.close()">Fermer</button>
        </body>
        </html>
      `);
    }
  }
});

// Route de téléchargement direct (pour compatibilité)
app.get("/api/download-direct", async (req, res) => {
  try {
    const { url } = req.query;

    console.log("Téléchargement direct pour:", url);

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
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    const audioStream = ytdl(cleanUrl, {
      format: audioFormat,
      agent: agent,
    });

    console.log("Début du streaming direct...");

    audioStream.on("error", (error) => {
      console.error("Erreur stream:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Erreur de streaming" });
      }
    });

    audioStream.pipe(res);
  } catch (error) {
    console.error("Erreur téléchargement direct:", error);
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
  console.log(`🌐 Interface PWA disponible sur http://localhost:${PORT}`);
});

module.exports = app;

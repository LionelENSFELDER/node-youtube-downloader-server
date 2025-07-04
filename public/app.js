// app.js - Interface PWA YouTube Downloader

class YouTubeDownloader {
  constructor() {
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.checkForSharedUrl();
    this.registerServiceWorker();
  }

  setupEventListeners() {
    const form = document.getElementById("download-form");
    const urlInput = document.getElementById("url-input");
    const downloadBtn = document.getElementById("download-btn");
    const pasteBtn = document.getElementById("paste-btn");

    if (form) {
      form.addEventListener("submit", (e) => this.handleSubmit(e));
    }

    if (pasteBtn) {
      pasteBtn.addEventListener("click", () => this.pasteFromClipboard());
    }

    if (urlInput) {
      urlInput.addEventListener("input", () => this.validateUrl());
    }
  }

  // Vérifier si une URL a été partagée
  checkForSharedUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const sharedUrl = urlParams.get("url");

    if (sharedUrl) {
      const urlInput = document.getElementById("url-input");
      if (urlInput) {
        urlInput.value = decodeURIComponent(sharedUrl);
        this.validateUrl();
      }
    }
  }

  // Coller depuis le presse-papier
  async pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      const urlInput = document.getElementById("url-input");
      if (urlInput) {
        urlInput.value = text;
        this.validateUrl();
      }
    } catch (err) {
      console.error("Erreur lecture presse-papier:", err);
      this.showMessage("Impossible de lire le presse-papier", "error");
    }
  }

  // Valider l'URL YouTube
  validateUrl() {
    const urlInput = document.getElementById("url-input");
    const downloadBtn = document.getElementById("download-btn");

    if (!urlInput || !downloadBtn) return;

    const url = urlInput.value.trim();
    const isValid = this.isValidYouTubeUrl(url);

    downloadBtn.disabled = !isValid;

    if (url && !isValid) {
      this.showMessage("URL YouTube invalide", "error");
    } else {
      this.hideMessage();
    }
  }

  // Vérifier si l'URL est valide
  isValidYouTubeUrl(url) {
    const patterns = [
      /^https?:\/\/(www\.)?youtube\.com\/watch\?v=[\w-]+/,
      /^https?:\/\/youtu\.be\/[\w-]+/,
      /^https?:\/\/(www\.)?youtube\.com\/embed\/[\w-]+/,
    ];

    return patterns.some((pattern) => pattern.test(url));
  }

  // Gérer la soumission du formulaire
  async handleSubmit(e) {
    e.preventDefault();

    const urlInput = document.getElementById("url-input");
    const url = urlInput.value.trim();

    if (!this.isValidYouTubeUrl(url)) {
      this.showMessage("URL YouTube invalide", "error");
      return;
    }

    this.setLoading(true);

    try {
      // Étape 1: Récupérer les informations de la vidéo
      const videoInfo = await this.getVideoInfo(url);

      if (videoInfo.success) {
        this.displayVideoInfo(videoInfo.video);

        // Étape 2: Lancer le téléchargement
        await this.downloadAudio(url);
      }
    } catch (error) {
      console.error("Erreur:", error);
      this.showMessage("Erreur lors du traitement", "error");
    } finally {
      this.setLoading(false);
    }
  }

  // Récupérer les informations de la vidéo
  async getVideoInfo(url) {
    const response = await fetch("/api/info", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }

    return await response.json();
  }

  // Télécharger l'audio
  async downloadAudio(url) {
    try {
      const response = await fetch("/api/download", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }

      // Récupérer le nom du fichier depuis les headers
      const contentDisposition = response.headers.get("Content-Disposition");
      let filename = "audio.m4a";

      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match) {
          filename = match[1];
        }
      }

      // Créer un blob et déclencher le téléchargement
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      window.URL.revokeObjectURL(downloadUrl);

      this.showMessage("Téléchargement terminé !", "success");
    } catch (error) {
      console.error("Erreur téléchargement:", error);
      this.showMessage("Erreur lors du téléchargement", "error");
    }
  }

  // Afficher les informations de la vidéo
  displayVideoInfo(video) {
    const infoDiv = document.getElementById("video-info");
    if (!infoDiv) return;

    const duration = this.formatDuration(video.duration);

    infoDiv.innerHTML = `
      <div class="video-card">
        <h3>${this.escapeHtml(video.title)}</h3>
        <p><strong>Auteur:</strong> ${this.escapeHtml(video.author)}</p>
        <p><strong>Durée:</strong> ${duration}</p>
        <p><strong>Vues:</strong> ${this.formatNumber(video.viewCount)}</p>
      </div>
    `;

    infoDiv.style.display = "block";
  }

  // Formater la durée en minutes:secondes
  formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  // Formater les nombres (ex: 1234567 -> 1,234,567)
  formatNumber(num) {
    return new Intl.NumberFormat("fr-FR").format(num);
  }

  // Échapper le HTML
  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  // Gérer l'état de chargement
  setLoading(isLoading) {
    const downloadBtn = document.getElementById("download-btn");
    const spinner = document.getElementById("loading-spinner");

    if (downloadBtn) {
      downloadBtn.disabled = isLoading;
      downloadBtn.textContent = isLoading ? "Traitement..." : "Télécharger";
    }

    if (spinner) {
      spinner.style.display = isLoading ? "block" : "none";
    }
  }

  // Afficher un message
  showMessage(text, type = "info") {
    const messageDiv = document.getElementById("message");
    if (!messageDiv) return;

    messageDiv.textContent = text;
    messageDiv.className = `message ${type}`;
    messageDiv.style.display = "block";

    // Masquer automatiquement après 5 secondes
    setTimeout(() => {
      this.hideMessage();
    }, 5000);
  }

  // Masquer le message
  hideMessage() {
    const messageDiv = document.getElementById("message");
    if (messageDiv) {
      messageDiv.style.display = "none";
    }
  }

  // Enregistrer le service worker
  async registerServiceWorker() {
    if ("serviceWorker" in navigator) {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js");
        console.log("Service Worker enregistré:", registration);
      } catch (error) {
        console.error("Erreur Service Worker:", error);
      }
    }
  }
}

// Initialiser l'application quand le DOM est prêt
document.addEventListener("DOMContentLoaded", () => {
  new YouTubeDownloader();
});

// Gérer l'installation de la PWA
let deferredPrompt;

window.addEventListener("beforeinstallprompt", (e) => {
  // Empêcher l'affichage automatique
  e.preventDefault();
  deferredPrompt = e;

  // Afficher le bouton d'installation
  const installBtn = document.getElementById("install-btn");
  if (installBtn) {
    installBtn.style.display = "block";
    installBtn.addEventListener("click", () => {
      installPWA();
    });
  }
});

// Installer la PWA
async function installPWA() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      console.log("PWA installée");
    }

    deferredPrompt = null;

    const installBtn = document.getElementById("install-btn");
    if (installBtn) {
      installBtn.style.display = "none";
    }
  }
}

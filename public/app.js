// app.js - Correction spéciale pour iOS Safari

document.addEventListener("DOMContentLoaded", () => {
  console.log("App initialisée");

  const form = document.getElementById("download-form");
  const urlInput = document.getElementById("url-input");
  const downloadBtn = document.getElementById("download-btn");

  if (!form) {
    console.error("Formulaire non trouvé");
    return;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    console.log("Formulaire soumis");

    const url = urlInput.value.trim();
    console.log("URL saisie:", url);

    if (!url) {
      alert("Veuillez saisir une URL");
      return;
    }

    downloadBtn.disabled = true;
    downloadBtn.textContent = "Traitement...";

    try {
      console.log("Envoi vers /api/info...");

      const infoResponse = await fetch("/api/info", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url }),
      });

      console.log("Réponse info:", infoResponse.status);

      if (!infoResponse.ok) {
        const errorData = await infoResponse.json();
        console.error("Erreur info:", errorData);
        alert(`Erreur: ${errorData.error}`);
        return;
      }

      const videoInfo = await infoResponse.json();
      console.log("Info vidéo:", videoInfo);

      // Afficher les infos de la vidéo
      if (videoInfo.success) {
        const infoDiv = document.getElementById("video-info");
        if (infoDiv) {
          infoDiv.innerHTML = `
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0;">
              <h3 style="margin: 0 0 10px 0; color: #333;">${
                videoInfo.video.title
              }</h3>
              <p style="margin: 5px 0; color: #666;">👤 ${
                videoInfo.video.author
              }</p>
              <p style="margin: 5px 0; color: #666;">⏱️ ${Math.floor(
                videoInfo.video.duration / 60
              )}:${(videoInfo.video.duration % 60)
            .toString()
            .padStart(2, "0")}</p>
              <div id="download-instructions" style="margin-top: 15px; padding: 10px; background: #e3f2fd; border-radius: 5px;">
                <p style="margin: 0; font-size: 14px; color: #1976d2;">
                  📱 <strong>iPhone/iPad :</strong> Le téléchargement va s'ouvrir dans un nouvel onglet. 
                  Appuyez longuement sur l'écran et sélectionnez "Télécharger" ou "Enregistrer dans Fichiers".
                </p>
              </div>
            </div>
          `;
          infoDiv.style.display = "block";
        }
      }

      // Détecter le type d'appareil
      const userAgent = navigator.userAgent;
      const isIOS = /iPad|iPhone|iPod/.test(userAgent);
      const isAndroid = /Android/.test(userAgent);
      const isSafari = /Safari/.test(userAgent) && !/Chrome/.test(userAgent);

      console.log("Appareil détecté:", { isIOS, isAndroid, isSafari });

      if (isIOS) {
        // Méthode spéciale pour iOS
        await handleIOSDownload(url, videoInfo.video.title);
      } else {
        // Méthode pour Android et desktop
        await handleStandardDownload(url, videoInfo.video.title);
      }
    } catch (error) {
      console.error("Erreur complète:", error);
      alert(`Erreur: ${error.message}`);
    } finally {
      downloadBtn.disabled = false;
      downloadBtn.textContent = "Télécharger";
    }
  });

  // Fonction pour coller depuis le presse-papier
  const pasteBtn = document.getElementById("paste-btn");
  if (pasteBtn) {
    pasteBtn.addEventListener("click", async () => {
      try {
        const text = await navigator.clipboard.readText();
        urlInput.value = text;
        console.log("URL collée:", text);
      } catch (err) {
        console.error("Erreur presse-papier:", err);
        const userInput = prompt("Collez votre URL YouTube ici:");
        if (userInput) {
          urlInput.value = userInput;
        }
      }
    });
  }
});

// Fonction spéciale pour iOS
async function handleIOSDownload(url, title) {
  console.log("Gestion téléchargement iOS");

  // Créer un lien direct qui force le téléchargement
  const downloadUrl = `/api/download-ios?url=${encodeURIComponent(url)}`;

  // Méthode 1: Ouvrir dans nouvel onglet avec instructions
  const newWindow = window.open(downloadUrl, "_blank");

  // Instructions détaillées pour l'utilisateur
  showIOSInstructions(title);

  // Méthode 2: Tentative de téléchargement direct après un délai
  setTimeout(() => {
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = `${title
      .replace(/[^\w\s-]/gi, "")
      .replace(/\s+/g, "_")}.m4a`;
    link.style.display = "none";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, 2000);
}

// Fonction pour Android et desktop
async function handleStandardDownload(url, title) {
  console.log("Gestion téléchargement standard");

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

    const contentDisposition = response.headers.get("Content-Disposition");
    let filename = "audio.m4a";

    if (contentDisposition) {
      const match = contentDisposition.match(/filename="(.+)"/);
      if (match) {
        filename = match[1];
      }
    }

    const blob = await response.blob();
    console.log("Blob reçu, taille:", blob.size);

    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = filename;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    window.URL.revokeObjectURL(downloadUrl);
    alert("Téléchargement terminé !");
  } catch (error) {
    console.error("Erreur téléchargement:", error);
    alert(`Erreur de téléchargement: ${error.message}`);
  }
}

// Instructions détaillées pour iOS
function showIOSInstructions(title) {
  const instructionsDiv = document.getElementById("download-instructions");
  if (instructionsDiv) {
    instructionsDiv.innerHTML = `
      <div style="background: #ff9800; color: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
        <h4 style="margin: 0 0 10px 0;">📱 Instructions iOS/Safari :</h4>
        <ol style="margin: 0; padding-left: 20px; line-height: 1.6;">
          <li>Un nouvel onglet va s'ouvrir avec votre fichier audio</li>
          <li><strong>Appuyez longuement</strong> sur l'écran (pas sur les boutons)</li>
          <li>Sélectionnez <strong>"Télécharger le fichier lié"</strong> ou <strong>"Enregistrer dans Fichiers"</strong></li>
          <li>Le fichier sera sauvé dans votre dossier Téléchargements ou Fichiers</li>
        </ol>
        <p style="margin: 10px 0 0 0; font-size: 12px; opacity: 0.9;">
          💡 Si ça ne marche pas, essayez d'utiliser l'app Firefox ou Chrome sur iOS
        </p>
      </div>
    `;
  }

  // Notification système (si supportée)
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("YouTube Downloader", {
      body: `Téléchargement de "${title}" en cours...`,
      icon: "/icons/icon-192x192.png",
    });
  }
}

// Demander permission pour les notifications
function requestNotificationPermission() {
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
}

// Test API
function testAPI() {
  fetch("/api/test")
    .then((response) => response.json())
    .then((data) => console.log("Test API:", data))
    .catch((error) => console.error("Erreur test API:", error));
}

// Initialisation
testAPI();
requestNotificationPermission();

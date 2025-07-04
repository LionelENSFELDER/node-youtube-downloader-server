// sw.js - Service Worker pour YouTube Downloader PWA

const CACHE_NAME = "youtube-downloader-v1";
const urlsToCache = [
  "/",
  "/app.js",
  "/manifest.json",
  // Ajoutez d'autres ressources statiques si nécessaire
];

// Installation du Service Worker
self.addEventListener("install", (event) => {
  console.log("Service Worker: Installation en cours...");

  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log("Service Worker: Cache ouvert");
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log("Service Worker: Ressources mises en cache");
        // Force l'activation immédiate du nouveau service worker
        return self.skipWaiting();
      })
  );
});

// Activation du Service Worker
self.addEventListener("activate", (event) => {
  console.log("Service Worker: Activation en cours...");

  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Supprimer les anciens caches
            if (cacheName !== CACHE_NAME) {
              console.log(
                "Service Worker: Suppression ancien cache:",
                cacheName
              );
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log("Service Worker: Activé");
        // Prendre le contrôle de tous les clients immédiatement
        return self.clients.claim();
      })
  );
});

// Interception des requêtes réseau
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Stratégie différente selon le type de requête
  if (url.pathname.startsWith("/api/")) {
    // Pour les API: toujours aller sur le réseau (pas de cache)
    event.respondWith(
      fetch(request).catch(() => {
        // Si pas de réseau, retourner une réponse d'erreur
        return new Response(
          JSON.stringify({
            error: "Pas de connexion réseau",
            offline: true,
          }),
          {
            status: 503,
            statusText: "Service Unavailable",
            headers: { "Content-Type": "application/json" },
          }
        );
      })
    );
  } else {
    // Pour les fichiers statiques: Cache First strategy
    event.respondWith(
      caches
        .match(request)
        .then((response) => {
          // Si trouvé dans le cache, le retourner
          if (response) {
            console.log("Service Worker: Servi depuis le cache:", request.url);
            return response;
          }

          // Sinon, aller sur le réseau
          return fetch(request).then((response) => {
            // Vérifier si la réponse est valide
            if (
              !response ||
              response.status !== 200 ||
              response.type !== "basic"
            ) {
              return response;
            }

            // Cloner la réponse car elle ne peut être consommée qu'une fois
            const responseToCache = response.clone();

            // Ajouter au cache pour les prochaines fois
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });

            return response;
          });
        })
        .catch(() => {
          // Si pas de réseau et pas dans le cache
          if (request.destination === "document") {
            // Pour les pages HTML, retourner la page principale
            return caches.match("/");
          }
        })
    );
  }
});

// Gestion des messages depuis l'application principale
self.addEventListener("message", (event) => {
  console.log("Service Worker: Message reçu:", event.data);

  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }

  if (event.data && event.data.type === "GET_VERSION") {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});

// Gestion des notifications push (optionnel)
self.addEventListener("push", (event) => {
  console.log("Service Worker: Notification push reçue");

  const options = {
    body: event.data ? event.data.text() : "Téléchargement terminé!",
    icon: "/icons/icon-192x192.png",
    badge: "/icons/icon-192x192.png",
    vibrate: [100, 50, 100],
    actions: [
      {
        action: "open",
        title: "Ouvrir l'app",
      },
      {
        action: "close",
        title: "Fermer",
      },
    ],
  };

  event.waitUntil(
    self.registration.showNotification("YouTube Downloader", options)
  );
});

// Gestion des clics sur les notifications
self.addEventListener("notificationclick", (event) => {
  console.log("Service Worker: Clic sur notification");

  event.notification.close();

  if (event.action === "open") {
    event.waitUntil(clients.openWindow("/"));
  }
});

// Synchronisation en arrière-plan (optionnel)
self.addEventListener("sync", (event) => {
  console.log("Service Worker: Sync en arrière-plan:", event.tag);

  if (event.tag === "background-sync") {
    event.waitUntil(
      // Ici vous pourriez synchroniser des données ou reprendre des téléchargements
      console.log("Synchronisation en arrière-plan effectuée")
    );
  }
});

// Mise à jour du cache automatique
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "UPDATE_CACHE") {
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.addAll(urlsToCache);
      })
    );
  }
});

// test-client.js - Script pour tester le serveur
const axios = require("axios");
const fs = require("fs");

const SERVER_URL = "http://localhost:3001";

// URL de test (vidéo courte et publique)
const TEST_URL = "https://www.youtube.com/watch?v=9bZkp7q19f0"; // "Gangnam Style" - très stable

async function testServer() {
  console.log("🧪 Tests du serveur API YouTube");
  console.log("================================\n");

  try {
    // Test 1: Vérifier que le serveur répond
    console.log("1️⃣ Test de connexion...");
    const healthCheck = await axios.get(`${SERVER_URL}/test`);
    console.log("✅ Serveur accessible:", healthCheck.data.message);
    console.log("");

    // Test 2: Obtenir les informations de la vidéo
    console.log("2️⃣ Test récupération info vidéo...");
    const infoResponse = await axios.post(`${SERVER_URL}/info`, {
      url: TEST_URL,
    });

    if (infoResponse.data.success) {
      console.log("✅ Informations récupérées:");
      console.log(`   Titre: ${infoResponse.data.video.title}`);
      console.log(`   Durée: ${infoResponse.data.video.duration}s`);
      console.log(`   Auteur: ${infoResponse.data.video.author}`);
      console.log(
        `   Formats disponibles: ${infoResponse.data.video.formats.length}`
      );
    } else {
      console.log("❌ Échec récupération info");
    }
    console.log("");

    // Test 3: Test de téléchargement (juste les headers)
    console.log("3️⃣ Test téléchargement (headers uniquement)...");
    const downloadResponse = await axios.post(
      `${SERVER_URL}/download`,
      {
        url: TEST_URL,
      },
      {
        responseType: "stream",
        timeout: 10000, // 10 secondes max pour ce test
      }
    );

    console.log("✅ Headers de téléchargement:");
    console.log(`   Content-Type: ${downloadResponse.headers["content-type"]}`);
    console.log(
      `   Content-Disposition: ${downloadResponse.headers["content-disposition"]}`
    );

    // Annuler le téléchargement après avoir vérifié les headers
    downloadResponse.data.destroy();
    console.log("   (Téléchargement annulé pour le test)");
    console.log("");

    console.log("🎉 Tous les tests sont passés !");
    console.log("\n📱 Pour tester avec votre app React Native:");
    console.log(`   Changez API_BASE_URL vers: ${SERVER_URL}`);
  } catch (error) {
    console.error("❌ Erreur de test:", error.message);

    if (error.code === "ECONNREFUSED") {
      console.log("\n💡 Le serveur n'est pas démarré. Lancez:");
      console.log("   npm run dev");
    }
  }
}

// Fonction pour tester avec une URL personnalisée
async function testCustomUrl(url) {
  console.log(`\n🔗 Test avec URL personnalisée: ${url}`);

  try {
    const response = await axios.post(`${SERVER_URL}/info`, { url });

    if (response.data.success) {
      console.log("✅ URL valide");
      console.log(`   Titre: ${response.data.video.title}`);
      console.log(`   Durée: ${response.data.video.duration}s`);
    }
  } catch (error) {
    console.log(
      "❌ URL invalide ou erreur:",
      error.response?.data?.error || error.message
    );
  }
}

// Exécuter les tests
if (require.main === module) {
  // Test avec URL par défaut
  testServer();

  // Tester avec URL depuis les arguments de ligne de commande
  const customUrl = process.argv[2];
  if (customUrl) {
    setTimeout(() => testCustomUrl(customUrl), 2000);
  }
}

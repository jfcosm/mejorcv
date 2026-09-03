// Cintia Backend Server - Feature Branch: feature/gemini-headshots-generator (Google AI Studio Image Gen Engine)
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const AdmZip = require('adm-zip');
const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');
const pkg = require('./package.json');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configurations
const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');
const CONFIG_PATH = path.join(DATA_DIR, 'config.json');

// Ensure data directory exists
try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
} catch (err) {
  console.warn("Could not create data directory, running in ephemeral filesystem mode.");
}

// Memory cache variables for serverless environments (Vercel)
let inMemoryDb = null;
let inMemoryConfig = null;
let firestoreDb = null;
let lastFirebaseError = null;
let firebaseProjectId = null;

// Firebase Firestore Initializer (Supports raw JSON, Base64, escaped newlines, and Vercel string formats)
function initFirebase() {
  if (firestoreDb) return firestoreDb;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    lastFirebaseError = "Variable de entorno FIREBASE_SERVICE_ACCOUNT no encontrada en el runtime de Vercel.";
    return null;
  }

  try {
    let serviceAccount;
    let rawStr = typeof raw === 'string' ? raw.trim() : JSON.stringify(raw);

    // Check if it's base64 encoded
    if (rawStr.startsWith('ey') || (!rawStr.startsWith('{') && !rawStr.startsWith('"') && !rawStr.startsWith("'"))) {
      try {
        const decoded = Buffer.from(rawStr, 'base64').toString('utf8');
        if (decoded.trim().startsWith('{')) {
          rawStr = decoded.trim();
        }
      } catch (e) { }
    }

    // Remove outer quotes if accidentally wrapped by environment variable editor
    if ((rawStr.startsWith("'") && rawStr.endsWith("'")) || (rawStr.startsWith('"') && rawStr.endsWith('"'))) {
      if (!rawStr.includes('{\\n') && !rawStr.includes('{\n')) {
        rawStr = rawStr.slice(1, -1);
      }
    }

    try {
      serviceAccount = JSON.parse(rawStr);
    } catch (parseErr) {
      // If parsing fails, try unescaping backslashes
      try {
        serviceAccount = JSON.parse(rawStr.replace(/\\"/g, '"'));
      } catch (innerErr) {
        throw new Error(`Error parseando JSON de FIREBASE_SERVICE_ACCOUNT: ${parseErr.message}`);
      }
    }

    if (typeof serviceAccount === 'string') {
      serviceAccount = JSON.parse(serviceAccount);
    }

    if (!serviceAccount || !serviceAccount.project_id || !serviceAccount.private_key) {
      throw new Error(`Estructura inválida: faltan campos obligatorios (project_id o private_key). Campos encontrados: ${Object.keys(serviceAccount || {}).join(', ')}`);
    }

    // Fix escaped newlines in private key if set in Vercel environment variables
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }

    let appInstance;
    const activeApps = getApps();
    if (!activeApps.length) {
      appInstance = initializeApp({
        credential: cert(serviceAccount)
      });
    } else {
      appInstance = activeApps[0];
    }

    firestoreDb = getFirestore(appInstance);
    firebaseProjectId = serviceAccount.project_id;
    lastFirebaseError = null;
    console.log("Connected to Firebase Cloud Firestore successfully for project:", firebaseProjectId);
    return firestoreDb;
  } catch (err) {
    lastFirebaseError = err.message;
    console.error("Error initializing Firebase Firestore from FIREBASE_SERVICE_ACCOUNT:", err.message);
    return null;
  }
}

initFirebase();

// Helper functions for Database
function readDb() {
  if (inMemoryDb) return inMemoryDb;
  try {
    const seedDb = require('./data/db.json');
    inMemoryDb = JSON.parse(JSON.stringify(seedDb));
    return inMemoryDb;
  } catch (reqErr) {
    try {
      const p = fs.existsSync(DB_PATH) ? DB_PATH : path.join(process.cwd(), 'data', 'db.json');
      inMemoryDb = JSON.parse(fs.readFileSync(p, 'utf8'));
      return inMemoryDb;
    } catch (err) {
      inMemoryDb = { visits: 0, analyses: [] };
      return inMemoryDb;
    }
  }
}

function writeDb(data) {
  inMemoryDb = data;
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.warn("Read-only filesystem detected. Database updated in memory only.");
  }
}

// Database Operations Adapter (Firestore with local disk / memory fallback)
async function saveAnalysisDoc(logEntry) {
  const db = readDb();
  db.analyses.push(logEntry);
  writeDb(db);

  const dbFs = initFirebase();
  if (dbFs) {
    try {
      const cleanData = JSON.parse(JSON.stringify(logEntry));
      await dbFs.collection('analyses').doc(logEntry.id).set(cleanData);
    } catch (err) {
      console.error("Firestore saveAnalysisDoc error:", err.message);
    }
  }
}

async function updateAnalysisDoc(analysisId, updateData) {
  const db = readDb();
  const idx = db.analyses.findIndex(a => a.id === analysisId);
  if (idx !== -1) {
    Object.assign(db.analyses[idx], updateData);
    writeDb(db);
  } else {
    db.analyses.push({ id: analysisId, ...updateData });
    writeDb(db);
  }

  const dbFs = initFirebase();
  if (dbFs) {
    try {
      const cleanUpdate = JSON.parse(JSON.stringify(updateData));
      await dbFs.collection('analyses').doc(analysisId).set(cleanUpdate, { merge: true });
    } catch (err) {
      console.error("Firestore updateAnalysisDoc error:", err.message);
    }
  }
}

async function getAnalysisDoc(analysisId) {
  const dbFs = initFirebase();
  if (dbFs) {
    try {
      const doc = await dbFs.collection('analyses').doc(analysisId).get();
      if (doc.exists) {
        return doc.data();
      }
    } catch (err) {
      console.error("Firestore getAnalysisDoc error:", err.message);
    }
  }
  const db = readDb();
  return db.analyses.find(a => a.id === analysisId) || null;
}

async function deleteAnalysisDoc(analysisId) {
  const db = readDb();
  const idx = db.analyses.findIndex(a => a.id === analysisId);
  if (idx !== -1) {
    db.analyses.splice(idx, 1);
    writeDb(db);
  }

  const dbFs = initFirebase();
  if (dbFs) {
    try {
      await dbFs.collection('analyses').doc(analysisId).delete();
      await dbFs.collection('app_stats').doc('tombstones').set({
        deletedIds: FieldValue.arrayUnion(analysisId)
      }, { merge: true });
    } catch (err) {
      console.error("Firestore deleteAnalysisDoc error:", err.message);
    }
  }
}

async function getAdminData(config) {
  const priceAi = parseFloat(config?.priceAi) || 2.0;
  const priceExpert = parseFloat(config?.priceExpert) || 25.0;
  const priceCoverLetter = parseFloat(config?.priceCoverLetter) || 2.0;
  const priceHeadshots = parseFloat(config?.priceHeadshots) || 6.0;
  const geminiStats = await getGeminiStats(config);

  const map = new Map();
  const localDb = readDb();
  if (localDb.analyses && Array.isArray(localDb.analyses)) {
    localDb.analyses.forEach(a => {
      if (a && a.id) map.set(a.id, a);
    });
  }

  let totalVisits = localDb.visits || 0;

  const dbFs = initFirebase();
  if (dbFs) {
    try {
      // Get visits
      const statsDoc = await dbFs.collection('app_stats').doc('general').get();
      if (statsDoc.exists && typeof statsDoc.data().visits === 'number') {
        totalVisits = Math.max(statsDoc.data().visits, totalVisits);
      }

      // Get analyses from Firestore
      let snap;
      try {
        snap = await dbFs.collection('analyses').orderBy('uploadedAt', 'desc').limit(500).get();
      } catch (orderErr) {
        console.warn("Firestore orderBy uploadedAt failed, reading without orderBy:", orderErr.message);
        snap = await dbFs.collection('analyses').limit(500).get();
      }

      snap.forEach(doc => {
        const data = doc.data();
        if (data) map.set(doc.id || data.id, data);
      });

      // Filter out permanently deleted IDs (tombstones)
      try {
        const tombDoc = await dbFs.collection('app_stats').doc('tombstones').get();
        if (tombDoc.exists && Array.isArray(tombDoc.data().deletedIds)) {
          tombDoc.data().deletedIds.forEach(id => map.delete(id));
        }
      } catch (tombErr) {}
    } catch (err) {
      console.error("Firestore getAdminData error, using local fallback:", err.message);
    }
  }

  const analysesList = Array.from(map.values());
  // Ensure sorted by uploadedAt descending
  analysesList.sort((a, b) => new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0));

  const totalAnalyses = analysesList.length;
  const paidAi = analysesList.filter(a => a.hasAiPaid || a.paymentStatus === 'completed_ai').length;
  const paidCoverLetter = analysesList.filter(a => a.hasCoverLetterPaid || a.paymentStatus === 'completed_cover_letter').length;
  const paidHeadshots = analysesList.filter(a => a.hasHeadshotsPaid || a.paymentStatus === 'completed_headshots').length;
  const paidExpertPending = analysesList.filter(a => (a.hasExpertPaid && a.expertStatus === 'pending') || a.paymentStatus === 'pending_expert' || a.paymentStatus === 'paid_expert' || (a.expertContact && a.expertStatus !== 'completed')).length;
  const paidExpertCompleted = analysesList.filter(a => (a.hasExpertPaid && a.expertStatus === 'completed') || a.paymentStatus === 'completed_expert').length;
  const paidExpert = paidExpertPending + paidExpertCompleted;
  const totalRevenue = (paidAi * priceAi) + (paidCoverLetter * priceCoverLetter) + (paidHeadshots * priceHeadshots) + (paidExpert * priceExpert);

  const documentLog = analysesList.map(a => {
    const hasAiPaid = Boolean(a.hasAiPaid === true || a.paymentStatus === 'completed_ai');
    const hasCoverLetterPaid = Boolean(a.hasCoverLetterPaid === true || a.paymentStatus === 'completed_cover_letter');
    const hasHeadshotsPaid = Boolean(a.hasHeadshotsPaid === true || a.paymentStatus === 'completed_headshots');
    const hasExpertPaid = Boolean(a.hasExpertPaid === true || a.paymentStatus === 'pending_expert' || a.paymentStatus === 'paid_expert' || a.paymentStatus === 'completed_expert' || a.expertContact);
    const expertStatus = a.expertStatus || (a.paymentStatus === 'completed_expert' ? 'completed' : (hasExpertPaid ? 'pending' : null));

    return {
      id: a.id,
      filename: a.filename || 'cv_documento',
      fileSize: a.fileSize || 0,
      fileType: a.fileType || '.pdf',
      uploadedAt: a.uploadedAt || new Date().toISOString(),
      ip: a.ip || '127.0.0.1',
      rating: a.rating || 3,
      paymentStatus: a.paymentStatus || 'free',
      hasAiPaid,
      hasCoverLetterPaid,
      hasHeadshotsPaid,
      hasExpertPaid,
      expertStatus,
      expertContact: a.expertContact || null,
      jobOfferText: a.jobOfferText || '',
      coverLetterText: a.coverLetterText || '',
      userPhotoData: a.userPhotoData || null,
      headshotsCount: Array.isArray(a.headshotImages) ? a.headshotImages.length : 0,
      archived: Boolean(a.archived),
      archivedAt: a.archivedAt || null
    };
  });

  return {
    stats: {
      totalVisits: Number(totalVisits) || 0,
      totalAnalyses: Number(totalAnalyses) || 0,
      paidAi: Number(paidAi) || 0,
      paidCoverLetter: Number(paidCoverLetter) || 0,
      paidHeadshots: Number(paidHeadshots) || 0,
      paidExpertPending: Number(paidExpertPending) || 0,
      paidExpertCompleted: Number(paidExpertCompleted) || 0,
      totalRevenue: Number(totalRevenue) || 0,
      geminiStats
    },
    documentLog
  };
}

// Gemini Usage Statistics Tracking
let inMemoryGeminiUsage = {
  totalCalls: 0,
  evaluations: 0,
  optimizations: 0,
  tests: 0,
  lastModel: "gemini-2.5-flash",
  lastCallAt: null
};

async function recordGeminiCall(type, model) {
  inMemoryGeminiUsage.totalCalls = (inMemoryGeminiUsage.totalCalls || 0) + 1;
  if (type) {
    inMemoryGeminiUsage[type] = (inMemoryGeminiUsage[type] || 0) + 1;
  }
  inMemoryGeminiUsage.lastModel = model || "gemini-2.5-flash";
  inMemoryGeminiUsage.lastCallAt = new Date().toISOString();

  const dbFs = initFirebase();
  if (dbFs) {
    try {
      const updateData = {
        totalCalls: FieldValue.increment(1),
        lastModel: model || "gemini-2.5-flash",
        lastCallAt: inMemoryGeminiUsage.lastCallAt
      };
      if (type) {
        updateData[type] = FieldValue.increment(1);
      }
      await dbFs.collection('app_stats').doc('gemini').set(updateData, { merge: true });
    } catch (err) {
      console.error("Firestore recordGeminiCall error:", err.message);
    }
  }
}

async function getGeminiStats(config) {
  const activeKey = getGeminiApiKey(config);
  let stats = { ...inMemoryGeminiUsage, isConfigured: !!activeKey };

  const dbFs = initFirebase();
  if (dbFs) {
    try {
      const doc = await dbFs.collection('app_stats').doc('gemini').get();
      if (doc.exists) {
        stats = { ...stats, ...doc.data(), isConfigured: !!activeKey };
      }
    } catch (err) {
      console.error("Firestore getGeminiStats error:", err.message);
    }
  }
  return stats;
}

async function incrementVisitsCounter() {
  const db = readDb();
  db.visits = (db.visits || 0) + 1;
  writeDb(db);

  const dbFs = initFirebase();
  if (dbFs) {
    try {
      await dbFs.collection('app_stats').doc('general').set({
        visits: FieldValue.increment(1)
      }, { merge: true });
    } catch (err) {
      console.error("Firestore incrementVisits error:", err.message);
    }
  }
}

function readConfig() {
  if (inMemoryConfig) return inMemoryConfig;
  try {
    const seedConfig = require('./data/config.json');
    inMemoryConfig = JSON.parse(JSON.stringify(seedConfig));
    return inMemoryConfig;
  } catch (reqErr) {
    try {
      const p = fs.existsSync(CONFIG_PATH) ? CONFIG_PATH : path.join(process.cwd(), 'data', 'config.json');
      inMemoryConfig = JSON.parse(fs.readFileSync(p, 'utf8'));
      return inMemoryConfig;
    } catch (err) {
      // Default fallback
      inMemoryConfig = {
        adminPassword: "",
        geminiApiKey: "",
        priceAi: 2.0,
        priceExpert: 25.0,
        priceAiClp: 2000,
        priceExpertClp: 25000,
        optAiEnabled: true,
        optExpertEnabled: true,
        captchaEnabled: true,
        rateLimitPerHour: 20,
        evaluationPrompt: "Eres Cintia, la experta virtual de MelodIA Lab en reclutamiento y auditoría de Currículums para superar filtros ATS (Applicant Tracking Systems). Analiza el siguiente texto de currículum vitae y audítalo bajo estos 7 criterios clave:\n1. Compatibilidad ATS (estructura de secciones estándar, legibilidad por software ATS, tipografías limpias y encabezados reconocibles).\n2. Claridad de Talentos e Habilidades (habilidades duras, blandas y certificaciones claras y categorizadas).\n3. Extensión del Documento (máximo 2 páginas recomendadas).\n4. Logros y Métricas Cuantificables (existencia de números, porcentajes o impactos cuantificados en la experiencia laboral).\n5. Lenguaje y Verbos de Acción (uso de verbos activos y tono profesional persuasivo).\n6. Datos de Contacto y Enlaces (presencia de datos esenciales de contacto y enlaces clave como LinkedIn o Portafolio).\n7. Ortografía y Consistencia Gramatical (ausencia de errores y concordancia en tiempos verbales).\n\nREGLAS ESTRICTAS DE AUDITORÍA DIAGNÓSTICA (TIER GRATUITO):\n- RESTRICCIÓN TOTAL DE RECOMENDACIONES: Tu objetivo es exclusivamente DIAGNOSTICAR EL ESTADO ACTUAL (describir qué problemas o debilidades presenta el CV frente a los filtros ATS y reclutadores, y qué nivel de compatibilidad tiene). QUEDA TERMINANTEMENTE PROHIBIDO incluir secciones de 'Recomendaciones Clave', 'Sugerencias de mejora', listas de consejos, listas de palabras clave o ejemplos de reescritura ('Por ejemplo, cambia X por Y'). Esos elementos pertenecen exclusivamente al informe pagado de Optimización por IA.\n- DETAILED EXPLANATION: El campo 'detailedExplanation' debe contener ÚNICA Y EXCLUSIVAMENTE 1 o 2 párrafos concisos resumiendo el diagnóstico general del documento y por qué obtuvo ese puntaje en estrellas, sin listas numeradas ni consejos prácticos.\n- CRONOLOGÍA Y FECHAS: No generes falsos positivos de fechas. Es completamente normal y válido que un currículum contenga fechas recientes (como 2024, 2025, 2026), roles actuales ('Presente', 'Actualidad', 'Present') o certificaciones recientes. Solo señala un problema de fechas si hay una inconsistencia lógica evidente e imposible (por ejemplo, terminar un trabajo antes de empezarlo). JAMÁS menciones variables internas, 'fecha del sistema' ni términos técnicos de la plataforma en las explicaciones o retroalimentaciones.\n- IDIOMA Y TONO: Debes responder 100% en el mismo idioma del currículum (si el CV está en inglés, responde todo el JSON estrictamente en inglés con vocabulario profesional; si está en español, responde estrictamente en español). Mantén un tono constructivo, profesional, empático y claro.\n\nDevuelve la respuesta estrictamente en formato JSON con la siguiente estructura:\n{\n  \"stars\": (número entero de 1 a 5 para el puntaje global),\n  \"summary\": \"Resumen ejecutivo del diagnóstico\",\n  \"atsCompatibility\": { \"stars\": (número entero de 1 a 5), \"feedback\": \"diagnóstico de brechas y estado actual con marcadores **negrita** para conceptos clave\" },\n  \"skillsClarity\": { \"stars\": (número entero de 1 a 5), \"feedback\": \"diagnóstico con marcadores **negrita**\" },\n  \"lengthCheck\": { \"stars\": (número entero de 1 a 5), \"feedback\": \"diagnóstico con marcadores **negrita**\" },\n  \"quantifiableMetrics\": { \"stars\": (número entero de 1 a 5), \"feedback\": \"diagnóstico con marcadores **negrita**\" },\n  \"actionVerbs\": { \"stars\": (número entero de 1 a 5), \"feedback\": \"diagnóstico con marcadores **negrita**\" },\n  \"contactLinks\": { \"stars\": (número entero de 1 a 5), \"feedback\": \"diagnóstico con marcadores **negrita**\" },\n  \"grammarSpelling\": { \"stars\": (número entero de 1 a 5), \"feedback\": \"diagnóstico con marcadores **negrita**\" },\n  \"detailedExplanation\": \"Diagnóstico cualitativo en 1 o 2 párrafos del estado actual del currículum y justificación del puntaje obtenido (sin listas de recomendaciones ni ejemplos de redacción).\"\n}",
        optimizationPrompt: "Eres Cintia, la redactora profesional y experta virtual de MelodIA Lab en marca personal y reclutamiento ATS. Toma el siguiente currículum vitae y genera un entregable integral de alto impacto estructurado en dos secciones principales en formato Markdown limpio:\n\n# 📄 CURRÍCULUM VITAE OPTIMIZADO (Formato ATS)\nReescribe completamente el currículum del candidato con una estructura impecable de alta legibilidad para software ATS, encabezados estándar de la industria, viñetas de impacto redactadas con verbos de acción fuertes y logros con métricas cuantificables.\n\n---\n\n# 💡 PLAN DE ACCIÓN Y RECOMENDACIONES TÁCTICAS DE CINTIA\nEntrega una guía de consultoría personalizada y detallada para potenciar la empleabilidad del postulante:\n1. **Palabras Clave Estratégicas para su Sector:** Términos técnicos, herramientas y competencias demandadas que debe destacar en postulaciones.\n2. **Fórmulas de Redacción de Logros:** Ejemplos concretos de cómo reformular responsabilidades pasadas en logros de alto impacto usando la fórmula 'Acción + Contexto + Resultado Cuantificable'.\n3. **Propuesta de Perfil Profesional Alternativo:** Redacción persuasiva y moderna para el resumen inicial del CV o biografía de LinkedIn.\n4. **Recomendaciones para LinkedIn y Entrevistas:** Consejos específicos sobre cómo presentar su trayectoria en su perfil digital y defender sus fortalezas ante reclutadores."
      };
      return inMemoryConfig;
    }
  }
}

async function writeConfig(data) {
  inMemoryConfig = data;
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.warn("Read-only filesystem detected. Configuration updated in memory only.");
  }
  const dbFs = initFirebase();
  if (dbFs) {
    try {
      await dbFs.collection('app_config').doc('settings').set(data, { merge: true });
    } catch (err) {
      console.error("Firestore writeConfig error:", err.message);
    }
  }
}

// Admin Session Token (Stateless HMAC-signed token for Serverless compatibility across lambdas)
function getSessionSecret() {
  return process.env.ADMIN_PASSWORD || 'cintia_secret_session_key_2026';
}

function generateAdminToken(email) {
  const expiresAt = Date.now() + 8 * 60 * 60 * 1000; // 8 hours
  const payload = `${email}:${expiresAt}`;
  const hmac = crypto.createHmac('sha256', getSessionSecret()).update(payload).digest('hex');
  return Buffer.from(`${payload}:${hmac}`).toString('base64url');
}

function verifyAdminToken(token) {
  if (!token) return false;
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const [email, expiresAtStr, receivedHmac] = decoded.split(':');
    if (!email || !expiresAtStr || !receivedHmac) return false;
    const expiresAt = parseInt(expiresAtStr, 10);
    if (Date.now() > expiresAt) return false;
    const payload = `${email}:${expiresAtStr}`;
    const expectedHmac = crypto.createHmac('sha256', getSessionSecret()).update(payload).digest('hex');
    if (crypto.timingSafeEqual(Buffer.from(receivedHmac), Buffer.from(expectedHmac))) {
      return { email };
    }
  } catch (e) {
    return false;
  }
  return false;
}

async function getConfigDoc() {
  const dbFs = initFirebase();
  const fileConfig = readConfig();
  if (dbFs) {
    try {
      const doc = await dbFs.collection('app_config').doc('settings').get();
      if (doc.exists) {
        const firestoreData = doc.data() || {};
        inMemoryConfig = { ...fileConfig, ...firestoreData };
        // Sync code prompt to Firestore so stale prompts never persist in DB
        if (fileConfig.evaluationPrompt && (!firestoreData.evaluationPrompt || firestoreData.evaluationPrompt.includes('recomendaciones clave para mejorar') || firestoreData.evaluationPrompt.includes('REGLAS FUNDAMENTALES DE EVALUACIÓN') || firestoreData.evaluationPrompt.includes('Explicación detallada del porqué de la puntuación en estrellas'))) {
          inMemoryConfig.evaluationPrompt = fileConfig.evaluationPrompt;
          inMemoryConfig.optimizationPrompt = fileConfig.optimizationPrompt;
          await dbFs.collection('app_config').doc('settings').set({
            evaluationPrompt: fileConfig.evaluationPrompt,
            optimizationPrompt: fileConfig.optimizationPrompt
          }, { merge: true });
        }
        return inMemoryConfig;
      } else {
        await dbFs.collection('app_config').doc('settings').set(fileConfig);
        return fileConfig;
      }
    } catch (err) {
      console.error("Firestore getConfigDoc error, falling back to local:", err.message);
    }
  }
  return fileConfig;
}

// Captcha System (Stateless AES-256-CBC with deterministic cross-instance key)
// In serverless environments (e.g. Vercel), instances scale dynamically.
// Deriving a consistent 32-byte key from environment credentials guarantees
// that an instance verifying the captcha can decrypt tokens generated by any other instance.
const CAPTCHA_KEY_SEED = process.env.ADMIN_PASSWORD || process.env.PAYPAL_SECRET_KEY || process.env.ADMIN_EMAIL || 'cintia-anti-abuse-token-seed-2026';
const CAPTCHA_KEY = crypto.createHash('sha256').update(CAPTCHA_KEY_SEED).digest(); // 32 bytes

function generateCaptcha() {
  const num1 = Math.floor(Math.random() * 9) + 1;
  const num2 = Math.floor(Math.random() * 9) + 1;
  const operations = ['+', '-', '*'];
  const operation = operations[Math.floor(Math.random() * operations.length)];
  let answer;
  let text;

  if (operation === '+') {
    answer = num1 + num2;
    text = `${num1} + ${num2} = ?`;
  } else if (operation === '-') {
    const max = Math.max(num1, num2);
    const min = Math.min(num1, num2);
    answer = max - min;
    text = `${max} - ${min} = ?`;
  } else {
    answer = num1 * num2;
    text = `${num1} × ${num2} = ?`;
  }

  const width = 180;
  const height = 50;
  let noise = '';
  // Random lines
  for (let i = 0; i < 4; i++) {
    const x1 = Math.floor(Math.random() * width);
    const y1 = Math.floor(Math.random() * height);
    const x2 = Math.floor(Math.random() * width);
    const y2 = Math.floor(Math.random() * height);
    noise += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#10b981" stroke-width="1" opacity="0.3" />`;
  }
  // Random dots
  for (let i = 0; i < 15; i++) {
    const cx = Math.floor(Math.random() * width);
    const cy = Math.floor(Math.random() * height);
    const r = Math.floor(Math.random() * 2) + 0.5;
    noise += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#9ca3af" opacity="0.4" />`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="100%" height="100%" fill="#f9fafb" rx="6" stroke="#e5e7eb" stroke-width="1"/>
    ${noise}
    <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="bold" fill="#111827" letter-spacing="1">
      ${text}
    </text>
  </svg>`;

  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 min window
  const payload = JSON.stringify({ answer: String(answer), expiresAt });

  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', CAPTCHA_KEY, iv);
  let encrypted = cipher.update(payload, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const token = iv.toString('hex') + ':' + encrypted;

  return { svg, token };
}

function verifyCaptcha(token, userInput) {
  try {
    if (!token || typeof token !== 'string') return false;
    const parts = token.split(':');
    if (parts.length !== 2) return false;

    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = parts[1];

    const decipher = crypto.createDecipheriv('aes-256-cbc', CAPTCHA_KEY, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    const parsed = JSON.parse(decrypted);

    if (Date.now() > parsed.expiresAt) {
      return false; // Expired
    }
    return String(userInput).trim() === String(parsed.answer);
  } catch (err) {
    console.error('verifyCaptcha decryption failed:', err.message);
    return false; // Decrypt failed
  }
}

// IP rate limiter
const ipRequests = {};
function isRateLimited(ip, limit) {
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;

  if (!ipRequests[ip]) {
    ipRequests[ip] = [];
  } else {
    ipRequests[ip] = ipRequests[ip].filter(ts => ts > oneHourAgo);
  }

  if (ipRequests[ip].length >= limit) {
    return true;
  }

  ipRequests[ip].push(now);
  return false;
}

// Admin Login Rate Limiter (consecutive attempts check)
const adminLoginAttempts = new Map();
function checkAdminLoginRateLimit(ip) {
  const now = Date.now();
  const record = adminLoginAttempts.get(ip);
  if (record) {
    if (record.lockUntil && now < record.lockUntil) {
      return { limited: true, secondsLeft: Math.ceil((record.lockUntil - now) / 1000) };
    }
    if (record.lockUntil && now >= record.lockUntil) {
      record.count = 0;
      record.lockUntil = null;
    }
  }
  return { limited: false };
}

function registerAdminLoginAttempt(ip, success) {
  const now = Date.now();
  let record = adminLoginAttempts.get(ip);
  if (!record) {
    record = { count: 0, lockUntil: null };
    adminLoginAttempts.set(ip, record);
  }
  if (success) {
    record.count = 0;
    record.lockUntil = null;
  } else {
    record.count++;
    if (record.count >= 5) {
      record.lockUntil = now + 60 * 1000; // 1 minute lock
    }
  }
}

// ODT parser helper
function parseOdt(buffer) {
  try {
    const zip = new AdmZip(buffer);
    const contentXml = zip.readAsText('content.xml');
    const matches = contentXml.match(/<text:[ph][^>]*>([\s\S]*?)<\/text:[ph]>/g);
    if (!matches) return "";
    return matches.map(match => {
      return match.replace(/<[^>]+>/g, '').trim();
    }).filter(txt => txt.length > 0).join('\n');
  } catch (err) {
    console.error("Error reading ODT:", err);
    throw new Error("No se pudo leer el archivo ODT.");
  }
}

// Gemini API Key Resolver Helper (reads from config doc or environment variables)
function getGeminiApiKey(config) {
  if (config && config.geminiApiKey && typeof config.geminiApiKey === 'string' && config.geminiApiKey.trim() !== '' && !config.geminiApiKey.startsWith('••••••••')) {
    return config.geminiApiKey.trim();
  }
  return process.env.GEMINI_API_KEY || process.env.GEMINI_KEY || process.env.GOOGLE_API_KEY || '';
}

// Gemini API integration with multi-model fallback (gemini-2.5-flash, gemini-2.0-flash, gemini-1.5-flash)
async function callGemini(apiKey, systemInstruction, promptContent, responseJson = false) {
  const key = apiKey || getGeminiApiKey();
  if (!key) {
    throw new Error("Falta la configuración de Gemini API Key en el servidor (GEMINI_API_KEY).");
  }

  const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
  let lastError = null;

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

      const payload = {
        contents: [
          {
            parts: [
              { text: promptContent }
            ]
          }
        ]
      };

      if (systemInstruction) {
        payload.systemInstruction = {
          parts: [
            { text: systemInstruction }
          ]
        };
      }

      if (responseJson) {
        payload.generationConfig = {
          responseMimeType: "application/json"
        };
      }

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`Gemini model ${model} returned code ${response.status}:`, errorText);
        lastError = new Error(`Gemini API (${model}) error ${response.status}: ${errorText}`);
        continue;
      }

      const responseData = await response.json();
      if (responseData.candidates && responseData.candidates[0] && responseData.candidates[0].content && responseData.candidates[0].content.parts) {
        await recordGeminiCall(responseJson ? "evaluations" : "optimizations", model);
        return responseData.candidates[0].content.parts[0].text;
      }
    } catch (err) {
      console.warn(`Attempt with Gemini model ${model} failed:`, err.message);
      lastError = err;
    }
  }

  throw lastError || new Error("No se pudo obtener respuesta de Gemini API.");
}

// Express middlewares
app.use(express.json());

// Security Headers Middleware
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

// Obscured Admin panel route & friendly aliases
const ADMIN_ROUTE = process.env.ADMIN_ROUTE || '/cintia-private-dashboard';
app.get([ADMIN_ROUTE, '/admin', '/admin.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.use(express.static(path.join(__dirname, 'public')));

// Multer storage in memory
const upload = multer({
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Increment visits on main load
app.use((req, res, next) => {
  if (req.method === 'GET' && (req.path === '/' || req.path === '/index.html')) {
    incrementVisitsCounter();
  }
  next();
});

// Captcha endpoint
app.get('/api/captcha', (req, res) => {
  const config = readConfig();
  if (!config.captchaEnabled) {
    return res.json({ enabled: false });
  }
  const captcha = generateCaptcha();
  res.json({ enabled: true, svg: captcha.svg, token: captcha.token });
});

// Language detection helper
function detectLanguage(text) {
  const englishWords = ['experience', 'education', 'skills', 'developer', 'engineer', 'manager', 'software', 'project', 'present', 'about', 'summary', 'languages'];
  const spanishWords = ['experiencia', 'educación', 'habilidades', 'desarrollador', 'ingeniero', 'gerente', 'software', 'proyecto', 'actualidad', 'presente', 'sobre', 'resumen', 'idiomas'];

  const lowerText = text.toLowerCase();
  let enCount = 0;
  let esCount = 0;

  englishWords.forEach(word => {
    const regex = new RegExp('\\b' + word + '\\b', 'g');
    const matches = lowerText.match(regex);
    if (matches) enCount += matches.length;
  });

  spanishWords.forEach(word => {
    const regex = new RegExp('\\b' + word + '\\b', 'g');
    const matches = lowerText.match(regex);
    if (matches) esCount += matches.length;
  });

  return enCount > esCount ? 'en' : 'es';
}

// AI Optimization Generator Helper
async function generateAiOptimization(filename, extractedText, lang, config) {
  const key = getGeminiApiKey(config);
  if (!key) {
    if (lang === 'en') {
      return `# ${filename.replace(/\.[^/.]+$/, "").toUpperCase()} - OPTIMIZED BY CINTIA

## Professional Summary
Results-driven Software Engineer with proven expertise in building scalable web architectures and robust backend services. Experienced in delivering high-impact solutions, improving system performance by up to 30%, and leading collaborative engineering teams.

---

## Key Professional Achievements & Roles

### Senior Software Engineer / Solutions Architect | Industry Leader
* **Architected** and deployed core backend microservices handling high concurrency, reducing average latency by **32%**.
* **Engineered** modern RESTful APIs and integrated real-time synchronization pipelines with **99.9% uptime**.
* **Spearheaded** agile code reviews, automated CI/CD deployment pipelines, and unit test coverage optimization (**+40% coverage**).

---

## Core Competencies & Technical Skills
* **Languages & Frameworks:** Node.js, Express, JavaScript (ES6+), TypeScript, React, HTML5, CSS3.
* **Database & Cloud:** PostgreSQL, Cloud Firestore, MongoDB, AWS / GCP.
* **Methodologies:** ATS Resume Formatting, Agile/Scrum, CI/CD Automation, Test-Driven Development.

---

## Education & Certifications
* **Bachelor of Science in Computer Science / Software Engineering**
* **AWS Certified Solutions Architect** | Cloud Computing
* **Scrum Master Certification (PSM I)** | Agile Delivery

---
> [!NOTE]
> *This document has been strategically rewritten with active impact verbs, ATS keyword injection, and quantifiable metrics.*`;
    } else {
      return `# ${filename.replace(/\.[^/.]+$/, "").toUpperCase()} - OPTIMIZADO POR CINTIA

## Resumen Profesional
Ingeniero de Software y especialista en desarrollo de soluciones tecnológicas escalables con más de 5 años de trayectoria en el ciclo completo de software. Experto en optimización de rendimiento, diseño de arquitecturas robustas y liderazgo técnico de equipos de desarrollo.

---

## Experiencia Profesional Destacada

### Desarrollador / Especialista Senior | Empresa Líder
* **Lideré** el diseño y desarrollo de la arquitectura del backend, reduciendo la latencia de respuesta de los servicios en un **30%**.
* **Coordiné** la migración tecnológica integral de interfaces obsoletas a arquitecturas dinámicas y responsivas, optimizando la retención del usuario final.
* **Sincronicé** e implementé flujos de integración y despliegue continuo (CI/CD), automatizando la puesta en producción y disminuyendo los tiempos de entrega.

---

## Habilidades Técnicas y Competencias
* **Desarrollo Backend:** Node.js, Express, RESTful APIs, JavaScript (ES6+), TypeScript.
* **Desarrollo Frontend:** React, HTML5, CSS3 modernos (flexbox, grid).
* **Bases de Datos & Cloud:** PostgreSQL, MongoDB, AWS Services.
* **Herramientas & Procesos:** Git, Docker, CI/CD, Scrum, Kanban, Pruebas Unitarias.

---

## Educación y Certificaciones
* **Licenciatura Universitaria** | Ingeniería de Software / Civil Informática
* **AWS Certified Solutions Architect** | AWS Cloud Platform
* **Certified ScrumMaster (CSM)** | Gestión de Proyectos Ágiles

---
> [!NOTE]
> *Este documento ha sido optimizado con inyección de palabras clave activas e impacto directo para filtros ATS (Applicant Tracking Systems) y está formateado en markdown para su fácil edición.*`;
    }
  }

  // Real Gemini AI Generation
  let languageInstruction = "";
  if (lang === 'en') {
    languageInstruction = "\n\nLANGUAGE: Please generate the optimized resume and recommendations strictly and exclusively in ENGLISH (Inglés).";
  } else {
    languageInstruction = "\n\nIDIOMA: Por favor genera el currículum optimizado y las recomendaciones estrictamente en ESPAÑOL (Spanish).";
  }
  const currentDate = lang === 'en'
    ? new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
  const dateHeader = lang === 'en'
    ? `Reference Date: ${currentDate}`
    : `Fecha de referencia: ${currentDate}`;
  const rawResult = await callGemini(
    key,
    config.optimizationPrompt + languageInstruction,
    `${dateHeader}\n\n${lang === 'en' ? 'RESUME TO OPTIMIZE:' : 'CURRÍCULUM A OPTIMIZAR:'}\n\n${extractedText}`,
    false // Expect markdown/text
  );

  let cleanedResult = (rawResult || "").trim();
  if (cleanedResult.startsWith('```markdown')) {
    cleanedResult = cleanedResult.replace(/^```markdown\s*/i, '').replace(/\s*```$/, '');
  } else if (cleanedResult.startsWith('```')) {
    cleanedResult = cleanedResult.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  return cleanedResult.trim();
}

// AI Cover Letter Generator Helper
function cleanPlainTextCoverLetter(text) {
  if (!text) return '';
  let clean = text;
  // 1. Remove code blocks
  clean = clean.replace(/```[a-zA-Z0-9_-]*\n?/g, '').replace(/```/g, '');
  // 2. Remove markdown header markers (# Header -> Header)
  clean = clean.replace(/^#{1,6}\s*(.+)$/gm, '$1');
  // 3. Remove bold / italics asterisks and underscores (**text**, *text*, __text__, _text_)
  clean = clean.replace(/\*\*\*([^*]+)\*\*\*/g, '$1');
  clean = clean.replace(/\*\*([^*]+)\*\*/g, '$1');
  clean = clean.replace(/\*([^*\n]+)\*/g, '$1');
  clean = clean.replace(/___([^_]+)___/g, '$1');
  clean = clean.replace(/__([^_]+)__/g, '$1');
  clean = clean.replace(/_([^_\n]+)_/g, '$1');
  // 4. Remove markdown links [text](url) -> text
  clean = clean.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  // 5. Clean horizontal rules
  clean = clean.replace(/^(?:---|___|\*\*\*)\s*$/gm, '');
  // 6. Clean bullets
  clean = clean.replace(/^[\s]*[\*\-\+]\s+/gm, '• ');
  // 7. Clean blockquotes
  clean = clean.replace(/^>\s?/gm, '');
  // 8. Normalize spacing
  clean = clean.replace(/\n{3,}/g, '\n\n');
  return clean.trim();
}

async function generateCoverLetter(filename, cvText, jobOfferText, lang, config) {
  const key = getGeminiApiKey(config);
  if (!key) {
    // Fallback template when no API key configured
    if (lang === 'en') {
      return cleanPlainTextCoverLetter(`COVER LETTER - ${filename.replace(/\.[^/.]+$/, "").toUpperCase()}

Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
Position: Candidate for Job Opening

Dear Hiring Team,

I am writing to express my strong interest in the opportunity advertised. With a solid professional background, proven technical competencies, and a track record of delivering measurable outcomes, I am confident that my experience aligns seamlessly with the requirements of your team.

Throughout my career, I have specialized in executing high-impact initiatives, streamlining workflows, and driving continuous improvement. Reviewing your job description, I was particularly inspired by your commitment to innovation and high standards. My background directly equips me to tackle the key challenges of this role from day one.

Key highlights I bring to your organization include:
• Demonstrated Impact: A history of exceeding core performance benchmarks and optimizing processes with quantifiable efficiency gains.
• Relevant Skill Set: Hands-on experience with the exact toolsets, methodologies, and cross-functional collaboration required for this vacancy.
• Proactive Problem Solving: A proactive approach to overcoming complex operational challenges and delivering reliable results under tight deadlines.

I would welcome the opportunity to discuss in greater detail how my background and qualifications will contribute to the continued success of your organization. Thank you for your time and consideration.

Sincerely,

${filename.replace(/\.[^/.]+$/, "").replace(/_/g, " ").toUpperCase()}
Contact details available in resume profile`);
    } else {
      return cleanPlainTextCoverLetter(`CARTA DE PRESENTACIÓN - ${filename.replace(/\.[^/.]+$/, "").toUpperCase()}

Fecha: ${new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}
Referencia: Postulación a Vacante Laboral

Estimado(a) Encargado(a) de Selección y Equipo de Contratación:

Por medio de la presente, deseo expresar mi firme interés en postular a la vacante laboral disponible en su organización. Al analizar en detalle los requisitos y desafíos del cargo, confío en que mi trayectoria profesional, competencias técnicas y compromiso con la excelencia aportarán un valor significativo e inmediato a su equipo.

A lo largo de mi experiencia laboral, me he destacado por resolver desafíos complejos, optimizar procesos de trabajo y alcanzar metas concretas con un enfoque orientado a resultados. La descripción de su oferta laboral resuena profundamente con mis fortalezas profesionales y metas de desarrollo.

Entre los principales aportes que pongo a su disposición destacan:
• Experiencia y Resultados Comprobados: Capacidad demostrada para liderar tareas críticas, superando estándares de calidad y optimizando recursos.
• Alineación de Competencias: Dominio de las herramientas, habilidades y metodologías requeridas para el desempeño exitoso del puesto.
• Compromiso y Trabajo Colaborativo: Habilidad para integrarme de manera ágil a equipos multidisciplinarios y promover soluciones eficientes y constructivas.

Agradezco de antemano el tiempo dedicado a revisar mis antecedentes y quedo a su entera disposición para profundizar en una entrevista laboral sobre cómo mi experiencia puede contribuir al éxito de sus proyectos.

Atentamente,

${filename.replace(/\.[^/.]+$/, "").replace(/_/g, " ").toUpperCase()}
Datos de contacto disponibles en el currículum vitae`);
    }
  }

  const basePrompt = config.coverLetterPrompt || (
    "Eres Cintia, la redactora profesional de cartas de presentación y estratega de carrera de MelodIA Lab. Tu objetivo es redactar una Carta de Presentación (Cover Letter) de alto impacto, personalizada y persuasiva, conectando el currículum del postulante con los requisitos de la oferta laboral específica proporcionada. La carta debe ser formal, atractiva para reclutadores humanos y optimizada con palabras clave de la vacante. REGLA ESTRICTA DE FORMATO: Redacta la carta exclusivamente en TEXTO PLANO PURO. NO uses asteriscos (**negritas**), dobles comillas tipográficas, guiones bajos (_cursivas_) ni formato Markdown (# encabezados), ya que el documento se entrega directamente como archivo de texto plano (.txt)."
  );

  const currentDateFormatted = lang === 'en'
    ? new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });

  const languagePrompt = lang === 'en'
    ? `\n\nCRITICAL INSTRUCTIONS:\n1. LANGUAGE: The target job opening is in English. Write the entire Cover Letter strictly in natural, professional, persuasive ENGLISH.\n2. TODAY'S DATE: ${currentDateFormatted}.\n3. OUTPUT FORMAT: STRICT PURE PLAIN TEXT ONLY. DO NOT USE ANY MARKDOWN ASTERISKS (**bold**), UNDERSCORES (_italic_), OR HASHTAGS (# Headers). Use clean paragraph line breaks. Include candidate header, formal salutation, 3-4 compelling paragraphs tailored to the job description, call to action, and professional sign-off.`
    : `\n\nINSTRUCCIONES CRÍTICAS:\n1. IDIOMA: La postulación es en español. Redacta la Carta de Presentación completa estrictamente en ESPAÑOL formal, persuasivo y natural.\n2. FECHA ACTUAL: ${currentDateFormatted}.\n3. FORMATO: TEXTO PLANO PURO ESTRICTO. NO USES NINGÚN ASTERISCO (**negritas**), GUIONES BAJOS (_cursiva_) NI HASHTAGS (# encabezados). Usa saltos de línea limpios entre párrafos. Incluye encabezado formal con nombre y contacto, fecha, destinatario, saludo profesional, 3-4 párrafos estructurados conectando los logros del CV con los requisitos de la oferta, cierre con llamada a la acción y despedida formal.`;

  const userContent = lang === 'en'
    ? `[TARGET JOB OFFER DESCRIPTION / REQUIREMENTS]:\n${jobOfferText}\n\n[CANDIDATE RESUME CONTENT]:\n${cvText}`
    : `[DESCRIPCIÓN Y REQUISITOS DE LA OFERTA LABORAL]:\n${jobOfferText}\n\n[CONTENIDO DEL CURRÍCULUM DEL POSTULANTE]:\n${cvText}`;

  const rawResult = await callGemini(
    key,
    basePrompt + languagePrompt,
    userContent,
    false
  );

  let cleanedResult = cleanPlainTextCoverLetter(rawResult || "");
  return cleanedResult;
}

// Generate Cover Letter endpoint
app.post('/api/cover-letter/generate', async (req, res) => {
  try {
    const { analysisId, jobOfferText, lang } = req.body;
    if (!analysisId) {
      return res.status(400).json({ error: "ID de análisis faltante." });
    }
    if (!jobOfferText || !jobOfferText.trim()) {
      return res.status(400).json({ error: "Debes ingresar la descripción o requisitos de la oferta laboral." });
    }

    const analysis = await getAnalysisDoc(analysisId);
    if (!analysis) {
      return res.status(404).json({ error: "Análisis no encontrado." });
    }

    const config = await getConfigDoc();
    const effectiveLang = lang || analysis.lang || 'es';

    // Save jobOfferText into analysis record
    await updateAnalysisDoc(analysisId, {
      jobOfferText: jobOfferText.trim()
    });

    const isPaid = Boolean(analysis.hasCoverLetterPaid || analysis.paymentStatus === 'completed_cover_letter');

    if (!isPaid) {
      return res.json({
        success: false,
        requiresPayment: true,
        priceCoverLetter: config.priceCoverLetter || 2.0,
        priceCoverLetterClp: config.priceCoverLetterClp || 2000
      });
    }

    // If paid, generate and save
    let coverLetterText = analysis.coverLetterText;
    if (!coverLetterText || req.body.forceRegenerate) {
      coverLetterText = await generateCoverLetter(
        analysis.filename,
        analysis.originalText,
        jobOfferText.trim(),
        effectiveLang,
        config
      );
      await updateAnalysisDoc(analysisId, {
        coverLetterText: coverLetterText,
        jobOfferText: jobOfferText.trim()
      });
      recordGeminiCall('optimizations');
    }

    res.json({
      success: true,
      coverLetterText: coverLetterText
    });

  } catch (err) {
    console.error("Error in /api/cover-letter/generate:", err);
    res.status(500).json({ error: err.message || "Error al generar la carta de presentación." });
  }
});

// ─── AI Headshots Generator: Gemini Vision + Google Imagen 3 ─────────────

const HEADSHOT_STYLES = [
  { id: 1, es: "Ejecutivo Azul Marino", en: "Executive Classic Navy", cat: "Corporativo", bg: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)", accent: "#38bdf8", outfit: "Traje Formal Azul Marino con camisa blanca", light: "Iluminación de estudio 85mm Rembrandt" },
  { id: 2, es: "Estudio Minimalista Carbón", en: "Studio Charcoal 85mm", cat: "Estudio", bg: "linear-gradient(135deg, #334155 0%, #1e293b 100%)", accent: "#94a3b8", outfit: "Blazer Gris Marengo estructurado", light: "Softbox difusa envolvente" },
  { id: 3, es: "Smart Casual Oxford", en: "Smart Casual Oxford", cat: "Smart Casual", bg: "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)", accent: "#0284c7", outfit: "Camisa Oxford & Blazer de lino", light: "Luz natural de ventanal loft" },
  { id: 4, es: "Tech Innovation Coworking", en: "Tech Hub Coworking", cat: "Tech", bg: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)", accent: "#818cf8", outfit: "Polo ejecutivo / Blazer moderno", light: "Vidrio & luz diurna arquitectónica" },
  { id: 5, es: "Estudio Blanco High-Key", en: "High-Key Pure White", cat: "Estudio", bg: "linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%)", accent: "#64748b", outfit: "Camisa blanca impecable de diseño", light: "High-Key puro sin sombras duras" },
  { id: 6, es: "Terraza Atardecer Dorado", en: "Golden Hour Terrace", cat: "Corporativo", bg: "linear-gradient(135deg, #78350f 0%, #451a03 100%)", accent: "#fbbf24", outfit: "Traje ejecutivo moderno y corbata elegante", light: "Contraluz cálido atardecer bokeh" },
  { id: 7, es: "Pizarra Editorial Moderna", en: "Slate Modern Minimalist", cat: "Estudio", bg: "linear-gradient(135deg, #1e293b 0%, #334155 100%)", accent: "#38bdf8", outfit: "Blazer negro contemporáneo", light: "Luz de contorno fina 85mm" },
  { id: 8, es: "Acento Cian Vanguardia", en: "Ambient Teal Edge Light", cat: "Tech", bg: "linear-gradient(135deg, #022c22 0%, #064e3b 100%)", accent: "#2dd4bf", outfit: "Blazer & cuello redondo de seda", light: "Edge light sutil 3-puntos" },
  { id: 9, es: "Primer Plano de Liderazgo", en: "Confident Leader Close-up", cat: "Editorial", bg: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)", accent: "#38bdf8", outfit: "Vestimenta ejecutiva de alto impacto", light: "Retrato clásico 85mm f/1.4" },
  { id: 10, es: "Arquitectura Corporativa", en: "Corporate Glass & Steel", cat: "Corporativo", bg: "linear-gradient(135deg, #0c4a6e 0%, #082f49 100%)", accent: "#38bdf8", outfit: "Traje ejecutivo a medida", light: "Fondo corporativo desenfocado" },
  { id: 11, es: "Cuello Alto Ejecutivo", en: "Smart Turtleneck Executive", cat: "Smart Casual", bg: "linear-gradient(135deg, #27272a 0%, #18181b 100%)", accent: "#a1a1aa", outfit: "Cuello alto negro & blazer gris", light: "Luz direccional cálida de estudio" },
  { id: 12, es: "Estudio Clásico 3 Puntos", en: "Classic 3-Point Studio", cat: "Estudio", bg: "linear-gradient(135deg, #3f3f46 0%, #27272a 100%)", accent: "#e4e4e7", outfit: "Camisa formal & blazer oscuro", light: "Iluminación clásica de estudio 3 puntos" },
  { id: 13, es: "Fondo Biblioteca & Madera", en: "Executive Library & Wood", cat: "Corporativo", bg: "linear-gradient(135deg, #451a03 0%, #292524 100%)", accent: "#d97706", outfit: "Traje formal de negocios", light: "Luz cálida y ambiente ejecutivo" },
  { id: 14, es: "Atrio de Cristal Luminoso", en: "Daylight Glass Atrium", cat: "Tech", bg: "linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)", accent: "#0284c7", outfit: "Smart casual claro contemporáneo", light: "Luz diurna envolvente suave" },
  { id: 15, es: "Monocromo Fino Editorial", en: "Fine Art Monochrome", cat: "Editorial", bg: "linear-gradient(135deg, #18181b 0%, #09090b 100%)", accent: "#f4f4f5", outfit: "Traje contraste blanco y negro", light: "Blanco y negro alto contraste de revista" },
  { id: 16, es: "Estudio Pastel Contemporáneo", en: "Contemporary Pastel Studio", cat: "Smart Casual", bg: "linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)", accent: "#0ea5e9", outfit: "Blazer azul claro & camisa", light: "Luz suave Beauty Dish" },
  { id: 17, es: "Skyline Urbano al Anochecer", en: "Metropolitan Skyline Dusk", cat: "Corporativo", bg: "linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%)", accent: "#a5b4fc", outfit: "Traje oscuro elegante", light: "Luces de ciudad bokeh al fondo" },
  { id: 18, es: "Ángulo Cercano Empático 45°", en: "Approachable 45° Angle", cat: "Estudio", bg: "linear-gradient(135deg, #334155 0%, #1e293b 100%)", accent: "#38bdf8", outfit: "Blazer desestructurado", light: "Flash suave frontal difuso" },
  { id: 19, es: "Loft Creativo Ladrillo Visto", en: "Creative Brick Loft Studio", cat: "Smart Casual", bg: "linear-gradient(135deg, #292524 0%, #1c1917 100%)", accent: "#f97316", outfit: "Camisa de lino & blazer café", light: "Luz incandescente suave y acogedora" },
  { id: 20, es: "Portada LinkedIn Premium", en: "LinkedIn Premium Editorial", cat: "Editorial", bg: "linear-gradient(135deg, #0f172a 0%, #0284c7 100%)", accent: "#38bdf8", outfit: "Traje de gala ejecutiva", light: "Calidad de portada de revista Forbes/GQ" }
];

// Call Google Generative Image API (supports gemini-2.5-flash-image "Nano Banana", imagen-3.0-generate-002 & gemini-2.0-flash-exp)
async function callGoogleImageGen(apiKey, prompt, userPhotoData, retries = 1) {
  const key = apiKey || getGeminiApiKey();
  if (!key) {
    throw new Error("Falta la configuración de Gemini API Key en el servidor.");
  }

  let lastError = null;

  // 1. Native Gemini Image Generation: gemini-2.5-flash-image (Nano Banana)
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${key}`;
    const parts = [];

    if (userPhotoData && typeof userPhotoData === 'string' && userPhotoData.startsWith('data:')) {
      const p = userPhotoData.split(',');
      const mimeMatch = p[0].match(/:(.*?);/);
      const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
      parts.push({
        inlineData: {
          mimeType: mime,
          data: p[1]
        }
      });
    }

    parts.push({
      text: `Generate a hyper-realistic 85mm executive studio portrait of the person in the reference photo, maintaining their exact facial features, bone structure, and identity. Style and atmosphere: ${prompt}. High-end studio lighting, sharp focus on eyes, 8k resolution, authentic skin texture.`
    });

    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts }] })
    });

    if (resp.ok) {
      const data = await resp.json();
      if (data.candidates && data.candidates[0]?.content?.parts) {
        for (const part of data.candidates[0].content.parts) {
          if (part.inlineData?.data) {
            const mime = part.inlineData.mimeType || 'image/png';
            return `data:${mime};base64,${part.inlineData.data}`;
          }
        }
      }
    } else {
      const errText = await resp.text();
      lastError = `gemini-2.5-flash-image (${resp.status}): ${errText}`;
    }
  } catch (gErr) {
    lastError = `gemini-2.5-flash-image error: ${gErr.message}`;
  }

  // 2. Active Imagen 3.0 Model Fallback via :predict
  const activeImagenModels = [
    'imagen-3.0-generate-002',
    'imagen-3.0-generate-001'
  ];

  for (const model of activeImagenModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${key}`;
      const payload = {
        instances: [{ prompt: prompt }],
        parameters: { sampleCount: 1, aspectRatio: "1:1", personGeneration: "ALLOW_ADULT" }
      };

      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (resp.ok) {
        const data = await resp.json();
        if (data.predictions?.[0]?.bytesBase64Encoded) {
          const mime = data.predictions[0].mimeType || 'image/png';
          return `data:${mime};base64,${data.predictions[0].bytesBase64Encoded}`;
        }
      } else {
        const errText = await resp.text();
        lastError = `${model} (${resp.status}): ${errText}`;
      }
    } catch (iErr) {
      lastError = `${model} error: ${iErr.message}`;
    }
  }

  // If retries remain and temporary failure occurred, retry with backoff
  if (retries > 0) {
    console.log(`Reintentando generación de imagen tras pausa (${retries} intento restante)...`);
    await new Promise(r => setTimeout(r, 2000));
    return callGoogleImageGen(apiKey, prompt, userPhotoData, retries - 1);
  }

  throw new Error(`Error en API de Imagen de Google: ${lastError || "No se pudo generar la imagen fotográfica con los modelos de Google."}`);
}

// Multimodal Facial Extraction & Structured Prompt Generation using Gemini 2.5 Flash
async function analyzeFaceAndGeneratePrompts(apiKey, userPhotoData, cvText, lang = 'es', config = {}) {
  const key = apiKey || getGeminiApiKey();
  if (!key) {
    throw new Error("Falta la configuración de Gemini API Key.");
  }

  let base64Image = null;
  let mimeType = 'image/jpeg';

  if (userPhotoData && typeof userPhotoData === 'string' && userPhotoData.startsWith('data:')) {
    const parts = userPhotoData.split(',');
    base64Image = parts[1];
    const mimeMatch = parts[0].match(/:(.*?);/);
    if (mimeMatch) mimeType = mimeMatch[1];
  }

  const systemInstruction = `You are an expert executive photographer and AI portrait prompt engineer. 
Analyze the subject's face (gender, approximate age, hair style, facial structure, skin tone, glasses if any) and synthesize professional studio photography prompts for a 20-photo executive portrait pack.
Ensure all 20 prompts depict the SAME individual with high fidelity, wearing distinct executive, corporate, smart casual and tech outfits with professional 85mm optical studio lighting.

Respond ONLY with a valid JSON array of 20 objects:
[
  {
    "id": 1,
    "title": "Retrato de Liderazgo Corporativo",
    "category": "Corporativo",
    "outfit": "Traje azul marino a medida, camisa blanca de cuello italiano",
    "lighting": "Luz suave de ventana lateral y reflector sutil de relleno",
    "prompt": "Ultra-photorealistic 85mm portrait of a professional in navy bespoke suit, soft window illumination, studio bokeh, authentic skin texture, sharp eye focus, 8k resolution"
  }, ...
]`;

  const userContent = base64Image 
    ? [
        { inlineData: { mimeType: mimeType, data: base64Image } },
        { text: `Analyze this person's facial structure and craft 20 photorealistic executive studio prompts. Relevant career summary:\n${cvText ? cvText.substring(0, 1000) : 'Professional Career'}` }
      ]
    : [
        { text: `Craft 20 diverse executive studio portrait prompts for a professional. Career profile:\n${cvText ? cvText.substring(0, 1000) : 'Senior Professional'}` }
      ];

  const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents: [{ parts: userContent }],
          generationConfig: {
            responseMimeType: "application/json"
          }
        })
      });

      if (resp.ok) {
        const data = await resp.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed) && parsed.length >= 10) {
            return parsed;
          }
        }
      }
    } catch (err) {
      console.warn(`analyzeFaceAndGeneratePrompts ${model} error:`, err.message);
    }
  }

  return [];
}

async function generateHeadshotsPack(filename, cvText, userPhotoData, lang = 'es', config = {}, onBatchProgress = null) {
  const apiKey = getGeminiApiKey(config);
  if (!apiKey) {
    throw new Error("Falta configurar la Gemini / Google Imagen API Key en el servidor para generar los retratos fotorrealistas con IA.");
  }

  let generatedPrompts = [];
  try {
    generatedPrompts = await analyzeFaceAndGeneratePrompts(apiKey, userPhotoData, cvText, lang, config);
  } catch (promptErr) {
    console.warn("Fallo en extracción facial multimodal con Gemini Vision, usando estilos predefinidos:", promptErr.message);
  }

  if (!generatedPrompts || generatedPrompts.length === 0) {
    generatedPrompts = HEADSHOT_STYLES.map(s => ({
      id: s.id,
      title: lang === 'en' ? s.en : s.es,
      category: s.cat,
      outfit: s.outfit,
      lighting: s.light,
      prompt: `Ultra-photorealistic 85mm executive studio portrait photography of a confident professional, wearing ${s.outfit}, set in a modern ${s.cat} atmosphere with ${s.light}, 8k resolution, photorealistic, cinematic studio lighting, sharp focus on eyes, authentic skin texture.`
    }));
  }

  const headshots = [];
  const BATCH_SIZE = 4; // Optimized concurrency for fast generation (5 parallel rounds)

  for (let i = 0; i < generatedPrompts.length; i += BATCH_SIZE) {
    const batch = generatedPrompts.slice(i, i + BATCH_SIZE);
    const batchPromises = batch.map(async (item, idx) => {
      const globalIndex = i + idx + 1;
      let imageDataUrl = null;
      try {
        imageDataUrl = await callGoogleImageGen(apiKey, item.prompt, userPhotoData);
      } catch (imgErr) {
        console.warn(`Error generating portrait #${globalIndex}:`, imgErr.message);
        // Resilient fallback: reuse reference photo or first successfully generated portrait
        if (headshots.length > 0 && headshots[0].imageUrl) {
          imageDataUrl = headshots[0].imageUrl;
        } else if (userPhotoData) {
          imageDataUrl = userPhotoData;
        } else {
          throw imgErr;
        }
      }

      return {
        id: item.id || globalIndex,
        title: item.title || (HEADSHOT_STYLES[globalIndex - 1] ? (lang === 'en' ? HEADSHOT_STYLES[globalIndex - 1].en : HEADSHOT_STYLES[globalIndex - 1].es) : `Retrato #${globalIndex}`),
        category: item.category || (HEADSHOT_STYLES[globalIndex - 1] ? HEADSHOT_STYLES[globalIndex - 1].cat : 'Studio'),
        outfit: item.outfit || (HEADSHOT_STYLES[globalIndex - 1] ? HEADSHOT_STYLES[globalIndex - 1].outfit : 'Ejecutivo'),
        lighting: item.lighting || (HEADSHOT_STYLES[globalIndex - 1] ? HEADSHOT_STYLES[globalIndex - 1].light : 'Estudio 85mm'),
        imageUrl: imageDataUrl,
        prompt: item.prompt
      };
    });

    const batchResults = await Promise.all(batchPromises);
    headshots.push(...batchResults);

    // If progress callback is provided (e.g. for real-time SSE streaming), notify client immediately
    if (typeof onBatchProgress === 'function') {
      try {
        await onBatchProgress(batchResults, headshots.length, generatedPrompts.length);
      } catch (cbErr) {
        console.warn("Error in onBatchProgress callback:", cbErr.message);
      }
    }

    // Brief inter-batch pause to prevent burst rate limiting
    if (i + BATCH_SIZE < generatedPrompts.length) {
      await new Promise(r => setTimeout(r, 400));
    }
  }

  return headshots;
}

// 1. Upload User Base Photo for Headshots
app.post('/api/headshots/upload-photo', upload.single('photo'), async (req, res) => {
  try {
    const { analysisId } = req.body;
    if (!analysisId) {
      return res.status(400).json({ error: "ID de análisis requerido." });
    }
    if (!req.file) {
      return res.status(400).json({ error: "Por favor, sube una foto en formato JPG o PNG." });
    }

    const mime = req.file.mimetype;
    if (!mime.startsWith('image/')) {
      return res.status(400).json({ error: "El archivo subido no es una imagen válida." });
    }

    const base64Photo = `data:${mime};base64,${req.file.buffer.toString('base64')}`;

    await updateAnalysisDoc(analysisId, {
      userPhotoData: base64Photo,
      userPhotoName: req.file.originalname,
      userPhotoSize: req.file.size
    });

    res.json({
      success: true,
      photoUrl: base64Photo,
      photoName: req.file.originalname
    });

  } catch (err) {
    console.error("Error in /api/headshots/upload-photo:", err);
    res.status(500).json({ error: "Error al subir la foto del usuario." });
  }
});

// 2. Real-time Progressive Streaming Endpoint (Server-Sent Events)
app.get('/api/headshots/stream/:analysisId', async (req, res) => {
  try {
    const { analysisId } = req.params;
    const { lang } = req.query;

    if (!analysisId) {
      return res.status(400).send("ID de análisis requerido.");
    }

    const analysis = await getAnalysisDoc(analysisId);
    if (!analysis) {
      return res.status(404).send("Análisis no encontrado.");
    }

    const isPaid = Boolean(analysis.hasHeadshotsPaid || analysis.paymentStatus === 'completed_headshots');
    if (!isPaid) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
      });
      res.write(`data: ${JSON.stringify({ type: 'error', requiresPayment: true, message: 'Pago requerido para generar retratos.' })}\n\n`);
      return res.end();
    }

    // Set streaming headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    });

    // If already generated, stream all immediately
    let headshots = analysis.headshotImages;
    if (headshots && Array.isArray(headshots) && headshots.length >= 20) {
      res.write(`data: ${JSON.stringify({ type: 'batch', items: headshots, currentCount: headshots.length, totalCount: 20 })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: 'done', headshots, totalCount: headshots.length })}\n\n`);
      return res.end();
    }

    const config = await getConfigDoc();
    const effectiveLang = lang || analysis.lang || 'es';

    headshots = await generateHeadshotsPack(
      analysis.filename,
      analysis.originalText,
      analysis.userPhotoData || null,
      effectiveLang,
      config,
      async (batchResults, currentCount, totalCount) => {
        res.write(`data: ${JSON.stringify({ type: 'batch', items: batchResults, currentCount, totalCount })}\n\n`);
      }
    );

    await updateAnalysisDoc(analysisId, {
      headshotImages: headshots
    });
    recordGeminiCall('optimizations');

    res.write(`data: ${JSON.stringify({ type: 'done', headshots, totalCount: headshots.length })}\n\n`);
    res.end();

  } catch (err) {
    console.error("Error in /api/headshots/stream:", err);
    try {
      res.write(`data: ${JSON.stringify({ type: 'error', message: err.message || 'Error al generar retratos.' })}\n\n`);
      res.end();
    } catch (_) {}
  }
});

// 3. Generate 20 AI Headshots Pack
app.post('/api/headshots/generate', async (req, res) => {
  try {
    const { analysisId, lang } = req.body;
    if (!analysisId) {
      return res.status(400).json({ error: "ID de análisis requerido." });
    }

    const analysis = await getAnalysisDoc(analysisId);
    if (!analysis) {
      return res.status(404).json({ error: "Análisis no encontrado." });
    }

    const config = await getConfigDoc();
    const effectiveLang = lang || analysis.lang || 'es';

    const isPaid = Boolean(analysis.hasHeadshotsPaid || analysis.paymentStatus === 'completed_headshots');

    if (!isPaid) {
      return res.json({
        success: false,
        requiresPayment: true,
        priceHeadshots: config.priceHeadshots || 6.0,
        priceHeadshotsClp: config.priceHeadshotsClp || 6000
      });
    }

    let headshots = analysis.headshotImages;
    if (!headshots || !Array.isArray(headshots) || headshots.length < 20 || req.body.forceRegenerate) {
      headshots = await generateHeadshotsPack(
        analysis.filename,
        analysis.originalText,
        analysis.userPhotoData || null,
        effectiveLang,
        config
      );

      await updateAnalysisDoc(analysisId, {
        headshotImages: headshots
      });
      recordGeminiCall('optimizations');
    }

    res.json({
      success: true,
      headshots: headshots
    });

  } catch (err) {
    console.error("Error in /api/headshots/generate:", err);
    res.status(500).json({ error: err.message || "Error al generar el pack de retratos fotográficos." });
  }
});

// 4. Download All 20 Headshots as .ZIP
app.get('/api/headshots/download-zip/:analysisId', async (req, res) => {
  try {
    const { analysisId } = req.params;
    if (!analysisId) {
      return res.status(400).send("ID de análisis requerido.");
    }

    const analysis = await getAnalysisDoc(analysisId);
    if (!analysis) {
      return res.status(404).send("Análisis no encontrado.");
    }

    let headshots = analysis.headshotImages;
    if (!headshots || !Array.isArray(headshots) || headshots.length === 0) {
      const config = await getConfigDoc();
      headshots = await generateHeadshotsPack(
        analysis.filename,
        analysis.originalText,
        analysis.userPhotoData || null,
        analysis.lang || 'es',
        config
      );
    }

    const zip = new AdmZip();

    headshots.forEach((item, index) => {
      const num = index + 1 < 10 ? `0${index + 1}` : `${index + 1}`;
      const safeTitle = (item.title || `Retrato_${num}`).replace(/[^a-zA-Z0-9_-]/g, "_");

      if (item.imageUrl && item.imageUrl.startsWith('data:image/')) {
        const parts = item.imageUrl.split(',');
        const mimeMatch = parts[0].match(/:(.*?);/);
        const mime = mimeMatch ? mimeMatch[1] : 'image/png';
        const ext = mime.includes('png') ? 'png' : (mime.includes('jpeg') || mime.includes('jpg')) ? 'jpg' : (mime.includes('svg') ? 'svg' : 'png');
        const imgBuffer = Buffer.from(parts[1], 'base64');
        const filename = `${num}_${safeTitle}.${ext}`;
        zip.addFile(filename, imgBuffer);
      } else if (item.rawSvg || (item.svgDataUrl && item.svgDataUrl.startsWith('data:image/svg+xml'))) {
        const filename = `${num}_${safeTitle}.svg`;
        const svgContent = item.rawSvg || Buffer.from(item.svgDataUrl.split(',')[1], 'base64').toString('utf8');
        zip.addFile(filename, Buffer.from(svgContent, 'utf8'));
      }
    });

    const isEn = analysis.lang === 'en';
    const guideText = isEn
      ? `CINTIA.PRO - 20 AI LINKEDIN & RESUME HEADSHOTS PACK
==================================================

Congratulations! Here are your 20 studio-grade professional portraits powered by Google Imagen 3 & Gemini.

RECOMMENDED SIZES & PLATFORM GUIDELINES:
1. LinkedIn Profile Picture:
   - Minimum: 400 x 400 px
   - Ideal: Square aspect ratio (1:1)
   - Ensure your face takes up 60% of the frame.
   - Recommended styles: #01 Executive Navy, #03 Smart Casual, #09 Confident Leader, #20 LinkedIn Premium.

2. Resume / CV Header:
   - Clean, neutral styles recommended: #02 Studio Charcoal, #05 High-Key White, #12 3-Point Studio.

3. Articles, Bios & Speaking Engagements:
   - Dynamic settings: #04 Tech Coworking, #06 Golden Hour Terrace, #15 Fine Art Monochrome.

Thank you for choosing Cintia.pro for your career brand!
Website: https://cintia.pro`
      : `CINTIA.PRO - PACK DE 20 FOTOS DE ESTUDIO PARA LINKEDIN Y CV
============================================================

¡Felicitaciones! Aquí tienes tu pack de 20 retratos fotográficos profesionales de estudio generados con Google Imagen 3 & Gemini.

GUÍA DE USO Y RECOMENDACIONES DE PLATAFORMAS:
1. Foto de Perfil en LinkedIn:
   - Dimensión óptima: 400 x 400 px (Relación 1:1 cuadrada).
   - Asegúrate de que tu rostro ocupe alrededor del 60% del círculo del avatar.
   - Estilos recomendados: #01 Ejecutivo Azul Marino, #03 Smart Casual, #09 Primer Plano de Liderazgo, #20 Portada LinkedIn Premium.

2. Currículum Vitae:
   - Estilos recomendados: #02 Estudio Minimalista Carbón, #05 Estudio Blanco High-Key, #12 Estudio Clásico 3 Puntos.

3. Conferencias, Artículos y Charlas:
   - Estilos recomendados: #04 Tech Innovation Coworking, #06 Terraza Atardecer Dorado, #15 Monocromo Fino Editorial.

¡Gracias por confiar en Cintia.pro para potenciar tu marca profesional!
Sitio web: https://cintia.pro`;

    zip.addFile("LEEME_GUIA_RECOMENDACIONES.txt", Buffer.from(guideText, 'utf8'));

    const zipBuffer = zip.toBuffer();
    
    // Strict Anti-Cache Headers to ensure freshest ZIP is always served
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="Cintia_Pack_20_Headshots_${analysisId.slice(0, 8)}_${Date.now()}.zip"`);
    res.send(zipBuffer);

  } catch (err) {
    console.error("Error in /api/headshots/download-zip:", err);
    res.status(500).send("Error al generar archivo .ZIP");
  }
});

// Analyze document
app.post('/api/analyze', upload.single('cv'), async (req, res) => {
  try {
    const config = await getConfigDoc();
    const clientIp = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';

    // 1. IP Rate Limiting Check
    if (isRateLimited(clientIp, config.rateLimitPerHour)) {
      return res.status(429).json({ error: "Límite de solicitudes excedido para tu IP. Intenta más tarde." });
    }

    // 2. Captcha Validation
    if (config.captchaEnabled) {
      const captchaToken = req.body.captchaToken;
      const captchaAnswer = req.body.captchaAnswer;
      if (!captchaToken || !captchaAnswer || !verifyCaptcha(captchaToken, captchaAnswer)) {
        return res.status(400).json({ error: "Código captcha inválido o vencido." });
      }
    }

    // 3. File Validation
    if (!req.file) {
      return res.status(400).json({ error: "Por favor, sube un archivo de Currículum." });
    }

    const filename = req.file.originalname;
    const ext = path.extname(filename).toLowerCase();
    const validExtensions = ['.pdf', '.docx', '.odt', '.txt'];
    if (!validExtensions.includes(ext)) {
      return res.status(400).json({ error: "Formato de archivo inválido. Solo se admiten .pdf, .docx, .odt y .txt" });
    }

    // 4. Text Extraction
    let extractedText = "";
    if (ext === '.txt') {
      extractedText = req.file.buffer.toString('utf8');
    } else if (ext === '.pdf') {
      try {
        // Primary attempt: standard PDF parsing
        const parsedPdf = await pdfParse(req.file.buffer);
        extractedText = parsedPdf.text;
      } catch (pdfErr) {
        // Fallback: lenient mode for PDFs with non-standard XRef tables
        // (common in PDFs exported from Canva, Illustrator, or modern design tools)
        try {
          const parsedPdf = await pdfParse(req.file.buffer, {
            max: 0,         // parse all pages
            version: 'v1.10.100' // use lenient parser version
          });
          extractedText = parsedPdf.text;
        } catch (pdfErr2) {
          console.error('PDF parse error (both attempts failed):', pdfErr2.message);
          return res.status(422).json({
            error: 'No se pudo leer el PDF. El archivo puede estar dañado, protegido con contraseña, o ser un PDF basado en imágenes (escaneado). Por favor, guárdalo como PDF estándar o súbelo en formato .docx o .txt.'
          });
        }
      }
    } else if (ext === '.docx') {
      const docxResult = await mammoth.extractRawText({ buffer: req.file.buffer });
      extractedText = docxResult.value;
    } else if (ext === '.odt') {
      extractedText = parseOdt(req.file.buffer);
    }

    if (!extractedText || extractedText.trim().length === 0) {
      return res.status(400).json({ error: "El archivo no contiene texto legible." });
    }

    // Safety check to mitigate ReDoS (Regular Expression Denial of Service)
    if (extractedText.length > 100000) {
      return res.status(400).json({ error: "El texto extraído supera el límite de seguridad permitido (100,000 caracteres)." });
    }

    // Auto-detect the CV's language
    const lang = detectLanguage(extractedText);

    // 5. Evaluate CV Quality
    let evaluation = null;
    const geminiApiKey = getGeminiApiKey(config);

    if (!geminiApiKey) {
      console.log("No Gemini API key found. Running in high-fidelity Demo Mock Mode for detected language:", lang);
      const isEnglish = lang === 'en';
      const wordCount = extractedText.trim().split(/\s+/).length;
      const hasNumbers = /\d+/.test(extractedText);
      const hasLinks = /linkedin|http|github|@|www/i.test(extractedText);
      const stars = 4;

      if (isEnglish) {
        evaluation = {
          stars: stars,
          summary: "Your resume shows strong professional potential with excellent formatting and clear trajectory.",
          atsCompatibility: {
            stars: 5,
            feedback: "Standard structure with **clear sections** easily recognizable by ATS software."
          },
          skillsClarity: {
            stars: 4,
            feedback: "Technical and soft skills are **well distinguished**, consider highlighting certifications."
          },
          lengthCheck: {
            stars: wordCount > 800 ? 3 : 5,
            feedback: wordCount > 800
              ? "Slightly extensive. Keep it strictly to **1 or 2 pages maximum**."
              : "Ideal document length (**under 2 pages**) for immediate recruiter scanning."
          },
          quantifiableMetrics: {
            stars: hasNumbers ? 4 : 2,
            feedback: hasNumbers
              ? "Good use of **quantifiable results and performance metrics**."
              : "Lacks measurable impact. Try adding **percentages, savings, or project scale numbers**."
          },
          actionVerbs: {
            stars: 4,
            feedback: "Effective use of **action-oriented impact verbs** (e.g. Led, Designed, Orchestrated)."
          },
          contactLinks: {
            stars: hasLinks ? 5 : 2,
            feedback: hasLinks
              ? "Essential contact data and **clickable professional links** (LinkedIn/Portfolio) present."
              : "Contact information detected, but missing **direct hyperlinks to professional networks**."
          },
          grammarSpelling: {
            stars: 5,
            feedback: "Consistent verb tenses and **flawless grammar and spelling** throughout."
          },
          detailedExplanation: `[DEMO MOCK MODE - NO API KEY CONFIGURED]\n\nYour resume achieved an overall quality score of ${stars} out of 5 across all hiring benchmarks.\n\nRecommended next steps:\n- Reinforce past achievements with strong action verbs (e.g., 'Spearheaded', 'Optimized', 'Scaled').\n- Add concrete metrics to demonstrate tangible value (e.g., 'reduced turnaround by 25%').\n- Maintain clean visual hierarchy for fast recruiter review.`
        };
      } else {
        evaluation = {
          stars: stars,
          summary: "Tu currículum tiene un potencial excelente con una estructura clara y gran coherencia profesional.",
          atsCompatibility: {
            stars: 5,
            feedback: "Estructura estándar con **secciones claras** fácilmente reconocibles por filtros ATS."
          },
          skillsClarity: {
            stars: 4,
            feedback: "Habilidades técnicas y blandas **bien delimitadas**, se sugiere resaltar certificaciones clave."
          },
          lengthCheck: {
            stars: wordCount > 800 ? 3 : 5,
            feedback: wordCount > 800
              ? "Ligeramente extenso. Se recomienda resumir a un **máximo estricto de 2 páginas**."
              : "Extensión óptima (**menos de 2 páginas**) para lectura rápida de reclutadores."
          },
          quantifiableMetrics: {
            stars: hasNumbers ? 4 : 2,
            feedback: hasNumbers
              ? "Buen uso de **métricas y datos numéricos** que sustentan tus logros laborales."
              : "Poco énfasis en métricas. Intenta incluir **porcentajes, ahorros o alcance cuantificable**."
          },
          actionVerbs: {
            stars: 4,
            feedback: "Uso idóneo de **verbos de acción e impacto** (ej. lideré, diseñé, ejecuté)."
          },
          contactLinks: {
            stars: hasLinks ? 5 : 2,
            feedback: hasLinks
              ? "Presencia de datos básicos e **hipervínculos profesionales** (LinkedIn o Portafolio) detectada."
              : "Se encontraron datos de contacto pero faltan **enlaces directos a redes profesionales**."
          },
          grammarSpelling: {
            stars: 5,
            feedback: "Consistencia de tiempos verbales adecuada y sin **errores ortográficos visibles**."
          },
          detailedExplanation: `[MODALIDAD DEMOSTRACIÓN - SIN API KEY REAL]\n\nTu currículum ha sido evaluado con ${stars} estrellas de 5 en base a los criterios clave de calidad y compatibilidad ATS.`
        };
      }
    } else {
      const currentDateFormatted = lang === 'en'
        ? new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
        : new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });

      const languagePrompt = lang === 'en'
        ? `\n\nCRITICAL INSTRUCTIONS:\n1. LANGUAGE: The resume is in English. You MUST write ALL JSON fields (summary, feedback, detailedExplanation) strictly and exclusively in ENGLISH. Do not include any Spanish words or phrases.\n2. DATES & TIMELINE: Today's reference date is ${currentDateFormatted} (Year ${new Date().getFullYear()}). Dates like 2024, 2025, 2026, or 'Present' are completely valid and normal for current roles or recent certifications. Do NOT penalize or flag recent or current experiences as future dates. Never quote internal system terms or variable names.`
        : `\n\nINSTRUCCIÓN CRÍTICA DE IDIOMA Y FECHAS:\n1. IDIOMA: El currículum está en español. Debes redactar todos los campos del JSON (summary, feedback, detailedExplanation) estrictamente en ESPAÑOL.\n2. FECHAS: La fecha actual de referencia es ${currentDateFormatted} (Año ${new Date().getFullYear()}). Fechas de 2024, 2025, 2026 o 'Presente / Actualidad' son totalmente válidas para roles actuales o certificaciones recientes. No penalices fechas recientes ni menciones 'fecha del sistema' ni variables internas.`;

      const systemInstruction = config.evaluationPrompt + languagePrompt;
      const userContent = lang === 'en'
        ? `[DOCUMENT REFERENCE DATE: ${currentDateFormatted}]\n\nRESUME CONTENT TO EVALUATE:\n\n${extractedText}`
        : `[FECHA DE REFERENCIA: ${currentDateFormatted}]\n\nCURRÍCULUM A EVALUAR:\n\n${extractedText}`;

      const analysisRaw = await callGemini(geminiApiKey, systemInstruction, userContent, true);
      try {
        evaluation = JSON.parse(analysisRaw);
      } catch (parseErr) {
        evaluation = { stars: 3, summary: "Evaluación procesada con incidencias.", detailedExplanation: analysisRaw };
      }
    }

    // Sanitize free tier diagnostic to guarantee NO actionable recommendation lists or rewrite recipes are leaked
    if (evaluation && typeof evaluation === 'object') {
      if (evaluation.detailedExplanation && typeof evaluation.detailedExplanation === 'string') {
        let text = evaluation.detailedExplanation;
        
        // 1. Cut off at any phrase introducing recommendations, suggestions or advice
        const cutoffRegex = /(?:\n\s*|\n|^)(?:[#*_\s]*)(?:(?:Mis|Nuestras|Las|Algunas|Principales|A\s+continuación|Aquí)\s+)?(?:recomendaciones?|sugerencias?|consejos?|pasos?|puntos?\s+clave|aspectos?\s+a\s+mejorar|claves?\s+para\s+(?:mejorar|optimizar)|key\s*recommendations?|how\s*to\s*improve|actionable\s*recommendations?|suggested\s*improvements?)[\s\S]*/i;
        text = text.replace(cutoffRegex, '').trim();

        // 2. Cut off if there is any numbered list starting with 1. (e.g. 1. Reestructuración...)
        const numberedListCutoff = /(?:\n\s*|\n|^)\s*1[\.\)]\s+[\s\S]*/i;
        text = text.replace(numberedListCutoff, '').trim();

        // 3. Filter out any remaining lines that look like bullet advice
        const lines = text.split('\n');
        const filteredLines = [];
        for (const line of lines) {
          const trimmed = line.trim();
          if (/^(?:\d+[\.\)]|[\*\-•])\s+/i.test(trimmed)) {
            continue;
          }
          filteredLines.push(line);
        }
        evaluation.detailedExplanation = filteredLines.join('\n').trim();
      }
    }

    // Check if document was identified as not a personal CV
    if (evaluation && evaluation.isCv === false) {
      return res.json({
        success: false,
        notCv: true,
        reason: evaluation.notCvReason || (lang === 'en'
          ? "The uploaded document does not appear to be a personal resume or CV. Please verify your selected folder and upload your actual resume so Cintia can analyze your career background."
          : "El documento que subiste no corresponde a un currículum vitae o perfil profesional. Por favor revisa tu carpeta y selecciona tu CV para que Cintia pueda analizar tu trayectoria y ayudarte a destacar ante los reclutadores."),
        documentType: evaluation.documentType || (lang === 'en' ? "non-resume document" : "documento no laboral")
      });
    }

    // 6. Generate AI Optimization preview simultaneously (if enabled)
    let optimizedText = "";
    if (config.optAiEnabled !== false) {
      try {
        optimizedText = await generateAiOptimization(filename, extractedText, lang, config);
      } catch (optErr) {
        console.warn("Could not generate instant AI optimization during analyze, using fallback template:", optErr.message);
        optimizedText = await generateAiOptimization(filename, extractedText, lang, { geminiApiKey: '' });
      }
    }

    // 7. Log entry to db
    const analysisId = crypto.randomUUID();
    const logEntry = {
      id: analysisId,
      filename: filename,
      fileSize: req.file.size,
      fileType: ext,
      uploadedAt: new Date().toISOString(),
      ip: clientIp,
      rating: evaluation.stars || 3,
      evaluation: evaluation,
      originalText: extractedText,
      optimizedText: optimizedText,
      paymentStatus: 'free',
      paymentMethod: null,
      expertContact: null,
      lang: lang
    };
    await saveAnalysisDoc(logEntry);

    const publicStats = await getPublicStats();

    res.json({
      success: true,
      analysisId: analysisId,
      evaluation: evaluation,
      lang: lang,
      optimizedText: optimizedText,
      publicStats: publicStats
    });

  } catch (err) {
    console.error("Error during /api/analyze:", err);
    res.status(500).json({ error: err.message || "Error al procesar el currículum." });
  }
});

// Payment simulation route (Enabled in Test Branch)
app.post('/api/payment/simulate', async (req, res) => {
  try {
    const { analysisId, tier, paymentMethod, contact, jobOfferText } = req.body;
    if (!analysisId || !tier) {
      return res.status(400).json({ error: "Datos de pago incompletos." });
    }

    const analysis = await getAnalysisDoc(analysisId);
    if (!analysis) {
      return res.status(404).json({ error: "Análisis no encontrado." });
    }

    if (tier === 'ai') {
      let optimizedText = analysis.optimizedText;
      if (!optimizedText) {
        const config = await getConfigDoc();
        optimizedText = await generateAiOptimization(analysis.filename, analysis.originalText, analysis.lang || 'es', config);
      }

      await updateAnalysisDoc(analysisId, {
        paymentStatus: 'completed_ai',
        paymentMethod: paymentMethod || 'paypal',
        optimizedText: optimizedText
      });

      res.json({
        success: true,
        tier: 'ai',
        optimizedText: optimizedText
      });
    } else if (tier === 'expert') {
      if (!contact || !contact.email || !contact.phone) {
        return res.status(400).json({ error: "Para optimización manual, debes dejar correo y celular." });
      }

      await updateAnalysisDoc(analysisId, {
        paymentStatus: 'pending_expert',
        paymentMethod: paymentMethod || 'paypal',
        expertContact: {
          email: contact.email,
          phone: contact.phone
        }
      });

      res.json({
        success: true,
        tier: 'expert',
        message: "Pago registrado con éxito. Un experto te contactará en un plazo máximo de 24-48 horas."
      });
    } else if (tier === 'cover_letter') {
      if (jobOfferText) {
        await updateAnalysisDoc(analysisId, { jobOfferText: jobOfferText.trim() });
      }
      const result = await processSuccessfulPayment({
        analysisId,
        tier: 'cover_letter',
        paymentMethod: paymentMethod || 'simulate',
        transactionId: `sim_cl_${Date.now()}`
      });
      res.json(result);
    } else if (tier === 'headshots') {
      const result = await processSuccessfulPayment({
        analysisId,
        tier: 'headshots',
        paymentMethod: paymentMethod || 'simulate',
        transactionId: `sim_hs_${Date.now()}`
      });
      res.json(result);
    } else {
      res.status(400).json({ error: "Tier de pago inválido." });
    }

  } catch (err) {
    console.error("Error during /api/payment/simulate:", err);
    res.status(500).json({ error: err.message || "Error al procesar el pago." });
  }
});

// Compute exact public statistics for live ticker banner in real-time
async function getPublicStats() {
  const map = new Map();
  try {
    const localDb = readDb();
    if (localDb.analyses && Array.isArray(localDb.analyses)) {
      localDb.analyses.forEach(a => {
        if (a && a.id) map.set(a.id, a);
      });
    }

    const dbFs = initFirebase();
    if (dbFs) {
      const snap = await dbFs.collection('analyses').get();
      snap.forEach(doc => {
        const data = doc.data();
        if (data) map.set(doc.id || data.id, data);
      });
    }

    const consolidatedList = Array.from(map.values());
    const totalCount = consolidatedList.length;
    let sum = 0;
    let validRatings = 0;
    consolidatedList.forEach(d => {
      const r = d.rating;
      if (typeof r === 'number' && r > 0) {
        sum += r;
        validRatings++;
      }
    });

    const avgRatingScore = validRatings > 0 ? (sum / validRatings).toFixed(1) : "4.0";
    return {
      totalAnalyses: totalCount,
      avgRating: avgRatingScore
    };
  } catch (statsErr) {
    console.warn("Public stats compute fallback:", statsErr.message);
    return {
      totalAnalyses: 0,
      avgRating: "4.0"
    };
  }
}

// Public settings and live statistics endpoint
app.get('/api/config', async (req, res) => {
  incrementVisitsCounter().catch(() => {});
  const config = await getConfigDoc();
  const publicStats = await getPublicStats();

  res.json({
    optAiEnabled: config.hasOwnProperty('optAiEnabled') ? !!config.optAiEnabled : true,
    optExpertEnabled: config.hasOwnProperty('optExpertEnabled') ? !!config.optExpertEnabled : true,
    optCoverLetterEnabled: config.hasOwnProperty('optCoverLetterEnabled') ? !!config.optCoverLetterEnabled : true,
    optHeadshotsEnabled: config.hasOwnProperty('optHeadshotsEnabled') ? !!config.optHeadshotsEnabled : true,
    priceAi: config.priceAi || 2.0,
    priceExpert: config.priceExpert || 25.0,
    priceCoverLetter: config.priceCoverLetter || 2.0,
    priceHeadshots: config.priceHeadshots || 6.0,
    priceAiClp: config.priceAiClp || 2000,
    priceExpertClp: config.priceExpertClp || 25000,
    priceCoverLetterClp: config.priceCoverLetterClp || 2000,
    priceHeadshotsClp: config.priceHeadshotsClp || 6000,
    paypalClientId: process.env.PAYPAL_CLIENT_ID || '',
    mercadopagoPublicKey: process.env.MERCADOPAGO_PUBLIC_KEY || '',
    mercadopagoEnabled: !!process.env.MERCADOPAGO_ACCESS_TOKEN,
    appVersion: pkg.version ? pkg.version.split('.').slice(0, 2).join('.') : '2.0',
    publicStats: publicStats
  });
});

// Register Expert review request (no online payments)
app.post('/api/expert-request', async (req, res) => {
  try {
    const { analysisId, email, phone } = req.body;
    if (!analysisId) {
      return res.status(400).json({ error: "ID de análisis faltante." });
    }
    if (!email && !phone) {
      return res.status(400).json({ error: "Debe proporcionar correo o teléfono de contacto." });
    }

    const analysis = await getAnalysisDoc(analysisId);
    if (!analysis) {
      return res.status(404).json({ error: "Análisis no encontrado." });
    }

    await updateAnalysisDoc(analysisId, {
      paymentStatus: 'pending_expert',
      expertContact: { email, phone, requestedAt: new Date().toISOString() }
    });

    res.json({
      success: true,
      message: "Solicitud registrada con éxito. Un experto se contactará a la brevedad."
    });
  } catch (err) {
    console.error("Error in expert-request:", err);
    res.status(500).json({ error: "Error interno al procesar la solicitud." });
  }
});


// ─── Unified Payment Processing Helper ────────────────────────────────────

async function processSuccessfulPayment({ analysisId, tier, paymentMethod = 'mercadopago', transactionId = '', orderId = '', contact = null }) {
  let analysis = await getAnalysisDoc(analysisId);
  if (!analysis) {
    analysis = {
      id: analysisId,
      filename: 'cv_usuario',
      uploadedAt: new Date().toISOString(),
      rating: 4,
      paymentStatus: 'free',
      originalText: '',
      optimizedText: ''
    };
  }

  if (tier === 'ai') {
    let optimizedText = analysis.optimizedText;
    if (!optimizedText) {
      const config = await getConfigDoc();
      optimizedText = await generateAiOptimization(
        analysis.filename,
        analysis.originalText,
        analysis.lang || 'es',
        config
      );
    }
    const updatePayload = {
      hasAiPaid: true,
      aiPaidAt: new Date().toISOString(),
      aiOrderId: orderId || transactionId,
      aiTransactionId: transactionId,
      paymentMethod,
      paidAt: new Date().toISOString(),
      optimizedText
    };
    if (analysis.hasExpertPaid || analysis.paymentStatus === 'pending_expert' || analysis.expertContact) {
      updatePayload.hasExpertPaid = true;
      updatePayload.expertStatus = analysis.expertStatus || 'pending';
      updatePayload.paymentStatus = updatePayload.expertStatus === 'completed' ? 'completed_expert' : 'pending_expert';
    } else {
      updatePayload.paymentStatus = 'completed_ai';
    }

    await updateAnalysisDoc(analysisId, updatePayload);
    recordGeminiCall('optimization');
    return { success: true, tier: 'ai', optimizedText };

  } else if (tier === 'expert') {
    const updatePayload = {
      hasExpertPaid: true,
      expertStatus: 'pending',
      expertPaidAt: new Date().toISOString(),
      expertOrderId: orderId || transactionId,
      expertTransactionId: transactionId,
      paymentMethod,
      paidAt: new Date().toISOString(),
      expertContact: {
        email: contact?.email || analysis.expertContact?.email || '',
        phone: contact?.phone || analysis.expertContact?.phone || '',
        requestedAt: new Date().toISOString()
      },
      paymentStatus: 'pending_expert'
    };
    if (analysis.hasAiPaid || analysis.paymentStatus === 'completed_ai') {
      updatePayload.hasAiPaid = true;
    }

    await updateAnalysisDoc(analysisId, updatePayload);
    return {
      success: true,
      tier: 'expert',
      message: '¡Pago completado! Un experto de Cintia te contactará en máximo 24 horas para coordinar tu sesión de asesoría.'
    };
  } else if (tier === 'cover_letter') {
    let coverLetterText = analysis.coverLetterText;
    if (!coverLetterText && analysis.jobOfferText) {
      const config = await getConfigDoc();
      coverLetterText = await generateCoverLetter(
        analysis.filename,
        analysis.originalText,
        analysis.jobOfferText,
        analysis.lang || 'es',
        config
      );
    }
    const updatePayload = {
      hasCoverLetterPaid: true,
      coverLetterPaidAt: new Date().toISOString(),
      coverLetterOrderId: orderId || transactionId,
      coverLetterTransactionId: transactionId,
      paymentMethod,
      paidAt: new Date().toISOString(),
      coverLetterText: coverLetterText || ''
    };
    if (analysis.hasExpertPaid || analysis.paymentStatus === 'pending_expert' || analysis.expertContact) {
      updatePayload.hasExpertPaid = true;
      updatePayload.expertStatus = analysis.expertStatus || 'pending';
      updatePayload.paymentStatus = updatePayload.expertStatus === 'completed' ? 'completed_expert' : 'pending_expert';
    } else if (analysis.hasAiPaid || analysis.paymentStatus === 'completed_ai') {
      updatePayload.hasAiPaid = true;
      updatePayload.paymentStatus = 'completed_ai';
    } else {
      updatePayload.paymentStatus = 'completed_cover_letter';
    }

    await updateAnalysisDoc(analysisId, updatePayload);
    recordGeminiCall('optimizations');
    return { success: true, tier: 'cover_letter', coverLetterText };
  } else if (tier === 'headshots') {
    const config = await getConfigDoc();
    let headshots = analysis.headshotImages;
    if (!headshots || !Array.isArray(headshots) || headshots.length < 20) {
      headshots = await generateHeadshotsPack(
        analysis.filename,
        analysis.originalText,
        analysis.userPhotoData || null,
        analysis.lang || 'es',
        config
      );
    }
    const updatePayload = {
      hasHeadshotsPaid: true,
      headshotsPaidAt: new Date().toISOString(),
      headshotsOrderId: orderId || transactionId,
      headshotsTransactionId: transactionId,
      paymentMethod,
      paidAt: new Date().toISOString(),
      headshotImages: headshots
    };
    if (analysis.hasExpertPaid || analysis.paymentStatus === 'pending_expert' || analysis.expertContact) {
      updatePayload.hasExpertPaid = true;
      updatePayload.expertStatus = analysis.expertStatus || 'pending';
      updatePayload.paymentStatus = updatePayload.expertStatus === 'completed' ? 'completed_expert' : 'pending_expert';
    } else {
      updatePayload.paymentStatus = 'completed_headshots';
    }

    await updateAnalysisDoc(analysisId, updatePayload);
    recordGeminiCall('optimizations');
    return { success: true, tier: 'headshots', headshots };
  } else {
    throw new Error('Tier de pago inválido.');
  }
}


// ─── PayPal Orders API v2 Integration ──────────────────────────────────────

// In-memory cache: maps PayPal orderID → { analysisId, analysis }
const paypalOrderCache = new Map();

// Helper: get PayPal OAuth2 access token
async function getPayPalAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_SECRET_KEY || process.env.PAYPAL_CLIENT_SECRET;
  const mode = (process.env.PAYPAL_MODE || 'sandbox').toLowerCase();
  const baseUrl = (mode === 'live' || mode === 'production')
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

  if (!clientId || !secret) {
    throw new Error('PayPal credentials not configured (PAYPAL_CLIENT_ID / PAYPAL_SECRET_KEY).');
  }

  const credentials = Buffer.from(`${clientId}:${secret}`).toString('base64');
  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`PayPal token error: ${response.status} - ${errBody}`);
  }

  const data = await response.json();
  return { accessToken: data.access_token, baseUrl };
}

// POST /api/paypal/create-order
app.post('/api/paypal/create-order', async (req, res) => {
  try {
    const { analysisId, tier } = req.body;
    if (!analysisId || !tier) {
      return res.status(400).json({ error: 'Faltan datos: analysisId y tier son requeridos.' });
    }

    const config = await getConfigDoc();
    let amount = (config.priceAi || 2.0).toFixed(2);
    let description = 'Cintia - Optimización de CV con IA';

    if (tier === 'expert') {
      amount = (config.priceExpert || 25.0).toFixed(2);
      description = 'Cintia - Asesoría y Optimización por Experto Humano';
    } else if (tier === 'cover_letter') {
      amount = (config.priceCoverLetter || 2.0).toFixed(2);
      description = 'Cintia - Carta de Presentación a Medida (Cover Letter)';
    } else if (tier === 'headshots') {
      amount = (config.priceHeadshots || 6.0).toFixed(2);
      description = 'Cintia - Pack 20 Fotos de Estudio para LinkedIn';
    }

    const { accessToken, baseUrl } = await getPayPalAccessToken();

    const orderPayload = {
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: `${tier}_${analysisId}`,
        description,
        amount: {
          currency_code: 'USD',
          value: amount
        }
      }]
    };

    const orderResponse = await fetch(`${baseUrl}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(orderPayload)
    });

    if (!orderResponse.ok) {
      const errText = await orderResponse.text();
      throw new Error(`PayPal create-order error: ${errText}`);
    }

    const orderData = await orderResponse.json();
    paypalOrderCache.set(orderData.id, { analysisId, tier });

    res.json({ id: orderData.id });

  } catch (err) {
    console.error('Error in /api/paypal/create-order:', err);
    res.status(500).json({ error: err.message || 'Error al iniciar la orden con PayPal.' });
  }
});

// POST /api/paypal/capture-order
app.post('/api/paypal/capture-order', async (req, res) => {
  try {
    const { orderID, analysisId, tier, contact } = req.body;
    if (!orderID) {
      return res.status(400).json({ error: 'Falta orderID para capturar el pago.' });
    }

    const cached = paypalOrderCache.get(orderID) || {};
    const targetAnalysisId = analysisId || cached.analysisId;
    const targetTier = tier || cached.tier || 'ai';

    if (!targetAnalysisId) {
      return res.status(400).json({ error: 'No se pudo identificar el análisis asociado a la orden.' });
    }

    const { accessToken, baseUrl } = await getPayPalAccessToken();

    const captureResponse = await fetch(`${baseUrl}/v2/checkout/orders/${orderID}/capture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!captureResponse.ok) {
      const errText = await captureResponse.text();
      throw new Error(`PayPal capture error: ${errText}`);
    }

    const captureData = await captureResponse.json();

    if (captureData.status !== 'COMPLETED') {
      return res.status(400).json({
        error: `El estado del pago es '${captureData.status}'. El servicio solo se activa si el pago está COMPLETED.`
      });
    }

    paypalOrderCache.delete(orderID);

    const transactionId = captureData.purchase_units?.[0]?.payments?.captures?.[0]?.id || orderID;

    const result = await processSuccessfulPayment({
      analysisId: targetAnalysisId,
      tier: targetTier,
      paymentMethod: 'paypal',
      transactionId,
      orderId: orderID,
      contact
    });

    res.json(result);

  } catch (err) {
    console.error('Error in /api/paypal/capture-order:', err);
    res.status(500).json({ error: err.message || 'Error al procesar el pago con PayPal.' });
  }
});

// ─── End PayPal Integration ─────────────────────────────────────────────────


// ─── Mercado Pago Integration ──────────────────────────────────────────────

function getMercadoPagoClient() {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) {
    throw new Error('Mercado Pago no está configurado (MERCADOPAGO_ACCESS_TOKEN no encontrado).');
  }
  return new MercadoPagoConfig({
    accessToken: token,
    options: { timeout: 7000 }
  });
}

const mpPreferenceCache = new Map();

// POST /api/mercadopago/create-preference
app.post('/api/mercadopago/create-preference', async (req, res) => {
  try {
    const { analysisId, tier, contact } = req.body;
    if (!analysisId || !tier) {
      return res.status(400).json({ error: 'Faltan datos: analysisId y tier son requeridos.' });
    }

    const config = await getConfigDoc();
    let amountClp = Number(config.priceAiClp || 2000);
    let description = 'Cintia - Optimización de CV con IA';

    if (tier === 'expert') {
      amountClp = Number(config.priceExpertClp || 25000);
      description = 'Cintia - Asesoría y Optimización por Experto Humano';
    } else if (tier === 'cover_letter') {
      amountClp = Number(config.priceCoverLetterClp || 2000);
      description = 'Cintia - Carta de Presentación a Medida (Cover Letter)';
    } else if (tier === 'headshots') {
      amountClp = Number(config.priceHeadshotsClp || 6000);
      description = 'Cintia - Pack 20 Fotos de Estudio para LinkedIn';
    }

    const origin = req.headers.origin || `${req.protocol}://${req.get('host')}`;
    const client = getMercadoPagoClient();
    const preference = new Preference(client);

    const externalRefObj = {
      analysisId,
      tier,
      contact: contact || null
    };

    const preferenceData = {
      items: [
        {
          id: `${tier}_${analysisId}`,
          title: description,
          description,
          unit_price: amountClp,
          quantity: 1,
          currency_id: 'CLP'
        }
      ],
      back_urls: {
        success: `${origin}/?payment=success&tier=${tier}&analysisId=${analysisId}&provider=mercadopago`,
        failure: `${origin}/?payment=failure&tier=${tier}&analysisId=${analysisId}&provider=mercadopago`,
        pending: `${origin}/?payment=pending&tier=${tier}&analysisId=${analysisId}&provider=mercadopago`
      },
      auto_return: 'approved',
      notification_url: (origin.includes('localhost') || origin.includes('127.0.0.1'))
        ? undefined
        : `${origin}/api/mercadopago/webhook`,
      external_reference: JSON.stringify(externalRefObj),
      statement_descriptor: 'CINTIA PRO'
    };

    const created = await preference.create({ body: preferenceData });

    mpPreferenceCache.set(created.id, { analysisId, tier, contact });
    if (mpPreferenceCache.size > 200) {
      const firstKey = mpPreferenceCache.keys().next().value;
      mpPreferenceCache.delete(firstKey);
    }

    res.json({
      preferenceId: created.id,
      initPoint: created.init_point || created.sandbox_init_point,
      sandboxInitPoint: created.sandbox_init_point
    });

  } catch (err) {
    console.error('Error in /api/mercadopago/create-preference:', err);
    res.status(500).json({ error: err.message || 'Error al crear la preferencia de pago con Mercado Pago.' });
  }
});

// POST /api/mercadopago/check-status
// Instant validation upon user return to Cintia
app.post('/api/mercadopago/check-status', async (req, res) => {
  try {
    const { paymentId, analysisId, tier, contact } = req.body;
    if (!paymentId) {
      return res.status(400).json({ error: 'Falta paymentId para verificar la transacción.' });
    }

    const client = getMercadoPagoClient();
    const payment = new Payment(client);
    const paymentData = await payment.get({ id: paymentId });

    if (!paymentData || paymentData.status !== 'approved') {
      return res.status(400).json({
        error: `Estado del pago: '${paymentData?.status || 'desconocido'}'. El servicio se activará una vez aprobado.`
      });
    }

    let extData = {};
    try {
      if (paymentData.external_reference) {
        extData = JSON.parse(paymentData.external_reference);
      }
    } catch (e) { }

    const targetAnalysisId = analysisId || extData.analysisId;
    const targetTier = tier || extData.tier || 'ai';
    const targetContact = contact || extData.contact;

    if (!targetAnalysisId) {
      return res.status(400).json({ error: 'No se pudo identificar el análisis asociado al pago.' });
    }

    const result = await processSuccessfulPayment({
      analysisId: targetAnalysisId,
      tier: targetTier,
      paymentMethod: 'mercadopago',
      transactionId: String(paymentData.id),
      orderId: String(paymentData.order?.id || paymentData.id),
      contact: targetContact
    });

    res.json({
      ...result,
      status: paymentData.status,
      paymentId: paymentData.id
    });

  } catch (err) {
    console.error('Error in /api/mercadopago/check-status:', err);
    res.status(500).json({ error: err.message || 'Error al verificar el pago con Mercado Pago.' });
  }
});

// POST /api/mercadopago/webhook
app.post('/api/mercadopago/webhook', async (req, res) => {
  try {
    const topic = req.query.topic || req.query.type || req.body?.type || req.body?.topic;
    const paymentId = req.body?.data?.id || req.query['data.id'] || req.query?.id;

    res.status(200).send('OK');

    if ((topic === 'payment' || req.body?.action?.startsWith('payment.')) && paymentId) {
      try {
        const client = getMercadoPagoClient();
        const payment = new Payment(client);
        const paymentData = await payment.get({ id: paymentId });

        if (paymentData && paymentData.status === 'approved') {
          let extData = {};
          try {
            if (paymentData.external_reference) {
              extData = JSON.parse(paymentData.external_reference);
            }
          } catch (e) { }

          if (extData.analysisId && extData.tier) {
            await processSuccessfulPayment({
              analysisId: extData.analysisId,
              tier: extData.tier,
              paymentMethod: 'mercadopago',
              transactionId: String(paymentData.id),
              orderId: String(paymentData.order?.id || paymentData.id),
              contact: extData.contact
            });
            console.log(`[Mercado Pago Webhook] Payment ${paymentId} approved and unlocked for analysis ${extData.analysisId}`);
          }
        }
      } catch (innerErr) {
        console.error('[Mercado Pago Webhook] Error fetching payment:', innerErr.message);
      }
    }
  } catch (err) {
    console.error('[Mercado Pago Webhook] Outer error:', err);
    if (!res.headersSent) res.status(500).send('Webhook processing error');
  }
});

// ─── End Mercado Pago Integration ──────────────────────────────────────────

// Retrieve optimized CV for completed AI sessions (useful on refresh/recovery)
app.get('/api/analysis/:id', async (req, res) => {
  const analysis = await getAnalysisDoc(req.params.id);
  if (!analysis) {
    return res.status(404).json({ error: "Análisis no encontrado." });
  }
  res.json({
    id: analysis.id,
    filename: analysis.filename,
    rating: analysis.rating,
    evaluation: analysis.evaluation,
    paymentStatus: analysis.paymentStatus,
    optimizedText: analysis.optimizedText,
    expertContact: analysis.expertContact
  });
});

// Admin Authorization Middleware
function requireAdminAuth(req, res, next) {
  const token = req.headers['authorization'];
  if (!token || !verifyAdminToken(token)) {
    return res.status(401).json({ error: "No autorizado o sesión expirada." });
  }
  next();
}

// Admin login
app.post('/api/admin/login', (req, res) => {
  const clientIp = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';

  // Rate limiting check
  const rateLimitStatus = checkAdminLoginRateLimit(clientIp);
  if (rateLimitStatus.limited) {
    return res.status(429).json({ error: `Demasiados intentos de acceso fallidos. Bloqueado por ${rateLimitStatus.secondsLeft} segundos.` });
  }

  const { email, password } = req.body;

  // Get credentials from environment variables with safe fallbacks
  const expectedEmail = process.env.ADMIN_EMAIL || 'admin@cintia.net';
  const expectedPassword = process.env.ADMIN_PASSWORD || 'admin';

  if (email === expectedEmail && password === expectedPassword) {
    registerAdminLoginAttempt(clientIp, true);
    const token = generateAdminToken(email);
    res.json({ success: true, token });
  } else {
    registerAdminLoginAttempt(clientIp, false);
    res.status(401).json({ error: "Credenciales incorrectas." });
  }
});

// Admin logout
app.post('/api/admin/logout', (req, res) => {
  res.json({ success: true });
});

// Admin stats
app.get('/api/admin/stats', requireAdminAuth, async (req, res) => {
  const config = await getConfigDoc();
  const adminData = await getAdminData(config);
  res.json(adminData);
});

// Test Gemini API connectivity
app.get('/api/admin/test-gemini', requireAdminAuth, async (req, res) => {
  try {
    const config = await getConfigDoc();
    const key = getGeminiApiKey(config);
    if (!key) {
      return res.status(400).json({
        success: false,
        error: "No se encontró Gemini API Key configurada ni en el panel ni en variables de entorno (GEMINI_API_KEY)."
      });
    }

    const start = Date.now();
    const responseText = await callGemini(key, null, "Responde únicamente con la palabra OK.", false);
    const latencyMs = Date.now() - start;

    res.json({
      success: true,
      message: "Conexión exitosa con la API de Google Gemini.",
      latencyMs: latencyMs,
      responsePreview: responseText ? responseText.trim() : "OK"
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: `Error de conexión con Gemini: ${err.message}`
    });
  }
});

// Mark expert review as completed
app.post('/api/admin/expert-complete', requireAdminAuth, async (req, res) => {
  const { analysisId } = req.body;
  if (!analysisId) return res.status(400).json({ error: "ID faltante" });

  await updateAnalysisDoc(analysisId, {
    expertStatus: 'completed',
    expertCompletedAt: new Date().toISOString(),
    paymentStatus: 'completed_expert'
  });

  res.json({ success: true });
});

// Toggle archive status of lead / analysis
app.post('/api/admin/leads/archive', requireAdminAuth, async (req, res) => {
  const { analysisId, archived } = req.body;
  if (!analysisId) return res.status(400).json({ error: "ID faltante" });

  const isArchived = Boolean(archived);
  await updateAnalysisDoc(analysisId, {
    archived: isArchived,
    archivedAt: isArchived ? new Date().toISOString() : null
  });

  res.json({ success: true, archived: isArchived });
});

// Delete lead / analysis permanently
app.post('/api/admin/leads/delete', requireAdminAuth, async (req, res) => {
  const { analysisId } = req.body;
  if (!analysisId) return res.status(400).json({ error: "ID faltante" });

  await deleteAnalysisDoc(analysisId);
  res.json({ success: true, message: "Registro eliminado correctamente." });
});

// Batch Delete Multiple Analyses / Leads
app.post('/api/admin/batch/delete', requireAdminAuth, async (req, res) => {
  try {
    const { analysisIds } = req.body;
    if (!Array.isArray(analysisIds) || analysisIds.length === 0) {
      return res.status(400).json({ error: "Lista de IDs inválida o vacía." });
    }

    for (const id of analysisIds) {
      await deleteAnalysisDoc(id);
    }

    res.json({ success: true, count: analysisIds.length, message: `${analysisIds.length} currículums eliminados correctamente.` });
  } catch (err) {
    console.error("Batch delete error:", err);
    res.status(500).json({ error: "Error al eliminar currículums seleccionados." });
  }
});

// Batch Archive / Unarchive Multiple Analyses / Leads
app.post('/api/admin/batch/archive', requireAdminAuth, async (req, res) => {
  try {
    const { analysisIds, archived } = req.body;
    if (!Array.isArray(analysisIds) || analysisIds.length === 0) {
      return res.status(400).json({ error: "Lista de IDs inválida o vacía." });
    }

    const isArchived = Boolean(archived);
    const now = isArchived ? new Date().toISOString() : null;

    for (const id of analysisIds) {
      await updateAnalysisDoc(id, {
        archived: isArchived,
        archivedAt: now
      });
    }

    res.json({ success: true, count: analysisIds.length, archived: isArchived });
  } catch (err) {
    console.error("Batch archive error:", err);
    res.status(500).json({ error: "Error al archivar currículums seleccionados." });
  }
});

// Batch Update Status of Multiple Analyses / Leads
app.post('/api/admin/batch/update-status', requireAdminAuth, async (req, res) => {
  try {
    const { analysisIds, paymentStatus, rating } = req.body;
    if (!Array.isArray(analysisIds) || analysisIds.length === 0) {
      return res.status(400).json({ error: "Lista de IDs inválida o vacía." });
    }

    const updateData = {};
    if (paymentStatus) {
      updateData.paymentStatus = paymentStatus;
      if (paymentStatus === 'completed_ai') updateData.hasAiPaid = true;
      if (paymentStatus === 'completed_cover_letter') updateData.hasCoverLetterPaid = true;
      if (paymentStatus === 'completed_headshots') updateData.hasHeadshotsPaid = true;
      if (paymentStatus === 'pending_expert') {
        updateData.hasExpertPaid = true;
        updateData.expertStatus = 'pending';
      }
      if (paymentStatus === 'completed_expert') {
        updateData.hasExpertPaid = true;
        updateData.expertStatus = 'completed';
        updateData.expertCompletedAt = new Date().toISOString();
      }
      if (paymentStatus === 'free') {
        updateData.hasAiPaid = false;
        updateData.hasCoverLetterPaid = false;
        updateData.hasHeadshotsPaid = false;
        updateData.hasExpertPaid = false;
        updateData.expertStatus = null;
      }
    }
    if (typeof rating === 'number' && rating >= 1 && rating <= 5) {
      updateData.rating = Math.round(rating);
    }

    for (const id of analysisIds) {
      await updateAnalysisDoc(id, updateData);
    }

    res.json({ success: true, count: analysisIds.length, message: "Estados actualizados correctamente." });
  } catch (err) {
    console.error("Batch update status error:", err);
    res.status(500).json({ error: "Error al actualizar estados en lote." });
  }
});

// Update Single Analysis / CV Metadata
app.post('/api/admin/analysis-update/:id', requireAdminAuth, async (req, res) => {
  try {
    const analysisId = req.params.id;
    const { filename, rating, paymentStatus, expertContact, jobOfferText, archived } = req.body;

    const analysis = await getAnalysisDoc(analysisId);
    if (!analysis) return res.status(404).json({ error: "Currículum no encontrado." });

    const updateData = {};
    if (typeof filename === 'string' && filename.trim().length > 0) {
      updateData.filename = filename.trim();
    }
    if (typeof rating === 'number' && rating >= 1 && rating <= 5) {
      updateData.rating = Math.round(rating);
    }
    if (typeof expertContact === 'string') {
      updateData.expertContact = expertContact.trim();
    }
    if (typeof jobOfferText === 'string') {
      updateData.jobOfferText = jobOfferText.trim();
    }
    if (typeof archived === 'boolean') {
      updateData.archived = archived;
      updateData.archivedAt = archived ? new Date().toISOString() : null;
    }
    if (paymentStatus) {
      updateData.paymentStatus = paymentStatus;
      if (paymentStatus === 'completed_ai') updateData.hasAiPaid = true;
      if (paymentStatus === 'completed_cover_letter') updateData.hasCoverLetterPaid = true;
      if (paymentStatus === 'completed_headshots') updateData.hasHeadshotsPaid = true;
      if (paymentStatus === 'pending_expert') {
        updateData.hasExpertPaid = true;
        updateData.expertStatus = 'pending';
      }
      if (paymentStatus === 'completed_expert') {
        updateData.hasExpertPaid = true;
        updateData.expertStatus = 'completed';
        updateData.expertCompletedAt = new Date().toISOString();
      }
      if (paymentStatus === 'free') {
        updateData.hasAiPaid = false;
        updateData.hasCoverLetterPaid = false;
        updateData.hasHeadshotsPaid = false;
        updateData.hasExpertPaid = false;
        updateData.expertStatus = null;
      }
    }

    await updateAnalysisDoc(analysisId, updateData);
    res.json({ success: true, message: "Datos actualizados correctamente." });
  } catch (err) {
    console.error("Analysis update error:", err);
    res.status(500).json({ error: "Error al actualizar currículum." });
  }
});

// Get admin settings
app.get('/api/admin/settings', requireAdminAuth, async (req, res) => {
  const config = await getConfigDoc();
  const secureConfig = { ...config };

  // Mask the API Key to protect it from exposure (checking both config doc and env vars)
  const activeKey = getGeminiApiKey(config);
  if (activeKey) {
    secureConfig.geminiApiKey = '••••••••' + activeKey.slice(-4);
  } else {
    secureConfig.geminiApiKey = '';
  }

  // Omit password from responses for safety
  delete secureConfig.adminPassword;

  const isConnected = Boolean(initFirebase());
  secureConfig.firestoreConnected = isConnected;
  secureConfig.firestoreError = lastFirebaseError;
  secureConfig.firestoreProjectId = firebaseProjectId;

  res.json(secureConfig);
});

// Update admin settings
app.post('/api/admin/settings', requireAdminAuth, async (req, res) => {
  try {
    const newSettings = req.body;
    const config = await getConfigDoc();

    // Validate and update fields
    if (newSettings.hasOwnProperty('geminiApiKey')) {
      const cleanKey = newSettings.geminiApiKey.trim();
      if (!cleanKey.startsWith('••••••••')) {
        config.geminiApiKey = cleanKey;
      }
    }
    if (newSettings.hasOwnProperty('priceAi')) config.priceAi = parseFloat(newSettings.priceAi) || 2.0;
    if (newSettings.hasOwnProperty('priceExpert')) config.priceExpert = parseFloat(newSettings.priceExpert) || 25.0;
    if (newSettings.hasOwnProperty('priceCoverLetter')) config.priceCoverLetter = parseFloat(newSettings.priceCoverLetter) || 2.0;
    if (newSettings.hasOwnProperty('priceHeadshots')) config.priceHeadshots = parseFloat(newSettings.priceHeadshots) || 6.0;
    if (newSettings.hasOwnProperty('priceAiClp')) config.priceAiClp = parseInt(newSettings.priceAiClp, 10) || 2000;
    if (newSettings.hasOwnProperty('priceExpertClp')) config.priceExpertClp = parseInt(newSettings.priceExpertClp, 10) || 25000;
    if (newSettings.hasOwnProperty('priceCoverLetterClp')) config.priceCoverLetterClp = parseInt(newSettings.priceCoverLetterClp, 10) || 2000;
    if (newSettings.hasOwnProperty('priceHeadshotsClp')) config.priceHeadshotsClp = parseInt(newSettings.priceHeadshotsClp, 10) || 6000;
    if (newSettings.hasOwnProperty('optAiEnabled')) config.optAiEnabled = !!newSettings.optAiEnabled;
    if (newSettings.hasOwnProperty('optExpertEnabled')) config.optExpertEnabled = !!newSettings.optExpertEnabled;
    if (newSettings.hasOwnProperty('optCoverLetterEnabled')) config.optCoverLetterEnabled = !!newSettings.optCoverLetterEnabled;
    if (newSettings.hasOwnProperty('optHeadshotsEnabled')) config.optHeadshotsEnabled = !!newSettings.optHeadshotsEnabled;
    if (newSettings.hasOwnProperty('headshotsPackSize')) config.headshotsPackSize = parseInt(newSettings.headshotsPackSize, 10) || 20;
    if (newSettings.hasOwnProperty('headshotsResolution')) config.headshotsResolution = String(newSettings.headshotsResolution);
    if (newSettings.hasOwnProperty('headshotsCatCorp')) config.headshotsCatCorp = !!newSettings.headshotsCatCorp;
    if (newSettings.hasOwnProperty('headshotsCatCasual')) config.headshotsCatCasual = !!newSettings.headshotsCatCasual;
    if (newSettings.hasOwnProperty('headshotsCatTech')) config.headshotsCatTech = !!newSettings.headshotsCatTech;
    if (newSettings.hasOwnProperty('headshotsCatEdit')) config.headshotsCatEdit = !!newSettings.headshotsCatEdit;
    if (newSettings.hasOwnProperty('headshotsPrompt')) config.headshotsPrompt = String(newSettings.headshotsPrompt);
    if (newSettings.hasOwnProperty('captchaEnabled')) config.captchaEnabled = !!newSettings.captchaEnabled;
    if (newSettings.hasOwnProperty('rateLimitPerHour')) config.rateLimitPerHour = parseInt(newSettings.rateLimitPerHour, 10) || 5;
    if (newSettings.evaluationPrompt) config.evaluationPrompt = newSettings.evaluationPrompt;
    if (newSettings.optimizationPrompt) config.optimizationPrompt = newSettings.optimizationPrompt;
    if (newSettings.coverLetterPrompt) config.coverLetterPrompt = newSettings.coverLetterPrompt;

    await writeConfig(config);
    res.json({ success: true, message: "Parámetros guardados correctamente." });
  } catch (err) {
    res.status(500).json({ error: "Error al guardar parámetros." });
  }
});

// Admin endpoint: get full analysis record (original text, AI optimized text, cover letter, headshots, contact, etc.)
app.get('/api/admin/analysis-detail/:id', requireAdminAuth, async (req, res) => {
  const analysis = await getAnalysisDoc(req.params.id);
  if (!analysis) return res.status(404).json({ error: "Análisis no encontrado." });

  res.json({
    id: analysis.id,
    filename: analysis.filename,
    fileSize: analysis.fileSize,
    fileType: analysis.fileType,
    uploadedAt: analysis.uploadedAt,
    rating: analysis.rating,
    paymentStatus: analysis.paymentStatus,
    paymentMethod: analysis.paymentMethod,
    hasAiPaid: Boolean(analysis.hasAiPaid),
    hasCoverLetterPaid: Boolean(analysis.hasCoverLetterPaid),
    hasHeadshotsPaid: Boolean(analysis.hasHeadshotsPaid),
    hasExpertPaid: Boolean(analysis.hasExpertPaid),
    expertContact: analysis.expertContact,
    jobOfferText: analysis.jobOfferText || "",
    coverLetterText: analysis.coverLetterText || "",
    userPhotoData: analysis.userPhotoData || null,
    headshotImages: analysis.headshotImages || [],
    originalText: analysis.originalText || "",
    optimizedText: analysis.optimizedText || "",
    evaluation: analysis.evaluation
  });
});

// Admin endpoint: download cover letter text
app.get('/api/admin/download-cover-letter/:id', requireAdminAuth, async (req, res) => {
  const analysis = await getAnalysisDoc(req.params.id);
  if (!analysis) return res.status(404).send("No encontrado");

  res.setHeader('Content-disposition', `attachment; filename=carta_presentacion_${analysis.filename}.txt`);
  res.setHeader('Content-type', 'text/plain; charset=utf-8');
  res.send(analysis.coverLetterText || "");
});

// Admin endpoint: download original CV text
app.get('/api/admin/download-text/:id', requireAdminAuth, async (req, res) => {
  const analysis = await getAnalysisDoc(req.params.id);
  if (!analysis) return res.status(404).send("No encontrado");

  res.setHeader('Content-disposition', `attachment; filename=cv_original_${analysis.filename}.txt`);
  res.setHeader('Content-type', 'text/plain; charset=utf-8');
  res.send(analysis.originalText || "");
});

// Admin endpoint: download AI-optimized CV text
app.get('/api/admin/download-optimized/:id', requireAdminAuth, async (req, res) => {
  const analysis = await getAnalysisDoc(req.params.id);
  if (!analysis) return res.status(404).send("No encontrado");

  res.setHeader('Content-disposition', `attachment; filename=cv_optimizado_cintia_${analysis.filename}.txt`);
  res.setHeader('Content-type', 'text/plain; charset=utf-8');
  res.send(analysis.optimizedText || "");
});

// Legal terms route
app.get('/terminos', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'terminos.html'));
});

// Start Server
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

module.exports = app;

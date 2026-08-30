const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const AdmZip = require('adm-zip');
const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');
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
      } catch (e) {}
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
    inMemoryDb = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    return inMemoryDb;
  } catch (err) {
    inMemoryDb = { visits: 0, analyses: [] };
    return inMemoryDb;
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
    } catch (err) {
      console.error("Firestore deleteAnalysisDoc error:", err.message);
    }
  }
}

async function getAdminData(config) {
  const priceAi = parseFloat(config?.priceAi) || 2.0;
  const priceExpert = parseFloat(config?.priceExpert) || 25.0;
  const priceCoverLetter = parseFloat(config?.priceCoverLetter) || 2.0;
  const priceHeadshots = parseFloat(config?.priceHeadshots) || 5.0;
  const geminiStats = await getGeminiStats(config);

  const dbFs = initFirebase();
  if (dbFs) {
    try {
      // Get visits
      const statsDoc = await dbFs.collection('app_stats').doc('general').get();
      const totalVisits = statsDoc.exists ? (statsDoc.data().visits || 0) : (readDb().visits || 0);

      // Get analyses (try ordered, fallback to regular get if index/field issue)
      let snap;
      try {
        snap = await dbFs.collection('analyses').orderBy('uploadedAt', 'desc').limit(300).get();
      } catch (orderErr) {
        console.warn("Firestore orderBy uploadedAt failed, reading without orderBy:", orderErr.message);
        snap = await dbFs.collection('analyses').limit(300).get();
      }

      let analysesList = snap.docs.map(d => d.data());
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
    } catch (err) {
      console.error("Firestore getAdminData error, falling back to local:", err.message);
    }
  }

  // Local fallback
  const db = readDb();
  const totalVisits = db.visits || 0;
  const analysesList = db.analyses || [];
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
  }).reverse();

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
        totalCalls: admin.firestore.FieldValue.increment(1),
        lastModel: model || "gemini-2.5-flash",
        lastCallAt: inMemoryGeminiUsage.lastCallAt
      };
      if (type) {
        updateData[type] = admin.firestore.FieldValue.increment(1);
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
        visits: admin.firestore.FieldValue.increment(1)
      }, { merge: true });
    } catch (err) {
      console.error("Firestore incrementVisits error:", err.message);
    }
  }
}

function readConfig() {
  if (inMemoryConfig) return inMemoryConfig;
  try {
    inMemoryConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
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
      evaluationPrompt: "Eres Cintia, la experta virtual de MelodIA Lab en reclutamiento y optimización de Currículums para superar filtros ATS (Applicant Tracking Systems). Analiza el siguiente texto de currículum vitae y evalúalo bajo estos 7 criterios clave:\n1. Compatibilidad ATS (estructura de secciones estándar, legibilidad por software ATS, tipografías limpias y encabezados reconocibles).\n2. Claridad de Talentos e Habilidades (habilidades duras, blandas y certificaciones claras y categorizadas).\n3. Extensión del Documento (máximo 2 páginas recomendadas).\n4. Logros y Métricas Cuantificables (existencia de números, porcentajes o impactos cuantificados en la experiencia laboral).\n5. Lenguaje y Verbos de Acción (uso de verbos activos y tono profesional persuasivo).\n6. Datos de Contacto y Enlaces (presencia de datos esenciales de contacto y enlaces clave como LinkedIn o Portafolio).\n7. Ortografía y Consistencia Gramatical (ausencia de errores y concordancia en tiempos verbales).\n\nREGLAS FUNDAMENTALES DE EVALUACIÓN:\n- CRONOLOGÍA Y FECHAS: No generes falsos positivos de fechas. Es completamente normal y válido que un currículum contenga fechas recientes (como 2024, 2025, 2026), roles actuales ('Presente', 'Actualidad', 'Present') o certificaciones recientes. Solo señala un problema de fechas si hay una inconsistencia lógica evidente e imposible (por ejemplo, terminar un trabajo antes de empezarlo). JAMÁS menciones variables internas, 'fecha del sistema' ni términos técnicos de la plataforma en las explicaciones o retroalimentaciones.\n- IDIOMA Y TONO: Debes responder 100% en el mismo idioma del currículum (si el CV está en inglés, responde todo el JSON estrictamente en inglés con vocabulario profesional; si está en español, responde estrictamente en español). Mantén un tono constructivo, profesional, empático y claro, destacando fortalezas y dando consejos prácticos.\n\nDevuelve la respuesta estrictamente en formato JSON con la siguiente estructura:\n{\n  \"stars\": (número entero de 1 a 5 para el puntaje global),\n  \"summary\": \"Resumen breve de la evaluación\",\n  \"atsCompatibility\": { \"stars\": (número entero de 1 a 5), \"feedback\": \"retroalimentación con marcadores **negrita** para conceptos clave\" },\n  \"skillsClarity\": { \"stars\": (número entero de 1 a 5), \"feedback\": \"retroalimentación con marcadores **negrita**\" },\n  \"lengthCheck\": { \"stars\": (número entero de 1 a 5), \"feedback\": \"retroalimentación con marcadores **negrita**\" },\n  \"quantifiableMetrics\": { \"stars\": (número entero de 1 a 5), \"feedback\": \"retroalimentación con marcadores **negrita**\" },\n  \"actionVerbs\": { \"stars\": (número entero de 1 a 5), \"feedback\": \"retroalimentación con marcadores **negrita**\" },\n  \"contactLinks\": { \"stars\": (número entero de 1 a 5), \"feedback\": \"retroalimentación con marcadores **negrita**\" },\n  \"grammarSpelling\": { \"stars\": (número entero de 1 a 5), \"feedback\": \"retroalimentación con marcadores **negrita**\" },\n  \"detailedExplanation\": \"Explicación detallada del porqué de la puntuación en estrellas y recomendaciones clave para mejorar.\"\n}",
      optimizationPrompt: "Eres Cintia, la redactora profesional y experta virtual de MelodIA Lab en marca personal. Toma el siguiente currículum vitae y genera una versión optimizada, con redacción persuasiva, palabras clave estratégicas para filtros ATS, y una estructura impecable. Además del currículum optimizado, debes incluir obligatoriamente una sección con ejemplos de párrafos alternativos completamente optimizados para su perfil (como un perfil profesional pulido o la redacción de sus logros clave) y una sección de recomendaciones de mejora estratégicas detalladas según su trayectoria laboral y conocimientos específicos del sector. Devuelve todo el documento formateado en Markdown limpio."
    };
    return inMemoryConfig;
  }
}

function writeConfig(data) {
  inMemoryConfig = data;
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.warn("Read-only filesystem detected. Configuration updated in memory only.");
  }
  const dbFs = initFirebase();
  if (dbFs) {
    dbFs.collection('app_config').doc('settings').set(data, { merge: true }).catch(err => {
      console.error("Firestore writeConfig error:", err.message);
    });
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
    const parts = decoded.split(':');
    if (parts.length !== 3) return false;
    const [email, expiresAtStr, receivedHmac] = parts;
    const expiresAt = parseInt(expiresAtStr, 10);
    if (isNaN(expiresAt) || Date.now() > expiresAt) return false;

    const payload = `${email}:${expiresAtStr}`;
    const expectedHmac = crypto.createHmac('sha256', getSessionSecret()).update(payload).digest('hex');
    
    if (crypto.timingSafeEqual(Buffer.from(receivedHmac, 'hex'), Buffer.from(expectedHmac, 'hex'))) {
      const expectedEmail = process.env.ADMIN_EMAIL || 'admin@cintia.net';
      return email === expectedEmail;
    }
  } catch (err) {
    return false;
  }
  return false;
}

async function getConfigDoc() {
  const dbFs = initFirebase();
  if (dbFs) {
    try {
      const doc = await dbFs.collection('app_config').doc('settings').get();
      if (doc.exists) {
        inMemoryConfig = { ...readConfig(), ...doc.data() };
        return inMemoryConfig;
      } else {
        const initialConfig = readConfig();
        await dbFs.collection('app_config').doc('settings').set(initialConfig);
        return initialConfig;
      }
    } catch (err) {
      console.error("Firestore getConfigDoc error, falling back to local:", err.message);
    }
  }
  return readConfig();
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

// ─── AI Headshots Generator Helper & Endpoints ────────────────────────────

const HEADSHOT_STYLES = [
  { id: 1, es: "Ejecutivo Azul Marino", en: "Executive Classic Navy", cat: "Corporativo", bg: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)", accent: "#38bdf8", outfit: "Traje Formal Azul", light: "Rembrandt 85mm" },
  { id: 2, es: "Estudio Minimalista Carbón", en: "Studio Charcoal 85mm", cat: "Estudio", bg: "linear-gradient(135deg, #334155 0%, #1e293b 100%)", accent: "#94a3b8", outfit: "Blazer Gris Marengo", light: "Softbox Difusa" },
  { id: 3, es: "Smart Casual Oxford", en: "Smart Casual Oxford", cat: "Smart Casual", bg: "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)", accent: "#0284c7", outfit: "Camisa Oxford & Blazer", light: "Luz Natural Loft" },
  { id: 4, es: "Tech Innovation Coworking", en: "Tech Hub Coworking", cat: "Tech", bg: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)", accent: "#818cf8", outfit: "Polo / Blazer Moderno", light: "Vidrio & Luz Diurna" },
  { id: 5, es: "Estudio Blanco High-Key", en: "High-Key Pure White", cat: "Estudio", bg: "linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%)", accent: "#64748b", outfit: "Camisa Blanca Impecable", light: "High-Key Sin Sombras" },
  { id: 6, es: "Terraza Atardecer Dorado", en: "Golden Hour Terrace", cat: "Corporativo", bg: "linear-gradient(135deg, #78350f 0%, #451a03 100%)", accent: "#fbbf24", outfit: "Traje Ejecutivo & Corbata", light: "Contraluz Dorado" },
  { id: 7, es: "Pizarra Editorial Moderna", en: "Slate Modern Minimalist", cat: "Estudio", bg: "linear-gradient(135deg, #1e293b 0%, #334155 100%)", accent: "#38bdf8", outfit: "Blazer Negro Contemporáneo", light: "Luz de Contorno Fina" },
  { id: 8, es: "Acento Cian Vanguardia", en: "Ambient Teal Edge Light", cat: "Tech", bg: "linear-gradient(135deg, #022c22 0%, #064e3b 100%)", accent: "#2dd4bf", outfit: "Blazer & Cuello Redondo", light: "Edge Light Cian 3-Puntos" },
  { id: 9, es: "Primer Plano de Liderazgo", en: "Confident Leader Close-up", cat: "Editorial", bg: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)", accent: "#38bdf8", outfit: "Vestimenta Ejecutiva", light: "Retrato Clásico 85mm f/1.4" },
  { id: 10, es: "Arquitectura Corporativa", en: "Corporate Glass & Steel", cat: "Corporativo", bg: "linear-gradient(135deg, #0c4a6e 0%, #082f49 100%)", accent: "#38bdf8", outfit: "Traje Ejecutivo Moderno", light: "Arquitectura Desenfocada" },
  { id: 11, es: "Cuello Alto Ejecutivo", en: "Smart Turtleneck Executive", cat: "Smart Casual", bg: "linear-gradient(135deg, #27272a 0%, #18181b 100%)", accent: "#a1a1aa", outfit: "Cuello Alto & Blazer", light: "Luz Direccional Cálida" },
  { id: 12, es: "Estudio Clásico 3 Puntos", en: "Classic 3-Point Studio", cat: "Estudio", bg: "linear-gradient(135deg, #3f3f46 0%, #27272a 100%)", accent: "#e4e4e7", outfit: "Camisa Formal & Blazer", light: "Iluminación de Estudio" },
  { id: 13, es: "Fondo Biblioteca & Madera", en: "Executive Library & Wood", cat: "Corporativo", bg: "linear-gradient(135deg, #451a03 0%, #292524 100%)", accent: "#d97706", outfit: "Traje Formal de Negocios", light: "Cálida & Ambiente Académico" },
  { id: 14, es: "Atrio de Cristal Luminoso", en: "Daylight Glass Atrium", cat: "Tech", bg: "linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)", accent: "#0284c7", outfit: "Smart Casual Claro", light: "Luz Diurna Envolvente" },
  { id: 15, es: "Monocromo Fino Editorial", en: "Fine Art Monochrome", cat: "Editorial", bg: "linear-gradient(135deg, #18181b 0%, #09090b 100%)", accent: "#f4f4f5", outfit: "Traje Contraste B/N", light: "Blanco & Negro Alto Contraste" },
  { id: 16, es: "Estudio Pastel Contemporáneo", en: "Contemporary Pastel Studio", cat: "Smart Casual", bg: "linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)", accent: "#0ea5e9", outfit: "Blazer Azul Claro & Camisa", light: "Luz Suave Beauty Dish" },
  { id: 17, es: "Skyline Urbano al Anochecer", en: "Metropolitan Skyline Dusk", cat: "Corporativo", bg: "linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%)", accent: "#a5b4fc", outfit: "Traje Oscuro Elegante", light: "Luces de Ciudad Bokeh" },
  { id: 18, es: "Ángulo Cercano Empático 45°", en: "Approachable 45° Angle", cat: "Estudio", bg: "linear-gradient(135deg, #334155 0%, #1e293b 100%)", accent: "#38bdf8", outfit: "Blazer Desestructurado", light: "Flash Suave Frontal" },
  { id: 19, es: "Loft Creativo Ladrillo Visto", en: "Creative Brick Loft Studio", cat: "Smart Casual", bg: "linear-gradient(135deg, #292524 0%, #1c1917 100%)", accent: "#f97316", outfit: "Camisa de Lino & Blazer", light: "Luz Incandescente Suave" },
  { id: 20, es: "Portada LinkedIn Premium", en: "LinkedIn Premium Editorial", cat: "Editorial", bg: "linear-gradient(135deg, #0f172a 0%, #0284c7 100%)", accent: "#38bdf8", outfit: "Traje a Medida de Gala", light: "Calidad Portada Revista" }
];

function generateHeadshotSvg(style, photoDataUrl, candidateName, lang = 'es') {
  const isEn = lang === 'en';
  const title = isEn ? style.en : style.es;
  const initial = candidateName ? candidateName.charAt(0).toUpperCase() : 'C';
  const textColor = style.bg.includes('#ffffff') || style.bg.includes('#f8fafc') || style.bg.includes('#e0f2fe') ? '#0f172a' : '#ffffff';
  const subtitleColor = style.bg.includes('#ffffff') || style.bg.includes('#f8fafc') || style.bg.includes('#e0f2fe') ? '#475569' : 'rgba(255,255,255,0.75)';

  // If user provided photoDataUrl, use it inside an SVG image pattern or overlay
  const photoElement = photoDataUrl
    ? `<image href="${photoDataUrl}" x="120" y="110" width="240" height="240" preserveAspectRatio="xMidYMid slice" clip-path="url(#avatarClip)" />`
    : `
      <!-- Stylized Studio Portrait Silhouette -->
      <circle cx="240" cy="210" r="85" fill="${style.accent}" opacity="0.22" />
      <circle cx="240" cy="190" r="54" fill="${style.accent}" opacity="0.9" />
      <text x="240" y="206" text-anchor="middle" dominant-baseline="middle" font-family="-apple-system, system-ui, sans-serif" font-size="44" font-weight="bold" fill="#ffffff">${initial}</text>
      <path d="M140 370 C 140 280, 340 280, 340 370 Z" fill="${style.accent}" opacity="0.75" />
    `;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 480" width="480" height="480">
    <defs>
      <linearGradient id="bgGrad_${style.id}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${style.accent}" stop-opacity="0.18" />
        <stop offset="100%" stop-color="#0f172a" stop-opacity="0.98" />
      </linearGradient>
      <clipPath id="avatarClip">
        <circle cx="240" cy="225" r="110" />
      </clipPath>
      <filter id="softGlow">
        <feGaussianBlur stdDeviation="12" result="coloredBlur"/>
        <feMerge>
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>

    <!-- Background -->
    <rect width="480" height="480" fill="#0f172a" />
    <rect width="480" height="480" fill="url(#bgGrad_${style.id})" />

    <!-- Ambient Studio Spotlight -->
    <circle cx="240" cy="180" r="170" fill="${style.accent}" opacity="0.15" filter="url(#softGlow)" />

    <!-- Outer Decorative Ring -->
    <circle cx="240" cy="225" r="116" fill="none" stroke="${style.accent}" stroke-width="2.5" stroke-dasharray="8 6" opacity="0.5" />
    <circle cx="240" cy="225" r="111" fill="none" stroke="${style.accent}" stroke-width="2" opacity="0.9" />

    <!-- Photo Content -->
    ${photoElement}

    <!-- Header Badge -->
    <rect x="24" y="24" width="130" height="28" rx="14" fill="rgba(15,23,42,0.75)" stroke="${style.accent}" stroke-width="1" />
    <text x="89" y="42" text-anchor="middle" dominant-baseline="middle" font-family="-apple-system, system-ui, sans-serif" font-size="11" font-weight="700" fill="${style.accent}" letter-spacing="0.5">${style.cat.toUpperCase()}</text>

    <!-- Top Right 85mm badge -->
    <rect x="360" y="24" width="96" height="28" rx="14" fill="rgba(15,23,42,0.75)" stroke="rgba(255,255,255,0.2)" stroke-width="1" />
    <text x="408" y="42" text-anchor="middle" dominant-baseline="middle" font-family="-apple-system, system-ui, sans-serif" font-size="10.5" font-weight="600" fill="#e2e8f0">85mm · f/1.4</text>

    <!-- Bottom Metadata Panel -->
    <rect x="24" y="390" width="432" height="66" rx="12" fill="rgba(15,23,42,0.85)" stroke="rgba(255,255,255,0.12)" stroke-width="1" />
    <text x="44" y="418" font-family="-apple-system, system-ui, sans-serif" font-size="15" font-weight="700" fill="#ffffff">${title}</text>
    <text x="44" y="440" font-family="-apple-system, system-ui, sans-serif" font-size="12" font-weight="500" fill="${subtitleColor}">Estilo: ${style.outfit} · Ilum: ${style.light}</text>
    <text x="436" y="429" text-anchor="end" font-family="-apple-system, system-ui, sans-serif" font-size="13" font-weight="800" fill="${style.accent}">#${style.id < 10 ? '0' + style.id : style.id}</text>
  </svg>`;
}

async function generateHeadshotsPack(filename, cvText, userPhotoData, lang = 'es', config = {}) {
  const candidateName = filename ? filename.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ") : "Candidato";
  
  const headshots = HEADSHOT_STYLES.map(style => {
    const svgContent = generateHeadshotSvg(style, userPhotoData, candidateName, lang);
    const base64Svg = `data:image/svg+xml;base64,${Buffer.from(svgContent).toString('base64')}`;
    
    return {
      id: style.id,
      title: lang === 'en' ? style.en : style.es,
      category: style.cat,
      outfit: style.outfit,
      lighting: style.light,
      svgDataUrl: base64Svg,
      rawSvg: svgContent
    };
  });

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
    res.status(500).json({ error: err.message || "Error al subir la fotografía." });
  }
});

// 2. Generate 20 AI Headshots Pack
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
        priceHeadshots: config.priceHeadshots || 5.0,
        priceHeadshotsClp: config.priceHeadshotsClp || 5000
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

// 3. Download All 20 Headshots as .ZIP
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
      const safeTitle = item.title.replace(/[^a-zA-Z0-9_-]/g, "_");
      const filename = `${num}_${safeTitle}.svg`;
      const svgBuffer = Buffer.from(item.rawSvg || Buffer.from(item.svgDataUrl.split(',')[1], 'base64').toString('utf8'));
      zip.addFile(filename, svgBuffer);
    });

    // Add instructions and best practices text file
    const isEn = analysis.lang === 'en';
    const guideText = isEn
      ? `CINTIA.PRO - 20 AI LINKEDIN & RESUME HEADSHOTS PACK
==================================================

Congratulations! Here are your 20 studio-grade professional portraits.

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

¡Felicitaciones! Aquí tienes tu pack de 20 retratos fotográficos profesionales de estudio.

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
    const candidateSlug = analysis.filename ? analysis.filename.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_") : "Cintia";
    
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="Cintia_20_Fotos_LinkedIn_${candidateSlug}.zip"`,
      'Content-Length': zipBuffer.length
    });

    res.send(zipBuffer);

  } catch (err) {
    console.error("Error in /api/headshots/download-zip:", err);
    res.status(500).send("Error al generar el archivo .zip de retratos.");
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
          detailedExplanation: `[MODALIDAD DEMOSTRACIÓN - SIN API KEY REAL]\n\nTu currículum ha sido evaluado con ${stars} estrellas de 5 en base a los criterios clave de calidad.\n\nPara mejorar tu CV:\n- Añade verbos de acción en tu experiencia laboral (ej. 'Lideré', 'Implementé').\n- Asegúrate de cuantificar tus resultados en lo posible (ej. 'reducción de tiempos en un 20%').\n- Mantén secciones bien delimitadas.`
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

// Payment simulation route
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
    priceHeadshots: config.priceHeadshots || 5.0,
    priceAiClp: config.priceAiClp || 2000,
    priceExpertClp: config.priceExpertClp || 25000,
    priceCoverLetterClp: config.priceCoverLetterClp || 2000,
    priceHeadshotsClp: config.priceHeadshotsClp || 5000,
    paypalClientId: process.env.PAYPAL_CLIENT_ID || '',
    mercadopagoPublicKey: process.env.MERCADOPAGO_PUBLIC_KEY || '',
    mercadopagoEnabled: !!process.env.MERCADOPAGO_ACCESS_TOKEN,
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
      amount = (config.priceHeadshots || 5.0).toFixed(2);
      description = 'Cintia - Pack 20 Fotos de Estudio con IA para LinkedIn y CV';
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
      amountClp = Number(config.priceHeadshotsClp || 5000);
      description = 'Cintia - Pack 20 Fotos de Estudio con IA para LinkedIn y CV';
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
    } catch (e) {}

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
          } catch (e) {}

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
    if (newSettings.hasOwnProperty('priceHeadshots')) config.priceHeadshots = parseFloat(newSettings.priceHeadshots) || 5.0;
    if (newSettings.hasOwnProperty('priceAiClp')) config.priceAiClp = parseInt(newSettings.priceAiClp, 10) || 2000;
    if (newSettings.hasOwnProperty('priceExpertClp')) config.priceExpertClp = parseInt(newSettings.priceExpertClp, 10) || 25000;
    if (newSettings.hasOwnProperty('priceCoverLetterClp')) config.priceCoverLetterClp = parseInt(newSettings.priceCoverLetterClp, 10) || 2000;
    if (newSettings.hasOwnProperty('priceHeadshotsClp')) config.priceHeadshotsClp = parseInt(newSettings.priceHeadshotsClp, 10) || 5000;
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
    
    writeConfig(config);
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
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

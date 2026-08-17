const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const AdmZip = require('adm-zip');
const admin = require('firebase-admin');
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

// Firebase Firestore Initializer
function initFirebase() {
  if (firestoreDb) return firestoreDb;
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      let serviceAccount;
      if (typeof process.env.FIREBASE_SERVICE_ACCOUNT === 'string') {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      } else {
        serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
      }
      
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });
      }
      firestoreDb = admin.firestore();
      console.log("Connected to Firebase Cloud Firestore successfully.");
      return firestoreDb;
    } catch (err) {
      console.error("Error initializing Firebase Firestore from FIREBASE_SERVICE_ACCOUNT:", err.message);
    }
  }
  return null;
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
      await dbFs.collection('analyses').doc(logEntry.id).set(logEntry);
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
  }
  
  const dbFs = initFirebase();
  if (dbFs) {
    try {
      await dbFs.collection('analyses').doc(analysisId).set(updateData, { merge: true });
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

async function getAdminData(config) {
  const dbFs = initFirebase();
  if (dbFs) {
    try {
      // Get visits
      const statsDoc = await dbFs.collection('app_stats').doc('general').get();
      const totalVisits = statsDoc.exists ? (statsDoc.data().visits || 0) : (readDb().visits || 0);

      // Get analyses
      const snap = await dbFs.collection('analyses').orderBy('uploadedAt', 'desc').limit(300).get();
      const analysesList = snap.docs.map(d => d.data());

      const totalAnalyses = analysesList.length;
      const paidAi = analysesList.filter(a => a.paymentStatus === 'completed_ai').length;
      const paidExpertPending = analysesList.filter(a => a.paymentStatus === 'pending_expert').length;
      const paidExpertCompleted = analysesList.filter(a => a.paymentStatus === 'completed_expert').length;
      const paidExpert = paidExpertPending + paidExpertCompleted;
      const totalRevenue = (paidAi * config.priceAi) + (paidExpert * config.priceExpert);

      const documentLog = analysesList.map(a => ({
        id: a.id,
        filename: a.filename,
        fileSize: a.fileSize,
        fileType: a.fileType,
        uploadedAt: a.uploadedAt,
        ip: a.ip,
        rating: a.rating,
        paymentStatus: a.paymentStatus,
        expertContact: a.expertContact
      }));

      return {
        stats: { totalVisits, totalAnalyses, paidAi, paidExpertPending, paidExpertCompleted, totalRevenue },
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
  const paidAi = analysesList.filter(a => a.paymentStatus === 'completed_ai').length;
  const paidExpertPending = analysesList.filter(a => a.paymentStatus === 'pending_expert').length;
  const paidExpertCompleted = analysesList.filter(a => a.paymentStatus === 'completed_expert').length;
  const paidExpert = paidExpertPending + paidExpertCompleted;
  const totalRevenue = (paidAi * config.priceAi) + (paidExpert * config.priceExpert);

  const documentLog = analysesList.map(a => ({
    id: a.id,
    filename: a.filename,
    fileSize: a.fileSize,
    fileType: a.fileType,
    uploadedAt: a.uploadedAt,
    ip: a.ip,
    rating: a.rating,
    paymentStatus: a.paymentStatus,
    expertContact: a.expertContact
  })).reverse();

  const geminiStats = await getGeminiStats(config);
  return {
    stats: { totalVisits, totalAnalyses, paidAi, paidExpertPending, paidExpertCompleted, totalRevenue, geminiStats },
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
      priceAi: 1.0,
      priceExpert: 25.0,
      optAiEnabled: false,
      optExpertEnabled: true,
      captchaEnabled: true,
      rateLimitPerHour: 20,
      evaluationPrompt: "Eres Cintia, la experta virtual de MelodIA Lab en reclutamiento y optimización de Currículums para superar filtros ATS (Applicant Tracking Systems). Analiza el siguiente texto de currículum vitae y evalúalo bajo estos 7 criterios clave:\n1. Compatibilidad ATS (estructura de secciones, legibilidad).\n2. Claridad de Talentos e Habilidades (habilidades duras, blandas y certificaciones).\n3. Extensión del Documento (máximo 2 páginas).\n4. Logros y Métricas Cuantificables (existencia de números, porcentajes o impactos cuantificados en la experiencia).\n5. Lenguaje y Verbos de Acción (uso de verbos activos y tono profesional persuasivo).\n6. Datos de Contacto y Enlaces (presencia de datos esenciales de contacto y enlaces clave como LinkedIn/Portafolio).\n7. Ortografía y Consistencia Gramatical (ausencia de errores y concordancia en tiempos verbales).\n\nCRÍTICO EN FECHAS Y CRONOLOGÍA:\nUtiliza la 'FECHA ACTUAL DEL SISTEMA' proporcionada al inicio del currículum como punto de referencia absoluto para determinar si una fecha del currículum es pasada, presente o futura. Presta especial atención a no generar falsos positivos con el orden de las experiencias pasadas. 'Actualidad' o 'Presente' son correctos y válidos. Revisa con rigor lógico las fechas y no reportes inconsistencias a menos que exista un solapamiento físicamente imposible o una contradicción temporal explícita.\n\nIDIOMA DE RESPUESTA:\nDebes responder en el mismo idioma en el que está escrito el currículum del usuario. Si el currículum está redactado en inglés, toda la retroalimentación, resumen y explicaciones detalladas deben redactarse estrictamente en Inglés (English). Si el currículum está redactado en español, toda la retroalimentación, resumen y explicaciones detalladas deben redactarse estrictamente en Español (Spanish).\n\nDevuelve la respuesta estrictamente en formato JSON con la siguiente estructura:\n{\n  \"stars\": (número entero de 1 a 5 para el puntaje global),\n  \"summary\": \"Resumen breve de la evaluación\",\n  \"atsCompatibility\": { \"stars\": (número entero de 1 a 5), \"feedback\": \"retroalimentación con marcadores **negrita** para conceptos clave\" },\n  \"skillsClarity\": { \"stars\": (número entero de 1 a 5), \"feedback\": \"retroalimentación con marcadores **negrita**\" },\n  \"lengthCheck\": { \"stars\": (número entero de 1 a 5), \"feedback\": \"retroalimentación con marcadores **negrita**\" },\n  \"quantifiableMetrics\": { \"stars\": (número entero de 1 a 5), \"feedback\": \"retroalimentación con marcadores **negrita**\" },\n  \"actionVerbs\": { \"stars\": (número entero de 1 a 5), \"feedback\": \"retroalimentación con marcadores **negrita**\" },\n  \"contactLinks\": { \"stars\": (número entero de 1 a 5), \"feedback\": \"retroalimentación con marcadores **negrita**\" },\n  \"grammarSpelling\": { \"stars\": (número entero de 1 a 5), \"feedback\": \"retroalimentación con marcadores **negrita**\" },\n  \"detailedExplanation\": \"Explicación detallada del porqué de la puntuación en estrellas y recomendaciones clave para mejorar.\"\n}",
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

// Captcha System (Stateless with AES encryption)
const CAPTCHA_SECRET = crypto.randomBytes(32).toString('hex');

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

  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 min
  const data = JSON.stringify({ answer: String(answer), expiresAt });
  
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.alloc(32, CAPTCHA_SECRET.substring(0, 32)), Buffer.alloc(16));
  let token = cipher.update(data, 'utf8', 'hex');
  token += cipher.final('hex');
  
  return { svg, token };
}

function verifyCaptcha(token, userInput) {
  try {
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.alloc(32, CAPTCHA_SECRET.substring(0, 32)), Buffer.alloc(16));
    let decrypted = decipher.update(token, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    const parsed = JSON.parse(decrypted);
    
    if (Date.now() > parsed.expiresAt) {
      return false; // Expired
    }
    return String(userInput).trim() === String(parsed.answer);
  } catch (err) {
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
    languageInstruction = "\n\nIDIOMA: Por favor genera el currículum optimizado y corregido estrictamente en INGLÉS (English).";
  } else {
    languageInstruction = "\n\nIDIOMA: Por favor genera el currículum optimizado y corregido estrictamente en ESPAÑOL (Spanish).";
  }
  const currentDate = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
  const rawResult = await callGemini(
    key,
    config.optimizationPrompt + languageInstruction,
    `FECHA ACTUAL DEL SISTEMA: ${currentDate}.\n\nCURRÍCULUM A OPTIMIZAR:\n\n${extractedText}`,
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
      const parsedPdf = await pdfParse(req.file.buffer);
      extractedText = parsedPdf.text;
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
      const languageText = lang === 'en' ? 'ENGLISH (Inglés)' : 'SPANISH (Español)';
      const systemInstruction = config.evaluationPrompt + `\n\nCRITICAL: You must translate and write all feedback text, summaries, and explanations in the JSON response strictly in ${languageText}.`;
      const analysisRaw = await callGemini(geminiApiKey, systemInstruction, `CURRÍCULUM:\n\n${extractedText}`, true);
      try {
        evaluation = JSON.parse(analysisRaw);
      } catch (parseErr) {
        evaluation = { stars: 3, summary: "Evaluación procesada con incidencias.", detailedExplanation: analysisRaw };
      }
    }

    // 6. Generate AI Optimization preview simultaneously
    let optimizedText = "";
    try {
      optimizedText = await generateAiOptimization(filename, extractedText, lang, config);
    } catch (optErr) {
      console.warn("Could not generate instant AI optimization during analyze, using fallback template:", optErr.message);
      optimizedText = await generateAiOptimization(filename, extractedText, lang, { geminiApiKey: '' });
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

    res.json({
      success: true,
      analysisId: analysisId,
      evaluation: evaluation,
      lang: lang,
      optimizedText: optimizedText
    });

  } catch (err) {
    console.error("Error during /api/analyze:", err);
    res.status(500).json({ error: err.message || "Error al procesar el currículum." });
  }
});

// Payment simulation route
app.post('/api/payment/simulate', async (req, res) => {
  try {
    const { analysisId, tier, paymentMethod, contact } = req.body;
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
    } else {
      res.status(400).json({ error: "Tier de pago inválido." });
    }

  } catch (err) {
    console.error("Error during /api/payment/simulate:", err);
    res.status(500).json({ error: err.message || "Error al procesar el pago." });
  }
});

// Public settings endpoint
app.get('/api/config', async (req, res) => {
  const config = await getConfigDoc();
  res.json({
    optAiEnabled: config.hasOwnProperty('optAiEnabled') ? !!config.optAiEnabled : true,
    optExpertEnabled: config.hasOwnProperty('optExpertEnabled') ? !!config.optExpertEnabled : true,
    priceAi: config.priceAi || 1.0,
    priceExpert: config.priceExpert || 25.0,
    paypalClientId: process.env.PAYPAL_CLIENT_ID || ''
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


// ─── PayPal Orders API v2 Integration ──────────────────────────────────────

// In-memory cache: maps PayPal orderID → { analysisId, analysis }
// Acts as a safety net in case Firestore/memory lookup fails in capture-order
// (Vercel can spin a new serverless instance between create-order and capture-order)
const paypalOrderCache = new Map();

// Helper: get PayPal OAuth2 access token
async function getPayPalAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_SECRET_KEY;
  const mode = (process.env.PAYPAL_MODE || 'sandbox').toLowerCase();
  const baseUrl = mode === 'live'
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
// Creates a PayPal order for the given tier (ai=$1, expert=$25)
app.post('/api/paypal/create-order', async (req, res) => {
  try {
    const { analysisId, tier } = req.body;
    if (!analysisId || !tier) {
      return res.status(400).json({ error: 'Faltan datos: analysisId y tier son requeridos.' });
    }

    const analysis = await getAnalysisDoc(analysisId);
    if (!analysis) {
      return res.status(404).json({ error: `Análisis no encontrado (id: ${analysisId}).` });
    }

    // Explicitly re-save to Firestore to guarantee capture-order can find it
    // (safety measure for Vercel serverless multi-instance environments)
    const dbFs = initFirebase();
    if (dbFs) {
      try {
        await dbFs.collection('analyses').doc(analysisId).set(analysis, { merge: true });
      } catch (fsErr) {
        console.warn('Firestore re-save warning in create-order:', fsErr.message);
      }
    }

    const config = await getConfigDoc();
    const amount = tier === 'ai'
      ? (config.priceAi || 1.0).toFixed(2)
      : (config.priceExpert || 25.0).toFixed(2);

    const description = tier === 'ai'
      ? 'Cintia - Optimización de CV con IA'
      : 'Cintia - Asesoría y Optimización por Experto Humano';

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
      const errBody = await orderResponse.text();
      throw new Error(`PayPal create-order error: ${orderResponse.status} - ${errBody}`);
    }

    const orderData = await orderResponse.json();

    // Cache analysis by orderID — fallback for capture-order on different instances
    paypalOrderCache.set(orderData.id, { analysisId, analysis });
    // Clean up old entries (keep max 200 pending orders in memory)
    if (paypalOrderCache.size > 200) {
      const firstKey = paypalOrderCache.keys().next().value;
      paypalOrderCache.delete(firstKey);
    }

    res.json({ orderID: orderData.id });

  } catch (err) {
    console.error('Error in /api/paypal/create-order:', err);
    res.status(500).json({ error: err.message || 'Error al crear la orden de pago.' });
  }
});

// POST /api/paypal/capture-order
// Captures the payment after PayPal approval. Handles AI unlock or expert registration.
app.post('/api/paypal/capture-order', async (req, res) => {
  try {
    const { orderID, analysisId, tier, contact } = req.body;
    if (!orderID || !analysisId || !tier) {
      return res.status(400).json({ error: 'Faltan datos: orderID, analysisId y tier son requeridos.' });
    }

    // Primary lookup: Firestore / local db
    let analysis = await getAnalysisDoc(analysisId);

    // Fallback: in-memory cache by orderID (for Vercel multi-instance scenarios)
    if (!analysis && paypalOrderCache.has(orderID)) {
      const cached = paypalOrderCache.get(orderID);
      if (cached.analysisId === analysisId) {
        analysis = cached.analysis;
        console.log(`[capture-order] Used orderCache fallback for analysisId=${analysisId}`);
      }
    }

    if (!analysis) {
      console.error(`[capture-order] Analysis not found: analysisId=${analysisId}, orderID=${orderID}`);
      return res.status(404).json({ error: `Análisis no encontrado (id: ${analysisId}). Por favor recarga la página y vuelve a intentarlo.` });
    }

    const { accessToken, baseUrl } = await getPayPalAccessToken();

    // Capture the payment with PayPal
    const captureResponse = await fetch(`${baseUrl}/v2/checkout/orders/${orderID}/capture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!captureResponse.ok) {
      const errBody = await captureResponse.text();
      throw new Error(`PayPal capture error: ${captureResponse.status} - ${errBody}`);
    }

    const captureData = await captureResponse.json();
    const captureStatus = captureData?.purchase_units?.[0]?.payments?.captures?.[0]?.status;

    if (captureStatus !== 'COMPLETED') {
      return res.status(402).json({ error: `Pago no completado. Estado PayPal: ${captureStatus}` });
    }

    const paypalTransactionId = captureData?.purchase_units?.[0]?.payments?.captures?.[0]?.id;

    // Clean up cache entry now that payment is confirmed
    paypalOrderCache.delete(orderID);

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
      await updateAnalysisDoc(analysisId, {
        paymentStatus: 'completed_ai',
        paymentMethod: 'paypal',
        paypalOrderId: orderID,
        paypalTransactionId,
        paidAt: new Date().toISOString(),
        optimizedText
      });
      recordGeminiCall('optimization');
      return res.json({ success: true, tier: 'ai', optimizedText });

    } else if (tier === 'expert') {
      await updateAnalysisDoc(analysisId, {
        paymentStatus: 'paid_expert',
        paymentMethod: 'paypal',
        paypalOrderId: orderID,
        paypalTransactionId,
        paidAt: new Date().toISOString(),
        expertContact: {
          email: contact?.email || '',
          phone: contact?.phone || '',
          requestedAt: new Date().toISOString()
        }
      });
      return res.json({
        success: true,
        tier: 'expert',
        message: '¡Pago completado! Un experto de Cintia te contactará en máximo 24 horas para coordinar tu sesión de asesoría.'
      });

    } else {
      return res.status(400).json({ error: 'Tier de pago inválido.' });
    }

  } catch (err) {
    console.error('Error in /api/paypal/capture-order:', err);
    res.status(500).json({ error: err.message || 'Error al capturar el pago.' });
  }
});

// ─── End PayPal Integration ─────────────────────────────────────────────────

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
  
  await updateAnalysisDoc(analysisId, { paymentStatus: 'completed_expert' });
  
  res.json({ success: true });
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
    if (newSettings.hasOwnProperty('priceAi')) config.priceAi = parseFloat(newSettings.priceAi) || 1.0;
    if (newSettings.hasOwnProperty('priceExpert')) config.priceExpert = parseFloat(newSettings.priceExpert) || 25.0;
    if (newSettings.hasOwnProperty('optAiEnabled')) config.optAiEnabled = !!newSettings.optAiEnabled;
    if (newSettings.hasOwnProperty('optExpertEnabled')) config.optExpertEnabled = !!newSettings.optExpertEnabled;
    if (newSettings.hasOwnProperty('captchaEnabled')) config.captchaEnabled = !!newSettings.captchaEnabled;
    if (newSettings.hasOwnProperty('rateLimitPerHour')) config.rateLimitPerHour = parseInt(newSettings.rateLimitPerHour, 10) || 5;
    if (newSettings.evaluationPrompt) config.evaluationPrompt = newSettings.evaluationPrompt;
    if (newSettings.optimizationPrompt) config.optimizationPrompt = newSettings.optimizationPrompt;
    
    writeConfig(config);
    res.json({ success: true, message: "Parámetros guardados correctamente." });
  } catch (err) {
    res.status(500).json({ error: "Error al guardar parámetros." });
  }
});

// Fallback for download file (optional helper if needed, we just serve text in dashboard)
app.get('/api/admin/download-text/:id', requireAdminAuth, async (req, res) => {
  const analysis = await getAnalysisDoc(req.params.id);
  if (!analysis) return res.status(404).send("No encontrado");
  
  res.setHeader('Content-disposition', `attachment; filename=cv_${analysis.filename}.txt`);
  res.setHeader('Content-type', 'text/plain; charset=utf-8');
  res.send(analysis.originalText);
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

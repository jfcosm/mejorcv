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

  return {
    stats: { totalVisits, totalAnalyses, paidAi, paidExpertPending, paidExpertCompleted, totalRevenue },
    documentLog
  };
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

// Active admin sessions in memory
const activeSessions = new Map();

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

// Gemini API integration
async function callGemini(apiKey, systemInstruction, promptContent, responseJson = false) {
  const key = apiKey || process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("Falta la configuración de Gemini API Key en el servidor. Contacte al administrador.");
  }
  
  const model = "gemini-2.5-flash";
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
    console.error("Gemini error payload:", errorText);
    throw new Error(`Gemini API respondió con código ${response.status}`);
  }
  
  const responseData = await response.json();
  try {
    return responseData.candidates[0].content.parts[0].text;
  } catch (err) {
    console.error("Failed to parse candidates in response:", responseData);
    throw new Error("Respuesta estructurada inválida de Gemini.");
  }
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

// Obscured Admin panel route
const ADMIN_ROUTE = process.env.ADMIN_ROUTE || '/cintia-private-dashboard';
app.get(ADMIN_ROUTE, (req, res) => {
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

// Analyze document
app.post('/api/analyze', upload.single('cv'), async (req, res) => {
  try {
    const config = readConfig();
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

    // 5. Call Gemini API to Analyze (with high-fidelity Mock fallback if key is missing)
    let evaluation = {};
    const key = config.geminiApiKey || process.env.GEMINI_API_KEY;
    
    if (!key) {
      console.log(`No Gemini API key found. Running in high-fidelity Demo Mock Mode for detected language: ${lang}`);
      const linesCount = extractedText.split('\n').length;
      const pageCount = Math.max(1, Math.ceil(linesCount / 40));
      const passedLength = pageCount <= 2;
      
      let ats = 65;
      if (extractedText.toLowerCase().includes('react') || extractedText.toLowerCase().includes('node') || extractedText.toLowerCase().includes('javascript')) ats += 15;
      if (extractedText.toLowerCase().includes('desarrollador') || extractedText.toLowerCase().includes('ingeniero') || extractedText.toLowerCase().includes('developer')) ats += 10;
      ats = Math.min(ats, 95);

      let skills = 60;
      if (extractedText.toLowerCase().includes('certificación') || extractedText.toLowerCase().includes('aws') || extractedText.toLowerCase().includes('scrum') || extractedText.toLowerCase().includes('docker') || extractedText.toLowerCase().includes('certification')) skills += 25;
      skills = Math.min(skills, 92);

      let metrics = 50;
      if (extractedText.match(/\d+%/g) || extractedText.match(/\d+\s*(USD|dólares|millones|dollars|percent)/gi)) metrics += 30;
      metrics = Math.min(metrics, 95);

      let action = 55;
      if (extractedText.toLowerCase().includes('lideré') || extractedText.toLowerCase().includes('desarrollé') || extractedText.toLowerCase().includes('optimicé') || extractedText.toLowerCase().includes('diseñé') || extractedText.toLowerCase().includes('led') || extractedText.toLowerCase().includes('developed') || extractedText.toLowerCase().includes('optimized') || extractedText.toLowerCase().includes('designed')) action += 30;
      action = Math.min(action, 95);

      let hasLinks = extractedText.toLowerCase().includes('linkedin') || extractedText.toLowerCase().includes('github') || extractedText.toLowerCase().includes('http');

      const toStars = (score) => Math.max(1, Math.min(5, Math.round(score / 20)));
      const stars = Math.max(1, Math.min(5, Math.round((ats + skills + metrics + action) / 4 / 20)));

      if (lang === 'en') {
        evaluation = {
          stars: stars,
          summary: `Resume analyzed in Demo Mode (without configured Gemini API key).`,
          atsCompatibility: {
            stars: toStars(ats),
            feedback: "General clean layout with **identifiable sections**. It is recommended to inject more direct keywords."
          },
          skillsClarity: {
            stars: toStars(skills),
            feedback: "Your technical skills are well-listed. Highlight your **official certifications** in the header section."
          },
          lengthCheck: {
            stars: passedLength ? 5 : 2,
            feedback: `Estimated length of **${pageCount} page(s)**. ${passedLength ? 'Complies with standard length recommendations.' : 'We recommend reducing content to fit in 2 pages.'}`
          },
          quantifiableMetrics: {
            stars: toStars(metrics),
            feedback: metrics > 70 
              ? "Excellent inclusion of **quantifiable metrics and impact** in your previous professional roles." 
              : "Most of the bullet points describe simple tasks rather than **measurable results** (percentages, revenue, timeframes)."
          },
          actionVerbs: {
            stars: toStars(action),
            feedback: action > 70
              ? "Superb usage of **strong action verbs** (e.g. led, designed, implemented)."
              : "We suggest replacing passive voice sentences with **first-person action verbs** to present yourself as highly assertive."
          },
          contactLinks: {
            stars: hasLinks ? 5 : 2,
            feedback: hasLinks
              ? "Presence of clean contact details and **professional hyperlinks** (LinkedIn or GitHub) verified."
              : "Basic contact details found, but lacks **direct links to active professional portfolios**."
          },
          grammarSpelling: {
            stars: 5,
            feedback: "Proper professional tone, grammatical consistency, and **no visible spelling mistakes** on first scan."
          },
          detailedExplanation: `[DEMO MODE - NO REAL API KEY CONFIGURED]\n\nYour resume has been evaluated with a rating of ${stars} out of 5 stars based on the 7 core quality criteria.\n\nTo improve your resume effectively:\n- Use active action verbs at the start of each bullet point (e.g., 'Led', 'Implemented', 'Optimized').\n- Ensure you quantify your achievements whenever possible (e.g., 'reduced processing time by 20%').\n- Keep distinct, standard sections: Professional Summary, Work Experience, Skills, Education.\n\nConfigure your API Key in the admin settings panel to get real-time evaluations and personalized optimization tips by Gemini.`
        };
      } else {
        evaluation = {
          stars: stars,
          summary: `CV analizado en modo demostración (sin API Key de Gemini configurada).`,
          atsCompatibility: {
            stars: toStars(ats),
            feedback: "Estructura general limpia con **secciones identificables**. Se sugiere añadir palabras clave más directas."
          },
          skillsClarity: {
            stars: toStars(skills),
            feedback: "Tus habilidades técnicas están bien listadas. Resalta tus **certificaciones oficiales** en la cabecera."
          },
          lengthCheck: {
            stars: passedLength ? 5 : 2,
            feedback: `Extensión estimada de **${pageCount} página(s)**. ${passedLength ? 'Cumple con el límite recomendado.' : 'Excede las 2 páginas.'}`
          },
          quantifiableMetrics: {
            stars: toStars(metrics),
            feedback: metrics > 70 
              ? "Excelente uso de **logros y métricas cuantificables** en tus roles laborales anteriores." 
              : "La mayoría de las viñetas describen tareas en lugar de **impacto cuantitativo** (porcentajes, montos, plazos)."
          },
          actionVerbs: {
            stars: toStars(action),
            feedback: action > 70
              ? "Uso idóneo de **verbos de acción e impacto** (ej. lideré, diseñé, ejecuté)."
              : "Se sugiere cambiar descripciones pasivas por **verbos en primera persona** para sonar más asertivo."
          },
          contactLinks: {
            stars: hasLinks ? 5 : 2,
            feedback: hasLinks
              ? "Presencia de datos básicos e **hipervínculos profesionales** (LinkedIn o Portafolio) detectada."
              : "Se encontraron datos de contacto pero faltan **enlaces directos a redes profesionales**."
          },
          grammarSpelling: {
            stars: 5,
            feedback: "Consistencia de tiempos verbales adecuada y sin **errores ortográficos visibles** en primera lectura."
          },
          detailedExplanation: `[MODALIDAD DEMOSTRACIÓN - SIN API KEY REAL]\n\nTu currículum ha sido evaluado con ${stars} estrellas de 5 en base a los 7 criterios clave de calidad.\n\nPara mejorar tu CV de manera efectiva:\n- Añade verbos de acción en tu experiencia laboral (ej. 'Lideré', 'Implementé', 'Optimicé').\n- Asegúrate de cuantificar tus resultados en lo posible (ej. 'reducción de tiempos en un 20%').\n- Mantén secciones bien delimitadas: Experiencia, Educación, Habilidades.\n\nConfigura tu API Key en la sección del administrador para obtener análisis y consejos detallados por IA.`
        };
      }
    } else {
      const currentDate = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
      const languageText = lang === 'en' ? 'ENGLISH (Inglés)' : 'SPANISH (Español)';
      const systemInstruction = config.evaluationPrompt + `\n\nCRITICAL: You must translate and write all feedback text, summaries, and explanations in the JSON response strictly in ${languageText}. Do not respond in Spanish if the language is English, and vice versa.`;
      
      const analysisRaw = await callGemini(
        config.geminiApiKey,
        systemInstruction,
        `FECHA ACTUAL DEL SISTEMA: ${currentDate}.\n\nCURRÍCULUM DEL USUARIO A ANALIZAR:\n\n${extractedText}`,
        true // Expect JSON
      );
      try {
        evaluation = JSON.parse(analysisRaw);
      } catch (parseErr) {
        console.error("Could not parse Gemini JSON response directly, raw response was:", analysisRaw);
        evaluation = {
          stars: 3,
          summary: "Evaluación procesada con incidencias menores en el formato.",
          atsCompatibility: { stars: 3, feedback: "Ajustar estructura general." },
          skillsClarity: { stars: 3, feedback: "Hacer más visibles certificaciones." },
          lengthCheck: { stars: 4, feedback: "Extensión aceptable." },
          quantifiableMetrics: { stars: 2, feedback: "Incluir más logros medibles." },
          actionVerbs: { stars: 3, feedback: "Usar verbos activos." },
          contactLinks: { stars: 4, feedback: "Información de contacto presente." },
          grammarSpelling: { stars: 3, feedback: "Revisar tiempos verbales." },
          detailedExplanation: analysisRaw
        };
      }
    }

    // 6. Log entry to db
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
      optimizedText: null,
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
      lang: lang
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
      // Perform instant AI optimization using Gemini (with high-fidelity Mock fallback if key is missing)
      const config = readConfig();
      const key = config.geminiApiKey || process.env.GEMINI_API_KEY;
      let optimizedText = "";

      if (!key) {
        console.log("No Gemini API key found for optimization. Running in high-fidelity Demo Mock Mode.");
        if (analysis.lang === 'en') {
          optimizedText = `# ${analysis.filename.replace(/\.[^/.]+$/, "").toUpperCase()} - OPTIMIZED BY CINTIA

## Professional Summary
Highly skilled Software Engineer with over 5 years of experience in the full software development lifecycle. Proficient in designing robust architectures and efficient APIs using modern tools. Experienced in performance tuning and leading development teams in agile environments.

---

## Key Professional Experience

### Senior Developer / Specialist | Industry Leader
* **Led** the backend architecture design and development, reducing service latency by **30%**.
* **Coordinated** full migration from legacy interfaces to responsive, dynamic architectures, enhancing user retention.
* **Synchronized** and deployed continuous integration and deployment (CI/CD) pipelines, decreasing deployment times.

---

## Technical Skills & Competencies
* **Backend Development:** Node.js, Express, RESTful APIs, JavaScript (ES6+), TypeScript.
* **Frontend Development:** React, HTML5, CSS3.
* **Database & Cloud:** PostgreSQL, MongoDB, AWS Services.
* **Tools & Methodologies:** Git, Docker, CI/CD, Scrum, Kanban.

---

## Education & Certifications
* **Bachelor's Degree** | Software Engineering / Computer Science
* **AWS Certified Solutions Architect** | AWS Cloud Platform
* **Certified ScrumMaster (CSM)** | Agile Project Management

> [!NOTE]
> *This document was optimized with active keywords and formatted in markdown for easy adjustments.*`;
        } else {
          optimizedText = `# ${analysis.filename.replace(/\.[^/.]+$/, "").toUpperCase()} - OPTIMIZADO POR CINTIA

## Resumen Profesional
Ingeniero de Software y especialista en desarrollo de soluciones tecnológicas con más de 5 años de trayectoria en el ciclo completo de software. Altamente capacitado en el diseño de arquitecturas robustas y APIs eficientes utilizando tecnologías modernas. Con experiencia en la optimización de rendimientos y el liderazgo de equipos de desarrollo bajo metodologías ágiles.

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

> [!NOTE]
> *Este documento ha sido optimizado con inyección de palabras clave activas e impacto directo para filtros ATS (Applicant Tracking Systems) y está formateado en markdown para su fácil edición.*`;
        }
      } else {
        let languageInstruction = "";
        if (analysis.lang === 'en') {
          languageInstruction = "\n\nIDIOMA: Por favor genera el currículum optimizado y corregido en INGLÉS (English) ya que el usuario seleccionó este idioma.";
        }
        const currentDate = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
        optimizedText = await callGemini(
          config.geminiApiKey,
          config.optimizationPrompt + languageInstruction,
          `FECHA ACTUAL DEL SISTEMA: ${currentDate}.\n\nCURRÍCULUM A OPTIMIZAR:\n\n${analysis.originalText}`,
          false // Expect markdown/text
        );
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
app.get('/api/config', (req, res) => {
  const config = readConfig();
  res.json({
    optAiEnabled: config.hasOwnProperty('optAiEnabled') ? !!config.optAiEnabled : true,
    optExpertEnabled: config.hasOwnProperty('optExpertEnabled') ? !!config.optExpertEnabled : true,
    priceAi: config.priceAi || 1.0,
    priceExpert: config.priceExpert || 25.0
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
  if (!token || !activeSessions.has(token)) {
    return res.status(401).json({ error: "No autorizado." });
  }
  const expiresAt = activeSessions.get(token);
  if (Date.now() > expiresAt) {
    activeSessions.delete(token);
    return res.status(401).json({ error: "Sesión expirada." });
  }
  // Extend session
  activeSessions.set(token, Date.now() + 2 * 60 * 60 * 1000);
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
    const token = crypto.randomBytes(32).toString('hex');
    activeSessions.set(token, Date.now() + 2 * 60 * 60 * 1000); // 2 hours
    res.json({ success: true, token });
  } else {
    registerAdminLoginAttempt(clientIp, false);
    res.status(401).json({ error: "Credenciales incorrectas." });
  }
});

// Admin logout
app.post('/api/admin/logout', (req, res) => {
  const token = req.headers['authorization'];
  if (token) {
    activeSessions.delete(token);
  }
  res.json({ success: true });
});

// Admin stats
app.get('/api/admin/stats', requireAdminAuth, async (req, res) => {
  const config = readConfig();
  const adminData = await getAdminData(config);
  res.json(adminData);
});

// Mark expert review as completed
app.post('/api/admin/expert-complete', requireAdminAuth, async (req, res) => {
  const { analysisId } = req.body;
  if (!analysisId) return res.status(400).json({ error: "ID faltante" });
  
  await updateAnalysisDoc(analysisId, { paymentStatus: 'completed_expert' });
  
  res.json({ success: true });
});

// Get admin settings
app.get('/api/admin/settings', requireAdminAuth, (req, res) => {
  const config = readConfig();
  const secureConfig = { ...config };
  
  // Mask the API Key to protect it from exposure
  if (secureConfig.geminiApiKey) {
    secureConfig.geminiApiKey = '••••••••' + secureConfig.geminiApiKey.slice(-4);
  } else {
    secureConfig.geminiApiKey = '';
  }
  
  // Omit password from responses for safety
  delete secureConfig.adminPassword;
  
  res.json(secureConfig);
});

// Update admin settings
app.post('/api/admin/settings', requireAdminAuth, (req, res) => {
  try {
    const newSettings = req.body;
    const config = readConfig();
    
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

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const cvForm = document.getElementById('cvForm');
  const dropZone = document.getElementById('dropZone');
  const cvFileInput = document.getElementById('cvFileInput');
  const selectedFileContainer = document.getElementById('selectedFileContainer');
  const fileNameDisplay = document.getElementById('fileNameDisplay');
  const fileSizeDisplay = document.getElementById('fileSizeDisplay');
  const removeFileBtn = document.getElementById('removeFileBtn');
  
  const captchaContainer = document.getElementById('captchaContainer');
  const captchaImageWrapper = document.getElementById('captchaImageWrapper');
  const captchaInput = document.getElementById('captchaInput');
  const refreshCaptchaBtn = document.getElementById('refreshCaptchaBtn');
  
  const submitBtn = document.getElementById('submitBtn');
  const errorBanner = document.getElementById('errorBanner');
  const uploadWrapper = document.getElementById('uploadWrapper');
  
  const loadingWrapper = document.getElementById('loadingWrapper');
  const loadingStatus = document.getElementById('loadingStatus');
  const loadingSteps = document.getElementById('loadingSteps');
  
  const resultsSection = document.getElementById('resultsSection');
  const starsRating = document.getElementById('starsRating');
  const resultsSummary = document.getElementById('resultsSummary');
  const critiqueGrid = document.getElementById('critiqueGrid');
  const detailedExplanationText = document.getElementById('detailedExplanationText');
  
  const optimizeAiBtn = document.getElementById('optimizeAiBtn');
  const optimizeExpertBtn = document.getElementById('optimizeExpertBtn');
  const expertEmail = document.getElementById('expertEmail');
  const expertPhone = document.getElementById('expertPhone');
  
  const checkoutModal = document.getElementById('checkoutModal');
  const checkoutTitle = document.getElementById('checkoutTitle');
  const checkoutService = document.getElementById('checkoutService');
  const checkoutPriceOriginal = document.getElementById('checkoutPriceOriginal');
  const checkoutTotal = document.getElementById('checkoutTotal');
  const closeModalBtn = document.getElementById('closeModalBtn');
  
  const paymentMethodsView = document.getElementById('paymentMethodsView');
  const payPaypalBtn = document.getElementById('payPaypalBtn');
  
  const successPaymentView = document.getElementById('successPaymentView');
  const successPaymentMessage = document.getElementById('successPaymentMessage');
  const successPaymentIcon = document.getElementById('successPaymentIcon');
  const successPaymentSpinner = document.getElementById('successPaymentSpinner');
  const successPaymentTitle = document.getElementById('successPaymentTitle');
  
  const optimizedOutputContainer = document.getElementById('optimizedOutputContainer');
  const optimizedContentBox = document.getElementById('optimizedContentBox');
  const copyCvBtn = document.getElementById('copyCvBtn');
  const downloadCvBtn = document.getElementById('downloadCvBtn');
  
  const langSelector = document.getElementById('langSelector');

  // Application Dictionaries & State
  let activeFile = null;
  let captchaToken = null;
  let captchaEnabled = true;
  let currentAnalysisId = null;
  let currentTier = null; // 'ai' or 'expert'
  let optimizedContentText = '';
  let currentLanguage = localStorage.getItem('cvLang') || 'es';

  let appConfig = {
    optAiEnabled: false,
    optExpertEnabled: true,
    priceAi: 1.0,
    priceExpert: 25.0
  };

  const translations = {
    es: {
      navHome: "Inicio",
      navAdmin: "Panel Administrador",
      heroTitle: "Deja que <span>Cintia</span> perfeccione tu Currículum Vitae",
      heroDesc: "¿Sientes que envías tu CV y nadie te responde? Muchos currículums quedan descartados de forma automática por filtros invisibles (ATS). Sube tu currículum gratis: Cintia analizará cómo lo leen los reclutadores, te guiará con recomendaciones empáticas y te ayudará a brillar para conseguir esa entrevista que mereces.",
      uploadTitle: "Arrastra tu currículum aquí",
      uploadHint: "Formatos aceptados: .pdf, .docx, .odt, .txt (Menos de 5 MB)",
      captchaLabel: "Medida anti-abuso: Verifica que eres humano",
      captchaPlaceholder: "Resultado",
      captchaRefresh: "Recargar",
      submitBtn: "Analizar CV Gratis",
      loadingStatus: "Cintia está analizando tu Currículum...",
      step1: "Cintia está extrayendo el texto del documento...",
      step2: "Cintia está evaluando la estructura bajo estándares ATS...",
      step3: "Cintia está analizando la claridad de capacidades y certificaciones...",
      step4: "Cintia está verificando la extensión de páginas...",
      step5: "Cintia está generando el informe de calidad...",
      resultsTitle: "Evaluación de Cintia",
      critiqueExplanationTitle: "Explicación del Puntaje",
      pricingTitle: "¿Quieres que Cintia optimice tu CV para conseguir más entrevistas?",
      pricingSubtitle: "Cintia reescribirá tu perfil, inyectará palabras clave estratégicas y maximizará la compatibilidad ATS al instante.",
      aiPlanName: "Optimización con IA",
      aiPlanPriceUnit: "USD / pago único",
      aiPlanF1: "Reescritura inmediata de Cintia",
      aiPlanF2: "Inyección de palabras clave ATS",
      aiPlanF3: "Reorganización de habilidades y perfil",
      aiPlanF4: "Descarga inmediata en texto/markdown",
      aiPlanBtn: "Optimizar con IA",
      expertPlanName: "Optimización Manual",
      expertPlanPriceUnit: "USD / por entrega",
      expertEmailLabel: "Correo Electrónico",
      expertPhoneLabel: "Número de Celular o WhatsApp",
      expertPlanF1: "Revisión por experto de Recursos Humanos",
      expertPlanF2: "Rediseño visual a medida",
      expertPlanF3: "Asesoría en llamadas/chat",
      expertPlanF4: "Entrega final en PDF y Word editable",
      expertPlanBtn: "Solicitar Asistencia de Experto",
      optimizedTitle: "Currículum Optimizado por Cintia",
      copyBtn: "Copiar Texto",
      downloadBtn: "Descargar .txt",
      modalTitle: "Pagar servicio",
      modalTax: "Impuestos",
      modalTotal: "Total a pagar",
      modalPayCard: "Tarjeta de Crédito / Débito",
      modalSuccessTitle: "¡Pago Completado!",
      modalSuccessMessage: "Tu pago ha sido procesado correctamente. Cintia está procesando el documento...",
      footerCopyright: "&copy; 2026 Cintia. Todos los derechos reservados. Tecnología basada en Google Gemini.",
      footerCredits: "With ❤️ and ⚡ by <a href=\"https://www.melodialab.net\" target=\"_blank\" style=\"color: #e65c00; text-decoration: none; font-weight: 600;\">OrangeVibe</a>",
      howItWorksTitle: "¿Cómo funciona Cintia?",
      step1Title: "1. Sube tu Currículum",
      step1Desc: "Sube tu archivo (.pdf, .docx, .odt o .txt) de manera 100% segura. Cintia leerá y extraerá tu texto al instante.",
      step2Title: "2. Obtén un Diagnóstico Honesto",
      step2Desc: "Descubre qué puntaje obtienes frente a los algoritmos ATS y lee consejos detallados para corregir errores invisibles.",
      step3Title: "3. Optimiza y Destaca",
      step3Desc: "Elige mejorar tu redacción con nuestra Inteligencia Artificial o solicita la ayuda personalizada de un experto humano."
    },
    en: {
      navHome: "Home",
      navAdmin: "Admin Panel",
      heroTitle: "Let <span>Cintia</span> perfect your Resume",
      heroDesc: "Sending out resumes and hearing only silence? Many applications are filtered out automatically by invisible recruitment software (ATS). Upload your CV for free: Cintia will reveal exactly how recruiters see your profile, provide supportive guidance, and help you stand out to land the interviews you deserve.",
      uploadTitle: "Drag your resume here",
      uploadHint: "Accepted formats: .pdf, .docx, .odt, .txt (Under 5 MB)",
      captchaLabel: "Anti-abuse measure: Verify you are human",
      captchaPlaceholder: "Result",
      captchaRefresh: "Reload",
      submitBtn: "Analyze CV for Free",
      loadingStatus: "Cintia is analyzing your Resume...",
      step1: "Cintia is extracting text from document...",
      step2: "Cintia is evaluating structure under ATS standards...",
      step3: "Cintia is analyzing clarity of skills and certifications...",
      step4: "Cintia is verifying page limits...",
      step5: "Cintia is generating quality report...",
      resultsTitle: "Cintia's Evaluation",
      critiqueExplanationTitle: "Score Explanation",
      pricingTitle: "Want Cintia to optimize your CV to get more interviews?",
      pricingSubtitle: "Cintia will rewrite your profile, inject key ATS terms, and maximize compatibility instantly.",
      aiPlanName: "AI Optimization",
      aiPlanPriceUnit: "USD / one-time payment",
      aiPlanF1: "Cintia's instant profile rewriting",
      aiPlanF2: "ATS keyword injection",
      aiPlanF3: "Reorganization of skills and profile",
      aiPlanF4: "Immediate download in text/markdown",
      aiPlanBtn: "Optimize with AI",
      expertPlanName: "Manual Optimization",
      expertPlanPriceUnit: "USD / per delivery",
      expertEmailLabel: "Email Address",
      expertPhoneLabel: "Cell Phone or WhatsApp Number",
      expertPlanF1: "Review by Human Resources expert",
      expertPlanF2: "Tailored visual redesign",
      expertPlanF3: "Consulting via call/chat",
      expertPlanF4: "Final delivery in PDF and editable Word",
      expertPlanBtn: "Request Expert Assistance",
      optimizedTitle: "Resume Optimized by Cintia",
      copyBtn: "Copy Text",
      downloadBtn: "Download .txt",
      modalTitle: "Pay service",
      modalTax: "Taxes",
      modalTotal: "Total to pay",
      modalPayCard: "Credit / Debit Card",
      modalSuccessTitle: "Payment Completed!",
      modalSuccessMessage: "Your payment has been successfully processed. Cintia is processing document...",
      footerCopyright: "&copy; 2026 Cintia. All rights reserved. Powered by Google Gemini.",
      footerCredits: "With ❤️ and ⚡ by <a href=\"https://www.melodialab.net\" target=\"_blank\" style=\"color: #e65c00; text-decoration: none; font-weight: 600;\">OrangeVibe</a>",
      howItWorksTitle: "How Cintia Works",
      step1Title: "1. Upload Your Resume",
      step1Desc: "Upload your file (.pdf, .docx, .odt or .txt) 100% securely. Cintia will immediately read and analyze your details.",
      step2Title: "2. Get an Honest Diagnostic",
      step2Desc: "Receive a transparent rating and detailed recommendations matching ATS algorithms and recruiter standards.",
      step3Title: "3. Optimize & Stand Out",
      step3Desc: "Upgrade your resume instantly using AI or request manual assistance from a human expert. Make your talent visible!"
    }
  };

  // Language Setup
  langSelector.value = currentLanguage;
  applyLanguage(currentLanguage);

  langSelector.addEventListener('change', (e) => {
    const selected = e.target.value;
    localStorage.setItem('cvLang', selected);
    applyLanguage(selected);
    // Reload captcha text language
    loadCaptcha();
  });

  function applyLanguage(lang) {
    currentLanguage = lang;
    const t = translations[lang];
    
    // Update labels
    document.getElementById('navHome').textContent = t.navHome;
    const navAdminEl = document.getElementById('navAdmin');
    if (navAdminEl) navAdminEl.textContent = t.navAdmin;
    
    document.querySelector('.hero h1').innerHTML = t.heroTitle;
    document.querySelector('.hero p').textContent = t.heroDesc;
    
    document.querySelector('.upload-title').textContent = t.uploadTitle;
    document.querySelector('.upload-hint').textContent = t.uploadHint;
    
    document.querySelector('.captcha-label').textContent = t.captchaLabel;
    document.getElementById('captchaInput').placeholder = t.captchaPlaceholder;
    document.getElementById('refreshCaptchaBtn').textContent = t.captchaRefresh;
    
    document.getElementById('submitBtn').textContent = t.submitBtn;
    
    document.getElementById('loadingStatus').textContent = t.loadingStatus;
    document.getElementById('step1').textContent = t.step1;
    document.getElementById('step2').textContent = t.step2;
    document.getElementById('step3').textContent = t.step3;
    document.getElementById('step4').textContent = t.step4;
    document.getElementById('step5').textContent = t.step5;
    
    document.querySelector('#resultsSection .results-header h2').textContent = t.resultsTitle;
    document.querySelector('.detailed-explanation h3').textContent = t.critiqueExplanationTitle;
    
    document.querySelector('.pricing-title').textContent = t.pricingTitle;
    document.querySelector('.pricing-subtitle').textContent = t.pricingSubtitle;
    
    // How it Works Section dynamic translations
    const howItWorksTitleEl = document.getElementById('howItWorksTitle');
    if (howItWorksTitleEl) howItWorksTitleEl.textContent = t.howItWorksTitle;
    const step1TitleEl = document.getElementById('step1Title');
    if (step1TitleEl) step1TitleEl.textContent = t.step1Title;
    const step1DescEl = document.getElementById('step1Desc');
    if (step1DescEl) step1DescEl.textContent = t.step1Desc;
    const step2TitleEl = document.getElementById('step2Title');
    if (step2TitleEl) step2TitleEl.textContent = t.step2Title;
    const step2DescEl = document.getElementById('step2Desc');
    if (step2DescEl) step2DescEl.textContent = t.step2Desc;
    const step3TitleEl = document.getElementById('step3Title');
    if (step3TitleEl) step3TitleEl.textContent = t.step3Title;
    const step3DescEl = document.getElementById('step3Desc');
    if (step3DescEl) step3DescEl.textContent = t.step3Desc;
    
    // Plans Cards
    const cards = document.querySelectorAll('.plan-card');
    if (cards.length >= 2) {
      // AI
      cards[0].querySelector('.plan-name').textContent = t.aiPlanName;
      const aiFeatures = cards[0].querySelectorAll('.plan-features li');
      if (aiFeatures.length >= 4) {
        const checkIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg> `;
        aiFeatures[0].innerHTML = checkIcon + t.aiPlanF1;
        aiFeatures[1].innerHTML = checkIcon + t.aiPlanF2;
        aiFeatures[2].innerHTML = checkIcon + t.aiPlanF3;
        aiFeatures[3].innerHTML = checkIcon + t.aiPlanF4;
      }
      
      // Expert
      cards[1].querySelector('.plan-name').textContent = t.expertPlanName;
      cards[1].querySelectorAll('.plan-input-group label')[0].textContent = t.expertEmailLabel;
      cards[1].querySelectorAll('.plan-input-group label')[1].textContent = t.expertPhoneLabel;
      const expFeatures = cards[1].querySelectorAll('.plan-features li');
      if (expFeatures.length >= 4) {
        const checkIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg> `;
        expFeatures[0].innerHTML = checkIcon + t.expertPlanF1;
        expFeatures[1].innerHTML = checkIcon + t.expertPlanF2;
        expFeatures[2].innerHTML = checkIcon + t.expertPlanF3;
        expFeatures[3].innerHTML = checkIcon + t.expertPlanF4;
      }
    }
    
    // Output Panel
    document.querySelector('.optimized-title').textContent = t.optimizedTitle;
    
    document.getElementById('copyCvBtn').innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg> ${t.copyBtn}`;
      
    document.getElementById('downloadCvBtn').innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="7 10 12 15 17 10"></polyline>
        <line x1="12" y1="15" x2="12" y2="3"></line>
      </svg> ${t.downloadBtn}`;
    
    // Modal
    document.getElementById('checkoutTitle').textContent = t.modalTitle;
    document.querySelectorAll('.checkout-row')[1].querySelectorAll('span')[0].textContent = t.modalTax;
    document.querySelectorAll('.checkout-row')[2].querySelectorAll('span')[0].textContent = t.modalTotal;
    document.querySelector('#successPaymentView h3').textContent = t.modalSuccessTitle;
    
    // Footer
    document.getElementById('footerCopyright').innerHTML = t.footerCopyright;
    document.getElementById('footerCredits').innerHTML = t.footerCredits;

    // Apply configuration UI overrides
    applyConfigToUi();
  }

  // Fetch Public Config Parameters on Load
  async function fetchConfig() {
    try {
      const response = await fetch('/api/config');
      const data = await response.json();
      appConfig = data;
      applyConfigToUi();
    } catch (err) {
      console.error('Error fetching config:', err);
    }
  }

  function applyConfigToUi() {
    const pricingSection = document.getElementById('pricingSection');
    const aiPlanCard = document.getElementById('aiPlanCard');
    const expertPlanCard = document.getElementById('expertPlanCard');
    
    if (aiPlanCard) {
      aiPlanCard.querySelector('.plan-price').innerHTML = `$${appConfig.priceAi} <span>USD / ${currentLanguage === 'en' ? 'one-time payment' : 'pago único'}</span>`;
      document.getElementById('optimizeAiBtn').textContent = currentLanguage === 'en' 
        ? `Optimize with AI for $${appConfig.priceAi} USD` 
        : `Optimizar con IA por $${appConfig.priceAi} USD`;
    }
    
    if (expertPlanCard) {
      expertPlanCard.querySelector('.plan-price').innerHTML = `$${appConfig.priceExpert} <span>USD / ${currentLanguage === 'en' ? 'per delivery' : 'por entrega'}</span>`;
      document.getElementById('optimizeExpertBtn').textContent = currentLanguage === 'en'
        ? `Request Expert Assistance`
        : `Solicitar Asistencia de Experto`;
    }

    if (!appConfig.optAiEnabled && !appConfig.optExpertEnabled) {
      pricingSection.style.display = 'none';
    } else {
      pricingSection.style.display = 'block';
      if (aiPlanCard) aiPlanCard.style.display = appConfig.optAiEnabled ? 'block' : 'none';
      if (expertPlanCard) expertPlanCard.style.display = appConfig.optExpertEnabled ? 'block' : 'none';
    }
  }

  // Load configuration parameters
  fetchConfig();

  // 1. Captcha Handlers
  async function loadCaptcha() {
    try {
      const response = await fetch('/api/captcha');
      const data = await response.json();
      
      captchaEnabled = data.enabled;
      if (captchaEnabled) {
        captchaContainer.style.display = 'flex';
        captchaImageWrapper.innerHTML = data.svg;
        captchaToken = data.token;
        captchaInput.value = '';
      } else {
        captchaContainer.style.display = 'none';
        captchaInput.removeAttribute('required');
      }
    } catch (err) {
      console.error('Error loading captcha:', err);
      showError(currentLanguage === 'en' ? 'Error loading captcha.' : 'Error al cargar la imagen captcha.');
    }
  }

  loadCaptcha();
  captchaImageWrapper.addEventListener('click', loadCaptcha);
  refreshCaptchaBtn.addEventListener('click', loadCaptcha);

  // 2. Drag & Drop Upload Handlers
  dropZone.addEventListener('click', () => cvFileInput.click());

  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
    }, false);
  });

  dropZone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  });

  cvFileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  });

  function handleFile(file) {
    const validExtensions = ['.pdf', '.docx', '.odt', '.txt'];
    const filename = file.name;
    const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
    
    if (!validExtensions.includes(ext)) {
      showError(currentLanguage === 'en' 
        ? 'Invalid format. Please upload a .pdf, .docx, .odt or .txt file.' 
        : 'Formato inválido. Sube un archivo .pdf, .docx, .odt o .txt');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showError(currentLanguage === 'en' 
        ? 'File exceeds 5 MB size limit.' 
        : 'El archivo excede el tamaño máximo permitido de 5 MB.');
      return;
    }

    // Set file
    activeFile = file;
    hideError();

    // Display File UI
    fileNameDisplay.textContent = file.name;
    fileSizeDisplay.textContent = formatBytes(file.size);
    dropZone.style.display = 'none';
    selectedFileContainer.style.display = 'flex';
  }

  removeFileBtn.addEventListener('click', () => {
    activeFile = null;
    cvFileInput.value = '';
    selectedFileContainer.style.display = 'none';
    dropZone.style.display = 'block';
  });

  function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // 3. Error Banner Helpers
  function showError(msg) {
    errorBanner.textContent = msg;
    errorBanner.style.display = 'block';
    errorBanner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function hideError() {
    errorBanner.style.display = 'none';
  }

  // 4. Form Submit & Progress Animation
  cvForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();

    if (!activeFile) {
      showError(currentLanguage === 'en' ? 'Please select a resume file.' : 'Por favor selecciona un archivo de currículum.');
      return;
    }

    // Capture values
    const answer = captchaInput.value;
    const token = captchaToken;

    // Transition to loading
    uploadWrapper.style.display = 'none';
    loadingWrapper.style.display = 'flex';
    resultsSection.style.display = 'none';
    optimizedOutputContainer.style.display = 'none';

    // Mock progress steps increments for aesthetic value
    const steps = loadingSteps.querySelectorAll('li');
    let currentStepIdx = 0;
    
    // Reset steps state
    steps.forEach((s, idx) => {
      s.className = idx === 0 ? 'active' : '';
      s.style.opacity = idx === 0 ? '1' : '0.4';
    });
    
    const progressInterval = setInterval(() => {
      if (currentStepIdx < steps.length - 1) {
        steps[currentStepIdx].classList.remove('active');
        steps[currentStepIdx].style.opacity = '0.5';
        
        currentStepIdx++;
        steps[currentStepIdx].classList.add('active');
        steps[currentStepIdx].style.opacity = '1';
      }
    }, 1500);

    // Call API
    const formData = new FormData();
    formData.append('cv', activeFile);
    formData.append('lang', currentLanguage); // Send language parameter
    
    if (captchaEnabled) {
      formData.append('captchaToken', token);
      formData.append('captchaAnswer', answer);
    }

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      clearInterval(progressInterval);

      if (!response.ok) {
        throw new Error(data.error || (currentLanguage === 'en' ? 'Error parsing analysis.' : 'Error al procesar el análisis.'));
      }

      // Render Results
      currentAnalysisId = data.analysisId;
      renderEvaluation(data.evaluation);

      // Hide loading / show results
      loadingWrapper.style.display = 'none';
      resultsSection.style.display = 'block';
      resultsSection.scrollIntoView({ behavior: 'smooth' });

    } catch (err) {
      clearInterval(progressInterval);
      loadingWrapper.style.display = 'none';
      uploadWrapper.style.display = 'block';
      loadCaptcha();
      showError(err.message);
    }
  });

  // 5. Render Evaluation Results
  function renderEvaluation(evalData) {
    // Render Stars rating
    starsRating.innerHTML = '';
    const starsCount = evalData.stars || 3;
    for (let i = 1; i <= 5; i++) {
      const isFilled = i <= starsCount;
      starsRating.innerHTML += `
        <svg class="star-icon ${isFilled ? 'filled' : ''}" viewBox="0 0 24 24">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
        </svg>
      `;
    }

    // Set text summaries
    resultsSummary.textContent = evalData.summary || 'Quality Evaluation';
    
    // Inyectar dinámicamente los 7 criterios de calidad con títulos traducidos
    const isEn = currentLanguage === 'en';
    const criteriaMapping = {
      atsCompatibility: { title: isEn ? 'ATS Compatibility' : 'Compatibilidad ATS' },
      skillsClarity: { title: isEn ? 'Talent Clarity' : 'Claridad de Talentos' },
      lengthCheck: { title: isEn ? 'Page Length (<= 2 pgs)' : 'Extensión (<= 2 pág)' },
      quantifiableMetrics: { title: isEn ? 'Quantifiable Metrics' : 'Métricas Cuantificables' },
      actionVerbs: { title: isEn ? 'Action Verbs' : 'Verbos de Acción' },
      contactLinks: { title: isEn ? 'Contact & Links' : 'Contacto y Enlaces' },
      grammarSpelling: { title: isEn ? 'Grammar & Spelling' : 'Ortografía y Gramática' }
    };

    critiqueGrid.innerHTML = '';
    
    for (const [key, config] of Object.entries(criteriaMapping)) {
      const data = evalData[key];
      if (!data) continue;
      
      // Standardize rating to 1-5 stars scale
      const starsValue = data.stars || 3;
      let starsHtml = '<div class="critique-stars">';
      for (let i = 1; i <= 5; i++) {
        const isFilled = i <= starsValue;
        starsHtml += `
          <svg class="star-icon ${isFilled ? 'filled' : ''}" viewBox="0 0 24 24">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
          </svg>
        `;
      }
      starsHtml += '</div>';
      
      critiqueGrid.innerHTML += `
        <div class="critique-item">
          <div class="critique-title">${config.title}</div>
          ${starsHtml}
          <div class="critique-feedback">${parseFeedbackMarkdown(data.feedback)}</div>
        </div>
      `;
    }
    
    // Parse detailed explanation markdown to clean HTML bold tags
    detailedExplanationText.innerHTML = parseFeedbackMarkdown(evalData.detailedExplanation);
  }

  // 6. Pricing Plan Actions & Custom checkoutModal Flow
  optimizeAiBtn.addEventListener('click', () => {
    currentTier = 'ai';
    openCheckout(
      currentLanguage === 'en' ? 'Instant AI CV Optimization' : 'Optimización instantánea con IA', 
      appConfig.priceAi.toFixed(2)
    );
  });

  // Direct Expert Request submission (no checkout payments dialog)
  optimizeExpertBtn.addEventListener('click', async () => {
    hideError();
    const email = expertEmail.value.trim();
    const phone = expertPhone.value.trim();

    if (!email && !phone) {
      showError(currentLanguage === 'en' 
        ? 'Please provide at least your email or WhatsApp/Phone number so Cintia can contact you.' 
        : 'Por favor, proporciona al menos tu correo o tu WhatsApp/Teléfono para que Cintia te contacte.');
      return;
    }

    optimizeExpertBtn.disabled = true;
    const originalText = optimizeExpertBtn.textContent;
    optimizeExpertBtn.textContent = currentLanguage === 'en' ? 'Sending...' : 'Enviando...';

    try {
      const response = await fetch('/api/expert-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysisId: currentAnalysisId,
          email: email,
          phone: phone
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Error processing request');
      }

      // Display the success checkout popup directly
      checkoutTitle.textContent = currentLanguage === 'en' ? 'Expert Assistance' : 'Asistencia de Experto';
      checkoutService.textContent = currentLanguage === 'en' ? 'Manual expert review' : 'Revisión por experto';
      checkoutPriceOriginal.textContent = `$${appConfig.priceExpert.toFixed(2)} USD`;
      checkoutTotal.textContent = `$${appConfig.priceExpert.toFixed(2)} USD`;
      
      paymentMethodsView.style.display = 'none';
      successPaymentView.style.display = 'flex';
      
      // Ensure icon is visible and spinner is hidden
      successPaymentIcon.style.display = 'block';
      successPaymentSpinner.style.display = 'none';
      successPaymentTitle.textContent = currentLanguage === 'en' ? 'Request Registered!' : '¡Solicitud Registrada!';
      successPaymentMessage.textContent = currentLanguage === 'en'
        ? 'Request successfully registered! Cintia will contact you soon via email or WhatsApp to coordinate your expert assistance.'
        : '¡Solicitud registrada con éxito! Tu solicitud ha sido enviada. Cintia te contactará pronto por correo o WhatsApp para coordinar la asistencia del experto.';

      checkoutModal.showModal();

      // Clear inputs
      expertEmail.value = '';
      expertPhone.value = '';

    } catch (err) {
      showError(err.message);
    } finally {
      optimizeExpertBtn.disabled = false;
      optimizeExpertBtn.textContent = originalText;
    }
  });

  function openCheckout(serviceName, priceStr) {
    hideError();
    checkoutTitle.textContent = currentLanguage === 'en' ? `Pay: ${serviceName}` : `Pagar: ${serviceName}`;
    checkoutService.textContent = serviceName;
    checkoutPriceOriginal.textContent = `$${priceStr} USD`;
    checkoutTotal.textContent = `$${priceStr} USD`;
    
    // Reset Modal View to show payment buttons (Paypal only)
    paymentMethodsView.style.display = 'flex';
    successPaymentView.style.display = 'none';
    
    // Reset success view subelements
    successPaymentIcon.style.display = 'block';
    successPaymentSpinner.style.display = 'none';
    successPaymentTitle.textContent = currentLanguage === 'en' ? 'Payment Completed!' : '¡Pago Completado!';

    checkoutModal.showModal();
  }

  closeModalBtn.addEventListener('click', () => {
    checkoutModal.close();
  });

  // Handle outside clicks to close modal
  checkoutModal.addEventListener('click', (e) => {
    if (e.target === checkoutModal) {
      checkoutModal.close();
    }
  });

  // 7. Payment Simulation Click Handler
  async function executePaymentSimulation(method) {
    paymentMethodsView.style.display = 'none';
    successPaymentView.style.display = 'flex';
    
    // Phase 1: Simulated payment processing
    successPaymentIcon.style.display = 'none';
    successPaymentSpinner.style.display = 'block';
    successPaymentTitle.textContent = currentLanguage === 'en' ? 'Processing Payment...' : 'Procesando Pago...';
    successPaymentMessage.textContent = currentLanguage === 'en' ? 'Processing payment, please wait...' : 'Procesando el pago, por favor espera...';
    
    // Send request payload
    const payload = {
      analysisId: currentAnalysisId,
      tier: currentTier,
      paymentMethod: method
    };

    try {
      // Simulate gateway latency
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Phase 2: Payment approved! Transition message to Generating CV
      successPaymentTitle.textContent = currentLanguage === 'en' ? 'Generating CV...' : 'Generando CV...';
      successPaymentMessage.textContent = currentLanguage === 'en' 
        ? 'Cintia is rewriting your profile, injecting keywords and structuring your achievements (this may take a few seconds)...' 
        : 'Cintia está reescribiendo tu perfil, inyectando palabras clave y estructurando tus logros (esto puede demorar unos segundos)...';
      
      const response = await fetch('/api/payment/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || (currentLanguage === 'en' ? 'Error processing payment.' : 'Error al procesar el pago.'));
      }
      
      // Phase 3: AI CV generation finished. Show green checkmark icon
      successPaymentIcon.style.display = 'block';
      successPaymentSpinner.style.display = 'none';
      successPaymentTitle.textContent = currentLanguage === 'en' ? 'CV Generated!' : '¡CV Generado!';
      successPaymentMessage.textContent = currentLanguage === 'en' ? 'Redirecting to your result...' : 'Redirigiendo a tu resultado...';
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      checkoutModal.close();

      if (currentTier === 'ai') {
        renderOptimizedCv(data.optimizedText);
      }

    } catch (err) {
      paymentMethodsView.style.display = 'flex';
      successPaymentView.style.display = 'none';
      alert('Error: ' + err.message);
    }
  }

  payPaypalBtn.addEventListener('click', () => executePaymentSimulation('paypal'));

  // 8. Render Optimized Markdown text
  function renderOptimizedCv(mdText) {
    optimizedContentText = mdText;
    
    // Markdown-to-HTML simple parser
    let html = mdText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      // Headers
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      // Bold
      .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
      .replace(/__(.*?)__/gim, '<strong>$1</strong>')
      // Italics
      .replace(/\*(.*?)\*/gim, '<em>$1</em>')
      // Bullet lists
      .replace(/^\s*\-\s(.*$)/gim, '<li>$1</li>')
      // Wrap list items
      .replace(/(<li>.*<\/li>)/gim, '<ul>$1</ul>')
      // Remove double wrap of ul tags
      .replace(/<\/ul>\s*<ul>/g, '')
      // Newlines to paragraphs
      .replace(/\n\n/g, '<p></p>')
      .replace(/\n/g, '<br>');

    optimizedContentBox.innerHTML = html;
    
    optimizedOutputContainer.style.display = 'block';
    optimizedOutputContainer.scrollIntoView({ behavior: 'smooth' });
  }

  // 9. Copy & Download Action
  copyCvBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(optimizedContentText)
      .then(() => {
        const origText = copyCvBtn.innerHTML;
        copyCvBtn.textContent = currentLanguage === 'en' ? 'Copied!' : '¡Copiado!';
        setTimeout(() => { 
          // Restore text with icons
          applyLanguage(currentLanguage);
        }, 2000);
      })
      .catch(() => alert('Could not copy text.'));
  });

  downloadCvBtn.addEventListener('click', () => {
    const element = document.createElement('a');
    const file = new Blob([optimizedContentText], { type: 'text/plain;charset=utf-8' });
    element.href = URL.createObjectURL(file);
    element.download = `CV_Optimizado_${activeFile ? activeFile.name.replace(/\.[^/.]+$/, "") : "Cintia"}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  });

  // Helper parser for markdown in card feedback
  function parseFeedbackMarkdown(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/__(.*?)__/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>');
  }
});

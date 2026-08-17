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
  
  const consentCheckbox = document.getElementById('consentCheckbox');
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
  
  // Blurred AI CV Preview Elements
  const aiPreviewSection = document.getElementById('aiPreviewSection');
  const blurredDocCard = document.getElementById('blurredDocCard');
  const blurredDocContent = document.getElementById('blurredDocContent');
  const unlockOverlay = document.getElementById('unlockOverlay');
  const unlockCtaPrice = document.getElementById('unlockCtaPrice');
  const unlockActionBtn = document.getElementById('unlockActionBtn');
  const unlockedActionsBar = document.getElementById('unlockedActionsBar');
  const unlockedCopyBtn = document.getElementById('unlockedCopyBtn');
  const unlockedDownloadBtn = document.getElementById('unlockedDownloadBtn');

  const langSelector = document.getElementById('langSelector');

  // Application Dictionaries & State
  let activeFile = null;
  let captchaToken = null;
  let captchaEnabled = true;
  let currentAnalysisId = null;
  let lastEvaluationData = null;
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
      consentText: "Acepto el procesamiento temporal de este documento para generar mi análisis.",
      submitBtn: "Analizar CV Gratis",
      loadingStatus: "Cintia está analizando tu Currículum...",
      step0: "Cintia está detectando el idioma del currículum...",
      step1: "Cintia está extrayendo el texto del documento...",
      step2: "Cintia está evaluando la estructura bajo estándares ATS...",
      step3: "Cintia está analizando la claridad de capacidades y certificaciones...",
      step4: "Cintia está verificando la extensión de páginas...",
      step5: "Cintia está generando el informe de calidad...",
      resultsTitle: "Evaluación de Cintia",
      scoreCardTitle: "Puntaje General del CV",
      radarCardTitle: "Equilibrio de Competencias (7 Ejes)",
      radarSubtitle: "Visualización integral de los 7 estándares de contratación",
      breakdownSectionTitle: "Desglose Detallado por Criterio",
      kpiAtsLabel: "Filtro ATS",
      kpiStrengthsLabel: "Fortalezas",
      kpiFixesLabel: "Por Mejorar",
      critiqueExplanationTitle: "Explicación del Puntaje",
      previewPillText: "CV Optimizado por Cintia Listo",
      previewSectionTitle: "Reescritura Profesional de Alto Impacto",
      previewSectionSubtitle: "Cintia ha reestructurado tu currículum inyectando palabras clave ATS, logros cuantificados y formato profesional listo para postular.",
      unlockCtaHeading: "Desbloquea tu Currículum Optimizado",
      unlockCtaDescription: "Accede a la versión completa optimizada por Cintia, con redacción persuasiva, palabras clave ATS y lista para enviar a reclutadores.",
      unlockCtaPeriod: "USD / pago único",
      unlockActionBtnText: "Desbloquear y Descargar CV",
      unlockedStatusText: "¡Currículum Desbloqueado con Éxito!",
      unlockedCopyBtnText: "Copiar Texto",
      unlockedDownloadBtnText: "Descargar .txt",
      pricingTitle: "¿Prefieres la asesoría y optimización de un Experto Humano?",
      pricingSubtitle: "Trabaja 1 a 1 con un especialista en Recursos Humanos y Reclutamiento para potenciar tu perfil y preparar tus próximas entrevistas.",
      aiPlanName: "Optimización con IA",
      aiPlanPriceUnit: "USD / pago único",
      aiPlanF1: "Reescritura inmediata de Cintia",
      aiPlanF2: "Inyección de palabras clave ATS",
      aiPlanF3: "Reorganización de habilidades y perfil",
      aiPlanF4: "Descarga inmediata en texto/markdown",
      aiPlanBtn: "Optimizar con IA",
      expertPlanName: "Asesoría 1 a 1 y Optimización con Experto Humano",
      expertPlanPriceUnit: "USD / asesoría y entrega completa",
      expertEmailLabel: "Correo Electrónico",
      expertEmailPlaceholder: "nombre@correo.com",
      expertPhoneLabel: "Número de Celular o WhatsApp",
      expertContactHint: "* Proporciona al menos uno de los dos medios de contacto.",
      expertPlanF1: "Optimización de tu CV por parte de un experto humano en RRHH y reclutamiento.",
      expertPlanF2: "1 hora y media de asesoría, entrega de la información y entrevista con el usuario titular del CV.",
      expertPlanF3: "Entrega del CV optimizado en formato PDF y Word editable.",
      expertPlanBtn: "Solicitar Asesoría de Experto ($25 USD)",
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
      consentText: "I agree to the temporary processing of this document to generate my analysis.",
      submitBtn: "Analyze CV for Free",
      loadingStatus: "Cintia is analyzing your Resume...",
      step0: "Cintia is detecting the language of the resume...",
      step1: "Cintia is extracting text from document...",
      step2: "Cintia is evaluating structure under ATS standards...",
      step3: "Cintia is analyzing clarity of skills and certifications...",
      step4: "Cintia is verifying page limits...",
      step5: "Cintia is generating quality report...",
      resultsTitle: "Cintia's Evaluation",
      scoreCardTitle: "Overall Resume Score",
      radarCardTitle: "Competency Balance (7 Axes)",
      radarSubtitle: "Comprehensive view across 7 hiring benchmarks",
      breakdownSectionTitle: "Detailed Criteria Breakdown",
      kpiAtsLabel: "ATS Match",
      kpiStrengthsLabel: "Strengths",
      kpiFixesLabel: "Needs Work",
      critiqueExplanationTitle: "Score Explanation",
      previewPillText: "Cintia-Optimized CV Ready",
      previewSectionTitle: "High-Impact Professional Rewrite",
      previewSectionSubtitle: "Cintia has restructured your resume with ATS keywords, quantifiable metrics, and interview-ready formatting.",
      unlockCtaHeading: "Unlock Your Optimized Resume",
      unlockCtaDescription: "Access the complete version rewritten by Cintia, featuring persuasive language, ATS keyword injection, and recruiter-ready layout.",
      unlockCtaPeriod: "USD / one-time payment",
      unlockActionBtnText: "Unlock & Download Resume",
      unlockedStatusText: "Resume Successfully Unlocked!",
      unlockedCopyBtnText: "Copy Text",
      unlockedDownloadBtnText: "Download .txt",
      pricingTitle: "Prefer personalized mentoring and optimization by a Human Expert?",
      pricingSubtitle: "Work 1-on-1 with an HR & Recruitment specialist to elevate your professional profile and prepare for upcoming interviews.",
      aiPlanName: "AI Optimization",
      aiPlanPriceUnit: "USD / one-time payment",
      aiPlanF1: "Cintia's instant profile rewriting",
      aiPlanF2: "ATS keyword injection",
      aiPlanF3: "Reorganization of skills and profile",
      aiPlanF4: "Immediate download in text/markdown",
      aiPlanBtn: "Optimize with AI",
      expertPlanName: "1-on-1 Mentoring & Human Expert Resume Optimization",
      expertPlanPriceUnit: "USD / complete session & delivery",
      expertEmailLabel: "Email Address",
      expertEmailPlaceholder: "name@email.com",
      expertPhoneLabel: "Cell Phone or WhatsApp Number",
      expertContactHint: "* Provide at least one of the two contact methods.",
      expertPlanF1: "Resume optimization by an HR and recruitment human expert.",
      expertPlanF2: "1.5 hours of 1-on-1 advisory session, feedback delivery, and personalized interview.",
      expertPlanF3: "Delivery of the optimized resume in PDF and editable Word formats.",
      expertPlanBtn: "Request Expert Consultation ($25 USD)",
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
    
    const consentTextEl = document.getElementById('consentText');
    if (consentTextEl) consentTextEl.textContent = t.consentText;
    
    document.getElementById('submitBtn').textContent = t.submitBtn;
    
    document.getElementById('loadingStatus').textContent = t.loadingStatus;
    document.getElementById('step0').textContent = t.step0;
    document.getElementById('step1').textContent = t.step1;
    document.getElementById('step2').textContent = t.step2;
    document.getElementById('step3').textContent = t.step3;
    document.getElementById('step4').textContent = t.step4;
    document.getElementById('step5').textContent = t.step5;
    
    const resultsTitleEl = document.querySelector('#resultsSection .results-header h2');
    if (resultsTitleEl) resultsTitleEl.textContent = t.resultsTitle;

    const scoreCardTitleEl = document.getElementById('scoreCardTitle');
    if (scoreCardTitleEl) scoreCardTitleEl.textContent = t.scoreCardTitle;

    const radarCardTitleEl = document.getElementById('radarCardTitle');
    if (radarCardTitleEl) radarCardTitleEl.textContent = t.radarCardTitle;

    const radarSubtitleEl = document.getElementById('radarSubtitle');
    if (radarSubtitleEl) radarSubtitleEl.textContent = t.radarSubtitle;

    const breakdownSectionTitleEl = document.getElementById('breakdownSectionTitle');
    if (breakdownSectionTitleEl) breakdownSectionTitleEl.textContent = t.breakdownSectionTitle;

    const kpiAtsLabelEl = document.getElementById('kpiAtsLabel');
    if (kpiAtsLabelEl) kpiAtsLabelEl.textContent = t.kpiAtsLabel;

    const kpiStrengthsLabelEl = document.getElementById('kpiStrengthsLabel');
    if (kpiStrengthsLabelEl) kpiStrengthsLabelEl.textContent = t.kpiStrengthsLabel;

    const kpiFixesLabelEl = document.getElementById('kpiFixesLabel');
    if (kpiFixesLabelEl) kpiFixesLabelEl.textContent = t.kpiFixesLabel;

    document.querySelector('.detailed-explanation h3').textContent = t.critiqueExplanationTitle;
    
    // Blurred Preview Dynamic Text
    const previewPillTextEl = document.getElementById('previewPillText');
    if (previewPillTextEl) previewPillTextEl.textContent = t.previewPillText;
    const previewSectionTitleEl = document.getElementById('previewSectionTitle');
    if (previewSectionTitleEl) previewSectionTitleEl.textContent = t.previewSectionTitle;
    const previewSectionSubtitleEl = document.getElementById('previewSectionSubtitle');
    if (previewSectionSubtitleEl) previewSectionSubtitleEl.textContent = t.previewSectionSubtitle;
    const unlockCtaHeadingEl = document.getElementById('unlockCtaHeading');
    if (unlockCtaHeadingEl) unlockCtaHeadingEl.textContent = t.unlockCtaHeading;
    const unlockCtaDescriptionEl = document.getElementById('unlockCtaDescription');
    if (unlockCtaDescriptionEl) unlockCtaDescriptionEl.textContent = t.unlockCtaDescription;
    const unlockCtaPeriodEl = document.getElementById('unlockCtaPeriod');
    if (unlockCtaPeriodEl) unlockCtaPeriodEl.textContent = t.unlockCtaPeriod;
    const unlockActionBtnTextEl = document.getElementById('unlockActionBtnText');
    if (unlockActionBtnTextEl) unlockActionBtnTextEl.textContent = `${t.unlockActionBtnText} ($${appConfig.priceAi || 1} USD)`;
    const unlockedStatusTextEl = document.getElementById('unlockedStatusText');
    if (unlockedStatusTextEl) unlockedStatusTextEl.textContent = t.unlockedStatusText;
    const unlockedCopyBtnTextEl = document.getElementById('unlockedCopyBtnText');
    if (unlockedCopyBtnTextEl) unlockedCopyBtnTextEl.textContent = t.unlockedCopyBtnText;
    const unlockedDownloadBtnTextEl = document.getElementById('unlockedDownloadBtnText');
    if (unlockedDownloadBtnTextEl) unlockedDownloadBtnTextEl.textContent = t.unlockedDownloadBtnText;

    // Re-render visual evaluation if data is present
    if (lastEvaluationData) {
      renderEvaluation(lastEvaluationData);
    }
    
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
    
    // Expert Plan Card
    const expertCard = document.getElementById('expertPlanCard');
    if (expertCard) {
      expertCard.querySelector('.plan-name').textContent = t.expertPlanName;
      const priceSpan = expertCard.querySelector('.plan-price span');
      if (priceSpan) priceSpan.textContent = t.expertPlanPriceUnit;
      
      const labels = expertCard.querySelectorAll('.plan-input-group label');
      if (labels.length >= 2) {
        labels[0].textContent = t.expertEmailLabel;
        labels[1].textContent = t.expertPhoneLabel;
      }
      
      const expertEmailInput = document.getElementById('expertEmail');
      if (expertEmailInput) expertEmailInput.placeholder = t.expertEmailPlaceholder;
      const expertContactHintEl = document.getElementById('expertContactHint');
      if (expertContactHintEl) expertContactHintEl.textContent = t.expertContactHint;
      
      const expFeatures = expertCard.querySelectorAll('.plan-features li');
      const checkIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg> `;
      if (expFeatures.length >= 3) {
        expFeatures[0].innerHTML = checkIcon + t.expertPlanF1;
        expFeatures[1].innerHTML = checkIcon + t.expertPlanF2;
        expFeatures[2].innerHTML = checkIcon + t.expertPlanF3;
      }
      
      const optExpertBtn = document.getElementById('optimizeExpertBtn');
      if (optExpertBtn) optExpertBtn.textContent = t.expertPlanBtn;
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

  // Consent checkbox toggle
  if (consentCheckbox) {
    consentCheckbox.addEventListener('change', () => {
      submitBtn.disabled = !consentCheckbox.checked;
    });
  }

  // 4. Form Submit & Progress Animation
  cvForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();

    if (consentCheckbox && !consentCheckbox.checked) {
      showError(currentLanguage === 'en'
        ? 'Please accept the temporary processing of this document to proceed.'
        : 'Por favor acepta el procesamiento temporal del documento para continuar.');
      submitBtn.disabled = true;
      return;
    }

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

    // Hide language selector during analysis/results phase
    const langContainer = document.querySelector('.lang-selector-container');
    if (langContainer) langContainer.style.display = 'none';

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
      
      // Auto-apply resume's detected language to the entire app interface
      if (data.lang && data.lang !== currentLanguage) {
        localStorage.setItem('cvLang', data.lang);
        langSelector.value = data.lang;
        applyLanguage(data.lang);
      }

      renderEvaluation(data.evaluation);

      // Render the blurred AI CV Preview with unlock CTA
      if (data.optimizedText) {
        renderBlurredPreview(data.optimizedText);
      }

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
      
      // Re-enable language selection on error fallback
      const langContainer = document.querySelector('.lang-selector-container');
      if (langContainer) langContainer.style.display = 'block';
    }
  });


  // 5. Radar Heptagon SVG Generator
  function renderRadarChart(evalData) {
    const container = document.getElementById('radarChartContainer');
    if (!container) return;

    const isEn = currentLanguage === 'en';
    const axes = [
      { key: 'atsCompatibility', label: isEn ? 'ATS Match' : 'Filtro ATS' },
      { key: 'skillsClarity', label: isEn ? 'Talent Clarity' : 'Talentos' },
      { key: 'lengthCheck', label: isEn ? 'Page Length' : 'Extensión' },
      { key: 'quantifiableMetrics', label: isEn ? 'Metrics' : 'Métricas' },
      { key: 'actionVerbs', label: isEn ? 'Action Verbs' : 'Verbos' },
      { key: 'contactLinks', label: isEn ? 'Contact' : 'Contacto' },
      { key: 'grammarSpelling', label: isEn ? 'Grammar' : 'Gramática' }
    ];

    const cx = 200;
    const cy = 175;
    const maxRadius = 105;
    const numAxes = axes.length; // 7

    // Levels 1 to 5
    const levels = [0.2, 0.4, 0.6, 0.8, 1.0];
    
    // Compute grid concentric heptagons
    let gridPolygonsHtml = '';
    levels.forEach((level, idx) => {
      const pts = [];
      for (let i = 0; i < numAxes; i++) {
        const angle = -Math.PI / 2 + (i * 2 * Math.PI) / numAxes;
        const x = cx + level * maxRadius * Math.cos(angle);
        const y = cy + level * maxRadius * Math.sin(angle);
        pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
      }
      const isOuter = idx === levels.length - 1;
      gridPolygonsHtml += `<polygon points="${pts.join(' ')}" class="${isOuter ? 'radar-grid-outer' : 'radar-grid-polygon'}" />`;
    });

    // Compute axis lines and labels
    let axisLinesHtml = '';
    let labelsHtml = '';
    const dataPoints = [];

    axes.forEach((axis, i) => {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / numAxes;
      const endX = cx + maxRadius * Math.cos(angle);
      const endY = cy + maxRadius * Math.sin(angle);
      axisLinesHtml += `<line x1="${cx}" y1="${cy}" x2="${endX.toFixed(1)}" y2="${endY.toFixed(1)}" class="radar-axis-line" />`;

      // Value coordinate
      const scoreObj = evalData[axis.key];
      const starsVal = scoreObj ? (scoreObj.stars || 3) : 3;
      const valRatio = Math.max(0.12, Math.min(1.0, starsVal / 5));
      const dataX = cx + valRatio * maxRadius * Math.cos(angle);
      const dataY = cy + valRatio * maxRadius * Math.sin(angle);
      dataPoints.push({ x: dataX, y: dataY, score: starsVal, label: axis.label });

      // Label coordinate outside the outer ring
      const labelRadius = maxRadius + 24;
      const labelX = cx + labelRadius * Math.cos(angle);
      const labelY = cy + labelRadius * Math.sin(angle);
      
      let textAnchor = 'middle';
      const cosA = Math.cos(angle);
      if (cosA > 0.22) textAnchor = 'start';
      else if (cosA < -0.22) textAnchor = 'end';

      labelsHtml += `
        <text x="${labelX.toFixed(1)}" y="${labelY.toFixed(1)}" text-anchor="${textAnchor}" class="radar-axis-label" dominant-baseline="central">
          ${axis.label}
          <tspan class="radar-axis-score" dx="3">(${starsVal}/5)</tspan>
        </text>
      `;
    });

    const dataPolygonPoints = dataPoints.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

    let vertexPointsHtml = '';
    dataPoints.forEach(p => {
      vertexPointsHtml += `
        <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4.5" class="radar-vertex-point">
          <title>${p.label}: ${p.score} / 5</title>
        </circle>
      `;
    });

    container.innerHTML = `
      <svg class="radar-svg" viewBox="0 0 400 350">
        <defs>
          <linearGradient id="radarGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#10b981" stop-opacity="0.45" />
            <stop offset="100%" stop-color="#059669" stop-opacity="0.15" />
          </linearGradient>
        </defs>
        ${gridPolygonsHtml}
        ${axisLinesHtml}
        <polygon points="${dataPolygonPoints}" class="radar-data-polygon" />
        ${vertexPointsHtml}
        ${labelsHtml}
      </svg>
    `;
  }

  // 6. Score Gauge & KPI Highlights Renderer
  function renderScoreGaugeAndKpis(evalData) {
    const isEn = currentLanguage === 'en';
    const gaugeValueEl = document.getElementById('gaugeScoreValue');
    const gaugeCircle = document.getElementById('gaugeProgressCircle');
    const badgeEl = document.getElementById('gaugeStatusBadge');

    const kpiAtsVal = document.getElementById('kpiAtsVal');
    const kpiStrengthsVal = document.getElementById('kpiStrengthsVal');
    const kpiFixesVal = document.getElementById('kpiFixesVal');

    const keys = ['atsCompatibility', 'skillsClarity', 'lengthCheck', 'quantifiableMetrics', 'actionVerbs', 'contactLinks', 'grammarSpelling'];
    
    let totalStars = 0;
    let counted = 0;
    let strengthsCount = 0;
    let fixesCount = 0;
    let atsStars = 3;

    keys.forEach(k => {
      if (evalData[k] && typeof evalData[k].stars === 'number') {
        const s = evalData[k].stars;
        totalStars += s;
        counted++;
        if (k === 'atsCompatibility') atsStars = s;
        if (s >= 4) strengthsCount++;
        else if (s <= 2) fixesCount++;
      }
    });

    const avgScore = counted > 0 ? (totalStars / (counted * 5)) * 100 : 70;
    const finalScore = Math.round(avgScore);

    // Animate counter
    let currentCount = 0;
    const duration = 1000;
    const start = performance.now();
    
    function animateCounter(now) {
      const progress = Math.min((now - start) / duration, 1);
      currentCount = Math.floor(progress * finalScore);
      if (gaugeValueEl) gaugeValueEl.textContent = currentCount;
      if (progress < 1) requestAnimationFrame(animateCounter);
      else if (gaugeValueEl) gaugeValueEl.textContent = finalScore;
    }
    requestAnimationFrame(animateCounter);

    // Animate Circle
    const circumference = 402.12; // 2 * PI * 64
    const offset = circumference - (finalScore / 100) * circumference;
    if (gaugeCircle) {
      gaugeCircle.style.strokeDashoffset = offset;
      if (finalScore >= 80) gaugeCircle.style.stroke = 'var(--color-mint)';
      else if (finalScore >= 60) gaugeCircle.style.stroke = '#f59e0b';
      else gaugeCircle.style.stroke = 'var(--color-red)';
    }

    // Badge
    if (badgeEl) {
      badgeEl.className = 'gauge-status-badge';
      if (finalScore >= 80) {
        badgeEl.classList.add('badge-excellent');
        badgeEl.textContent = isEn ? 'Ready to Apply' : 'Listo para Postular';
      } else if (finalScore >= 60) {
        badgeEl.classList.add('badge-good');
        badgeEl.textContent = isEn ? 'Good Potential' : 'Buen Potencial';
      } else {
        badgeEl.classList.add('badge-warning');
        badgeEl.textContent = isEn ? 'Needs Attention' : 'Atención Prioritaria';
      }
    }

    // KPIs
    if (kpiAtsVal) {
      const atsPct = Math.round((atsStars / 5) * 100);
      kpiAtsVal.textContent = `${atsPct}%`;
      kpiAtsVal.style.color = atsStars >= 4 ? 'var(--color-mint)' : (atsStars === 3 ? '#f59e0b' : 'var(--color-red)');
    }
    if (kpiStrengthsVal) {
      kpiStrengthsVal.textContent = `${strengthsCount} / 7`;
      kpiStrengthsVal.style.color = 'var(--color-mint)';
    }
    if (kpiFixesVal) {
      kpiFixesVal.textContent = `${fixesCount} ${isEn ? 'items' : 'puntos'}`;
      kpiFixesVal.style.color = fixesCount > 0 ? 'var(--color-red)' : 'var(--color-mint)';
    }
  }

  // 7. Render Evaluation Function (Dashboard)
  function renderEvaluation(evalData) {
    if (!evalData) return;
    lastEvaluationData = evalData;

    // Set text summaries
    resultsSummary.textContent = evalData.summary || 'Quality Evaluation';
    
    // Render Visual Charts (Radar Heptagon + Score Gauge + KPIs)
    renderRadarChart(evalData);
    renderScoreGaugeAndKpis(evalData);

    // Dynamic 7 criteria mapping with icons and titles
    const isEn = currentLanguage === 'en';
    const criteriaMapping = {
      atsCompatibility: { 
        title: isEn ? 'ATS Compatibility' : 'Compatibilidad ATS',
        icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`
      },
      skillsClarity: { 
        title: isEn ? 'Talent Clarity' : 'Claridad de Talentos',
        icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`
      },
      lengthCheck: { 
        title: isEn ? 'Page Length (<= 2 pgs)' : 'Extensión (<= 2 pág)',
        icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`
      },
      quantifiableMetrics: { 
        title: isEn ? 'Quantifiable Metrics' : 'Métricas Cuantificables',
        icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`
      },
      actionVerbs: { 
        title: isEn ? 'Action Verbs' : 'Verbos de Acción',
        icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`
      },
      contactLinks: { 
        title: isEn ? 'Contact & Links' : 'Contacto y Enlaces',
        icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`
      },
      grammarSpelling: { 
        title: isEn ? 'Grammar & Spelling' : 'Ortografía y Gramática',
        icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`
      }
    };

    critiqueGrid.innerHTML = '';
    
    for (const [key, config] of Object.entries(criteriaMapping)) {
      const data = evalData[key];
      if (!data) continue;
      
      const starsValue = data.stars || 3;
      const pct = (starsValue / 5) * 100;
      
      // Qualitative badge text & class
      let badgeClass = 'badge-3';
      let badgeText = isEn ? 'Fair' : 'Aceptable';
      let fillClass = 'fill-warn';

      if (starsValue >= 5) {
        badgeClass = 'badge-5';
        badgeText = isEn ? 'Outstanding' : 'Sobresaliente';
        fillClass = '';
      } else if (starsValue === 4) {
        badgeClass = 'badge-4';
        badgeText = isEn ? 'Solid' : 'Bueno';
        fillClass = '';
      } else if (starsValue <= 2) {
        badgeClass = 'badge-1';
        badgeText = isEn ? 'Needs Work' : 'Por Mejorar';
        fillClass = 'fill-danger';
      }

      critiqueGrid.innerHTML += `
        <div class="critique-item">
          <div class="critique-item-header">
            <div class="critique-title-wrap">
              <div class="critique-icon">${config.icon}</div>
              <div class="critique-title">${config.title}</div>
            </div>
            <span class="critique-badge ${badgeClass}">${badgeText}</span>
          </div>

          <div class="critique-progress-wrap">
            <div class="critique-progress-track">
              <div class="critique-progress-fill ${fillClass}" style="width: ${pct}%;"></div>
            </div>
            <span class="critique-stars-count">${starsValue} / 5 ★</span>
          </div>

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
        unlockOptimizedCv(data.optimizedText || optimizedContentText);
      }

    } catch (err) {
      paymentMethodsView.style.display = 'flex';
      successPaymentView.style.display = 'none';
      alert('Error: ' + err.message);
    }
  }

  payPaypalBtn.addEventListener('click', () => executePaymentSimulation('paypal'));

  // Unlock CTA button listener in the blurred preview card
  if (unlockActionBtn) {
    unlockActionBtn.addEventListener('click', () => {
      currentTier = 'ai';
      openCheckout(
        currentLanguage === 'en' ? 'Instant AI CV Optimization' : 'Optimización instantánea con IA', 
        appConfig.priceAi.toFixed(2)
      );
    });
  }

  // 8. Render Blurred AI CV Preview
  function renderBlurredPreview(mdText) {
    if (!mdText) return;
    optimizedContentText = mdText;

    if (blurredDocContent) {
      blurredDocContent.innerHTML = formatMarkdownToHtml(mdText);
    }

    if (blurredDocCard) {
      blurredDocCard.classList.remove('unlocked');
    }

    if (unlockOverlay) {
      unlockOverlay.style.display = 'flex';
    }

    if (unlockedActionsBar) {
      unlockedActionsBar.style.display = 'none';
    }

    if (unlockCtaPrice) {
      unlockCtaPrice.textContent = `$${appConfig.priceAi || 1}`;
    }
  }

  // 9. Unlock Optimized CV upon payment completion
  function unlockOptimizedCv(mdText) {
    if (mdText) {
      optimizedContentText = mdText;
      if (blurredDocContent) {
        blurredDocContent.innerHTML = formatMarkdownToHtml(mdText);
      }
    }

    if (blurredDocCard) {
      blurredDocCard.classList.add('unlocked');
    }

    if (unlockOverlay) {
      unlockOverlay.style.display = 'none';
    }

    if (unlockedActionsBar) {
      unlockedActionsBar.style.display = 'flex';
    }

    // Smooth scroll to the unblurred document
    if (aiPreviewSection) {
      aiPreviewSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  // Helper Markdown-to-HTML parser
  function formatMarkdownToHtml(mdText) {
    if (!mdText) return '';
    return mdText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      // Headers
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      // Blockquotes / Alerts
      .replace(/^>\s*\[!NOTE\]/gim, '<div class="alert-note">')
      .replace(/^>\s*(.*$)/gim, '<blockquote>$1</blockquote>')
      // Bold
      .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
      .replace(/__(.*?)__/gim, '<strong>$1</strong>')
      // Italics
      .replace(/\*(.*?)\*/gim, '<em>$1</em>')
      // Horizontal rules
      .replace(/^---$/gim, '<hr style="border:0; border-top:1px solid var(--border-grey); margin:18px 0;">')
      // Bullet lists
      .replace(/^\s*\-\s(.*$)/gim, '<li>$1</li>')
      .replace(/^\s*\*\s(.*$)/gim, '<li>$1</li>')
      // Wrap list items
      .replace(/(<li>.*<\/li>)/gim, '<ul>$1</ul>')
      // Remove double wrap of ul tags
      .replace(/<\/ul>\s*<ul>/g, '')
      // Newlines to paragraphs
      .replace(/\n\n/g, '<p></p>')
      .replace(/\n/g, '<br>');
  }

  // Unlocked copy & download actions
  if (unlockedCopyBtn) {
    unlockedCopyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(optimizedContentText)
        .then(() => {
          const origText = unlockedCopyBtn.innerHTML;
          unlockedCopyBtn.textContent = currentLanguage === 'en' ? 'Copied!' : '¡Copiado!';
          setTimeout(() => {
            unlockedCopyBtn.innerHTML = origText;
          }, 2000);
        })
        .catch(() => alert('Could not copy text.'));
    });
  }

  if (unlockedDownloadBtn) {
    unlockedDownloadBtn.addEventListener('click', () => {
      const element = document.createElement('a');
      const file = new Blob([optimizedContentText], { type: 'text/plain;charset=utf-8' });
      element.href = URL.createObjectURL(file);
      element.download = `CV_Optimizado_${activeFile ? activeFile.name.replace(/\.[^/.]+$/, "") : "Cintia"}.txt`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    });
  }

  // Fallback Copy & Download Action
  if (copyCvBtn) {
    copyCvBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(optimizedContentText)
        .then(() => {
          copyCvBtn.textContent = currentLanguage === 'en' ? 'Copied!' : '¡Copiado!';
          setTimeout(() => { 
            applyLanguage(currentLanguage);
          }, 2000);
        })
        .catch(() => alert('Could not copy text.'));
    });
  }

  if (downloadCvBtn) {
    downloadCvBtn.addEventListener('click', () => {
      const element = document.createElement('a');
      const file = new Blob([optimizedContentText], { type: 'text/plain;charset=utf-8' });
      element.href = URL.createObjectURL(file);
      element.download = `CV_Optimizado_${activeFile ? activeFile.name.replace(/\.[^/.]+$/, "") : "Cintia"}.txt`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    });
  }

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

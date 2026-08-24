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
  const termsCheckbox = document.getElementById('termsCheckbox');
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
  const expertPlanCard = document.getElementById('expertPlanCard');
  const expertCardError = document.getElementById('expertCardError');
  const expertAlertModal = document.getElementById('expertAlertModal');
  const expertAlertTitle = document.getElementById('expertAlertTitle');
  const expertAlertMessage = document.getElementById('expertAlertMessage');
  const expertAlertOkBtn = document.getElementById('expertAlertOkBtn');
  
  const checkoutModal = document.getElementById('checkoutModal');
  const checkoutTitle = document.getElementById('checkoutTitle');
  const checkoutService = document.getElementById('checkoutService');
  const checkoutPriceOriginal = document.getElementById('checkoutPriceOriginal');
  const checkoutTotal = document.getElementById('checkoutTotal');
  const checkoutTotalClp = document.getElementById('checkoutTotalClp');
  const closeModalBtn = document.getElementById('closeModalBtn');
  
  const paymentMethodsView = document.getElementById('paymentMethodsView');
  const mpCheckoutBtn = document.getElementById('mpCheckoutBtn');
  const mpLoadingHint = document.getElementById('mpLoadingHint');
  const mpCheckoutBtnTitle = document.getElementById('mpCheckoutBtnTitle');
  const mpCheckoutBtnSubtitle = document.getElementById('mpCheckoutBtnSubtitle');
  const paymentDivider = document.getElementById('paymentDivider');
  const paymentInlineError = document.getElementById('paymentInlineError');
  const paypalButtonContainer = document.getElementById('paypalButtonContainer');
  const paypalLoadingHint = document.getElementById('paypalLoadingHint');
  
  const successPaymentView = document.getElementById('successPaymentView');
  const successPaymentMessage = document.getElementById('successPaymentMessage');
  const successPaymentIcon = document.getElementById('successPaymentIcon');
  const successPaymentSpinner = document.getElementById('successPaymentSpinner');
  const successPaymentTitle = document.getElementById('successPaymentTitle');
  const expertWhatsappSupportBox = document.getElementById('expertWhatsappSupportBox');
  const expertWhatsappNotice = document.getElementById('expertWhatsappNotice');
  const expertWhatsappBtn = document.getElementById('expertWhatsappBtn');
  

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
      termsConsentText: "Acepto los <a href=\"/terminos.html\" target=\"_blank\" rel=\"noopener noreferrer\" style=\"color: var(--color-mint); text-decoration: underline; font-weight: 600;\">términos y condiciones</a> de uso de Cintia.pro.",
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
      expertContactHint: "* Ambos datos de contacto son obligatorios para garantizar la coordinación de tu sesión.",
      expertPlanF1: "Optimización de tu CV por parte de un experto humano en RRHH y reclutamiento.",
      expertPlanF2: "Sesión de asesoría experta: 1 hora y media de apoyo, entrega de la información y entrevista con el usuario titular del CV.",
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
      footerCopyright: "&copy; 2026 Cintia. Todos los derechos reservados. Desarrollado y operado por <strong>MelodIA Lab SpA</strong> (La Serena, Chile). Tecnología basada en Google Gemini.",
      footerCredits: "<a href=\"/terminos.html\" target=\"_blank\" style=\"color: var(--text-medium); text-decoration: underline; margin-right: 14px;\" id=\"footerTermsLink\">Términos y Condiciones</a> Hecho con ❤️ y ⚡ por <a href=\"https://www.melodialab.net\" target=\"_blank\" rel=\"noopener noreferrer\" style=\"color: #e65c00; text-decoration: none; font-weight: 600;\">MelodIA Lab</a>",
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
      consentText: "I accept the temporary processing of this document to generate my analysis.",
      termsConsentText: "I accept the <a href=\"/terminos.html?lang=en\" target=\"_blank\" rel=\"noopener noreferrer\" style=\"color: var(--color-mint); text-decoration: underline; font-weight: 600;\">terms and conditions</a> of Cintia.pro.",
      submitBtn: "Analyze Resume for Free",
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
      expertContactHint: "* Both contact details are required to guarantee the coordination of your session.",
      expertPlanF1: "Resume optimization by an HR and recruitment human expert.",
      expertPlanF2: "Expert Advisory Session: 1.5 hours of dedicated support, feedback delivery, and personalized interview.",
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
      footerCopyright: "&copy; 2026 Cintia. All rights reserved. Developed and operated by <strong>MelodIA Lab SpA</strong> (La Serena, Chile). Powered by Google Gemini.",
      footerCredits: "<a href=\"/terminos.html?lang=en\" target=\"_blank\" style=\"color: var(--text-medium); text-decoration: underline; margin-right: 14px;\" id=\"footerTermsLink\">Terms & Conditions</a> Made with ❤️ and ⚡ by <a href=\"https://www.melodialab.net\" target=\"_blank\" rel=\"noopener noreferrer\" style=\"color: #e65c00; text-decoration: none; font-weight: 600;\">MelodIA Lab</a>",
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

    const termsConsentTextEl = document.getElementById('termsConsentText');
    if (termsConsentTextEl) termsConsentTextEl.innerHTML = t.termsConsentText;
    
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
    const checkoutRows = document.querySelectorAll('.checkout-row');
    if (checkoutRows.length > 1) {
      checkoutRows[checkoutRows.length - 1].querySelectorAll('span')[0].textContent = t.modalTotal;
    }
    document.querySelector('#successPaymentView h3').textContent = t.modalSuccessTitle;
    
    // Footer
    document.getElementById('footerCopyright').innerHTML = t.footerCopyright;
    document.getElementById('footerCredits').innerHTML = t.footerCredits;

    // Apply configuration UI overrides
    applyConfigToUi();
  }

  // Fetch Public Config Parameters on Load
  // Also dynamically loads the PayPal JS SDK with the correct client-id
  async function fetchConfig() {
    try {
      const response = await fetch('/api/config');
      const data = await response.json();
      appConfig = data;
      applyConfigToUi();

      // Load PayPal SDK dynamically once we have the client ID
      if (data.paypalClientId) {
        await loadPayPalSdk(data.paypalClientId);
      }
    } catch (err) {
      console.error('Error fetching config:', err);
    }
  }

  // Dynamically inject the PayPal JS SDK script
  let paypalSdkLoaded = false;
  function loadPayPalSdk(clientId) {
    return new Promise((resolve, reject) => {
      if (paypalSdkLoaded || document.getElementById('paypal-sdk-script')) {
        paypalSdkLoaded = true;
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.id = 'paypal-sdk-script';
      script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD`;
      script.onload = () => { paypalSdkLoaded = true; resolve(); };
      script.onerror = () => reject(new Error('No se pudo cargar el SDK de PayPal.'));
      document.head.appendChild(script);
    });
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
  checkPaymentReturnFromUrl();

  // Handle return redirect from Mercado Pago Checkout Pro
  async function checkPaymentReturnFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentState = urlParams.get('payment');
    const analysisId = urlParams.get('analysisId');
    const tier = urlParams.get('tier') || 'ai';
    const paymentId = urlParams.get('payment_id') || urlParams.get('collection_id');

    if (paymentState === 'success' && analysisId) {
      currentAnalysisId = analysisId;
      currentTier = tier;

      // Show payment confirmation in progress
      checkoutModal.showModal();
      paymentMethodsView.style.display = 'none';
      successPaymentView.style.display = 'flex';
      successPaymentIcon.style.display = 'none';
      successPaymentSpinner.style.display = 'block';
      successPaymentTitle.textContent = currentLanguage === 'en' ? 'Confirming Payment...' : 'Confirmando tu Pago...';
      successPaymentMessage.textContent = currentLanguage === 'en'
        ? 'Verifying transaction with Mercado Pago. Please wait a moment...'
        : 'Verificando la transacción con Mercado Pago. Un momento por favor...';

      try {
        let result = null;

        // Verify with backend check-status
        if (paymentId) {
          try {
            const verifyResp = await fetch('/api/mercadopago/check-status', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ paymentId, analysisId, tier })
            });
            if (verifyResp.ok) {
              result = await verifyResp.json();
            }
          } catch (e) {
            console.warn('check-status check warning:', e);
          }
        }

        // If not retrieved via check-status, fetch analysis record
        if (!result) {
          const aResp = await fetch(`/api/analysis/${analysisId}`);
          if (aResp.ok) {
            result = await aResp.json();
          }
        }

        // Clean up URL parameters cleanly
        window.history.replaceState({}, document.title, window.location.pathname);

        // Show results section
        if (resultsSection) resultsSection.style.display = 'block';
        if (loadingWrapper) loadingWrapper.style.display = 'none';
        if (uploadWrapper) uploadWrapper.style.display = 'none';

        if (result?.evaluation) {
          renderEvaluation(result.evaluation);
        }

        // Show success state in modal
        successPaymentIcon.style.display = 'block';
        successPaymentSpinner.style.display = 'none';

        if (tier === 'ai') {
          successPaymentTitle.textContent = currentLanguage === 'en' ? '✅ CV Generated!' : '✅ ¡CV Generado!';
          successPaymentMessage.textContent = currentLanguage === 'en' ? 'Redirecting to your result...' : 'Redirigiendo a tu resultado...';
          await new Promise(r => setTimeout(r, 1500));
          checkoutModal.close();
          unlockOptimizedCv(result?.optimizedText || '');
        } else {
          successPaymentTitle.textContent = currentLanguage === 'en' ? '✅ Payment Confirmed!' : '✅ ¡Pago Confirmado!';
          successPaymentMessage.textContent = currentLanguage === 'en'
            ? 'Your session has been registered. A Cintia expert will contact you within 24 hours to schedule your mentoring session.'
            : 'Tu sesión ha sido registrada. Un experto de Cintia te contactará en un máximo de 24 horas para coordinar tu sesión de asesoría.';
          if (expertWhatsappSupportBox) {
            expertWhatsappSupportBox.style.display = 'block';
          }
        }

      } catch (err) {
        console.error('Error in checkPaymentReturnFromUrl:', err);
        successPaymentIcon.style.display = 'block';
        successPaymentSpinner.style.display = 'none';
        successPaymentTitle.textContent = 'Pago Registrado';
        successPaymentMessage.textContent = 'Tu pago está en proceso de acreditación. Si no ves tu reporte de inmediato, recarga la página en unos segundos.';
      }
    } else if (paymentState === 'failure') {
      window.history.replaceState({}, document.title, window.location.pathname);
      showError(currentLanguage === 'en' ? 'The payment could not be completed or was cancelled. Please try again.' : 'El pago no pudo ser completado o fue cancelado. Por favor inténtalo nuevamente.');
    }
  }

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

  // Consent & Terms checkboxes toggle
  function updateSubmitBtnState() {
    const isConsentChecked = consentCheckbox ? consentCheckbox.checked : true;
    const isTermsChecked = termsCheckbox ? termsCheckbox.checked : true;
    submitBtn.disabled = !activeFile || !(isConsentChecked && isTermsChecked);
  }

  if (consentCheckbox) {
    consentCheckbox.addEventListener('change', updateSubmitBtnState);
  }
  if (termsCheckbox) {
    termsCheckbox.addEventListener('change', updateSubmitBtnState);
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

    if (termsCheckbox && !termsCheckbox.checked) {
      showError(currentLanguage === 'en'
        ? 'Please accept the terms and conditions to proceed.'
        : 'Por favor acepta los términos y condiciones de uso para continuar.');
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

    // Set text summaries with clean bold tag rendering
    resultsSummary.innerHTML = parseFeedbackMarkdown(evalData.summary || (currentLanguage === 'en' ? 'Quality Evaluation' : 'Evaluación de Calidad'));
    
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

  // ─── 6. Pricing Plan Actions & PayPal Checkout Flow ───────────────────────

  // State: contact data for expert tier, set before opening checkout
  let pendingExpertContact = null;

  optimizeAiBtn.addEventListener('click', () => {
    currentTier = 'ai';
    pendingExpertContact = null;
    openCheckout(
      currentLanguage === 'en' ? 'Instant AI CV Optimization' : 'Optimización instantánea con IA',
      appConfig.priceAi.toFixed(2)
    );
  });

  function showExpertError(message, targetInput = null) {
    if (expertCardError) {
      expertCardError.textContent = message;
      expertCardError.style.display = 'block';
    }
    if (targetInput) {
      targetInput.style.borderColor = '#ef4444';
      targetInput.focus();
    }
    if (expertAlertModal) {
      if (expertAlertTitle) {
        expertAlertTitle.textContent = currentLanguage === 'en'
          ? 'Contact Information Required'
          : 'Datos de Contacto Requeridos';
      }
      if (expertAlertMessage) {
        expertAlertMessage.textContent = message;
      }
      if (expertAlertOkBtn) {
        expertAlertOkBtn.textContent = currentLanguage === 'en'
          ? 'Complete Information'
          : 'Completar Datos';
      }
      expertAlertModal.showModal();
    }
  }

  function clearExpertErrors() {
    if (expertCardError) {
      expertCardError.textContent = '';
      expertCardError.style.display = 'none';
    }
    if (expertEmail) expertEmail.style.borderColor = '';
    if (expertPhone) expertPhone.style.borderColor = '';
  }

  if (expertEmail) expertEmail.addEventListener('input', () => { expertEmail.style.borderColor = ''; if (expertCardError) expertCardError.style.display = 'none'; });
  if (expertPhone) expertPhone.addEventListener('input', () => { expertPhone.style.borderColor = ''; if (expertCardError) expertCardError.style.display = 'none'; });

  if (expertAlertOkBtn) {
    expertAlertOkBtn.addEventListener('click', () => {
      if (expertAlertModal) expertAlertModal.close();
      if (expertPlanCard) {
        expertPlanCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      const email = expertEmail ? expertEmail.value.trim() : '';
      const phone = expertPhone ? expertPhone.value.trim() : '';
      if (!email && expertEmail) {
        expertEmail.focus();
      } else if (!phone && expertPhone) {
        expertPhone.focus();
      }
    });
  }

  // Expert Request: collect contact, validate both fields strictly, then open PayPal checkout
  optimizeExpertBtn.addEventListener('click', () => {
    hideError();
    clearExpertErrors();
    const email = expertEmail.value.trim();
    const phone = expertPhone.value.trim();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneClean = phone.replace(/\D/g, '');

    if (!email && !phone) {
      showExpertError(currentLanguage === 'en'
        ? 'Please enter both your email address and WhatsApp/phone number so our team can coordinate your expert mentoring session.'
        : 'Por favor ingresa tanto tu correo electrónico como tu número de WhatsApp/teléfono para coordinar tu sesión con el experto.',
        expertEmail
      );
      if (expertPhone) expertPhone.style.borderColor = '#ef4444';
      return;
    }

    if (!email || !emailRegex.test(email)) {
      showExpertError(currentLanguage === 'en'
        ? 'Please enter a valid email address (e.g., name@example.com) to coordinate your session.'
        : 'Por favor ingresa un correo electrónico válido (ej. tu_nombre@correo.com) para coordinar tu sesión.',
        expertEmail
      );
      return;
    }

    if (!phone || phoneClean.length < 7) {
      showExpertError(currentLanguage === 'en'
        ? 'Please enter a valid cell phone or WhatsApp number with at least 7 digits to coordinate your session.'
        : 'Por favor ingresa un número de WhatsApp o teléfono válido con al menos 7 dígitos para coordinar tu sesión.',
        expertPhone
      );
      return;
    }

    currentTier = 'expert';
    pendingExpertContact = { email, phone };
    openCheckout(
      currentLanguage === 'en' ? 'Human Expert Mentoring & CV Optimization' : 'Asesoría y Optimización con Experto Humano',
      appConfig.priceExpert.toFixed(2)
    );
  });

  function showPaymentError(msg) {
    if (paymentInlineError) {
      paymentInlineError.textContent = msg;
      paymentInlineError.style.display = 'block';
    }
  }

  function clearPaymentError() {
    if (paymentInlineError) {
      paymentInlineError.textContent = '';
      paymentInlineError.style.display = 'none';
    }
    const prevErr = document.getElementById('paypalInlineError');
    if (prevErr) prevErr.style.display = 'none';
  }

  function openCheckout(serviceName, priceStr) {
    hideError();
    clearPaymentError();
    checkoutTitle.textContent = currentLanguage === 'en' ? `Pay: ${serviceName}` : `Pagar: ${serviceName}`;
    checkoutService.textContent = serviceName;
    checkoutPriceOriginal.textContent = `$${priceStr} USD`;
    checkoutTotal.textContent = `$${priceStr} USD`;

    const priceClp = currentTier === 'ai'
      ? (appConfig.priceAiClp || 1000)
      : (appConfig.priceExpertClp || 25000);
    if (checkoutTotalClp) {
      checkoutTotalClp.textContent = `(~ $${priceClp.toLocaleString('es-CL')} CLP)`;
    }

    if (mpCheckoutBtn) {
      mpCheckoutBtn.disabled = false;
    }
    if (mpLoadingHint) {
      mpLoadingHint.style.display = 'none';
    }

    // Reset modal views
    paymentMethodsView.style.display = 'flex';
    successPaymentView.style.display = 'none';
    if (expertWhatsappSupportBox) expertWhatsappSupportBox.style.display = 'none';
    successPaymentIcon.style.display = 'block';
    successPaymentSpinner.style.display = 'none';
    successPaymentTitle.textContent = currentLanguage === 'en' ? 'Payment Completed!' : '¡Pago Completado!';

    // Render PayPal buttons for this amount
    initPayPalButtons(parseFloat(priceStr));

    checkoutModal.showModal();
  }

  // Mercado Pago Checkout Pro Redirection
  if (mpCheckoutBtn) {
    mpCheckoutBtn.addEventListener('click', async () => {
      if (!currentAnalysisId) {
        showPaymentError(currentLanguage === 'en' ? 'Missing analysis ID.' : 'Falta el ID del análisis.');
        return;
      }

      mpCheckoutBtn.disabled = true;
      if (mpLoadingHint) {
        mpLoadingHint.style.display = 'block';
        mpLoadingHint.textContent = currentLanguage === 'en' ? 'Connecting to Mercado Pago...' : 'Conectando con Mercado Pago...';
      }
      clearPaymentError();

      try {
        const resp = await fetch('/api/mercadopago/create-preference', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            analysisId: currentAnalysisId,
            tier: currentTier,
            contact: currentTier === 'expert' ? pendingExpertContact : null
          })
        });

        const data = await resp.json();
        if (!resp.ok) {
          throw new Error(data.error || (currentLanguage === 'en' ? 'Could not initiate Mercado Pago payment.' : 'No se pudo iniciar el pago con Mercado Pago.'));
        }

        const targetUrl = data.initPoint || data.sandboxInitPoint;
        if (!targetUrl) {
          throw new Error('No se recibió la URL de pago de Mercado Pago.');
        }

        window.location.href = targetUrl;

      } catch (err) {
        mpCheckoutBtn.disabled = false;
        if (mpLoadingHint) mpLoadingHint.style.display = 'none';
        showPaymentError('❌ ' + err.message);
      }
    });
  }

  // Quick Test Payment from Navbar ($1.000 CLP)
  const navQuickTestPayBtn = document.getElementById('navQuickTestPayBtn');
  if (navQuickTestPayBtn) {
    navQuickTestPayBtn.addEventListener('click', async () => {
      const originalHtml = navQuickTestPayBtn.innerHTML;
      navQuickTestPayBtn.disabled = true;
      navQuickTestPayBtn.innerHTML = '⏳ Conectando...';

      try {
        const testAnalysisId = currentAnalysisId || ('test_nav_' + Date.now());
        const resp = await fetch('/api/mercadopago/create-preference', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            analysisId: testAnalysisId,
            tier: 'ai'
          })
        });

        const data = await resp.json();
        if (!resp.ok) {
          throw new Error(data.error || 'Error al iniciar pago de prueba');
        }

        const targetUrl = data.initPoint || data.sandboxInitPoint;
        if (!targetUrl) {
          throw new Error('No se recibió la URL de pago de Mercado Pago.');
        }

        window.location.href = targetUrl;

      } catch (err) {
        navQuickTestPayBtn.disabled = false;
        navQuickTestPayBtn.innerHTML = originalHtml;
        alert('❌ Error al iniciar prueba rápida de Mercado Pago:\n' + err.message);
      }
    });
  }

  // Render official PayPal smart buttons inside #paypalButtonContainer
  async function initPayPalButtons(amount) {
    if (!paypalButtonContainer) return;
    paypalButtonContainer.innerHTML = ''; // clear previous render
    if (paypalLoadingHint) paypalLoadingHint.style.display = 'block';

    // Wait for SDK if not yet loaded
    if (!paypalSdkLoaded || typeof paypal === 'undefined') {
      if (paypalLoadingHint) paypalLoadingHint.textContent = currentLanguage === 'en'
        ? 'Loading payment methods...'
        : 'Cargando métodos de pago...';
      await new Promise(resolve => {
        const check = setInterval(() => {
          if (typeof paypal !== 'undefined') { clearInterval(check); resolve(); }
        }, 150);
        setTimeout(() => { clearInterval(check); resolve(); }, 8000);
      });
    }

    if (typeof paypal === 'undefined') {
      if (paypalLoadingHint) paypalLoadingHint.textContent = currentLanguage === 'en'
        ? '⚠️ Could not load PayPal. Check your internet connection.'
        : '⚠️ No se pudo cargar PayPal. Verifica tu conexión a internet.';
      return;
    }

    if (paypalLoadingHint) paypalLoadingHint.style.display = 'none';

    // Helper: show error message inside the modal (avoid native browser alerts)
    let paypalErrorHandled = false;
    function showPaypalError(msg) {
      paypalErrorHandled = true;
      showPaymentError(msg);
    }

    paypal.Buttons({
      style: {
        layout: 'vertical',
        color: 'gold',
        shape: 'rect',
        label: 'pay'
      },

      // Step 1: Create order on server
      createOrder: async () => {
        clearPaymentError();
        paypalErrorHandled = false;

        const resp = await fetch('/api/paypal/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ analysisId: currentAnalysisId, tier: currentTier })
        });
        const data = await resp.json();
        if (!resp.ok) {
          const msg = data.error || (currentLanguage === 'en' ? 'Could not create payment order.' : 'No se pudo crear la orden de pago.');
          showPaypalError(msg);
          throw new Error(msg); // PayPal needs a throw to abort, onError will be suppressed
        }
        return data.orderID;
      },

      // Step 2: Capture payment after buyer approves
      onApprove: async (data) => {
        // Show processing state
        paymentMethodsView.style.display = 'none';
        successPaymentView.style.display = 'flex';
        successPaymentIcon.style.display = 'none';
        successPaymentSpinner.style.display = 'block';
        successPaymentTitle.textContent = currentLanguage === 'en' ? 'Confirming Payment...' : 'Confirmando Pago...';
        successPaymentMessage.textContent = currentLanguage === 'en'
          ? 'PayPal is processing the transaction. Please wait...'
          : 'PayPal está procesando la transacción. Por favor espera...';

        try {
          const resp = await fetch('/api/paypal/capture-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderID: data.orderID,
              analysisId: currentAnalysisId,
              tier: currentTier,
              contact: pendingExpertContact
            })
          });
          const result = await resp.json();
          if (!resp.ok) throw new Error(result.error || 'Error al confirmar el pago.');

          if (currentTier === 'ai') {
            successPaymentTitle.textContent = currentLanguage === 'en' ? 'Generating CV...' : 'Generando CV...';
            successPaymentMessage.textContent = currentLanguage === 'en'
              ? 'Cintia is rewriting your profile with ATS keywords...'
              : 'Cintia está reescribiendo tu perfil con palabras clave ATS...';
          }

          // Show success
          successPaymentIcon.style.display = 'block';
          successPaymentSpinner.style.display = 'none';

          if (currentTier === 'ai') {
            successPaymentTitle.textContent = currentLanguage === 'en' ? '✅ CV Generated!' : '✅ ¡CV Generado!';
            successPaymentMessage.textContent = currentLanguage === 'en' ? 'Redirecting to your result...' : 'Redirigiendo a tu resultado...';
            await new Promise(resolve => setTimeout(resolve, 1500));
            checkoutModal.close();
            unlockOptimizedCv(result.optimizedText || optimizedContentText);

          } else if (currentTier === 'expert') {
            successPaymentTitle.textContent = currentLanguage === 'en' ? '✅ Payment Confirmed!' : '✅ ¡Pago Confirmado!';
            successPaymentMessage.textContent = currentLanguage === 'en'
              ? 'Your session has been registered. A Cintia expert will contact you within 24 hours to schedule your mentoring session.'
              : 'Tu sesión ha sido registrada. Un experto de Cintia te contactará en un máximo de 24 horas para coordinar tu sesión de asesoría.';
            
            if (expertWhatsappSupportBox) {
              expertWhatsappSupportBox.style.display = 'block';
              if (expertWhatsappNotice) {
                expertWhatsappNotice.innerHTML = currentLanguage === 'en'
                  ? 'If you have not received any message from us in the next 24 hours, write to us directly on WhatsApp for immediate assistance from our team.'
                  : 'Si no te ha llegado ningún mensaje nuestro en las próximas 24 horas, escríbenos directamente por WhatsApp para recibir ayuda inmediata de nuestro equipo.';
              }
              if (expertWhatsappBtn) {
                const waText = currentLanguage === 'en'
                  ? 'Hello Cintia team, I just paid for the human expert CV review on Cintia.pro and would like to schedule my session.'
                  : 'Hola Francisco / equipo de Cintia, acabo de pagar la asesoría de experto para mi CV en Cintia.pro y quisiera coordinar mi sesión.';
                expertWhatsappBtn.href = `https://wa.me/56930781181?text=${encodeURIComponent(waText)}`;
                expertWhatsappBtn.innerHTML = `
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>
                  ${currentLanguage === 'en' ? 'Chat on WhatsApp' : 'Escribir por WhatsApp'}
                `;
              }
            }

            expertEmail.value = '';
            expertPhone.value = '';
            pendingExpertContact = null;
          }

        } catch (err) {
          // Roll back to payment view on error
          paymentMethodsView.style.display = 'flex';
          successPaymentView.style.display = 'none';
          await initPayPalButtons(amount);
          showPaypalError('❌ ' + err.message);
        }
      },

      onCancel: () => {
        console.log('PayPal payment cancelled by user.');
      },

      onError: (err) => {
        console.error('PayPal SDK error:', err);
        // Only show error to user if createOrder/onApprove didn’t already handle it
        if (!paypalErrorHandled) {
          showPaypalError(currentLanguage === 'en'
            ? '⚠️ An unexpected error occurred. Please try again or refresh the page.'
            : '⚠️ Ocurrió un error inesperado. Por favor inténtalo nuevamente o recarga la página.');
        }
      }

    }).render('#paypalButtonContainer');
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

  // Unlock CTA button listener in the blurred preview card
  if (unlockActionBtn) {
    unlockActionBtn.addEventListener('click', () => {
      currentTier = 'ai';
      pendingExpertContact = null;
      openCheckout(
        currentLanguage === 'en' ? 'Instant AI CV Optimization' : 'Optimización instantánea con IA',
        appConfig.priceAi.toFixed(2)
      );
    });
  }

  // ─── End PayPal Checkout Flow ──────────────────────────────────────────────

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

  // Clean Markdown to pristine plain text for .txt download and clipboard
  function cleanMarkdownToPlainText(text) {
    if (!text) return '';

    let clean = text;

    // 1. Remove code blocks indicators (```markdown, ```text, ```)
    clean = clean.replace(/```[a-zA-Z0-9_-]*\n?/g, '').replace(/```/g, '');

    // 2. Remove Github-style alerts (> [!NOTE], > [!TIP], etc.)
    clean = clean.replace(/^>\s*\[![A-Z]+\]\s*\n?/gm, '');

    // 3. Format / clean headers: #, ##, ###, ####, etc.
    clean = clean.replace(/^#\s+(.+)$/gm, (match, p1) => `${p1.toUpperCase()}\n${'='.repeat(Math.min(p1.length, 60))}`);
    clean = clean.replace(/^##\s+(.+)$/gm, (match, p1) => `\n${p1.toUpperCase()}\n${'-'.repeat(Math.min(p1.length, 60))}`);
    clean = clean.replace(/^###\s+(.+)$/gm, (match, p1) => `\n${p1.toUpperCase()}`);
    clean = clean.replace(/^#{4,6}\s+(.+)$/gm, (match, p1) => `\n${p1}`);

    // 4. Clean Markdown Links: [Text](mailto:Email), [Text](tel:Phone), [Text](URL)
    clean = clean.replace(/\[([^\]]+)\]\(mailto:([^)]+)\)/gi, (match, label, email) => email || label);
    clean = clean.replace(/\[([^\]]+)\]\(tel:([^)]+)\)/gi, (match, label, phone) => phone || label);
    clean = clean.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label, url) => {
      if (label.trim() === url.trim() || url.startsWith('#')) return label;
      return `${label} (${url})`;
    });

    // 5. Remove bold & italic markdown markers (**text**, *text*, __text__, _text_)
    clean = clean.replace(/\*\*\*([^*]+)\*\*\*/g, '$1');
    clean = clean.replace(/\*\*([^*]+)\*\*/g, '$1');
    clean = clean.replace(/\*([^*\n]+)\*/g, '$1');
    clean = clean.replace(/___([^_]+)___/g, '$1');
    clean = clean.replace(/__([^_]+)__/g, '$1');
    clean = clean.replace(/_([^_\n]+)_/g, '$1');

    // 6. Clean inline code `code`
    clean = clean.replace(/`([^`]+)`/g, '$1');

    // 7. Format horizontal rules (---, ***, ___)
    clean = clean.replace(/^(?:---|___|\*\*\*)\s*$/gm, '------------------------------------------------------------');

    // 8. Clean bullet list markers (*, -, +) to clean bullet symbols •
    clean = clean.replace(/^[\s]*[\*\-\+]\s+/gm, '•  ');

    // 9. Clean blockquotes (> text)
    clean = clean.replace(/^>\s?/gm, '');

    // 10. Normalize consecutive line breaks (max 2)
    clean = clean.replace(/\n{3,}/g, '\n\n');

    return clean.trim();
  }

  // Unlocked copy & download actions
  if (unlockedCopyBtn) {
    unlockedCopyBtn.addEventListener('click', () => {
      const plainText = cleanMarkdownToPlainText(optimizedContentText);
      navigator.clipboard.writeText(plainText)
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
      const plainText = cleanMarkdownToPlainText(optimizedContentText);
      const element = document.createElement('a');
      const file = new Blob([plainText], { type: 'text/plain;charset=utf-8' });
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
      const plainText = cleanMarkdownToPlainText(optimizedContentText);
      navigator.clipboard.writeText(plainText)
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
      const plainText = cleanMarkdownToPlainText(optimizedContentText);
      const element = document.createElement('a');
      const file = new Blob([plainText], { type: 'text/plain;charset=utf-8' });
      element.href = URL.createObjectURL(file);
      element.download = `CV_Optimizado_${activeFile ? activeFile.name.replace(/\.[^/.]+$/, "") : "Cintia"}.txt`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    });
  }

  // Helper parser for markdown in card feedback and summaries
  function parseFeedbackMarkdown(text) {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/__([^_]+)__/g, '<strong>$1</strong>')
      .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
      .replace(/_([^_\n]+)_/g, '<em>$1</em>');
  }
});

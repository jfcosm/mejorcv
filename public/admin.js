document.addEventListener('DOMContentLoaded', () => {
  // Authentication Elements
  const loginArea = document.getElementById('loginArea');
  const loginForm = document.getElementById('loginForm');
  const adminEmailInput = document.getElementById('adminEmail');
  const adminPasswordInput = document.getElementById('adminPassword');
  const loginError = document.getElementById('loginError');
  
  // Dashboard Elements
  const adminHeader = document.getElementById('adminHeader');
  const adminDashboard = document.getElementById('adminDashboard');
  const logoutBtn = document.getElementById('logoutBtn');
  
  // Statistics Elements
  const statVisits = document.getElementById('statVisits');
  const statAnalyses = document.getElementById('statAnalyses');
  const statPaidAi = document.getElementById('statPaidAi');
  const statPaidCoverLetter = document.getElementById('statPaidCoverLetter');
  const statPaidHeadshots = document.getElementById('statPaidHeadshots');
  const statExpertPending = document.getElementById('statExpertPending');
  const statRevenue = document.getElementById('statRevenue');
  const statGeminiCalls = document.getElementById('statGeminiCalls');
  const statGeminiSub = document.getElementById('statGeminiSub');
  const geminiHealthDot = document.getElementById('geminiHealthDot');
  
  // Gemini Health Widget Elements
  const geminiHealthDotWidget = document.getElementById('geminiHealthDotWidget');
  const geminiHealthStatusText = document.getElementById('geminiHealthStatusText');
  const geminiActiveModelCode = document.getElementById('geminiActiveModelCode');
  const geminiCallsCount = document.getElementById('geminiCallsCount');
  const testGeminiBtn = document.getElementById('testGeminiBtn');
  const geminiTestOutput = document.getElementById('geminiTestOutput');
  
  // Tables & Leads Views
  const recentActivityTableBody = document.querySelector('#recentActivityTable tbody');
  const historyTableBody = document.querySelector('#historyTable tbody');
  const leadsTableBody = document.querySelector('#leadsTable tbody');
  
  // Leads Dual View Mode & Archive Switcher
  const viewModeListBtn = document.getElementById('viewModeListBtn');
  const viewModeBoardBtn = document.getElementById('viewModeBoardBtn');
  const leadsListView = document.getElementById('leadsListView');
  const leadsBoardView = document.getElementById('leadsBoardView');
  const leadsArchiveFilter = document.getElementById('leadsArchiveFilter');
  const leadsActiveCount = document.getElementById('leadsActiveCount');
  const leadsArchivedCount = document.getElementById('leadsArchivedCount');
  const leadsTotalCount = document.getElementById('leadsTotalCount');
  let currentLeadsArchiveMode = 'active';

  // History Toolbar & Pagination Elements
  const historySearchInput = document.getElementById('historySearchInput');
  const historyPaymentFilter = document.getElementById('historyPaymentFilter');
  const historyRatingFilter = document.getElementById('historyRatingFilter');
  const historyTimeFilter = document.getElementById('historyTimeFilter');
  const historyResetFiltersBtn = document.getElementById('historyResetFiltersBtn');
  const historyPageSize = document.getElementById('historyPageSize');
  const historyShowingCount = document.getElementById('historyShowingCount');
  const historyPageInfo = document.getElementById('historyPageInfo');
  const historyFirstPageBtn = document.getElementById('historyFirstPageBtn');
  const historyPrevPageBtn = document.getElementById('historyPrevPageBtn');
  const historyNextPageBtn = document.getElementById('historyNextPageBtn');
  const historyLastPageBtn = document.getElementById('historyLastPageBtn');

  let rawDocLog = [];
  let historySearchQuery = '';
  let historyPaymentFilterVal = 'all';
  let historyRatingFilterVal = 'all';
  let historyTimeFilterVal = 'all';
  let historyCurrentPage = 1;
  let historyPageSizeVal = 25;

  // Kanban Board Columns & Badges (Doing vs Done)
  const cardsDoing = document.getElementById('cardsDoing');
  const cardsDone = document.getElementById('cardsDone');
  const badgeDoing = document.getElementById('badgeDoing');
  const badgeDone = document.getElementById('badgeDone');
  
  // Settings Form
  const settingsForm = document.getElementById('settingsForm');
  const setGeminiKey = document.getElementById('setGeminiKey');
  const setPriceAi = document.getElementById('setPriceAi');
  const setPriceCoverLetter = document.getElementById('setPriceCoverLetter');
  const setPriceHeadshots = document.getElementById('setPriceHeadshots');
  const setPriceExpert = document.getElementById('setPriceExpert');
  const setPriceAiClp = document.getElementById('setPriceAiClp');
  const setPriceCoverLetterClp = document.getElementById('setPriceCoverLetterClp');
  const setPriceHeadshotsClp = document.getElementById('setPriceHeadshotsClp');
  const setPriceExpertClp = document.getElementById('setPriceExpertClp');
  const setHeadshotsPackSize = document.getElementById('setHeadshotsPackSize');
  const setHeadshotsResolution = document.getElementById('setHeadshotsResolution');
  const setHeadshotCatCorp = document.getElementById('setHeadshotCatCorp');
  const setHeadshotCatCasual = document.getElementById('setHeadshotCatCasual');
  const setHeadshotCatTech = document.getElementById('setHeadshotCatTech');
  const setHeadshotCatEdit = document.getElementById('setHeadshotCatEdit');
  const setHeadshotsPrompt = document.getElementById('setHeadshotsPrompt');
  const setRateLimit = document.getElementById('setRateLimit');
  const setAdminPassword = null;
  const setCaptchaEnabled = document.getElementById('setCaptchaEnabled');
  const setOptAiEnabled = document.getElementById('setOptAiEnabled');
  const setOptCoverLetterEnabled = document.getElementById('setOptCoverLetterEnabled');
  const setOptHeadshotsEnabled = document.getElementById('setOptHeadshotsEnabled');
  const setOptExpertEnabled = document.getElementById('setOptExpertEnabled');
  const setEvalPrompt = document.getElementById('setEvalPrompt');
  const setOptPrompt = document.getElementById('setOptPrompt');
  const setCoverLetterPrompt = document.getElementById('setCoverLetterPrompt');
  const settingsMessage = document.getElementById('settingsMessage');
  
  // Modal Elements
  const viewTextModal = document.getElementById('viewTextModal');
  const cvModalDocTitle = document.getElementById('cvModalDocTitle');
  const cvModalDocMeta = document.getElementById('cvModalDocMeta');
  const tabBtnOriginal = document.getElementById('tabBtnOriginal');
  const tabBtnOptimized = document.getElementById('tabBtnOptimized');
  const tabBtnCoverLetter = document.getElementById('tabBtnCoverLetter');
  const cvTextContentBox = document.getElementById('cvTextContentBox');
  const copyModalTextBtn = document.getElementById('copyModalTextBtn');
  const downloadModalOriginalBtn = document.getElementById('downloadModalOriginalBtn');
  const downloadModalOptimizedBtn = document.getElementById('downloadModalOptimizedBtn');
  const downloadModalCoverLetterBtn = document.getElementById('downloadModalCoverLetterBtn');
  const closeTextModalBtn = document.getElementById('closeTextModalBtn');

  let currentInspectionDoc = null;
  let currentInspectionTab = 'original';

  // Admin Session Token
  let adminToken = localStorage.getItem('adminToken');

  // Check auth initially
  if (adminToken) {
    verifySession();
  } else {
    showLogin();
  }

  // 1. Session Verification
  async function verifySession() {
    try {
      const response = await fetch('/api/admin/stats', {
        headers: { 'Authorization': adminToken }
      });
      if (response.ok) {
        showDashboard();
      } else {
        localStorage.removeItem('adminToken');
        adminToken = null;
        showLogin();
      }
    } catch (err) {
      console.error('Session check failed:', err);
      showLogin();
    }
  }

  function showLogin() {
    loginArea.style.display = 'block';
    adminHeader.style.display = 'none';
    adminDashboard.style.display = 'none';
  }

  function showDashboard() {
    loginArea.style.display = 'none';
    adminHeader.style.display = 'block';
    adminDashboard.style.display = 'block';
    loadStats();
    loadSettings();
  }

  // 2. Login Submit Handler
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.style.display = 'none';
    const email = adminEmailInput.value;
    const password = adminPasswordInput.value;

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Credenciales incorrectas.');
      }

      adminToken = data.token;
      localStorage.setItem('adminToken', adminToken);
      adminEmailInput.value = '';
      adminPasswordInput.value = '';
      showDashboard();

    } catch (err) {
      loginError.textContent = err.message;
      loginError.style.display = 'block';
    }
  });

  // 9. Test Gemini API Connection Button
  if (testGeminiBtn) {
    testGeminiBtn.addEventListener('click', async () => {
      testGeminiBtn.disabled = true;
      const originalHtml = testGeminiBtn.innerHTML;
      testGeminiBtn.textContent = 'Diagnosticando...';
      
      geminiTestOutput.style.display = 'block';
      geminiTestOutput.style.background = '#f1f5f9';
      geminiTestOutput.style.color = '#334155';
      geminiTestOutput.style.border = '1px solid #cbd5e1';
      geminiTestOutput.textContent = 'Enviando petición de diagnóstico a Google Gemini API...';

      try {
        const response = await fetch('/api/admin/test-gemini', {
          headers: { 'Authorization': adminToken }
        });
        const data = await response.json();

        if (response.ok && data.success) {
          geminiTestOutput.style.background = '#d1fae5';
          geminiTestOutput.style.color = '#065f46';
          geminiTestOutput.style.border = '1px solid rgba(16, 185, 129, 0.3)';
          geminiTestOutput.innerHTML = `✓ <strong>${data.message}</strong> (Latencia: <strong>${data.latencyMs} ms</strong>, Respuesta: "<code>${data.responsePreview}</code>")`;
          
          if (geminiHealthDotWidget) geminiHealthDotWidget.style.background = '#10b981';
          if (geminiHealthStatusText) geminiHealthStatusText.textContent = 'Estado API: Conectada y Operativa';
          if (geminiHealthDot) geminiHealthDot.style.background = '#10b981';
        } else {
          geminiTestOutput.style.background = '#fee2e2';
          geminiTestOutput.style.color = '#991b1b';
          geminiTestOutput.style.border = '1px solid rgba(239, 68, 68, 0.3)';
          geminiTestOutput.innerHTML = `✕ <strong>Fallo en la prueba:</strong> ${data.error || 'No se pudo conectar con Gemini.'}`;
          
          if (geminiHealthDotWidget) geminiHealthDotWidget.style.background = '#ef4444';
          if (geminiHealthStatusText) geminiHealthStatusText.textContent = 'Estado API: Error en conexión';
          if (geminiHealthDot) geminiHealthDot.style.background = '#ef4444';
        }
      } catch (err) {
        geminiTestOutput.style.background = '#fee2e2';
        geminiTestOutput.style.color = '#991b1b';
        geminiTestOutput.style.border = '1px solid rgba(239, 68, 68, 0.3)';
        geminiTestOutput.innerHTML = `✕ <strong>Error de red:</strong> ${err.message}`;
      } finally {
        testGeminiBtn.disabled = false;
        testGeminiBtn.innerHTML = originalHtml;
        loadStats();
      }
    });
  }

  // 10. Navigation Tabs
  const adminTabs = document.querySelectorAll('.admin-tab');
  const adminPanels = document.querySelectorAll('.admin-panel');

  adminTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      adminTabs.forEach(t => t.classList.remove('active'));
      adminPanels.forEach(p => p.classList.remove('active'));

      tab.classList.add('active');
      const targetId = tab.getAttribute('data-target');
      document.getElementById(targetId).classList.add('active');
    });
  });

  // Leads View Mode Switcher Logic (List vs Board)
  let currentLeadsViewMode = localStorage.getItem('adminLeadsViewMode') || 'list';

  function applyLeadsViewMode(mode) {
    currentLeadsViewMode = mode;
    localStorage.setItem('adminLeadsViewMode', mode);

    if (mode === 'board') {
      if (viewModeBoardBtn) viewModeBoardBtn.classList.add('active');
      if (viewModeListBtn) viewModeListBtn.classList.remove('active');
      if (leadsBoardView) leadsBoardView.style.display = 'block';
      if (leadsListView) leadsListView.style.display = 'none';
    } else {
      if (viewModeListBtn) viewModeListBtn.classList.add('active');
      if (viewModeBoardBtn) viewModeBoardBtn.classList.remove('active');
      if (leadsListView) leadsListView.style.display = 'block';
      if (leadsBoardView) leadsBoardView.style.display = 'none';
    }
  }

  if (viewModeListBtn) viewModeListBtn.addEventListener('click', () => applyLeadsViewMode('list'));
  if (viewModeBoardBtn) viewModeBoardBtn.addEventListener('click', () => applyLeadsViewMode('board'));

  // Apply saved view mode initially
  applyLeadsViewMode(currentLeadsViewMode);

  // 11. Logout
  logoutBtn.addEventListener('click', async () => {
    try {
      await fetch('/api/admin/logout', {
        method: 'POST',
        headers: { 'Authorization': adminToken }
      });
    } catch (e) {
      // Ignore
    }
    localStorage.removeItem('adminToken');
    adminToken = null;
    showLogin();
  });

  // Helper to render copy email and whatsapp quick action buttons
  function renderContactColumn(expertContact) {
    if (!expertContact) return '<span style="color:var(--text-light); font-size:12px;">-</span>';
    
    const emailEscaped = escapeHtml(expertContact.email || '');
    const phoneEscaped = escapeHtml(expertContact.phone || '');
    const cleanPhone = (expertContact.phone || '').replace(/[^0-9]/g, '');
    
    return `
      <div style="display:flex; flex-direction:column; gap:2px; max-width:180px;">
        ${emailEscaped ? `<span style="font-weight:600; color:var(--text-dark); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${emailEscaped}">${emailEscaped}</span>` : ''}
        ${phoneEscaped ? `<span style="font-size:11px; color:var(--text-medium);">${phoneEscaped}</span>` : ''}
        <div style="display:flex; gap:6px; margin-top:3px;">
          ${emailEscaped ? `
            <button type="button" class="btn-secondary btn-sm copy-email-btn" data-email="${emailEscaped}" style="padding:1px 6px; font-size:10px; border-radius:4px; margin:0;" title="Copiar correo">
              Copiar
            </button>` : ''}
          ${cleanPhone ? `
            <a href="https://wa.me/${cleanPhone}" target="_blank" class="btn-secondary btn-sm" style="padding:1px 6px; font-size:10px; border-radius:4px; margin:0; text-decoration:none; color:#25d366; border-color:rgba(37,211,102,0.3);" title="Abrir WhatsApp">
              WhatsApp
            </a>` : ''}
        </div>
      </div>
    `;
  }

  // 5. Load stats and history tables
  async function loadStats() {
    try {
      const response = await fetch('/api/admin/stats', {
        headers: { 'Authorization': adminToken }
      });
      if (!response.ok) throw new Error('Could not fetch stats');
      const data = await response.json();

      // Set statistics with safe fallbacks
      const stats = data.stats || {};
      statVisits.textContent = stats.totalVisits ?? 0;
      statAnalyses.textContent = data.stats.totalAnalyses;
      statPaidAi.textContent = data.stats.paidAi;
      if (statPaidCoverLetter) statPaidCoverLetter.textContent = data.stats.paidCoverLetter || 0;
      if (statPaidHeadshots) statPaidHeadshots.textContent = data.stats.paidHeadshots || 0;
      statExpertPending.textContent = data.stats.paidExpertPending;
      statRevenue.textContent = `$${data.stats.totalRevenue.toFixed(2)} USD`;

      // Set Gemini usage statistics
      if (stats.geminiStats) {
        const gStats = stats.geminiStats;
        if (statGeminiCalls) statGeminiCalls.textContent = gStats.totalCalls || 0;
        if (statGeminiSub) statGeminiSub.textContent = `${gStats.evaluations || 0} eval / ${gStats.optimizations || 0} opt`;
        
        const isConfigured = !!gStats.isConfigured;
        const statusColor = isConfigured ? '#10b981' : '#ef4444';
        
        if (geminiHealthDot) geminiHealthDot.style.background = statusColor;
        if (geminiHealthDotWidget) geminiHealthDotWidget.style.background = statusColor;
        if (geminiHealthStatusText) {
          geminiHealthStatusText.textContent = isConfigured ? 'Estado API: Conectada y Lista' : 'Estado API: Sin API Key Configurada';
        }
        if (geminiActiveModelCode) geminiActiveModelCode.textContent = gStats.lastModel || 'gemini-2.5-flash';
        if (geminiCallsCount) geminiCallsCount.textContent = gStats.totalCalls || 0;
      }

      rawDocLog = Array.isArray(data.documentLog) ? data.documentLog : [];

      // Render Recent Table (max 5 rows)
      recentActivityTableBody.innerHTML = '';
      const recent = rawDocLog.slice(0, 5);
      if (recent.length === 0) {
        recentActivityTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No hay actividad registrada aún.</td></tr>';
      } else {
        recent.forEach(row => {
          recentActivityTableBody.innerHTML += `
            <tr>
              <td><strong>${escapeHtml(row.filename)}</strong></td>
              <td>${formatDate(row.uploadedAt)}</td>
              <td>${'★'.repeat(row.rating)}${'☆'.repeat(5 - row.rating)}</td>
              <td>${getPaymentBadge(row.paymentStatus)}</td>
              <td><code style="font-size:11px;">${row.ip}</code></td>
            </tr>
          `;
        });
      }

      // Render History Table & Leads Views
      renderHistoryTable();
      renderLeadsViews();

    } catch (err) {
      console.error(err);
      alert('Error al cargar estadísticas.');
    }
  }

  // Filter and Paginate History
  function getFilteredHistoryLog() {
    return rawDocLog.filter(row => {
      // 1. Search Query
      if (historySearchQuery) {
        const matchName = (row.filename || '').toLowerCase().includes(historySearchQuery);
        const matchId = (row.id || '').toLowerCase().includes(historySearchQuery);
        const matchIp = (row.ip || '').toLowerCase().includes(historySearchQuery);
        const matchEmail = (row.expertContact?.email || '').toLowerCase().includes(historySearchQuery);
        const matchPhone = (row.expertContact?.phone || '').toLowerCase().includes(historySearchQuery);
        if (!matchName && !matchId && !matchIp && !matchEmail && !matchPhone) {
          return false;
        }
      }

      // 2. Payment Status Filter
      if (historyPaymentFilterVal !== 'all') {
        const isAiPaid = Boolean(row.hasAiPaid === true || row.paymentStatus === 'completed_ai');
        const isCoverLetterPaid = Boolean(row.hasCoverLetterPaid === true || row.paymentStatus === 'completed_cover_letter');
        const isHeadshotsPaid = Boolean(row.hasHeadshotsPaid === true || row.paymentStatus === 'completed_headshots');
        const isExpertPending = Boolean((row.hasExpertPaid && row.expertStatus === 'pending') || row.paymentStatus === 'pending_expert' || row.paymentStatus === 'paid_expert' || (row.expertContact && row.expertStatus !== 'completed'));
        const isExpertDone = Boolean((row.hasExpertPaid && row.expertStatus === 'completed') || row.paymentStatus === 'completed_expert');
        const isFree = !isAiPaid && !isCoverLetterPaid && !isHeadshotsPaid && !row.hasExpertPaid && row.paymentStatus === 'free';

        if (historyPaymentFilterVal === 'paid_ai' && !isAiPaid) return false;
        if (historyPaymentFilterVal === 'paid_cover_letter' && !isCoverLetterPaid) return false;
        if (historyPaymentFilterVal === 'paid_headshots' && !isHeadshotsPaid) return false;
        if (historyPaymentFilterVal === 'paid_expert_pending' && !isExpertPending) return false;
        if (historyPaymentFilterVal === 'paid_expert_completed' && !isExpertDone) return false;
        if (historyPaymentFilterVal === 'free' && !isFree) return false;
      }

      // 3. Rating Filter
      if (historyRatingFilterVal !== 'all') {
        if (row.rating !== parseInt(historyRatingFilterVal, 10)) {
          return false;
        }
      }

      // 4. Time Filter
      if (historyTimeFilterVal !== 'all') {
        const uploadTime = new Date(row.uploadedAt || 0).getTime();
        const now = Date.now();
        if (historyTimeFilterVal === '7d' && (now - uploadTime > 7 * 86400000)) return false;
        if (historyTimeFilterVal === '30d' && (now - uploadTime > 30 * 86400000)) return false;
      }

      return true;
    });
  }

  function renderHistoryTable() {
    if (!historyTableBody) return;
    const filtered = getFilteredHistoryLog();
    const totalCount = filtered.length;
    const totalPages = Math.ceil(totalCount / historyPageSizeVal) || 1;

    if (historyCurrentPage > totalPages) historyCurrentPage = totalPages;
    if (historyCurrentPage < 1) historyCurrentPage = 1;

    const startIndex = (historyCurrentPage - 1) * historyPageSizeVal;
    const endIndex = Math.min(startIndex + historyPageSizeVal, totalCount);
    const pageItems = filtered.slice(startIndex, endIndex);

    historyTableBody.innerHTML = '';
    if (totalCount === 0) {
      historyTableBody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:24px; color:var(--text-light);">No se encontraron currículums con los filtros seleccionados.</td></tr>';
    } else {
      pageItems.forEach(row => {
        const contact = renderContactColumn(row.expertContact);
        
        let actionBtn = `<button class="btn-secondary btn-sm cv-text-btn" data-id="${row.id}">Ver Texto</button>`;
        if (row.paymentStatus === 'pending_expert') {
          actionBtn += ` <button class="btn btn-sm complete-expert-btn" style="background-color:#059669; margin-top:0;" data-id="${row.id}">Marcar Entregado</button>`;
        }
        
        historyTableBody.innerHTML += `
          <tr>
            <td>
              <div style="display:flex; align-items:center; gap:8px;">
                ${row.archived ? '<span title="Archivado" style="font-size:13px; opacity:0.8;">📦</span>' : ''}
                <div>
                  <div style="font-weight:700; color:var(--text-dark); max-width:240px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHtml(row.filename)}">
                    ${escapeHtml(row.filename)}
                  </div>
                  <div style="font-size:11px; color:var(--text-light); margin-top:2px;">
                    ${(row.fileSize / 1024).toFixed(1)} KB
                  </div>
                </div>
              </div>
            </td>
            <td>${formatDate(row.uploadedAt)}</td>
            <td><span style="color:#f59e0b; font-size:13px; letter-spacing:1px;">${'★'.repeat(row.rating)}${'☆'.repeat(5 - row.rating)}</span></td>
            <td>${getPaymentBadge(row.paymentStatus)}</td>
            <td>${contact}</td>
            <td><code style="font-size:11px; color:var(--text-medium);">${row.ip}</code></td>
            <td style="text-align:right;">
              <div class="actions-cell" style="justify-content:flex-end;">
                ${actionBtn}
                <a href="/api/admin/download-text/${row.id}" headers='{"Authorization":"${adminToken}"}' download class="btn-secondary btn-sm" style="display:inline-flex; align-items:center; text-decoration:none; padding:4px 8px;" title="Descargar texto original">Bajar</a>
                <button type="button" class="btn-secondary btn-sm btn-action-delete doc-delete-btn" data-id="${row.id}" data-filename="${escapeHtml(row.filename)}" style="padding:4px 8px;" title="Eliminar registro">🗑️</button>
              </div>
            </td>
          </tr>
        `;
      });
    }

    // Update Pagination UI
    if (historyShowingCount) {
      historyShowingCount.textContent = totalCount === 0 
        ? 'Mostrando 0 de 0' 
        : `Mostrando ${startIndex + 1} - ${endIndex} de ${totalCount} currículums`;
    }
    if (historyPageInfo) {
      historyPageInfo.textContent = `Página ${historyCurrentPage} de ${totalPages}`;
    }
    if (historyFirstPageBtn) historyFirstPageBtn.disabled = historyCurrentPage <= 1;
    if (historyPrevPageBtn) historyPrevPageBtn.disabled = historyCurrentPage <= 1;
    if (historyNextPageBtn) historyNextPageBtn.disabled = historyCurrentPage >= totalPages;
    if (historyLastPageBtn) historyLastPageBtn.disabled = historyCurrentPage >= totalPages;

    attachRowActionListeners();
  }

  // Render Leads Table & Kanban Board (Doing vs Done)
  function renderLeadsViews() {
    if (!leadsTableBody) return;

    // Update Count Badges
    const activeLeads = rawDocLog.filter(r => !r.archived);
    const archivedLeads = rawDocLog.filter(r => Boolean(r.archived));
    const totalLeadsCount = rawDocLog.length;

    if (leadsActiveCount) leadsActiveCount.textContent = activeLeads.length;
    if (leadsArchivedCount) leadsArchivedCount.textContent = archivedLeads.length;
    if (leadsTotalCount) leadsTotalCount.textContent = totalLeadsCount;

    // Filter leads based on current archive filter
    let visibleLeads = activeLeads;
    if (currentLeadsArchiveMode === 'archived') {
      visibleLeads = archivedLeads;
    } else if (currentLeadsArchiveMode === 'all') {
      visibleLeads = rawDocLog;
    }

    // 1. Render Table View
    leadsTableBody.innerHTML = '';
    if (visibleLeads.length === 0) {
      leadsTableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:24px; color:var(--text-light);">${currentLeadsArchiveMode === 'archived' ? 'No hay leads archivados.' : 'No hay leads activos.'}</td></tr>`;
    } else {
      visibleLeads.forEach(row => {
        const isAiPaid = Boolean(row.hasAiPaid === true || row.paymentStatus === 'completed_ai');
        const isCoverLetterPaid = Boolean(row.hasCoverLetterPaid === true || row.paymentStatus === 'completed_cover_letter');
        const isExpertPending = Boolean((row.hasExpertPaid && row.expertStatus === 'pending') || row.paymentStatus === 'pending_expert' || row.paymentStatus === 'paid_expert' || (row.expertContact && row.expertStatus !== 'completed'));
        const isExpertDone = Boolean((row.hasExpertPaid && row.expertStatus === 'completed') || row.paymentStatus === 'completed_expert');

        const contact = row.expertContact 
          ? renderContactColumn(row.expertContact) 
          : (isAiPaid ? '<span style="color:var(--text-light);">Descarga Directa (IA)</span>' : '<span style="color:var(--text-light);">Sin contacto (Gratis)</span>');
        
        let statusBadges = [];
        if (row.archived) {
          statusBadges.push('<span class="badge" style="background-color:#e2e8f0; color:#475569; font-weight:600;">📦 Archivado</span>');
        }
        if (isAiPaid) {
          statusBadges.push('<span class="badge ai" style="background-color: var(--color-mint-light); color: var(--color-mint-hover); border: 1px solid rgba(16, 185, 129, 0.2); font-weight:600;">Optimizado IA</span>');
        }
        if (isCoverLetterPaid) {
          statusBadges.push('<span class="badge cover-letter" style="background-color:#ede9fe; color:#6d28d9; border: 1px solid rgba(109, 40, 217, 0.2); font-weight:600;">Carta Presentación</span>');
        }
        if (isExpertPending) {
          statusBadges.push('<span class="badge pending" style="background-color: #fef3c7; color: #d97706; border: 1px solid rgba(217, 119, 6, 0.2); font-weight:600;">Experto: Pendiente</span>');
        }
        if (isExpertDone) {
          statusBadges.push('<span class="badge completed" style="background-color: #d1fae5; color: #065f46; border: 1px solid rgba(6, 95, 70, 0.2); font-weight:600;">Experto: Entregado</span>');
        }
        if (statusBadges.length === 0 || (statusBadges.length === 1 && row.archived)) {
          statusBadges.push('<span class="badge free" style="background-color:#f1f5f9; color:#475569; font-weight:600;">Evaluación Gratuita</span>');
        }

        let serviceName = 'Evaluación Gratuita';
        if (row.hasExpertPaid || row.paymentStatus.includes('expert')) {
          serviceName = (row.hasAiPaid || row.paymentStatus === 'completed_ai') ? 'Experto ($25) + IA ($1)' : 'Experto Humano ($25)';
        } else if (isAiPaid) {
          serviceName = 'IA ($1)';
        }

        let actionBtn = `<button class="btn-secondary btn-sm cv-text-btn" data-id="${row.id}">Ver Texto</button>`;
        if (isExpertPending) {
          actionBtn += ` <button class="btn btn-sm complete-expert-btn" style="background-color:#059669; margin-top:0;" data-id="${row.id}">Marcar como Entregado</button>`;
        }
        actionBtn += ` <button type="button" class="btn-secondary btn-sm btn-action-archive lead-archive-btn" data-id="${row.id}" data-archived="${row.archived ? 'true' : 'false'}" title="${row.archived ? 'Desarchivar lead' : 'Archivar lead'}">${row.archived ? '📦 Desarchivar' : '📦 Archivar'}</button>`;
        actionBtn += ` <button type="button" class="btn-secondary btn-sm btn-action-delete doc-delete-btn" data-id="${row.id}" data-filename="${escapeHtml(row.filename)}" title="Eliminar lead permanentemente">🗑️</button>`;

        leadsTableBody.innerHTML += `
          <tr>
            <td>
              <div style="display:flex; align-items:center; gap:8px;">
                ${row.archived ? '<span title="Archivado" style="font-size:13px; opacity:0.8;">📦</span>' : ''}
                <div>
                  <div style="font-weight:700; color:var(--text-dark); max-width:240px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHtml(row.filename)}">
                    ${escapeHtml(row.filename)}
                  </div>
                  <div style="font-size:11px; color:var(--text-light); margin-top:2px;">
                    ${(row.fileSize / 1024).toFixed(1)} KB
                  </div>
                </div>
              </div>
            </td>
            <td style="font-weight:600; font-size:12px;">${serviceName}</td>
            <td>${formatDate(row.uploadedAt)}</td>
            <td>${contact}</td>
            <td>${statusBadges.join(' ')}</td>
            <td><span style="color:#f59e0b; font-size:13px; letter-spacing:1px;">${'★'.repeat(row.rating)}${'☆'.repeat(5 - row.rating)}</span></td>
            <td style="text-align:right;">
              <div class="actions-cell" style="justify-content:flex-end;">
                ${actionBtn}
              </div>
            </td>
          </tr>
        `;
      });
    }

    // 2. Render Kanban Board View (filtered)
    if (cardsDoing) cardsDoing.innerHTML = '';
    if (cardsDone) cardsDone.innerHTML = '';

    const doingList = [];
    const doneList = [];

    visibleLeads.forEach(row => {
      const isAiPaid = Boolean(row.hasAiPaid === true || row.paymentStatus === 'completed_ai');
      const isCoverLetterPaid = Boolean(row.hasCoverLetterPaid === true || row.paymentStatus === 'completed_cover_letter');
      const isHeadshotsPaid = Boolean(row.hasHeadshotsPaid === true || row.paymentStatus === 'completed_headshots');
      const isExpertPending = Boolean((row.hasExpertPaid && row.expertStatus === 'pending') || row.paymentStatus === 'pending_expert' || row.paymentStatus === 'paid_expert' || (row.expertContact && row.expertStatus !== 'completed'));
      const isExpertDone = Boolean((row.hasExpertPaid && row.expertStatus === 'completed') || row.paymentStatus === 'completed_expert');

      if (isExpertDone || ((isAiPaid || isCoverLetterPaid || isHeadshotsPaid) && !row.hasExpertPaid)) {
        doneList.push(row);
      } else {
        doingList.push(row);
      }
    });

    if (badgeDoing) badgeDoing.textContent = doingList.length;
    if (badgeDone) badgeDone.textContent = doneList.length;

    renderKanbanCards(doingList, cardsDoing, true);
    renderKanbanCards(doneList, cardsDone, false);

    attachRowActionListeners();
  }

  function renderKanbanCards(list, container, isDoingColumn = false) {
    if (!container) return;
    if (list.length === 0) {
      container.innerHTML = '<div class="kanban-empty-hint">Sin registros en esta columna</div>';
      return;
    }
    list.forEach(row => {
      const isAiPaid = Boolean(row.hasAiPaid === true || row.paymentStatus === 'completed_ai');
      const isCoverLetterPaid = Boolean(row.hasCoverLetterPaid === true || row.paymentStatus === 'completed_cover_letter');
      const isExpertPending = Boolean((row.hasExpertPaid && row.expertStatus === 'pending') || row.paymentStatus === 'pending_expert' || row.paymentStatus === 'paid_expert' || (row.expertContact && row.expertStatus !== 'completed'));
      const isExpertDone = Boolean((row.hasExpertPaid && row.expertStatus === 'completed') || row.paymentStatus === 'completed_expert');

      const cleanPhone = row.expertContact?.phone ? row.expertContact.phone.replace(/[^0-9]/g, '') : '';
      const emailEscaped = row.expertContact?.email ? escapeHtml(row.expertContact.email) : '';
      const phoneEscaped = row.expertContact?.phone ? escapeHtml(row.expertContact.phone) : '';

      container.innerHTML += `
        <div class="kanban-card" data-id="${row.id}" title="Clic para abrir detalle e inspección completa del CV">
          <div class="kanban-card-header">
            <div class="kanban-card-title">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--color-mint); flex-shrink:0;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
              <span>${escapeHtml(row.filename)}</span>
            </div>
            <div class="kanban-card-score">${'★'.repeat(row.rating)}${'☆'.repeat(5 - row.rating)}</div>
          </div>

          <div class="kanban-card-body">
            ${row.expertContact ? `
              <div style="font-weight: 600; color: var(--text-dark);">${emailEscaped}</div>
              ${phoneEscaped ? `<div style="font-size: 11.5px; color: var(--text-medium); margin-top:2px;">${phoneEscaped}</div>` : ''}
              <div style="display:flex; gap:6px; margin-top:6px;">
                ${emailEscaped ? `
                  <button type="button" class="btn-secondary btn-sm copy-email-btn" data-email="${emailEscaped}" style="padding:2px 6px; font-size:10px; border-radius:4px; margin:0;" onclick="event.stopPropagation();">
                    Copiar Email
                  </button>` : ''}
                ${cleanPhone ? `
                  <a href="https://wa.me/${cleanPhone}" target="_blank" class="btn-secondary btn-sm" style="padding:2px 6px; font-size:10px; border-radius:4px; margin:0; text-decoration:none; color:#25d366; border-color:rgba(37,211,102,0.3);" onclick="event.stopPropagation();">
                    WhatsApp
                  </a>` : ''}
              </div>
            ` : `
              <div style="color: var(--text-medium); font-size: 11.5px;">${isAiPaid ? 'Optimización automática de CV procesada' : isCoverLetterPaid ? 'Carta de Presentación generada' : 'Evaluación gratuita realizada'}</div>
            `}

            <!-- Status Dots Indicators -->
            <div class="status-indicators-bar">
              <div class="status-item" title="${isAiPaid ? 'Optimización IA: Completada' : 'Optimización IA: No solicitada'}">
                <span class="status-dot dot-ai ${isAiPaid ? 'solid' : 'outline'}"></span>
                <span style="color:${isAiPaid ? 'var(--text-dark)' : 'var(--text-light)'}">IA</span>
              </div>
              <div class="status-item" title="${isCoverLetterPaid ? 'Carta de Presentación: Pagada y generada' : 'Carta de Presentación: No solicitada'}">
                <span class="status-dot ${isCoverLetterPaid ? 'solid' : 'outline'}" style="background:${isCoverLetterPaid ? '#8b5cf6' : 'transparent'}; border-color:#8b5cf6;"></span>
                <span style="color:${isCoverLetterPaid ? 'var(--text-dark)' : 'var(--text-light)'}">Carta</span>
              </div>
              <div class="status-item" title="${Boolean(row.hasHeadshotsPaid || row.paymentStatus === 'completed_headshots') ? 'Pack 20 Fotos: Pagado y generado' : 'Pack 20 Fotos: No solicitado'}">
                <span class="status-dot ${Boolean(row.hasHeadshotsPaid || row.paymentStatus === 'completed_headshots') ? 'solid' : 'outline'}" style="background:${Boolean(row.hasHeadshotsPaid || row.paymentStatus === 'completed_headshots') ? '#0284c7' : 'transparent'}; border-color:#0284c7;"></span>
                <span style="color:${Boolean(row.hasHeadshotsPaid || row.paymentStatus === 'completed_headshots') ? 'var(--text-dark)' : 'var(--text-light)'}">Fotos</span>
              </div>
              <div class="status-item" title="${isExpertPending ? 'Asesoría Experta: Pendiente de entrega' : 'Asesoría Experta: No pendiente'}">
                <span class="status-dot dot-expert-pending ${isExpertPending ? 'solid' : 'outline'}"></span>
                <span style="color:${isExpertPending ? 'var(--text-dark)' : 'var(--text-light)'}">Asesoría Solicitada</span>
              </div>
              <div class="status-item" title="${isExpertDone ? 'Asesoría Experta: Entregada y completada' : 'Asesoría Experta: No entregada'}">
                <span class="status-dot dot-expert-done ${isExpertDone ? 'solid' : 'outline'}"></span>
                <span style="color:${isExpertDone ? 'var(--text-dark)' : 'var(--text-light)'}">Asesoría Entregada</span>
              </div>
            </div>
          </div>

          <div class="kanban-card-footer">
            <span>${formatDate(row.uploadedAt)}</span>
            <div style="display:flex; gap:5px; align-items:center;">
              ${isExpertPending ? `
                <button type="button" class="btn btn-sm complete-expert-btn" data-id="${row.id}" style="background-color:#059669; font-size:11px; padding:3px 8px; margin:0;" onclick="event.stopPropagation();">
                  Entregar
                </button>
              ` : ''}
              <button type="button" class="btn-secondary btn-sm btn-action-archive lead-archive-btn" data-id="${row.id}" data-archived="${row.archived ? 'true' : 'false'}" style="font-size:11px; padding:3px 6px; margin:0;" title="${row.archived ? 'Desarchivar lead' : 'Archivar lead'}" onclick="event.stopPropagation();">
                ${row.archived ? '📦' : '📦'}
              </button>
              <button type="button" class="btn-secondary btn-sm btn-action-delete doc-delete-btn" data-id="${row.id}" data-filename="${escapeHtml(row.filename)}" style="font-size:11px; padding:3px 6px; margin:0;" title="Eliminar lead" onclick="event.stopPropagation();">
                🗑️
              </button>
              <button type="button" class="btn-secondary btn-sm cv-text-btn" data-id="${row.id}" style="font-size:11px; padding:3px 8px; margin:0;" onclick="event.stopPropagation();">
                Detalle
              </button>
            </div>
          </div>
        </div>
      `;
    });
  }

  // Attach action button listeners for both tables & cards
  function attachRowActionListeners() {
    // 1. Text detail inspection
    document.querySelectorAll('.cv-text-btn').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        showCvText(e.currentTarget.getAttribute('data-id'));
      };
    });

    // 2. Kanban Card click
    document.querySelectorAll('.kanban-card').forEach(card => {
      card.onclick = (e) => {
        showCvText(e.currentTarget.getAttribute('data-id'));
      };
    });

    // 3. Mark complete
    document.querySelectorAll('.complete-expert-btn').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        completeExpertReview(e.currentTarget.getAttribute('data-id'));
      };
    });

    // 4. Archive / Unarchive
    document.querySelectorAll('.lead-archive-btn').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const id = e.currentTarget.getAttribute('data-id');
        const isArchived = e.currentTarget.getAttribute('data-archived') === 'true';
        archiveLead(id, !isArchived);
      };
    });

    // 5. Delete document or lead
    document.querySelectorAll('.doc-delete-btn').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const id = e.currentTarget.getAttribute('data-id');
        const fname = e.currentTarget.getAttribute('data-filename');
        deleteLeadOrDoc(id, fname);
      };
    });

    // 6. Copy email
    document.querySelectorAll('.copy-email-btn').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const email = e.currentTarget.getAttribute('data-email');
        navigator.clipboard.writeText(email).then(() => {
          const originalText = e.currentTarget.innerHTML;
          e.currentTarget.innerHTML = '¡Copiado!';
          setTimeout(() => {
            e.currentTarget.innerHTML = originalText;
          }, 1500);
        }).catch(err => console.error('Could not copy email:', err));
      };
    });
  }

  // Archive lead API call
  async function archiveLead(analysisId, shouldArchive) {
    try {
      const resp = await fetch('/api/admin/leads/archive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': adminToken
        },
        body: JSON.stringify({ analysisId, archived: shouldArchive })
      });
      if (!resp.ok) throw new Error('Error al actualizar estado de archivo.');
      
      const doc = rawDocLog.find(d => d.id === analysisId);
      if (doc) {
        doc.archived = shouldArchive;
        doc.archivedAt = shouldArchive ? new Date().toISOString() : null;
      }
      renderLeadsViews();
      renderHistoryTable();
    } catch (err) {
      console.error(err);
      alert('Error: ' + err.message);
    }
  }

  // Delete lead or doc API call
  async function deleteLeadOrDoc(analysisId, filename) {
    const confirmed = confirm(`¿Estás seguro de que deseas eliminar permanentemente el registro "${filename || analysisId}"?\n\nEsta acción no se puede deshacer.`);
    if (!confirmed) return;

    try {
      const resp = await fetch('/api/admin/leads/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': adminToken
        },
        body: JSON.stringify({ analysisId })
      });
      if (!resp.ok) throw new Error('Error al eliminar registro.');

      rawDocLog = rawDocLog.filter(d => d.id !== analysisId);
      renderLeadsViews();
      renderHistoryTable();
      loadStats(); // update header counters
    } catch (err) {
      console.error(err);
      alert('Error al eliminar: ' + err.message);
    }
  }

  // Hook up Archive Filter Tabs
  if (leadsArchiveFilter) {
    leadsArchiveFilter.querySelectorAll('.filter-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        leadsArchiveFilter.querySelectorAll('.filter-tab-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        currentLeadsArchiveMode = e.currentTarget.getAttribute('data-filter');
        renderLeadsViews();
      });
    });
  }

  // Hook up History Toolbar & Pagination Listeners
  if (historySearchInput) {
    historySearchInput.addEventListener('input', (e) => {
      historySearchQuery = e.target.value.toLowerCase().trim();
      historyCurrentPage = 1;
      renderHistoryTable();
    });
  }

  if (historyPaymentFilter) {
    historyPaymentFilter.addEventListener('change', (e) => {
      historyPaymentFilterVal = e.target.value;
      historyCurrentPage = 1;
      renderHistoryTable();
    });
  }

  if (historyRatingFilter) {
    historyRatingFilter.addEventListener('change', (e) => {
      historyRatingFilterVal = e.target.value;
      historyCurrentPage = 1;
      renderHistoryTable();
    });
  }

  if (historyTimeFilter) {
    historyTimeFilter.addEventListener('change', (e) => {
      historyTimeFilterVal = e.target.value;
      historyCurrentPage = 1;
      renderHistoryTable();
    });
  }

  if (historyResetFiltersBtn) {
    historyResetFiltersBtn.addEventListener('click', () => {
      historySearchQuery = '';
      historyPaymentFilterVal = 'all';
      historyRatingFilterVal = 'all';
      historyTimeFilterVal = 'all';
      historyCurrentPage = 1;
      if (historySearchInput) historySearchInput.value = '';
      if (historyPaymentFilter) historyPaymentFilter.value = 'all';
      if (historyRatingFilter) historyRatingFilter.value = 'all';
      if (historyTimeFilter) historyTimeFilter.value = 'all';
      renderHistoryTable();
    });
  }

  if (historyPageSize) {
    historyPageSize.addEventListener('change', (e) => {
      historyPageSizeVal = parseInt(e.target.value, 10) || 25;
      historyCurrentPage = 1;
      renderHistoryTable();
    });
  }

  if (historyFirstPageBtn) {
    historyFirstPageBtn.addEventListener('click', () => {
      historyCurrentPage = 1;
      renderHistoryTable();
    });
  }

  if (historyPrevPageBtn) {
    historyPrevPageBtn.addEventListener('click', () => {
      if (historyCurrentPage > 1) {
        historyCurrentPage--;
        renderHistoryTable();
      }
    });
  }

  if (historyNextPageBtn) {
    historyNextPageBtn.addEventListener('click', () => {
      const filtered = getFilteredHistoryLog();
      const totalPages = Math.ceil(filtered.length / historyPageSizeVal) || 1;
      if (historyCurrentPage < totalPages) {
        historyCurrentPage++;
        renderHistoryTable();
      }
    });
  }

  if (historyLastPageBtn) {
    historyLastPageBtn.addEventListener('click', () => {
      const filtered = getFilteredHistoryLog();
      const totalPages = Math.ceil(filtered.length / historyPageSizeVal) || 1;
      historyCurrentPage = totalPages;
      renderHistoryTable();
    });
  }

  function getPaymentBadge(status) {
    switch (status) {
      case 'free': return '<span class="badge free">Gratis (Eval)</span>';
      case 'completed_ai': return '<span class="badge ai">IA Pagado ($1)</span>';
      case 'completed_cover_letter': return '<span class="badge cover-letter">Carta Pagada ($2)</span>';
      case 'completed_headshots': return '<span class="badge headshots">20 Fotos ($5)</span>';
      case 'pending_expert': return '<span class="badge pending">Experto Pend. ($25 ✓)</span>';
      case 'paid_expert': return '<span class="badge pending">Experto Pend. ($25 ✓)</span>';
      case 'completed_expert': return '<span class="badge completed">Experto Entregado</span>';
      default: return `<span class="badge">${status}</span>`;
    }
  }

  // 6. CV Inspection & Session Workspace Modal
  async function showCvText(analysisId) {
    try {
      cvTextContentBox.textContent = 'Cargando información del currículum...';
      cvModalDocTitle.textContent = 'Inspección de Currículum';
      cvModalDocMeta.textContent = '';
      viewTextModal.showModal();

      const response = await fetch(`/api/admin/analysis-detail/${analysisId}`, {
        headers: { 'Authorization': adminToken }
      });
      if (!response.ok) throw new Error('No se pudo cargar el detalle del currículum.');
      const data = await response.json();
      currentInspectionDoc = data;

      cvModalDocTitle.textContent = `Currículum: ${data.filename}`;
      const contactInfo = data.expertContact 
        ? ` | Contacto: ${data.expertContact.email || ''} ${data.expertContact.phone || ''}`
        : '';
      cvModalDocMeta.textContent = `Subido: ${formatDate(data.uploadedAt)} | Estado: ${data.paymentStatus}${contactInfo}`;

      // Set download links with auth headers handled by click
      downloadModalOriginalBtn.onclick = (e) => {
        e.preventDefault();
        downloadCvFile(`/api/admin/download-text/${data.id}`, `cv_original_${data.filename}.txt`);
      };

      downloadModalOptimizedBtn.onclick = (e) => {
        e.preventDefault();
        downloadCvFile(`/api/admin/download-optimized/${data.id}`, `cv_optimizado_cintia_${data.filename}.txt`);
      };

      // Default to original or optimized if only one is available
      setInspectionTab('original');

    } catch (err) {
      alert(err.message);
      viewTextModal.close();
    }
  }

  function setInspectionTab(tab) {
    currentInspectionTab = tab;
    if (!currentInspectionDoc) return;

    if (tab === 'original') {
      tabBtnOriginal.style.background = 'var(--color-mint-light)';
      tabBtnOriginal.style.color = 'var(--color-mint-hover)';
      tabBtnOriginal.style.borderColor = 'rgba(16,185,129,0.3)';

      tabBtnOptimized.style.background = '#ffffff';
      tabBtnOptimized.style.color = 'var(--text)';
      tabBtnOptimized.style.borderColor = 'var(--border-grey)';

      if (tabBtnCoverLetter) {
        tabBtnCoverLetter.style.background = '#ffffff';
        tabBtnCoverLetter.style.color = 'var(--text)';
        tabBtnCoverLetter.style.borderColor = 'var(--border-grey)';
      }

      if (downloadModalCoverLetterBtn) downloadModalCoverLetterBtn.style.display = 'none';

      cvTextContentBox.textContent = currentInspectionDoc.originalText || '(Texto original no disponible)';
    } else if (tab === 'optimized') {
      tabBtnOptimized.style.background = 'var(--color-mint-light)';
      tabBtnOptimized.style.color = 'var(--color-mint-hover)';
      tabBtnOptimized.style.borderColor = 'rgba(16,185,129,0.3)';

      tabBtnOriginal.style.background = '#ffffff';
      tabBtnOriginal.style.color = 'var(--text)';
      tabBtnOriginal.style.borderColor = 'var(--border-grey)';

      if (tabBtnCoverLetter) {
        tabBtnCoverLetter.style.background = '#ffffff';
        tabBtnCoverLetter.style.color = 'var(--text)';
        tabBtnCoverLetter.style.borderColor = 'var(--border-grey)';
      }

      if (downloadModalCoverLetterBtn) downloadModalCoverLetterBtn.style.display = 'none';

      cvTextContentBox.textContent = currentInspectionDoc.optimizedText || '(Optimización de IA no disponible)';
    } else if (tab === 'cover_letter') {
      if (tabBtnCoverLetter) {
        tabBtnCoverLetter.style.background = '#ede9fe';
        tabBtnCoverLetter.style.color = '#6d28d9';
        tabBtnCoverLetter.style.borderColor = 'rgba(109, 40, 217, 0.3)';
      }

      tabBtnOriginal.style.background = '#ffffff';
      tabBtnOriginal.style.color = 'var(--text)';
      tabBtnOriginal.style.borderColor = 'var(--border-grey)';

      tabBtnOptimized.style.background = '#ffffff';
      tabBtnOptimized.style.color = 'var(--text)';
      tabBtnOptimized.style.borderColor = 'var(--border-grey)';

      const jobOffer = currentInspectionDoc.jobOfferText || '(Sin descripción de oferta laboral ingresada)';
      const coverLetter = currentInspectionDoc.coverLetterText || '(Carta de presentación aún no generada)';
      
      cvTextContentBox.textContent = `============================================================\nDESCRIPCIÓN DE LA OFERTA LABORAL (INGRESADA POR EL USUARIO)\n============================================================\n${jobOffer}\n\n============================================================\nCARTA DE PRESENTACIÓN GENERADA POR CINTIA\n============================================================\n${coverLetter}`;

      if (downloadModalCoverLetterBtn) {
        downloadModalCoverLetterBtn.style.display = 'inline-flex';
        downloadModalCoverLetterBtn.onclick = (e) => {
          e.preventDefault();
          downloadCvFile(`/api/admin/download-cover-letter/${currentInspectionDoc.id}`, `carta_presentacion_${currentInspectionDoc.filename}.txt`);
        };
      }
    }
  }

  if (tabBtnOriginal) tabBtnOriginal.addEventListener('click', () => setInspectionTab('original'));
  if (tabBtnOptimized) tabBtnOptimized.addEventListener('click', () => setInspectionTab('optimized'));
  if (tabBtnCoverLetter) tabBtnCoverLetter.addEventListener('click', () => setInspectionTab('cover_letter'));

  if (copyModalTextBtn) {
    copyModalTextBtn.addEventListener('click', () => {
      if (!currentInspectionDoc) return;
      let textToCopy = currentInspectionDoc.originalText;
      if (currentInspectionTab === 'optimized') textToCopy = currentInspectionDoc.optimizedText;
      if (currentInspectionTab === 'cover_letter') textToCopy = currentInspectionDoc.coverLetterText || currentInspectionDoc.jobOfferText;
      
      navigator.clipboard.writeText(textToCopy).then(() => {
        const orig = copyModalTextBtn.textContent;
        copyModalTextBtn.textContent = '✅ ¡Copiado!';
        setTimeout(() => { copyModalTextBtn.textContent = orig; }, 1500);
      }).catch(err => alert('No se pudo copiar: ' + err.message));
    });
  }

  async function downloadCvFile(endpoint, filename) {
    try {
      const resp = await fetch(endpoint, {
        headers: { 'Authorization': adminToken }
      });
      if (!resp.ok) throw new Error('Error al descargar');
      const blob = await resp.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Error en descarga: ' + err.message);
    }
  }

  closeTextModalBtn.addEventListener('click', () => {
    viewTextModal.close();
  });

  // Handle outside clicks to close text modal
  viewTextModal.addEventListener('click', (e) => {
    if (e.target === viewTextModal) {
      viewTextModal.close();
    }
  });

  // 7. Complete Expert Review Action
  async function completeExpertReview(analysisId) {
    if (!confirm('¿Deseas marcar este currículum optimizado manualmente como ENTREGADO y notificado al cliente?')) {
      return;
    }

    try {
      const response = await fetch('/api/admin/expert-complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': adminToken
        },
        body: JSON.stringify({ analysisId })
      });
      
      if (response.ok) {
        loadStats();
      } else {
        const data = await response.json();
        alert(data.error || 'Error al completar la entrega.');
      }
    } catch (err) {
      alert('Ocurrió un error al procesar el cambio.');
    }
  }

  // 8. Load & Save Settings
  async function loadSettings() {
    try {
      const response = await fetch('/api/admin/settings', {
        headers: { 'Authorization': adminToken }
      });
      if (!response.ok) throw new Error('Could not fetch settings');
      const settings = await response.json();

      // Mask key display if it exists
      if (settings.geminiApiKey) {
        setGeminiKey.placeholder = 'Clave API Configurada (••••••••' + settings.geminiApiKey.slice(-4) + ')';
      } else {
        setGeminiKey.placeholder = 'Sin clave API configurada';
      }
      setGeminiKey.value = '';

      setPriceAi.value = settings.priceAi !== undefined ? settings.priceAi : 2.0;
      if (setPriceCoverLetter) setPriceCoverLetter.value = settings.priceCoverLetter !== undefined ? settings.priceCoverLetter : 2.0;
      if (setPriceHeadshots) setPriceHeadshots.value = settings.priceHeadshots !== undefined ? settings.priceHeadshots : 5.0;
      setPriceExpert.value = settings.priceExpert !== undefined ? settings.priceExpert : 25.0;
      if (setPriceAiClp) setPriceAiClp.value = settings.priceAiClp !== undefined ? settings.priceAiClp : 2000;
      if (setPriceCoverLetterClp) setPriceCoverLetterClp.value = settings.priceCoverLetterClp !== undefined ? settings.priceCoverLetterClp : 2000;
      if (setPriceHeadshotsClp) setPriceHeadshotsClp.value = settings.priceHeadshotsClp !== undefined ? settings.priceHeadshotsClp : 5000;
      if (setPriceExpertClp) setPriceExpertClp.value = settings.priceExpertClp !== undefined ? settings.priceExpertClp : 25000;
      if (setHeadshotsPackSize) setHeadshotsPackSize.value = settings.headshotsPackSize !== undefined ? settings.headshotsPackSize : 20;
      if (setHeadshotsResolution) setHeadshotsResolution.value = settings.headshotsResolution || '1:1 (480x480)';
      if (setHeadshotCatCorp) setHeadshotCatCorp.checked = settings.headshotsCatCorp !== false;
      if (setHeadshotCatCasual) setHeadshotCatCasual.checked = settings.headshotsCatCasual !== false;
      if (setHeadshotCatTech) setHeadshotCatTech.checked = settings.headshotsCatTech !== false;
      if (setHeadshotCatEdit) setHeadshotCatEdit.checked = settings.headshotsCatEdit !== false;
      if (setHeadshotsPrompt) setHeadshotsPrompt.value = settings.headshotsPrompt || '';
      setRateLimit.value = settings.rateLimitPerHour !== undefined ? settings.rateLimitPerHour : 20;
      setOptAiEnabled.checked = settings.optAiEnabled !== false;
      if (setOptCoverLetterEnabled) setOptCoverLetterEnabled.checked = settings.optCoverLetterEnabled !== false;
      if (setOptHeadshotsEnabled) setOptHeadshotsEnabled.checked = settings.optHeadshotsEnabled !== false;
      setOptExpertEnabled.checked = settings.optExpertEnabled !== false;
      setCaptchaEnabled.checked = settings.captchaEnabled !== false;
      setEvalPrompt.value = settings.evaluationPrompt || '';
      setOptPrompt.value = settings.optimizationPrompt || '';
      if (setCoverLetterPrompt) setCoverLetterPrompt.value = settings.coverLetterPrompt || '';

      const dbStorageText = document.getElementById('dbStorageText');
      if (dbStorageText) {
        if (settings.firestoreConnected) {
          dbStorageText.innerHTML = `<span style="color:#059669;">🔥 Cloud Firestore Activo (Proyecto: <code>${settings.firestoreProjectId || 'cintia'}</code> - Persistente)</span>`;
        } else {
          const errDetail = settings.firestoreError ? `<div style="font-size:11px; color:#b45309; margin-top:2px;">Detalle: ${escapeHtml(settings.firestoreError)}</div>` : '';
          dbStorageText.innerHTML = `<div><span style="color:#d97706;">⚠️ Memoria Local / Efímera</span> ${errDetail}</div>`;
        }
      }

    } catch (err) {
      console.error(err);
      alert('Error al cargar configuraciones.');
    }
  }

  settingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    settingsMessage.style.display = 'none';

    const payload = {
      priceAi: parseFloat(setPriceAi.value),
      priceCoverLetter: setPriceCoverLetter ? parseFloat(setPriceCoverLetter.value) : 2.0,
      priceHeadshots: setPriceHeadshots ? parseFloat(setPriceHeadshots.value) : 5.0,
      priceExpert: parseFloat(setPriceExpert.value),
      priceAiClp: setPriceAiClp ? parseInt(setPriceAiClp.value, 10) : 2000,
      priceCoverLetterClp: setPriceCoverLetterClp ? parseInt(setPriceCoverLetterClp.value, 10) : 2000,
      priceHeadshotsClp: setPriceHeadshotsClp ? parseInt(setPriceHeadshotsClp.value, 10) : 5000,
      priceExpertClp: setPriceExpertClp ? parseInt(setPriceExpertClp.value, 10) : 25000,
      headshotsPackSize: setHeadshotsPackSize ? parseInt(setHeadshotsPackSize.value, 10) : 20,
      headshotsResolution: setHeadshotsResolution ? setHeadshotsResolution.value : '1:1 (480x480)',
      headshotsCatCorp: setHeadshotCatCorp ? setHeadshotCatCorp.checked : true,
      headshotsCatCasual: setHeadshotCatCasual ? setHeadshotCatCasual.checked : true,
      headshotsCatTech: setHeadshotCatTech ? setHeadshotCatTech.checked : true,
      headshotsCatEdit: setHeadshotCatEdit ? setHeadshotCatEdit.checked : true,
      headshotsPrompt: setHeadshotsPrompt ? setHeadshotsPrompt.value : '',
      rateLimitPerHour: parseInt(setRateLimit.value, 10),
      optAiEnabled: setOptAiEnabled.checked,
      optCoverLetterEnabled: setOptCoverLetterEnabled ? setOptCoverLetterEnabled.checked : true,
      optHeadshotsEnabled: setOptHeadshotsEnabled ? setOptHeadshotsEnabled.checked : true,
      optExpertEnabled: setOptExpertEnabled.checked,
      captchaEnabled: setCaptchaEnabled.checked,
      evaluationPrompt: setEvalPrompt.value,
      optimizationPrompt: setOptPrompt.value,
      coverLetterPrompt: setCoverLetterPrompt ? setCoverLetterPrompt.value : ''
    };

    // Only send changes for password & key if inputted
    if (setGeminiKey.value.trim() !== '') {
      payload.geminiApiKey = setGeminiKey.value.trim();
    }
    // Password managed via environment variables

    try {
      const response = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': adminToken
        },
        body: JSON.stringify(payload)
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Error al guardar.');
      }

      settingsMessage.textContent = '¡Parámetros del sistema actualizados con éxito!';
      settingsMessage.style.display = 'block';
      settingsMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      
      // Reload settings display
      loadSettings();
      
      // Password managed via environment variables

      setTimeout(() => {
        settingsMessage.style.display = 'none';
      }, 4000);

    } catch (err) {
      alert('Error: ' + err.message);
    }
  });

  // Helpers
  function formatDate(isoStr) {
    if (!isoStr) return '-';
    const date = new Date(isoStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const mins = String(date.getMinutes()).padStart(2, '0');
    return `<div style="white-space:nowrap;">${day}/${month}/${year}</div><div style="font-size:11px; color:var(--text-light); line-height:1.2;">${hours}:${mins}</div>`;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
});

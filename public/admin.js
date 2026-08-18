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
  
  // Leads Dual View Mode Switcher
  const viewModeListBtn = document.getElementById('viewModeListBtn');
  const viewModeBoardBtn = document.getElementById('viewModeBoardBtn');
  const leadsListView = document.getElementById('leadsListView');
  const leadsBoardView = document.getElementById('leadsBoardView');

  // Kanban Board Columns & Badges (Doing vs Done)
  const cardsDoing = document.getElementById('cardsDoing');
  const cardsDone = document.getElementById('cardsDone');
  const badgeDoing = document.getElementById('badgeDoing');
  const badgeDone = document.getElementById('badgeDone');
  
  // Settings Form
  const settingsForm = document.getElementById('settingsForm');
  const setGeminiKey = document.getElementById('setGeminiKey');
  const setPriceAi = document.getElementById('setPriceAi');
  const setPriceExpert = document.getElementById('setPriceExpert');
  const setRateLimit = document.getElementById('setRateLimit');
  const setAdminPassword = null;
  const setCaptchaEnabled = document.getElementById('setCaptchaEnabled');
  const setOptAiEnabled = document.getElementById('setOptAiEnabled');
  const setOptExpertEnabled = document.getElementById('setOptExpertEnabled');
  const setEvalPrompt = document.getElementById('setEvalPrompt');
  const setOptPrompt = document.getElementById('setOptPrompt');
  const settingsMessage = document.getElementById('settingsMessage');
  
  // Modal Elements
  const viewTextModal = document.getElementById('viewTextModal');
  const cvModalDocTitle = document.getElementById('cvModalDocTitle');
  const cvModalDocMeta = document.getElementById('cvModalDocMeta');
  const tabBtnOriginal = document.getElementById('tabBtnOriginal');
  const tabBtnOptimized = document.getElementById('tabBtnOptimized');
  const cvTextContentBox = document.getElementById('cvTextContentBox');
  const copyModalTextBtn = document.getElementById('copyModalTextBtn');
  const downloadModalOriginalBtn = document.getElementById('downloadModalOriginalBtn');
  const downloadModalOptimizedBtn = document.getElementById('downloadModalOptimizedBtn');
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
    if (!expertContact) return '<span style="color:var(--text-light);">-</span>';
    
    const emailEscaped = escapeHtml(expertContact.email);
    const phoneEscaped = escapeHtml(expertContact.phone);
    const cleanPhone = expertContact.phone.replace(/[^0-9]/g, '');
    
    return `
      <div style="display:flex; flex-direction:column; gap:4px; white-space:nowrap;">
        <span style="font-weight: 600;">${emailEscaped}</span>
        <span style="font-size: 11px; color: var(--text-light);">${phoneEscaped}</span>
        <div style="display:flex; gap:8px; margin-top:4px;">
          <button type="button" class="btn-secondary btn-sm copy-email-btn" data-email="${emailEscaped}" style="padding:2px 6px; font-size:10px; min-height:auto; width:auto; border-radius:4px; display:inline-flex; align-items:center; gap:4px; margin-top:0;">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            Copiar
          </button>
          ${cleanPhone ? `
            <a href="https://wa.me/${cleanPhone}" target="_blank" class="btn-secondary btn-sm" style="padding:2px 6px; font-size:10px; min-height:auto; width:auto; border-radius:4px; display:inline-flex; align-items:center; gap:4px; text-decoration:none; color:#25d366; border-color:rgba(37, 211, 102, 0.3); margin-top:0;">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:middle;"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.457L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.864-9.799.002-2.63-1.023-5.101-2.885-6.963C16.588 1.981 14.117.957 11.5.957c-5.442 0-9.866 4.372-9.87 9.802 0 1.672.43 3.302 1.256 4.745L1.87 20.894l5.777-1.74zm11.233-5.395c-.29-.144-1.711-.834-1.977-.929-.266-.094-.46-.142-.653.143-.194.286-.75.929-.918 1.12-.167.19-.335.213-.625.069-2.91-1.44-4.004-2.61-4.78-3.92-.2-.34-.02-.52.15-.69.15-.15.34-.39.51-.59.17-.19.23-.33.34-.55.11-.22.05-.41-.02-.55-.08-.144-.653-1.547-.895-2.12-.236-.563-.496-.486-.68-.496-.18-.01-.387-.01-.594-.01-.207 0-.544.077-.83.387-.285.31-1.088 1.047-1.088 2.551 0 1.505 1.11 2.96 1.26 3.16.15.19 2.186 3.3 5.297 4.62 1.63.69 2.905 1.1 3.905 1.41 1.01.32 1.93.27 2.65.17.8-.11 1.71-.69 1.95-1.33.24-.63.24-1.18.17-1.3-.07-.113-.266-.206-.557-.35z"/></svg>
              WhatsApp
            </a>
          ` : ''}
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
      statAnalyses.textContent = stats.totalAnalyses ?? 0;
      statPaidAi.textContent = stats.paidAi ?? 0;
      statExpertPending.textContent = stats.paidExpertPending ?? 0;
      statRevenue.textContent = `$${(Number(stats.totalRevenue) || 0).toFixed(2)} USD`;

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

      const docLog = Array.isArray(data.documentLog) ? data.documentLog : [];

      // Render Recent Table (max 5 rows)
      recentActivityTableBody.innerHTML = '';
      const recent = docLog.slice(0, 5);
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

      // Render History Table
      historyTableBody.innerHTML = '';
      if (docLog.length === 0) {
        historyTableBody.innerHTML = '<tr><td colspan="8" style="text-align:center;">No se han subido currículums aún.</td></tr>';
      } else {
        docLog.forEach(row => {
          const contact = renderContactColumn(row.expertContact);
          
          let actionBtn = `<button class="btn-secondary btn-sm cv-text-btn" data-id="${row.id}">Ver Texto</button>`;
          
          if (row.paymentStatus === 'pending_expert') {
            actionBtn += ` <button class="btn btn-sm complete-expert-btn" style="background-color:#059669; margin-top:0;" data-id="${row.id}">Marcar Entregado</button>`;
          }
          
          historyTableBody.innerHTML += `
            <tr>
              <td><strong>${escapeHtml(row.filename)}</strong></td>
              <td>${(row.fileSize / 1024).toFixed(1)} KB</td>
              <td>${formatDate(row.uploadedAt)}</td>
              <td>${'★'.repeat(row.rating)}${'☆'.repeat(5 - row.rating)}</td>
              <td>${getPaymentBadge(row.paymentStatus)}</td>
              <td>${contact}</td>
              <td><code style="font-size:11px;">${row.ip}</code></td>
              <td>
                <div class="actions-cell">
                  ${actionBtn}
                  <a href="/api/admin/download-text/${row.id}" headers='{"Authorization":"${adminToken}"}' download class="btn-secondary btn-sm" style="display:inline-flex; align-items:center; text-decoration:none; padding:4px 8px;">Bajar</a>
                </div>
              </td>
            </tr>
          `;
        });

        // Render Leads Table & Kanban Board (Doing vs Done)
        leadsTableBody.innerHTML = '';
        if (cardsDoing) cardsDoing.innerHTML = '';
        if (cardsDone) cardsDone.innerHTML = '';

        const leads = docLog.filter(row => row.paymentStatus && row.paymentStatus !== 'free');
        
        // 1. Render Table View
        if (leads.length === 0) {
          leadsTableBody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No hay leads registrados aún.</td></tr>';
        } else {
          leads.forEach(row => {
            const isAiPaid = Boolean(row.hasAiPaid || row.paymentStatus === 'completed_ai');
            const isExpertPending = Boolean((row.hasExpertPaid && row.expertStatus === 'pending') || row.paymentStatus === 'pending_expert' || row.paymentStatus === 'paid_expert');
            const isExpertDone = Boolean((row.hasExpertPaid && row.expertStatus === 'completed') || row.paymentStatus === 'completed_expert');

            const contact = row.expertContact 
              ? renderContactColumn(row.expertContact) 
              : '<span style="color:var(--text-light);">Descarga Directa (IA)</span>';
            
            let statusBadges = [];
            if (isAiPaid) {
              statusBadges.push('<span class="badge ai" style="background-color: var(--color-mint-light); color: var(--color-mint-hover); border: 1px solid rgba(16, 185, 129, 0.2); font-weight:600;">Optimizado IA</span>');
            }
            if (isExpertPending) {
              statusBadges.push('<span class="badge pending" style="background-color: #fef3c7; color: #d97706; border: 1px solid rgba(217, 119, 6, 0.2); font-weight:600;">Experto: Pendiente</span>');
            }
            if (isExpertDone) {
              statusBadges.push('<span class="badge completed" style="background-color: #d1fae5; color: #065f46; border: 1px solid rgba(6, 95, 70, 0.2); font-weight:600;">Experto: Entregado</span>');
            }
            if (statusBadges.length === 0) {
              statusBadges.push(`<span class="badge">${row.paymentStatus}</span>`);
            }

            let serviceName = 'IA ($1)';
            if (row.hasExpertPaid || row.paymentStatus.includes('expert')) {
              serviceName = (row.hasAiPaid || row.paymentStatus === 'completed_ai') ? 'Experto ($25) + IA ($1)' : 'Experto Humano ($25)';
            }

            let actionBtn = `<button class="btn-secondary btn-sm cv-text-btn" data-id="${row.id}">Ver Texto</button>`;
            if (isExpertPending) {
              actionBtn += ` <button class="btn btn-sm complete-expert-btn" style="background-color:#059669; margin-top:0;" data-id="${row.id}">Marcar como Entregado</button>`;
            }

            leadsTableBody.innerHTML += `
              <tr>
                <td><strong>${escapeHtml(row.filename)}</strong></td>
                <td>${serviceName}</td>
                <td>${formatDate(row.uploadedAt)}</td>
                <td>${contact}</td>
                <td>${statusBadges.join(' ')}</td>
                <td>${'★'.repeat(row.rating)}${'☆'.repeat(5 - row.rating)}</td>
                <td>
                  <div class="actions-cell">
                    ${actionBtn}
                  </div>
                </td>
              </tr>
            `;
          });
        }

        // 2. Render Kanban Board View (1 Card per User with Status Dots)
        const doingList = [];
        const doneList = [];

        leads.forEach(row => {
          const isExpertPending = Boolean((row.hasExpertPaid && row.expertStatus === 'pending') || row.paymentStatus === 'pending_expert' || row.paymentStatus === 'paid_expert');
          if (isExpertPending) {
            doingList.push(row);
          } else {
            doneList.push(row);
          }
        });

        if (badgeDoing) badgeDoing.textContent = doingList.length;
        if (badgeDone) badgeDone.textContent = doneList.length;

        function renderKanbanCards(list, container, isDoingColumn = false) {
          if (!container) return;
          if (list.length === 0) {
            container.innerHTML = '<div class="kanban-empty-hint">Sin registros en esta columna</div>';
            return;
          }
          list.forEach(row => {
            const isAiPaid = Boolean(row.hasAiPaid || row.paymentStatus === 'completed_ai');
            const isExpertPending = Boolean((row.hasExpertPaid && row.expertStatus === 'pending') || row.paymentStatus === 'pending_expert' || row.paymentStatus === 'paid_expert');
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
                    <div style="color: var(--text-medium); font-size: 11.5px;">Optimización automática de CV procesada</div>
                  `}

                  <!-- 3 Status Dots Indicators -->
                  <div class="status-indicators-bar">
                    <div class="status-item" title="${isAiPaid ? 'Optimización IA: Completada' : 'Optimización IA: No solicitada'}">
                      <span class="status-dot dot-ai ${isAiPaid ? 'solid' : 'outline'}"></span>
                      <span style="color:${isAiPaid ? 'var(--text-dark)' : 'var(--text-light)'}">IA</span>
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
                  <div style="display:flex; gap:6px; align-items:center;">
                    ${isExpertPending ? `
                      <button type="button" class="btn btn-sm complete-expert-btn" data-id="${row.id}" style="background-color:#059669; font-size:11px; padding:3px 8px; margin:0;" onclick="event.stopPropagation();">
                        Entregar
                      </button>
                    ` : ''}
                    <button type="button" class="btn-secondary btn-sm cv-text-btn" data-id="${row.id}" style="font-size:11px; padding:3px 8px; margin:0;" onclick="event.stopPropagation();">
                      Detalle
                    </button>
                  </div>
                </div>
              </div>
            `;
          });
        }

        renderKanbanCards(doingList, cardsDoing, true);
        renderKanbanCards(doneList, cardsDone, false);
      }

      // Add action button listeners
      document.querySelectorAll('.cv-text-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          showCvText(e.currentTarget.getAttribute('data-id'));
        });
      });

      // Kanban Card click handler (click anywhere on the card to inspect)
      document.querySelectorAll('.kanban-card').forEach(card => {
        card.addEventListener('click', (e) => {
          showCvText(e.currentTarget.getAttribute('data-id'));
        });
      });

      document.querySelectorAll('.complete-expert-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          completeExpertReview(e.currentTarget.getAttribute('data-id'));
        });
      });

      // Add copy email listeners
      document.querySelectorAll('.copy-email-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation(); // Avoid triggering any row/container parent click behaviors
          const email = e.currentTarget.getAttribute('data-email');
          navigator.clipboard.writeText(email).then(() => {
            const originalText = e.currentTarget.innerHTML;
            e.currentTarget.innerHTML = '¡Copiado!';
            setTimeout(() => {
              e.currentTarget.innerHTML = originalText;
            }, 1500);
          }).catch(err => console.error('Could not copy email:', err));
        });
      });

    } catch (err) {
      console.error(err);
      alert('Error al cargar estadísticas.');
    }
  }

  function getPaymentBadge(status) {
    switch (status) {
      case 'free': return '<span class="badge free">Gratis (Eval)</span>';
      case 'completed_ai': return '<span class="badge ai">IA Pagado ($1)</span>';
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

      cvTextContentBox.textContent = currentInspectionDoc.originalText || '(Texto original no disponible)';
    } else {
      tabBtnOptimized.style.background = 'var(--color-mint-light)';
      tabBtnOptimized.style.color = 'var(--color-mint-hover)';
      tabBtnOptimized.style.borderColor = 'rgba(16,185,129,0.3)';

      tabBtnOriginal.style.background = '#ffffff';
      tabBtnOriginal.style.color = 'var(--text)';
      tabBtnOriginal.style.borderColor = 'var(--border-grey)';

      cvTextContentBox.textContent = currentInspectionDoc.optimizedText || '(Optimización de IA no disponible)';
    }
  }

  if (tabBtnOriginal) tabBtnOriginal.addEventListener('click', () => setInspectionTab('original'));
  if (tabBtnOptimized) tabBtnOptimized.addEventListener('click', () => setInspectionTab('optimized'));

  if (copyModalTextBtn) {
    copyModalTextBtn.addEventListener('click', () => {
      if (!currentInspectionDoc) return;
      const textToCopy = currentInspectionTab === 'original' 
        ? currentInspectionDoc.originalText 
        : currentInspectionDoc.optimizedText;
      
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

      setPriceAi.value = settings.priceAi !== undefined ? settings.priceAi : 1.0;
      setPriceExpert.value = settings.priceExpert !== undefined ? settings.priceExpert : 25.0;
      setRateLimit.value = settings.rateLimitPerHour !== undefined ? settings.rateLimitPerHour : 20;
      setOptAiEnabled.checked = settings.optAiEnabled !== false;
      setOptExpertEnabled.checked = settings.optExpertEnabled !== false;
      setCaptchaEnabled.checked = settings.captchaEnabled !== false;
      setEvalPrompt.value = settings.evaluationPrompt || '';
      setOptPrompt.value = settings.optimizationPrompt || '';
      // Password managed via environment variables

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
      priceExpert: parseFloat(setPriceExpert.value),
      rateLimitPerHour: parseInt(setRateLimit.value, 10),
      optAiEnabled: setOptAiEnabled.checked,
      optExpertEnabled: setOptExpertEnabled.checked,
      captchaEnabled: setCaptchaEnabled.checked,
      evaluationPrompt: setEvalPrompt.value,
      optimizationPrompt: setOptPrompt.value
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
    return date.toLocaleString('es-ES', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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

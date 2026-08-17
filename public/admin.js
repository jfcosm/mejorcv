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
  
  // Tables
  const recentActivityTableBody = document.querySelector('#recentActivityTable tbody');
  const historyTableBody = document.querySelector('#historyTable tbody');
  const leadsTableBody = document.querySelector('#leadsTable tbody');
  
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
  const cvTextContentBox = document.getElementById('cvTextContentBox');
  const closeTextModalBtn = document.getElementById('closeTextModalBtn');

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

  // 3. Logout Handler
  logoutBtn.addEventListener('click', async () => {
    try {
      await fetch('/api/admin/logout', {
        method: 'POST',
        headers: { 'Authorization': adminToken }
      });
    } catch (e) {
      console.warn('Logout server notification failed');
    }
    localStorage.removeItem('adminToken');
    adminToken = null;
    showLogin();
  });

  // 4. Tab switching
  const tabs = document.querySelectorAll('.admin-tab');
  const panels = document.querySelectorAll('.admin-panel');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));
      
      tab.classList.add('active');
      const target = tab.getAttribute('data-target');
      document.getElementById(target).classList.add('active');
    });
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

      // Set statistics
      statVisits.textContent = data.stats.totalVisits;
      statAnalyses.textContent = data.stats.totalAnalyses;
      statPaidAi.textContent = data.stats.paidAi;
      statExpertPending.textContent = data.stats.paidExpertPending;
      statRevenue.textContent = `$${data.stats.totalRevenue.toFixed(2)} USD`;

      // Render Recent Table (max 5 rows)
      recentActivityTableBody.innerHTML = '';
      const recent = data.documentLog.slice(0, 5);
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
      if (data.documentLog.length === 0) {
        historyTableBody.innerHTML = '<tr><td colspan="8" style="text-align:center;">No se han subido currículums aún.</td></tr>';
      } else {
        data.documentLog.forEach(row => {
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

        // Render Leads Table
        leadsTableBody.innerHTML = '';
        const leads = data.documentLog.filter(row => row.paymentStatus && row.paymentStatus !== 'free');
        if (leads.length === 0) {
          leadsTableBody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No hay leads registrados aún.</td></tr>';
        } else {
          leads.forEach(row => {
            const contact = row.expertContact 
              ? renderContactColumn(row.expertContact) 
              : '<span style="color:var(--text-light);">Descarga Directa (IA)</span>';
            
            let statusBadge = '';
            if (row.paymentStatus === 'completed_ai') {
              statusBadge = '<span class="badge ai" style="background-color: var(--color-mint-light); color: var(--color-mint-hover); border: 1px solid rgba(16, 185, 129, 0.2); font-weight:600;">Optimizado por IA</span>';
            } else if (row.paymentStatus === 'pending_expert') {
              statusBadge = '<span class="badge pending" style="background-color: #fef3c7; color: #d97706; border: 1px solid rgba(217, 119, 6, 0.2); font-weight:600;">Experto: Pendiente</span>';
            } else if (row.paymentStatus === 'completed_expert') {
              statusBadge = '<span class="badge completed" style="background-color: #d1fae5; color: #065f46; border: 1px solid rgba(6, 95, 70, 0.2); font-weight:600;">Experto: Completado</span>';
            } else {
              statusBadge = `<span class="badge">${row.paymentStatus}</span>`;
            }

            let actionBtn = `<button class="btn-secondary btn-sm cv-text-btn" data-id="${row.id}">Ver Texto</button>`;
            if (row.paymentStatus === 'pending_expert') {
              actionBtn += ` <button class="btn btn-sm complete-expert-btn" style="background-color:#059669; margin-top:0;" data-id="${row.id}">Completar e Ingresar Pago</button>`;
            }

            leadsTableBody.innerHTML += `
              <tr>
                <td><strong>${escapeHtml(row.filename)}</strong></td>
                <td>${row.paymentStatus.includes('expert') ? 'Experto Humano ($25)' : 'IA Instantánea ($1)'}</td>
                <td>${formatDate(row.uploadedAt)}</td>
                <td>${contact}</td>
                <td>${statusBadge}</td>
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
      }

      // Add action button listeners
      document.querySelectorAll('.cv-text-btn').forEach(btn => {
        btn.addEventListener('click', (e) => showCvText(e.target.getAttribute('data-id')));
      });

      document.querySelectorAll('.complete-expert-btn').forEach(btn => {
        btn.addEventListener('click', (e) => completeExpertReview(e.target.getAttribute('data-id')));
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
      case 'pending_expert': return '<span class="badge pending">Experto Pend ($25)</span>';
      case 'completed_expert': return '<span class="badge completed">Experto Entregado</span>';
      default: return `<span class="badge">${status}</span>`;
    }
  }

  // 6. View text in Modal
  async function showCvText(analysisId) {
    try {
      const response = await fetch(`/api/admin/download-text/${analysisId}`, {
        headers: { 'Authorization': adminToken }
      });
      if (!response.ok) throw new Error('No se pudo bajar el texto del currículum.');
      const text = await response.text();
      
      cvTextContentBox.textContent = text;
      viewTextModal.showModal();
    } catch (err) {
      alert(err.message);
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

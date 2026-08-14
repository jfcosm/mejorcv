document.addEventListener('DOMContentLoaded', () => {
  // Authentication Elements
  const loginArea = document.getElementById('loginArea');
  const loginForm = document.getElementById('loginForm');
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
  
  // Settings Form
  const settingsForm = document.getElementById('settingsForm');
  const setGeminiKey = document.getElementById('setGeminiKey');
  const setPriceAi = document.getElementById('setPriceAi');
  const setPriceExpert = document.getElementById('setPriceExpert');
  const setRateLimit = document.getElementById('setRateLimit');
  const setAdminPassword = document.getElementById('setAdminPassword');
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
    const password = adminPasswordInput.value;

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Contraseña incorrecta.');
      }

      adminToken = data.token;
      localStorage.setItem('adminToken', adminToken);
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
          const contact = row.expertContact 
            ? `${escapeHtml(row.expertContact.email)}<br><small class="text-light">${escapeHtml(row.expertContact.phone)}</small>` 
            : '-';
          
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

        // Add action button listeners
        document.querySelectorAll('.cv-text-btn').forEach(btn => {
          btn.addEventListener('click', (e) => showCvText(e.target.getAttribute('data-id')));
        });

        document.querySelectorAll('.complete-expert-btn').forEach(btn => {
          btn.addEventListener('click', (e) => completeExpertReview(e.target.getAttribute('data-id')));
        });
      }

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

      setPriceAi.value = settings.priceAi;
      setPriceExpert.value = settings.priceExpert;
      setRateLimit.value = settings.rateLimitPerHour;
      setOptAiEnabled.checked = settings.optAiEnabled !== false;
      setOptExpertEnabled.checked = settings.optExpertEnabled !== false;
      setCaptchaEnabled.checked = settings.captchaEnabled;
      setEvalPrompt.value = settings.evaluationPrompt;
      setOptPrompt.value = settings.optimizationPrompt;
      setAdminPassword.value = '';

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
    if (setAdminPassword.value.trim() !== '') {
      payload.adminPassword = setAdminPassword.value.trim();
    }

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
      
      // Clear password field
      setAdminPassword.value = '';

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

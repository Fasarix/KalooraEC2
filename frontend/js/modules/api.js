// Centralized API fetch wrapper with global error handling and toast notifications
export async function apiFetch(url, options = {}) {
  const token = localStorage.getItem('token');
  const defaultHeaders = {
    'Content-Type': 'application/json'
  };

  if (token) {
    defaultHeaders['Authorization'] = `Bearer ${token}`;
  }

  const mergedOptions = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers
    }
  };

  try {
    const res = await fetch(url, mergedOptions);

    if (res.status === 401 && !url.includes('/login') && !url.includes('/register')) {
      localStorage.removeItem('token');
      window.location.reload();
      throw new Error('Sessione scaduta. Effettua nuovamente il login.');
    }

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error(errorData.error || errorData.message || `Errore richiesta: ${res.status}`);
    }

    return await res.json();
  } catch (err) {
    console.error(`[API Error] ${url}:`, err);
    if (err.name === 'TypeError') {
      showGlobalToast('Impossibile connettersi al server. Verifica la tua connessione.', 'error');
    }
    throw err;
  }
}

function showGlobalToast(message, type = 'info') {
  const toastContainer = document.getElementById('toast-container');
  if (!toastContainer) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerText = message;
  toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

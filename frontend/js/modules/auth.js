import { state } from './state.js';
import { apiFetch } from './api.js';
import { showToast, showAuth, showDashboard } from './ui.js';

const API_BASE = window.location.origin;

export function setupAuthListeners() {
  const tabLogin = document.getElementById('tab-login');
  const tabRegister = document.getElementById('tab-register');
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const btnLogout = document.getElementById('btn-logout');
  const smartAlertBanner = document.getElementById('smart-alert-banner');
  const btnDismissAlert = document.getElementById('btn-dismiss-alert');

  if (tabLogin && tabRegister && loginForm && registerForm) {
    tabLogin.addEventListener('click', () => {
      tabLogin.classList.add('active');
      tabRegister.classList.remove('active');
      loginForm.classList.remove('hidden');
      registerForm.classList.add('hidden');
    });

    tabRegister.addEventListener('click', () => {
      tabRegister.classList.add('active');
      tabLogin.classList.remove('active');
      registerForm.classList.remove('hidden');
      loginForm.classList.add('hidden');
    });
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (document.activeElement) document.activeElement.blur();
      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;

      if (!email || !password) {
        showToast('Inserisci sia l\'email che la password per accedere.', 'warning');
        return;
      }

      try {
        const data = await apiFetch(`${API_BASE}/api/users/login`, {
          method: 'POST',
          body: JSON.stringify({ email, password })
        });

        localStorage.setItem('token', data.token);
        state.token = data.token;
        document.getElementById('login-password').value = '';
        showDashboard();
        showToast('Login effettuato con successo!', 'success');
      } catch (err) {
        showToast(err.message, 'danger');
      }
    });
  }

  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (document.activeElement) document.activeElement.blur();
      const name = document.getElementById('reg-name').value.trim();
      const email = document.getElementById('reg-email').value.trim();
      const password = document.getElementById('reg-password').value;
      const age = document.getElementById('reg-age').value;
      const gender = document.getElementById('reg-gender').value;
      const height = document.getElementById('reg-height').value;
      const weight = document.getElementById('reg-weight').value;
      const activityLevel = document.getElementById('reg-activity').value;
      const goal = document.getElementById('reg-goal') ? document.getElementById('reg-goal').value : 'maintenance';

      if (!name || !email || !password || !age || !height || !weight) {
        showToast('Compila tutti i campi obbligatori (Nome, Email, Password, Età, Altezza e Peso).', 'warning');
        return;
      }

      if (password.length < 6) {
        showToast('La password deve contenere almeno 6 caratteri.', 'warning');
        return;
      }

      try {
        await apiFetch(`${API_BASE}/api/users/register`, {
          method: 'POST',
          body: JSON.stringify({
            name, email, password, age: parseInt(age),
            gender, height: parseFloat(height), weight: parseFloat(weight),
            activityLevel, goal
          })
        });

        document.getElementById('reg-password').value = '';
        showToast('Registrazione completata! Effettua il login.', 'success');
        if (tabLogin) tabLogin.click();
      } catch (err) {
        showToast(err.message, 'danger');
      }
    });
  }

  if (btnLogout) {
    btnLogout.addEventListener('click', (e) => {
      if (e) e.stopPropagation();
      localStorage.removeItem('token');
      state.token = null;
      state.user = null;
      showAuth();
    });
  }

  if (btnDismissAlert && smartAlertBanner) {
    btnDismissAlert.addEventListener('click', () => {
      smartAlertBanner.classList.add('hidden');
    });
  }
}

export function populateSettingsForm() {
  if (!state.user) return;
  const u = state.user;

  document.getElementById('sett-name').value = u.name;
  document.getElementById('sett-email').value = u.email;
  document.getElementById('sett-age').value = u.age;
  document.getElementById('sett-gender').value = u.gender;
  document.getElementById('sett-height').value = u.height;
  document.getElementById('sett-weight').value = u.weight;
  document.getElementById('sett-activity').value = u.activity_level;
  
  const goalSelect = document.getElementById('sett-goal');
  if (goalSelect) goalSelect.value = u.goal || 'maintenance';

  const fastSelect = document.getElementById('sett-fasting');
  if (fastSelect) fastSelect.value = u.fasting_protocol || 'none';

  const enabled = (u.enabled_meals || 'breakfast,lunch,dinner,snack').split(',');
  document.querySelectorAll('.chk-meal').forEach(chk => {
    chk.checked = enabled.includes(chk.value);
  });

  updateFastingMealRulesHint(fastSelect ? fastSelect.value : 'none');
}

function updateFastingMealRulesHint(proto) {
  const hintEl = document.getElementById('fasting-meal-rule-hint');
  if (!hintEl) return;

  if (proto === 'omad') {
    hintEl.innerText = '💡 Protocollo OMAD: seleziona esattamente 1 pasto principale (es. solo Pranzo o solo Cena).';
  } else if (proto === '16_8') {
    hintEl.innerText = '💡 Protocollo 16:8: seleziona 2 pasti principali (es. Pranzo e Cena) + 1 spuntino.';
  } else {
    hintEl.innerText = '💡 Seleziona liberamente i pasti che desideri tracciare nel diario.';
  }
}

export function setupSettingsForm() {
  const form = document.getElementById('settings-form');
  if (!form) return;

  const fastSelect = document.getElementById('sett-fasting');
  const mealCheckboxes = document.querySelectorAll('.chk-meal');

  if (fastSelect) {
    fastSelect.addEventListener('change', (e) => {
      const proto = e.target.value;
      updateFastingMealRulesHint(proto);

      if (proto === 'omad') {
        let checked = Array.from(mealCheckboxes).filter(c => c.checked);
        if (checked.length > 1) {
          mealCheckboxes.forEach((c, idx) => c.checked = (idx === 1));
        }
      } else if (proto === '16_8') {
        mealCheckboxes.forEach(c => {
          c.checked = (c.value === 'lunch' || c.value === 'dinner' || c.value === 'snack');
        });
      }
    });
  }

  mealCheckboxes.forEach(chk => {
    chk.addEventListener('change', () => {
      const proto = fastSelect ? fastSelect.value : 'none';
      if (proto === 'omad') {
        if (chk.checked) {
          mealCheckboxes.forEach(c => {
            if (c !== chk) c.checked = false;
          });
        }
      } else if (proto === '16_8') {
        const mainChecked = Array.from(document.querySelectorAll('.chk-meal[value="breakfast"]:checked, .chk-meal[value="lunch"]:checked, .chk-meal[value="dinner"]:checked'));
        if (mainChecked.length > 2) {
          showToast('Per il 16:8 puoi selezionare al massimo 2 pasti principali (es. Pranzo e Cena).', 'warning');
          chk.checked = false;
        }
      }
    });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (document.activeElement) document.activeElement.blur();

    const enabledMeals = Array.from(document.querySelectorAll('.chk-meal:checked')).map(c => c.value).join(',');
    const passwordVal = document.getElementById('sett-password').value;

    if (!enabledMeals) {
      showToast('Seleziona almeno un pasto da visualizzare nel diario.', 'warning');
      return;
    }

    const payload = {
      name: document.getElementById('sett-name').value,
      email: document.getElementById('sett-email').value,
      age: parseInt(document.getElementById('sett-age').value),
      gender: document.getElementById('sett-gender').value,
      height: parseFloat(document.getElementById('sett-height').value),
      weight: parseFloat(document.getElementById('sett-weight').value),
      activityLevel: document.getElementById('sett-activity').value,
      goal: document.getElementById('sett-goal') ? document.getElementById('sett-goal').value : 'maintenance',
      fastingProtocol: document.getElementById('sett-fasting').value,
      enabledMeals
    };

    if (passwordVal && passwordVal.trim().length > 0) {
      payload.password = passwordVal;
    }

    try {
      const data = await apiFetch(`${API_BASE}/api/users/profile`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });

      state.user = data.user;
      document.getElementById('sett-password').value = '';
      showToast('Profilo e impostazioni salvati con successo!', 'success');
      showDashboard();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  });
}

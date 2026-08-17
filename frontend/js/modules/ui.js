import { state } from './state.js';
import { loadRecommendedRecipes } from './recipes.js';
import { loadPeriodStats } from './analytics.js';
import { populateSettingsForm } from './auth.js';
import { checkFastingState, loadDashboardData, loadWeightHistory } from './diary.js';

// DOM Elements
const authContainer = document.getElementById('auth-container');
const dashboardContainer = document.getElementById('dashboard-container');
const userDisplayName = document.getElementById('user-display-name');
const btnLogout = document.getElementById('btn-logout');
const mainNavCentered = document.getElementById('main-nav-centered');
const btnProfileDropdown = document.getElementById('btn-profile-dropdown');
const profileDropdownMenu = document.getElementById('profile-dropdown-menu');
const btnMenuSettings = document.getElementById('btn-menu-settings');
const toastContainer = document.getElementById('toast-container');

// HTML Sanitizer Utility to prevent XSS
export function escapeHTML(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Toast Notification System
export function showToast(message, type = 'info') {
  if (!toastContainer) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  let icon = 'ℹ️';
  if (type === 'warning') icon = '⚠️';
  if (type === 'danger') icon = '🚨';
  if (type === 'success') icon = '✅';

  toast.innerHTML = `<span>${icon}</span><span>${escapeHTML(message)}</span>`;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.5s ease';
    setTimeout(() => toast.remove(), 500);
  }, 4500);
}

export function setupProfileDropdown() {
  if (btnProfileDropdown) {
    btnProfileDropdown.addEventListener('click', (e) => {
      e.stopPropagation();
      profileDropdownMenu.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
      if (profileDropdownMenu && !profileDropdownMenu.contains(e.target) && e.target !== btnProfileDropdown) {
        profileDropdownMenu.classList.add('hidden');
      }
    });
  }

  if (btnMenuSettings) {
    btnMenuSettings.addEventListener('click', (e) => {
      e.stopPropagation();
      profileDropdownMenu.classList.add('hidden');
      switchTab('settings');
    });
  }
}

export function renderCenteredNav() {
  if (!mainNavCentered) return;

  const tabsConfig = [
    { id: 'diary', label: 'DIARY', icon: '📖' },
    { id: 'recipes', label: 'RICETTE', icon: '🍲' },
    { id: 'stats', label: 'STATISTICHE', icon: '📈' }
  ];

  mainNavCentered.innerHTML = '';

  tabsConfig.forEach(t => {
    const isActive = (state.activeTab === t.id);
    const btn = document.createElement('button');
    btn.className = `nav-btn nav-tab ${isActive ? 'active' : ''}`;
    btn.setAttribute('data-nav', t.id);
    btn.title = t.label;

    if (isActive) {
      btn.innerHTML = `<span class="nav-icon">${t.icon}</span><span class="nav-label">${t.label}</span>`;
    } else {
      btn.innerHTML = `<span class="nav-icon">${t.icon}</span>`;
    }

    btn.addEventListener('click', () => switchTab(t.id));
    mainNavCentered.appendChild(btn);
  });
}

export function switchTab(tabId) {
  state.activeTab = tabId;
  renderCenteredNav();

  document.querySelectorAll('.tab-content').forEach(tc => tc.classList.add('hidden'));
  const activeContent = document.getElementById(`tab-content-${tabId}`);
  if (activeContent) activeContent.classList.remove('hidden');

  if (tabId === 'recipes') loadRecommendedRecipes();
  if (tabId === 'stats') loadPeriodStats();
  if (tabId === 'settings') populateSettingsForm();
}

export function setupPeriodToggleListeners() {
  const periodBtns = document.querySelectorAll('.period-toggle .period-btn');
  periodBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      periodBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.statsPeriod = btn.getAttribute('data-period');
      loadPeriodStats();
    });
  });
}

export function showAuth() {
  if (authContainer) authContainer.classList.remove('hidden');
  if (dashboardContainer) dashboardContainer.classList.add('hidden');
}

export async function showDashboard() {
  if (authContainer) authContainer.classList.add('hidden');
  if (dashboardContainer) dashboardContainer.classList.remove('hidden');

  try {
    const res = await fetch(`${window.location.origin}/api/users/profile`, {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });

    if (res.status === 401 || res.status === 403) {
      if (btnLogout) btnLogout.click();
      return;
    }

    const userProfile = await res.json();
    state.user = userProfile;
    if (userDisplayName) userDisplayName.innerText = `Ciao, ${userProfile.name}`;

    renderCenteredNav();
    checkFastingState();

    if (state.fastingTimerInterval) clearInterval(state.fastingTimerInterval);
    state.fastingTimerInterval = setInterval(checkFastingState, 1000);

    await loadDashboardData();
    await loadWeightHistory();
  } catch (err) {
    console.error('Error fetching profile:', err);
    if (btnLogout) btnLogout.click();
  }
}

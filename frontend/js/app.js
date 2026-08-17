import { state } from './modules/state.js';
import { setupProfileDropdown, setupPeriodToggleListeners, showDashboard, showAuth } from './modules/ui.js';
import { setupAuthListeners, setupSettingsForm } from './modules/auth.js';
import { setupDiaryListeners, setupActivityAndWeightDialogs, isMealLoggingBlocked, resetDialogInputs } from './modules/diary.js';

// Initialization & DOM Setup
window.addEventListener('beforeunload', (e) => {
  delete e.returnValue;
});

document.addEventListener('DOMContentLoaded', () => {
  const todayStr = new Date().toISOString().split('T')[0];
  const diaryDateInput = document.getElementById('diary-date');
  
  if (diaryDateInput) diaryDateInput.value = state.currentDate;
  
  const wDateInput = document.getElementById('weight-log-date');
  if (wDateInput) {
    wDateInput.value = todayStr;
    wDateInput.setAttribute('max', todayStr);
  }

  const editWDateInput = document.getElementById('edit-weight-date');
  if (editWDateInput) {
    editWDateInput.setAttribute('max', todayStr);
  }

  setupProfileDropdown();
  setupAuthListeners();
  setupDiaryListeners();
  setupSettingsForm();
  setupActivityAndWeightDialogs();
  setupPeriodToggleListeners();

  if (state.token) {
    showDashboard();
  } else {
    showAuth();
  }
});

// Global functions for inline HTML onclick handlers
window.openAddMealModal = function(mealType) {
  if (isMealLoggingBlocked()) return;

  const addMealDialog = document.getElementById('add-meal-dialog');
  const btnDeleteModalMeal = document.getElementById('btn-delete-modal-meal');
  const btnSubmitMeal = document.getElementById('btn-submit-meal');
  const dialogTitle = document.getElementById('dialog-title');

  state.activeMealType = mealType;
  state.activeItemIndex = -1;

  document.getElementById('group-search-food').classList.remove('hidden');
  document.getElementById('group-new-food').classList.remove('hidden');
  if (btnDeleteModalMeal) btnDeleteModalMeal.classList.add('hidden');
  if (btnSubmitMeal) btnSubmitMeal.innerText = 'Aggiungi al diario';

  const names = { breakfast: 'Colazione', lunch: 'Pranzo', dinner: 'Cena', snack: 'Spuntini' };
  if (dialogTitle) dialogTitle.innerText = `Aggiungi a ${names[mealType] || mealType}`;
  resetDialogInputs();
  if (addMealDialog) addMealDialog.showModal();
};

window.editMealItem = function(mealType, index) {
  const addMealDialog = document.getElementById('add-meal-dialog');
  const selectedFoodInfo = document.getElementById('selected-food-info');
  const btnDeleteModalMeal = document.getElementById('btn-delete-modal-meal');
  const btnSubmitMeal = document.getElementById('btn-submit-meal');
  const dialogTitle = document.getElementById('dialog-title');
  const infoFoodName = document.getElementById('info-food-name');
  const foodQuantityInput = document.getElementById('food-quantity-input');

  state.activeMealType = mealType;
  state.activeItemIndex = index;

  const item = (state.diary && state.diary.meals && state.diary.meals[mealType]) ? state.diary.meals[mealType][index] : null;
  if (!item) return;

  document.getElementById('group-search-food').classList.add('hidden');
  document.getElementById('group-new-food').classList.add('hidden');
  if (selectedFoodInfo) selectedFoodInfo.classList.remove('hidden');
  if (btnDeleteModalMeal) btnDeleteModalMeal.classList.remove('hidden');
  if (btnSubmitMeal) btnSubmitMeal.innerText = 'Salva Modifiche';

  if (dialogTitle) dialogTitle.innerText = `Modifica ${item.foodName}`;
  if (infoFoodName) infoFoodName.innerText = item.foodName;
  if (foodQuantityInput) foodQuantityInput.value = item.quantity;
  if (btnSubmitMeal) btnSubmitMeal.disabled = false;
  if (addMealDialog) addMealDialog.showModal();
};

window.deleteActivity = async function(index) {
  if (confirm('Rimuovere questa attività fisica?')) {
    try {
      await fetch(`${window.location.origin}/api/diary/activity`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${state.token}`
        },
        body: JSON.stringify({ date: state.currentDate, activityIndex: index })
      });
      const { loadDashboardData } = await import('./modules/diary.js');
      const { showToast } = await import('./modules/ui.js');
      await loadDashboardData();
      showToast('Attività fisica rimossa.', 'info');
    } catch (e) { console.error(e); }
  }
};

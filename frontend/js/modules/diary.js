import { state } from './state.js';
import { apiFetch } from './api.js';
import { showToast, escapeHTML } from './ui.js';

const API_BASE = window.location.origin;

export function setupDiaryListeners() {
  const diaryDateInput = document.getElementById('diary-date');
  const btnPrevDate = document.getElementById('btn-prev-date');
  const btnNextDate = document.getElementById('btn-next-date');
  const addMealDialog = document.getElementById('add-meal-dialog');
  const btnCloseDialog = document.getElementById('btnCloseDialog') || document.getElementById('btn-close-dialog');
  const foodSearchInput = document.getElementById('food-search-input');
  const searchResultsList = document.getElementById('search-results');
  const btnToggleNewFood = document.getElementById('btn-toggle-new-food');
  const newFoodForm = document.getElementById('new-food-form');
  const newFoodName = document.getElementById('new-food-name');
  const newFoodCal = document.getElementById('new-food-cal');
  const newFoodCarbs = document.getElementById('new-food-carbs');
  const newFoodProtein = document.getElementById('new-food-protein');
  const newFoodFat = document.getElementById('new-food-fat');
  const btnCreateFood = document.getElementById('btn-create-food');
  const foodQuantityInput = document.getElementById('food-quantity-input');
  const btnSubmitMeal = document.getElementById('btn-submit-meal');
  const btnDeleteModalMeal = document.getElementById('btn-delete-modal-meal');

  if (diaryDateInput) {
    diaryDateInput.addEventListener('change', (e) => {
      state.currentDate = e.target.value;
      loadDashboardData();
    });
  }

  if (btnPrevDate) {
    btnPrevDate.addEventListener('click', () => {
      const d = new Date(state.currentDate);
      d.setDate(d.getDate() - 1);
      state.currentDate = d.toISOString().split('T')[0];
      if (diaryDateInput) diaryDateInput.value = state.currentDate;
      loadDashboardData();
    });
  }

  if (btnNextDate) {
    btnNextDate.addEventListener('click', () => {
      const d = new Date(state.currentDate);
      d.setDate(d.getDate() + 1);
      state.currentDate = d.toISOString().split('T')[0];
      if (diaryDateInput) diaryDateInput.value = state.currentDate;
      loadDashboardData();
    });
  }

  if (btnCloseDialog && addMealDialog) {
    btnCloseDialog.addEventListener('click', () => addMealDialog.close());
  }

  // Search food input
  let searchTimeout;
  if (foodSearchInput && searchResultsList) {
    foodSearchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      const query = e.target.value.trim();
      if (query.length < 2) {
        searchResultsList.classList.add('hidden');
        return;
      }

      searchTimeout = setTimeout(async () => {
        try {
          const foods = await apiFetch(`${API_BASE}/api/food/search?q=${encodeURIComponent(query)}`);

          searchResultsList.innerHTML = '';
          if (foods.length === 0) {
            const li = document.createElement('li');
            li.innerText = 'Nessun alimento trovato';
            searchResultsList.appendChild(li);
          } else {
            foods.forEach(food => {
              const li = document.createElement('li');
              li.innerHTML = `<span>${escapeHTML(food.name)} ${food.isRecipe ? '🍲' : ''}</span><span class="food-cals-preview">${food.calories} kcal</span>`;
              li.addEventListener('click', () => selectFood(food));
              searchResultsList.appendChild(li);
            });
          }
          searchResultsList.classList.remove('hidden');
        } catch (err) {
          console.error('Error searching foods:', err);
        }
      }, 300);
    });
  }

  if (btnToggleNewFood && newFoodForm) {
    btnToggleNewFood.addEventListener('click', () => newFoodForm.classList.toggle('hidden'));
  }

  if (btnCreateFood) {
    btnCreateFood.addEventListener('click', async () => {
      const name = newFoodName.value.trim();
      const calories = newFoodCal.value;
      const carbs = newFoodCarbs.value || 0;
      const protein = newFoodProtein.value || 0;
      const fat = newFoodFat.value || 0;

      if (!name || !calories) {
        alert('Nome e calorie richiesti.');
        return;
      }

      try {
        const newFood = await apiFetch(`${API_BASE}/api/food`, {
          method: 'POST',
          body: JSON.stringify({
            name, calories: parseInt(calories),
            carbs: parseFloat(carbs), protein: parseFloat(protein), fat: parseFloat(fat)
          })
        });

        selectFood(newFood);
        if (newFoodForm) newFoodForm.classList.add('hidden');
        showToast('Alimento creato con successo!', 'success');
      } catch (err) {
        showToast(err.message, 'danger');
      }
    });
  }

  // Submit Meal (create or edit)
  if (btnSubmitMeal && addMealDialog) {
    btnSubmitMeal.addEventListener('click', async () => {
      const quantity = foodQuantityInput.value;
      const numQuantity = parseFloat(quantity);

      if (isNaN(numQuantity) || numQuantity <= 0) {
        showToast('La quantità deve essere un numero positivo.', 'warning');
        return;
      }

      if (state.activeItemIndex >= 0) {
        try {
          await apiFetch(`${API_BASE}/api/diary/meal`, {
            method: 'PUT',
            body: JSON.stringify({
              date: state.currentDate,
              mealType: state.activeMealType,
              itemIndex: state.activeItemIndex,
              quantity: numQuantity
            })
          });

          addMealDialog.close();
          await loadDashboardData();
          showToast('Pasto aggiornato con successo!', 'success');
        } catch (e) { showToast(e.message, 'danger'); }
      } else {
        if (!state.selectedFood) return;
        try {
          await apiFetch(`${API_BASE}/api/diary/meal`, {
            method: 'POST',
            body: JSON.stringify({
              date: state.currentDate,
              mealType: state.activeMealType,
              foodName: state.selectedFood.name,
              quantity: numQuantity
            })
          });

          triggerFastingCycleOnMealLogged();
          addMealDialog.close();
          await loadDashboardData();
          showToast('Alimento aggiunto al diario!', 'success');
        } catch (e) { showToast(e.message, 'danger'); }
      }
    });
  }

  // Modal Delete Meal button
  if (btnDeleteModalMeal && addMealDialog) {
    btnDeleteModalMeal.addEventListener('click', async () => {
      if (state.activeItemIndex < 0) return;
      if (confirm('Sei sicuro di voler rimuovere questo alimento dal diario?')) {
        try {
          await apiFetch(`${API_BASE}/api/diary/meal`, {
            method: 'DELETE',
            body: JSON.stringify({
              date: state.currentDate,
              mealType: state.activeMealType,
              itemIndex: state.activeItemIndex
            })
          });

          addMealDialog.close();
          await loadDashboardData();
          checkFastingResetOnMealDeleted();
          showToast('Alimento rimosso dal diario.', 'info');
        } catch (e) { console.error(e); }
      }
    });
  }
}

// FASTING PROTOCOL LOGIC WITH RESET ON 0 MEALS
export function getFastingState() {
  if (!state.user) return null;
  const key = `fastingState_${state.user.id}`;
  const raw = localStorage.getItem(key);
  if (!raw) return { protocol: state.user.fasting_protocol || 'none', phase: 'idle', startTime: null, endTime: null };
  return JSON.parse(raw);
}

export function saveFastingState(fs) {
  if (!state.user) return;
  const key = `fastingState_${state.user.id}`;
  localStorage.setItem(key, JSON.stringify(fs));
}

export function checkFastingState() {
  if (!state.user) return;
  const proto = state.user.fasting_protocol || 'none';
  const fCard = document.getElementById('fasting-widget-card');

  if (proto === 'none') {
    if (fCard) fCard.classList.add('hidden');
    return;
  } else {
    if (fCard) fCard.classList.remove('hidden');
  }

  let fs = getFastingState();
  if (fs.protocol && fs.protocol !== proto) {
    fs = { protocol: proto, phase: 'idle', startTime: null, endTime: null };
    saveFastingState(fs);
  }
  fs.protocol = proto;

  // Sanitize OMAD eating window: max 1 hour (3600000 ms)
  if (proto === 'omad' && fs.phase === 'eating' && fs.startTime && fs.endTime) {
    if (fs.endTime - fs.startTime > 3600000) {
      fs.endTime = fs.startTime + 3600000;
      saveFastingState(fs);
    }
  }

  const now = Date.now();

  if (fs.phase === 'fasting' && fs.endTime && now >= fs.endTime) {
    if (proto === '16_8') {
      fs.phase = 'eating';
      fs.startTime = now;
      fs.endTime = now + (8 * 3600 * 1000);
      showToast('🎉 Digiuno 16:8 terminato! Ora sei nella finestra alimentare di 8 ore.', 'success');
    } else {
      fs.phase = 'idle';
      fs.startTime = null;
      fs.endTime = null;
      showToast('🎉 Digiuno OMAD di 23h completato! Puoi consumare il tuo pasto del giorno.', 'success');
    }
    saveFastingState(fs);
  } else if (fs.phase === 'eating' && fs.endTime && now >= fs.endTime) {
    fs.phase = 'fasting';
    fs.startTime = now;
    if (proto === 'omad') {
      fs.endTime = now + (23 * 3600 * 1000);
      showToast('🔒 Finestra alimentare OMAD di 1 ora terminata! Inizia la finestra di digiuno di 23 ore.', 'warning');
    } else {
      fs.endTime = now + (16 * 3600 * 1000);
      showToast('⌛ Finestra alimentare di 8 ore terminata! Inizia la finestra di digiuno di 16 ore.', 'warning');
    }
    saveFastingState(fs);
  }

  updateFastingWidgetUI(fs);
}

export function checkFastingResetOnMealDeleted() {
  if (!state.diary || !state.diary.meals) return;

  let totalItems = 0;
  Object.values(state.diary.meals).forEach(items => {
    totalItems += (items ? items.length : 0);
  });

  if (totalItems === 0) {
    let fs = getFastingState();
    if (fs && fs.phase !== 'idle') {
      fs.phase = 'idle';
      fs.startTime = null;
      fs.endTime = null;
      saveFastingState(fs);
      showToast('🔄 Diario vuoto: Timer di digiuno azzerato. Puoi inserire il pasto corretto!', 'info');
      checkFastingState();
    }
  }
}

export function triggerFastingCycleOnMealLogged() {
  if (!state.user) return;
  const proto = state.user.fasting_protocol || 'none';
  if (proto === 'none') return;

  let fs = getFastingState();
  const now = Date.now();

  if (proto === 'omad') {
    if (fs.phase === 'idle') {
      fs.phase = 'eating';
      fs.startTime = now;
      fs.endTime = now + (1 * 3600 * 1000);
      saveFastingState(fs);
      showToast('⏱️ OMAD: Finestra alimentare di 1 ora avviata! Puoi aggiungere liberamente tutti i cibi del pasto.', 'info');
    }
  } else if (proto === '16_8') {
    if (fs.phase === 'idle') {
      fs.phase = 'eating';
      fs.startTime = now;
      fs.endTime = now + (8 * 3600 * 1000);
      saveFastingState(fs);
      showToast('⏱️ Digiuno 16:8: Finestra alimentare di 8 ore avviata!', 'info');
    }
  }
}

export function isMealLoggingBlocked() {
  if (!state.user) return false;
  const proto = state.user.fasting_protocol || 'none';
  if (proto === 'none') return false;

  const fs = getFastingState();
  const now = Date.now();

  if (fs.phase === 'fasting' && fs.endTime && now < fs.endTime) {
    const hoursLeft = Math.ceil((fs.endTime - now) / (3600 * 1000));
    showToast(`⛔ Finestra di digiuno attiva! Non puoi aggiungere pasti per le prossime ${hoursLeft} ore.`, 'danger');
    return true;
  }
  return false;
}

export function updateFastingWidgetUI(fs) {
  const pBadge = document.getElementById('fasting-protocol-badge');
  const timerEl = document.getElementById('fasting-timer-countdown');
  const statusEl = document.getElementById('fasting-timer-status');

  const protoNames = { none: 'Nessuno', '16_8': 'Digiuno 16:8', omad: 'OMAD (23:1)' };
  if (pBadge) pBadge.innerHTML = `Protocollo: <strong>${protoNames[fs.protocol] || 'Nessuno'}</strong>`;

  if (!timerEl || !statusEl) return;

  if (fs.phase === 'idle') {
    timerEl.innerText = '00:00:00';
    statusEl.innerText = 'In attesa del primo cibo inserito nel pasto...';
    return;
  }

  const now = Date.now();
  const diff = (fs.endTime || now) - now;

  if (diff <= 0) {
    timerEl.innerText = '00:00:00';
    statusEl.innerText = 'Finestra completata';
    return;
  }

  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  const pad = n => n.toString().padStart(2, '0');

  timerEl.innerText = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;

  if (fs.phase === 'fasting') {
    statusEl.innerHTML = `<span style="color: #ef4444; font-weight: 600;">🔒 Digiuno OMAD Attivo</span> (Pasti bloccati per le prossime ${hours}h ${minutes}m)`;
  } else if (fs.phase === 'eating') {
    statusEl.innerHTML = `<span style="color: #34d399; font-weight: 600;">🍽️ Finestra Alimentare OMAD Attiva (Grace Time)</span> (Puoi aggiungere cibi per ancora ${minutes}m ${seconds}s)`;
  }
}

export function setupActivityAndWeightDialogs() {
  const activityDialog = document.getElementById('activity-dialog');
  const btnOpenActivityDialog = document.getElementById('btn-open-activity-dialog');
  const btnCloseActivityDialog = document.getElementById('btn-close-activity-dialog');
  const btnSubmitActivity = document.getElementById('btn-submit-activity');

  const weightDialog = document.getElementById('weight-dialog');
  const btnOpenWeightDialog = document.getElementById('btn-open-weight-dialog');
  const btnCloseWeightDialog = document.getElementById('btn-close-weight-dialog');
  const btnSubmitWeight = document.getElementById('btn-submit-weight');

  const editWeightDialog = document.getElementById('edit-weight-dialog');
  const btnCloseEditWeightDialog = document.getElementById('btn-close-edit-weight-dialog');
  const btnSubmitEditWeight = document.getElementById('btn-submit-edit-weight');
  const btnDeleteWeightEntry = document.getElementById('btn-delete-weight-entry');

  if (btnOpenActivityDialog && activityDialog) {
    btnOpenActivityDialog.addEventListener('click', () => {
      document.getElementById('act-name-input').value = '';
      document.getElementById('act-cals-input').value = '';
      activityDialog.showModal();
    });
  }
  if (btnCloseActivityDialog && activityDialog) btnCloseActivityDialog.addEventListener('click', () => activityDialog.close());

  if (btnSubmitActivity) {
    btnSubmitActivity.addEventListener('click', async () => {
      const name = document.getElementById('act-name-input').value.trim();
      const calories = document.getElementById('act-cals-input').value;
      const duration = document.getElementById('act-duration-input').value || 30;

      if (!name || !calories) {
        alert('Compila il tipo di attività e le calorie.');
        return;
      }

      try {
        await apiFetch(`${API_BASE}/api/diary/activity`, {
          method: 'POST',
          body: JSON.stringify({
            date: state.currentDate,
            name, calories: parseInt(calories), durationMin: parseInt(duration)
          })
        });

        if (activityDialog) activityDialog.close();
        await loadDashboardData();
        showToast('Attività fisica registrata!', 'success');
      } catch (e) { showToast(e.message, 'danger'); }
    });
  }

  if (btnOpenWeightDialog && weightDialog) {
    btnOpenWeightDialog.addEventListener('click', () => {
      const todayStr = new Date().toISOString().split('T')[0];
      document.getElementById('weight-log-input').value = state.user ? state.user.weight : '';
      const wDateInput = document.getElementById('weight-log-date');
      if (wDateInput) {
        wDateInput.value = state.currentDate <= todayStr ? state.currentDate : todayStr;
        wDateInput.setAttribute('max', todayStr);
      }
      weightDialog.showModal();
    });
  }
  if (btnCloseWeightDialog && weightDialog) btnCloseWeightDialog.addEventListener('click', () => weightDialog.close());

  if (btnSubmitWeight && weightDialog) {
    btnSubmitWeight.addEventListener('click', async () => {
      const weightVal = document.getElementById('weight-log-input').value;
      const dateVal = document.getElementById('weight-log-date').value;
      const todayStr = new Date().toISOString().split('T')[0];

      if (!weightVal) {
        alert('Inserisci il valore del peso.');
        return;
      }

      if (dateVal > todayStr) {
        showToast('Non puoi inserire il peso per una data futura!', 'danger');
        return;
      }

      const numW = parseFloat(weightVal);

      try {
        await apiFetch(`${API_BASE}/api/users/weight`, {
          method: 'POST',
          body: JSON.stringify({ weight: numW, date: dateVal })
        });

        weightDialog.close();
        if (state.user) state.user.weight = numW;
        const currentWeightEl = document.getElementById('weight-current-val');
        if (currentWeightEl) currentWeightEl.innerText = `${numW} kg`;

        await loadWeightHistory();
        showToast('Peso corporeo registrato in tempo reale!', 'success');
      } catch (e) {
        showToast(e.message, 'danger');
      }
    });
  }

  if (btnCloseEditWeightDialog && editWeightDialog) btnCloseEditWeightDialog.addEventListener('click', () => editWeightDialog.close());

  if (btnSubmitEditWeight && editWeightDialog) {
    btnSubmitEditWeight.addEventListener('click', async () => {
      const id = document.getElementById('edit-weight-id').value;
      const weightVal = document.getElementById('edit-weight-input').value;
      const dateVal = document.getElementById('edit-weight-date').value;
      const todayStr = new Date().toISOString().split('T')[0];

      if (!id || !weightVal) return;

      if (dateVal > todayStr) {
        showToast('Non puoi inserire il peso per una data futura!', 'danger');
        return;
      }

      try {
        await apiFetch(`${API_BASE}/api/users/weight-history/${id}`, {
          method: 'PUT',
          body: JSON.stringify({ weight: parseFloat(weightVal), date: dateVal })
        });

        editWeightDialog.close();
        await loadWeightHistory();
        showToast('Registrazione peso aggiornata con successo!', 'success');
      } catch (err) {
        showToast(err.message, 'danger');
      }
    });
  }

  if (btnDeleteWeightEntry && editWeightDialog) {
    btnDeleteWeightEntry.addEventListener('click', async () => {
      const id = document.getElementById('edit-weight-id').value;
      if (!id) return;

      if (confirm('Sei sicuro di voler eliminare questa registrazione del peso?')) {
        try {
          await apiFetch(`${API_BASE}/api/users/weight-history/${id}`, {
            method: 'DELETE'
          });

          editWeightDialog.close();
          await loadWeightHistory();
          showToast('Registrazione peso eliminata con successo.', 'info');
        } catch (err) {
          showToast(err.message, 'danger');
        }
      }
    });
  }
}

export function openEditWeightModal(entry) {
  if (!entry) return;
  const editWeightDialog = document.getElementById('edit-weight-dialog');
  if (!editWeightDialog) return;

  document.getElementById('edit-weight-id').value = entry.id;
  document.getElementById('edit-weight-input').value = entry.weight;
  
  const rawDate = entry.date ? entry.date.split('T')[0] : new Date().toISOString().split('T')[0];
  const editDateInput = document.getElementById('edit-weight-date');
  if (editDateInput) {
    editDateInput.value = rawDate;
    editDateInput.setAttribute('max', new Date().toISOString().split('T')[0]);
  }

  editWeightDialog.showModal();
}

export function resetDialogInputs() {
  const foodSearchInput = document.getElementById('food-search-input');
  const searchResultsList = document.getElementById('search-results');
  const selectedFoodInfo = document.getElementById('selected-food-info');
  const foodQuantityInput = document.getElementById('food-quantity-input');
  const btnSubmitMeal = document.getElementById('btn-submit-meal');
  const newFoodForm = document.getElementById('new-food-form');

  if (foodSearchInput) foodSearchInput.value = '';
  if (searchResultsList) searchResultsList.classList.add('hidden');
  if (selectedFoodInfo) selectedFoodInfo.classList.add('hidden');
  if (foodQuantityInput) foodQuantityInput.value = 100;
  state.selectedFood = null;
  if (btnSubmitMeal) btnSubmitMeal.disabled = true;
  if (newFoodForm) newFoodForm.classList.add('hidden');
}

export function selectFood(food) {
  state.selectedFood = food;
  document.getElementById('info-food-name').innerText = food.name;
  document.getElementById('info-calories').innerText = food.calories;
  document.getElementById('info-carbs').innerText = food.carbs;
  document.getElementById('info-protein').innerText = food.protein;
  document.getElementById('info-fat').innerText = food.fat;
  document.getElementById('info-unit').innerText = food.unit || '100g';

  document.getElementById('selected-food-info').classList.remove('hidden');
  document.getElementById('search-results').classList.add('hidden');
  document.getElementById('btn-submit-meal').disabled = false;
}

export async function loadDashboardData() {
  if (!state.token || !state.user) return;

  try {
    const [analyticsRes, diaryRes] = await Promise.allSettled([
      apiFetch(`${API_BASE}/api/analytics/daily?date=${state.currentDate}`),
      apiFetch(`${API_BASE}/api/diary?date=${state.currentDate}`)
    ]);

    if (analyticsRes.status === 'fulfilled' && analyticsRes.value) {
      state.analytics = analyticsRes.value.stats;
    }
    if (diaryRes.status === 'fulfilled' && diaryRes.value) {
      state.diary = diaryRes.value;
    }

    renderDashboard();
    checkSmartNotifications();
  } catch (err) {
    console.error('Error loading dashboard data:', err);
    renderDashboard();
  }
}

export function renderDashboard() {
  const target = state.user;
  const stats = state.analytics || { calories: 0, carbs: 0, protein: 0, fat: 0, water: 0, exerciseCalories: 0 };
  const diary = state.diary || { meals: {}, activities: [] };

  const effectiveTarget = target.daily_calories + (stats.exerciseCalories || 0);
  const eaten = stats.calories;

  document.getElementById('val-food-cals').innerText = eaten;
  document.getElementById('val-sport-cals').innerText = `+${stats.exerciseCalories || 0}`;

  const remaining = effectiveTarget - eaten;
  const calRemainingEl = document.getElementById('cal-remaining');
  const calStatusLabel = document.getElementById('cal-status-label');
  const progressBar = document.getElementById('calorie-progress-bar');
  document.getElementById('cal-target').innerText = effectiveTarget;

  if (remaining < 0) {
    const overflow = Math.abs(remaining);
    calRemainingEl.innerText = `+${overflow}`;
    calRemainingEl.className = 'value overflow-text';
    calStatusLabel.innerText = 'kcal in eccesso!';
    progressBar.style.stroke = '#ef4444';
    progressBar.style.strokeDashoffset = 0;
  } else {
    calRemainingEl.innerText = remaining;
    calRemainingEl.className = 'value';
    calStatusLabel.innerText = 'kcal rimaste';

    const percentage = Math.min(1, eaten / effectiveTarget);
    const offset = 465 - (percentage * 465);
    progressBar.style.strokeDashoffset = offset;
    progressBar.style.stroke = '#10b981';
  }

  // Macronutrients
  document.getElementById('carbs-current').innerText = stats.carbs;
  document.getElementById('carbs-target').innerText = target.target_carbs;
  document.getElementById('carbs-bar').style.width = `${Math.min(100, (stats.carbs / target.target_carbs) * 100)}%`;

  document.getElementById('protein-current').innerText = stats.protein;
  document.getElementById('protein-target').innerText = target.target_protein;
  document.getElementById('protein-bar').style.width = `${Math.min(100, (stats.protein / target.target_protein) * 100)}%`;

  document.getElementById('fat-current').innerText = stats.fat;
  document.getElementById('fat-target').innerText = target.target_fat;
  document.getElementById('fat-bar').style.width = `${Math.min(100, (stats.fat / target.target_fat) * 100)}%`;

  // Water & Interactive Glasses Render
  renderWaterGlassesGrid(stats.water || 0);

  // Activities List Render
  const actListEl = document.getElementById('activities-list');
  actListEl.innerHTML = '';
  const activities = diary.activities || [];
  if (activities.length === 0) {
    actListEl.innerHTML = '<li class="empty-message">Nessuna attività registrata oggi</li>';
  } else {
    activities.forEach((act, idx) => {
      const li = document.createElement('li');
      li.innerHTML = `
        <div>
          <strong>${escapeHTML(act.name)}</strong>
          <span style="font-size: 0.8rem; color: var(--text-muted);"> (${act.durationMin || 30} min)</span>
        </div>
        <div>
          <span class="text-green">+${act.calories} kcal</span>
          <button class="btn-icon" title="Elimina attività" onclick="deleteActivity(${idx})">🗑️</button>
        </div>
      `;
      actListEl.appendChild(li);
    });
  }

  // Meals Container Render (Dynamic enabled meals)
  const mealsContainer = document.getElementById('meals-container');
  mealsContainer.innerHTML = '';

  const enabledMealsList = target.enabled_meals ? target.enabled_meals.split(',') : ['breakfast', 'lunch', 'dinner', 'snack'];
  const mealTitles = {
    breakfast: { title: '🍳 Colazione', key: 'breakfast' },
    lunch: { title: '🍝 Pranzo', key: 'lunch' },
    dinner: { title: '🥩 Cena', key: 'dinner' },
    snack: { title: '🍎 Spuntini', key: 'snack' }
  };

  enabledMealsList.forEach(mKey => {
    const info = mealTitles[mKey] || { title: `🍽️ ${mKey}`, key: mKey };
    const items = (diary.meals && diary.meals[mKey]) ? diary.meals[mKey] : [];

    const card = document.createElement('div');
    card.className = 'meal-card';
    card.setAttribute('data-meal-type', mKey);

    let itemsHtml = '';
    if (items.length === 0) {
      itemsHtml = '<li class="empty-message">Nessun alimento registrato</li>';
    } else {
      items.forEach((item, idx) => {
        itemsHtml += `
          <li>
            <div>
              <span class="food-name">${escapeHTML(item.foodName)}</span>
              <span class="food-qty" style="color: var(--text-muted); font-size: 0.8rem;"> (${item.quantity}g)</span>
            </div>
            <div class="meal-item-actions">
              <span>${item.calories} kcal</span>
              <button class="btn-icon" title="Modifica o Rimuovi Alimento" onclick="editMealItem('${escapeHTML(mKey)}', ${idx})">✏️</button>
            </div>
          </li>
        `;
      });
    }

    card.innerHTML = `
      <div class="meal-header">
        <h3>${info.title}</h3>
        <button class="btn-add-meal" onclick="openAddMealModal('${mKey}')">Aggiungi</button>
      </div>
      <ul class="meal-items">${itemsHtml}</ul>
    `;
    mealsContainer.appendChild(card);
  });
}

export function renderWaterGlassesGrid(currentWaterMl) {
  const grid = document.getElementById('water-glasses-grid');
  document.getElementById('water-current').innerText = currentWaterMl;
  if (!grid) return;

  grid.innerHTML = '';
  const filledCount = Math.floor(currentWaterMl / 200);

  for (let i = 0; i < 10; i++) {
    const isFilled = i < filledCount;
    const glass = document.createElement('div');
    glass.className = `glass-item ${isFilled ? 'filled' : ''}`;
    glass.title = `Bicchiere ${i + 1} (200ml) - Clicca per ${isFilled ? 'rimuovere' : 'aggiungere'}`;

    glass.innerHTML = `
      <span class="glass-icon">🥛</span>
      <span class="glass-label">${(i + 1) * 200} ml</span>
    `;

    glass.addEventListener('click', () => toggleWaterGlass(i, isFilled, filledCount));
    grid.appendChild(glass);
  }
}

export async function toggleWaterGlass(glassIndex, isFilled, filledCount) {
  let targetMl = 0;
  if (isFilled) {
    targetMl = glassIndex * 200;
  } else {
    targetMl = (glassIndex + 1) * 200;
  }

  try {
    await apiFetch(`${API_BASE}/api/diary/water`, {
      method: 'PUT',
      body: JSON.stringify({ date: state.currentDate, amount: targetMl })
    });
    await loadDashboardData();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

export function checkSmartNotifications() {
  if (!state.user || !state.analytics) return;

  const smartAlertBanner = document.getElementById('smart-alert-banner');
  const alertTextMessage = document.getElementById('alert-text-message');

  const todayStr = new Date().toISOString().split('T')[0];
  if (state.currentDate !== todayStr) {
    if (smartAlertBanner) smartAlertBanner.classList.add('hidden');
    return;
  }

  const now = new Date();
  const currentHour = now.getHours();

  // 1. High Calorie Over-limit alert
  const effectiveTarget = state.user.daily_calories + (state.analytics.exerciseCalories || 0);
  if (state.analytics.calories > effectiveTarget) {
    const overflow = state.analytics.calories - effectiveTarget;
    if (alertTextMessage) alertTextMessage.innerText = `Attenzione: hai superato il tuo limite calorico giornaliero di +${overflow} kcal!`;
    if (smartAlertBanner) smartAlertBanner.classList.remove('hidden');
  } else {
    if (smartAlertBanner) smartAlertBanner.classList.add('hidden');
  }

  // 2. Hydration Alert
  const currentWater = state.analytics.water || 0;
  if (currentWater < 1000) {
    showToast(`💧 Idratazione: hai registrato ${currentWater}ml su un minimo di 1000ml consigliati. Ricordati di bere di più!`, 'warning');
  }

  // 3. Missed meal reminders
  const enabled = (state.user.enabled_meals || 'breakfast,lunch,dinner,snack').split(',');
  const missingReminders = [];

  if (currentHour >= 11 && enabled.includes('breakfast')) {
    const breakfastItems = (state.diary && state.diary.meals && state.diary.meals.breakfast) ? state.diary.meals.breakfast : [];
    if (breakfastItems.length === 0) missingReminders.push('Colazione');
  }

  if (currentHour >= 16 && enabled.includes('lunch')) {
    const lunchItems = (state.diary && state.diary.meals && state.diary.meals.lunch) ? state.diary.meals.lunch : [];
    if (lunchItems.length === 0) missingReminders.push('Pranzo');
  }

  if (currentHour >= 18 && enabled.includes('snack')) {
    const snackItems = (state.diary && state.diary.meals && state.diary.meals.snack) ? state.diary.meals.snack : [];
    if (snackItems.length === 0) missingReminders.push('Spuntino');
  }

  if (currentHour >= 21 && enabled.includes('dinner')) {
    const dinnerItems = (state.diary && state.diary.meals && state.diary.meals.dinner) ? state.diary.meals.dinner : [];
    if (dinnerItems.length === 0) missingReminders.push('Cena');
  }

  if (missingReminders.length > 0) {
    let formattedText = '';
    if (missingReminders.length === 1) {
      formattedText = missingReminders[0];
    } else if (missingReminders.length === 2) {
      formattedText = `${missingReminders[0]} e ${missingReminders[1]}`;
    } else {
      formattedText = `${missingReminders.slice(0, -1).join(', ')} e ${missingReminders[missingReminders.length - 1]}`;
    }
    showToast(`⏰ Reminder: non hai ancora registrato ${formattedText}!`, 'warning');
  }
}

export async function loadWeightHistory() {
  try {
    const history = await apiFetch(`${API_BASE}/api/users/weight-history`);

    if (history && history.length > 0) {
      const latest = history[history.length - 1];
      const curW = latest.weight;
      if (state.user) state.user.weight = curW;
      const el = document.getElementById('weight-current-val');
      if (el) el.innerText = `${curW} kg`;
    } else if (state.user) {
      const el = document.getElementById('weight-current-val');
      if (el) el.innerText = `${state.user.weight} kg`;
    }

    renderWeightSvgChart(history || []);
  } catch (e) {
    console.error('Error loading weight history:', e);
  }
}

export function renderWeightSvgChart(history) {
  const svg = document.getElementById('weight-trend-svg');
  if (!svg) return;
  svg.innerHTML = '';

  if (!history || history.length === 0) {
    const emptyText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    emptyText.setAttribute('x', '350');
    emptyText.setAttribute('y', '90');
    emptyText.setAttribute('fill', '#94a3b8');
    emptyText.setAttribute('font-size', '13');
    emptyText.setAttribute('text-anchor', 'middle');
    emptyText.textContent = 'Nessun dato di peso registrato. Clicca su "+ Aggiorna Peso" per aggiungere una misurazione.';
    svg.appendChild(emptyText);
    return;
  }

  const displayHistory = history.slice(-30);
  const weights = displayHistory.map(h => parseFloat(h.weight));
  const minW = Math.max(0, Math.floor(Math.min(...weights) - 3));
  const maxW = Math.ceil(Math.max(...weights) + 3);

  const isMany = displayHistory.length > 12;
  const width = 700;
  const height = isMany ? 240 : 200;
  const paddingTop = 30;
  const paddingBottom = isMany ? 50 : 40;
  const paddingLeft = 55;
  const paddingRight = 30;
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

  const yTicks = 4;
  for (let i = 0; i <= yTicks; i++) {
    const val = (minW + ((maxW - minW) / yTicks) * i).toFixed(1);
    const y = paddingTop + chartHeight - (((val - minW) / (maxW - minW || 1)) * chartHeight);

    const gridLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    gridLine.setAttribute('x1', paddingLeft);
    gridLine.setAttribute('y1', y);
    gridLine.setAttribute('x2', width - paddingRight);
    gridLine.setAttribute('y2', y);
    gridLine.setAttribute('class', 'chart-grid-line');
    svg.appendChild(gridLine);

    const yLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    yLabel.setAttribute('x', paddingLeft - 8);
    yLabel.setAttribute('y', y + 4);
    yLabel.setAttribute('class', 'chart-axis-label');
    yLabel.setAttribute('text-anchor', 'end');
    yLabel.textContent = `${val}kg`;
    svg.appendChild(yLabel);
  }

  const stepX = displayHistory.length > 1 ? chartWidth / (displayHistory.length - 1) : 0;
  let pathD = '';

  displayHistory.forEach((h, idx) => {
    const w = parseFloat(h.weight);
    const x = displayHistory.length > 1 ? paddingLeft + (idx * stepX) : paddingLeft + chartWidth / 2;
    const y = paddingTop + chartHeight - (((w - minW) / (maxW - minW || 1)) * chartHeight);

    if (idx === 0) pathD += `M ${x} ${y}`;
    else pathD += ` L ${x} ${y}`;
  });

  if (displayHistory.length > 1) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathD);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', '#38bdf8');
    path.setAttribute('stroke-width', '3');
    svg.appendChild(path);
  }

  displayHistory.forEach((h, idx) => {
    const w = parseFloat(h.weight);
    const x = displayHistory.length > 1 ? paddingLeft + (idx * stepX) : paddingLeft + chartWidth / 2;
    const y = paddingTop + chartHeight - (((w - minW) / (maxW - minW || 1)) * chartHeight);
    const rawDate = h.date ? h.date.split('T')[0] : `G${idx+1}`;

    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('class', 'chart-point-group');

    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = `📅 Data: ${rawDate}\n⚖️ Peso: ${w} kg\n(Clicca per modificare o eliminare)`;
    group.appendChild(title);

    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', x);
    circle.setAttribute('cy', y);
    circle.setAttribute('r', '6');
    circle.setAttribute('fill', '#38bdf8');
    circle.setAttribute('stroke', '#0f172a');
    circle.setAttribute('stroke-width', '2');
    group.appendChild(circle);

    const valText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    valText.setAttribute('x', x);
    valText.setAttribute('y', y - 10);
    valText.setAttribute('fill', '#7dd3fc');
    valText.setAttribute('font-size', '10');
    valText.setAttribute('font-weight', '700');
    valText.setAttribute('text-anchor', 'middle');
    valText.textContent = `${w} kg`;
    group.appendChild(valText);

    const dateText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    dateText.setAttribute('x', x);
    dateText.setAttribute('y', height - (isMany ? 15 : 10));
    dateText.setAttribute('class', 'chart-axis-label');
    dateText.setAttribute('font-weight', '600');
    dateText.setAttribute('font-size', isMany ? '8' : '10');
    dateText.setAttribute('text-anchor', isMany ? 'end' : 'middle');
    if (isMany) {
      dateText.setAttribute('transform', `rotate(-45, ${x}, ${height - 15})`);
    }
    dateText.textContent = rawDate.slice(5);
    group.appendChild(dateText);

    group.addEventListener('click', () => openEditWeightModal(h));
    svg.appendChild(group);
  });
}

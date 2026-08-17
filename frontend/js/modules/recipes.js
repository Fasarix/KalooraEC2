import { state } from './state.js';
import { apiFetch } from './api.js';
import { escapeHTML, showToast } from './ui.js';
import { isMealLoggingBlocked, triggerFastingCycleOnMealLogged, loadDashboardData } from './diary.js';

const API_BASE = window.location.origin;

export async function loadRecommendedRecipes() {
  if (!state.user) return;
  try {
    const target = state.user;
    const data = await apiFetch(`${API_BASE}/api/diary/recipes/recommended?date=${state.currentDate}&targetCalories=${target.daily_calories}&targetProtein=${target.target_protein}`);
    state.recipeListCache = data.recommendations || [];

    const gapText = document.getElementById('macro-gap-text');
    const rem = data.remainingMacros || {};
    if (gapText) {
      if (rem.protein > 20) {
        gapText.innerHTML = `Ti mancano ancora <strong>${rem.protein}g di Proteine</strong> oggi. Ecco le ricette consigliate!`;
      } else if (rem.calories < 400) {
        gapText.innerHTML = `Ti restano <strong>${rem.calories} kcal</strong> per oggi. Ecco ricette leggere ed ipocaloriche!`;
      } else {
        gapText.innerHTML = `Stai andando bene! Ti restano <strong>${rem.calories} kcal</strong> e <strong>${rem.protein}g di Proteine</strong>.`;
      }
    }

    applyRecipeFilters();

    const recipeSearchInput = document.getElementById('recipe-search-input');
    if (recipeSearchInput) {
      recipeSearchInput.addEventListener('input', applyRecipeFilters);
    }

    document.querySelectorAll('.filter-pills .pill-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-pills .pill-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        applyRecipeFilters();
      });
    });

    setupRecipeModalActions();
  } catch (err) {
    console.error('Error loading recommended recipes:', err);
  }
}

let isRecipeModalSetup = false;

function setupRecipeModalActions() {
  if (isRecipeModalSetup) return;
  isRecipeModalSetup = true;

  const recipeDetailDialog = document.getElementById('recipe-detail-dialog');
  const btnCloseRecipeModal = document.getElementById('btn-close-recipe-modal');
  const btnAddRecipeToDiary = document.getElementById('btn-add-recipe-to-diary');

  if (btnCloseRecipeModal && recipeDetailDialog) {
    btnCloseRecipeModal.addEventListener('click', () => recipeDetailDialog.close());
  }

  if (btnAddRecipeToDiary && recipeDetailDialog) {
    btnAddRecipeToDiary.addEventListener('click', async () => {
      if (!state.selectedRecipe) return;
      if (isMealLoggingBlocked()) return;

      const targetMealSelect = document.getElementById('recipe-target-meal-select');
      const targetMeal = targetMealSelect ? targetMealSelect.value : 'lunch';
      try {
        await apiFetch(`${API_BASE}/api/diary/meal`, {
          method: 'POST',
          body: JSON.stringify({
            date: state.currentDate,
            mealType: targetMeal,
            foodName: state.selectedRecipe.name,
            quantity: 1
          })
        });

        triggerFastingCycleOnMealLogged();
        recipeDetailDialog.close();
        showToast(`Ricetta "${state.selectedRecipe.name}" aggiunta al diario!`, 'success');
        await loadDashboardData();
      } catch (e) { console.error(e); }
    });
  }
}

export function applyRecipeFilters() {
  const activePill = document.querySelector('.filter-pills .pill-btn.active');
  const filterType = activePill ? activePill.getAttribute('data-filter') : 'ALL';
  const searchInput = document.getElementById('recipe-search-input');
  const query = (searchInput ? searchInput.value : '').toLowerCase().trim();

  let recipes = state.recipeListCache || [];

  if (query.length > 0) {
    recipes = recipes.filter(r => 
      r.name.toLowerCase().includes(query) || 
      (r.ingredients || []).some(i => i.toLowerCase().includes(query))
    );
  }

  if (filterType === 'highProtein') {
    recipes = recipes.filter(r => r.highProtein || r.protein >= 18);
  } else if (filterType === 'lowCal') {
    recipes = recipes.filter(r => r.lowCal || r.calories <= 300);
  } else if (filterType === 'isVegetarian') {
    recipes = recipes.filter(r => r.isVegetarian);
  } else if (filterType === 'quick') {
    recipes = recipes.filter(r => (r.prepTime || 15) <= 15);
  } else if (filterType !== 'ALL') {
    recipes = recipes.filter(r => r.category === filterType);
  }

  renderRecipesGrid(recipes);
}

export function getDishImageUrl(r) {
  const name = (r.name || '').toLowerCase();
  
  let emoji = '🥗';
  let bgGrad1 = '#3b82f6';
  let bgGrad2 = '#1d4ed8';

  if (name.includes('pancake')) {
    emoji = '🥞'; bgGrad1 = '#f59e0b'; bgGrad2 = '#b45309';
  } else if (name.includes('porridge')) {
    emoji = '🥣'; bgGrad1 = '#d97706'; bgGrad2 = '#78350f';
  } else if (name.includes('smoothie') || name.includes('acai')) {
    emoji = '🫐'; bgGrad1 = '#8b5cf6'; bgGrad2 = '#5b21b6';
  } else if (name.includes('omelette') || name.includes('uovo') || name.includes('albumi')) {
    emoji = '🍳'; bgGrad1 = '#eab308'; bgGrad2 = '#854d0e';
  } else if (name.includes('waffle')) {
    emoji = '🧇'; bgGrad1 = '#f97316'; bgGrad2 = '#9a3412';
  } else if (name.includes('french toast') || name.includes('toast') || name.includes('avocado')) {
    emoji = '🍞'; bgGrad1 = '#84cc16'; bgGrad2 = '#3f6212';
  } else if (name.includes('yogurt') || name.includes('granola')) {
    emoji = '🍧'; bgGrad1 = '#ec4899'; bgGrad2 = '#9d174d';
  } else if (name.includes('pollo') || name.includes('curry')) {
    emoji = '🍗'; bgGrad1 = '#ef4444'; bgGrad2 = '#991b1b';
  } else if (name.includes('pasta') || name.includes('salmone')) {
    emoji = '🍝'; bgGrad1 = '#f97316'; bgGrad2 = '#c2410c';
  } else if (name.includes('poke') || name.includes('pesce') || name.includes('orata')) {
    emoji = '🐟'; bgGrad1 = '#06b6d4'; bgGrad2 = '#0e7490';
  } else if (name.includes('manzo') || name.includes('tagliata') || name.includes('burger')) {
    emoji = '🥩'; bgGrad1 = '#dc2626'; bgGrad2 = '#7f1d1d';
  } else if (name.includes('muffin') || name.includes('mousse') || name.includes('cacao')) {
    emoji = '🧁'; bgGrad1 = '#a855f7'; bgGrad2 = '#6b21a8';
  }

  const cleanName = (r.name || 'Ricetta')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="280" viewBox="0 0 500 280"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${bgGrad1}"/><stop offset="100%" stop-color="${bgGrad2}"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><circle cx="250" cy="115" r="55" fill="rgba(255,255,255,0.15)"/><text x="250" y="125" dominant-baseline="central" text-anchor="middle" font-size="64">${emoji}</text><text x="250" y="210" dominant-baseline="central" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,sans-serif" font-size="20" font-weight="bold" fill="#ffffff">${cleanName}</text></svg>`;

  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

export function renderRecipesGrid(recipes) {
  const grid = document.getElementById('recipes-grid-list');
  if (!grid) return;
  grid.innerHTML = '';

  if (recipes.length === 0) {
    grid.innerHTML = '<p class="empty-message">Nessuna ricetta trovata per questi filtri di ricerca.</p>';
    return;
  }

  recipes.forEach(r => {
    const card = document.createElement('div');
    card.className = 'recipe-card';
    const imgUrl = getDishImageUrl(r);

    card.innerHTML = `
      <img src="${imgUrl}" alt="${escapeHTML(r.name)}" class="recipe-img" referrerpolicy="no-referrer" onerror="this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&q=80'">
      <div class="recipe-card-body">
        <span class="recipe-reason-tag">✨ ${escapeHTML(r.recommendationReason || 'Consigliato')}</span>
        <div class="recipe-title">${escapeHTML(r.name)}</div>
        <div class="recipe-meta-row">
          <span>🔥 ${r.calories} kcal</span>
          <span>⏱️ ${r.prepTime || 15} min</span>
          <span>P: ${r.protein}g | C: ${r.carbs}g</span>
        </div>
      </div>
    `;
    card.addEventListener('click', () => openRecipeDetailModal(r));
    grid.appendChild(card);
  });
}

export function openRecipeDetailModal(recipe) {
  state.selectedRecipe = recipe;
  const recipeDetailDialog = document.getElementById('recipe-detail-dialog');
  if (!recipeDetailDialog) return;

  document.getElementById('recipe-modal-title').innerText = recipe.name;
  document.getElementById('recipe-modal-img').src = getDishImageUrl(recipe);
  document.getElementById('recipe-modal-cat').innerText = recipe.category || 'Generale';
  document.getElementById('recipe-modal-time').innerText = `⏱️ ${recipe.prepTime || 15} min`;
  document.getElementById('recipe-modal-diff').innerText = `Difficoltà: ${recipe.difficulty || 'Facile'}`;

  const macrosBox = document.getElementById('recipe-modal-macros-box');
  macrosBox.innerHTML = `
    <div class="recipe-macro-pill">
      <span class="icon">🔥</span>
      <span class="val">${recipe.calories}</span>
      <span class="lbl">kcal</span>
    </div>
    <div class="recipe-macro-pill">
      <span class="icon">🌾</span>
      <span class="val">${recipe.carbs}g</span>
      <span class="lbl">Carbo</span>
    </div>
    <div class="recipe-macro-pill">
      <span class="icon">🥩</span>
      <span class="val">${recipe.protein}g</span>
      <span class="lbl">Proteine</span>
    </div>
    <div class="recipe-macro-pill">
      <span class="icon">🥑</span>
      <span class="val">${recipe.fat}g</span>
      <span class="lbl">Grassi</span>
    </div>
  `;

  const ingList = document.getElementById('recipe-modal-ingredients');
  ingList.innerHTML = '';
  (recipe.ingredients || ['Ingredienti di stagione']).forEach(i => {
    const li = document.createElement('li');
    li.innerText = i;
    ingList.appendChild(li);
  });

  const stepsList = document.getElementById('recipe-modal-steps');
  stepsList.innerHTML = '';
  (recipe.instructions || ['Segui il procedimento base di cottura.']).forEach(step => {
    const li = document.createElement('li');
    li.innerText = step;
    stepsList.appendChild(li);
  });

  recipeDetailDialog.showModal();
}

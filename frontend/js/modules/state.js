export const state = {
  token: localStorage.getItem('token') || null,
  user: null,
  currentDate: new Date().toISOString().split('T')[0],
  activeMealType: null,
  activeItemIndex: -1,
  selectedFood: null,
  diary: null,
  analytics: null,
  activeTab: 'diary',
  statsPeriod: 'weekly',
  fastingTimerInterval: null,
  selectedRecipe: null,
  recipeListCache: []
};

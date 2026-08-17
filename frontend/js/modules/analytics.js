import { state } from './state.js';
import { apiFetch } from './api.js';
import { loadWeightHistory } from './diary.js';

const API_BASE = window.location.origin;

export async function loadPeriodStats() {
  try {
    const period = state.statsPeriod || 'weekly';
    const data = await apiFetch(`${API_BASE}/api/analytics/period?period=${period}&date=${state.currentDate}`);

    const comp = data.comparison || {};
    const calDiff = comp.calorieDiffPct || 0;
    const compCalText = document.getElementById('comp-calorie-text');
    if (compCalText) {
      if (calDiff > 0) {
        compCalText.innerHTML = `Questo ${period === 'monthly' ? 'mese' : 'settimana'} hai assunto il <strong>+${calDiff}%</strong> di calorie rispetto al periodo precedente.`;
      } else {
        compCalText.innerHTML = `Questo ${period === 'monthly' ? 'mese' : 'settimana'} hai assunto il <strong>${calDiff}%</strong> di calorie rispetto al periodo precedente.`;
      }
    }

    const waterText = document.getElementById('comp-water-text');
    if (waterText) waterText.innerText = `Idratazione: ${comp.waterDiffPct >= 0 ? '+' : ''}${comp.waterDiffPct || 0}% vs ${comp.periodName}`;
    
    const sportText = document.getElementById('comp-sport-text');
    if (sportText) sportText.innerText = `Sport: ${comp.exerciseDiffPct >= 0 ? '+' : ''}${comp.exerciseDiffPct || 0}% vs ${comp.periodName}`;

    const hl = data.highlights || {};
    const favFood = document.getElementById('stat-fav-food');
    if (favFood) favFood.innerText = hl.favoriteFood || 'Nessuno';
    
    const favCount = document.getElementById('stat-fav-count');
    if (favCount) favCount.innerText = `${hl.favoriteFoodCount || 0} volte nel periodo`;

    const peakAct = hl.peakActivity || {};
    const peakSport = document.getElementById('stat-peak-sport');
    if (peakSport) peakSport.innerText = peakAct.name !== '-' ? `${peakAct.name} (${peakAct.calories} kcal)` : 'Nessuna';
    
    const peakSportDate = document.getElementById('stat-peak-sport-date');
    if (peakSportDate) peakSportDate.innerText = peakAct.date || '-';

    const peakP = hl.peakProtein || {};
    const peakProtein = document.getElementById('stat-peak-protein');
    if (peakProtein) peakProtein.innerText = `${peakP.protein || 0} g`;

    const peakProteinDate = document.getElementById('stat-peak-protein-date');
    if (peakProteinDate) peakProteinDate.innerText = peakP.date || '-';

    const avgs = data.averages || {};
    const avgWater = document.getElementById('stat-avg-water');
    if (avgWater) avgWater.innerText = `${avgs.water || 0} ml`;

    renderCalorieSvgChart(data.series || []);
    await loadWeightHistory();
  } catch (err) {
    console.error('Error loading period stats:', err);
  }
}

export function renderCalorieSvgChart(series) {
  const svg = document.getElementById('calorie-trend-svg');
  if (!svg) return;
  svg.innerHTML = '';
  if (!series || series.length === 0) return;

  const targetCal = (state.user ? state.user.daily_calories : 2000);
  const maxCal = Math.max(targetCal + 600, ...series.map(s => s.calories || 0), 2500);

  const width = 700;
  const isMonthly = series.length > 14;
  const height = isMonthly ? 280 : 260;
  const paddingTop = 30;
  const paddingBottom = isMonthly ? 55 : 40;
  const paddingLeft = 55;
  const paddingRight = 30;
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

  const yTicks = 5;
  for (let i = 0; i <= yTicks; i++) {
    const val = Math.round((maxCal / yTicks) * i);
    const y = paddingTop + chartHeight - ((val / maxCal) * chartHeight);

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
    yLabel.textContent = `${val}`;
    svg.appendChild(yLabel);
  }

  const targetY = paddingTop + chartHeight - ((targetCal / maxCal) * chartHeight);
  const targetLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  targetLine.setAttribute('x1', paddingLeft);
  targetLine.setAttribute('y1', targetY);
  targetLine.setAttribute('x2', width - paddingRight);
  targetLine.setAttribute('y2', targetY);
  targetLine.setAttribute('stroke', '#818cf8');
  targetLine.setAttribute('stroke-dasharray', '5');
  targetLine.setAttribute('stroke-width', '2');
  svg.appendChild(targetLine);

  const targetText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  targetText.setAttribute('x', width - paddingRight);
  targetText.setAttribute('y', targetY - 6);
  targetText.setAttribute('fill', '#a5b4fc');
  targetText.setAttribute('font-size', '11');
  targetText.setAttribute('font-weight', '600');
  targetText.setAttribute('text-anchor', 'end');
  targetText.textContent = `Target: ${targetCal} kcal`;
  svg.appendChild(targetText);

  const stepX = series.length > 1 ? chartWidth / (series.length - 1) : 0;
  let pathD = '';

  series.forEach((pt, idx) => {
    const x = series.length > 1 ? paddingLeft + (idx * stepX) : paddingLeft + chartWidth / 2;
    const y = paddingTop + chartHeight - (((pt.calories || 0) / maxCal) * chartHeight);

    if (idx === 0) pathD += `M ${x} ${y}`;
    else pathD += ` L ${x} ${y}`;
  });

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', pathD);
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', '#34d399');
  path.setAttribute('stroke-width', '3');
  svg.appendChild(path);

  series.forEach((pt, idx) => {
    const cals = pt.calories || 0;
    const rawDate = pt.date || '';
    const dateStr = rawDate ? rawDate.slice(5) : `G${idx+1}`;
    const fullDate = rawDate || 'Data non disponibile';

    const x = series.length > 1 ? paddingLeft + (idx * stepX) : paddingLeft + chartWidth / 2;
    const y = paddingTop + chartHeight - ((cals / maxCal) * chartHeight);

    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('class', 'chart-point-group');

    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = `📅 Data: ${fullDate}\n🔥 Assunte: ${cals} kcal\n🏃‍♀️ Sport: ${pt.exerciseCalories || 0} kcal\n💧 Acqua: ${pt.water || 0} ml`;
    group.appendChild(title);

    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', x);
    circle.setAttribute('cy', y);
    circle.setAttribute('r', isMonthly ? '4' : '6');
    circle.setAttribute('fill', cals > targetCal ? '#ef4444' : '#10b981');
    circle.setAttribute('stroke', '#0f172a');
    circle.setAttribute('stroke-width', '2');
    group.appendChild(circle);

    if (!isMonthly || cals > 0) {
      const valText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      valText.setAttribute('x', x);
      valText.setAttribute('y', y - 8);
      valText.setAttribute('fill', cals > targetCal ? '#fca5a5' : '#6ee7b7');
      valText.setAttribute('font-size', isMonthly ? '8' : '10');
      valText.setAttribute('font-weight', '700');
      valText.setAttribute('text-anchor', 'middle');
      valText.textContent = isMonthly ? `${cals}` : `${cals} kcal`;
      group.appendChild(valText);
    }

    const dateText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    dateText.setAttribute('x', x);
    dateText.setAttribute('y', height - (isMonthly ? 15 : 10));
    dateText.setAttribute('class', 'chart-axis-label');
    dateText.setAttribute('font-weight', '600');
    dateText.setAttribute('font-size', isMonthly ? '8' : '11');
    dateText.setAttribute('text-anchor', isMonthly ? 'end' : 'middle');
    if (isMonthly) {
      dateText.setAttribute('transform', `rotate(-45, ${x}, ${height - 15})`);
    }
    dateText.textContent = dateStr;
    group.appendChild(dateText);

    svg.appendChild(group);
  });
}

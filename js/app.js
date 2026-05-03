// ── State ──────────────────────────────────────────────────────────────────
let currentFilter = 'all';
let currentMenuFilter = 'all';
let currentMeal = null;
let savedMeals = JSON.parse(localStorage.getItem('cc_picks') || '[]');
let weeklyBudget = parseInt(localStorage.getItem('cc_budget') || '0');
let deferredPrompt = null;

// ── PWA Install ────────────────────────────────────────────────────────────
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const banner = document.getElementById('installBanner');
  if (banner) banner.classList.add('show');
});

document.getElementById('installBtn').addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  if (outcome === 'accepted') showToast('App installed! Find it on your home screen 🎉');
  deferredPrompt = null;
  document.getElementById('installBanner').classList.remove('show');
});

document.getElementById('dismissBanner').addEventListener('click', () => {
  document.getElementById('installBanner').classList.remove('show');
});

// ── Tab Navigation ─────────────────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
    if (tab.dataset.tab === 'menu') renderMenu();
    if (tab.dataset.tab === 'saved') renderSaved();
    if (tab.dataset.tab === 'budget') renderBudget();
  });
});

// ── Spinner Filter Chips ───────────────────────────────────────────────────
document.querySelectorAll('#filterRow .chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('#filterRow .chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    currentFilter = chip.dataset.filter;
  });
});

// ── Spin Logic ─────────────────────────────────────────────────────────────
function getFiltered() {
  if (currentFilter === 'all') return MEALS;
  return MEALS.filter(m => m.tags.includes(currentFilter));
}

function spinMeal() {
  const pool = getFiltered();
  if (!pool.length) { showToast('No meals in this category!'); return; }

  const btn = document.getElementById('spinBtn');
  const icon = document.getElementById('spinIcon');
  const label = document.getElementById('spinLabel');
  const card = document.getElementById('resultCard');
  const tip = document.getElementById('spinTip');

  btn.disabled = true;
  icon.textContent = '🔄';
  icon.classList.add('spinning');
  label.textContent = 'Choosing...';
  card.classList.add('hidden');

  setTimeout(() => {
    let meal;
    // Avoid repeating last meal
    do { meal = pool[Math.floor(Math.random() * pool.length)]; }
    while (pool.length > 1 && currentMeal && meal.id === currentMeal.id);
    currentMeal = meal;

    document.getElementById('mealEmoji').textContent = meal.emoji;
    document.getElementById('mealName').textContent = meal.name;
    document.getElementById('mealDesc').textContent = meal.desc;
    document.getElementById('mealCost').textContent = meal.cost;
    document.getElementById('mealPrep').textContent = meal.where;
    document.getElementById('mealFill').textContent = meal.filling;
    document.getElementById('mealProtein').textContent = meal.protein;

    const badge = document.getElementById('mealBadge');
    const tagLabel = meal.tags.length > 1 ? 'Lunch & Supper' : meal.tags[0].charAt(0).toUpperCase() + meal.tags[0].slice(1);
    badge.textContent = tagLabel;
    badge.className = 'badge ' + (meal.tags.includes('breakfast') ? 'breakfast' : meal.tags.includes('snack') ? 'snack' : meal.tags.length > 1 ? 'both' : meal.tags[0]);

    btn.disabled = false;
    icon.textContent = '🍽️';
    icon.classList.remove('spinning');
    label.textContent = 'Spin Again';
    card.classList.remove('hidden');
    card.classList.add('pop');
    tip.classList.add('hidden');
    setTimeout(() => card.classList.remove('pop'), 400);
  }, 800);
}

document.getElementById('spinBtn').addEventListener('click', spinMeal);
document.getElementById('respinBtn').addEventListener('click', spinMeal);

// ── Save Meal ──────────────────────────────────────────────────────────────
document.getElementById('saveBtn').addEventListener('click', () => {
  if (!currentMeal) return;
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short' });

  savedMeals.unshift({
    ...currentMeal,
    savedAt: timeStr,
    savedDate: dateStr,
    costUsed: Math.round((currentMeal.costMin + currentMeal.costMax) / 2)
  });

  localStorage.setItem('cc_picks', JSON.stringify(savedMeals));
  showToast('Meal saved to your picks! ✅');
});

// ── Share Meal ─────────────────────────────────────────────────────────────
document.getElementById('shareBtn').addEventListener('click', async () => {
  if (!currentMeal) return;
  const text = `🍽️ Utakula? says: ${currentMeal.emoji} ${currentMeal.name}\n💰 ${currentMeal.cost} | 📍 ${currentMeal.where}\n\nGet the app → https://utakula.vercel.app`;
  if (navigator.share) {
    await navigator.share({ title: 'Utakula?', text });
  } else {
    navigator.clipboard.writeText(text);
    showToast('Copied to clipboard! Share with your comrades 📋');
  }
});

// ── Saved Picks ────────────────────────────────────────────────────────────
function renderSaved() {
  const list = document.getElementById('savedList');
  const summary = document.getElementById('budgetSummary');

  if (!savedMeals.length) {
    list.innerHTML = `<div class="empty-state">
      <div class="empty-icon">🍴</div>
      <p>No picks saved yet.</p>
      <p class="empty-sub">Go spin a meal and save it here!</p>
    </div>`;
    summary.innerHTML = '';
    return;
  }

  const total = savedMeals.reduce((s, m) => s + (m.costUsed || 0), 0);
  list.innerHTML = savedMeals.map((m, i) => `
    <div class="saved-item">
      <div class="saved-emoji">${m.emoji}</div>
      <div class="saved-info">
        <div class="saved-name">${m.name}</div>
        <div class="saved-meta">${m.savedDate} · ${m.savedAt} · <span class="saved-cost">${m.cost}</span></div>
      </div>
      <button class="del-btn" onclick="deleteSaved(${i})" title="Remove">✕</button>
    </div>
  `).join('');

  const budgetLeft = weeklyBudget ? weeklyBudget - total : null;
  summary.innerHTML = `
    <div class="summary-card">
      <div class="summary-row">
        <span class="summary-label">Total spent (saved picks)</span>
        <span class="summary-val">Ksh ${total}</span>
      </div>
      ${weeklyBudget ? `
      <div class="summary-row">
        <span class="summary-label">Weekly budget</span>
        <span class="summary-val">Ksh ${weeklyBudget}</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">Budget remaining</span>
        <span class="summary-val ${budgetLeft < 0 ? 'over' : 'under'}">Ksh ${budgetLeft}</span>
      </div>
      <div class="budget-progress-bar">
        <div class="budget-progress-fill" style="width: ${Math.min(100, Math.round((total / weeklyBudget) * 100))}%; background: ${budgetLeft < 0 ? '#E24B4A' : '#1D9E75'}"></div>
      </div>
      <div class="budget-pct">${Math.min(100, Math.round((total / weeklyBudget) * 100))}% of budget used</div>
      ` : '<div class="budget-hint">Set a weekly budget in the Budget tab to track spending.</div>'}
    </div>
  `;
}

function deleteSaved(idx) {
  savedMeals.splice(idx, 1);
  localStorage.setItem('cc_picks', JSON.stringify(savedMeals));
  renderSaved();
  showToast('Removed from picks');
}

document.getElementById('clearAllBtn').addEventListener('click', () => {
  if (!savedMeals.length) return;
  if (confirm('Clear all saved picks?')) {
    savedMeals = [];
    localStorage.setItem('cc_picks', JSON.stringify(savedMeals));
    renderSaved();
    showToast('All picks cleared');
  }
});

// ── Full Menu ──────────────────────────────────────────────────────────────
function renderMenu() {
  const query = document.getElementById('menuSearch').value.toLowerCase();
  const filtered = MEALS.filter(m => {
    const matchFilter = currentMenuFilter === 'all' || m.tags.includes(currentMenuFilter);
    const matchSearch = !query || m.name.toLowerCase().includes(query) || m.desc.toLowerCase().includes(query);
    return matchFilter && matchSearch;
  });

  const grid = document.getElementById('menuGrid');
  if (!filtered.length) {
    grid.innerHTML = '<div class="empty-state"><div class="empty-icon">🔍</div><p>No meals found.</p></div>';
    return;
  }

  grid.innerHTML = filtered.map(m => `
    <div class="menu-card">
      <div class="menu-emoji">${m.emoji}</div>
      <div class="menu-info">
        <div class="menu-name">${m.name}</div>
        <div class="menu-tags">${m.tags.map(t => `<span class="menu-tag ${t}">${t}</span>`).join('')}</div>
        <div class="menu-desc-short">${m.desc.slice(0, 80)}...</div>
        <div class="menu-footer">
          <span class="menu-cost">${m.cost}</span>
          <span class="menu-where">📍 ${m.where}</span>
        </div>
      </div>
    </div>
  `).join('');
}

document.getElementById('menuSearch').addEventListener('input', renderMenu);

document.querySelectorAll('#menuFilterRow .chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('#menuFilterRow .chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    currentMenuFilter = chip.dataset.mfilter;
    renderMenu();
  });
});

// ── Budget Tab ─────────────────────────────────────────────────────────────
function renderBudget() {
  const input = document.getElementById('budgetInput');
  if (weeklyBudget) input.value = weeklyBudget;

  const total = savedMeals.reduce((s, m) => s + (m.costUsed || 0), 0);
  const bars = document.getElementById('budgetBars');

  if (!weeklyBudget) {
    bars.innerHTML = '<div class="budget-hint">Set your budget above to see your spending breakdown.</div>';
    return;
  }

  const pct = Math.min(100, Math.round((total / weeklyBudget) * 100));
  const remaining = weeklyBudget - total;
  bars.innerHTML = `
    <div class="budget-stat-row">
      <div class="bstat"><div class="bstat-label">Budget</div><div class="bstat-val">Ksh ${weeklyBudget}</div></div>
      <div class="bstat"><div class="bstat-label">Spent</div><div class="bstat-val spent">Ksh ${total}</div></div>
      <div class="bstat"><div class="bstat-label">Left</div><div class="bstat-val ${remaining < 0 ? 'over' : 'safe'}">Ksh ${remaining}</div></div>
    </div>
    <div class="budget-bar-wrap">
      <div class="budget-bar-fill" style="width:${pct}%; background: ${remaining < 0 ? '#E24B4A' : pct > 75 ? '#EF9F27' : '#1D9E75'}"></div>
    </div>
    <div class="budget-bar-label">${pct}% of weekly budget used from saved picks</div>
    <div class="budget-advice">${remaining < 0 ? '⚠️ Over budget! Consider cooking githeri or ndengu this week.' : remaining < weeklyBudget * 0.2 ? '🟡 Getting tight — stick to ugali + sukuma this week.' : '✅ Looking good — you\'re managing well, comrade!'}</div>
  `;
}

document.getElementById('setBudgetBtn').addEventListener('click', () => {
  const val = parseInt(document.getElementById('budgetInput').value);
  if (!val || val <= 0) { showToast('Enter a valid amount'); return; }
  weeklyBudget = val;
  localStorage.setItem('cc_budget', val);
  showToast(`Budget set to Ksh ${val} 💰`);
  renderBudget();
});

// ── Toast ──────────────────────────────────────────────────────────────────
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// ── Init ───────────────────────────────────────────────────────────────────
renderSaved();

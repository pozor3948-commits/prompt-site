const $ = (id) => document.getElementById(id);
const idea = $('idea');
let mode = 'create';
let currentPrompt = '';
let currentVariants = [];
let activeVariant = 0;
let currentRecordId = null;
let libraryMode = 'history';
const LIBRARY_KEY = 'promptforge-library-v1';
let toastTimer;
let stopSnakeGame = null;
let stopEtaTimer = null;

function startEtaTimer(estimatedSeconds) {
  if (stopEtaTimer) stopEtaTimer();
  const eta = $('snake-eta');
  const startedAt = Date.now();
  const render = () => {
    const elapsed = Math.floor((Date.now() - startedAt) / 1000);
    const remaining = estimatedSeconds - elapsed;
    if (remaining > 0) {
      eta.textContent = `Ориентировочно ещё ${remaining} сек.`;
      eta.classList.remove('is-waiting');
    } else {
      eta.textContent = 'Генерация занимает больше обычного — ещё немного…';
      eta.classList.add('is-waiting');
    }
  };
  render();
  const interval = setInterval(render, 1000);
  stopEtaTimer = () => { clearInterval(interval); stopEtaTimer = null; };
}

function startSnakeGame() {
  if (stopSnakeGame) stopSnakeGame();
  const canvas = $('snake-canvas');
  const scoreEl = $('snake-score');
  const overlay = $('snake-overlay');
  const restartBtn = $('snake-restart');
  const ctx = canvas.getContext('2d');
  const cell = 16;
  const cols = canvas.width / cell;
  const rows = canvas.height / cell;
  let snake, direction, nextDirection, food, score, timer, active = true;

  const randomFood = () => {
    let point;
    do {
      point = { x: Math.floor(Math.random() * cols), y: Math.floor(Math.random() * rows) };
    } while (snake.some(part => part.x === point.x && part.y === point.y));
    return point;
  };
  const draw = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#0a0e18';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(160,176,210,.16)';
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      ctx.beginPath(); ctx.arc(x * cell + cell / 2, y * cell + cell / 2, 1.15, 0, Math.PI * 2); ctx.fill();
    }
    ctx.shadowBlur = 13; ctx.shadowColor = '#6de4d0'; ctx.fillStyle = '#6de4d0';
    ctx.beginPath();
    const fx = food.x * cell + cell / 2, fy = food.y * cell + cell / 2;
    ctx.moveTo(fx, fy - 7); ctx.lineTo(fx + 6, fy); ctx.lineTo(fx, fy + 7); ctx.lineTo(fx - 6, fy); ctx.closePath(); ctx.fill();
    snake.forEach((part, index) => {
      ctx.shadowColor = index === 0 ? '#b9a4ff' : '#6de4d0';
      ctx.shadowBlur = index === 0 ? 15 : 8;
      ctx.fillStyle = index === 0 ? '#c7b5ff' : `rgba(109,228,208,${Math.max(.48, 1 - index * .025)})`;
      ctx.beginPath(); ctx.arc(part.x * cell + cell / 2, part.y * cell + cell / 2, index === 0 ? 6 : 5, 0, Math.PI * 2); ctx.fill();
    });
    ctx.shadowBlur = 0;
  };
  const reset = () => {
    snake = [{ x: 18, y: 10 }, { x: 17, y: 10 }, { x: 16, y: 10 }, { x: 15, y: 10 }];
    direction = { x: 1, y: 0 }; nextDirection = direction;
    score = 0; scoreEl.textContent = '0'; food = randomFood();
    overlay.hidden = true; active = true; draw();
    clearInterval(timer); timer = setInterval(tick, 125);
  };
  const finish = () => {
    active = false; clearInterval(timer);
    overlay.hidden = false;
    overlay.querySelector('strong').textContent = 'Игра окончена';
    overlay.querySelector('span').textContent = `Твой счёт: ${score}. Попробуешь ещё раз?`;
    restartBtn.textContent = 'Играть ещё';
  };
  const tick = () => {
    if (!active) return;
    direction = nextDirection;
    const head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };
    const eating = head.x === food.x && head.y === food.y;
    if (head.x < 0 || head.x >= cols || head.y < 0 || head.y >= rows || snake.slice(0, eating ? snake.length : -1).some(p => p.x === head.x && p.y === head.y)) return finish();
    snake.unshift(head);
    if (eating) { score += 1; scoreEl.textContent = String(score); food = randomFood(); }
    else snake.pop();
    draw();
  };
  const turn = (x, y) => {
    if (!active || (x === -direction.x && y === -direction.y)) return;
    nextDirection = { x, y };
  };
  const onKey = event => {
    const keys = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0] };
    if (keys[event.key]) { event.preventDefault(); turn(...keys[event.key]); }
  };
  let swipeOrigin = null;
  const onPointerDown = event => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    swipeOrigin = { x: event.clientX, y: event.clientY };
    if (canvas.setPointerCapture) canvas.setPointerCapture(event.pointerId);
  };
  const onPointerMove = event => {
    if (!swipeOrigin || !active) return;
    const dx = event.clientX - swipeOrigin.x;
    const dy = event.clientY - swipeOrigin.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
    if (Math.abs(dx) > Math.abs(dy)) turn(dx > 0 ? 1 : -1, 0);
    else turn(0, dy > 0 ? 1 : -1);
    swipeOrigin = { x: event.clientX, y: event.clientY };
  };
  const onPointerUp = () => { swipeOrigin = null; };
  document.addEventListener('keydown', onKey);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  restartBtn.addEventListener('click', reset);
  stopSnakeGame = () => {
    active = false; clearInterval(timer);
    document.removeEventListener('keydown', onKey);
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('pointercancel', onPointerUp);
    restartBtn.removeEventListener('click', reset);
    stopSnakeGame = null;
  };
  reset();
}

function toast(message) {
  const el = $('toast'); el.textContent = message; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}


const templates = {
  website: {target:'Универсальный (подойдёт большинству ИИ)', detail:'Максимально детально, с контекстом, ограничениями и критериями качества', text:'Создай современный адаптивный сайт. Продумай структуру страниц, UX/UI, цветовую палитру, типографику, компоненты, мобильную версию и интерактивность. Опиши визуальную концепцию и дай конкретный план реализации.'},
  coding: {target:'ИИ для программирования', detail:'Максимально детально, с контекстом, ограничениями и критериями качества', text:'Помоги разработать программное решение. Сначала уточни требования и предложи архитектуру, затем напиши чистый поддерживаемый код, обработку ошибок и инструкции по запуску. Учитывай безопасность и производительность.'},
  image: {target:'Midjourney', detail:'Максимально детально, с контекстом, ограничениями и критериями качества', text:'Создай подробный промпт для генерации изображения. Опиши главный объект, окружение, композицию, ракурс камеры, освещение, цветовую палитру, материалы, настроение, художественный стиль и формат кадра.'},
  video: {target:'Универсальный (подойдёт большинству ИИ)', detail:'Максимально детально, с контекстом, ограничениями и критериями качества', text:'Подготовь промпт для генерации видео. Опиши сцену, персонажей и их действия, движение камеры, окружение, освещение, стиль, длительность, темп и последовательность событий. Сохрани визуальную непрерывность между кадрами.'},
  music: {target:'Suno', detail:'Подробный и точный', text:'Создай музыкальную концепцию и промпт для генерации песни. Укажи жанр, настроение, темп, инструменты, тип вокала, структуру композиции, динамику и особенности звучания.'},
  business: {target:'ChatGPT', detail:'Максимально детально, с контекстом, ограничениями и критериями качества', text:'Разработай практический бизнес-план для моей идеи. Проанализируй целевую аудиторию, ценностное предложение, конкурентов, способы привлечения клиентов, расходы, риски, источники дохода и пошаговый план запуска. Не выдумывай рыночные данные — отмечай допущения.'}
};
document.querySelectorAll('[data-template]').forEach(button => button.addEventListener('click', () => {
  const preset = templates[button.dataset.template];
  if (!preset) return;
  idea.value = preset.text;
  $('target').value = preset.target;
  $('detail').value = preset.detail;
  idea.dispatchEvent(new Event('input'));
  idea.focus();
  document.querySelectorAll('[data-template]').forEach(item => item.classList.toggle('selected', item === button));
  toast('Шаблон добавлен — можешь изменить описание');
}));

function readLibrary() {
  try { const value = JSON.parse(localStorage.getItem(LIBRARY_KEY) || '[]'); return Array.isArray(value) ? value : []; }
  catch { return []; }
}
function writeLibrary(items) {
  try { localStorage.setItem(LIBRARY_KEY, JSON.stringify(items.slice(0, 60))); }
  catch { toast('Не удалось сохранить историю: возможно, заполнено хранилище браузера'); }
}
function renderLibrary() {
  const items = readLibrary();
  const visible = libraryMode === 'favorites' ? items.filter(item => item.favorite) : items;
  const list = $('library-list');
  list.innerHTML = '';
  if (!visible.length) {
    const empty = document.createElement('p');
    empty.className = 'library-empty';
    empty.textContent = libraryMode === 'favorites' ? 'В избранном пока пусто.' : 'История пока пуста. Создай первый промпт!';
    list.appendChild(empty);
    return;
  }
  visible.slice(0, 12).forEach(item => {
    const card = document.createElement('article');
    card.className = 'library-card';
    const info = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = item.title || 'Промпт';
    const meta = document.createElement('small');
    meta.textContent = new Date(item.createdAt).toLocaleString('ru-RU') + ' · ' + (item.variants?.length || 1) + ' вариант(а)';
    info.append(title, meta);
    const actions = document.createElement('div');
    actions.className = 'library-actions';
    const open = document.createElement('button');
    open.type = 'button'; open.textContent = 'Открыть'; open.addEventListener('click', () => loadRecord(item.id));
    const star = document.createElement('button');
    star.type = 'button'; star.textContent = item.favorite ? '★' : '☆'; star.title = 'В избранное';
    star.addEventListener('click', () => toggleFavorite(item.id));
    actions.append(open, star);
    card.append(info, actions);
    list.appendChild(card);
  });
}
function saveCurrentToLibrary() {
  if (!currentVariants.length) return;
  const items = readLibrary();
  const record = {
    id: currentRecordId || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())),
    title: (idea.value.trim() || 'Готовый промпт').slice(0, 90),
    createdAt: new Date().toISOString(),
    variants: currentVariants,
    favorite: items.find(item => item.id === currentRecordId)?.favorite || false,
    language: $('language').value
  };
  currentRecordId = record.id;
  const index = items.findIndex(item => item.id === record.id);
  if (index >= 0) items[index] = record; else items.unshift(record);
  writeLibrary(items);
  renderLibrary();
  updateFavoriteButton();
}
function toggleFavorite(id = currentRecordId) {
  if (!id) return;
  const items = readLibrary();
  const item = items.find(entry => entry.id === id);
  if (!item) return;
  item.favorite = !item.favorite;
  writeLibrary(items);
  renderLibrary();
  updateFavoriteButton();
  toast(item.favorite ? 'Добавлено в избранное' : 'Убрано из избранного');
}
function updateFavoriteButton() {
  const item = readLibrary().find(entry => entry.id === currentRecordId);
  const button = $('favorite-btn');
  if (button) button.textContent = item?.favorite ? '★ В избранном' : '☆ В избранное';
}
function renderVariants() {
  const tabs = $('variant-tabs');
  tabs.innerHTML = '';
  currentVariants.forEach((variant, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'variant-tab' + (index === activeVariant ? ' active' : '');
    button.textContent = variant.label;
    button.setAttribute('role','tab');
    button.setAttribute('aria-selected', String(index === activeVariant));
    button.addEventListener('click', () => { activeVariant = index; showActiveVariant(); });
    tabs.appendChild(button);
  });
  showActiveVariant();
}
function showActiveVariant() {
  const selected = currentVariants[activeVariant];
  if (!selected) return;
  currentPrompt = selected.prompt;
  $('result-content').className = 'result-content has-result';
  $('result-content').textContent = currentPrompt;
  document.querySelectorAll('.variant-tab').forEach((tab,index) => tab.classList.toggle('active',index === activeVariant));
  updateQuality(currentPrompt);
  $('result-meta').textContent = currentPrompt.length.toLocaleString('ru-RU') + ' символов · можно копировать';
  $('result-footer').hidden = false;
  $('result-extras').hidden = false;
  updateFavoriteButton();
}
function updateQuality(prompt) {
  const checks = [
    [prompt.length >= 350, 'Достаточная детализация'],
    [/(роль|ты —|act as|you are)/i.test(prompt), 'Роль исполнителя'],
    [/(задач|сделай|создай|разработ|generate|create|task)/i.test(prompt), 'Понятная задача'],
    [/(формат|структур|таблиц|список|output|format)/i.test(prompt), 'Формат результата'],
    [/(огранич|не использ|избегай|criteria|constraints|must not)/i.test(prompt), 'Ограничения'],
    [/(контекст|аудитор|context|audience|background)/i.test(prompt), 'Контекст']
  ];
  const score = Math.round(checks.filter(item => item[0]).length / checks.length * 100);
  $('quality-score').textContent = score + '/100';
  $('quality-fill').style.width = score + '%';
  $('quality-hint').textContent = score >= 85 ? 'Отличная структура. Можно использовать!' : score >= 60 ? 'Хорошая основа. Можно усилить отдельные детали.' : 'Есть куда улучшить: добавь роль, контекст и формат ответа.';
}
function loadRecord(id) {
  const item = readLibrary().find(entry => entry.id === id);
  if (!item) return;
  currentRecordId = item.id;
  currentVariants = item.variants || [{label:'Промпт',prompt:item.prompt || ''}];
  activeVariant = 0;
  if (item.language) $('language').value = item.language;
  renderVariants();
  $('result-state').classList.add('ready');
  $('result-state').innerHTML = '<i></i> Из истории';
  document.querySelector('.result-panel').scrollIntoView({behavior:'smooth',block:'center'});
}
document.querySelectorAll('[data-library]').forEach(button => button.addEventListener('click', () => {
  libraryMode = button.dataset.library;
  document.querySelectorAll('[data-library]').forEach(item => item.classList.toggle('active',item === button));
  renderLibrary();
}));
$('favorite-btn').addEventListener('click', () => toggleFavorite());
renderLibrary();


idea.addEventListener('input', () => $('char-count').textContent = `${idea.value.length.toLocaleString('ru-RU')} / 12 000`);
$('clear-btn').addEventListener('click', () => { idea.value = ''; idea.dispatchEvent(new Event('input')); idea.focus(); });

document.querySelectorAll('.mode').forEach(button => button.addEventListener('click', () => {
  mode = button.dataset.mode;
  document.querySelectorAll('.mode').forEach(item => {
    const active = item === button;
    item.classList.toggle('active', active);
    item.setAttribute('aria-selected', String(active));
  });
  $('generate-label').textContent = mode === 'create' ? 'Создать сильный промпт' : 'Улучшить мой промпт';
  idea.placeholder = mode === 'create'
    ? 'Например: хочу, чтобы ИИ придумал дизайн главной страницы моего сайта в современном стиле. Нужны идеи по цветам, блокам и анимациям...'
    : 'Вставь сюда свой промпт — даже если он короткий, сырой или написан наспех. Я разберу его и сделаю сильнее...';
}));


async function requestPrompt(payload) {
  const response = await fetch('/api/prompt', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Не удалось получить ответ. Попробуй ещё раз.');
  return data;
}
function displayVariants(variants, recordId = null) {
  currentVariants = variants.filter(item => item && item.prompt).map((item,index) => ({
    label: item.label || ['Краткий','Профессиональный','Подробный'][index] || 'Вариант',
    prompt: item.prompt
  }));
  if (!currentVariants.length) throw new Error('ИИ вернул пустой результат.');
  activeVariant = 0;
  currentRecordId = recordId;
  $('result-state').classList.add('ready');
  $('result-state').innerHTML = '<i></i> Промпт готов';
  $('result-extras').hidden = false;
  renderVariants();
  saveCurrentToLibrary();
}
$('generate-btn').addEventListener('click', async () => {
  const text = idea.value.trim();
  if (!text) { toast(mode === 'create' ? 'Сначала опиши свою задумку' : 'Вставь промпт, который нужно улучшить'); idea.focus(); return; }
  const button = $('generate-btn');
  button.disabled = true;
  $('generate-label').textContent = 'Создаю варианты…';
  $('result-state').classList.remove('ready');
  $('result-state').innerHTML = '<i></i> ИИ работает';
  $('result-content').className = 'result-content';
  $('result-extras').hidden = true;
  $('result-content').innerHTML = `<div class="snake-loading"><div class="snake-loading-head"><div><span class="snake-live-dot"></span><strong>Генерирую три варианта</strong><small>Пока ИИ работает — сыграем?</small></div><div class="snake-status-stack"><div class="snake-score-box">СЧЁТ <b id="snake-score">0</b></div><div class="snake-eta" id="snake-eta" role="status" aria-live="off">Ориентировочно ещё 18 сек.</div></div></div><div class="snake-board"><canvas id="snake-canvas" width="640" height="320" role="img" aria-label="Игра Змейка. Собирай светящиеся точки и не врезайся в стены или себя."></canvas><div class="snake-overlay" id="snake-overlay" hidden><strong>Готов играть?</strong><span>Собирай точки и набирай очки</span><button id="snake-restart" type="button">Начать игру</button></div></div><div class="snake-game-footer"><span>Веди пальцем по полю, чтобы менять направление · на ПК — стрелки или WASD</span><span>Собирай ◆</span></div></div>`;
  startSnakeGame();
  const estimatedSeconds = Math.min(55, 24 + Math.floor(text.length / 300) + ($('detail').selectedIndex === 2 ? 8 : 0));
  startEtaTimer(estimatedSeconds);
  $('result-footer').hidden = true;
  try {
    const data = await requestPrompt({ mode, text, target:$('target').value, detail:$('detail').value, language:$('language').value, wishes:$('tone').value.trim() });
    if (stopSnakeGame) stopSnakeGame();
    if (stopEtaTimer) stopEtaTimer();
    const variants = data.variants?.length ? data.variants : [{label:'Основной',prompt:data.prompt}];
    currentRecordId = null;
    displayVariants(variants);
  } catch (error) {
    if (stopSnakeGame) stopSnakeGame();
    if (stopEtaTimer) stopEtaTimer();
    $('result-content').className = 'result-content';
    $('result-content').innerHTML = '<div class="empty-visual"><div class="core">!</div></div><h3>Не получилось создать промпт</h3><p></p>';
    $('result-content').querySelector('p').textContent = error.message;
    $('result-extras').hidden = true;
    $('result-state').innerHTML = '<i></i> Ошибка';
    toast(error.message);
  } finally {
    button.disabled = false;
    $('generate-label').textContent = mode === 'create' ? 'Создать сильный промпт' : 'Улучшить мой промпт';
  }
});

document.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', async (event) => {
  if (!currentPrompt) return;
  const actions = {
    shorten:'Сократи промпт примерно на треть, сохранив все ключевые требования и смысл.',
    expand:'Расширь промпт: добавь полезный контекст, последовательность действий и критерии результата, не выдумывая факты.',
    detail:'Добавь конкретные детали, ограничения, критерии качества и формат результата.',
    style:'Перепиши промпт в более профессиональном, чётком и естественном стиле, сохранив смысл.',
    translate:'Переведи промпт на ' + ($('language').value === 'ru' ? 'английский' : 'русский') + ' язык и адаптируй формулировки естественно.'
  };
  const button = event.currentTarget;
  button.disabled = true;
  const oldLabel = button.textContent;
  button.textContent = 'Обрабатываю…';
  try {
    const data = await requestPrompt({mode:'action', action:button.dataset.action, text:currentPrompt, target:$('target').value, detail:$('detail').value, language:$('language').value, wishes:actions[button.dataset.action]});
    const variants = data.variants?.length ? data.variants : [{label:'Обновлённый',prompt:data.prompt}];
    displayVariants(variants);
    toast('Промпт обновлён');
  } catch(error) { toast(error.message); }
  finally { button.disabled = false; button.textContent = oldLabel; }
}));

$('copy-btn').addEventListener('click', async () => {
  if (!currentPrompt) return;
  try {
    await navigator.clipboard.writeText(currentPrompt);
    $('copy-btn').innerHTML = '<span>✓</span> Скопировано';
    toast('Промпт скопирован в буфер обмена');
    setTimeout(() => $('copy-btn').innerHTML = '<span>▢</span> Копировать', 1800);
  } catch { toast('Не удалось скопировать. Выдели текст вручную.'); }
});

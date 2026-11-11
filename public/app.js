const $ = (id) => document.getElementById(id);
const idea = $('idea');
let mode = 'create';
let currentPrompt = '';
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

$('generate-btn').addEventListener('click', async () => {
  const text = idea.value.trim();
  if (!text) { toast(mode === 'create' ? 'Сначала опиши свою задумку' : 'Вставь промпт, который нужно улучшить'); idea.focus(); return; }
  const button = $('generate-btn');
  button.disabled = true;
  $('generate-label').textContent = 'Создаю промпт…';
  $('result-state').classList.remove('ready');
  $('result-state').innerHTML = '<i></i> ИИ работает';
  $('result-content').className = 'result-content';
  $('result-content').innerHTML = `<div class="snake-loading"><div class="snake-loading-head"><div><span class="snake-live-dot"></span><strong>Генерирую твой промпт</strong><small>Пока ИИ работает — сыграем?</small></div><div class="snake-status-stack"><div class="snake-score-box">СЧЁТ <b id="snake-score">0</b></div><div class="snake-eta" id="snake-eta" role="status" aria-live="off">Ориентировочно ещё 18 сек.</div></div></div><div class="snake-board"><canvas id="snake-canvas" width="640" height="320" role="img" aria-label="Игра Змейка. Собирай светящиеся точки и не врезайся в стены или себя."></canvas><div class="snake-overlay" id="snake-overlay" hidden><strong>Готов играть?</strong><span>Собирай точки и набирай очки</span><button id="snake-restart" type="button">Начать игру</button></div></div><div class="snake-game-footer"><span>Веди пальцем по полю, чтобы менять направление · на ПК — стрелки или WASD</span><span>Собирай ◆</span></div></div>`;
  startSnakeGame();
  const estimatedSeconds = Math.min(45, 18 + Math.floor(text.length / 350) + ($('detail').selectedIndex === 2 ? 7 : 0));
  startEtaTimer(estimatedSeconds);
  $('result-footer').hidden = true;
  try {
    const response = await fetch('/api/prompt', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, text, target: $('target').value, detail: $('detail').value, wishes: $('tone').value.trim() })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Не удалось получить ответ. Попробуй ещё раз.');
    if (!data.prompt) throw new Error('ИИ вернул пустой результат. Попробуй ещё раз.');
    if (stopSnakeGame) stopSnakeGame();
    if (stopEtaTimer) stopEtaTimer();
    currentPrompt = data.prompt;
    const result = $('result-content');
    result.className = 'result-content has-result';
    result.textContent = currentPrompt;
    $('result-state').classList.add('ready');
    $('result-state').innerHTML = '<i></i> Промпт готов';
    $('result-meta').textContent = `${currentPrompt.length.toLocaleString('ru-RU')} символов · можно копировать`;
    $('result-footer').hidden = false;
  } catch (error) {
    if (stopSnakeGame) stopSnakeGame();
    if (stopEtaTimer) stopEtaTimer();
    $('result-content').className = 'result-content';
    $('result-content').innerHTML = '<div class="empty-visual"><div class="core">!</div></div><h3>Не получилось создать промпт</h3><p></p>';
    $('result-content').querySelector('p').textContent = error.message;
    $('result-state').innerHTML = '<i></i> Ошибка';
    toast(error.message);
  } finally {
    button.disabled = false;
    $('generate-label').textContent = mode === 'create' ? 'Создать сильный промпт' : 'Улучшить мой промпт';
  }
});

$('copy-btn').addEventListener('click', async () => {
  if (!currentPrompt) return;
  try {
    await navigator.clipboard.writeText(currentPrompt);
    $('copy-btn').innerHTML = '<span>✓</span> Скопировано';
    toast('Промпт скопирован в буфер обмена');
    setTimeout(() => $('copy-btn').innerHTML = '<span>▢</span> Копировать', 1800);
  } catch { toast('Не удалось скопировать. Выдели текст вручную.'); }
});

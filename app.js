const $ = (id) => document.getElementById(id);
const idea = $('idea');
let mode = 'create';
let currentPrompt = '';
let toastTimer;

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
  $('result-content').innerHTML = '<div class="empty-visual"><div class="orbit orbit-a"></div><div class="orbit orbit-b"></div><div class="core">✳</div></div><h3>Продумываю структуру…</h3><p>Подбираю роль, контекст, инструкции и формат ответа.</p>';
  $('result-footer').hidden = true;
  try {
    const response = await fetch('/api/prompt', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, text, target: $('target').value, detail: $('detail').value, wishes: $('tone').value.trim() })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Не удалось получить ответ. Попробуй ещё раз.');
    if (!data.prompt) throw new Error('ИИ вернул пустой результат. Попробуй ещё раз.');
    currentPrompt = data.prompt;
    const result = $('result-content');
    result.className = 'result-content has-result';
    result.textContent = currentPrompt;
    $('result-state').classList.add('ready');
    $('result-state').innerHTML = '<i></i> Промпт готов';
    $('result-meta').textContent = `${currentPrompt.length.toLocaleString('ru-RU')} символов · можно копировать`;
    $('result-footer').hidden = false;
  } catch (error) {
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

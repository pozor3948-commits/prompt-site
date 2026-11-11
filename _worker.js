// Cloudflare Pages Advanced Mode Worker. Keep this file at the project root.
const SYSTEM_PROMPT = `Ты — эксперт по prompt engineering и постановке задач для генеративных моделей. Твоя задача — превращать обычные человеческие идеи или сырые промпты в точные, сильные, понятные и практически полезные инструкции для ИИ.

Правила:
1. Сохраняй исходное намерение пользователя. Не подменяй задачу своей.
2. Убирай двусмысленность, воду и противоречия. Не добавляй выдуманные факты.
3. Добавляй уместные элементы: роль модели, контекст, конкретную задачу, пошаговые требования, ограничения, критерии качества и формат результата.
4. Подстраивай формулировки под выбранную модель и её назначение. Для генерации изображений описывай субъект, композицию, ракурс, свет, стиль, детали и формат кадра, если это уместно. Для кода указывай стек, требования, ограничения и ожидаемый результат. Для музыки — жанр, настроение, вокал, темп и структуру, если уместно.
5. Если не хватает критически важной информации, не выдумывай её: сформулируй промпт так, чтобы модель задала пользователю 1–3 точных уточняющих вопроса, либо использовала разумные явно обозначенные допущения.
6. Пиши на русском, если пользователь явно не попросил другой язык. Сами технические термины и названия параметров можно оставить на английском, когда это полезно.
7. Верни только готовый промпт, без вступления, оценок, пояснений и кавычек вокруг всего текста. Сделай его удобным для копирования.`;

async function handlePrompt(request, env) {
  if (!env.OPENROUTER_API_KEY) {
    return json({ error: 'На сервере не задан OPENROUTER_API_KEY. Добавь секрет в настройках Cloudflare Workers.' }, 500);
  }
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Некорректный формат запроса.' }, 400); }
  const { mode, text, target, detail, wishes } = body || {};
  if (typeof text !== 'string' || !text.trim()) return json({ error: 'Напиши задачу или вставь свой промпт.' }, 400);
  if (text.length > 12000) return json({ error: 'Текст слишком длинный. Максимум — 12 000 символов.' }, 400);

  const task = mode === 'improve'
    ? `РЕЖИМ: УЛУЧШИТЬ ГОТОВЫЙ ПРОМПТ. Проанализируй исходный текст, сохрани его смысл и усили его. Исправь структуру, конкретику и инструкции. Если исходный текст уже хорош, не усложняй его без причины.\n\nИСХОДНЫЙ ПРОМПТ:\n${text}`
    : `РЕЖИМ: СОЗДАТЬ ПРОМПТ С НУЛЯ. По описанию пользователя составь полноценный промпт, который можно сразу отправить выбранной ИИ-модели.\n\nЧТО ХОЧЕТ ПОЛЬЗОВАТЕЛЬ:\n${text}`;
  const userContent = `${task}\n\nЦЕЛЕВАЯ МОДЕЛЬ: ${safe(target, 120) || 'Универсальный ИИ'}\nУРОВЕНЬ ДЕТАЛИЗАЦИИ: ${safe(detail, 180) || 'Подробный и точный'}\nДОПОЛНИТЕЛЬНЫЕ ПОЖЕЛАНИЯ: ${safe(wishes, 500) || 'Нет'}`;

  try {
    const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://promptforge.pages.dev', 'X-Title': 'PromptForge' },
      body: JSON.stringify({
        model: env.OPENROUTER_MODEL || 'openrouter/free',
        temperature: 0.7,
        max_tokens: 4096,
        messages: [ { role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: userContent } ]
      })
    });
    const result = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      const message = upstream.status === 401 ? 'OpenRouter не принял API-ключ. Проверь секрет OPENROUTER_API_KEY в Cloudflare.'
        : upstream.status === 402 ? 'OpenRouter отклонил запрос из-за ограничений аккаунта или отсутствия средств. Проверь баланс и доступность бесплатной модели.'
        : upstream.status === 429 ? 'Достигнут лимит бесплатных запросов OpenRouter или лимит модели. Попробуй позже либо выбери другую бесплатную модель.'
        : upstream.status === 404 ? 'Модель не найдена или сейчас недоступна. Проверь OPENROUTER_MODEL.'
        : 'OpenRouter или выбранный провайдер вернул ошибку. Попробуй позже или проверь настройки модели.';
      return json({ error: message }, upstream.status === 429 ? 429 : 502);
    }
    const message = result.choices?.[0]?.message;
    const rawContent = message?.content;
    const prompt = (typeof rawContent === 'string' ? rawContent : Array.isArray(rawContent) ? rawContent.map(part => typeof part === 'string' ? part : part?.text || '').join('') : '').trim();
    if (!prompt) return json({ error: 'ИИ не вернул текст. Попробуй ещё раз.' }, 502);
    return json({ prompt });
  } catch {
    return json({ error: 'Не удалось связаться с ИИ-сервисом. Проверь соединение и попробуй снова.' }, 502);
  }
}

function safe(value, max) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }
function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}


export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/prompt") {
      if (request.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405, headers: { "Allow": "POST" } });
      }
      return handlePrompt(request, env);
    }
    return env.ASSETS.fetch(request);
  }
};

// Cloudflare Pages Advanced Mode Worker. Keep this file at the project root.
const SYSTEM_PROMPT = `Ты — эксперт по prompt engineering и постановке задач для генеративных моделей. Твоя задача — превращать обычные человеческие идеи или сырые промпты в точные, сильные, понятные и практически полезные инструкции для ИИ.

Правила:
1. Сохраняй исходное намерение пользователя. Не подменяй задачу своей.
2. Убирай двусмысленность, воду и противоречия. Не добавляй выдуманные факты.
3. Добавляй уместные элементы: роль модели, контекст, конкретную задачу, пошаговые требования, ограничения, критерии качества и формат результата.
4. Подстраивай формулировки под выбранную модель и её назначение. Для генерации изображений описывай субъект, композицию, ракурс, свет, стиль, детали и формат кадра, если это уместно. Для кода указывай стек, требования, ограничения и ожидаемый результат. Для музыки — жанр, настроение, вокал, темп и структуру, если уместно.
5. Если не хватает критически важной информации, не выдумывай её: сформулируй промпт так, чтобы модель задала пользователю 1–3 точных уточняющих вопроса, либо использовала разумные явно обозначенные допущения.
6. Строго соблюдай выбранный пользователем язык готового промпта. Не смешивай языки без необходимости. Технические термины и названия параметров можно оставлять на английском, когда это полезно.
7. Соблюдай формат вывода, явно заданный в инструкции пользователя. Если запрошен JSON — верни только валидный JSON без Markdown, вступления и пояснений. Для одиночного промпта верни только готовый текст, удобный для копирования.`;

async function handlePrompt(request, env) {
  if (!env.OPENROUTER_API_KEY) {
    return json({ error: 'На сервере не задан OPENROUTER_API_KEY. Добавь секрет в настройках Cloudflare Workers.' }, 500);
  }
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Некорректный формат запроса.' }, 400); }
  const { mode, text, target, detail, language, wishes, action } = body || {};
  const outputLanguage = language === 'en' ? 'English' : 'Russian';
  if (typeof text !== 'string' || !text.trim()) return json({ error: 'Напиши задачу или вставь свой промпт.' }, 400);
  if (text.length > 12000) return json({ error: 'Текст слишком длинный. Максимум — 12 000 символов.' }, 400);

  const actionInstructions = {
    shorten: 'Сократи этот готовый промпт примерно на треть, сохранив смысл и все критически важные требования.',
    expand: 'Расширь этот готовый промпт полезным контекстом, ясными шагами и критериями результата. Не выдумывай факты.',
    detail: 'Добавь конкретику, ограничения, критерии качества и чёткий формат результата.',
    style: 'Перепиши текст профессионально, ясно и естественно, сохранив исходное намерение.',
    translate: language === 'ru' ? 'Переведи этот промпт на русский язык.' : 'Translate this prompt into natural English.'
  };
  const task = mode === 'action'
    ? `РЕЖИМ: РЕДАКТИРОВАНИЕ ГОТОВОГО ПРОМПТА. ${actionInstructions[action] || 'Улучши этот промпт, сохранив смысл.'}\n\nИСХОДНЫЙ ПРОМПТ:\n${text}`
    : mode === 'improve'
      ? `РЕЖИМ: УЛУЧШИТЬ ГОТОВЫЙ ПРОМПТ. Проанализируй исходный текст, сохрани его смысл и усили его. Исправь структуру, конкретику и инструкции. Если исходный текст уже хорош, не усложняй его без причины.\n\nИСХОДНЫЙ ПРОМПТ:\n${text}`
      : `РЕЖИМ: СОЗДАТЬ ПРОМПТ С НУЛЯ. По описанию пользователя составь полноценный промпт, который можно сразу отправить выбранной ИИ-модели.\n\nЧТО ХОЧЕТ ПОЛЬЗОВАТЕЛЬ:\n${text}`;
  const variantInstruction = mode === 'action'
    ? 'Верни один окончательный отредактированный промпт. Не добавляй пояснений.'
    : 'Подготовь ТРИ самостоятельных варианта одного промпта: краткий, профессиональный и максимально подробный. Каждый должен быть готов к копированию и отличаться уровнем детализации, а не только названием. Верни ТОЛЬКО валидный JSON без Markdown и без code fence строго в формате: {"variants":[{"label":"Краткий","prompt":"..."},{"label":"Профессиональный","prompt":"..."},{"label":"Подробный","prompt":"..."}]}.';
  const userContent = `${task}\n\nOUTPUT LANGUAGE: ${outputLanguage}. Write the entire final prompt(s) in this language, regardless of the language of the user's description.\n${variantInstruction}\nЦЕЛЕВАЯ МОДЕЛЬ: ${safe(target, 120) || 'Универсальный ИИ'}\nУРОВЕНЬ ДЕТАЛИЗАЦИИ: ${safe(detail, 180) || 'Подробный и точный'}\nДОПОЛНИТЕЛЬНЫЕ ПОЖЕЛАНИЯ: ${safe(wishes, 500) || 'Нет'}`;

  try {
    const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://promptforge.pages.dev', 'X-Title': 'PromptForge' },
      body: JSON.stringify({
        model: env.OPENROUTER_MODEL || 'openrouter/free',
        temperature: 0.7,
        max_tokens: 8192,
        reasoning: { effort: 'low' },
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
    const content = (typeof rawContent === 'string' ? rawContent : Array.isArray(rawContent) ? rawContent.map(part => typeof part === 'string' ? part : part?.text || '').join('') : '').trim();
    if (!content) {
      const finishReason = result.choices?.[0]?.finish_reason;
      const modelUsed = result.model || 'неизвестная модель';
      const detail = finishReason === 'length'
        ? 'Модель не успела выдать ответ из-за лимита токенов. Попробуй более краткий запрос.'
        : `Модель ${modelUsed} вернула пустой ответ${finishReason ? ` (причина: ${finishReason})` : ''}. Попробуй ещё раз.`;
      return json({ error: detail }, 502);
    }
    if (mode === 'action') return json({ prompt: content.replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/, '').trim() });
    let parsed = null;
    try {
      const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      const match = content.match(/\{[\s\S]*"variants"[\s\S]*\}/);
      if (match) { try { parsed = JSON.parse(match[0]); } catch {} }
    }
    const variants = Array.isArray(parsed?.variants)
      ? parsed.variants.filter(item => typeof item?.prompt === 'string' && item.prompt.trim()).slice(0, 3).map((item, index) => ({
          label: safe(item.label, 30) || ['Краткий','Профессиональный','Подробный'][index],
          prompt: item.prompt.trim()
        }))
      : [];
    if (variants.length) return json({ prompt: variants[0].prompt, variants });
    return json({ prompt: content });
  } catch {
    return json({ error: 'Не удалось связаться с ИИ-сервисом. Проверь соединение и попробуй снова.' }, 502);
  }
}

function safe(value, max) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }
function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}



async function handleTelegram(request, env) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_WEBHOOK_SECRET) {
    return new Response("Telegram bot is not configured", { status: 503 });
  }
  const suppliedSecret = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
  if (suppliedSecret !== env.TELEGRAM_WEBHOOK_SECRET) {
    return new Response("Forbidden", { status: 403 });
  }
  let update;
  try { update = await request.json(); } catch { return new Response("Bad Request", { status: 400 }); }

  const message = update.message;
  const chatId = message?.chat?.id;
  const incoming = typeof message?.text === "string" ? message.text.trim() : "";
  if (!chatId || !incoming) return new Response("OK");

  if (incoming === "/start" || incoming === "/help") {
    await telegramSend(env, chatId,
      "Привет! Я PromptForge — бот для создания промптов.\n\nПросто напиши, что хочешь сделать, и я подготовлю три варианта: краткий, профессиональный и подробный.\n\nПримеры:\n• Сделай промпт для создания сайта кофейни\n• Напиши промпт для реалистичного изображения автомобиля\n• Создай промпт для музыки в Suno");
    return new Response("OK");
  }

  const promptRequest = new Request("https://promptforge.internal/api/prompt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "create",
      text: incoming.replace(/^\\/prompt\\s*/i, ""),
      target: "Универсальный (подойдёт большинству ИИ)",
      detail: "Подробный и точный",
      language: "ru",
      wishes: "Ответ предназначен для Telegram-бота. Формулируй промпт понятно и готовым к копированию."
    })
  });
  const response = await handlePrompt(promptRequest, env);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.variants?.length) {
    await telegramSend(env, chatId, data.error || "Не получилось создать промпт. Попробуй ещё раз.");
    return new Response("OK");
  }

  const labels = ["КРАТКИЙ", "ПРОФЕССИОНАЛЬНЫЙ", "ПОДРОБНЫЙ"];
  for (let i = 0; i < data.variants.length; i++) {
    const item = data.variants[i];
    const label = labels[i] || item.label || "ВАРИАНТ";
    await telegramSendLong(env, chatId, `✦ ${label} ВАРИАНТ\n\n${item.prompt}`);
  }
  return new Response("OK");
}

async function telegramSend(env, chatId, text) {
  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text })
  });
  if (!response.ok) throw new Error("Telegram sendMessage failed");
}

async function telegramSendLong(env, chatId, text) {
  const limit = 3900;
  if (text.length <= limit) return telegramSend(env, chatId, text);
  let rest = text;
  while (rest.length) {
    let cut = Math.min(limit, rest.length);
    if (cut < rest.length) {
      const boundary = rest.lastIndexOf("\\n", cut);
      if (boundary > limit * 0.6) cut = boundary;
    }
    await telegramSend(env, chatId, rest.slice(0, cut));
    rest = rest.slice(cut).replace(/^\\n+/, "");
  }
}
\nexport default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/telegram/webhook") {\n      if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });\n      return handleTelegram(request, env);\n    }\n    if (url.pathname === "/api/prompt") {
      if (request.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405, headers: { "Allow": "POST" } });
      }
      return handlePrompt(request, env);
    }
    return env.ASSETS.fetch(request);
  }
};

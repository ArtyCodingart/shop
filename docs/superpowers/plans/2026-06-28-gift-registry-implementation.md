# Gift Registry Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a polished static GitHub Pages gift registry where friends log in by name, browse baby gifts, and reserve one gift through Firebase Firestore.

**Architecture:** The app is plain static HTML/CSS/JavaScript with no build step, so GitHub Pages can serve it directly from the repository root. `gifts.json` is the editable public gift catalog, while Firestore stores shared reservation documents keyed by gift id. The UI works in read-only demo mode until the Firebase config is filled in.

**Tech Stack:** HTML, CSS, vanilla JavaScript ES modules, Firebase Web SDK from CDN, GitHub Pages, Node.js for lightweight JSON validation.

---

## File Structure

- Create `index.html`: app shell, login screen, catalog screen, modal containers, script/style links.
- Create `styles.css`: full responsive visual design, login view, gift cards, reserved states, modal, toast/error states.
- Create `app.js`: app state, gift loading, localStorage profile, rendering, modal behavior, Firestore reads/writes, error handling.
- Create `firebase-config.js`: empty public Firebase config object and helper flag for configured/not configured state.
- Create `gifts.json`: editable starter catalog with 10 baby gift examples, Kaspi search links, and external image URLs that can be replaced.
- Create `tests/validate-gifts.mjs`: no-dependency Node validation for catalog shape, duplicate ids, required fields, and valid URLs.
- Modify `README.md`: project purpose, local preview instructions, GitHub Pages setup, Firebase setup, Firestore rules, editing gift catalog.

### Task 1: Static App Shell

**Files:**
- Create: `index.html`
- Create: `styles.css`

- [ ] **Step 1: Create `index.html` with app landmarks and templates**

Use this complete file:

```html
<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Список подарков для малыша</title>
    <meta
      name="description"
      content="Тёплый список подарков для друзей: выберите один подарок для малыша."
    >
    <link rel="stylesheet" href="./styles.css">
  </head>
  <body>
    <main class="app-shell">
      <section class="login-view" id="loginView" aria-labelledby="loginTitle">
        <div class="login-panel">
          <p class="eyebrow">Скоро встречаем малыша</p>
          <h1 id="loginTitle">Выберите подарок, который хотите подарить</h1>
          <p class="login-copy">
            Введите имя и фамилию, чтобы открыть список. После выбора подарок станет занят для остальных гостей.
          </p>

          <form class="login-form" id="loginForm">
            <label>
              <span>Имя</span>
              <input id="firstName" name="firstName" type="text" autocomplete="given-name" required minlength="2">
            </label>
            <label>
              <span>Фамилия</span>
              <input id="lastName" name="lastName" type="text" autocomplete="family-name" required minlength="2">
            </label>
            <button type="submit">Войти к списку</button>
          </form>
        </div>
      </section>

      <section class="catalog-view hidden" id="catalogView" aria-labelledby="catalogTitle">
        <header class="catalog-header">
          <div>
            <p class="eyebrow">Подарки для малыша</p>
            <h1 id="catalogTitle">Список желанных подарков</h1>
            <p id="catalogSubtitle">Выберите один свободный подарок из списка.</p>
          </div>
          <div class="profile-card">
            <span id="profileName"></span>
            <button class="ghost-button" id="changeProfileButton" type="button">Сменить имя</button>
          </div>
        </header>

        <div class="status-banner hidden" id="statusBanner" role="status"></div>
        <div class="gift-grid" id="giftGrid" aria-live="polite"></div>
      </section>
    </main>

    <div class="modal-backdrop hidden" id="giftModal" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
      <article class="gift-modal">
        <button class="modal-close" id="modalCloseButton" type="button" aria-label="Закрыть">×</button>
        <img id="modalImage" alt="">
        <div class="modal-content">
          <p class="eyebrow" id="modalCategory"></p>
          <h2 id="modalTitle"></h2>
          <p class="modal-price" id="modalPrice"></p>
          <p id="modalDescription"></p>
          <p id="modalDetails"></p>
          <a class="market-link" id="modalMarketLink" target="_blank" rel="noreferrer">Открыть на маркетплейсе</a>
          <button class="primary-action" id="reserveButton" type="button">Я хочу подарить этот подарок</button>
          <p class="modal-note" id="modalNote"></p>
        </div>
      </article>
    </div>

    <div class="toast hidden" id="toast" role="status"></div>

    <script type="module" src="./app.js"></script>
  </body>
</html>
```

- [ ] **Step 2: Create `styles.css` with responsive polished layout**

Use this complete file as the first version:

```css
:root {
  color-scheme: light;
  --ink: #21302b;
  --muted: #66716d;
  --paper: #fffdf8;
  --panel: #ffffff;
  --sage: #dce9df;
  --mint: #b8dcc6;
  --rose: #f4c8bd;
  --coral: #dd745f;
  --gold: #f4c95d;
  --line: rgba(33, 48, 43, 0.13);
  --shadow: 0 22px 60px rgba(72, 91, 83, 0.18);
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: var(--ink);
  background:
    radial-gradient(circle at 18% 12%, rgba(244, 200, 189, 0.6), transparent 28rem),
    linear-gradient(135deg, #fff9ed 0%, #eef6f0 45%, #f8efe9 100%);
}

button,
input {
  font: inherit;
}

button {
  cursor: pointer;
}

img {
  display: block;
  max-width: 100%;
}

.hidden {
  display: none !important;
}

.app-shell {
  min-height: 100vh;
}

.login-view {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
}

.login-panel {
  width: min(100%, 520px);
  padding: 38px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: rgba(255, 253, 248, 0.9);
  box-shadow: var(--shadow);
}

.eyebrow {
  margin: 0 0 10px;
  color: #a65f51;
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0;
  text-transform: uppercase;
}

h1,
h2,
p {
  overflow-wrap: anywhere;
}

h1 {
  margin: 0;
  font-size: clamp(2rem, 7vw, 4.5rem);
  line-height: 0.95;
}

.login-copy,
#catalogSubtitle {
  color: var(--muted);
  line-height: 1.65;
}

.login-form {
  display: grid;
  gap: 16px;
  margin-top: 28px;
}

label {
  display: grid;
  gap: 8px;
  color: var(--muted);
  font-weight: 700;
}

input {
  width: 100%;
  min-height: 48px;
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 0 14px;
  color: var(--ink);
  background: white;
}

.login-form button,
.primary-action {
  min-height: 54px;
  border: 0;
  border-radius: 8px;
  padding: 0 18px;
  color: white;
  background: #1f6f5a;
  font-weight: 800;
  box-shadow: 0 12px 26px rgba(31, 111, 90, 0.22);
}

.catalog-view {
  width: min(1180px, calc(100% - 32px));
  margin: 0 auto;
  padding: 32px 0 56px;
}

.catalog-header {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  align-items: flex-start;
  margin-bottom: 26px;
}

.catalog-header h1 {
  max-width: 760px;
}

.profile-card,
.status-banner {
  border: 1px solid var(--line);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.82);
}

.profile-card {
  min-width: 220px;
  padding: 14px;
  display: grid;
  gap: 10px;
}

.profile-card span {
  font-weight: 800;
}

.ghost-button {
  min-height: 38px;
  border: 1px solid var(--line);
  border-radius: 8px;
  color: var(--ink);
  background: white;
}

.status-banner {
  margin-bottom: 18px;
  padding: 14px 16px;
  color: var(--muted);
}

.gift-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
}

.gift-card {
  min-height: 100%;
  display: grid;
  grid-template-rows: 210px 1fr;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel);
  box-shadow: 0 14px 36px rgba(72, 91, 83, 0.12);
}

.gift-card.reserved {
  filter: grayscale(0.95);
  opacity: 0.58;
}

.gift-card img {
  width: 100%;
  height: 210px;
  object-fit: cover;
  background: var(--sage);
}

.gift-body {
  display: grid;
  gap: 10px;
  padding: 16px;
}

.gift-topline {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  color: var(--muted);
  font-size: 0.9rem;
  font-weight: 700;
}

.gift-body h2 {
  margin: 0;
  font-size: 1.25rem;
}

.gift-body p {
  margin: 0;
  color: var(--muted);
  line-height: 1.5;
}

.gift-action {
  min-height: 44px;
  align-self: end;
  border: 0;
  border-radius: 8px;
  color: var(--ink);
  background: var(--gold);
  font-weight: 800;
}

.gift-action:disabled {
  cursor: not-allowed;
  color: #6f7774;
  background: #e2e5e1;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 20;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(23, 31, 29, 0.58);
}

.gift-modal {
  position: relative;
  width: min(940px, 100%);
  max-height: min(860px, calc(100vh - 40px));
  overflow: auto;
  display: grid;
  grid-template-columns: minmax(0, 0.92fr) minmax(0, 1fr);
  border-radius: 8px;
  background: var(--paper);
  box-shadow: var(--shadow);
}

.gift-modal > img {
  width: 100%;
  height: 100%;
  min-height: 430px;
  object-fit: cover;
}

.modal-content {
  display: grid;
  align-content: center;
  gap: 14px;
  padding: 34px;
}

.modal-content h2,
.modal-content p {
  margin: 0;
}

.modal-price {
  font-size: 1.2rem;
  font-weight: 900;
}

.market-link {
  color: #1f6f5a;
  font-weight: 800;
}

.modal-close {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 42px;
  height: 42px;
  border: 0;
  border-radius: 50%;
  color: var(--ink);
  background: rgba(255, 255, 255, 0.92);
  font-size: 1.7rem;
  line-height: 1;
}

.modal-note {
  color: var(--muted);
  font-size: 0.95rem;
}

.toast {
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: 30;
  max-width: min(420px, calc(100% - 40px));
  padding: 14px 16px;
  border-radius: 8px;
  color: white;
  background: #21302b;
  box-shadow: var(--shadow);
}

@media (max-width: 880px) {
  .catalog-header,
  .gift-modal {
    grid-template-columns: 1fr;
  }

  .catalog-header {
    display: grid;
  }

  .gift-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .gift-modal > img {
    min-height: 260px;
    max-height: 330px;
  }
}

@media (max-width: 580px) {
  .login-panel {
    padding: 26px;
  }

  .catalog-view {
    width: min(100% - 24px, 1180px);
    padding-top: 22px;
  }

  .gift-grid {
    grid-template-columns: 1fr;
  }

  .modal-backdrop {
    padding: 10px;
  }

  .modal-content {
    padding: 24px;
  }
}
```

- [ ] **Step 3: Preview the static shell**

Run:

```bash
python3 -m http.server 4173
```

Expected: local server starts and `http://localhost:4173` shows the login screen. Stop the server with `Ctrl+C` after previewing.

- [ ] **Step 4: Commit the app shell**

```bash
git add index.html styles.css
git commit -m "feat: add gift registry app shell"
```

### Task 2: Gift Catalog Data And Validation

**Files:**
- Create: `gifts.json`
- Create: `tests/validate-gifts.mjs`
- Modify: `README.md`

- [ ] **Step 1: Create starter `gifts.json`**

Use this complete file:

```json
[
  {
    "id": "baby-monitor",
    "title": "Видеоняня",
    "category": "Техника",
    "price": "от 35 000 ₸",
    "description": "Поможет спокойно наблюдать за малышом во время сна.",
    "details": "Подойдёт модель с ночным режимом, датчиком температуры и стабильной связью. Конкретную ссылку можно заменить на выбранный магазин.",
    "marketUrl": "https://kaspi.kz/shop/search/?text=%D0%B2%D0%B8%D0%B4%D0%B5%D0%BE%D0%BD%D1%8F%D0%BD%D1%8F",
    "imageUrl": "https://images.unsplash.com/photo-1586105251261-72a756497a12?auto=format&fit=crop&w=1200&q=80"
  },
  {
    "id": "newborn-diapers",
    "title": "Запас подгузников Newborn",
    "category": "Уход",
    "price": "от 18 000 ₸",
    "description": "Практичный подарок, который точно пригодится в первые недели.",
    "details": "Лучше выбирать размер Newborn или 1, мягкую серию для чувствительной кожи, несколько небольших упаковок вместо одной огромной.",
    "marketUrl": "https://kaspi.kz/shop/search/?text=newborn%20%D0%BF%D0%BE%D0%B4%D0%B3%D1%83%D0%B7%D0%BD%D0%B8%D0%BA%D0%B8",
    "imageUrl": "https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?auto=format&fit=crop&w=1200&q=80"
  },
  {
    "id": "bath-set",
    "title": "Набор для купания",
    "category": "Купание",
    "price": "от 22 000 ₸",
    "description": "Ванночка, мягкое полотенце и базовые аксессуары для первых купаний.",
    "details": "Можно выбрать ванночку с анатомической вставкой, термометр для воды, мягкое полотенце-уголок и ковшик.",
    "marketUrl": "https://kaspi.kz/shop/search/?text=%D0%BD%D0%B0%D0%B1%D0%BE%D1%80%20%D0%B4%D0%BB%D1%8F%20%D0%BA%D1%83%D0%BF%D0%B0%D0%BD%D0%B8%D1%8F%20%D0%BD%D0%BE%D0%B2%D0%BE%D1%80%D0%BE%D0%B6%D0%B4%D0%B5%D0%BD%D0%BD%D0%BE%D0%B3%D0%BE",
    "imageUrl": "https://images.unsplash.com/photo-1603245729422-01da973cf88d?auto=format&fit=crop&w=1200&q=80"
  },
  {
    "id": "swaddle-blankets",
    "title": "Муслиновые пелёнки",
    "category": "Текстиль",
    "price": "от 12 000 ₸",
    "description": "Лёгкие пелёнки для сна, прогулок, кормления и ежедневного ухода.",
    "details": "Оптимально набор из 3-5 пелёнок из хлопкового муслина спокойных оттенков, размером около 100×100 см.",
    "marketUrl": "https://kaspi.kz/shop/search/?text=%D0%BC%D1%83%D1%81%D0%BB%D0%B8%D0%BD%D0%BE%D0%B2%D1%8B%D0%B5%20%D0%BF%D0%B5%D0%BB%D0%B5%D0%BD%D0%BA%D0%B8",
    "imageUrl": "https://images.unsplash.com/photo-1600369672770-985fd30004eb?auto=format&fit=crop&w=1200&q=80"
  },
  {
    "id": "sleep-nest",
    "title": "Кокон для сна",
    "category": "Сон",
    "price": "от 28 000 ₸",
    "description": "Уютное место для дневного отдыха малыша под присмотром взрослых.",
    "details": "Выбирайте модель со съёмным чехлом, мягкими бортиками и понятными рекомендациями по безопасному использованию.",
    "marketUrl": "https://kaspi.kz/shop/search/?text=%D0%BA%D0%BE%D0%BA%D0%BE%D0%BD%20%D0%B4%D0%BB%D1%8F%20%D0%BD%D0%BE%D0%B2%D0%BE%D1%80%D0%BE%D0%B6%D0%B4%D0%B5%D0%BD%D0%BD%D0%BE%D0%B3%D0%BE",
    "imageUrl": "https://images.unsplash.com/photo-1590649880765-91b1956b8276?auto=format&fit=crop&w=1200&q=80"
  },
  {
    "id": "bottle-sterilizer",
    "title": "Стерилизатор для бутылочек",
    "category": "Кормление",
    "price": "от 24 000 ₸",
    "description": "Упростит уход за бутылочками, сосками и маленькими аксессуарами.",
    "details": "Подойдёт электрический паровой стерилизатор или компактная модель для СВЧ. Важно, чтобы помещалось несколько бутылочек.",
    "marketUrl": "https://kaspi.kz/shop/search/?text=%D1%81%D1%82%D0%B5%D1%80%D0%B8%D0%BB%D0%B8%D0%B7%D0%B0%D1%82%D0%BE%D1%80%20%D0%B1%D1%83%D1%82%D1%8B%D0%BB%D0%BE%D1%87%D0%B5%D0%BA",
    "imageUrl": "https://images.unsplash.com/photo-1578662996442-48f60103fc96?auto=format&fit=crop&w=1200&q=80"
  },
  {
    "id": "play-mat",
    "title": "Развивающий коврик",
    "category": "Игры",
    "price": "от 20 000 ₸",
    "description": "Мягкое место для первых игр, наблюдения за игрушками и времени на животике.",
    "details": "Лучше брать коврик с дугами, съёмными игрушками, разными фактурами и нескользящим основанием.",
    "marketUrl": "https://kaspi.kz/shop/search/?text=%D1%80%D0%B0%D0%B7%D0%B2%D0%B8%D0%B2%D0%B0%D1%8E%D1%89%D0%B8%D0%B9%20%D0%BA%D0%BE%D0%B2%D1%80%D0%B8%D0%BA",
    "imageUrl": "https://images.unsplash.com/photo-1555252333-9f8e92e65df9?auto=format&fit=crop&w=1200&q=80"
  },
  {
    "id": "baby-carrier",
    "title": "Эргорюкзак",
    "category": "Прогулки",
    "price": "от 32 000 ₸",
    "description": "Поможет носить малыша рядом и освободить руки на коротких прогулках.",
    "details": "Важно выбрать модель с поддержкой головы, правильной М-позицией ножек и регулировкой под новорождённого.",
    "marketUrl": "https://kaspi.kz/shop/search/?text=%D1%8D%D1%80%D0%B3%D0%BE%D1%80%D1%8E%D0%BA%D0%B7%D0%B0%D0%BA%20%D0%BD%D0%BE%D0%B2%D0%BE%D1%80%D0%BE%D0%B6%D0%B4%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9",
    "imageUrl": "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=1200&q=80"
  },
  {
    "id": "white-noise",
    "title": "Машинка белого шума",
    "category": "Сон",
    "price": "от 10 000 ₸",
    "description": "Мягкие звуки помогают создать спокойный фон для сна.",
    "details": "Удобны модели с таймером, регулировкой громкости, ночником и автономной работой от аккумулятора.",
    "marketUrl": "https://kaspi.kz/shop/search/?text=%D0%B1%D0%B5%D0%BB%D1%8B%D0%B9%20%D1%88%D1%83%D0%BC%20%D0%B4%D0%BB%D1%8F%20%D1%81%D0%BD%D0%B0",
    "imageUrl": "https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?auto=format&fit=crop&w=1200&q=80"
  },
  {
    "id": "care-basket",
    "title": "Корзина ухода",
    "category": "Уход",
    "price": "от 16 000 ₸",
    "description": "Набор мелочей, которые всегда должны быть под рукой.",
    "details": "Можно собрать термометр, ножницы с закруглёнными концами, расчёску, ватные диски, крем под подгузник и органайзер.",
    "marketUrl": "https://kaspi.kz/shop/search/?text=%D0%BD%D0%B0%D0%B1%D0%BE%D1%80%20%D1%83%D1%85%D0%BE%D0%B4%D0%B0%20%D0%B7%D0%B0%20%D0%BD%D0%BE%D0%B2%D0%BE%D1%80%D0%BE%D0%B6%D0%B4%D0%B5%D0%BD%D0%BD%D1%8B%D0%BC",
    "imageUrl": "https://images.unsplash.com/photo-1566004100631-35d015d6a491?auto=format&fit=crop&w=1200&q=80"
  }
]
```

- [ ] **Step 2: Create `tests/validate-gifts.mjs`**

Use this complete file:

```js
import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';

const requiredStringFields = [
  'id',
  'title',
  'category',
  'price',
  'description',
  'details',
  'marketUrl',
  'imageUrl'
];

const raw = await readFile(new URL('../gifts.json', import.meta.url), 'utf8');
const gifts = JSON.parse(raw);

if (!Array.isArray(gifts)) {
  throw new Error('gifts.json must contain an array');
}

if (gifts.length < 8) {
  throw new Error('gifts.json must contain at least 8 gifts');
}

const ids = new Set();

for (const gift of gifts) {
  for (const field of requiredStringFields) {
    if (typeof gift[field] !== 'string' || gift[field].trim() === '') {
      throw new Error(`Gift ${gift.id || '(missing id)'} has invalid ${field}`);
    }
  }

  if (ids.has(gift.id)) {
    throw new Error(`Duplicate gift id: ${gift.id}`);
  }

  ids.add(gift.id);
  new URL(gift.marketUrl);
  new URL(gift.imageUrl);
}

console.log(`Validated ${gifts.length} gifts`);
```

- [ ] **Step 3: Run validation**

Run:

```bash
node tests/validate-gifts.mjs
```

Expected output:

```text
Validated 10 gifts
```

- [ ] **Step 4: Add README setup section**

Replace `README.md` with:

````markdown
# Baby Gift Registry

Static GitHub Pages site where friends can choose one baby gift. The public gift catalog lives in `gifts.json`; shared reservations live in Firebase Firestore.

## Local Preview

```bash
python3 -m http.server 4173
```

Open `http://localhost:4173`.

## Edit Gifts

Update `gifts.json`. Each gift needs:

- `id`
- `title`
- `category`
- `price`
- `description`
- `details`
- `marketUrl`
- `imageUrl`

Validate after editing:

```bash
node tests/validate-gifts.mjs
```

## Firebase Setup

1. Create a Firebase project.
2. Create a Firestore database.
3. Copy the web app config into `firebase-config.js`.
4. Publish these Firestore rules:

```js
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /reservations/{giftId} {
      allow read: if true;
      allow create: if
        !exists(/databases/$(database)/documents/reservations/$(giftId)) &&
        request.resource.data.giftId == giftId &&
        request.resource.data.firstName is string &&
        request.resource.data.lastName is string &&
        request.resource.data.displayName is string &&
        request.resource.data.createdAt is timestamp;
      allow update, delete: if false;
    }
  }
}
```

The Firebase browser config is public by design. The Firestore rules protect reservations from normal overwrite/delete actions.

## GitHub Pages

In repository settings, enable Pages from the `main` branch and repository root.
````

- [ ] **Step 5: Commit catalog and validation**

```bash
git add gifts.json tests/validate-gifts.mjs README.md
git commit -m "feat: add starter gift catalog"
```

### Task 3: Firebase Configuration And App Logic

**Files:**
- Create: `firebase-config.js`
- Create: `app.js`

- [ ] **Step 1: Create `firebase-config.js`**

Use this complete file:

```js
export const firebaseConfig = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: ''
};

export const isFirebaseConfigured = Object.values(firebaseConfig).every(Boolean);
```

- [ ] **Step 2: Create `app.js` with full app behavior**

Use this complete file:

```js
import { firebaseConfig, isFirebaseConfigured } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js';
import {
  collection,
  doc,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  setDoc
} from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js';

const STORAGE_PROFILE_KEY = 'babyGiftRegistry.profile';
const STORAGE_SELECTION_KEY = 'babyGiftRegistry.selection';

const state = {
  profile: null,
  selectedGiftId: localStorage.getItem(STORAGE_SELECTION_KEY),
  gifts: [],
  reservations: new Map(),
  activeGift: null,
  firestore: null,
  firebaseReady: false
};

const elements = {
  loginView: document.querySelector('#loginView'),
  catalogView: document.querySelector('#catalogView'),
  loginForm: document.querySelector('#loginForm'),
  firstName: document.querySelector('#firstName'),
  lastName: document.querySelector('#lastName'),
  profileName: document.querySelector('#profileName'),
  changeProfileButton: document.querySelector('#changeProfileButton'),
  statusBanner: document.querySelector('#statusBanner'),
  giftGrid: document.querySelector('#giftGrid'),
  giftModal: document.querySelector('#giftModal'),
  modalCloseButton: document.querySelector('#modalCloseButton'),
  modalImage: document.querySelector('#modalImage'),
  modalCategory: document.querySelector('#modalCategory'),
  modalTitle: document.querySelector('#modalTitle'),
  modalPrice: document.querySelector('#modalPrice'),
  modalDescription: document.querySelector('#modalDescription'),
  modalDetails: document.querySelector('#modalDetails'),
  modalMarketLink: document.querySelector('#modalMarketLink'),
  reserveButton: document.querySelector('#reserveButton'),
  modalNote: document.querySelector('#modalNote'),
  toast: document.querySelector('#toast')
};

init();

async function init() {
  bindEvents();
  restoreProfile();
  await loadGifts();
  setupFirebase();
  render();
}

function bindEvents() {
  elements.loginForm.addEventListener('submit', handleLogin);
  elements.changeProfileButton.addEventListener('click', clearProfile);
  elements.modalCloseButton.addEventListener('click', closeModal);
  elements.giftModal.addEventListener('click', (event) => {
    if (event.target === elements.giftModal) {
      closeModal();
    }
  });
  elements.reserveButton.addEventListener('click', reserveActiveGift);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeModal();
    }
  });
}

function restoreProfile() {
  const rawProfile = localStorage.getItem(STORAGE_PROFILE_KEY);

  if (!rawProfile) {
    return;
  }

  try {
    const profile = JSON.parse(rawProfile);
    if (profile.firstName && profile.lastName) {
      state.profile = profile;
    }
  } catch {
    localStorage.removeItem(STORAGE_PROFILE_KEY);
  }
}

async function loadGifts() {
  try {
    const response = await fetch('./gifts.json', { cache: 'no-store' });

    if (!response.ok) {
      throw new Error(`Gift catalog request failed: ${response.status}`);
    }

    state.gifts = await response.json();
  } catch (error) {
    showBanner('Не удалось загрузить список подарков. Обновите страницу чуть позже.');
    console.error(error);
  }
}

function setupFirebase() {
  if (!isFirebaseConfigured) {
    showBanner('Firebase ещё не настроен. Каталог работает в режиме просмотра, бронирование станет доступно после настройки.');
    return;
  }

  try {
    const app = initializeApp(firebaseConfig);
    state.firestore = getFirestore(app);
    state.firebaseReady = true;

    subscribeToReservations();
  } catch (error) {
    showBanner('Не удалось подключиться к Firebase. Доступность подарков временно не обновляется.');
    console.error(error);
  }
}

function subscribeToReservations() {
  onSnapshot(
    collection(state.firestore, 'reservations'),
    (snapshot) => {
      state.reservations = new Map(snapshot.docs.map((reservationDoc) => [reservationDoc.id, reservationDoc.data()]));
      renderGifts();
      updateActiveModalState();
    },
    (error) => {
      showBanner('Не удалось получить занятые подарки. Попробуйте обновить страницу.');
      console.error(error);
    }
  );
}

function handleLogin(event) {
  event.preventDefault();

  const firstName = elements.firstName.value.trim();
  const lastName = elements.lastName.value.trim();

  if (firstName.length < 2 || lastName.length < 2) {
    showToast('Введите имя и фамилию полностью.');
    return;
  }

  state.profile = {
    firstName,
    lastName,
    displayName: `${firstName} ${lastName}`
  };

  localStorage.setItem(STORAGE_PROFILE_KEY, JSON.stringify(state.profile));
  render();
}

function clearProfile() {
  localStorage.removeItem(STORAGE_PROFILE_KEY);
  state.profile = null;
  closeModal();
  render();
}

function render() {
  if (!state.profile) {
    elements.loginView.classList.remove('hidden');
    elements.catalogView.classList.add('hidden');
    return;
  }

  elements.loginView.classList.add('hidden');
  elements.catalogView.classList.remove('hidden');
  elements.profileName.textContent = state.profile.displayName;
  renderGifts();
}

function renderGifts() {
  elements.giftGrid.innerHTML = '';

  if (state.gifts.length === 0) {
    elements.giftGrid.innerHTML = '<p class="status-banner">Пока список подарков пуст.</p>';
    return;
  }

  for (const gift of state.gifts) {
    const reservation = state.reservations.get(gift.id);
    const isReserved = Boolean(reservation);
    const userAlreadySelected = Boolean(state.selectedGiftId);
    const isOwnSelection = state.selectedGiftId === gift.id;
    const card = document.createElement('article');

    card.className = `gift-card${isReserved ? ' reserved' : ''}`;
    card.innerHTML = `
      <img src="${escapeAttribute(gift.imageUrl)}" alt="${escapeAttribute(gift.title)}" loading="lazy">
      <div class="gift-body">
        <div class="gift-topline">
          <span>${escapeHtml(gift.category)}</span>
          <span>${escapeHtml(gift.price)}</span>
        </div>
        <h2>${escapeHtml(gift.title)}</h2>
        <p>${escapeHtml(gift.description)}</p>
        <p>${getAvailabilityText(isReserved, reservation, isOwnSelection)}</p>
        <button class="gift-action" type="button" ${isReserved || (userAlreadySelected && !isOwnSelection) ? 'disabled' : ''}>
          ${getActionText(isReserved, isOwnSelection, userAlreadySelected)}
        </button>
      </div>
    `;

    const button = card.querySelector('button');
    button.addEventListener('click', () => openModal(gift));
    elements.giftGrid.append(card);
  }
}

function getAvailabilityText(isReserved, reservation, isOwnSelection) {
  if (isReserved && isOwnSelection) {
    return 'Это ваш выбранный подарок.';
  }

  if (isReserved) {
    return `Уже дарит ${reservation.displayName}.`;
  }

  if (state.selectedGiftId) {
    return 'Вы уже выбрали один подарок.';
  }

  return 'Свободен для выбора.';
}

function getActionText(isReserved, isOwnSelection, userAlreadySelected) {
  if (isOwnSelection) {
    return 'Ваш подарок';
  }

  if (isReserved) {
    return 'Уже занят';
  }

  if (userAlreadySelected) {
    return 'Можно выбрать только один';
  }

  return 'Посмотреть';
}

function openModal(gift) {
  state.activeGift = gift;
  elements.modalImage.src = gift.imageUrl;
  elements.modalImage.alt = gift.title;
  elements.modalCategory.textContent = gift.category;
  elements.modalTitle.textContent = gift.title;
  elements.modalPrice.textContent = gift.price;
  elements.modalDescription.textContent = gift.description;
  elements.modalDetails.textContent = gift.details;
  elements.modalMarketLink.href = gift.marketUrl;
  elements.giftModal.classList.remove('hidden');
  updateActiveModalState();
}

function closeModal() {
  elements.giftModal.classList.add('hidden');
  state.activeGift = null;
}

function updateActiveModalState() {
  if (!state.activeGift) {
    return;
  }

  const reservation = state.reservations.get(state.activeGift.id);
  const isReserved = Boolean(reservation);
  const isOwnSelection = state.selectedGiftId === state.activeGift.id;
  const hasOtherSelection = Boolean(state.selectedGiftId) && !isOwnSelection;

  elements.reserveButton.disabled = isReserved || hasOtherSelection || !state.firebaseReady;

  if (!state.firebaseReady) {
    elements.modalNote.textContent = 'Бронирование станет доступно после настройки Firebase.';
    return;
  }

  if (isOwnSelection) {
    elements.modalNote.textContent = 'Вы уже выбрали этот подарок.';
    return;
  }

  if (isReserved) {
    elements.modalNote.textContent = `Этот подарок уже дарит ${reservation.displayName}.`;
    return;
  }

  if (hasOtherSelection) {
    elements.modalNote.textContent = 'Вы уже выбрали один подарок. Чтобы выбрать другой, понадобится очистить выбор вручную в браузере.';
    return;
  }

  elements.modalNote.textContent = 'После подтверждения подарок станет недоступен для остальных гостей.';
}

async function reserveActiveGift() {
  if (!state.activeGift || !state.profile || !state.firestore) {
    return;
  }

  if (!window.confirm('Вы точно уверены, что хотите подарить этот подарок?')) {
    return;
  }

  try {
    elements.reserveButton.disabled = true;
    await setDoc(doc(state.firestore, 'reservations', state.activeGift.id), {
      giftId: state.activeGift.id,
      firstName: state.profile.firstName,
      lastName: state.profile.lastName,
      displayName: state.profile.displayName,
      createdAt: serverTimestamp()
    });

    state.selectedGiftId = state.activeGift.id;
    localStorage.setItem(STORAGE_SELECTION_KEY, state.activeGift.id);
    showToast('Готово! Подарок закреплён за вами.');
    closeModal();
    renderGifts();
  } catch (error) {
    showToast('Не получилось закрепить подарок. Возможно, его уже выбрали.');
    console.error(error);
  } finally {
    if (state.activeGift) {
      updateActiveModalState();
    }
  }
}

function showBanner(message) {
  elements.statusBanner.textContent = message;
  elements.statusBanner.classList.remove('hidden');
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.remove('hidden');
  window.clearTimeout(showToast.timeoutId);
  showToast.timeoutId = window.setTimeout(() => {
    elements.toast.classList.add('hidden');
  }, 4200);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll('`', '&#096;');
}
```

- [ ] **Step 3: Preview app behavior without Firebase config**

Run:

```bash
python3 -m http.server 4173
```

Expected:

- login form appears
- entering first and last name opens catalog
- gift cards render from `gifts.json`
- modal opens from available gift
- reserve button is disabled with Firebase setup message

- [ ] **Step 4: Commit app behavior**

```bash
git add firebase-config.js app.js
git commit -m "feat: add gift reservation app logic"
```

### Task 4: Documentation, Firebase Rules, And Final Verification

**Files:**
- Modify: `README.md`
- Create: `firestore.rules`

- [ ] **Step 1: Create `firestore.rules`**

Use this complete file:

```js
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /reservations/{giftId} {
      allow read: if true;
      allow create: if
        !exists(/databases/$(database)/documents/reservations/$(giftId)) &&
        request.resource.data.giftId == giftId &&
        request.resource.data.firstName is string &&
        request.resource.data.lastName is string &&
        request.resource.data.displayName is string &&
        request.resource.data.createdAt is timestamp;
      allow update, delete: if false;
    }
  }
}
```

- [ ] **Step 2: Add explicit GitHub Pages note to README**

Ensure `README.md` includes:

```markdown
## Deploy

Push the repository to GitHub, then enable GitHub Pages:

1. Open repository settings.
2. Go to Pages.
3. Source: Deploy from a branch.
4. Branch: `main`.
5. Folder: `/ (root)`.

After GitHub publishes the page, share the Pages URL with friends.
```

- [ ] **Step 3: Validate gift catalog**

Run:

```bash
node tests/validate-gifts.mjs
```

Expected:

```text
Validated 10 gifts
```

- [ ] **Step 4: Check static serving**

Run:

```bash
python3 -m http.server 4173
```

Expected:

- `http://localhost:4173` returns the site
- browser console has no syntax errors
- login and modal flow work without Firebase config

- [ ] **Step 5: Final git status**

Run:

```bash
git status --short
```

Expected: no uncommitted files, or only intentional local Firebase config edits that should not be committed.

- [ ] **Step 6: Commit docs and rules**

```bash
git add README.md firestore.rules
git commit -m "docs: add Firebase and Pages setup"
```

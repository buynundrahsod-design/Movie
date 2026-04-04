// =============================================
//  КИНО СОНГОГЧ — app.js
//  Нууц код → Firebase Anonymous Auth → Realtime DB sync
// =============================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, onValue, push, remove, set }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { getAuth, signInAnonymously, signOut }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// ---------- FIREBASE ----------
const firebaseConfig = {
  apiKey: "AIzaSyDZYHpoIFJS1K1077G8Q4TtvAN6CVPRu18",
  authDomain: "kino-songolt.firebaseapp.com",
  databaseURL: "https://kino-songolt-default-rtdb.firebaseio.com",
  projectId: "kino-songolt",
  storageBucket: "kino-songolt.firebasestorage.app",
  messagingSenderId: "925991191850",
  appId: "1:925991191850:web:a0d31eaca121b093010a53",
};

const firebaseApp = initializeApp(firebaseConfig);
const db  = getDatabase(firebaseApp);
const auth = getAuth(firebaseApp);

// ---------- ХЭРЭГЛЭГЧИД (нууц код → хүн) ----------
const USERS = {
  '0804': { person: 1, name: 'Халиунаа', greeting: 'Халиунаа! 🌸', emoji: '🌸' },
  '0405': { person: 2, name: 'Ундрах',   greeting: 'Ундрах! 🕵️',   emoji: '🕵️' },
};

// ---------- STATE ----------
let currentUser = null;   // { person, name, greeting, emoji }
let localMovies = { 1: {}, 2: {} };
let apiKey = localStorage.getItem('moviepicker_apikey') || '';
let modalCallback = null;

// ---------- НЭВТРЭХ ----------
window.login = async function() {
  const code = document.getElementById('loginInput').value.trim();
  const errEl = document.getElementById('loginError');
  errEl.textContent = '';

  if (!USERS[code]) {
    errEl.textContent = 'Буруу код байна.';
    // shake animation дахин trigger
    errEl.style.animation = 'none';
    requestAnimationFrame(() => { errEl.style.animation = ''; });
    document.getElementById('loginInput').value = '';
    document.getElementById('loginInput').focus();
    return;
  }

  try {
    await signInAnonymously(auth);
    currentUser = USERS[code];
    showApp();
  } catch (e) {
    errEl.textContent = 'Firebase алдаа: ' + e.message;
  }
};

function showApp() {
  // Нэвтрэх хуудас нуух
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('appScreen').style.display = 'block';

  // User badge
  const badge = document.getElementById('userBadge');
  badge.textContent = currentUser.emoji + ' ' + currentUser.name;
  badge.className = 'user-badge u' + currentUser.person;

  // Өөрийн card highlight
  document.querySelector('.person-card[data-person="' + currentUser.person + '"]').classList.add('mine');

  // Өөрийн бус card-н input нуух
  const otherPerson = currentUser.person === 1 ? 2 : 1;
  document.getElementById('addRow' + otherPerson).classList.add('hidden');

  // Мэндчилгээ banner
  const main = document.querySelector('.main');
  const banner = document.createElement('div');
  banner.className = 'welcome-banner';
  banner.innerHTML = `
    <div class="welcome-emoji">${currentUser.emoji}</div>
    <div>
      <div class="welcome-text">${currentUser.greeting}</div>
      <div class="welcome-sub">Кинонуудаа нэмээрэй</div>
    </div>
  `;
  main.insertBefore(banner, main.firstChild);
  setTimeout(() => banner.style.opacity = '0.7', 3000);

  // Firebase listener эхлүүлэх
  startListeners();
}

// ---------- ГАРАХ ----------
window.logout = async function() {
  if (!confirm('Гарах уу?')) return;
  await signOut(auth);
  location.reload();
};

// ---------- SYNC STATUS ----------
function setSync(status) {
  const dot = document.getElementById('syncDot');
  const label = document.getElementById('syncLabel');
  if (status === 'online') {
    dot.className = 'sync-dot online';
    label.textContent = 'Sync холбоотой';
  } else if (status === 'offline') {
    dot.className = 'sync-dot offline';
    label.textContent = 'Офлайн';
  } else {
    dot.className = 'sync-dot';
    label.textContent = 'Холбогдож байна...';
  }
}

// ---------- FIREBASE LISTENERS ----------
function startListeners() {
  setSync('connecting');

  onValue(ref(db, 'movies'), (snapshot) => {
    setSync('online');
    const data = snapshot.val() || {};
    localMovies[1] = data[1] || {};
    localMovies[2] = data[2] || {};
    renderList(1);
    renderList(2);
    updateRandomBtn();
  }, () => setSync('offline'));
}

// ---------- КИНО НЭМЭХ ----------
window.addMovie = function(person) {
  // Зөвхөн өөрийн хэсэгт нэмэх боломжтой
  if (person !== currentUser.person) return;

  const inp = document.getElementById('input' + person);
  const title = inp.value.trim();
  if (!title) return;

  push(ref(db, 'movies/' + person), {
    title: title,
    addedAt: Date.now(),
    addedBy: currentUser.name
  });

  inp.value = '';
  inp.focus();
};

// ---------- КИНО УСТГАХ ----------
window.removeMovie = function(person, key) {
  // Зөвхөн өөрийнхийг устгах боломжтой
  if (person !== currentUser.person) return;
  remove(ref(db, 'movies/' + person + '/' + key));
};

// ---------- БҮГДИЙГ АРИЛГАХ ----------
window.clearAll = function() {
  if (!confirm('Бүх кинонуудыг устгах уу?')) return;
  set(ref(db, 'movies'), { 1: {}, 2: {} });
  document.getElementById('result').innerHTML = '';
};

// ---------- RENDER ----------
function renderList(person) {
  const list = document.getElementById('list' + person);
  const countEl = document.getElementById('count' + person);
  const items = Object.entries(localMovies[person]);

  countEl.textContent = items.length + ' кино';

  if (items.length === 0) {
    list.innerHTML = '<li class="empty-hint">Кино нэмж эхлээрэй</li>';
    return;
  }

  items.sort((a, b) => (a[1].addedAt || 0) - (b[1].addedAt || 0));

  const isOwner = currentUser && person === currentUser.person;

  list.innerHTML = items.map(([key, movie]) => `
    <li class="movie-item p${person}">
      <span class="movie-item-title">${escapeHtml(movie.title)}</span>
      ${isOwner ? `<button class="del-btn" onclick="removeMovie(${person}, '${key}')">×</button>` : ''}
    </li>
  `).join('');
}

function updateRandomBtn() {
  const total = Object.keys(localMovies[1]).length + Object.keys(localMovies[2]).length;
  const btn = document.getElementById('randomBtn');
  const hint = document.getElementById('randomHint');
  btn.disabled = total === 0;
  hint.textContent = total === 0
    ? 'Кино нэмэхэд товч идэвхжинэ'
    : `Нийт ${total} кинооос санамсаргүй сонгоно`;
}

// ---------- RANDOM ----------
window.pickRandom = function() {
  const all = [
    ...Object.entries(localMovies[1]).map(([key, m]) => ({ key, person: 1, ...m })),
    ...Object.entries(localMovies[2]).map(([key, m]) => ({ key, person: 2, ...m }))
  ];
  if (all.length === 0) return;

  const picked = all[Math.floor(Math.random() * all.length)];
  const ownerName = picked.person === 1 ? 'Халиунаа' : 'Ундрах';

  // Firebase-с устгах
  remove(ref(db, 'movies/' + picked.person + '/' + picked.key));

  const resultEl = document.getElementById('result');
  resultEl.innerHTML = `
    <div class="result-card">
      <div class="result-tag">✨ Сонгогдлоо</div>
      <div class="result-title">${escapeHtml(picked.title)}</div>
      <div class="result-owner">${ownerName}-ын сонголт жагсаалтаас хасагдлаа</div>
      <div style="margin-top:1rem; font-size:15px; color:var(--text2)">🎬 Киногоо гоё үзье</div>
    </div>
  `;
  resultEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  updateRandomBtn();
};

// ---------- CLAUDE API ----------
async function getAiReasoning(movieTitle, ownerName) {
  const aiTextEl = document.getElementById('aiText');
  if (!aiTextEl) return;

  if (!apiKey) {
    openModal(() => getAiReasoning(movieTitle, ownerName));
    aiTextEl.innerHTML = '<span style="color:var(--text3)">API key оруулна уу...</span>';
    return;
  }

  const p1list = Object.values(localMovies[1]).map(m => m.title).join(', ') || 'байхгүй';
  const p2list = Object.values(localMovies[2]).map(m => m.title).join(', ') || 'байхгүй';

  const prompt = `Хоёр найз Халиунаа, Үндрах хоёр кино үзэхээр тус тусын жагсаалт гаргасан.
Халиунаагийн жагсаалт: ${p1list}
Үндрахын жагсаалт: ${p2list}
Санамсаргүйгээр сонгогдсон кино: "${movieTitle}" (${ownerName}-ын санал)
Яагаад энэ кино хамтдаа үзэхэд тохиромжтой вэ гэдгийг 1-2 өгүүлбэрээр монголоор хэлээрэй. Товч, хөгжилтэй байдлаар.`;

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 200,
        stream: true,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!resp.ok) {
      const err = await resp.json();
      aiTextEl.innerHTML = `<span style="color:#e85a5a">Алдаа: ${err.error?.message || 'API алдаа'}</span>`;
      return;
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let text = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      for (const line of chunk.split('\n')) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;
        try {
          const json = JSON.parse(data);
          if (json.type === 'content_block_delta' && json.delta?.text) {
            text += json.delta.text;
            aiTextEl.innerHTML = escapeHtml(text) + '<span class="ai-typing"></span>';
          }
        } catch (_) {}
      }
    }
    aiTextEl.innerHTML = escapeHtml(text);

  } catch (e) {
    aiTextEl.innerHTML = `<span style="color:var(--text3)">AI холбогдсонгүй.</span>`;
  }
}

// ---------- MODAL ----------
window.openModal = function(cb) {
  modalCallback = cb || null;
  document.getElementById('modalOverlay').classList.add('open');
  const inp = document.getElementById('apiKeyInput');
  inp.value = apiKey || '';
  setTimeout(() => inp.focus(), 100);
};
window.closeModal = function() {
  document.getElementById('modalOverlay').classList.remove('open');
};
window.saveKey = function() {
  const val = document.getElementById('apiKeyInput').value.trim();
  if (!val) { alert('API key оруулна уу'); return; }
  apiKey = val;
  localStorage.setItem('moviepicker_apikey', apiKey);
  closeModal();
  if (modalCallback) { modalCallback(); modalCallback = null; }
};
document.getElementById('modalOverlay').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});
document.getElementById('apiKeyInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') saveKey();
});
document.getElementById('loginInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') login();
});

// ---------- UTIL ----------
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
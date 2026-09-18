
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, onValue, push, remove, set, update }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { getAuth, signInAnonymously, signOut }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

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
const db   = getDatabase(firebaseApp);
const auth = getAuth(firebaseApp);

const USERS = {
  '0804': { person: 1, name: 'Халиунаа', emoji: '🌸' },
  '0405': { person: 2, name: 'Ундрах',   emoji: '🕵️' },
};

const RATING_KEYS = ['Story', 'Жүжиглэлт', 'CGI', 'Soundtrack', 'Дүрүүд', 'Хэр сэтгэлд хүрсэн', 'Төгсгөл'];

let currentUser   = null;
let localMovies   = { 1: {}, 2: {} };  // үзэх жагсаалт
let watchedMovies = {};                 // key → movie object
let currentPanel  = null;              // одоо нээлттэй panel-ийн movie key

window.login = async function() {
  const code  = document.getElementById('loginInput').value.trim();
  const errEl = document.getElementById('loginError');
  errEl.textContent = '';

  if (!USERS[code]) {
    errEl.textContent = 'Буруу код байна.';
    document.getElementById('loginInput').value = '';
    document.getElementById('loginInput').focus();
    return;
  }
  try {
    await signInAnonymously(auth);
    currentUser = USERS[code];
    showApp();
  } catch (e) {
    errEl.textContent = 'Алдаа: ' + e.message;
  }
};

document.getElementById('loginInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') login();
});

function showApp() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('appScreen').style.display   = 'block';

  const chip = document.getElementById('userChip');
  chip.textContent = currentUser.emoji + ' ' + currentUser.name;
  chip.className   = 'user-chip u' + currentUser.person;

  const other = currentUser.person === 1 ? 2 : 1;
  document.getElementById('addRow' + other).classList.add('hidden');

  startListeners();
}

window.logout = async function() {
  if (!confirm('Гарах уу?')) return;
  await signOut(auth);
  location.reload();
};

function setSync(status) {
  const dot   = document.getElementById('syncDot');
  const label = document.getElementById('syncLabel');
  if (status === 'online') {
    dot.className = 'sync-dot online';
    label.textContent = 'Synced · Just now';
  } else if (status === 'offline') {
    dot.className = 'sync-dot offline';
    label.textContent = 'Офлайн';
  } else {
    dot.className = 'sync-dot';
    label.textContent = 'Холбогдож байна...';
  }
}

function startListeners() {
  setSync('connecting');

  onValue(ref(db, 'movies'), (snapshot) => {
    setSync('online');
    const data     = snapshot.val() || {};
    localMovies[1] = data[1] || {};
    localMovies[2] = data[2] || {};
    renderList(1);
    renderList(2);
    updateCounts();
  }, () => setSync('offline'));

  onValue(ref(db, 'watched'), (snapshot) => {
    watchedMovies = snapshot.val() || {};
    renderWatched();
    updateStats();
    if (currentPanel) openPanel(currentPanel);
  });
}

window.addMovie = function(person) {
  if (person !== currentUser.person) return;
  const inp   = document.getElementById('input' + person);
  const title = inp.value.trim();
  if (!title) return;

  push(ref(db, 'movies/' + person), {
    title,
    addedAt: Date.now(),
    addedBy: currentUser.name,
  });

  inp.value = '';
  inp.focus();
};

window.removeMovie = function(person, key) {
  if (person !== currentUser.person) return;
  remove(ref(db, 'movies/' + person + '/' + key));
};

window.markWatched = function(person, key) {
  if (person !== currentUser.person) return;
  const movie = localMovies[person][key];
  if (!movie) return;

  remove(ref(db, 'movies/' + person + '/' + key));

  push(ref(db, 'watched'), {
    title:     movie.title,
    addedBy:   movie.addedBy || currentUser.name,
    watchedAt: Date.now(),  // ← энийг дараа он/сар болгоно
    person,
    ratings:   { 1: {}, 2: {} },  // хоёулангийн үнэлгээ хоосон
    reviews:   { 1: '', 2: '' },   // хоёулангийн review хоосон
  });
};

function renderList(person) {
  const list    = document.getElementById('list' + person);
  const items   = Object.entries(localMovies[person]);
  const isOwner = currentUser && person === currentUser.person;

  if (items.length === 0) {
    list.innerHTML = '<li class="empty-hint">Кино нэмж эхлээрэй</li>';
    return;
  }

  items.sort((a, b) => (a[1].addedAt || 0) - (b[1].addedAt || 0));

  list.innerHTML = items.map(([key, movie]) => `
    <li class="movie-item p${person}">
      <span class="movie-item-title">${escapeHtml(movie.title)}</span>
      ${isOwner ? `
        <button class="watched-btn" title="Үзсэн" onclick="markWatched(${person},'${key}')">✓</button>
        <button class="del-btn" onclick="removeMovie(${person},'${key}')">×</button>
      ` : ''}
    </li>
  `).join('');
}

function updateCounts() {
  const n1    = Object.keys(localMovies[1]).length;
  const n2    = Object.keys(localMovies[2]).length;
  const total = n1 + n2;

  document.getElementById('count1').textContent     = n1;
  document.getElementById('count2').textContent     = n2;
  document.getElementById('countTotal').textContent = total;
  document.getElementById('badge1').textContent     = n1 + ' movies';
  document.getElementById('badge2').textContent     = n2 + ' movies';
  document.getElementById('randomBtn').disabled     = total === 0;
}

function updateStats() {
  const movies = Object.values(watchedMovies);
  const total = movies.length;

  document.getElementById('statWatched').textContent = total;

  const scores = movies
    .map(m => {
      const r1 = m.ratings?.[1] || {};
      const r2 = m.ratings?.[2] || {};

      const all = [...Object.values(r1), ...Object.values(r2)]
        .map(Number)
        .filter(n => !isNaN(n) && n > 0);

      return all.length
        ? all.reduce((a, b) => a + b, 0) / all.length
        : null;
    })
    .filter(s => s !== null);

  if (scores.length) {
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;

    document.getElementById('statScore').textContent = avg.toFixed(1);
  } else {
    document.getElementById('statScore').textContent = '—';
  }
}

function renderWatched() {
  const container = document.getElementById('watchedList');
  if (!container) return;

  const items = Object.entries(watchedMovies)
    .sort((a, b) => b[1].watchedAt - a[1].watchedAt); // шинэ нь эхэнд

  if (items.length === 0) {
    container.innerHTML = '<div class="empty-watched">Одоохондоо үзсэн кино байхгүй байна</div>';
    return;
  }

  container.innerHTML = items.map(([key, movie]) => {
    const d       = new Date(movie.watchedAt);
    const dateStr = d.getFullYear() + '/' + (d.getMonth()+1) + '/' + d.getDate();

    const r1  = movie.ratings?.[1] || {};
    const r2  = movie.ratings?.[2] || {};
    const all = [...Object.values(r1), ...Object.values(r2)]
      .map(Number).filter(n => !isNaN(n) && n > 0);
    const avg = all.length ? (all.reduce((a,b) => a+b,0) / all.length).toFixed(1) : null;

    return `
      <div class="watched-card" onclick="openPanel('${key}')">
        <div>
          <div class="watched-card-title">${escapeHtml(movie.title)}</div>
          <div class="watched-card-meta">${movie.addedBy} · Watched · ${dateStr}</div>
        </div>
        <div class="watched-card-score">
          ${avg ? `<span class="score-star">⭐</span><span class="score-val">${avg}</span>` : ''}
          <div class="watched-card-badge">✓ Watched</div>
        </div>
      </div>
    `;
  }).join('');
}

window.openPanel = function(key) {
  currentPanel = key;
  const movie  = watchedMovies[key];
  if (!movie) return;

  const d       = new Date(movie.watchedAt);
  const dateStr = d.getFullYear() + '/' + (d.getMonth()+1) + '/' + d.getDate();

  const r1 = movie.ratings?.[1] || {};
  const r2 = movie.ratings?.[2] || {};

  const all = [...Object.values(r1), ...Object.values(r2)]
    .map(Number).filter(n => !isNaN(n) && n > 0);
  const avg = all.length ? (all.reduce((a,b) => a+b,0) / all.length).toFixed(1) : '—';

  const p = currentUser.person;

  document.getElementById('panelTitle').textContent = 'Movie Details';
  document.getElementById('panelBody').innerHTML = `

    <!-- Кино нэр + мэдээлэл -->
    <div class="panel-movie-title">${escapeHtml(movie.title)}</div>
    <div class="panel-meta">
      <span class="panel-watched-badge">✓ Үзсээн</span>
      <span class="panel-date">📅 ${dateStr}</span>
    </div>

    <!-- OUR SCORE -->
    <div class="our-score-box">
      <div class="our-score-label">Бидний үнэлгээ</div>
      <div class="our-score-num">
        <span class="our-score-star">⭐</span>
        ${avg}
        <span class="our-score-denom">/ 10</span>
      </div>
    </div>

    <!-- RATINGS харуулах -->
    <div class="panel-section">
      <div class="panel-section-title">Оноолт</div>
      <div class="ratings-grid">
        ${renderRatingCol(1, '🌸 Халиунаа', r1)}
        ${renderRatingCol(2, '🕵️ Ундрах', r2)}
      </div>
    </div>

    <!-- ҮНЭЛГЭЭ ОРУУЛАХ — товч дарах хэлбэр -->
    <div class="panel-section">
      <div class="panel-section-title">${currentUser.emoji} ${currentUser.name} — Үнэлгээ өгөх</div>
      <div class="btn-rating-list">
        ${RATING_KEYS.map(k => {
          const cur = p === 1 ? (r1[k] ?? null) : (r2[k] ?? null);
          return `
            <div class="btn-rating-row">
              <span class="btn-rating-label">${k}</span>
              <div class="btn-rating-nums">
                ${[1,2,3,4,5,6,7,8,9,10].map(n => `
                  <button
                    class="rnum-btn ${cur === n ? 'rnum-active' : ''}"
                    data-cat="${k}"
                    data-val="${n}"
                    onclick="selectRating('${key}', '${k}', ${n})"
                  >${n}</button>
                `).join('')}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>

    <!-- REVIEWS -->
    <div class="panel-section">
      <div class="panel-section-title">Сэтгэгдэл</div>
      <div class="review-grid">
        ${renderReviewCol(key, 1, '🌸 Халиунаа', movie.reviews?.[1] || '', p)}
        ${renderReviewCol(key, 2, '🕵️ Ундрах',   movie.reviews?.[2] || '', p)}
      </div>
    </div>


  `;

  document.getElementById('panelOverlay').classList.add('open');
  document.getElementById('detailPanel').classList.add('open');
};

function renderRatingCol(person, name, ratings) {
  const vals = RATING_KEYS.map(k => ({
    key: k,
    val: ratings[k] !== undefined ? ratings[k] : '—'
  }));

  return `
    <div class="rating-col">
      <div class="rating-col-name">${name}</div>
      ${vals.map(({key, val}) => `
        <div class="rating-row">
          <span class="rating-label">${key}</span>
          <span class="rating-val">${val}</span>
        </div>
      `).join('')}
      <div class="rating-overall">
        <span class="rating-label">Нийт үнэлгээ</span>
        <span class="rating-val">${calcAvg(Object.values(ratings))}</span>
      </div>
    </div>
  `;
}

function renderReviewCol(key, person, name, text, myPerson) {
  const isMe = person === myPerson;
  return `
    <div class="review-col">
      <div class="review-col-name">
        ${name}
        ${isMe ? `<button class="review-edit-btn" onclick="toggleReviewEdit('${key}',${person})">Edit</button>` : ''}
      </div>
      <div id="reviewText_${person}">
        ${text
          ? `<div class="review-text">${escapeHtml(text)}</div>`
          : `<div class="review-text" style="color:var(--text3)">ОБСООО...</div>`
        }
      </div>
    </div>
  `;
}

window.toggleReviewEdit = function(key, person) {
  const container = document.getElementById('reviewText_' + person);
  const movie     = watchedMovies[key];
  const existing  = movie?.reviews?.[person] || '';

  container.innerHTML = `
    <textarea class="review-textarea" id="reviewArea_${person}" placeholder="Киноны талаарх бодлоо бичээрэ...">${escapeHtml(existing)}</textarea>
    <button class="review-save-btn" onclick="saveReview('${key}', ${person})">Хадгалах</button>
  `;
  document.getElementById('reviewArea_' + person).focus();
};

window.saveReview = function(key, person) {
  const val = document.getElementById('reviewArea_' + person)?.value?.trim() || '';
  update(ref(db, 'watched/' + key + '/reviews'), { [person]: val });
};

window.selectRating = function(key, category, val) {
  const p = currentUser.person;

  update(ref(db, 'watched/' + key + '/ratings/' + p), { [category]: val });

  const allBtns = document.querySelectorAll('.rnum-btn[data-cat="' + category + '"]');
  allBtns.forEach(btn => {
    btn.classList.remove('rnum-active');
    if (parseInt(btn.dataset.val) === val) {
      btn.classList.add('rnum-active');
    }
  });
};

window.closePanel = function() {
  document.getElementById('panelOverlay').classList.remove('open');
  document.getElementById('detailPanel').classList.remove('open');
  currentPanel = null;
};

window.pickRandom = function() {
  const all = [
    ...Object.entries(localMovies[1]).map(([key, m]) => ({ key, person: 1, ...m })),
    ...Object.entries(localMovies[2]).map(([key, m]) => ({ key, person: 2, ...m })),
  ];
  if (all.length === 0) return;

  const picked    = all[Math.floor(Math.random() * all.length)];
  const ownerName = picked.person === 1 ? 'Халиунаа' : 'Ундрах';

  remove(ref(db, 'movies/' + picked.person + '/' + picked.key));
  push(ref(db, 'watched'), {
    title:     picked.title,
    addedBy:   ownerName,
    watchedAt: Date.now(),
    person:    picked.person,
    ratings:   { 1: {}, 2: {} },
    reviews:   { 1: '', 2: '' },
  });

  document.getElementById('result').innerHTML = `
    <div class="result-card">
      <span class="result-tag">✨ Сонгогдлоо</span>
      <div class="result-title">${escapeHtml(picked.title)}</div>
      <div class="result-owner">${ownerName}-ын сонголт · үзсэн жагсаалтад нэмэгдлээ</div>
    </div>
  `;
};

function calcAvg(vals) {
  const nums = vals.map(Number).filter(n => !isNaN(n) && n > 0);
  if (!nums.length) return '—';
  return (nums.reduce((a,b) => a+b, 0) / nums.length).toFixed(1);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
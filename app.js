'use strict';
const API_BASE = 'https://api.alquran.cloud/v1';
const CACHE_NAME = 'mohammed-quran-data-v13';
const SITE_URL = 'https://mohamedsaber899p-mohamed.github.io/Mohammed-saber-/';
let currentSurahNumber = 1;
let currentSurahName = '';
let currentEnglishName = '';
let currentAyahsData = [];
let selectedAyahObj = null;
let currentFontSize = Number(localStorage.getItem('quran_font_size')) || 2.15;
let surahsCache = [];
let currentRevelationFilter = 'all';
let toastTimer = null;
let ayahRepeatRemaining = 0;
let hifzModeActive = false;
let showInlineVerseTools = localStorage.getItem('quran_show_verse_tools') === '1';
let sleepTimerId = null;
let sleepEndAtSurahEnd = false;

let playlistActive = false;
let playlistQueue = [];
let playlistRepeat = false;
let playlistIndex = 0;

const FEATURED_INSPIRATIONS = [
  { surah: 2, ayah: 152, name: 'البقرة', text: 'فَاذْكُرُونِي أَذْكُرْكُمْ وَاشْكُرُوا لِي وَلَا تَكْفُرُونِ' },
  { surah: 2, ayah: 286, name: 'البقرة', text: 'لَا يُكَلِّفُ اللَّهُ نَفْسًا إِلَّا وُسْعَهَا' },
  { surah: 3, ayah: 139, name: 'آل عمران', text: 'وَلَا تَهِنُوا وَلَا تَحْزَنُوا وَأَنْتُمُ الْأَعْلَوْنَ إِنْ كُنْتُمْ مُؤْمِنِينَ' },
  { surah: 18, ayah: 10, name: 'الكهف', text: 'رَبَّنَا آتِنَا مِنْ لَدُنْكَ رَحْمَةً وَهَيِّئْ لَنَا مِنْ أَمْرِنَا رَشَدًا' },
  { surah: 21, ayah: 87, name: 'الأنبياء', text: 'لَا إِلَهَ إِلَّا أَنْتَ سُبْحَانَكَ إِنِّي كُنْتُ مِنَ الظَّالِمِينَ' },
  { surah: 94, ayah: 6, name: 'الشرح', text: 'إِنَّ مَعَ الْعُسْرِ يُسْرًا' }
];

const RECITERS = {
  afs:'https://server8.mp3quran.net/afs/',
  maher:'https://server12.mp3quran.net/maher/',
  sds:'https://server11.mp3quran.net/sds/',
  gmd:'https://server7.mp3quran.net/s_gmd/',
  yasser:'https://server11.mp3quran.net/yasser/',
  abkr:'https://server6.mp3quran.net/abkr/',
  ajm:'https://server10.mp3quran.net/ajm/',
  Fares:'https://server8.mp3quran.net/frs_a/',
  minsh:'https://server10.mp3quran.net/minsh/',
  husri:'https://server13.mp3quran.net/husr/'
};

const AYAH_RECITERS = {
  afs: 'Alafasy_128kbps',
  maher: 'MaherAlMuaiqly128kbps',
  sds: 'Abdurrahmaan_As-Sudais_192kbps',
  gmd: 'Ghamadi_40kbps',
  yasser: 'Yasser_Ad-Dussary_128kbps',
  abkr: 'Idrees_Abkar_128kbps',
  ajm: 'Ahmed_ibn_Ali_al-Ajamy_128kbps_ketaballah.net',
  Fares: 'Fares_Abbad_64kbps',
  minsh: 'Minshawy_Murattal_128kbps',
  husri: 'Husary_128kbps'
};

function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add('hidden'), 2800);
}

async function fetchJSON(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (data.code && data.code !== 200) throw new Error(data.status || 'API error');
    return data;
  } catch (error) {
    if ('caches' in window) {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(url);
      if (cached) return cached.json();
    }
    throw error;
  }
}

function safeText(value) { return String(value ?? ''); }

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

function toArabicDigits(num) {
  return String(num).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
}

function applyQuranFontFamily(fontValue, persist = true) {
  const chosen = fontValue || '"Noto Naskh Arabic", "Amiri", serif';
  document.documentElement.style.setProperty('--quran-font', chosen);
  if (persist) localStorage.setItem('quran_font_family', chosen);
}

function applyDisplayModeStyles(mode) {
  if (mode === 'tajweed') {
    document.documentElement.style.setProperty('--quran-lh', '2.65');
    document.documentElement.style.setProperty('--quran-ls', '0px');
  } else {
    document.documentElement.style.setProperty('--quran-lh', '2.55');
    document.documentElement.style.setProperty('--quran-ls', '0px');
  }
}

function stripTajweedMarkers(encodedText) {
  let source = String(encodedText ?? '');
  source = source.replace(/<tajweed [^>]*>([\s\S]*?)<\/tajweed>/gi, '$1');
  source = source.replace(/\[([a-z])(?::[^\[]*)?\[([^\]]*)\]/gi, '$2');
  return source.replace(/\[([a-z])(?::[^\[]*)?\[/gi, '');
}

const TAJWEED_RULES = {
  h: 'ham_wasl', s: 'silent', l: 'lam_shamsiyyah',
  n: 'madda_normal', p: 'madda_permissible', m: 'madda_necessary',
  q: 'qalqalah', o: 'madda_obligatory', c: 'ikhafa_shafawi',
  f: 'ikhafa', w: 'idgham_shafawi', i: 'iqlab',
  a: 'idgham_ghunnah', u: 'idgham_no_ghunnah',
  d: 'idgham_mutajanisayn', b: 'idgham_mutaqaribayn', g: 'ghunnah'
};

function renderTajweedText(encodedText) {
  let source = String(encodedText ?? '');
  const renderRule = (rule, text) => {
    const cls = TAJWEED_RULES[rule] || rule;
    const safe = escapeHTML(text);
    return Object.values(TAJWEED_RULES).includes(cls)
      ? `<span class="tajweed-rule ${cls}">${safe}</span>`
      : safe;
  };
  source = source.replace(
    /<tajweed [^>]* class\s*=\s*["']?([a-z_]+)["']?[^>]*>([\s\S]*?)<\/tajweed>/gi,
    (_whole, ruleClass, text) => renderRule(ruleClass, text)
  );
  const marker = /\[([a-z])(?::[^\[]*)?\[([^\]]*)\]/gi;
  let html = '';
  let lastIndex = 0;
  let match;
  while ((match = marker.exec(source)) !== null) {
    html += escapeHTML(source.slice(lastIndex, match.index));
    html += renderRule(match[1].toLowerCase(), match[2]);
    lastIndex = marker.lastIndex;
  }
  html += escapeHTML(source.slice(lastIndex));
  return html.replace(/\[([a-z])(?::[^\[]*)?\[/gi, '');
}

function setTheme(theme) {
  document.body.classList.remove('warm', 'emerald', 'amoled');
  if (['warm', 'emerald', 'amoled'].includes(theme)) {
    document.body.classList.add(theme);
  }
  localStorage.setItem('quran_theme', theme);
}

function changeTheme(theme) { setTheme(theme); }

function syncVerseToolsButtonUI() {
  const btn = document.getElementById('verse-tools-btn');
  if (btn) {
    btn.classList.toggle('active-pill', showInlineVerseTools);
    btn.textContent = showInlineVerseTools ? '🙈 إخفاء أزرار الآية' : '🔘 أزرار بجانب الآية';
  }
}

function applyInlineVerseTools(show) {
  showInlineVerseTools = Boolean(show);
  document.body.classList.toggle('show-verse-tools', showInlineVerseTools);
  localStorage.setItem('quran_show_verse_tools', showInlineVerseTools ? '1' : '0');
  syncVerseToolsButtonUI();
}

function toggleInlineVerseTools() {
  applyInlineVerseTools(!showInlineVerseTools);
  showToast(showInlineVerseTools ? 'تم إظهار أزرار النسخ والتفسير بجانب الآيات' : 'تم إخفاء الأزرار بجانب الآيات وإبقاء شريط الآية المحددة');
}

function setSleepTimer() {
  const val = document.getElementById('sleep-timer-select').value;
  const statusEl = document.getElementById('sleep-timer-status');
  if (sleepTimerId) {
    clearTimeout(sleepTimerId);
    sleepTimerId = null;
  }
  sleepEndAtSurahEnd = false;

  if (val === '0') {
    if (statusEl) statusEl.textContent = '';
    showToast('تم إيقاف مؤقت النوم');
    return;
  }
  if (val === 'end_surah') {
    sleepEndAtSurahEnd = true;
    if (statusEl) statusEl.textContent = '⏳ مؤقت النوم مفعّل: سيتوقف الصوت عند نهاية السورة الحالية.';
    showToast('⏳ سيتوقف الصوت تلقائيًا عند نهاية السورة');
    return;
  }
  const minutes = Number(val) || 10;
  sleepTimerId = setTimeout(() => {
    stopAllPlayback();
    document.getElementById('sleep-timer-select').value = '0';
    if (statusEl) statusEl.textContent = '';
    showToast('🌙 انتهى مؤقت النوم وتم إيقاف التلاوة');
  }, minutes * 60 * 1000);
  if (statusEl) statusEl.textContent = `⏳ مؤقت النوم مضبوط على ${minutes} دقيقة.`;
  showToast(`⏳ تم ضبط مؤقت النوم على ${minutes} دقيقة`);
}

function stopAllPlayback() {
  stopContinuousReading();
  const surahAudio = document.getElementById('audio-player');
  if (surahAudio) surahAudio.pause();
}

function toggleHifzMode() {
  hifzModeActive = !hifzModeActive;
  document.body.classList.toggle('hifz-mode', hifzModeActive);
  const btn = document.getElementById('hifz-mode-btn');
  if (btn) {
    btn.classList.toggle('active-pill', hifzModeActive);
    btn.textContent = hifzModeActive ? '🧠 إيقاف الاختبار' : '🧠 اختبار الحفظ';
  }
  document.querySelectorAll('#ayahs-container .ayah').forEach(el => {
    el.classList.toggle('hidden-verse', hifzModeActive);
  });
  showToast(hifzModeActive ? '🧠 اضغط على أي آية لكشفها واختبار حفظك' : 'تم إظهار جميع الآيات');
}

function changeFontSize(direction) {
  currentFontSize = Math.max(1.4, Math.min(3.5, currentFontSize + direction * .15));
  document.getElementById('ayahs-container').style.fontSize = `${currentFontSize}rem`;
  localStorage.setItem('quran_font_size', String(currentFontSize));
}

function changeSpeed() {
  const speed = Number(document.getElementById('speed-select').value) || 1;
  document.getElementById('audio-player').playbackRate = speed;
  document.getElementById('ayah-audio-player').playbackRate = speed;
  localStorage.setItem('quran_playback_speed', String(speed));
}

let currentDailyInspiration = FEATURED_INSPIRATIONS[0];

function loadDailyInspiration() {
  const idx = Math.floor(Math.random() * FEATURED_INSPIRATIONS.length);
  currentDailyInspiration = FEATURED_INSPIRATIONS[idx];
  const textEl = document.getElementById('daily-ayah-text');
  const metaEl = document.getElementById('daily-ayah-meta');
  if (textEl) textEl.textContent = `﴿${currentDailyInspiration.text}﴾`;
  if (metaEl) {
    metaEl.innerHTML = `سورة ${escapeHTML(currentDailyInspiration.name)} • آية ${currentDailyInspiration.ayah} — <a href="#" onclick="event.preventDefault();openSurah(${currentDailyInspiration.surah}, '${escapeHTML(currentDailyInspiration.name)}', '', ${currentDailyInspiration.ayah})">الانتقال للآية ←</a>`;
  }
}

function openRandomSurah() {
  const num = Math.floor(Math.random() * 114) + 1;
  const found = surahsCache.find(s => s.number === num);
  openSurah(num, found ? found.name : `سورة ${num}`, found ? found.englishName : '', 1);
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getWirdState() {
  const raw = JSON.parse(localStorage.getItem('quran_wird_state') || '{}');
  const today = getTodayKey();
  if (raw.date !== today) {
    return {
      date: today,
      readToday: 0,
      goal: Number(raw.goal) || 20,
      totalRead: Number(raw.totalRead) || 0,
      completedSurahs: Array.isArray(raw.completedSurahs) ? raw.completedSurahs : []
    };
  }
  return {
    date: today,
    readToday: Number(raw.readToday) || 0,
    goal: Number(raw.goal) || 20,
    totalRead: Number(raw.totalRead) || 0,
    completedSurahs: Array.isArray(raw.completedSurahs) ? raw.completedSurahs : []
  };
}

function saveWirdState(state) {
  localStorage.setItem('quran_wird_state', JSON.stringify(state));
  updateWirdUI();
}

function addReadAyahs(count) {
  if (!count || count <= 0) return;
  const state = getWirdState();
  const prevGoalMet = state.readToday >= state.goal;
  state.readToday += count;
  state.totalRead += count;
  saveWirdState(state);
  if (!prevGoalMet && state.readToday >= state.goal) {
    showToast('🎉 ما شاء الله! أتممت وردك اليومي بنجاح');
  }
}

function markSurahAsRead() {
  const state = getWirdState();
  const count = currentAyahsData.length || 10;
  if (!state.completedSurahs.includes(currentSurahNumber)) {
    state.completedSurahs.push(currentSurahNumber);
  }
  state.readToday += count;
  state.totalRead += count;
  saveWirdState(state);
  document.getElementById('dua-box').hidden = false;
  document.getElementById('dua-box').scrollIntoView({ behavior: 'smooth' });
  showToast(`✅ تم تسجيل إتمام سورة ${currentSurahName} (+${count} آية)`);
}

function updateWirdUI() {
  const state = getWirdState();
  const pct = Math.min(100, Math.round((state.readToday / state.goal) * 100));
  const label = document.getElementById('wird-label');
  const percent = document.getElementById('wird-percent');
  const fill = document.getElementById('wird-progress-fill');
  if (label) label.textContent = `الورد اليومي: ${state.readToday} / ${state.goal} آية`;
  if (percent) percent.textContent = `${pct}%`;
  if (fill) fill.style.width = `${pct}%`;
}

function openKhatmahModal() {
  const state = getWirdState();
  document.getElementById('wird-goal-input').value = state.goal;
  const khatmahPct = Math.min(100, ((state.totalRead / 6236) * 100)).toFixed(1);
  document.getElementById('khatmah-stats').innerHTML =
    `📅 إنجاز اليوم: <b>${state.readToday}</b> من <b>${state.goal}</b> آية<br>` +
    `📖 إجمالي الآيات المقروءة: <b>${state.totalRead}</b> من 6236 آية (${khatmahPct}%)<br>` +
    `🕌 السور المكتملة: <b>${state.completedSurahs.length}</b> من 114 سورة`;
  document.getElementById('khatmah-modal').hidden = false;
}

function closeKhatmahModal() {
  document.getElementById('khatmah-modal').hidden = true;
}

function saveWirdGoal() {
  const val = Math.max(5, Math.min(1000, Number(document.getElementById('wird-goal-input').value) || 20));
  const state = getWirdState();
  state.goal = val;
  saveWirdState(state);
  openKhatmahModal();
  showToast('✅ تم تحديث هدف الورد اليومي');
}

function resetDailyWird() {
  const state = getWirdState();
  state.readToday = 0;
  saveWirdState(state);
  openKhatmahModal();
  showToast('تم تصفير عداد اليوم');
}

function getBackupPayload() {
  return {
    version: 'v23',
    exportedAt: new Date().toISOString(),
    bookmarks: getBookmarks(),
    lastRead: JSON.parse(localStorage.getItem('last_read') || 'null'),
    wird: getWirdState(),
    preferences: {
      theme: localStorage.getItem('quran_theme') || 'amoled',
      fontFamily: localStorage.getItem('quran_font_family') || '"Noto Naskh Arabic", "Amiri", serif',
      fontSize: currentFontSize,
      showInlineVerseTools: showInlineVerseTools
    }
  };
}

function openBackupModal() {
  document.getElementById('backup-json-area').value = JSON.stringify(getBackupPayload(), null, 2);
  document.getElementById('backup-modal').hidden = false;
}

function closeBackupModal() {
  document.getElementById('backup-modal').hidden = true;
}

function downloadBackupFile() {
  const dataStr = JSON.stringify(getBackupPayload(), null, 2);
  const blob = new Blob([dataStr], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `quran-backup-${getTodayKey()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  showToast('💾 تم تحميل ملف النسخة الاحتياطية');
}

async function copyBackupText() {
  const txt = document.getElementById('backup-json-area').value;
  try {
    await navigator.clipboard.writeText(txt);
    showToast('📋 تم نسخ بيانات النسخة الاحتياطية');
  } catch {
    showToast('يمكنك تحديد النص ونسخه يدويًا');
  }
}

function restoreBackupFromTextarea() {
  try {
    const raw = JSON.parse(document.getElementById('backup-json-area').value);
    if (Array.isArray(raw.bookmarks)) saveBookmarks(raw.bookmarks);
    if (raw.lastRead && raw.lastRead.surah) {
      localStorage.setItem('last_read', JSON.stringify(raw.lastRead));
      checkLastRead();
    }
    if (raw.wird && typeof raw.wird === 'object') {
      saveWirdState(raw.wird);
    }
    if (raw.preferences) {
      if (raw.preferences.theme) {
        setTheme(raw.preferences.theme);
        document.getElementById('theme-selector').value = raw.preferences.theme;
      }
      if (raw.preferences.fontFamily) {
        applyQuranFontFamily(raw.preferences.fontFamily, true);
        const fs = document.getElementById('font-family-selector');
        if (Array.from(fs.options).some(o => o.value === raw.preferences.fontFamily)) {
          fs.value = raw.preferences.fontFamily;
        }
      }
      if (typeof raw.preferences.showInlineVerseTools === 'boolean') {
        applyInlineVerseTools(raw.preferences.showInlineVerseTools);
      }
    }
    showToast('♻️ تم استعادة بياناتك بنجاح');
  } catch {
    showToast('صيغة JSON غير صحيحة، تأكد من لصق النسخة كاملة');
  }
}

function getBookmarks() {
  return JSON.parse(localStorage.getItem('quran_bookmarks') || '[]');
}

function saveBookmarks(list) {
  localStorage.setItem('quran_bookmarks', JSON.stringify(list));
  renderBookmarks();
}

function addBookmark(surah, ayah, surahName, englishName = '') {
  const list = getBookmarks();
  const exists = list.some(b => b.surah === surah && b.ayah === ayah);
  if (exists) {
    showToast('هذه الآية محفوظة بالفعل في العلامات المرجعية');
    return;
  }
  list.unshift({ surah, ayah, surahName, englishName });
  saveBookmarks(list.slice(0, 25));
  showToast(`🔖 تم حفظ العلامة: سورة ${surahName} - آية ${ayah}`);
}

function removeBookmark(index) {
  const list = getBookmarks();
  list.splice(index, 1);
  saveBookmarks(list);
}

function clearBookmarks() {
  saveBookmarks([]);
  showToast('تم مسح العلامات المرجعية');
}

function renderBookmarks() {
  const list = getBookmarks();
  const panel = document.getElementById('bookmarks-panel');
  const container = document.getElementById('bookmarks-container');
  if (!list.length) {
    panel.classList.add('hidden');
    return;
  }
  panel.classList.remove('hidden');
  container.replaceChildren();
  list.forEach((bm, idx) => {
    const chip = document.createElement('div');
    chip.className = 'bookmark-chip';
    const label = document.createElement('span');
    label.textContent = `${bm.surahName} (${bm.ayah})`;
    label.addEventListener('click', () => openSurah(bm.surah, bm.surahName, bm.englishName || '', bm.ayah));
    const del = document.createElement('button');
    del.textContent = '×';
    del.title = 'حذف العلامة';
    del.addEventListener('click', () => removeBookmark(idx));
    chip.append(label, del);
    container.append(chip);
  });
}

function saveLastRead(surah, ayah, name, englishName = '') {
  localStorage.setItem('last_read', JSON.stringify({surah, ayah, name, englishName}));
  checkLastRead();
}

function checkLastRead() {
  const saved = JSON.parse(localStorage.getItem('last_read') || 'null');
  const banner = document.getElementById('last-read-banner');
  if (!saved || !saved.surah || !saved.name) {
    banner.classList.add('hidden');
    return;
  }
  document.getElementById('last-read-title').textContent = `سورة ${saved.name}، الآية ${saved.ayah || 1}`;
  banner.classList.remove('hidden');
}

async function resumeLastRead() {
  const saved = JSON.parse(localStorage.getItem('last_read') || 'null');
  if (!saved) return;
  let englishName = saved.englishName || '';
  if (!englishName && surahsCache.length) {
    const found = surahsCache.find(s => s.number === Number(saved.surah));
    if (found) englishName = found.englishName;
  }
  await openSurah(saved.surah, saved.name, englishName, saved.ayah || 1);
}

function normalizeArabic(text) {
  return String(text || '')
    .replace(/[ً-ٰٟ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .trim();
}

function setRevelationFilter(type, btn) {
  currentRevelationFilter = type;
  document.querySelectorAll('.filter-pills button').forEach(b => b.classList.remove('active-pill'));
  if (btn) btn.classList.add('active-pill');
  renderSurahsList();
}

function filterSurahs() {
  renderSurahsList();
}

function renderSurahsList() {
  const container = document.getElementById('surahs-container');
  const query = normalizeArabic(document.getElementById('surah-filter-input')?.value || '');
  const filtered = surahsCache.filter(surah => {
    let matchesRev = true;
    if (currentRevelationFilter === 'Meccan' || currentRevelationFilter === 'Medinan') {
      matchesRev = surah.revelationType === currentRevelationFilter;
    } else if (currentRevelationFilter === 'long') {
      matchesRev = Number(surah.numberOfAyahs) >= 50;
    } else if (currentRevelationFilter === 'short') {
      matchesRev = Number(surah.numberOfAyahs) < 30;
    }
    if (!matchesRev) return false;
    if (!query) return true;
    const normName = normalizeArabic(surah.name);
    return normName.includes(query) || String(surah.number) === query || surah.englishName.toLowerCase().includes(query.toLowerCase());
  });

  container.replaceChildren();
  if (!filtered.length) {
    container.innerHTML = '<p class="muted">لا توجد سور مطابقة للتصفية الحالية.</p>';
    return;
  }
  filtered.forEach(surah => {
    const button = document.createElement('button');
    button.className = 'surah';
    button.type = 'button';

    const numBadge = document.createElement('span');
    numBadge.className = 'surah-num';
    numBadge.textContent = toArabicDigits(surah.number);

    const info = document.createElement('span');
    info.className = 'surah-info';
    info.innerHTML = `<b>${safeText(surah.name)}</b><small>${toArabicDigits(surah.numberOfAyahs)} آية • ${surah.revelationType === 'Meccan' ? 'مكية' : 'مدنية'}</small>`;

    const badge = document.createElement('span');
    badge.className = 'surah-open';
    badge.textContent = 'تلاوة ←';

    button.append(numBadge, info, badge);
    button.addEventListener('click', () => openSurah(surah.number, surah.name, surah.englishName));
    container.append(button);
  });
}

async function fetchSurahs() {
  const container = document.getElementById('surahs-container');
  try {
    const result = await fetchJSON(`${API_BASE}/surah`);
    surahsCache = result.data || [];
    renderSurahsList();
  } catch (error) {
    container.textContent = 'تعذر تحميل فهرس السور. اتصل بالإنترنت ثم أعد المحاولة.';
  }
}

async function openSurah(number, name, englishName, jumpToAyah = 1) {
  if (!Number.isInteger(Number(number)) || number < 1 || number > 114) return;
  currentSurahNumber = Number(number);
  currentSurahName = safeText(name);
  currentEnglishName = safeText(englishName);
  clearSelectedAyah();
  if (hifzModeActive) toggleHifzMode();
  document.getElementById('dua-box').hidden = true;
  document.getElementById('home-view').hidden = true;
  document.getElementById('top-tools-container').hidden = true;
  document.getElementById('reader-view').hidden = false;

  const subTitle = currentEnglishName ? `${currentEnglishName} • سورة رقم ${currentSurahNumber}` : `سورة رقم ${currentSurahNumber}`;
  document.getElementById('surah-header').innerHTML = `<h2>${escapeHTML(currentSurahName)}</h2><p class="small muted">${escapeHTML(subTitle)}</p>`;
  saveLastRead(currentSurahNumber, jumpToAyah, currentSurahName, currentEnglishName);
  updateAudio();
  await loadAyahs(jumpToAyah);
  if (isDrawerOpen()) {
    restoreReaderPanelsToReaderView();
    mountReaderPanelsIntoDrawer();
  }
  updateReadingProgress();
}

function openRandomShortSurah() {
  const shortNum = Math.floor(Math.random() * (114 - 78 + 1)) + 78;
  const found = surahsCache.find(s => s.number === shortNum);
  openSurah(shortNum, found ? found.name : `سورة ${shortNum}`, found ? found.englishName : '');
}

async function shareSurahCompletion() {
  const text = `أتممت قراءة سورة ${currentSurahName} في المصحف الإلكتروني — Mohammed saber
${SITE_URL}`;
  try {
    if (navigator.share) {
      await navigator.share({ title: `سورة ${currentSurahName}`, text, url: SITE_URL });
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      showToast('📤 تم نسخ نص الإتمام مع رابط الموقع');
    }
  } catch {}
}

function getCurrentAudioUrl() {
  const key = document.getElementById('reciter-select').value;
  const base = RECITERS[key] || RECITERS.afs;
  return `${base}${String(currentSurahNumber).padStart(3,'0')}.mp3`;
}

function updateAudio() {
  const key = document.getElementById('reciter-select').value;
  localStorage.setItem('quran_reciter', key);
  const url = getCurrentAudioUrl();
  const audio = document.getElementById('audio-player');
  audio.src = url;
  document.getElementById('download-btn').href = url;
  changeSpeed();
}

function changeReciter() { updateAudio(); }

function toggleSurahLoop() {
  const loop = document.getElementById('loop-surah-check').checked;
  document.getElementById('audio-player').loop = loop;
  showToast(loop ? '🔁 تم تفعيل تكرار السورة' : 'تم إيقاف تكرار السورة');
}

async function handleSurahEnded() {
  if (document.getElementById('loop-surah-check').checked) return;
  document.getElementById('dua-box').hidden = false;
  addReadAyahs(currentAyahsData.length || 5);
  if (sleepEndAtSurahEnd) {
    sleepEndAtSurahEnd = false;
    document.getElementById('sleep-timer-select').value = '0';
    document.getElementById('sleep-timer-status').textContent = '';
    showToast('🌙 انتهت السورة وتم إيقاف الصوت حسب مؤقت النوم');
    return;
  }
  await playNextSurah();
}

async function downloadAudio(event) {
  event.preventDefault();
  const url = getCurrentAudioUrl();
  const filename = `${String(currentSurahNumber).padStart(3,'0')}-${currentSurahName || 'surah'}.mp3`;
  showToast('جاري تجهيز ملف الصوت للتنزيل...');
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Download failed');
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
  } catch {
    window.open(url, '_blank', 'noopener');
  }
}

function highlightPlayingAyah(ayahNumber) {
  document.querySelectorAll('.ayah-wrapper.playing').forEach(el => el.classList.remove('playing'));
  const wrapper = document.getElementById(`ayah-${ayahNumber}`);
  if (wrapper) {
    wrapper.classList.add('playing');
    wrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function clearPlayingHighlight() {
  document.querySelectorAll('.ayah-wrapper.playing').forEach(el => el.classList.remove('playing'));
}

function playAyahByNumber(ayahNumber, onComplete = null) {
  document.getElementById('audio-player').pause();
  const reciterKey = document.getElementById('reciter-select').value;
  const folder = AYAH_RECITERS[reciterKey] || AYAH_RECITERS.afs;
  const surahPad = String(currentSurahNumber).padStart(3, '0');
  const ayahPad = String(ayahNumber).padStart(3, '0');
  const url = `https://everyayah.com/data/${folder}/${surahPad}${ayahPad}.mp3`;

  const ayahAudio = document.getElementById('ayah-audio-player');
  highlightPlayingAyah(ayahNumber);
  ayahAudio.src = url;
  ayahAudio.playbackRate = Number(document.getElementById('speed-select').value) || 1;

  ayahAudio.onended = () => {
    if (typeof onComplete === 'function') {
      onComplete();
    } else {
      clearPlayingHighlight();
    }
  };

  ayahAudio.play().catch(() => {
    showToast('تعذر تشغيل صوت الآية.');
    clearPlayingHighlight();
  });
}

function startContinuousReading(fromAyah = 1, toAyah = currentAyahsData.length, repeatRange = false) {
  if (!currentAyahsData.length) return;
  const start = Math.max(1, Math.min(fromAyah, currentAyahsData.length));
  const end = Math.max(start, Math.min(toAyah, currentAyahsData.length));

  playlistQueue = [];
  for (let i = start; i <= end; i++) playlistQueue.push(i);

  playlistActive = true;
  playlistRepeat = repeatRange;
  playlistIndex = 0;

  const step = () => {
    if (!playlistActive) {
      clearPlayingHighlight();
      return;
    }
    if (playlistIndex >= playlistQueue.length) {
      if (playlistRepeat) {
        playlistIndex = 0;
      } else {
        playlistActive = false;
        clearPlayingHighlight();
        return;
      }
    }
    const currentNum = playlistQueue[playlistIndex++];
    playAyahByNumber(currentNum, step);
  };

  step();
}

function playRangeFromInputs() {
  const fromVal = Number(document.getElementById('range-from').value) || 1;
  const toVal = Number(document.getElementById('range-to').value) || currentAyahsData.length;
  const repeat = Boolean(document.getElementById('range-repeat-check').checked);
  startContinuousReading(fromVal, toVal, repeat);
  showToast(`▶️ تشغيل النطاق من الآية ${fromVal} إلى ${toVal}`);
}

function startFromSelectedAyah() {
  if (!selectedAyahObj) return;
  startContinuousReading(selectedAyahObj.numberInSurah, currentAyahsData.length, false);
}

function stopContinuousReading() {
  playlistActive = false;
  playlistRepeat = false;
  const ayahAudio = document.getElementById('ayah-audio-player');
  if (ayahAudio) {
    ayahAudio.onended = null;
    ayahAudio.pause();
  }
  clearPlayingHighlight();
}

function playSelectedAyah(repeatCount = 1) {
  if (!selectedAyahObj) return;
  playlistActive = false;
  document.getElementById('audio-player').pause();
  const reciterKey = document.getElementById('reciter-select').value;
  const folder = AYAH_RECITERS[reciterKey] || AYAH_RECITERS.afs;
  const surahPad = String(currentSurahNumber).padStart(3, '0');
  const ayahPad = String(selectedAyahObj.numberInSurah).padStart(3, '0');
  const url = `https://everyayah.com/data/${folder}/${surahPad}${ayahPad}.mp3`;

  const ayahAudio = document.getElementById('ayah-audio-player');
  ayahRepeatRemaining = Math.max(0, repeatCount - 1);
  highlightPlayingAyah(selectedAyahObj.numberInSurah);
  ayahAudio.src = url;
  ayahAudio.playbackRate = Number(document.getElementById('speed-select').value) || 1;
  ayahAudio.onended = () => {
    if (ayahRepeatRemaining > 0) {
      ayahRepeatRemaining--;
      ayahAudio.currentTime = 0;
      ayahAudio.play().catch(() => {});
    } else {
      clearPlayingHighlight();
    }
  };
  ayahAudio.play()
    .then(() => showToast(repeatCount > 1 ? `🔁 تكرار الآية ${selectedAyahObj.numberInSurah} (${repeatCount} مرات)` : `🔊 تلاوة الآية ${selectedAyahObj.numberInSurah}`))
    .catch(() => {
      clearPlayingHighlight();
      showToast('تعذر تشغيل صوت الآية. تحقق من الاتصال بالإنترنت.');
    });
}

function selectAyah(ayahObj, wrapperEl) {
  document.querySelectorAll('.ayah-wrapper.selected').forEach(el => el.classList.remove('selected'));
  wrapperEl.classList.add('selected');
  selectedAyahObj = ayahObj;
  document.getElementById('selected-ayah-label').textContent = `سورة ${currentSurahName} • الآية ${ayahObj.numberInSurah}`;
  document.getElementById('ayah-action-bar').classList.remove('hidden');
  saveLastRead(currentSurahNumber, ayahObj.numberInSurah, currentSurahName, currentEnglishName);
}

function clearSelectedAyah() {
  stopContinuousReading();
  document.querySelectorAll('.ayah-wrapper.selected').forEach(el => el.classList.remove('selected'));
  selectedAyahObj = null;
  const bar = document.getElementById('ayah-action-bar');
  if (bar) bar.classList.add('hidden');
}

function showSelectedTafsir() {
  if (selectedAyahObj) showTafsir(currentSurahNumber, selectedAyahObj.numberInSurah);
}

function bookmarkSelectedAyah() {
  if (selectedAyahObj) addBookmark(currentSurahNumber, selectedAyahObj.numberInSurah, currentSurahName, currentEnglishName);
}

function copySelectedAyah() {
  if (selectedAyahObj) copyAyah(selectedAyahObj.cleanText, currentSurahName, selectedAyahObj.numberInSurah);
}

function openAyahCardModal() {
  if (!selectedAyahObj) return;
  document.getElementById('card-modal').hidden = false;
  refreshSelectedAyahCard();
}

function refreshSelectedAyahCard() {
  if (!selectedAyahObj) return;
  const bgTheme = document.getElementById('card-bg-select')?.value || 'emerald';
  drawAyahCard(selectedAyahObj.cleanText, currentSurahName, selectedAyahObj.numberInSurah, bgTheme);
}

function closeAyahCardModal() {
  document.getElementById('card-modal').hidden = true;
}

function drawAyahCard(verseText, surahName, ayahNum, bgStyle = 'emerald') {
  const canvas = document.getElementById('card-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;

  const grad = ctx.createLinearGradient(0, 0, w, h);
  let textColor = '#f8fafc';
  let accentColor = '#fbbf24';
  let subColor = '#a7f3d0';

  if (bgStyle === 'midnight') {
    grad.addColorStop(0, '#090d16');
    grad.addColorStop(0.55, '#111827');
    grad.addColorStop(1, '#05080f');
  } else if (bgStyle === 'warm') {
    grad.addColorStop(0, '#fdf8ee');
    grad.addColorStop(0.55, '#f5ebd6');
    grad.addColorStop(1, '#efe2c6');
    textColor = '#1c1917';
    accentColor = '#b45309';
    subColor = '#047857';
  } else {
    grad.addColorStop(0, '#022c22');
    grad.addColorStop(0.55, '#064e3b');
    grad.addColorStop(1, '#042f24');
  }

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 4;
  ctx.strokeRect(24, 24, w - 48, h - 48);

  ctx.strokeStyle = bgStyle === 'warm' ? 'rgba(4,120,87,0.3)' : 'rgba(52, 211, 153, 0.35)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(34, 34, w - 68, h - 68);

  ctx.fillStyle = accentColor;
  ctx.font = 'bold 28px "Cairo", Tahoma, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.direction = 'rtl';
  ctx.fillText(`سورة ${surahName} • آية ${toArabicDigits(ayahNum)}`, w / 2, 92);

  ctx.fillStyle = textColor;
  const activeQuranFont = getComputedStyle(document.documentElement).getPropertyValue('--quran-font').trim() || '"Noto Naskh Arabic", "Amiri", serif';
  ctx.font = `bold 39px ${activeQuranFont}`;
  const maxWidth = w - 120;
  const words = String(verseText || '').split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);

  const lineHeight = 60;
  const startY = Math.max(155, (h - lines.length * lineHeight) / 2);
  lines.slice(0, 6).forEach((ln, idx) => {
    ctx.fillText(ln, w / 2, startY + idx * lineHeight);
  });

  ctx.fillStyle = subColor;
  ctx.font = '18px "Cairo", Tahoma, Arial, sans-serif';
  ctx.fillText('المصحف الإلكتروني المتكامل — Mohammed saber', w / 2, h - 76);

  ctx.fillStyle = accentColor;
  ctx.font = '15px Tahoma, Arial, sans-serif';
  ctx.fillText(SITE_URL, w / 2, h - 48);
}

function downloadAyahCard() {
  const canvas = document.getElementById('card-canvas');
  if (!canvas || !selectedAyahObj) return;
  const link = document.createElement('a');
  link.download = `ayah-${currentSurahNumber}-${selectedAyahObj.numberInSurah}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
  showToast('💾 تم حفظ بطاقة الآية كصورة');
}

async function shareAyahTextLink() {
  if (!selectedAyahObj) return;
  const payload = `﴿${selectedAyahObj.cleanText}﴾ [سورة ${currentSurahName} - آية ${selectedAyahObj.numberInSurah}]
${SITE_URL}`;
  try {
    if (navigator.share) {
      await navigator.share({ title: `سورة ${currentSurahName}`, text: payload, url: SITE_URL });
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(payload);
      showToast('🔗 تم نسخ الآية مع رابط الموقع للمشاركة');
    }
  } catch {}
}

function buildPageJumpBar(pagesList) {
  const bar = document.getElementById('page-jump-bar');
  if (!bar) return;
  bar.replaceChildren();
  if (!pagesList || pagesList.length <= 1) {
    bar.hidden = true;
    return;
  }
  bar.hidden = false;
  const title = document.createElement('span');
  title.className = 'small muted';
  title.style.flexShrink = '0';
  title.style.fontWeight = '700';
  title.textContent = 'صفحات السورة:';
  bar.append(title);

  pagesList.forEach((pageNum, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `page-jump-btn${idx === 0 ? ' active-page' : ''}`;
    btn.dataset.page = String(pageNum);
    btn.textContent = `ص ${toArabicDigits(pageNum)}`;
    btn.addEventListener('click', () => {
      const targetBlock = document.getElementById(`mushaf-page-${pageNum}`);
      if (targetBlock) {
        targetBlock.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      bar.querySelectorAll('.page-jump-btn').forEach(b => b.classList.remove('active-page'));
      btn.classList.add('active-page');
    });
    bar.append(btn);
  });
}

async function loadAyahs(jumpToAyah = 1) {
  const container = document.getElementById('ayahs-container');
  container.textContent = 'جاري تحميل الآيات...';
  try {
    const mode = document.getElementById('mode-selector').value;
    const tajweedMode = mode === 'tajweed';
    applyDisplayModeStyles(mode);

    const endpoint = tajweedMode
      ? `${API_BASE}/surah/${currentSurahNumber}/quran-tajweed`
      : `${API_BASE}/surah/${currentSurahNumber}`;

    const result = await fetchJSON(endpoint);
    container.replaceChildren();
    const ayahs = result.data.ayahs || [];
    if (tajweedMode && (!ayahs.length || !ayahs[0].text || !/(?:\[[a-z](?::[^\[]*)?\[|<tajweed )/i.test(ayahs[0].text))) {
      throw new Error('Tajweed edition returned no verse text');
    }
    currentAyahsData = [];
    const rangeToInput = document.getElementById('range-to');
    if (rangeToInput) {
      rangeToInput.max = ayahs.length;
      rangeToInput.value = Math.min(5, ayahs.length);
    }

    const pageGroups = [];
    let currentGroup = null;

    ayahs.forEach(ayah => {
      const cleanAyahText = tajweedMode ? stripTajweedMarkers(ayah.text) : ayah.text;
      const ayahRecord = { numberInSurah: ayah.numberInSurah, cleanText: cleanAyahText, page: ayah.page || 1 };
      currentAyahsData.push(ayahRecord);

      const pageNum = ayah.page || 1;
      if (!currentGroup || currentGroup.page !== pageNum) {
        currentGroup = { page: pageNum, items: [] };
        pageGroups.push(currentGroup);
      }
      currentGroup.items.push({ ayah, ayahRecord });
    });

    buildPageJumpBar(pageGroups.map(g => g.page));

    pageGroups.forEach(group => {
      const pageBlock = document.createElement('div');
      pageBlock.className = 'mushaf-page-block';
      pageBlock.id = `mushaf-page-${group.page}`;

      group.items.forEach(({ ayah, ayahRecord }) => {
        const wrapper = document.createElement('span');
        wrapper.className = 'ayah-wrapper';
        wrapper.id = `ayah-${ayah.numberInSurah}`;

        const span = document.createElement('span');
        span.className = 'ayah';
        if (tajweedMode) {
          span.innerHTML = renderTajweedText(ayah.text);
          span.classList.add('tajweed-ayah');
        } else {
          span.textContent = ayah.text;
          span.classList.remove('tajweed-ayah');
        }
        if (hifzModeActive) span.classList.add('hidden-verse');
        span.addEventListener('click', () => {
          if (hifzModeActive && span.classList.contains('hidden-verse')) {
            span.classList.remove('hidden-verse');
            addReadAyahs(1);
          }
          selectAyah(ayahRecord, wrapper);
        });

        const number = document.createElement('span');
        number.className = 'number';
        number.textContent = `﴿${toArabicDigits(ayah.numberInSurah)}﴾`;
        number.title = `الآية ${ayah.numberInSurah}`;
        number.addEventListener('click', () => selectAyah(ayahRecord, wrapper));

        const controls = document.createElement('span');
        controls.className = 'ayah-tools';
        const tafsir = document.createElement('button');
        tafsir.textContent = 'تفسير';
        tafsir.addEventListener('click', (e) => {
          e.stopPropagation();
          saveLastRead(currentSurahNumber, ayah.numberInSurah, currentSurahName, currentEnglishName);
          showTafsir(currentSurahNumber, ayah.numberInSurah);
        });
        const copy = document.createElement('button');
        copy.textContent = '📋';
        copy.title = 'نسخ الآية';
        copy.addEventListener('click', (e) => {
          e.stopPropagation();
          saveLastRead(currentSurahNumber, ayah.numberInSurah, currentSurahName, currentEnglishName);
          copyAyah(ayahRecord.cleanText, currentSurahName, ayah.numberInSurah);
        });

        controls.append(tafsir, copy);
        wrapper.append(span, number, controls);
        pageBlock.append(wrapper, document.createTextNode(' '));
      });

      const pageFooter = document.createElement('div');
      pageFooter.className = 'mushaf-page-footer';
      pageFooter.textContent = `صفحة ${toArabicDigits(group.page)}`;
      pageBlock.append(pageFooter);

      container.append(pageBlock);
    });

    const target = document.getElementById(`ayah-${jumpToAyah}`);
    if (target) setTimeout(() => target.scrollIntoView({behavior:'smooth', block:'center'}), 80);
  } catch (error) {
    container.textContent = document.getElementById('mode-selector').value === 'tajweed'
      ? 'تعذر تحميل نص التجويد الملوّن حاليًا. جرّب النص القرآني العادي أو أعد المحاولة مع الاتصال بالإنترنت.'
      : 'تعذر تحميل الآيات. تحقق من الإنترنت أو احفظ السور مسبقًا للعمل دون اتصال.';
  }
}

async function copyAyah(text, surahName, ayahNumber) {
  const value = `${text} [سورة ${surahName} - آية ${ayahNumber}]`;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
    } else {
      const area = document.createElement('textarea');
      area.value = value; document.body.append(area); area.select();
      const ok = document.execCommand('copy'); area.remove();
      if (!ok) throw new Error('copy failed');
    }
    showToast('✅ تم نسخ الآية بنجاح');
  } catch {
    showToast('تعذر النسخ تلقائيًا. يمكنك تحديد الآية ونسخها يدويًا.');
  }
}

async function showTafsir(surah, ayah) {
  const modal = document.getElementById('tafsir-modal');
  const output = document.getElementById('tafsir-text');
  modal.hidden = false;
  output.textContent = 'جاري تحميل التفسير...';
  try {
    const result = await fetchJSON(`${API_BASE}/ayah/${surah}:${ayah}/editions/ar.muyassar`);
    output.textContent = result.data[0].text;
  } catch {
    output.textContent = 'تعذر تحميل التفسير. يلزم الاتصال بالإنترنت أول مرة.';
  }
}

function closeTafsir() { document.getElementById('tafsir-modal').hidden = true; }

async function searchQuran() {
  const query = document.getElementById('search-input').value.trim();
  const box = document.getElementById('search-results');
  if (!query) { box.hidden = true; return; }
  box.hidden = false; box.textContent = 'جاري البحث...';
  try {
    const result = await fetchJSON(`${API_BASE}/search/${encodeURIComponent(query)}/all/ar`);
    box.replaceChildren();
    const matches = result.data?.matches || [];
    if (!matches.length) { box.textContent = 'لا توجد نتائج.'; return; }
    const heading = document.createElement('p');
    heading.textContent = `النتائج: ${result.data.count}`;
    box.append(heading);
    matches.slice(0,30).forEach(match => {
      const item = document.createElement('div');
      item.className = 'result';
      const title = document.createElement('b');
      title.textContent = `سورة ${match.surah.name} • آية ${match.numberInSurah}`;
      const verse = document.createElement('p');
      verse.textContent = match.text;
      item.append(title, verse);
      item.addEventListener('click', () => openSurah(match.surah.number, match.surah.name, match.surah.englishName, match.numberInSurah));
      box.append(item);
    });
  } catch {
    box.textContent = 'تعذر البحث. البحث يحتاج إلى اتصال بالإنترنت.';
  }
}

async function playNextSurah() {
  if (currentSurahNumber >= 114) return;
  try {
    const next = await fetchJSON(`${API_BASE}/surah/${currentSurahNumber + 1}`);
    await openSurah(currentSurahNumber + 1, next.data.name, next.data.englishName);
    const audio = document.getElementById('audio-player');
    try { await audio.play(); } catch {}
  } catch { showToast('تعذر تحميل السورة التالية.'); }
}

async function downloadQuranOffline() {
  if (!('caches' in window) || !('serviceWorker' in navigator)) {
    showToast('الحفظ دون إنترنت يحتاج إلى متصفح حديث واتصال HTTPS أو localhost.');
    return;
  }
  const button = document.getElementById('offline-quran-btn');
  const progress = document.getElementById('offline-progress');
  button.disabled = true;
  let completed = 0;
  try {
    const cache = await caches.open(CACHE_NAME);
    const listURL = `${API_BASE}/surah`;
    const listResponse = await fetch(listURL);
    if (!listResponse.ok) throw new Error('تعذر تحميل الفهرس');
    await cache.put(listURL, listResponse.clone());
    const listData = await listResponse.json();
    for (const surah of listData.data) {
      const url = `${API_BASE}/surah/${surah.number}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`فشل تحميل السورة ${surah.number}`);
      await cache.put(url, response.clone());
      try {
        const tajweedURL = `${API_BASE}/surah/${surah.number}/quran-tajweed`;
        const tajweedResponse = await fetch(tajweedURL);
        if (tajweedResponse.ok) await cache.put(tajweedURL, tajweedResponse.clone());
      } catch (tajweedError) {}
      completed++;
      progress.textContent = `تم حفظ ${completed} من 114 سورة`;
    }
    progress.textContent = '✅ تم حفظ نص القرآن كاملًا. الصوت والتفسير والبحث تحتاج اتصالًا عند عدم تخزينها مسبقًا.';
    button.textContent = '✅ النص محفوظ دون إنترنت';
  } catch (error) {
    progress.textContent = `تعذر إكمال الحفظ (${completed}/114). تحقق من الاتصال ثم أعد المحاولة.`;
    button.textContent = '🔄 إعادة المحاولة';
  } finally { button.disabled = false; }
}

function goHome() {
  closeSideDrawer();
  clearSelectedAyah();
  if (hifzModeActive) toggleHifzMode();
  document.getElementById('reader-view').hidden = true;
  document.getElementById('home-view').hidden = false;
  document.getElementById('top-tools-container').hidden = false;
  document.getElementById('audio-player').pause();
  document.getElementById('search-results').hidden = true;
  document.getElementById('search-input').value = '';
  document.getElementById('reading-progress').style.width = '0%';
  window.scrollTo({top:0,behavior:'smooth'});
}

function updateReadingProgress() {
  const bar = document.getElementById('reading-progress');
  if (!bar || document.getElementById('reader-view').hidden) {
    if (bar) bar.style.width = '0%';
    return;
  }
  const scrollTop = window.scrollY || document.documentElement.scrollTop;
  const docHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
  const pct = docHeight > 0 ? Math.min(100, Math.max(0, (scrollTop / docHeight) * 100)) : 0;
  bar.style.width = `${pct}%`;

  const blocks = document.querySelectorAll('.mushaf-page-block');
  if (blocks.length) {
    let activePage = null;
    for (const blk of blocks) {
      const rect = blk.getBoundingClientRect();
      if (rect.top <= window.innerHeight * 0.45) {
        activePage = blk.id.replace('mushaf-page-', '');
      }
    }
    if (activePage) {
      document.querySelectorAll('#page-jump-bar .page-jump-btn').forEach(btn => {
        btn.classList.toggle('active-page', btn.dataset.page === activePage);
      });
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const theme = localStorage.getItem('quran_theme') || 'amoled';
  document.getElementById('theme-selector').value = theme;
  setTheme(theme);

  const fontSel = document.getElementById('font-family-selector');
  const savedFont = localStorage.getItem('quran_font_family');
  if (savedFont && Array.from(fontSel.options).some(o => o.value === savedFont)) {
    fontSel.value = savedFont;
  }
  applyQuranFontFamily(fontSel.value, false);
  applyInlineVerseTools(showInlineVerseTools);

  const savedReciter = localStorage.getItem('quran_reciter');
  if (savedReciter && RECITERS[savedReciter]) {
    document.getElementById('reciter-select').value = savedReciter;
  }

  const savedSpeed = localStorage.getItem('quran_playback_speed');
  if (savedSpeed) {
    document.getElementById('speed-select').value = savedSpeed;
  }

  const rawSavedMode = localStorage.getItem('quran_mode') || 'text';
  const savedMode = rawSavedMode === 'tajweed' ? 'tajweed' : 'text';
  localStorage.setItem('quran_mode', savedMode);
  document.getElementById('mode-selector').value = savedMode;
  applyDisplayModeStyles(savedMode);
  const isInitialTajweed = savedMode === 'tajweed';
  document.getElementById('tajweed-note').hidden = !isInitialTajweed;
  document.getElementById('tajweed-legend').hidden = !isInitialTajweed;

  document.getElementById('theme-selector').addEventListener('change', e => changeTheme(e.target.value));

  fontSel.addEventListener('change', e => {
    applyQuranFontFamily(e.target.value, true);
    showToast(`✍️ تم تغيير الخط القرآني إلى: ${e.target.options[e.target.selectedIndex].text}`);
  });

  document.getElementById('mode-selector').addEventListener('change', () => {
    const mode = document.getElementById('mode-selector').value;
    localStorage.setItem('quran_mode', mode);
    applyDisplayModeStyles(mode);
    const isTajweed = mode === 'tajweed';
    document.getElementById('tajweed-note').hidden = !isTajweed;
    document.getElementById('tajweed-legend').hidden = !isTajweed;
    if (!document.getElementById('reader-view').hidden && currentSurahNumber) {
      loadAyahs(1).then(() => {
        if (isDrawerOpen()) mountReaderPanelsIntoDrawer();
      });
    }
  });

  document.getElementById('tafsir-modal').addEventListener('click', e => {
    if (e.target.id === 'tafsir-modal') closeTafsir();
  });
  document.getElementById('khatmah-modal').addEventListener('click', e => {
    if (e.target.id === 'khatmah-modal') closeKhatmahModal();
  });
  document.getElementById('card-modal').addEventListener('click', e => {
    if (e.target.id === 'card-modal') closeAyahCardModal();
  });
  document.getElementById('backup-modal').addEventListener('click', e => {
    if (e.target.id === 'backup-modal') closeBackupModal();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (!document.getElementById('tafsir-modal').hidden) closeTafsir();
      if (!document.getElementById('khatmah-modal').hidden) closeKhatmahModal();
      if (!document.getElementById('card-modal').hidden) closeAyahCardModal();
      if (!document.getElementById('backup-modal').hidden) closeBackupModal();
      if (isDrawerOpen()) closeSideDrawer();
      clearSelectedAyah();
    }
    if (e.code === 'Space' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
      if (!document.getElementById('reader-view').hidden) {
        e.preventDefault();
        const audio = document.getElementById('audio-player');
        if (audio.paused) audio.play().catch(() => {});
        else audio.pause();
      }
    }
  });

  window.addEventListener('scroll', updateReadingProgress, { passive: true });

  document.getElementById('ayahs-container').style.fontSize = `${currentFontSize}rem`;
  loadDailyInspiration();
  checkLastRead();
  renderBookmarks();
  updateWirdUI();
  fetchSurahs();
  document.getElementById('search-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') searchQuran();
  });
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(err => console.error('Service worker:', err));
  }
});


function isDrawerOpen() {
  const drawer = document.getElementById('side-drawer');
  return Boolean(drawer && !drawer.hidden);
}

function makeDrawerGroupCard(labelText, childNodes) {
  const box = document.createElement('div');
  box.className = 'drawer-group-box';
  const lbl = document.createElement('div');
  lbl.className = 'drawer-section-label';
  lbl.textContent = labelText;
  box.appendChild(lbl);
  childNodes.forEach(node => {
    if (node) box.appendChild(node);
  });
  return box;
}

const DRAWER_MOVED_SLOTS = {
  audioRow: null,
  displayRow: null,
  modesRow: null,
  timerStatus: null,
  rangePanel: null,
  hintTip: null
};

function captureDrawerSlots() {
  const controlsPanel = document.getElementById('reader-controls-panel');
  if (!controlsPanel) return;

  if (!DRAWER_MOVED_SLOTS.audioRow) {
    DRAWER_MOVED_SLOTS.audioRow = document.getElementById('reciter-select')?.closest('.row') || null;
  }
  if (!DRAWER_MOVED_SLOTS.displayRow) {
    DRAWER_MOVED_SLOTS.displayRow = document.getElementById('speed-select')?.closest('.row') || null;
  }
  if (!DRAWER_MOVED_SLOTS.modesRow) {
    DRAWER_MOVED_SLOTS.modesRow = document.getElementById('hifz-mode-btn')?.closest('.row') || null;
  }
  if (!DRAWER_MOVED_SLOTS.timerStatus) {
    DRAWER_MOVED_SLOTS.timerStatus = document.getElementById('sleep-timer-status');
  }
  if (!DRAWER_MOVED_SLOTS.rangePanel) {
    DRAWER_MOVED_SLOTS.rangePanel = document.getElementById('range-player-panel');
  }
  if (!DRAWER_MOVED_SLOTS.hintTip) {
    DRAWER_MOVED_SLOTS.hintTip = controlsPanel.querySelector('p.small.muted:not(#sleep-timer-status)');
  }
}

function mountReaderPanelsIntoDrawer() {
  const body = document.getElementById('drawer-dynamic-body');
  const controlsPanel = document.getElementById('reader-controls-panel');
  if (!body || !controlsPanel) return;

  captureDrawerSlots();
  restoreReaderPanelsToReaderView();
  body.replaceChildren();

  controlsPanel.classList.remove('hidden');
  controlsPanel.hidden = false;

  const { audioRow, displayRow, modesRow, timerStatus, rangePanel, hintTip } = DRAWER_MOVED_SLOTS;

  const audioCard = makeDrawerGroupCard('🎧 التلاوة والصوت', [audioRow]);
  const displayCard = makeDrawerGroupCard('🔤 الخط والسرعة والمؤقت', [displayRow, timerStatus]);
  const modesCard = makeDrawerGroupCard('🧭 أوضاع القراءة والنطاق', [modesRow, rangePanel, hintTip]);

  body.appendChild(controlsPanel);
  [audioCard, displayCard, modesCard].forEach(card => {
    if (card.children.length > 1) body.appendChild(card);
  });

  const extraIds = ['page-jump-bar', 'tajweed-note', 'tajweed-legend'];
  extraIds.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('hidden');
    if (id === 'tajweed-note' || id === 'tajweed-legend') {
      const isTajweed = document.getElementById('mode-selector')?.value === 'tajweed';
      el.hidden = !isTajweed;
    } else if (id === 'page-jump-bar') {
      const hasPages = el.querySelectorAll('.page-jump-btn').length > 1;
      el.hidden = !hasPages;
    } else {
      el.hidden = false;
    }
    if (!el.hidden) {
      const wrap = makeDrawerGroupCard(
        id === 'page-jump-bar' ? '📑 صفحات السورة' : '🎨 دليل التجويد',
        [el]
      );
      body.appendChild(wrap);
    }
  });
}

function restoreReaderPanelsToReaderView() {
  const readerView = document.getElementById('reader-view');
  const ayahsContainer = document.getElementById('ayahs-container');
  const controlsPanel = document.getElementById('reader-controls-panel');
  if (!readerView || !ayahsContainer || !controlsPanel) return;

  captureDrawerSlots();
  const { audioRow, displayRow, modesRow, timerStatus, rangePanel, hintTip } = DRAWER_MOVED_SLOTS;

  if (audioRow) controlsPanel.appendChild(audioRow);
  if (displayRow) controlsPanel.appendChild(displayRow);
  if (modesRow) controlsPanel.appendChild(modesRow);
  if (timerStatus) controlsPanel.appendChild(timerStatus);
  if (rangePanel) controlsPanel.appendChild(rangePanel);
  if (hintTip) controlsPanel.appendChild(hintTip);

  const bodyEl = document.getElementById('drawer-dynamic-body');
  if (bodyEl) bodyEl.replaceChildren();

  controlsPanel.hidden = true;
  readerView.insertBefore(controlsPanel, ayahsContainer);

  const pageBar = document.getElementById('page-jump-bar');
  if (pageBar) {
    readerView.insertBefore(pageBar, ayahsContainer);
    pageBar.hidden = pageBar.querySelectorAll('.page-jump-btn').length <= 1;
  }

  const isTajweed = document.getElementById('mode-selector')?.value === 'tajweed';
  ['tajweed-note', 'tajweed-legend'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    readerView.insertBefore(el, ayahsContainer);
    el.hidden = !isTajweed;
  });
}

function openSideDrawer() {
  const drawer = document.getElementById('side-drawer');
  const backdrop = document.getElementById('side-drawer-backdrop');
  if (!drawer || !backdrop) return;
  mountReaderPanelsIntoDrawer();
  drawer.hidden = false;
  backdrop.hidden = false;
}

function closeSideDrawer() {
  const drawer = document.getElementById('side-drawer');
  const backdrop = document.getElementById('side-drawer-backdrop');
  restoreReaderPanelsToReaderView();
  if (drawer) drawer.hidden = true;
  if (backdrop) backdrop.hidden = true;
}

function toggleSideDrawer() {
  if (isDrawerOpen()) closeSideDrawer();
  else openSideDrawer();
}


async function copyCurrentSurahText() {
  if (!currentAyahsData.length) {
    showToast('افتح سورة أولًا لنسخ نصها');
    return;
  }
  const bodyText = currentAyahsData
    .map(a => `${a.cleanText} ﴿${toArabicDigits(a.numberInSurah)}﴾`)
    .join(' ');
  const full = `سورة ${currentSurahName}

${bodyText}`;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(full);
    } else {
      const area = document.createElement('textarea');
      area.value = full;
      document.body.append(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      if (!ok) throw new Error('copy failed');
    }
    showToast(`✅ تم نسخ سورة ${currentSurahName} بالكامل`);
  } catch {
    showToast('تعذر النسخ التلقائي على هذا المتصفح');
  }
}

function scrollReaderTo(pos) {
  closeSideDrawer();
  if (pos === 'top') {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
  }
}

(() => {
  const modal = document.querySelector('[data-game-modal]');
  if (!modal) return;

  const stage = modal.querySelector('[data-game-stage]');
  const titleEl = modal.querySelector('[data-game-title]');
  const modeEl = modal.querySelector('[data-game-mode]');
  const scoreEl = modal.querySelector('[data-game-score]');
  const streakEl = modal.querySelector('[data-game-streak]');
  const timerWrap = modal.querySelector('[data-game-timer-wrap]');
  const timerEl = modal.querySelector('[data-game-timer]');
  const progressEl = modal.querySelector('[data-game-progress]');
  const STORAGE_KEY = 'scottishAeroGamesV1';
  let activeCleanup = null;
  let activeAnswerButtons = [];

  const state = loadState();

  function loadState() {
    try {
      return Object.assign({ xp: 0, bestStreak: 0, completed: 0, bests: {}, unlocked: [] }, JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'));
    } catch {
      return { xp: 0, bestStreak: 0, completed: 0, bests: {}, unlocked: [] };
    }
  }
  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    refreshStats();
    renderAchievements();
  }
  function refreshStats() {
    document.querySelectorAll('[data-lifetime-xp]').forEach(el => el.textContent = String(state.xp || 0).padStart(4, '0'));
    document.querySelectorAll('[data-best-streak]').forEach(el => el.textContent = state.bestStreak || 0);
    document.querySelectorAll('[data-games-completed]').forEach(el => el.textContent = state.completed || 0);
  }

  const achievements = [
    { id: 'first', name: 'Cleared for Take-off', text: 'Complete your first game.', check: () => state.completed >= 1 },
    { id: 'streak5', name: 'Five on Final', text: 'Reach a 5-answer streak.', check: () => state.bestStreak >= 5 },
    { id: 'streak10', name: 'Ten Thousand Feet', text: 'Reach a 10-answer streak.', check: () => state.bestStreak >= 10 },
    { id: 'xp500', name: 'Frequent Flyer', text: 'Earn 500 lifetime XP.', check: () => state.xp >= 500 },
    { id: 'allrounder', name: 'Type Rated', text: 'Play all six Games Lab challenges.', check: () => ['logos','models','codes','makers','regs','wingspan'].every(id => (state.bests[id] || {}).played) },
    { id: 'perfect', name: 'No Go-around', text: 'Score 100% in a round-based quiz.', check: () => Object.values(state.bests).some(x => x && x.perfect) }
  ];

  function renderAchievements() {
    const holder = document.querySelector('[data-achievements]');
    if (!holder) return;
    achievements.forEach(a => { if (a.check() && !state.unlocked.includes(a.id)) state.unlocked.push(a.id); });
    holder.innerHTML = achievements.map((a, i) => {
      const unlocked = state.unlocked.includes(a.id);
      return `<article class="achievement ${unlocked ? 'is-unlocked' : ''}" data-reveal style="--delay:${i * 45}ms"><span class="achievement__icon">${unlocked ? '✦' : '○'}</span><div><b>${a.name}</b><p>${a.text}</p></div><em>${unlocked ? 'UNLOCKED' : 'LOCKED'}</em></article>`;
    }).join('');
  }

  const logoQuestions = [
    { answer:'Emirates', color:'#d71920', mark:`<svg viewBox="0 0 240 140"><path d="M73 111c18-42 35-71 61-94-7 29-8 55-3 79 13-16 27-28 43-37-11 22-16 40-15 53H73Z"/><path d="M62 116h122"/></svg>` },
    { answer:'British Airways', color:'#d7193f', mark:`<svg viewBox="0 0 240 140"><path d="M36 82c45-31 91-45 167-43-33 8-65 22-91 43 33-5 61-2 92 12-55-5-104 4-168 23 23-15 42-26 59-33-20 2-39 2-59-2Z"/></svg>` },
    { answer:'Lufthansa', color:'#f7c600', mark:`<svg viewBox="0 0 240 140"><circle cx="120" cy="70" r="49"/><path class="cut" d="M107 98c6-28 15-47 38-64-5 16-7 29-4 41 9 1 18 4 27 10-17-1-31 2-43 9l-18 4Z"/></svg>` },
    { answer:'KLM', color:'#38a9e0', mark:`<svg viewBox="0 0 240 140"><path d="M70 90h100v21H70z"/><circle cx="85" cy="60" r="8"/><circle cx="120" cy="52" r="8"/><circle cx="155" cy="60" r="8"/><path d="M78 73h84v12H78z"/><path d="M116 29h8v15h-8z"/></svg>` },
    { answer:'Qatar Airways', color:'#7a1730', mark:`<svg viewBox="0 0 240 140"><path d="M64 106c19-51 45-78 85-82-17 11-28 24-34 39 20-10 39-13 61-10-22 10-37 22-48 39 20-4 35-3 48 3-33 3-63 7-112 11Z"/></svg>` },
    { answer:'easyJet', color:'#ff6600', mark:`<svg viewBox="0 0 240 140"><path d="M45 93 195 48l-7 20L57 112Z"/><circle cx="76" cy="92" r="9"/><circle cx="166" cy="66" r="9"/></svg>` },
    { answer:'Ryanair', color:'#f1c933', mark:`<svg viewBox="0 0 240 140"><path d="M67 105c22-48 41-72 65-80-6 18-5 35 3 50 12-9 28-13 47-12-25 11-43 26-58 45-18-2-37-3-57-3Z"/><path d="M126 44 91 30l31 27Z"/></svg>` },
    { answer:'Turkish Airlines', color:'#e31837', mark:`<svg viewBox="0 0 240 140"><circle cx="120" cy="70" r="50"/><path class="cut" d="M87 47c25 2 45 13 61 34-15-6-29-7-42-4 9 12 14 24 15 38-13-19-25-32-40-39-8-7-6-17 6-29Z"/></svg>` },
    { answer:'Delta Air Lines', color:'#d71920', mark:`<svg viewBox="0 0 240 140"><path d="m120 24 52 88-52-23-52 23Z"/><path class="cut" d="m120 54 19 33-19-8-19 8Z"/></svg>` },
    { answer:'Icelandair', color:'#55b6e7', mark:`<svg viewBox="0 0 240 140"><path d="M62 105 112 28h22L88 105Z"/><path d="M120 105 151 55h25l-29 50Z"/><circle cx="170" cy="38" r="12"/></svg>` }
  ];

  const logoOptions = logoQuestions.map(q => q.answer);

  const planeQuestions = [
    { answer:'Airbus A380', svg: planeSvg('a380') },
    { answer:'Boeing 747', svg: planeSvg('b747') },
    { answer:'Concorde', svg: planeSvg('concorde') },
    { answer:'Airbus A350', svg: planeSvg('a350') },
    { answer:'Boeing 787', svg: planeSvg('b787') },
    { answer:'Boeing 737 MAX', svg: planeSvg('b737') },
    { answer:'Airbus A321', svg: planeSvg('a321') },
    { answer:'ATR 72', svg: planeSvg('atr72') },
    { answer:'Airbus A340', svg: planeSvg('a340') },
    { answer:'Boeing 777', svg: planeSvg('b777') }
  ];
  const planeOptions = planeQuestions.map(q => q.answer);

  const airports = [
    ['EDI','Edinburgh'],['GLA','Glasgow'],['PIK','Glasgow Prestwick'],['ABZ','Aberdeen'],['INV','Inverness'],['DND','Dundee'],
    ['LHR','London Heathrow'],['LGW','London Gatwick'],['MAN','Manchester'],['DXB','Dubai'],['DOH','Doha'],['JFK','New York JFK'],
    ['AMS','Amsterdam Schiphol'],['CDG','Paris Charles de Gaulle'],['FRA','Frankfurt'],['SIN','Singapore Changi'],['HND','Tokyo Haneda'],['SYD','Sydney'],
    ['LAX','Los Angeles'],['ORD','Chicago O’Hare'],['DUB','Dublin'],['KEF','Keflavík'],['MAD','Madrid'],['BCN','Barcelona']
  ];

  const makerItems = [
    ['737 MAX','Boeing'],['787 Dreamliner','Boeing'],['777X','Boeing'],['747-8','Boeing'],['A350','Airbus'],['A380','Airbus'],['A321neo','Airbus'],['A220','Airbus'],
    ['E195-E2','Embraer'],['E175','Embraer'],['CRJ-900','Bombardier'],['Q400','De Havilland Canada'],['ATR 72','ATR'],['MD-11','McDonnell Douglas'],
    ['C919','COMAC'],['SSJ100','Sukhoi'],['A330neo','Airbus'],['767','Boeing'],['E190','Embraer'],['A340','Airbus']
  ];
  const makerChoices = ['Airbus','Boeing','Embraer','Other'];

  const registrationItems = [
    ['G-','United Kingdom'],['N','United States'],['D-','Germany'],['F-','France'],['PH-','Netherlands'],['EI-','Ireland'],['A6-','United Arab Emirates'],['A7-','Qatar'],
    ['VH-','Australia'],['C-','Canada'],['JA','Japan'],['9V-','Singapore'],['EC-','Spain'],['I-','Italy'],['HB-','Switzerland'],['SE-','Sweden'],['LN-','Norway'],['OY-','Denmark']
  ];
  const registrationCountries = registrationItems.map(x => x[1]);

  const spans = [
    ['Airbus A380',79.75],['Boeing 747-8',68.4],['Boeing 777-300ER',64.8],['Airbus A350-1000',64.75],['Boeing 787-9',60.1],['Airbus A330-900',64.0],
    ['Airbus A340-600',63.45],['Boeing 767-300ER',47.6],['Airbus A321neo',35.8],['Boeing 737 MAX 8',35.9],['Embraer E195-E2',35.1],['ATR 72-600',27.05],
    ['Concorde',25.6],['Airbus A220-300',35.1],['Boeing 757-200',38.05],['Airbus A320neo',35.8]
  ];

  function planeSvg(type) {
    const base = (body, extras='') => `<svg viewBox="0 0 560 240" class="plane-silhouette" aria-hidden="true"><g>${body}${extras}</g></svg>`;
    const engines = xs => xs.map(x => `<ellipse cx="${x}" cy="164" rx="18" ry="9"/><rect x="${x-14}" y="142" width="28" height="25" rx="8"/>`).join('');
    if (type === 'a380') return base(`<path d="M35 116c80-10 162-15 247-15h105c42 0 88 9 133 29-48 17-94 25-137 25H278c-82 0-163-7-243-20L8 148v-48Z"/><path d="m185 105 80-67h36l-39 67m-77 45 80 58h36l-42-58M428 107l28-48h23l-8 53"/>`,engines([206,255,335,385]));
    if (type === 'b747') return base(`<path d="M30 119c92-13 178-19 258-19h80c46 0 96 9 152 29-56 18-104 27-145 27h-91c-82 0-167-7-254-20L8 149v-47Z"/><path d="M300 101c18-25 44-36 79-33l47 5-52 28M174 105l84-66h33l-38 66m-80 46 85 57h33l-41-57M435 109l31-51h20l-10 57"/>`,engines([199,247,334,382]));
    if (type === 'concorde') return base(`<path d="M17 127 415 94l122 31-122 30-398-20-9 18V98Z"/><path d="m192 111 106-83h37l-67 84m-76 36 106 66h37l-68-65M423 100l24-43h18l-5 48"/><path d="m500 119 37 6-37 7Z"/>`);
    if (type === 'a350') return base(`<path d="M30 120c104-14 197-21 279-21h73c49 0 94 10 140 29-46 19-91 28-138 28h-79c-85 0-176-7-275-20L8 149v-47Z"/><path d="m194 106 102-73h30l-50 74m-83 43 103 61h30l-53-61M440 108l31-47h18l-7 53"/><path d="m296 33 17-15 13 15M471 61l15-10-5 15"/>`,engines([235,353]));
    if (type === 'b787') return base(`<path d="M30 121c103-15 195-22 277-22h78c50 0 96 10 139 29-45 19-90 28-139 28h-78c-83 0-175-7-277-20L8 149v-47Z"/><path d="m194 106 102-69h30l-48 70m-85 43 102 59h30l-50-59M441 108l29-44h19l-7 50"/><path d="m297 37 15-14 14 14"/>`,engines([238,352]));
    if (type === 'b737') return base(`<path d="M50 121c92-13 176-19 252-19h72c45 0 92 9 138 27-47 18-92 27-138 27h-72c-76 0-160-7-252-19l-38 13v-44Z"/><path d="m206 107 82-61h27l-35 62m-74 42 82 51h27l-39-51M433 109l28-42h18l-7 47"/><path d="m288 46 14-14 13 14"/>`,engines([248,346]));
    if (type === 'a321') return base(`<path d="M39 121c98-13 188-19 271-19h65c47 0 92 9 138 27-46 18-91 27-138 27h-65c-83 0-173-7-271-19l-28 13v-44Z"/><path d="m212 107 81-58h26l-34 59m-73 42 81 49h26l-38-49M435 109l28-42h18l-7 47"/>`,engines([252,352]));
    if (type === 'atr72') return base(`<path d="M78 119c83-11 159-16 228-16h72c48 0 93 9 135 25-43 18-86 27-132 27h-78c-69 0-144-6-225-17l-35 10v-40Z"/><path d="m205 108 65-79h31l-18 79m-78 39 66 66h31l-20-66M429 109l30-45h18l-8 50"/><rect x="244" y="85" width="18" height="68" rx="7"/><rect x="344" y="85" width="18" height="68" rx="7"/><circle cx="253" cy="118" r="39" fill="none" stroke="currentColor" stroke-width="5"/><circle cx="353" cy="118" r="39" fill="none" stroke="currentColor" stroke-width="5"/>`);
    if (type === 'a340') return base(`<path d="M33 120c100-14 190-21 271-21h80c49 0 95 10 139 29-45 19-91 28-139 28h-80c-81 0-171-7-271-20L9 149v-47Z"/><path d="m191 106 104-71h31l-49 72m-86 43 104 60h31l-51-60M441 108l30-46h19l-8 52"/>`,engines([211,258,341,388]));
    return base(`<path d="M28 120c105-15 199-22 283-22h74c49 0 95 10 141 30-46 19-92 28-141 28h-74c-84 0-178-7-283-20L8 149v-47Z"/><path d="m188 106 108-74h32l-52 75m-88 43 108 62h32l-54-62M443 108l30-46h19l-8 52"/>`,engines([231,360]));
  }

  const shuffle = arr => [...arr].sort(() => Math.random() - .5);
  const sample = (arr, n) => shuffle(arr).slice(0, n);
  function buildOptions(correct, pool) {
    return shuffle([correct, ...sample(pool.filter(x => x !== correct), 3)]);
  }

  function openGame(id) {
    activeCleanup?.(); activeCleanup = null;
    document.body.classList.add('game-open');
    modal.classList.add('is-open'); modal.setAttribute('aria-hidden', 'false');
    timerWrap.hidden = true; scoreEl.textContent = '0'; streakEl.textContent = '0'; progressEl.style.width = '0%';
    const runners = { logos: runLogoQuiz, models: runModelQuiz, codes: runCodeSprint, makers: runMakerRush, regs: runRegistrationQuiz, wingspan: runWingspanBattle };
    runners[id]?.();
  }
  function closeGame() {
    activeCleanup?.(); activeCleanup = null;
    activeAnswerButtons = [];
    modal.classList.remove('is-open'); modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('game-open');
    setTimeout(() => { if (!modal.classList.contains('is-open')) stage.innerHTML = ''; }, 250);
  }
  document.querySelectorAll('[data-game]').forEach(btn => btn.addEventListener('click', () => openGame(btn.dataset.game)));
  document.querySelectorAll('[data-game-close]').forEach(btn => btn.addEventListener('click', closeGame));
  addEventListener('keydown', e => {
    if (!modal.classList.contains('is-open')) return;
    if (e.key === 'Escape') closeGame();
    const idx = Number(e.key) - 1;
    if (idx >= 0 && idx < activeAnswerButtons.length) activeAnswerButtons[idx]?.click();
  });

  function setHud(score, streak, progress) {
    scoreEl.textContent = score; streakEl.textContent = streak;
    state.bestStreak = Math.max(state.bestStreak || 0, streak);
    if (typeof progress === 'number') progressEl.style.width = `${Math.max(0, Math.min(100, progress))}%`;
  }
  function pulseResult(correct) {
    stage.classList.remove('is-correct','is-wrong'); void stage.offsetWidth;
    stage.classList.add(correct ? 'is-correct' : 'is-wrong');
  }
  function answerButtons(options, onAnswer) {
    const wrap = document.createElement('div'); wrap.className = 'game-answers';
    activeAnswerButtons = options.map((label, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'game-answer';
      b.innerHTML = `<span>0${i+1}</span><b>${label}</b>`;
      b.addEventListener('click', () => onAnswer(label, b), { once: true }); wrap.appendChild(b); return b;
    });
    return wrap;
  }
  function lockAnswers(correctLabel) {
    activeAnswerButtons.forEach(b => {
      b.disabled = true;
      if (b.querySelector('b')?.textContent === correctLabel) b.classList.add('is-correct');
    });
  }

  function finishGame(id, score, possible, extra = {}) {
    activeCleanup?.(); activeCleanup = null; activeAnswerButtons = [];
    const percent = possible ? Math.round(score / possible * 100) : 0;
    const previous = state.bests[id] || {};
    state.xp += Math.max(20, score * 10);
    state.completed += 1;
    state.bests[id] = { ...previous, played: true, score: Math.max(previous.score || 0, score), perfect: previous.perfect || (possible > 0 && score === possible), ...extra };
    saveState(); setHud(score, extra.streak || 0, 100);
    const resultMessage = extra.survival !== undefined ? (score >= 10 ? 'Wingspan monster. Absolutely filthy.' : score >= 5 ? 'That streak was serious.' : score > 0 ? 'You survived a few sectors.' : 'Immediate go-around.') : extra.timed ? (score >= 15 ? 'Rapid-fire monster.' : score >= 10 ? 'That was properly quick.' : score >= 5 ? 'Good pace. Go again.' : 'Warm-up complete.') : finishMessage(percent, score);
    stage.innerHTML = `<div class="game-finish"><span class="eyebrow">Challenge complete</span><strong>${possible ? percent + '%' : score}</strong><h3>${resultMessage}</h3><p>${possible ? `${score} of ${possible} correct.` : `Final score: ${score}.`} +${Math.max(20, score * 10)} XP added to your flight log.</p><div><button class="solid-button" type="button" data-replay>Run it again</button><button class="outline-button" type="button" data-finish-close>Choose another game</button></div></div>`;
    stage.querySelector('[data-replay]').addEventListener('click', () => openGame(id));
    stage.querySelector('[data-finish-close]').addEventListener('click', closeGame);
  }
  function finishMessage(percent, score) {
    if (percent === 100) return 'That was disgustingly AvGeek.';
    if (percent >= 80) return 'You definitely watch the skies.';
    if (percent >= 60) return 'Solid spotting knowledge.';
    if (score > 0) return 'Another circuit should do it.';
    return 'Tower says go around.';
  }

  function runRoundQuiz({ id, title, mode, questions, optionPool, visual, count = 10 }) {
    titleEl.textContent = title; modeEl.textContent = mode; timerWrap.hidden = true;
    const set = sample(questions, Math.min(count, questions.length));
    let index = 0, score = 0, streak = 0;
    const render = () => {
      if (index >= set.length) return finishGame(id, score, set.length, { streak });
      const q = set[index]; setHud(score, streak, index / set.length * 100);
      stage.className = 'game-stage'; stage.innerHTML = `<div class="game-question-head"><span>ROUND ${String(index + 1).padStart(2,'0')} / ${String(set.length).padStart(2,'0')}</span><b>${id === 'regs' ? 'Which country uses this aircraft registration prefix?' : id === 'logos' ? 'Which airline does this identity belong to?' : 'Which aircraft model is this?'}</b></div><div class="game-visual">${visual(q)}</div>`;
      const opts = buildOptions(q.answer, optionPool);
      stage.appendChild(answerButtons(opts, (choice, button) => {
        const correct = choice === q.answer; lockAnswers(q.answer); button.classList.add(correct ? 'is-correct' : 'is-wrong'); pulseResult(correct);
        if (correct) { score++; streak++; } else streak = 0;
        setHud(score, streak, (index + 1) / set.length * 100);
        setTimeout(() => { index++; render(); }, 650);
      }));
    };
    render();
  }

  function runLogoQuiz() {
    runRoundQuiz({ id:'logos', title:'Airline Logo Quiz', mode:'VISUAL RECOGNITION', questions:logoQuestions, optionPool:logoOptions, visual:q => `<div class="logo-mark" style="color:${q.color}">${q.mark}</div><span class="visual-caption">SIMPLIFIED AIRLINE MARK</span>` });
  }
  function runModelQuiz() {
    runRoundQuiz({ id:'models', title:'Plane Model Quiz', mode:'AIRCRAFT RECOGNITION', questions:planeQuestions, optionPool:planeOptions, visual:q => `<div class="plane-mark">${q.svg}</div><span class="visual-caption">SIDE PROFILE / NOT TO SCALE</span>` });
  }
  function runRegistrationQuiz() {
    const qs = sample(registrationItems, 12).map(([prefix, answer]) => ({ prefix, answer }));
    runRoundQuiz({ id:'regs', title:'Registration Radar', mode:'REGISTRATION NERD TEST', questions:qs, optionPool:registrationCountries, count:12, visual:q => `<div class="registration-mark"><span>REG</span><b>${q.prefix}</b><em>••••</em></div>` });
  }

  function runCodeSprint() {
    titleEl.textContent = 'Airport Code Sprint'; modeEl.textContent = '45 SECOND SPEED ROUND'; timerWrap.hidden = false;
    let score = 0, streak = 0, time = 45, current = null, used = [], ended = false;
    timerEl.textContent = time; setHud(score, streak, 100);
    function next() {
      if (ended) return;
      if (used.length >= airports.length) used = [];
      current = sample(airports.filter(x => !used.includes(x[0])), 1)[0]; used.push(current[0]);
      const codeFirst = Math.random() > .5;
      stage.className = 'game-stage'; stage.innerHTML = `<div class="speed-question"><span class="eyebrow">Type the answer</span><strong>${codeFirst ? current[0] : current[1]}</strong><p>${codeFirst ? 'Which airport is this?' : 'Enter the IATA code.'}</p><form data-code-form><input class="speed-input" data-code-input autocomplete="off" spellcheck="false" placeholder="${codeFirst ? 'Airport name' : 'IATA'}" maxlength="${codeFirst ? 40 : 3}"><button class="solid-button" type="submit">Confirm</button></form><small>Exact city/airport name or code · press Enter</small></div>`;
      const input = stage.querySelector('[data-code-input]'); input.focus();
      stage.querySelector('[data-code-form]').addEventListener('submit', e => {
        e.preventDefault(); const value = input.value.trim().toLowerCase(); if (!value) return;
        const target = (codeFirst ? current[1] : current[0]).toLowerCase();
        const accepted = codeFirst ? [target, target.replace(' airport',''), target.split(' ')[0]].includes(value) || target.includes(value) && value.length > 3 : value === target;
        if (accepted) { score++; streak++; pulseResult(true); } else { streak = 0; pulseResult(false); }
        setHud(score, streak, time / 45 * 100); input.disabled = true;
        const feedback = document.createElement('div'); feedback.className = `speed-feedback ${accepted ? 'is-correct' : 'is-wrong'}`; feedback.textContent = accepted ? `✓ ${current[0]} — ${current[1]}` : `✕ ${current[0]} — ${current[1]}`; stage.querySelector('.speed-question').appendChild(feedback);
        setTimeout(() => { if (!ended) next(); }, 430);
      });
    }
    const interval = setInterval(() => { time--; timerEl.textContent = time; progressEl.style.width = `${time / 45 * 100}%`; if (time <= 0) { ended = true; finishGame('codes', score, 0, { streak, speedScore: score, timed: true }); } }, 1000);
    activeCleanup = () => { ended = true; clearInterval(interval); }; next();
  }

  function runMakerRush() {
    titleEl.textContent = 'Manufacturer Rush'; modeEl.textContent = '30 SECOND RAPID FIRE'; timerWrap.hidden = false;
    let score = 0, streak = 0, time = 30, current = null, used = [], ended = false;
    timerEl.textContent = time;
    function next() {
      if (ended) return;
      if (used.length >= makerItems.length) used = [];
      current = sample(makerItems.filter(x => !used.includes(x[0])), 1)[0]; used.push(current[0]);
      const answer = ['Airbus','Boeing','Embraer'].includes(current[1]) ? current[1] : 'Other';
      stage.className = 'game-stage'; stage.innerHTML = `<div class="maker-question"><span class="eyebrow">Who built it?</span><strong>${current[0]}</strong><p>Choose the manufacturer.</p></div>`;
      stage.appendChild(answerButtons(makerChoices, (choice, button) => {
        const correct = choice === answer; lockAnswers(answer); button.classList.add(correct ? 'is-correct' : 'is-wrong'); pulseResult(correct);
        if (correct) { score++; streak++; } else streak = 0; setHud(score, streak, time / 30 * 100);
        setTimeout(() => { if (!ended) next(); }, 320);
      }));
    }
    const interval = setInterval(() => { time--; timerEl.textContent = time; progressEl.style.width = `${time / 30 * 100}%`; if (time <= 0) { ended = true; finishGame('makers', score, 0, { streak, speedScore: score, timed: true }); } }, 1000);
    activeCleanup = () => { ended = true; clearInterval(interval); }; next();
  }

  function runWingspanBattle() {
    titleEl.textContent = 'Wingspan Battle'; modeEl.textContent = 'SURVIVAL / HIGHER OR LOWER'; timerWrap.hidden = true;
    let score = 0, streak = 0;
    function next() {
      let [a,b] = sample(spans,2); while (a[1] === b[1]) [a,b] = sample(spans,2);
      stage.className = 'game-stage wingspan-stage'; stage.innerHTML = `<div class="wingspan-question"><span class="eyebrow">Which has the larger wingspan?</span><div class="wingspan-vs"><button type="button" data-span-choice="a"><span>01</span><b>${a[0]}</b><svg viewBox="0 0 220 80"><path d="M6 41 76 34l31-25h10l-12 25 82 3 27 4-27 5-82 3 12 24h-10L76 50 6 44 0 52V30Z" fill="currentColor"/></svg></button><em>VS</em><button type="button" data-span-choice="b"><span>02</span><b>${b[0]}</b><svg viewBox="0 0 220 80"><path d="M6 41 76 34l31-25h10l-12 25 82 3 27 4-27 5-82 3 12 24h-10L76 50 6 44 0 52V30Z" fill="currentColor"/></svg></button></div><p>Current streak <strong>${streak}</strong> · one wrong answer ends the run.</p></div>`;
      activeAnswerButtons = [...stage.querySelectorAll('[data-span-choice]')];
      activeAnswerButtons.forEach(btn => btn.addEventListener('click', () => {
        const pick = btn.dataset.spanChoice === 'a' ? a : b; const correct = pick[1] === Math.max(a[1],b[1]);
        activeAnswerButtons.forEach(x => x.disabled = true); pulseResult(correct);
        if (correct) { score++; streak++; btn.classList.add('is-correct'); setHud(score, streak, Math.min(100, streak * 10)); setTimeout(next, 480); }
        else { btn.classList.add('is-wrong'); const winner = a[1] > b[1] ? a : b; const info = document.createElement('div'); info.className = 'wingspan-reveal'; info.textContent = `${winner[0]}: ${winner[1].toFixed(1)} m`; stage.appendChild(info); setTimeout(() => finishGame('wingspan', score, 0, { streak, survival: score }), 900); }
      }, { once:true }));
    }
    next();
  }

  refreshStats(); renderAchievements();
})();

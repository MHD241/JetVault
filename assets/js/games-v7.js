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
    { id: 'allrounder', name: 'Type Rated', text: 'Play all eleven Games Lab challenges.', check: () => ['logos','models','codes','makers','regs','wingspan','firstflight','northbound','tailfin','routes','daily'].every(id => (state.bests[id] || {}).played) },
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

  const fallbackArchivePhotos = [
    {id:'arran-01',src:'assets/images/photos/arran-01-ryanair.webp',airline:'Ryanair',aircraft:'Boeing 737-800',photographerName:'Arran Gordon'},
    {id:'arran-02',src:'assets/images/photos/arran-02-jet2.webp',airline:'Jet2',aircraft:'Boeing 737',photographerName:'Arran Gordon'},
    {id:'arran-03',src:'assets/images/photos/arran-03-norwegian.webp',airline:'Norwegian',aircraft:'Boeing 737-800',photographerName:'Arran Gordon'},
    {id:'arran-04',src:'assets/images/photos/arran-04-icelandair.webp',airline:'Icelandair',aircraft:'Boeing 737 MAX',photographerName:'Arran Gordon'},
    {id:'arran-05',src:'assets/images/photos/arran-05-american.webp',airline:'American Airlines',aircraft:'Boeing 787 Dreamliner',photographerName:'Arran Gordon'},
    {id:'arran-06',src:'assets/images/photos/arran-06-qatar.webp',airline:'Qatar Airways',aircraft:'Boeing 787 Dreamliner',photographerName:'Arran Gordon'},
    {id:'arran-07',src:'assets/images/photos/arran-07-emirates-a380.webp',airline:'Emirates',aircraft:'Airbus A380-800',photographerName:'Arran Gordon'}
  ];
  const archivePhotos = ((window.SCOTTISH_AERO?.photos?.length ? window.SCOTTISH_AERO.photos : fallbackArchivePhotos)).filter(photo => photo?.src);
  const archiveCode = photo => `SA / ${String(Math.max(1, archivePhotos.findIndex(item => item.id === photo.id) + 1)).padStart(5, '0')}`;

  // These two visual-recognition games deliberately use the real Scottish.aero archive.
  // Airline names come directly from each listing, and vague aircraft listings are left
  // out of the model quiz so there is only one defensible answer per photo.
  const airlineQuestions = archivePhotos
    .filter(photo => photo.airline && photo.airline !== 'Unknown')
    .map(photo => ({
      answer: photo.airline,
      src: photo.src,
      credit: photo.photographerName || 'Scottish.aero crew',
      archive: archiveCode(photo)
    }));
  const airlineOptions = [...new Set(airlineQuestions.map(q => q.answer))];

  const modelQuestions = archivePhotos
    .filter(photo => photo.aircraft && photo.aircraft !== 'Unknown' && photo.aircraft !== 'Boeing 737')
    .map(photo => ({
      answer: photo.aircraft,
      src: photo.src,
      credit: photo.photographerName || 'Scottish.aero crew',
      archive: archiveCode(photo)
    }));
  const modelOptions = [...new Set(modelQuestions.map(q => q.answer))];

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


  const firstFlightItems = [
    { name:'Boeing 747', first:19690209, date:'09 Feb 1969' }, { name:'Concorde', first:19690302, date:'02 Mar 1969' },
    { name:'Airbus A320', first:19870222, date:'22 Feb 1987' }, { name:'Boeing 777', first:19940612, date:'12 Jun 1994' },
    { name:'Airbus A380', first:20050427, date:'27 Apr 2005' }, { name:'Boeing 787', first:20091215, date:'15 Dec 2009' },
    { name:'Boeing 747-8', first:20100208, date:'08 Feb 2010' }, { name:'Airbus A350', first:20130614, date:'14 Jun 2013' },
    { name:'Boeing 737 MAX', first:20160129, date:'29 Jan 2016' }
  ];
  const northboundAirports = [
    { code:'LHR', name:'London Heathrow', lat:51.4700 }, { code:'AMS', name:'Amsterdam Schiphol', lat:52.3105 }, { code:'PIK', name:'Prestwick', lat:55.5094 },
    { code:'GLA', name:'Glasgow', lat:55.8719 }, { code:'EDI', name:'Edinburgh', lat:55.9500 }, { code:'DND', name:'Dundee', lat:56.4525 },
    { code:'ABZ', name:'Aberdeen', lat:57.2019 }, { code:'INV', name:'Inverness', lat:57.5425 }, { code:'ARN', name:'Stockholm Arlanda', lat:59.6519 },
    { code:'OSL', name:'Oslo Gardermoen', lat:60.1939 }, { code:'HEL', name:'Helsinki', lat:60.3172 }, { code:'KEF', name:'Keflavík', lat:63.9850 }
  ];

  // Archive images are used whenever an exact/adequate type match is already in the site.
  // Three additional exact-model photographs are bundled locally from Wikimedia Commons.
  const spans = [
    { name:'Airbus A380-800', span:79.75, src:'assets/images/photos/arran-07-emirates-a380.webp', credit:'Arran Gordon · Scottish.aero archive' },
    { name:'Boeing 747-8', span:68.4, src:'assets/images/games/wingspan-747-8.webp', credit:'Kiefer. · Wikimedia Commons' },
    { name:'Boeing 777-300ER', span:64.8, src:'assets/images/games/wingspan-777-300er.webp', credit:'Dallahi · Wikimedia Commons' },
    { name:'Airbus A350-1000', span:64.75, src:'assets/images/games/wingspan-a350-1000.webp', credit:'Clemens Vasters · Wikimedia Commons' },
    { name:'Boeing 787 Dreamliner', span:60.12, src:'assets/images/photos/arran-06-qatar.webp', credit:'Arran Gordon · Scottish.aero archive' },
    { name:'Boeing 737 MAX', span:35.92, src:'assets/images/photos/arran-04-icelandair.webp', credit:'Arran Gordon · Scottish.aero archive' },
    { name:'Boeing 737-800', span:35.79, src:'assets/images/photos/arran-01-ryanair.webp', credit:'Arran Gordon · Scottish.aero archive' }
  ];



  const routeQuestions = [
    { origin:'EDI', airline:'British Airways', direction:'South', duration:'about 1h 30m', answer:'LHR', destination:'London Heathrow' },
    { origin:'EDI', airline:'KLM', direction:'South-east', duration:'about 1h 30m', answer:'AMS', destination:'Amsterdam Schiphol' },
    { origin:'EDI', airline:'Lufthansa', direction:'South-east', duration:'about 2h', answer:'FRA', destination:'Frankfurt' },
    { origin:'EDI', airline:'Aer Lingus', direction:'South-west', duration:'about 1h', answer:'DUB', destination:'Dublin' },
    { origin:'EDI', airline:'Icelandair', direction:'North-west', duration:'about 2h 30m', answer:'KEF', destination:'Keflavík' },
    { origin:'GLA', airline:'Emirates', direction:'South-east', duration:'about 7h', answer:'DXB', destination:'Dubai' },
    { origin:'EDI', airline:'Qatar Airways', direction:'South-east', duration:'about 7h', answer:'DOH', destination:'Doha' },
    { origin:'EDI', airline:'Air France', direction:'South-east', duration:'about 2h', answer:'CDG', destination:'Paris Charles de Gaulle' }
  ];
  const routeOptions = ['LHR','AMS','FRA','DUB','KEF','DXB','DOH','CDG'];

  const dailyQuestionPool = [
    {q:'Which manufacturer builds the A350 family?', answer:'Airbus', options:['Airbus','Boeing','Embraer','ATR']},
    {q:'Which airport uses the IATA code EDI?', answer:'Edinburgh', options:['Edinburgh','Dundee','Dublin','Eindhoven']},
    {q:'Which country uses the aircraft registration prefix A6-?', answer:'United Arab Emirates', options:['United Arab Emirates','Qatar','United Kingdom','Australia']},
    {q:'The 787 Dreamliner is built by which manufacturer?', answer:'Boeing', options:['Boeing','Airbus','Embraer','COMAC']},
    {q:'Which of these has the largest wingspan?', answer:'Airbus A380-800', options:['Airbus A380-800','Boeing 747-8','Airbus A350-1000','Boeing 777-300ER']},
    {q:'Concorde made its first flight in which year?', answer:'1969', options:['1969','1976','1965','1972']},
    {q:'KEF is the main international airport code for which place?', answer:'Keflavík', options:['Keflavík','Helsinki','Copenhagen','Oslo']},
    {q:'Which manufacturer builds the E195-E2?', answer:'Embraer', options:['Embraer','Airbus','Boeing','Bombardier']},
    {q:'Which airport code belongs to Dubai International?', answer:'DXB', options:['DXB','DOH','DWC','AUH']},
    {q:'Which aircraft type first flew earlier?', answer:'Boeing 747', options:['Boeing 747','Airbus A320','Boeing 777','Airbus A380']},
    {q:'Which registration prefix is associated with the United Kingdom?', answer:'G-', options:['G-','D-','F-','PH-']},
    {q:'The A380 first flew in which year?', answer:'2005', options:['2005','1999','2009','2013']}
  ];

  function archivePhotoVisual(q, caption) {
    return `<figure class="archive-quiz-photo"><img src="${q.src}" alt="Scottish.aero archive aircraft photograph" loading="eager" decoding="async"><figcaption><span>${q.archive}</span><b>PHOTO · ${q.credit.toUpperCase()}</b></figcaption></figure><span class="visual-caption">${caption}</span>`;
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
    const runners = { logos: runLogoQuiz, models: runModelQuiz, codes: runCodeSprint, makers: runMakerRush, regs: runRegistrationQuiz, wingspan: runWingspanBattle, firstflight: runFirstFlightDuel, northbound: runNorthbound, tailfin: runTailfinQuiz, routes: runRouteGuessr, daily: runDailyAvGeek };
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
    const survivalTitle = id === 'wingspan' ? 'Wingspan monster. Absolutely filthy.' : id === 'firstflight' ? 'Aviation historian status.' : id === 'northbound' ? 'Human compass behaviour.' : 'Survival monster.';
    const resultMessage = extra.survival !== undefined ? (score >= 10 ? survivalTitle : score >= 5 ? 'That streak was serious.' : score > 0 ? 'You survived a few sectors.' : 'Immediate go-around.') : extra.timed ? (score >= 15 ? 'Rapid-fire monster.' : score >= 10 ? 'That was properly quick.' : score >= 5 ? 'Good pace. Go again.' : 'Warm-up complete.') : finishMessage(percent, score);
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

  function runRoundQuiz({ id, title, mode, questions, optionPool, visual, count = 10, prompt = '' }) {
    titleEl.textContent = title; modeEl.textContent = mode; timerWrap.hidden = true;
    const set = sample(questions, Math.min(count, questions.length));
    let index = 0, score = 0, streak = 0;
    const render = () => {
      if (index >= set.length) return finishGame(id, score, set.length, { streak });
      const q = set[index]; setHud(score, streak, index / set.length * 100);
      stage.className = 'game-stage'; stage.innerHTML = `<div class="game-question-head"><span>ROUND ${String(index + 1).padStart(2,'0')} / ${String(set.length).padStart(2,'0')}</span><b>${prompt || (id === 'regs' ? 'Which country uses this aircraft registration prefix?' : id === 'logos' ? 'Which airline is pictured here?' : 'Which aircraft model is pictured here?')}</b></div><div class="game-visual">${visual(q)}</div>`;
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
    runRoundQuiz({ id:'logos', title:'Guess the Airline', mode:'SCOTTISH.AERO ARCHIVE', questions:airlineQuestions, optionPool:airlineOptions, count:airlineQuestions.length, visual:q => archivePhotoVisual(q, 'REAL ARCHIVE PHOTO · IDENTIFY THE AIRLINE') });
  }
  function runModelQuiz() {
    runRoundQuiz({ id:'models', title:'Plane Model Quiz', mode:'SCOTTISH.AERO ARCHIVE', questions:modelQuestions, optionPool:modelOptions, count:modelQuestions.length, visual:q => archivePhotoVisual(q, 'REAL ARCHIVE PHOTO · IDENTIFY THE AIRCRAFT') });
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


  function runFirstFlightDuel() {
    titleEl.textContent = 'First Flight Duel'; modeEl.textContent = 'AVIATION HISTORY / SURVIVAL'; timerWrap.hidden = true;
    let score = 0, streak = 0;
    function next() {
      const [a,b] = sample(firstFlightItems, 2);
      stage.className = 'game-stage duel-stage';
      stage.innerHTML = `<div class="duel-question"><span class="eyebrow">Which aircraft first flew earlier?</span><div class="duel-pair"><button type="button" data-duel="a"><span>01</span><b>${a.name}</b><small>FIRST FLIGHT / ?</small></button><em>VS</em><button type="button" data-duel="b"><span>02</span><b>${b.name}</b><small>FIRST FLIGHT / ?</small></button></div><p>Current streak <strong>${streak}</strong></p></div>`;
      activeAnswerButtons = [...stage.querySelectorAll('[data-duel]')];
      activeAnswerButtons.forEach(btn => btn.addEventListener('click', () => {
        const pick = btn.dataset.duel === 'a' ? a : b;
        const earlier = a.first < b.first ? a : b;
        activeAnswerButtons.forEach(x => x.disabled = true);
        const correct = pick.name === earlier.name; pulseResult(correct);
        if (correct) { score++; streak++; btn.classList.add('is-correct'); setHud(score, streak, Math.min(100, streak * 10)); setTimeout(next, 620); }
        else { btn.classList.add('is-wrong'); const reveal = document.createElement('div'); reveal.className='duel-reveal'; reveal.textContent = `${a.name}: ${a.date} · ${b.name}: ${b.date}`; stage.appendChild(reveal); setTimeout(() => finishGame('firstflight', score, 0, { streak, survival: score }), 1200); }
      }, { once:true }));
    }
    next();
  }

  function runNorthbound() {
    titleEl.textContent = 'Northbound'; modeEl.textContent = 'AIRPORT GEOGRAPHY / SURVIVAL'; timerWrap.hidden = true;
    let score = 0, streak = 0;
    function next() {
      const [a,b] = sample(northboundAirports, 2);
      stage.className = 'game-stage duel-stage';
      stage.innerHTML = `<div class="duel-question"><span class="eyebrow">Which airport is farther north?</span><div class="duel-pair duel-pair--airport"><button type="button" data-duel="a"><span>${a.code}</span><b>${a.name}</b><small>LATITUDE / ?</small></button><em>VS</em><button type="button" data-duel="b"><span>${b.code}</span><b>${b.name}</b><small>LATITUDE / ?</small></button></div><p>Current streak <strong>${streak}</strong></p></div>`;
      activeAnswerButtons = [...stage.querySelectorAll('[data-duel]')];
      activeAnswerButtons.forEach(btn => btn.addEventListener('click', () => {
        const pick = btn.dataset.duel === 'a' ? a : b;
        const north = a.lat > b.lat ? a : b;
        activeAnswerButtons.forEach(x => x.disabled = true);
        const correct = pick.code === north.code; pulseResult(correct);
        if (correct) { score++; streak++; btn.classList.add('is-correct'); setHud(score, streak, Math.min(100, streak * 10)); setTimeout(next, 620); }
        else { btn.classList.add('is-wrong'); const reveal = document.createElement('div'); reveal.className='duel-reveal'; reveal.textContent = `${north.code} is farther north.`; stage.appendChild(reveal); setTimeout(() => finishGame('northbound', score, 0, { streak, survival: score }), 1100); }
      }, { once:true }));
    }
    next();
  }


  function runTailfinQuiz() {
    const questions = airlineQuestions.map(q => ({...q}));
    runRoundQuiz({ id:'tailfin', title:'Tailfin Challenge', mode:'ARCHIVE CROP / AIRLINE ID', questions, optionPool:airlineOptions, count:questions.length, prompt:'Which airline owns this tail?', visual:q => `<figure class="archive-quiz-photo tailfin-quiz-photo"><div><img src="${q.src}" alt="Cropped Scottish.aero aircraft tail photograph" loading="eager" decoding="async"></div><figcaption><span>${q.archive}</span><b>TAIL CROP · ${q.credit.toUpperCase()}</b></figcaption></figure><span class="visual-caption">REAL ARCHIVE PHOTO · FOCUS ON THE TAIL</span>` });
  }

  function runRouteGuessr() {
    const questions = routeQuestions.map(q => ({...q}));
    runRoundQuiz({ id:'routes', title:'Route Guessr', mode:'ROUTE LOGIC / SCOTLAND', questions, optionPool:routeOptions, count:questions.length, prompt:'Which destination completes this route?', visual:q => `<div class="route-guess-visual"><div class="route-guess-origin"><span>FROM</span><b>${q.origin}</b></div><div class="route-guess-line"><i></i><em>✈</em><i></i></div><div class="route-guess-dest"><span>TO</span><b>???</b></div><dl><div><dt>Airline</dt><dd>${q.airline}</dd></div><div><dt>Direction</dt><dd>${q.direction}</dd></div><div><dt>Typical time</dt><dd>${q.duration}</dd></div></dl></div>` });
  }

  function dailySeed() {
    const d = new Date(); const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    let h = 0; for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return { key, h };
  }
  function runDailyAvGeek() {
    titleEl.textContent = 'Daily AvGeek'; modeEl.textContent = 'SAME FIVE FOR EVERYONE TODAY'; timerWrap.hidden = true;
    const {key,h}=dailySeed(); const set=[]; for(let i=0;i<5;i++) set.push(dailyQuestionPool[(h+i*5)%dailyQuestionPool.length]);
    let index=0,score=0,streak=0;
    const render=()=>{
      if(index>=set.length){ const best=JSON.parse(localStorage.getItem('scottishAeroDaily')||'{}'); if(best.date!==key||score>(best.score||0)) localStorage.setItem('scottishAeroDaily',JSON.stringify({date:key,score})); return finishGame('daily',score,set.length,{streak,dailyDate:key}); }
      const q=set[index]; setHud(score,streak,index/set.length*100); stage.className='game-stage daily-game-stage';
      stage.innerHTML=`<div class="game-question-head"><span>DAILY / ${key} · ${String(index+1).padStart(2,'0')} / 05</span><b>${q.q}</b></div><div class="daily-radar-mark"><i></i><b>SA</b><span>DAILY</span></div>`;
      stage.appendChild(answerButtons(shuffle(q.options),(choice,button)=>{const correct=choice===q.answer;lockAnswers(q.answer);button.classList.add(correct?'is-correct':'is-wrong');pulseResult(correct);if(correct){score++;streak++;}else streak=0;setHud(score,streak,(index+1)/set.length*100);setTimeout(()=>{index++;render();},650);}));
    }; render();
  }

  function runWingspanBattle() {
    titleEl.textContent = 'Wingspan Battle'; modeEl.textContent = 'PHOTO SURVIVAL / HIGHER OR LOWER'; timerWrap.hidden = true;
    let score = 0, streak = 0;
    function next() {
      let [a,b] = sample(spans,2); while (a.span === b.span) [a,b] = sample(spans,2);
      stage.className = 'game-stage wingspan-stage';
      stage.innerHTML = `<div class="wingspan-question"><span class="eyebrow">Which has the larger wingspan?</span><div class="wingspan-vs"><button type="button" data-span-choice="a"><div class="wingspan-photo"><img src="${a.src}" alt="${a.name}" loading="eager" decoding="async"><small>${a.credit}</small></div><div class="wingspan-label"><span>01</span><b>${a.name}</b></div></button><em>VS</em><button type="button" data-span-choice="b"><div class="wingspan-photo"><img src="${b.src}" alt="${b.name}" loading="eager" decoding="async"><small>${b.credit}</small></div><div class="wingspan-label"><span>02</span><b>${b.name}</b></div></button></div><p>Current streak <strong>${streak}</strong> · one wrong answer ends the run.</p></div>`;
      activeAnswerButtons = [...stage.querySelectorAll('[data-span-choice]')];
      activeAnswerButtons.forEach(btn => btn.addEventListener('click', () => {
        const pick = btn.dataset.spanChoice === 'a' ? a : b;
        const correct = pick.span === Math.max(a.span,b.span);
        activeAnswerButtons.forEach(x => x.disabled = true); pulseResult(correct);
        if (correct) {
          score++; streak++; btn.classList.add('is-correct'); setHud(score, streak, Math.min(100, streak * 10)); setTimeout(next, 580);
        } else {
          btn.classList.add('is-wrong');
          const winner = a.span > b.span ? a : b;
          const info = document.createElement('div'); info.className = 'wingspan-reveal'; info.textContent = `${winner.name}: ${winner.span.toFixed(2).replace(/0$/, '')} m`;
          stage.appendChild(info); setTimeout(() => finishGame('wingspan', score, 0, { streak, survival: score }), 1100);
        }
      }, { once:true }));
    }
    next();
  }

  refreshStats(); renderAchievements();
})();

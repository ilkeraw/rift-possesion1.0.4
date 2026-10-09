const socket = io();

let myPlayerNum = 0;
let currentPlayer = 1;
let selectedHexId = null;
let boardState = [];
let gameActive = false;

// DOM Elements
const roomInput = document.getElementById('room-input');
const joinBtn = document.getElementById('join-btn');
const chainToggle = document.getElementById('chain-toggle');
const lockingToggle = document.getElementById('locking-toggle');
const timerSelect = document.getElementById('timer-select');
const hexGrid = document.getElementById('hex-grid');
const selectedDisplay = document.getElementById('selected-criteria-display');
const champInput = document.getElementById('champ-input');
const submitBtn = document.getElementById('submit-btn');
const systemMsg = document.getElementById('system-msg');
const turnAnnounce = document.getElementById('turn-announcement');
const p1Score = document.getElementById('p1-score');
const p2Score = document.getElementById('p2-score');
const timerProgress = document.getElementById('timer-progress');

const HEX_RADIUS = 46;
function hexToPixel(q, r) {
  const x = HEX_RADIUS * Math.sqrt(3) * (q + r / 2);
  const y = HEX_RADIUS * (3 / 2) * r;
  return { x, y };
}

function createHexPoints(radius) {
  const points = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    points.push(`${radius * Math.cos(angle)},${radius * Math.sin(angle)}`);
  }
  return points.join(' ');
}

// 1. Lobby Setup & Settings Listeners
joinBtn.addEventListener('click', () => {
  const roomCode = roomInput.value.trim();
  if (roomCode) {
    socket.emit('joinRoom', { roomCode });
    joinBtn.disabled = true;
    roomInput.disabled = true;
  }
});

chainToggle.addEventListener('change', (e) => {
  socket.emit('toggleChaining', { enabled: e.target.checked });
});

lockingToggle.addEventListener('change', (e) => {
  socket.emit('toggleChampionLocking', { enabled: e.target.checked });
});

timerSelect.addEventListener('change', (e) => {
  socket.emit('setRoundDuration', { duration: e.target.value });
});

socket.on('settingsUpdated', ({ chainingEnabled, championLocking, roundDuration }) => {
  chainToggle.checked = chainingEnabled;
  lockingToggle.checked = championLocking;
  timerSelect.value = roundDuration;
});

// 2. Session Initialization
socket.on('initSession', (data) => {
  myPlayerNum = data.playerNum;
  currentPlayer = data.currentPlayer;
  boardState = data.board;
  chainToggle.checked = data.chainingEnabled;
  lockingToggle.checked = data.championLocking;
  timerSelect.value = data.roundDuration;

  systemMsg.innerText = `Connected as Player ${myPlayerNum}. Waiting for opponent...`;
  renderBoard(boardState);
});

socket.on('gameStart', ({ currentPlayer: starter, chainingEnabled, championLocking, roundDuration }) => {
  gameActive = true;
  currentPlayer = starter;
  chainToggle.disabled = true;
  lockingToggle.disabled = true;
  timerSelect.disabled = true;
  updateTurnDisplay();
  
  const timerText = roundDuration === 0 ? 'Unlimited' : `${roundDuration}s`;
  systemMsg.innerText = `Match Started! Mode: ${chainingEnabled ? 'Chain ON' : 'Chain OFF'} | Locking: ${championLocking ? 'ON' : 'OFF'} | Timer: ${timerText}`;
});

// Timer Bar Handler
socket.on('timerUpdate', ({ timeLeft, totalDuration }) => {
  if (totalDuration === 0) {
    timerProgress.classList.add('unlimited');
  } else {
    timerProgress.classList.remove('unlimited');
    timerProgress.style.width = `${(timeLeft / totalDuration) * 100}%`;
  }
});

// 3. Board Rendering
function renderBoard(board) {
  hexGrid.innerHTML = '';
  const pointsStr = createHexPoints(HEX_RADIUS - 2);

  board.forEach(tile => {
    const { x, y } = hexToPixel(tile.q, tile.r);

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', `hex-tile owner-${tile.owner}`);
    g.setAttribute('id', tile.id);
    g.setAttribute('transform', `translate(${x}, ${y})`);

    const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    poly.setAttribute('class', 'hex-polygon');
    poly.setAttribute('points', pointsStr);

    const textCat = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    textCat.setAttribute('class', 'hex-text-cat');
    textCat.setAttribute('y', -12);
    textCat.setAttribute('fill', tile.criteriaObj.color || '#94a3b8');
    textCat.textContent = tile.criteriaObj.cat;

    const textName = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    textName.setAttribute('class', 'hex-text-name');
    textName.setAttribute('y', 8);
    textName.textContent = tile.criteriaObj.name;

    g.appendChild(poly);
    g.appendChild(textCat);
    g.appendChild(textName);

    g.addEventListener('click', () => onHexClick(tile));
    hexGrid.appendChild(g);
  });
}

function onHexClick(tile) {
  if (!gameActive || myPlayerNum !== currentPlayer) return;
  if (tile.owner !== 0) return;

  document.querySelectorAll('.hex-tile').forEach(el => el.classList.remove('selected'));
  const targetEl = document.getElementById(tile.id);
  if (targetEl) targetEl.classList.add('selected');

  selectedHexId = tile.id;
  selectedDisplay.innerHTML = `Selected: <strong>[${tile.criteriaObj.cat}] ${tile.criteriaObj.name}</strong>`;
  champInput.disabled = false;
  submitBtn.disabled = false;
  champInput.focus();
}

submitBtn.addEventListener('click', sendMove);
champInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendMove();
});

function sendMove() {
  if (!selectedHexId || !champInput.value.trim()) return;
  socket.emit('submitMove', {
    hexId: selectedHexId,
    champName: champInput.value.trim()
  });
}

// 4. Move Success & Capture Cascade Animation
socket.on('moveSuccess', (data) => {
  champInput.value = '';
  champInput.disabled = true;
  submitBtn.disabled = true;
  selectedDisplay.innerHTML = 'Selected: <em>None</em>';
  selectedHexId = null;

  p1Score.innerText = data.p1Score;
  p2Score.innerText = data.p2Score;

  applyCaptureStyle(data.primaryHexId, data.playerNum);

  if (data.stolenHexIds && data.stolenHexIds.length > 0) {
    data.stolenHexIds.forEach((hexId, index) => {
      setTimeout(() => {
        applyCaptureStyle(hexId, data.playerNum);
      }, (index + 1) * 120);
    });
  }
});

function applyCaptureStyle(hexId, playerNum) {
  const el = document.getElementById(hexId);
  if (!el) return;

  el.classList.remove('owner-0', 'owner-1', 'owner-2', 'selected');
  el.classList.add(`owner-${playerNum}`, 'anim-capture');

  setTimeout(() => {
    el.classList.remove('anim-capture');
  }, 500);
}

// 5. Hex Rejection Shake Animation
socket.on('hexVibrate', ({ hexId, reason, playerNum }) => {
  const el = document.getElementById(hexId);
  if (el) {
    el.classList.add('anim-vibrate');
    setTimeout(() => {
      el.classList.remove('anim-vibrate');
    }, 450);
  }

  if (myPlayerNum === playerNum) {
    champInput.classList.add('error-shake');
    setTimeout(() => {
      champInput.classList.remove('error-shake');
    }, 450);
  }

  systemMsg.innerText = reason;
});

// 6. Turn Lifecycle
socket.on('turnPass', ({ reason, currentPlayer: nextPlayer }) => {
  currentPlayer = nextPlayer;
  updateTurnDisplay();
  if (reason) systemMsg.innerText = reason;

  champInput.value = '';
  champInput.disabled = (myPlayerNum !== currentPlayer);
  submitBtn.disabled = (myPlayerNum !== currentPlayer);
});

function updateTurnDisplay() {
  if (myPlayerNum === currentPlayer) {
    turnAnnounce.innerText = "YOUR TURN";
    turnAnnounce.style.color = (myPlayerNum === 1) ? '#38bdf8' : '#f43f5e';
  } else {
    turnAnnounce.innerText = `PLAYER ${currentPlayer}'S TURN`;
    turnAnnounce.style.color = '#94a3b8';
  }
}

socket.on('gameOver', ({ winner, p1Score: finalP1, p2Score: finalP2 }) => {
  gameActive = false;
  turnAnnounce.innerText = winner === 0 ? "GAME OVER: DRAW!" : `PLAYER ${winner} WINS!`;
  turnAnnounce.style.color = '#facc15';
  systemMsg.innerText = `Final Score: P1 [${finalP1}] - P2 [${finalP2}]`;
  champInput.disabled = true;
  submitBtn.disabled = true;
});

socket.on('errorMsg', (msg) => {
  alert(msg);
});
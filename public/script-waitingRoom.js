const socketWaiting = io();
socketWaiting.emit('joinLobbyRoom', lobbyId);

const waitingRoomInfo = document.getElementById('waitingRoomInfo');
const startBtn = document.getElementById('startGameBtn');
const exitBtn = document.getElementById('exitLobbyBtn');

socketWaiting.on('lobbyUpdated', (data) => {
  if (!data || data.lobbyId !== lobbyId) return;
  renderWaitingRoom(data);
});

// If the game starts, we redirect to /playing
socketWaiting.on('lobbyStarted', (data) => {
  if (data.lobbyId === lobbyId) {
    window.location.href = `/lobbies/${lobbyId}/playing`;
  }
});

function renderWaitingRoom(lobby) {
  if (!lobby) {
    waitingRoomInfo.textContent = 'Lobby does not exist.';
    return;
  }
  let leaderEmail = lobby.leaderEmail;
  let html = `<p>Leader: ${lobby.players[leaderEmail]?.nickname || '??'} (${leaderEmail})</p>`;
  html += '<p>Players:</p><ul>';
  for (const em in lobby.players) {
    const p = lobby.players[em];
    html += `<li>${p.nickname} (${p.email})</li>`;
  }
  html += '</ul>';
  waitingRoomInfo.innerHTML = html;
}

// Start Game
startBtn.addEventListener('click', async () => {
  let res = await postData({ action: 'startGame', lobbyId });
  if (!res.success) {
    alert(res.error || 'Error starting game.');
    return;
  }
  // server will emit 'lobbyStarted'
});

// Exit Lobby
exitBtn.addEventListener('click', async () => {
  let res = await postData({ action: 'exitLobby', lobbyId });
  window.location.href = '/lobbies';
});

async function postData(payload) {
  const res = await fetch('/api/game', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return await res.json();
}

// On load, request current lobby data
// The server side EJS preloads some data, but let's rely on 'lobbyUpdated' event

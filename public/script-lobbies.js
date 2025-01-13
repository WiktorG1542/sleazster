const socket = io();

// Join the "lobbyList" room for real-time updates
socket.emit('joinLobbyList');

const lobbyListDiv = document.getElementById('lobbyList');
const createLobbyBtn = document.getElementById('createLobbyBtn');
const joinLobbyBtn = document.getElementById('joinLobbyBtn');
const joinLobbyIdInput = document.getElementById('joinLobbyId');

// Listen for updates
socket.on('lobbyListUpdate', (allLobbies) => {
  renderLobbyList(allLobbies);
});

function renderLobbyList(lobbies) {
  lobbyListDiv.innerHTML = '';
  if (!lobbies || lobbies.length === 0) {
    lobbyListDiv.textContent = 'No lobbies found. Create one!';
    return;
  }
  lobbies.forEach(lb => {
    const div = document.createElement('div');
    div.style.border = '1px solid #aaa';
    div.style.margin = '5px 0';
    div.style.padding = '5px';

    const status = lb.inGame ? '(In Game)' : '(Waiting)';
    div.innerHTML = `
      <strong>LobbyID:</strong> ${lb.lobbyId} ${status}<br/>
      <strong>Leader:</strong> ${lb.leaderNickname} (${lb.leaderEmail})<br/>
      <strong>Players:</strong> 
      ${lb.players.map(p => p.nickname + ' (' + p.email + ')').join(', ')}
    `;
    lobbyListDiv.appendChild(div);
  });
}

// Create Lobby
createLobbyBtn.addEventListener('click', async () => {
  let res = await postData({ action: 'createLobby' });
  if (!res.success) {
    alert(res.error || 'Error creating lobby.');
    return;
  }
  // redirect
  window.location.href = `/lobbies/${res.lobbyId}/waiting`;
});

// Join Lobby
joinLobbyBtn.addEventListener('click', async () => {
  const lobbyId = joinLobbyIdInput.value.trim();
  if (!lobbyId) {
    alert('Enter a lobby ID to join');
    return;
  }
  let res = await postData({ action: 'joinLobby', lobbyId });
  if (!res.success) {
    alert(res.error || 'Error joining lobby.');
    return;
  }
  // redirect
  window.location.href = `/lobbies/${res.lobbyId}/waiting`;
});

async function postData(payload) {
  const res = await fetch('/api/game', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return await res.json();
}

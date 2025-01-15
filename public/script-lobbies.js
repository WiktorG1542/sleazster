const socket = io();
socket.emit('joinLobbyList');

const lobbyListDiv = document.getElementById('lobbyList');
const createLobbyBtn = document.getElementById('createLobbyBtn');
const joinLobbyBtn = document.getElementById('joinLobbyBtn');
const joinLobbyIdInput = document.getElementById('joinLobbyId');

socket.on('lobbyListUpdate', (allLobbies) => {
  renderLobbyList(allLobbies);
});

function renderLobbyList(lobbies) {
  lobbyListDiv.innerHTML = '';
  if (!lobbies || lobbies.length===0) {
    lobbyListDiv.textContent='No lobbies found. Create one!';
    return;
  }
  lobbies.forEach(lb=>{
    const d = document.createElement('div');
    d.style.border='1px solid #aaa';
    d.style.margin='5px 0';
    d.style.padding='5px';
    const st=lb.inGame?'(In Game)':'(Waiting)';
    d.innerHTML=`
      <strong>LobbyID:</strong> ${lb.lobbyId} ${st}<br/>
      <strong>Leader:</strong> ${lb.leaderNickname} (${lb.leaderEmail})<br/>
      <strong>Players:</strong>
      ${lb.players.map(p=>`${p.nickname} (${p.email})`).join(', ')}
    `;
    lobbyListDiv.appendChild(d);
  });
}

createLobbyBtn.addEventListener('click', async()=>{
  let r = await postData({ action:'createLobby' });
  if(!r.success) {
    alert(r.error||'Error creating lobby');
    return;
  }
  window.location.href = `/lobbies/${r.lobbyId}/waiting`;
});

joinLobbyBtn.addEventListener('click', async()=>{
  const lobbyId = joinLobbyIdInput.value.trim();
  if(!lobbyId){
    alert('Enter a lobby ID');
    return;
  }
  let r = await postData({ action:'joinLobby', lobbyId });
  if(!r.success) {
    alert(r.error||'Error joining lobby');
    return;
  }
  window.location.href = `/lobbies/${r.lobbyId}/waiting`;
});

async function postData(payload) {
  const res = await fetch('/api/game', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify(payload)
  });
  return await res.json();
}

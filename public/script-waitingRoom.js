const socketWaiting = io();
socketWaiting.emit('joinLobbyRoom', lobbyId);

const waitingRoomInfo = document.getElementById('waitingRoomInfo');
const startBtn = document.getElementById('startGameBtn');
const exitBtn = document.getElementById('exitLobbyBtn');
const addBotBtn = document.getElementById('addBotBtn');
const removeBotBtn = document.getElementById('removeBotBtn');

socketWaiting.on('lobbyUpdated', (data)=>{
  if(!data||data.lobbyId!==lobbyId)return;
  renderWaitingRoom(data);
});
socketWaiting.on('lobbyStarted', (data)=>{
  if(data.lobbyId===lobbyId){
    window.location.href=`/lobbies/${lobbyId}/playing`;
  }
});

function renderWaitingRoom(lobby) {
  if(!lobby) {
    waitingRoomInfo.textContent='Lobby does not exist.';
    return;
  }
  let leaderEmail=lobby.leaderEmail;
  let html=`<p>Leader: ${lobby.players[leaderEmail]?.nickname||'??'} (${leaderEmail})</p>`;
  html+='<p>Players:</p><ul>';
  for(const em in lobby.players){
    const p=lobby.players[em];
    html+=`<li>${p.nickname} (${p.email})</li>`;
  }
  html+='</ul>';
  waitingRoomInfo.innerHTML=html;
}

// Start game
startBtn.addEventListener('click', async()=>{
  let r = await postData({ action:'startGame', lobbyId });
  if(!r.success){
    alert(r.error||'Error starting game');
  }
});

// Exit
exitBtn.addEventListener('click', async()=>{
  let r=await postData({ action:'exitLobby', lobbyId });
  window.location.href='/lobbies';
});

// Add Bot
addBotBtn.addEventListener('click', async()=>{
  const botNickname=document.getElementById('botNickname').value.trim();
  if(!botNickname){
    alert('Enter a bot nickname (e.g. "bot1")');
    return;
  }
  let r=await postData({ action:'addBot', lobbyId, botNickname });
  if(!r.success){
    alert(r.error||'Error adding bot');
  }
});

// Remove Bot
removeBotBtn.addEventListener('click', async()=>{
  const botNickname=document.getElementById('removeBotNickname').value.trim();
  if(!botNickname){
    alert('Enter a bot nickname to remove');
    return;
  }
  let r=await postData({ action:'removeBot', lobbyId, botNickname });
  if(!r.success){
    alert(r.error||'Error removing bot');
  }
});

// helper
async function postData(payload){
  const res=await fetch('/api/game',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify(payload)
  });
  return await res.json();
}

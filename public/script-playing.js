const socketPlaying = io();
socketPlaying.emit('joinLobbyRoom', lobbyId);

let gameState = initialGameState||null;

socketPlaying.on('gameStateUpdate', (data)=>{
  if(data.lobbyId!==lobbyId) return;
  gameState=data.gameState;
  renderGameState();
});

function renderGameState(){
  if(!gameState){
    gameContainer.innerHTML='<p>No game state found.</p>';
    return;
  }
  let html=`<p><strong>Status:</strong> ${gameState.statusMessage}</p>`;
  if(gameState.roundEnded){
    nextRoundContainer.style.display='block';
    // do not reset proceed button if you want to keep it pressed 
    // or do if you want to re-enable
    html+='<p>Round ended, all cards are revealed.</p>';
  } else {
    nextRoundContainer.style.display='none';
    html+='<p>Round in progress.</p>';
  }
  html+='<div style="display:flex; flex-wrap:wrap; gap:20px;">';
  gameState.players.forEach(pl=>{
    html+=`<div style="border:1px solid #999; padding:10px;">
      <h4>${pl.nickname}</h4>
      <p>Score: ${pl.score}</p>
      <div class="cardContainer">`;
    let showCards=false;
    if(gameState.roundEnded||gameState.revealCards){
      showCards=true;
    } else if(pl.email===userEmail){
      showCards=true;
    }
    pl.cards.forEach(card=>{
      html+=renderCard(card, showCards);
    });
    html+='</div></div>';
  });
  html+='</div>';
  gameContainer.innerHTML=html;

  // If it's my turn and round not ended, show action
  const cp=gameState.players[gameState.currentPlayerIndex];
  if(cp.email===userEmail && !gameState.roundEnded){
    actionButtonsDiv.style.display='block';
  } else {
    actionButtonsDiv.style.display='none';
  }
}

function renderCard(card, reveal){
  if(!reveal){
    return `<div class="card"><img src="/img/cards/back.png" class="cardFace"/></div>`;
  }
  let suitKey='';
  switch(card.suit){
    case '♣': suitKey='C'; break;
    case '♦': suitKey='D'; break;
    case '♥': suitKey='H'; break;
    case '♠': suitKey='S'; break;
  }
  const filename=`${card.value}${suitKey}.png`;
  return `<div class="card"><img src="/img/cards/${filename}" class="cardFace"/></div>`;
}

// Moves
async function moveCheck(){
  let r=await postData({ action:'makeMove', lobbyId, move:'check'});
  if(!r.success){
    alert(r.error||'Error making move (check)');
  }
}

function openTrumpSelection(){
  handSelection.style.display='block';
  generateCategoryGrid();
}

function generateCategoryGrid(){
  categoryGrid.innerHTML='';
  const cats=Object.keys(gameState.handsMap);
  cats.forEach(c=>{
    let d=document.createElement('div');
    d.className='categoryTile';
    d.textContent=c;
    d.addEventListener('click',()=>openHandModal(c));
    categoryGrid.appendChild(d);
  });
}

function openHandModal(cat){
  modalCategoryTitle.textContent=cat;
  modalHandOptions.innerHTML='';

  const possibleHands=gameState.handsMap[cat];
  const currentIndex=gameState.currentHand?gameState.handRanks.indexOf(gameState.currentHand):-1;
  possibleHands.forEach(h=>{
    const hi=gameState.handRanks.indexOf(h);
    const b=document.createElement('button');
    b.className='handOption';
    b.textContent=h;
    if(hi<=currentIndex){
      b.disabled=true;
      b.classList.add('disabled');
    }
    b.addEventListener('click', async()=>{
      let r=await postData({ action:'makeMove', lobbyId, move:'trump', selectedHand:h });
      if(!r.success){
        alert(r.error||'Error trumping');
      }
      closeHandModal();
    });
    modalHandOptions.appendChild(b);
  });
  handModal.style.display='block';
}

function closeHandModal(){
  handModal.style.display='none';
}

closeModal.addEventListener('click', closeHandModal);
window.addEventListener('click', (e)=>{
  if(e.target===handModal) closeHandModal();
});

// Next round
async function proceedNextRound(){
  // const btn=document.getElementById('proceedButton');
  // btn.style.backgroundColor='#7f8c8d';
  // btn.disabled=true;
  // let r=await postData({ action:'proceedNextRound', lobbyId });
  // if(!r.success){
  //   alert(r.error||'Error proceeding next round');
  //   btn.style.backgroundColor='';
  //   btn.disabled=false;
  // }

  let res = await postData({ action: 'proceedNextRound', lobbyId });
  if (!res.success) {
    alert(res.error || 'Error proceeding next round');
  }
}

// Exit
async function exitLobby(){
  let r=await postData({ action:'exitLobby', lobbyId });
  window.location.href='/lobbies';
}

// helper
async function postData(payload){
  const res=await fetch('/api/game',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify(payload)
  });
  return await res.json();
}

// initial
renderGameState();

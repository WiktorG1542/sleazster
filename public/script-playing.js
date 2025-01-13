const socketPlaying = io();
socketPlaying.emit('joinLobbyRoom', lobbyId);

let gameState = initialGameState || null;

// Listen for game updates
socketPlaying.on('gameStateUpdate', (data) => {
  if (data.lobbyId !== lobbyId) return;
  gameState = data.gameState;
  renderGameState();
});

// RENDER GAME STATE
const gameContainer = document.getElementById('gameContainer');
const handSelectionDiv = document.getElementById('handSelection');
const categoryGrid = document.getElementById('categoryGrid');
const handModal = document.getElementById('handModal');
const modalCategoryTitle = document.getElementById('modalCategoryTitle');
const modalHandOptions = document.getElementById('modalHandOptions');
const closeModalBtn = document.getElementById('closeModal');
const nextRoundContainer = document.getElementById('nextRoundContainer');
const actionButtonsDiv = document.getElementById('actionButtons');

function renderGameState() {
  if (!gameState) {
    gameContainer.innerHTML = '<p>No game state found.</p>';
    return;
  }

  let html = `<p><strong>Status:</strong> ${gameState.statusMessage}</p>`;

  if (gameState.roundEnded) {
    // Round ended -> show next round button
    nextRoundContainer.style.display = 'block';
    
    // Reset the proceed button each time the round actually ends
    const btn = document.getElementById('proceedButton');
    btn.disabled = false;
    btn.style.backgroundColor = ''; // or remove 'darkPressed' class if you prefer

    html += '<p>Round ended, all cards are revealed.</p>';
  } else {
    // Round still going
    nextRoundContainer.style.display = 'none';
    html += '<p>Round in progress.</p>';
  }

  // Players
  html += '<div style="display:flex; flex-wrap:wrap; gap:20px;">';
  gameState.players.forEach((pl, idx) => {
    html += `<div style="border:1px solid #999; padding:10px;">
      <h4>${pl.nickname}</h4>
      <p>Score: ${pl.score} | Cards: ${pl.cardCount}</p>
      <div class="cardContainer">`;

    let showCards = false;
    // If round ended or revealCards is true, show everyone's cards
    // Else only show your own
    if (gameState.roundEnded || gameState.revealCards) {
      showCards = true;
    } else if (pl.email === userEmail) {
      // If it's me, I see my own
      showCards = true;
    }

    pl.cards.forEach(card => {
      html += renderCard(card, showCards);
    });

    html += `</div></div>`; // close cardContainer, close playerDiv
  });
  html += '</div>';

  gameContainer.innerHTML = html;

  // If it's my turn and round not ended, show action buttons
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  if (currentPlayer.email === userEmail && !gameState.roundEnded) {
    actionButtonsDiv.style.display = 'block';
  } else {
    actionButtonsDiv.style.display = 'none';
  }

}
// Render a single card
function renderCard(card, reveal) {
  if (!reveal) {
    return `<div class="card"><img src="/img/cards/back.png" class="cardFace" /></div>`;
  }
  let suitKey = '';
  switch (card.suit) {
    case '♣': suitKey = 'C'; break;
    case '♦': suitKey = 'D'; break;
    case '♥': suitKey = 'H'; break;
    case '♠': suitKey = 'S'; break;
  }
  const filename = `${card.value}${suitKey}.png`; // e.g. 'AC.png'
  return `<div class="card"><img src="/img/cards/${filename}" class="cardFace" /></div>`;
}

// =============== ACTIONS ===============
async function moveCheck() {
  let res = await postData({ action: 'makeMove', lobbyId, move: 'check' });
  if (!res.success) {
    alert(res.error || 'Error making move (check)');
  }
}

function openTrumpSelection() {
  // Show the categories
  handSelectionDiv.style.display = 'block';
  generateCategoryGrid();
}

// Generate category tiles
function generateCategoryGrid() {
  categoryGrid.innerHTML = '';
  const categories = Object.keys(gameState.handsMap); 
  categories.forEach(cat => {
    let div = document.createElement('div');
    div.className = 'categoryTile';
    div.textContent = cat;
    div.addEventListener('click', () => {
      openHandModal(cat);
    });
    categoryGrid.appendChild(div);
  });
}

function openHandModal(category) {
  modalCategoryTitle.textContent = category;
  modalHandOptions.innerHTML = '';

  const possibleHands = gameState.handsMap[category];
  // Compare with the currentHand rank
  const currentHandIndex = gameState.currentHand ? gameState.handRanks.indexOf(gameState.currentHand) : -1;

  possibleHands.forEach(hand => {
    const handIndex = gameState.handRanks.indexOf(hand);
    const btn = document.createElement('button');
    btn.className = 'handOption';
    populateHandButton(btn, hand);
    if (handIndex <= currentHandIndex) {
      btn.disabled = true;
      btn.classList.add('disabled');
    }
    btn.addEventListener('click', async () => {
      // We do a second post with selectedHand
      let res = await postData({
        action: 'makeMove',
        lobbyId,
        move: 'trump',
        selectedHand: hand
      });
      if (!res.success) {
        alert(res.error || 'Error trumping');
      }
      closeHandModal();
    });
    modalHandOptions.appendChild(btn);
  });

  handModal.style.display = 'block';
}

function populateHandButton(button, hand) {
  // You can put a mini preview of the hand (like in the original example)
  button.textContent = hand;
}

// Close modal
closeModalBtn.addEventListener('click', () => {
  closeHandModal();
});
window.addEventListener('click', (event) => {
  if (event.target === handModal) {
    closeHandModal();
  }
});
function closeHandModal() {
  handModal.style.display = 'none';
}

// ========== NEXT ROUND ==========
async function proceedNextRound() {
  // let res = await postData({ action: 'proceedNextRound', lobbyId });
  // if (!res.success) {
  //   alert(res.error || 'Error proceeding next round');
  // }
  const btn = document.getElementById('proceedButton');
  // Visually show it's pressed
  btn.style.backgroundColor = '#7f8c8d';  // or another darker shade
  btn.disabled = true;
  
  let res = await postData({ action: 'proceedNextRound', lobbyId });
  if (!res.success) {
    alert(res.error || 'Error proceeding next round');
    // If error, re-enable the button
    btn.style.backgroundColor = '';
    btn.disabled = false;
    return;
  }
  // We rely on the server's real-time update to show next state
}

async function exitLobby() {
  let res = await postData({ action: 'exitLobby', lobbyId });
  window.location.href = '/lobbies';
}

// Helper
async function postData(payload) {
  const res = await fetch('/api/game', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return await res.json();
}

// On load
renderGameState();

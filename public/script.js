// script.js
const socket = io();

// We must handle that some pages do not have certain elements.
// So we wrap code in checks.

let nickname = '';
let currentLobbyName = null;
let isLobbyLeader = false;
let gameState = null;

// DOM elements (some may not exist on certain pages)
const nicknameContainer = document.getElementById('nicknameContainer');
const nicknameInput = document.getElementById('nickname');
const enterLobbyMenuButton = document.getElementById('enterLobbyMenu');

const lobbyListContainer = document.getElementById('lobbyListContainer');
const lobbyListDiv = document.getElementById('lobbyList');
const createLobbyNameInput = document.getElementById('createLobbyName');
const createLobbyButton = document.getElementById('createLobby');
const joinLobbyNameInput = document.getElementById('joinLobbyName');
const joinLobbyButton = document.getElementById('joinLobby');

const waitingRoomContainer = document.getElementById('waitingRoomContainer');
const waitingRoomInfo = document.getElementById('waitingRoomInfo');
const startGameButton = document.getElementById('startGame');
const exitLobbyButton = document.getElementById('exitLobby');

const gameContainer = document.getElementById('gameContainer');
const playersContainer = document.getElementById('playersContainer');
const actionButtons = document.getElementById('actionButtons');
const checkButton = document.getElementById('checkButton');
const trumpButton = document.getElementById('trumpButton');
const statusMessageDiv = document.getElementById('statusMessage');
const proceedContainer = document.getElementById('proceedContainer');
const proceedButton = document.getElementById('proceedButton');
const handSelection = document.getElementById('handSelection');
const categoryGrid = document.getElementById('categoryGrid');

// Only attach event listeners if elements exist on this page
if (enterLobbyMenuButton) {
  enterLobbyMenuButton.addEventListener('click', () => {
    nickname = nicknameInput.value.trim();
    if (!nickname) {
      alert('Please enter a nickname.');
      return;
    }
    nicknameContainer.style.display = 'none';
    lobbyListContainer.style.display = 'block';
  });
}

if (createLobbyButton) {
  createLobbyButton.addEventListener('click', () => {
    const lobbyName = createLobbyNameInput.value.trim();
    if (!lobbyName) {
      alert('Please enter a lobby name.');
      return;
    }
    socket.emit('createLobby', { lobbyName, nickname });
  });
}

if (joinLobbyButton) {
  joinLobbyButton.addEventListener('click', () => {
    const lobbyName = joinLobbyNameInput.value.trim();
    if (!lobbyName) {
      alert('Please enter a lobby name.');
      return;
    }
    socket.emit('joinLobby', { lobbyName, nickname });
  });
}

if (startGameButton) {
  startGameButton.addEventListener('click', () => {
    if (!currentLobbyName) return;
    socket.emit('startLobbyGame', currentLobbyName);
  });
}

if (exitLobbyButton) {
  exitLobbyButton.addEventListener('click', () => {
    socket.emit('exitLobby');
    if (waitingRoomContainer && lobbyListContainer) {
      waitingRoomContainer.style.display = 'none';
      lobbyListContainer.style.display = 'block';
    }
  });
}

if (checkButton) {
  checkButton.addEventListener('click', () => {
    socket.emit('playerMove', { lobbyName: currentLobbyName, move: 'check' });
  });
}

if (trumpButton) {
  trumpButton.addEventListener('click', () => {
    socket.emit('playerMove', { lobbyName: currentLobbyName, move: 'trump' });
  });
}

if (proceedButton) {
  proceedButton.addEventListener('click', () => {
    socket.emit('proceedNextRound', currentLobbyName);
    proceedButton.disabled = true;
    proceedButton.classList.add('disabled');
  });
}

// =============== SOCKET EVENTS ===============
socket.on('lobbyListUpdate', (allLobbies) => {
  if (!lobbyListDiv) return;
  lobbyListDiv.innerHTML = '';
  allLobbies.forEach((lobby) => {
    const isInGame = lobby.inGame ? '(In Game)' : '(Waiting)';
    let item = document.createElement('div');
    item.innerHTML = `Lobby: ${lobby.lobbyName} ${isInGame} <br>
      Leader: ${lobby.leaderNickname}<br>
      Players: ${lobby.players.map(p => p.nickname).join(', ')}`;
    lobbyListDiv.appendChild(item);
    lobbyListDiv.appendChild(document.createElement('hr'));
  });
});

socket.on('lobbyUpdate', (data) => {
  if (!data) return;
  const { lobbyName, playerData, leaderId, inGame } = data;
  currentLobbyName = lobbyName;
  isLobbyLeader = (socket.id === leaderId);

  if (waitingRoomContainer && lobbyListContainer) {
    if (!inGame) {
      // Show waiting room
      lobbyListContainer.style.display = 'none';
      waitingRoomContainer.style.display = 'block';
      waitingRoomInfo.innerHTML = `<h2>Lobby: ${lobbyName}</h2>`;
      waitingRoomInfo.innerHTML += `<p>Players in this lobby:</p>`;
      playerData.forEach((p) => {
        waitingRoomInfo.innerHTML += `- ${p.nickname} ${p.id === leaderId ? '(Leader)' : ''}<br>`;
      });

      if (isLobbyLeader && playerData.length > 1) {
        startGameButton.style.display = 'inline-block';
      } else {
        startGameButton.style.display = 'none';
      }
      exitLobbyButton.style.display = 'inline-block';
    } else {
      // Hide waiting room, show game container
      waitingRoomContainer.style.display = 'none';
      if (gameContainer) {
        gameContainer.style.display = 'block';
      }
    }
  }
});

socket.on('startGame', (data) => {
  gameState = data;
  if (waitingRoomContainer && gameContainer) {
    waitingRoomContainer.style.display = 'none';
    gameContainer.style.display = 'block';
    updateUI();
  }
});

socket.on('updateGameState', (data) => {
  gameState = data;
  updateUI();
});

socket.on('errorMessage', (message) => {
  alert(message);
});

// We no longer do 'gameOver' as a final event since we restart automatically. 
// The logic is handled on the server side to immediately restart.

// =============== UI HELPER FUNCTIONS ===============
function updateUI() {
  if (!gameState || !playersContainer) return;

  // Clear the players container
  playersContainer.innerHTML = '';

  // Render each player panel
  gameState.players.forEach((pl, index) => {
    const playerDiv = document.createElement('div');
    playerDiv.className = 'playerDiv';

    // Player Nickname and Score
    const playerName = document.createElement('h2');
    playerName.innerText = pl.nickname;
    playerDiv.appendChild(playerName);

    // Show score instead of card count
    const playerScore = document.createElement('div');
    playerScore.className = 'cardCount'; // re-use class for styling
    playerScore.innerText = `Score: ${pl.score}`;
    playerDiv.appendChild(playerScore);

    // Card container
    const cardContainer = document.createElement('div');
    cardContainer.className = 'cardContainer';

    let reveal = (gameState.revealCards || pl.nickname === nickname);

    pl.cards.forEach((card) => {
      const cardDiv = document.createElement('div');
      cardDiv.className = 'card';

      if (reveal) {
        let suitKey = '';
        switch(card.suit) {
          case '♣': suitKey = 'C'; break;
          case '♦': suitKey = 'D'; break;
          case '♥': suitKey = 'H'; break;
          case '♠': suitKey = 'S'; break;
        }
        const spriteFilename = `${card.value}${suitKey}.png`;
        const cardImg = document.createElement('img');
        cardImg.src = `/img/cards/${spriteFilename}`;
        cardImg.className = 'cardFace';
        cardDiv.appendChild(cardImg);

        if (gameState.roundEnded) {
          cardDiv.classList.add('flip');
        }
      } else {
        const cardBackImg = document.createElement('img');
        cardBackImg.src = `/img/cards/back.png`;
        cardBackImg.className = 'cardBack';
        cardDiv.appendChild(cardBackImg);
      }

      cardContainer.appendChild(cardDiv);
    });

    playerDiv.appendChild(cardContainer);
    playersContainer.appendChild(playerDiv);
  });

  // Current Player Controls: Check/Trump
  if (!gameState.roundEnded) {
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (currentPlayer.nickname === nickname && actionButtons) {
      actionButtons.style.display = 'block';
      // If no currentHand declared yet, disable check
      if (gameState.currentHand === null) {
        checkButton.disabled = true;
        checkButton.classList.add('disabled');
      } else {
        checkButton.disabled = false;
        checkButton.classList.remove('disabled');
      }
    } else if (actionButtons) {
      actionButtons.style.display = 'none';
    }
  } else {
    if (actionButtons) {
      actionButtons.style.display = 'none';
    }
  }

  // Status Message
  if (statusMessageDiv) {
    statusMessageDiv.innerText = gameState.statusMessage;
  }

  // Proceed Next Round
  if (gameState.roundEnded && proceedContainer) {
    proceedContainer.style.display = 'block';
    if (gameState.playersReady[nickname]) {
      proceedButton.disabled = true;
      proceedButton.classList.add('disabled');
    } else {
      proceedButton.disabled = false;
      proceedButton.classList.remove('disabled');
    }
  } else if (proceedContainer) {
    proceedContainer.style.display = 'none';
  }

  // Hand Selection
  if (handSelection && gameState.selectingHand && gameState.players[gameState.currentPlayerIndex].nickname === nickname) {
    handSelection.style.display = 'block';
    generateCategoryGrid();
  } else if (handSelection) {
    handSelection.style.display = 'none';
  }
}

function populateHandButton(handBtn, hand) {
  handBtn.innerHTML = '';

  function createRankImage(rank) {
    const img = document.createElement('img');
    img.src = `/img/cards_small/${rank}_small.png`;
    img.className = 'miniCard';
    img.style.width = '30px';
    img.style.margin = '2px';
    return img;
  }

  if (hand.startsWith('Single')) {
    const value = hand.split(' ')[1];
    handBtn.appendChild(createRankImage(value));

  } else if (hand.startsWith('Double')) {
    const value = hand.split(' ')[1];
    for (let i=0; i<2; i++) {
      handBtn.appendChild(createRankImage(value));
    }

  } else if (hand.startsWith('Triple')) {
    const value = hand.split(' ')[1];
    for (let i=0; i<3; i++) {
      handBtn.appendChild(createRankImage(value));
    }

  } else if (hand.startsWith('Quadruple')) {
    const value = hand.split(' ')[1];
    for (let i=0; i<4; i++) {
      handBtn.appendChild(createRankImage(value));
    }

  } else if (hand.startsWith('2 Pairs')) {
    const pairString = hand.split(' ')[2]; 
    const [v1, v2] = pairString.split('-');
    for (let i=0; i<2; i++) {
      handBtn.appendChild(createRankImage(v1));
    }
    for (let i=0; i<2; i++) {
      handBtn.appendChild(createRankImage(v2));
    }

  } else if (hand.startsWith('Full House')) {
    // Show triple rank + ?? for pair
    const value = hand.split(' ')[2];
    for (let i=0; i<3; i++) {
      handBtn.appendChild(createRankImage(value));
    }
    // Add two question marks or placeholders
    // Just show two Aces as placeholder or no difference:
    for (let i=0; i<2; i++) {
      handBtn.appendChild(createRankImage('A'));
    }

  } else if (hand === 'Small Street') {
    ['9', '10', 'J', 'Q', 'K'].forEach(r => {
      handBtn.appendChild(createRankImage(r));
    });
  } else if (hand === 'Big Street') {
    ['10', 'J', 'Q', 'K', 'A'].forEach(r => {
      handBtn.appendChild(createRankImage(r));
    });
  } else {
    // fallback
    handBtn.innerText = hand;
  }
}

function openHandModal(category) {
  const modal = document.getElementById('handModal');
  const modalCategoryTitle = document.getElementById('modalCategoryTitle');
  const modalHandOptions = document.getElementById('modalHandOptions');

  modalCategoryTitle.textContent = category;
  modalHandOptions.innerHTML = '';

  const possibleHands = gameState.hands[category]; 
  const currentHandIndex = gameState.currentHand ? gameState.handRanks.indexOf(gameState.currentHand) : -1;

  possibleHands.forEach(hand => {
    const handIndex = gameState.handRanks.indexOf(hand);

    const handBtn = document.createElement('button');
    handBtn.className = 'handOption';
    populateHandButton(handBtn, hand);

    if (handIndex <= currentHandIndex) {
      handBtn.disabled = true;
      handBtn.classList.add('disabled');
    }

    handBtn.addEventListener('click', () => {
      socket.emit('playerMove', { lobbyName: currentLobbyName, move: 'trump', selectedHand: hand });
      closeHandModal();
    });
    
    modalHandOptions.appendChild(handBtn);
  });

  modal.style.display = 'block';
}

function closeHandModal() {
  const modal = document.getElementById('handModal');
  if (modal) modal.style.display = 'none';
}

if (document.getElementById('closeModal')) {
  document.getElementById('closeModal').addEventListener('click', closeHandModal);
}

window.addEventListener('click', (event) => {
  const modal = document.getElementById('handModal');
  if (modal && event.target === modal) {
    closeHandModal();
  }
});

function generateCategoryGrid() {
  if (!categoryGrid) return;
  categoryGrid.innerHTML = '';
  const categories = Object.keys(gameState.hands); 
  categories.forEach((category) => {
    const categoryDiv = document.createElement('div');
    categoryDiv.className = 'categoryTile';
    categoryDiv.innerText = category;
    categoryDiv.addEventListener('click', () => {
      openHandModal(category);
    });
    categoryGrid.appendChild(categoryDiv);
  });
}

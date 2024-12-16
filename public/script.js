// script.js
const socket = io();

let nickname = '';
let currentLobbyName = null;
let isLobbyLeader = false;
let gameState = null;

// DOM Elements
const mainMenuContainer = document.getElementById('mainMenuContainer');
const howToPlayContainer = document.getElementById('howToPlayContainer');
const howToPlayBackButton = document.getElementById('howToPlayBackButton');
const mainMenuLobbiesButton = document.getElementById('mainMenuLobbiesButton');
const mainMenuHowToPlayButton = document.getElementById('mainMenuHowToPlayButton');

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
const handGrid = document.getElementById('handGrid');

// ========== MAIN MENU LOGIC ==========
mainMenuLobbiesButton.addEventListener('click', () => {
  mainMenuContainer.style.display = 'none';
  nicknameContainer.style.display = 'block';
});

mainMenuHowToPlayButton.addEventListener('click', () => {
  mainMenuContainer.style.display = 'none';
  howToPlayContainer.style.display = 'block';
});

howToPlayBackButton.addEventListener('click', () => {
  howToPlayContainer.style.display = 'none';
  mainMenuContainer.style.display = 'block';
});

// ========== NICKNAME + LOBBY FLOW ==========
enterLobbyMenuButton.addEventListener('click', () => {
  nickname = nicknameInput.value.trim();
  if (!nickname) {
    alert('Please enter a nickname.');
    return;
  }
  nicknameContainer.style.display = 'none';
  lobbyListContainer.style.display = 'block';
});

createLobbyButton.addEventListener('click', () => {
  const lobbyName = createLobbyNameInput.value.trim();
  if (!lobbyName) {
    alert('Please enter a lobby name.');
    return;
  }
  socket.emit('createLobby', { lobbyName, nickname });
});

joinLobbyButton.addEventListener('click', () => {
  const lobbyName = joinLobbyNameInput.value.trim();
  if (!lobbyName) {
    alert('Please enter a lobby name.');
    return;
  }
  socket.emit('joinLobby', { lobbyName, nickname });
});

startGameButton.addEventListener('click', () => {
  if (!currentLobbyName) return;
  socket.emit('startLobbyGame', currentLobbyName);
});

exitLobbyButton.addEventListener('click', () => {
  socket.emit('exitLobby');
  waitingRoomContainer.style.display = 'none';
  lobbyListContainer.style.display = 'block';
});

// ========== IN-GAME CONTROLS ==========
checkButton.addEventListener('click', () => {
  socket.emit('playerMove', { lobbyName: currentLobbyName, move: 'check' });
});

trumpButton.addEventListener('click', () => {
  socket.emit('playerMove', { lobbyName: currentLobbyName, move: 'trump' });
});

proceedButton.addEventListener('click', () => {
  socket.emit('proceedNextRound', currentLobbyName);
  proceedButton.disabled = true;
  proceedButton.classList.add('disabled');
});

// =============== SOCKET EVENTS ===============

socket.on('lobbyListUpdate', (allLobbies) => {
  lobbyListDiv.innerHTML = '';
  allLobbies.forEach((lobby) => {
    const isInGame = lobby.inGame ? '(In Game)' : '(Waiting)';
    let item = document.createElement('div');
    // Currently might say: "Leader: lobby.leaderId"
    // Instead use leaderNickname:
    item.innerHTML = `Lobby: ${lobby.lobbyName} ${isInGame} 
      - Leader: ${lobby.leaderNickname}<br>
      Players: ${lobby.players.map(p => p.nickname).join(', ')}`;

    lobbyListDiv.appendChild(item);
    lobbyListDiv.appendChild(document.createElement('hr'));
  });
});

socket.on('lobbyUpdate', (data) => {
  const { lobbyName, playerData, leaderId, inGame } = data;
  currentLobbyName = lobbyName;
  isLobbyLeader = (socket.id === leaderId);

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
    gameContainer.style.display = 'block';
  }
});

socket.on('startGame', (data) => {
  gameState = data;
  waitingRoomContainer.style.display = 'none';
  gameContainer.style.display = 'block';
  updateUI();
});

socket.on('updateGameState', (data) => {
  gameState = data;
  updateUI();
});

socket.on('errorMessage', (message) => {
  alert(message);
});

socket.on('gameOver', (data) => {
  alert(`Game Over! Winner: ${data.winner}`);
  location.reload();
});

// =============== UI HELPER FUNCTIONS ===============

function updateUI() {
  if (!gameState) return;

  // Clear the players container
  playersContainer.innerHTML = '';

  // Render each player panel
  gameState.players.forEach((pl, index) => {
    const playerDiv = document.createElement('div');
    playerDiv.className = 'playerDiv';

    // Player Nickname
    const playerName = document.createElement('h2');
    playerName.innerText = pl.nickname;
    playerDiv.appendChild(playerName);

    // Card Count
    const playerScore = document.createElement('div');
    playerScore.className = 'cardCount';
    playerScore.innerText = `Cards: ${pl.cardCount}`;
    playerDiv.appendChild(playerScore);

    // Card container
    const cardContainer = document.createElement('div');
    cardContainer.className = 'cardContainer';

    // If revealCards=true OR this is the local player's hand, show card face; else show back
    let reveal = (gameState.revealCards || pl.nickname === nickname);

    pl.cards.forEach((card) => {
      const cardDiv = document.createElement('div');
      cardDiv.className = 'card';

      if (reveal) {
        // Map suits to file names, e.g. ♠ => 'S', 9♠ => 9S.png
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

        // Optionally add a flip animation if round ended:
        if (gameState.roundEnded) {
          cardDiv.classList.add('flip');
        }
      } else {
        // Show back of card
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
    if (currentPlayer.nickname === nickname) {
      actionButtons.style.display = 'block';
      // If no currentHand declared yet, disable check
      if (gameState.currentHand === null) {
        checkButton.disabled = true;
        checkButton.classList.add('disabled');
      } else {
        checkButton.disabled = false;
        checkButton.classList.remove('disabled');
      }
    } else {
      actionButtons.style.display = 'none';
    }
  } else {
    actionButtons.style.display = 'none';
  }

  // Status Message
  statusMessageDiv.innerText = gameState.statusMessage;

  // Proceed Next Round
  if (gameState.roundEnded) {
    proceedContainer.style.display = 'block';
    if (gameState.playersReady[nickname]) {
      proceedButton.disabled = true;
      proceedButton.classList.add('disabled');
    } else {
      proceedButton.disabled = false;
      proceedButton.classList.remove('disabled');
    }
  } else {
    proceedContainer.style.display = 'none';
  }

  // === HAND SELECTION (Category Grid + Modal) ===
  if (gameState.selectingHand && gameState.players[gameState.currentPlayerIndex].nickname === nickname) {
    handSelection.style.display = 'block';
    generateCategoryGrid();  // Show category tiles
  } else {
    handSelection.style.display = 'none';
  }
}

// 1) HELPER FUNCTION: Create a mini rank image element
function createRankImage(rank) {
  const img = document.createElement('img');
  img.src = `/img/cards_small/${rank}_small.png`;
  img.className = 'miniCard';
  img.style.width = '30px';
  img.style.margin = '2px';
  return img;
}

// 2) HELPER FUNCTION: Fill a button with the mini card sprites for the given hand
function populateHandButton(handBtn, hand) {
  // Clear any existing text
  handBtn.innerHTML = '';

  if (hand.startsWith('Single')) {
    // Single X => 1 card
    const rank = hand.split(' ')[1];  // e.g. "9"
    handBtn.appendChild(createRankImage(rank));

  } else if (hand.startsWith('Double')) {
    // Double X => 2 cards
    const rank = hand.split(' ')[1];
    for (let i = 0; i < 2; i++) {
      handBtn.appendChild(createRankImage(rank));
    }

  } else if (hand.startsWith('Triple')) {
    // Triple X => 3 cards
    const rank = hand.split(' ')[1];
    for (let i = 0; i < 3; i++) {
      handBtn.appendChild(createRankImage(rank));
    }

  } else if (hand.startsWith('Quadruple')) {
    // Quadruple X => 4 cards
    const rank = hand.split(' ')[1];
    for (let i = 0; i < 4; i++) {
      handBtn.appendChild(createRankImage(rank));
    }

  } else if (hand.startsWith('2 Pairs')) {
    // 2 Pairs X-Y => 2 of X, 2 of Y
    // e.g. "2 Pairs 9-10" => rank1 = '9', rank2 = '10'
    const pairString = hand.split(' ')[2]; // e.g. "9-10"
    const [rank1, rank2] = pairString.split('-');
    for (let i = 0; i < 2; i++) {
      handBtn.appendChild(createRankImage(rank1));
    }
    for (let i = 0; i < 2; i++) {
      handBtn.appendChild(createRankImage(rank2));
    }

  } else if (hand.startsWith('Full House')) {
    // Full House X => triple of X + any double
    // If your naming is "Full House 9", we only know the triple rank (9).
    // We can only partially represent that. For a nice example:
    const rank = hand.split(' ')[2]; // e.g. '9'
    // Show 3 rank X + 2 rank Y if you know Y, else use a placeholder:
    for (let i = 0; i < 3; i++) {
      handBtn.appendChild(createRankImage(rank));
    }
    // Possibly append 2 placeholders or question marks?
    // handBtn.appendChild(createRankImage('QMark'));
    // Or if your naming scheme passes both triple + double rank in the hand name, parse that.

  } else if (hand === 'Small Street') {
    // 9, 10, J, Q, K
    ['9', '10', 'J', 'Q', 'K'].forEach(r => {
      handBtn.appendChild(createRankImage(r));
    });

  } else if (hand === 'Big Street') {
    // 10, J, Q, K, A
    ['10', 'J', 'Q', 'K', 'A'].forEach(r => {
      handBtn.appendChild(createRankImage(r));
    });
  }
  else {
    // If unrecognized, just show the hand text or a fallback
    populateHandButton(handBtn, hand);
  }
}

// 3) The code in your openHandModal() or wherever you build the hand buttons
function openHandModal(category) {
  const modal = document.getElementById('handModal');
  const modalHandOptions = document.getElementById('modalHandOptions');
  modalHandOptions.innerHTML = '';

  const possibleHands = gameState.hands[category];
  const currentHandIndex = gameState.currentHand 
    ? gameState.handRanks.indexOf(gameState.currentHand) 
    : -1;

  possibleHands.forEach(hand => {
    const handBtn = document.createElement('button');
    handBtn.className = 'handOption';

    // Instead of text label, fill button with mini rank images:
    populateHandButton(handBtn, hand);

    // If not strong enough to beat the current hand, disable the button
    if (gameState.handRanks.indexOf(hand) <= currentHandIndex) {
      handBtn.disabled = true;
      handBtn.classList.add('disabled');
    }

    handBtn.addEventListener('click', () => {
      socket.emit('playerMove', { 
        lobbyName: currentLobbyName, 
        move: 'trump', 
        selectedHand: hand 
      });
      closeHandModal();
    });

    modalHandOptions.appendChild(handBtn);
  });

  modal.style.display = 'block';
}

function generateCategoryGrid() {
  const categoryGrid = document.getElementById('categoryGrid');
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

function openHandModal(category) {
  const modal = document.getElementById('handModal');
  const modalCategoryTitle = document.getElementById('modalCategoryTitle');
  const modalHandOptions = document.getElementById('modalHandOptions');

  modalCategoryTitle.textContent = category;  // e.g. "Singles"
  modalHandOptions.innerHTML = '';           // Clear old hands

  const possibleHands = gameState.hands[category]; 
  const currentHandIndex = gameState.currentHand ? gameState.handRanks.indexOf(gameState.currentHand) : -1;

  // For each hand in this category, create a button
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
      // Emit the player move with the selected hand
      socket.emit('playerMove', { lobbyName: currentLobbyName, move: 'trump', selectedHand: hand });
      closeHandModal();
    });
    
    modalHandOptions.appendChild(handBtn);
  });

  modal.style.display = 'block';
}

function closeHandModal() {
  document.getElementById('handModal').style.display = 'none';
}

// Close button (X)
document.getElementById('closeModal').addEventListener('click', closeHandModal);

// Also close if user clicks outside the .modal-content
window.addEventListener('click', (event) => {
  const modal = document.getElementById('handModal');
  if (event.target === modal) {
    closeHandModal();
  }
});

function generateHandGrid() {
  handGrid.innerHTML = '';

  const handRanks = gameState.handRanks;
  const currentHandIndex = gameState.currentHand ? handRanks.indexOf(gameState.currentHand) : -1;

  // We read the categories from gameState.hands
  const categories = Object.keys(gameState.hands); // e.g. Singles, Doubles, 2 Pairs, etc.

  categories.forEach((category) => {
    const row = document.createElement('div');
    row.className = 'handRow';

    const rowTitle = document.createElement('div');
    rowTitle.className = 'rowTitle';
    rowTitle.innerText = category;
    row.appendChild(rowTitle);

    const handsInCategory = gameState.hands[category];
    handsInCategory.forEach((hand) => {
      const handButton = document.createElement('button');
      handButton.className = 'handButton';
      handButton.innerText = hand;

      const handIndex = handRanks.indexOf(hand);
      if (handIndex <= currentHandIndex) {
        handButton.disabled = true;
        handButton.classList.add('disabled');
      } else {
        handButton.addEventListener('click', () => {
          socket.emit('playerMove', { lobbyName: currentLobbyName, move: 'trump', selectedHand: hand });
        });
      }

      row.appendChild(handButton);
    });
    handGrid.appendChild(row);
  });
}

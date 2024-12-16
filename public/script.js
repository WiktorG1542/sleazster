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
    let item = document.createElement('div');
    const isInGame = lobby.inGame ? '(In Game)' : '(Waiting)';
    item.innerHTML = `<strong>${lobby.lobbyName}</strong> ${isInGame} - Leader: ${lobby.leaderId}<br>
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

  playersContainer.innerHTML = '';

  gameState.players.forEach((pl, index) => {
    const playerDiv = document.createElement('div');
    playerDiv.className = 'playerDiv';

    // Player Name
    const playerName = document.createElement('h2');
    playerName.innerText = pl.nickname;
    playerDiv.appendChild(playerName);

    // Card Count
    const playerScore = document.createElement('div');
    playerScore.className = 'cardCount';
    playerScore.innerText = `Cards: ${pl.cardCount}`;
    playerDiv.appendChild(playerScore);

    // Cards container
    const cardContainer = document.createElement('div');
    cardContainer.className = 'cardContainer';

    let reveal = (gameState.revealCards || pl.nickname === nickname);

    pl.cards.forEach((card) => {
      // Use a <div> for the card, or an <img> referencing the sprite
      const cardDiv = document.createElement('div');
      cardDiv.className = 'card';

      if (reveal) {
        // e.g. card.value = '9', card.suit = '♠'
        // We'll map these to something like 9S.png (9 of spades)
        // But your suits are stored in textual form; we can do a quick mapping:
        let suitChar = card.suit;
        let suitKey = '';
        switch(suitChar) {
          case '♣': suitKey = 'C'; break;
          case '♦': suitKey = 'D'; break;
          case '♥': suitKey = 'H'; break;
          case '♠': suitKey = 'S'; break;
        }

        // e.g. "9S.png", "10C.png" ...
        const spriteFilename = `${card.value}${suitKey}.png`; 
        const cardImg = document.createElement('img');
        cardImg.src = `/img/cards/${spriteFilename}`;
        cardImg.className = 'cardFace';
        cardDiv.appendChild(cardImg);

        // Add a flipping class if we are in reveal mode
        if (gameState.roundEnded) {
          cardDiv.classList.add('flip');
        }

      } else {
        // Back of card sprite
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

  // Current player controls
  if (!gameState.roundEnded) {
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (currentPlayer.nickname === nickname) {
      actionButtons.style.display = 'block';
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

  // Status message
  statusMessageDiv.innerText = gameState.statusMessage;

  // Proceed next round
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

  // Hand selection grid
  if (gameState.selectingHand && gameState.players[gameState.currentPlayerIndex].nickname === nickname) {
    handSelection.style.display = 'block';
    generateHandGrid();
  } else {
    handSelection.style.display = 'none';
  }
}

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

// script.js

let playerScore = 0;
let computerScore = 0;
let deck = createDeck();

document.getElementById('playRound').addEventListener('click', playRound);
document.getElementById('resetGame').addEventListener('click', resetGame);

function createDeck() {
  const suits = ['♠', '♣', '♦', '♥'];
  const values = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]; // 11-14 for J, Q, K, A
  let deck = [];
  for (let suit of suits) {
    for (let value of values) {
      deck.push({ suit, value });
    }
  }
  return deck.sort(() => Math.random() - 0.5); // Shuffle deck
}

function playRound() {
  if (deck.length === 0) {
    endGame();
    return;
  }

  const playerCard = deck.pop();
  const computerCard = deck.pop();
  let roundResult = '';

  if (playerCard.value > computerCard.value) {
    playerScore++;
    roundResult = `You win this round! You drew ${playerCard.value}${playerCard.suit} and the computer drew ${computerCard.value}${computerCard.suit}.`;
  } else if (computerCard.value > playerCard.value) {
    computerScore++;
    roundResult = `Computer wins this round! You drew ${playerCard.value}${playerCard.suit} and the computer drew ${computerCard.value}${computerCard.suit}.`;
  } else {
    roundResult = `It's a tie! Both drew ${playerCard.value}${playerCard.suit}.`;
  }

  document.getElementById('status').innerText = roundResult;
  document.getElementById('playerScore').innerText = `Your Score: ${playerScore}`;
  document.getElementById('computerScore').innerText = `Computer Score: ${computerScore}`;

  if (deck.length === 0) {
    endGame();
  }
}

function endGame() {
  document.getElementById('playRound').style.display = 'none';
  document.getElementById('resetGame').style.display = 'inline';
  const finalMessage = playerScore > computerScore
    ? "Game Over! You win!"
    : playerScore < computerScore
      ? "Game Over! Computer wins!"
      : "Game Over! It's a tie!";
  document.getElementById('status').innerText = finalMessage;
}

function resetGame() {
  playerScore = 0;
  computerScore = 0;
  deck = createDeck();
  document.getElementById('playRound').style.display = 'inline';
  document.getElementById('resetGame').style.display = 'none';
  document.getElementById('status').innerText = "Click 'Play Round' to start the game";
  document.getElementById('playerScore').innerText = `Your Score: ${playerScore}`;
  document.getElementById('computerScore').innerText = `Computer Score: ${computerScore}`;
}

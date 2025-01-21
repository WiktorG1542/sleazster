# OBLECH - MongoDB Game with Bots and Leaderboard

OBLECH is a multiplayer card game enhanced with MongoDB for database management and bots for automated gameplay. This README provides an overview of the game, the dependencies, the tech stack, and detailed installation and usage instructions.

---

## Features

- **Multiplayer Gameplay**: Connect with other players and compete in real-time.
- **Database-Backed**: MongoDB is used to store user data, game states, and leaderboards.
- **Bots**: Add bots to games for solo or mixed gameplay.
- **Leaderboards**: Track wins and compare scores with other players.
- **Responsive UI**: User-friendly interface for easy navigation and interaction.

---

## Tech Stack

- **Backend**: Node.js, Express.js
- **Frontend**: EJS Templates, HTML, CSS
- **Database**: MongoDB
- **Realtime Communication**: Socket.IO
- **Deployment**: Docker, optional ngrok for external access

---

## Dependencies

The project uses the following npm packages:
- `express`
- `ejs`
- `socket.io`
- `mongoose`
- `express-session`
- `body-parser`

---

## Installation Instructions

### Prerequisites

Ensure you have the following installed:
- **Node.js**: `>=16.0`
- **MongoDB**: (Managed via Docker in this setup)
- **Docker**

---

### Steps to Set Up Locally (Without ngrok)

1. **Clone the repository**:
   ```
   git clone https://github.com/your-repo/oblech.git
   cd oblech
   ```

2. **Install Node.js dependencies**:
   ```
   npm install
   ```

3. **Set up MongoDB with Docker**:
   Use the provided `run-and-load.sh` script to start a MongoDB container and populate it with initial data.
   ```
   ./run-and-load.sh
   ```

4. **Start the server**:
   ```
   npm start
   ```

5. **Access the game**:
   Open your browser and navigate to:
   ```
   http://localhost:5000
   ```

---

### Steps to Enable External Access (With ngrok)

1. **Install ngrok**:
   ```
    curl -sSL https://ngrok-agent.s3.amazonaws.com/ngrok.asc \
        | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null \
        && echo "deb https://ngrok-agent.s3.amazonaws.com buster main" \
        | sudo tee /etc/apt/sources.list.d/ngrok.list \
        && sudo apt update \
        && sudo apt install ngrok
   ```

2. **Authenticate ngrok**:
   Sign up on the [ngrok website](https://ngrok.com) and get your authtoken. Then authenticate:
   ```
   ngrok config add-authtoken <your-authtoken>
   ```

3. **Start the server**:
   ```
   npm start
   ```

4. **Expose your server via ngrok**:
   Run the following to expose port 5000:
   ```
   ngrok http 5000
   ```

5. **Share the URL**:
   ngrok will provide a public URL (e.g., `https://1234-5678.ngrok.io`). Share this URL with other players to enable multiplayer.

---

## How to Play

1. **Login/Register**:
   Use the preloaded users from `users.json`.

2. **Create or Join Lobbies**:
   - Create a lobby to start a game.
   - Join an existing lobby using its unique ID.

3. **Gameplay**:
   - Take turns declaring hands or challenging others.
   - Use bots for practice or to fill out the player slots.

4. **Leaderboards**:
   Track your performance and compare it with others.

---

Enjoy the game!

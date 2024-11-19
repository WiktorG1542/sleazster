# First single player demo

This simple single player demo showcases the card structures
in a very simple "War" card game format. The front-end is just
pure HTML and CSS, but as a whole it provides a base that we can
expand upon and further develop, starting probably with the
full game logic.

To use this little demo, all you have to do is:

```
git clone https://github.com/WiktorG1542/sleazster.git
cd sleazster
npm install
node server.js
```

Then visit the game in your local browser at [http://localhost:3000](http://localhost:3000).
You can visit the game from other devices connected to the same network by changing localhost to the ip adress of the host

## things to add

* all of the hands
* also make the icons of the hands be "1A" instead of "Single A"
* cards not getting smaller as the game progresses and you have more
* the player that loses should start the next round

# Functionalities

* Single and multi-player gameplay.
* Ability to play against AI opponents.
* Modifications of the gameplay flow that players can choose  
* Visually appealing design, engaging graphics
to enhance the gaming experience.
* In-game chat to enable player communication during gameplay.

# Technologies

To create a robust and engaging card game website that works seamlessly
on both desktop and mobile devices, we will pick out and utilize **SOME**
of the following technologies:
* Node.js
* Express
* Socket.IO
* React
* Redux
* Pixi.js
* Bootstrap

## Deployment:

* Node.js Environment: The backend might be set up as a Node.js
application, managing real-time data and user interactions effectively.
* Docker: For containerizing the application, making it easy to
deploy across different environments.
* GitHub Actions: For CI/CD to automate testing and deployment
processes.

## Mobile Responsiveness:

Responsive Web Design: Using media queries and flexible layouts to
ensure the game is playable on various devices, including smartphones
and tablets.

# FrontEnd design

Here are some mind maps of various views that will be accessible to
the end user when playing:

![](./img/1.jpg)

![](./img/2.jpg)

![](./img/3.jpg)

# Roadmap (until december)
The plan for november is to build a demo singleplayer version of the base game, to present the 
mechanics at the core of the game and get familiar with the technologies we will be using. 

## 29.10 - 05.11

Implementation of card structures and rudimentary frontend.
Backend + Frontend

## 05.11 - 12.11

Implementation of card dealing mechanics and main game loop element (Lying, checking, declaring)
Backend + Frontend

## 12.11 - 19.11

Implementation of round ending and giving penalties to losing players
Frontend + Backend
Testing and debugging

## 19.11 - 26.11

Final polish of the prototype, simple main menu



const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors({ origin: "http://localhost:5173" }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  }
});

// Initial game state
const gameState = {
  grid: Array(5).fill(null).map(() => Array(5).fill(null)),
  players: {
    A: { characters: [], remaining: 5, deployed: false },
    B: { characters: [], remaining: 5, deployed: false },
  },
  currentTurn: 'A',
  gameOver: false,
};

function createCharacter(type, player, position) {
  return { type, player, position, moves: type === 'Pawn' ? 1 : 2 };
}

function deployCharacters(player, characters) {
  console.log(`Attempting to deploy characters for player: ${player}`);
  
  if (gameState.players[player].deployed) {
    console.log(`Player ${player} has already deployed characters.`);
    return;
  }

  const row = player === 'A' ? 0 : 4;
  
  gameState.grid[row] = gameState.grid[row].map(cell => (cell && cell.player === player ? null : cell));

  characters.forEach((char, index) => {
    const position = { x: index, y: row };
    if (gameState.grid[row][index] === null) {
      const character = createCharacter(char.type, player, position);
      gameState.grid[row][index] = character;
      gameState.players[player].characters.push(character);
      console.log(`Character deployed for ${player} at position ${index}`);
    } else {
      console.log(`Position ${index} in row ${row} is already occupied or invalid.`);
    }
  });

  gameState.players[player].deployed = true;

  if (gameState.players.A.deployed && gameState.players.B.deployed) {
    gameState.currentTurn = gameState.currentTurn === 'A' ? 'B' : 'A';
  }
  broadcastMessage({ type: 'update', gameState });
}

function calculateNewPosition(x, y, move, steps) {
  switch (move) {
    case 'L': return { x: x - steps, y };
    case 'R': return { x: x + steps, y };
    case 'F': return { x, y: y - steps };
    case 'B': return { x, y: y + steps };
    default: return null;
  }
}

function calculateNewDiagonalPosition(x, y, move, steps) {
  switch (move) {
    case 'FL': return { x: x - steps, y: y - steps };
    case 'FR': return { x: x + steps, y: y - steps };
    case 'BL': return { x: x - steps, y: y + steps };
    case 'BR': return { x: x + steps, y: y + steps };
    default: return null;
  }
}

function isValidMove(character, position) {
  if (!position) return false;
  const { x, y } = position;
  if (x < 0 || x > 4 || y < 0 || y > 4) return false;
  const targetCell = gameState.grid[y][x];
  if (targetCell && targetCell.player === character.player) return false;
  return true;
}

function removeCharacter(character) {
  const opponent = character.player === 'A' ? 'B' : 'A';
  gameState.players[opponent].characters = gameState.players[opponent].characters.filter(c => c !== character);
  gameState.players[opponent].remaining--;
  if (gameState.players[opponent].remaining === 0) {
    gameState.gameOver = true;
    broadcastMessage({ type: 'gameOver', winner: gameState.currentTurn });
  }
}

function performMove(character, newPosition) {
  const { x: startX, y: startY } = character.position;
  const { x: endX, y: endY } = newPosition;
  
  if (character.type !== 'Pawn') {
    const dx = Math.sign(endX - startX);
    const dy = Math.sign(endY - startY);
    for (let i = 1; i <= character.moves; i++) {
      const x = startX + i * dx;
      const y = startY + i * dy;
      if (x >= 0 && x < 5 && y >= 0 && y < 5) {
        const targetCell = gameState.grid[y][x];
        if (targetCell && targetCell.player !== character.player) {
          removeCharacter(targetCell);
        }
      }
    }
  }
  gameState.grid[startY][startX] = null;
  character.position = newPosition;
  gameState.grid[endY][endX] = character;

  gameState.currentTurn = gameState.currentTurn === 'A' ? 'B' : 'A';

  broadcastMessage({ type: 'update', gameState });
}

function broadcastMessage(message) {
  io.emit('message', message);
}

io.on('connection', (socket) => {
  console.log('New socket connection established:', socket.id);

  socket.emit('connected', { message: 'Connection established' });
  socket.emit('update', gameState);

  socket.on('deploy', (data) => {
    deployCharacters(data.player, data.characters);
  });

  socket.on('move', (data) => {
    const character = gameState.players[gameState.currentTurn].characters.find(c => c.type === data.character);
    if (character) {
      let newPosition;
      if (character.type === 'Hero2') {
        newPosition = calculateNewDiagonalPosition(character.position.x, character.position.y, data.move, character.moves);
      } else {
        newPosition = calculateNewPosition(character.position.x, character.position.y, data.move, character.moves);
      }

      if (newPosition && isValidMove(character, newPosition)) {
        performMove(character, newPosition);
      } else {
        socket.emit('invalid', { message: 'Invalid move!' });
      }
    } else {
      socket.emit('invalid', { message: 'Character not found!' });
    }
  });

  socket.on('disconnect', () => {
    console.log('Socket connection closed:', socket.id);
  });
});

server.listen(8080, () => console.log('Server running on port 8080'));

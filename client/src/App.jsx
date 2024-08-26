import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';
import './index.css';

const socket = io('http://localhost:8080');

function App() {
  const [player, setPlayer] = useState('A');

  const [gameState, setGameState] = useState({
    grid: Array(5).fill(null).map(() => Array(5).fill(null)),
    players: { A: { characters: [], remaining: 5 }, B: { characters: [], remaining: 5 } },
    currentTurn: 'A',
    gameOver: false,
  });
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const [deployments, setDeployments] = useState({
    A: Array(5).fill(''),
    B: Array(5).fill(''),
  });

  console.log(gameState.currentTurn);
  

 useEffect(() => {
    socket.on('message', (message) => {
      if (message.type === 'update') {
        setGameState(message.gameState);
        setPlayer(message.gameState.currentTurn);
      } else if (message.type === 'invalid') {
        alert(message.message);
      } else if (message.type === 'gameOver') {
        alert(`Player ${message.winner} wins!`);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleCharacterSelect = (character) => {
    if (character && gameState.currentTurn === character.player) {
      setSelectedCharacter(character);
    } else {
      console.log(`Character selection failed. Current turn: ${gameState.currentTurn}, Character player: ${character?.player}`);
    }
  };

  const handleMove = (move) => {
    if (selectedCharacter) {
      socket.emit('move', { character: selectedCharacter.type, move: move });
      setSelectedCharacter(null);
    } else {
      console.log('No character selected.');
    }
  };

  const handleDeploymentChange = (index, value) => {
    const newDeployments = { ...deployments };
    newDeployments[player][index] = value;
    setDeployments(newDeployments);
  };

  const handleDeploy = () => {
    const characters = deployments[player].map(name => {
      if (name) {
        return { type: name };
      }
      return null;
    }).filter(char => char !== null);
  
    console.log(`Deploying characters for ${player}:`, characters);
    socket.emit('deploy', { player, characters });
  };
  

  const renderGrid = () => {
    return gameState.grid.map((row, y) =>
      row.map((cell, x) => (
        <div
          key={`${x}-${y}`}
          className={`w-16 h-16 flex items-center justify-center border ${cell ? 'bg-blue-500 text-white' : 'bg-gray-700'}`}
          onClick={() => cell && handleCharacterSelect(cell)}
        >
          {cell ? `${cell.player}-${cell.type}` : ''}
        </div>
      ))
    );
  };

  const renderMoveButtons = () => {
    if (!selectedCharacter) return null;
    console.log("THIS IT",selectedCharacter.type);
    
    if (selectedCharacter.type === 'H2') {
      return (
        <>
          <button onClick={() => handleMove('FL')} className="bg-blue-700 text-white px-4 py-2 m-2">FL</button>
          <button onClick={() => handleMove('FR')} className="bg-blue-700 text-white px-4 py-2 m-2">FR</button>
          <button onClick={() => handleMove('BL')} className="bg-blue-700 text-white px-4 py-2 m-2">BL</button>
          <button onClick={() => handleMove('BR')} className="bg-blue-700 text-white px-4 py-2 m-2">BR</button>
        </>
      );
    } else {
      return (
        <>
          <button onClick={() => handleMove('L')} className="bg-blue-700 text-white px-4 py-2 m-2">L</button>
          <button onClick={() => handleMove('R')} className="bg-blue-700 text-white px-4 py-2 m-2">R</button>
          <button onClick={() => handleMove('F')} className="bg-blue-700 text-white px-4 py-2 m-2">F</button>
          <button onClick={() => handleMove('B')} className="bg-blue-700 text-white px-4 py-2 m-2">B</button>
        </>
      );
    }
  };

  return (
    <div className="flex flex-col items-center mt-10 bg-black">
      {gameState.gameOver ? (
        <div className="text-white text-lg mb-4">Game Over</div>
      ) : (
        <>
          <div className="text-white text-lg mb-2">Current Player: {gameState.currentTurn}</div>
          <div className="grid grid-cols-5 gap-2 mb-4">
            {renderGrid()}
          </div>
          <div className="text-white">
            Selected: {selectedCharacter ? `${selectedCharacter.player}-${selectedCharacter.type}` : 'None'}
          </div>
          <div className="mt-4 space-x-2">
            {renderMoveButtons()}
          </div>
          <div className="mt-6">
            <h2 className="text-white">Deploy Characters</h2>
            {deployments[player].map((char, index) => (
              <input
                key={index}
                type="text"
                value={char}
                onChange={(e) => handleDeploymentChange(index, e.target.value)}
                placeholder={`Char ${index + 1} (e.g., Pawn, Hero1, Hero2)`}
                className="mb-2 p-1"
              />
            ))}
            <button onClick={handleDeploy} className="bg-blue-700 text-white px-4 py-2 mt-2">Deploy</button>
          </div>
        </>
      )}
    </div>
  );
}

export default App;

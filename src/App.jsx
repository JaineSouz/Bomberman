import React, { useState, useEffect, useCallback, useRef } from 'react';

const GRID_SIZE = 13;
const CELL_SIZE = 40;
const BOMB_TIMER = 3000;
const EXPLOSION_DURATION = 500;
const BOMB_RANGE = 2;

const App = () => {
  const [playerPos, setPlayerPos] = useState({ x: 1, y: 1 });
  const [bombs, setBombs] = useState([]);
  const [explosions, setExplosions] = useState([]);
  const [walls, setWalls] = useState([]);
  const [breakableWalls, setBreakableWalls] = useState([]);
  const [enemies, setEnemies] = useState([]);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  
  const wallsRef = useRef(walls);
  const breakableWallsRef = useRef(breakableWalls);
  
  useEffect(() => {
    wallsRef.current = walls;
  }, [walls]);
  
  useEffect(() => {
    breakableWallsRef.current = breakableWalls;
  }, [breakableWalls]);

  // Inicializar paredes e inimigos
  useEffect(() => {
    const newWalls = [];
    const newBreakableWalls = [];
    
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        // Paredes fixas (padrão xadrez)
        if (x % 2 === 0 && y % 2 === 0) {
          newWalls.push({ x, y });
        }
        // Paredes quebráveis aleatórias
        else if (Math.random() > 0.7 && !(x <= 2 && y <= 2)) {
          newBreakableWalls.push({ x, y });
        }
      }
    }
    
    setWalls(newWalls);
    setBreakableWalls(newBreakableWalls);
    
    // Criar inimigos em posições aleatórias
    const newEnemies = [];
    for (let i = 0; i < 4; i++) {
      let x, y;
      do {
        x = Math.floor(Math.random() * GRID_SIZE);
        y = Math.floor(Math.random() * GRID_SIZE);
      } while (
        (x <= 2 && y <= 2) || // Longe do spawn do jogador
        newWalls.some(w => w.x === x && w.y === y) ||
        newBreakableWalls.some(w => w.x === x && w.y === y) ||
        newEnemies.some(e => e.x === x && e.y === y)
      );
      newEnemies.push({ x, y, id: i });
    }
    setEnemies(newEnemies);
  }, []);

  // Verificar colisão
  const canMoveTo = useCallback((x, y, checkEnemies = false) => {
    if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) return false;
    if (walls.some(w => w.x === x && w.y === y)) return false;
    if (breakableWalls.some(w => w.x === x && w.y === y)) return false;
    if (bombs.some(b => b.x === x && b.y === y)) return false;
    if (checkEnemies && enemies.some(e => e.x === x && e.y === y)) return false;
    return true;
  }, [walls, breakableWalls, bombs, enemies]);

  // Movimentação dos inimigos (IA simples)
  useEffect(() => {
    if (gameOver || enemies.length === 0) return;
    
    const moveEnemies = setInterval(() => {
      setEnemies(prev => prev.map(enemy => {
        const directions = [
          { x: enemy.x + 1, y: enemy.y },
          { x: enemy.x - 1, y: enemy.y },
          { x: enemy.x, y: enemy.y + 1 },
          { x: enemy.x, y: enemy.y - 1 }
        ].filter(pos => canMoveTo(pos.x, pos.y, false));
        
        if (directions.length > 0) {
          const newPos = directions[Math.floor(Math.random() * directions.length)];
          return { ...enemy, x: newPos.x, y: newPos.y };
        }
        return enemy;
      }));
    }, 500);
    
    return () => clearInterval(moveEnemies);
  }, [gameOver, canMoveTo, enemies.length]);

  // Verificar colisão jogador com inimigos
  useEffect(() => {
    if (enemies.some(e => e.x === playerPos.x && e.y === playerPos.y)) {
      setGameOver(true);
    }
  }, [playerPos, enemies]);

  // Explodir bomba
  const explodeBomb = useCallback((bomb) => {
    setBombs(prev => prev.filter(b => b.id !== bomb.id));
    
    const newExplosions = [{ x: bomb.x, y: bomb.y }];
    
    // Adicionar explosões nas 4 direções
    const directions = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 }
    ];
    
    directions.forEach(({ dx, dy }) => {
      for (let i = 1; i <= BOMB_RANGE; i++) {
        const x = bomb.x + dx * i;
        const y = bomb.y + dy * i;
        
        if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) break;
        if (wallsRef.current.some(w => w.x === x && w.y === y)) break;
        
        newExplosions.push({ x, y });
        
        if (breakableWallsRef.current.some(w => w.x === x && w.y === y)) break;
      }
    });
    
    setExplosions(newExplosions);
    
    // Verificar se jogador foi atingido (captura a posição atual)
    setPlayerPos(currentPos => {
      if (newExplosions.some(e => e.x === currentPos.x && e.y === currentPos.y)) {
        setGameOver(true);
      }
      return currentPos;
    });
    
    // Destruir paredes quebráveis
    setBreakableWalls(prev => {
      const destroyed = prev.filter(w => 
        !newExplosions.some(e => e.x === w.x && e.y === w.y)
      );
      setScore(s => s + (prev.length - destroyed.length) * 10);
      return destroyed;
    });
    
    // Destruir inimigos
    setEnemies(prev => {
      const surviving = prev.filter(enemy => 
        !newExplosions.some(e => e.x === enemy.x && e.y === enemy.y)
      );
      setScore(s => s + (prev.length - surviving.length) * 50);
      return surviving;
    });
    
    setTimeout(() => {
      setExplosions([]);
    }, EXPLOSION_DURATION);
  }, []);

  // Colocar bomba
  const placeBomb = useCallback((pos) => {
    setBombs(prev => {
      if (prev.some(b => b.x === pos.x && b.y === pos.y)) return prev;
      
      const newBomb = {
        x: pos.x,
        y: pos.y,
        id: Date.now()
      };
      
      setTimeout(() => {
        explodeBomb(newBomb);
      }, BOMB_TIMER);
      
      return [...prev, newBomb];
    });
  }, [explodeBomb]);

  // Controles do jogador
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (gameOver) return;

      if (e.key === ' ') {
        e.preventDefault();
        setPlayerPos(prev => {
          placeBomb(prev);
          return prev;
        });
        return;
      }

      setPlayerPos(prev => {
        let newPos = { ...prev };
        
        switch(e.key) {
          case 'ArrowUp':
          case 'w':
            if (canMoveTo(prev.x, prev.y - 1)) newPos.y--;
            break;
          case 'ArrowDown':
          case 's':
            if (canMoveTo(prev.x, prev.y + 1)) newPos.y++;
            break;
          case 'ArrowLeft':
          case 'a':
            if (canMoveTo(prev.x - 1, prev.y)) newPos.x--;
            break;
          case 'ArrowRight':
          case 'd':
            if (canMoveTo(prev.x + 1, prev.y)) newPos.x++;
            break;
          default:
            return prev;
        }
        
        return newPos;
      });
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [canMoveTo, gameOver, placeBomb]);

  const resetGame = () => {
    setPlayerPos({ x: 1, y: 1 });
    setBombs([]);
    setExplosions([]);
    setGameOver(false);
    setScore(0);
    
    const newBreakableWalls = [];
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        if (x % 2 !== 0 || y % 2 !== 0) {
          if (Math.random() > 0.7 && !(x <= 2 && y <= 2)) {
            newBreakableWalls.push({ x, y });
          }
        }
      }
    }
    setBreakableWalls(newBreakableWalls);
    
    // Recriar inimigos
    const newEnemies = [];
    const newWalls = walls;
    for (let i = 0; i < 4; i++) {
      let x, y;
      do {
        x = Math.floor(Math.random() * GRID_SIZE);
        y = Math.floor(Math.random() * GRID_SIZE);
      } while (
        (x <= 2 && y <= 2) ||
        newWalls.some(w => w.x === x && w.y === y) ||
        newBreakableWalls.some(w => w.x === x && w.y === y) ||
        newEnemies.some(e => e.x === x && e.y === y)
      );
      newEnemies.push({ x, y, id: i });
    }
    setEnemies(newEnemies);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex flex-col items-center justify-center p-4">
      <div className="mb-4 text-center">
        <h1 className="text-4xl font-bold text-white mb-2">💣 Bomberman</h1>
        <p className="text-slate-300 mb-2">Pontuação: {score}</p>
        <p className="text-slate-400 text-sm">WASD/Setas para mover | ESPAÇO para bomba</p>
      </div>

      <div 
        className="relative bg-green-700 border-4 border-slate-700 shadow-2xl"
        style={{ 
          width: GRID_SIZE * CELL_SIZE, 
          height: GRID_SIZE * CELL_SIZE 
        }}
      >
        {/* Grid */}
        {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, i) => {
          const x = i % GRID_SIZE;
          const y = Math.floor(i / GRID_SIZE);
          const isLight = (x + y) % 2 === 0;
          
          return (
            <div
              key={i}
              className={isLight ? 'bg-green-600' : 'bg-green-700'}
              style={{
                position: 'absolute',
                left: x * CELL_SIZE,
                top: y * CELL_SIZE,
                width: CELL_SIZE,
                height: CELL_SIZE
              }}
            />
          );
        })}

        {/* Paredes fixas */}
        {walls.map((wall, i) => (
          <div
            key={`wall-${i}`}
            className="bg-gray-800 border-2 border-gray-900 flex items-center justify-center"
            style={{
              position: 'absolute',
              left: wall.x * CELL_SIZE,
              top: wall.y * CELL_SIZE,
              width: CELL_SIZE,
              height: CELL_SIZE
            }}
          >
            <div className="text-gray-700 text-xl">█</div>
          </div>
        ))}

        {/* Paredes quebráveis */}
        {breakableWalls.map((wall, i) => (
          <div
            key={`bwall-${i}`}
            className="bg-amber-700 border-2 border-amber-800 flex items-center justify-center"
            style={{
              position: 'absolute',
              left: wall.x * CELL_SIZE,
              top: wall.y * CELL_SIZE,
              width: CELL_SIZE,
              height: CELL_SIZE
            }}
          >
            <div className="text-amber-900 text-xl">▓</div>
          </div>
        ))}

        {/* Bombas */}
        {bombs.map(bomb => (
          <div
            key={bomb.id}
            className="bg-black rounded-full border-4 border-gray-800 flex items-center justify-center animate-pulse"
            style={{
              position: 'absolute',
              left: bomb.x * CELL_SIZE + 4,
              top: bomb.y * CELL_SIZE + 4,
              width: CELL_SIZE - 8,
              height: CELL_SIZE - 8
            }}
          >
            <span className="text-2xl">💣</span>
          </div>
        ))}

        {/* Explosões */}
        {explosions.map((exp, i) => (
          <div
            key={`exp-${i}`}
            className="bg-orange-500 opacity-80 flex items-center justify-center animate-pulse"
            style={{
              position: 'absolute',
              left: exp.x * CELL_SIZE,
              top: exp.y * CELL_SIZE,
              width: CELL_SIZE,
              height: CELL_SIZE
            }}
          >
            <span className="text-3xl">💥</span>
          </div>
        ))}

        {/* Inimigos */}
        {enemies.map(enemy => (
          <div
            key={enemy.id}
            className="rounded-lg flex items-center justify-center shadow-lg transition-all duration-500"
            style={{
              position: 'absolute',
              left: enemy.x * CELL_SIZE + 2,
              top: enemy.y * CELL_SIZE + 2,
              width: CELL_SIZE - 4,
              height: CELL_SIZE - 4
            }}
          >
            <span className="text-2xl">👾</span>
          </div>
        ))}

        {/* Jogador */}
        <div
          className="bg-white rounded-lg flex items-center justify-center shadow-lg transition-all duration-100"
          style={{
            position: 'absolute',
            left: playerPos.x * CELL_SIZE + 2,
            top: playerPos.y * CELL_SIZE + 2,
            width: CELL_SIZE - 4,
            height: CELL_SIZE - 4
          }}
        >
          <span className="text-2xl">🤖</span>
        </div>

        {/* Game Over */}
        {gameOver && (
          <div className="absolute inset-0 bg-black bg-opacity-80 flex flex-col items-center justify-center">
            <h2 className="text-4xl font-bold text-red-500 mb-4">💥 GAME OVER!</h2>
            <p className="text-white text-xl mb-4">Pontuação: {score}</p>
            <button
              onClick={resetGame}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
            >
              Jogar Novamente
            </button>
          </div>
        )}
      </div>

      <div className="mt-4 text-slate-400 text-sm text-center">
        <p>Destrua as paredes marrons com bombas! (+10 pts)</p>
        <p>Elimine os inimigos 👾 com explosões! (+50 pts)</p>
        <p>Cuidado para não ser pego pela explosão ou pelos inimigos!</p>
      </div>
    </div>
  );
};

export default App;
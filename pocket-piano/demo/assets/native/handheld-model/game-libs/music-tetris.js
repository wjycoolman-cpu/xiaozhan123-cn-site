// Derived from Jake Gordon's javascript-tetris, MIT; pieces/collision/rotation/drop/line algorithms below.
// Modifications: seeded RNG, explicit accepted-note steps, no timers/DOM/network, row0 line-scan correction.
// Licence included alongside this module in TETRIS-LICENSE.txt.
export function createMusicTetris(seed = 2603003) {
  const nx=10, ny=16, DIR={UP:0,RIGHT:1,DOWN:2,LEFT:3,MIN:0,MAX:3};
  let rng=(seed>>>0)||1, blocks=[], pieces=[], current, next, rows=0, score=0, beats=0, level=1, lost=false;
  function random(a,b){rng=(Math.imul(rng,1664525)+1013904223)>>>0;return a+(rng/4294967296)*(b-a);}
  function getBlock(x,y){return blocks[x]?blocks[x][y]:null;}
  function setBlock(x,y,type){blocks[x]=blocks[x]||[];blocks[x][y]=type;}
  function invalidate(){} function invalidateNext(){} function clearActions(){}
  function addScore(n){score+=n;} function addRows(n){rows+=n;}
  function setCurrentPiece(p){current=p||randomPiece();} function setNextPiece(p){next=p||randomPiece();}
  function lose(){lost=true;}

    var i = { size: 4, blocks: [0x0F00, 0x2222, 0x00F0, 0x4444], color: 'cyan'   };
    var j = { size: 3, blocks: [0x44C0, 0x8E00, 0x6440, 0x0E20], color: 'blue'   };
    var l = { size: 3, blocks: [0x4460, 0x0E80, 0xC440, 0x2E00], color: 'orange' };
    var o = { size: 2, blocks: [0xCC00, 0xCC00, 0xCC00, 0xCC00], color: 'yellow' };
    var s = { size: 3, blocks: [0x06C0, 0x8C40, 0x6C00, 0x4620], color: 'green'  };
    var t = { size: 3, blocks: [0x0E40, 0x4C40, 0x4E00, 0x4640], color: 'purple' };
    var z = { size: 3, blocks: [0x0C60, 0x4C80, 0xC600, 0x2640], color: 'red'    };
    function eachblock(type, x, y, dir, fn) {
      var bit, result, row = 0, col = 0, blocks = type.blocks[dir];
      for(bit = 0x8000 ; bit > 0 ; bit = bit >> 1) {
        if (blocks & bit) {
          fn(x + col, y + row);
        }
        if (++col === 4) {
          col = 0;
          ++row;
        }
      }
    }

    function occupied(type, x, y, dir) {
      var result = false
      eachblock(type, x, y, dir, function(x, y) {
        if ((x < 0) || (x >= nx) || (y < 0) || (y >= ny) || getBlock(x,y))
          result = true;
      });
      return result;
    }

    function unoccupied(type, x, y, dir) {
      return !occupied(type, x, y, dir);
    }

    function randomPiece() {
      if (pieces.length == 0)
        pieces = [i,i,i,i,j,j,j,j,l,l,l,l,o,o,o,o,s,s,s,s,t,t,t,t,z,z,z,z];
      var type = pieces.splice(random(0, pieces.length-1), 1)[0];
      return { type: type, dir: DIR.UP, x: Math.round(random(0, nx - type.size)), y: 0 };
    }

    function move(dir) {
      var x = current.x, y = current.y;
      switch(dir) {
        case DIR.RIGHT: x = x + 1; break;
        case DIR.LEFT:  x = x - 1; break;
        case DIR.DOWN:  y = y + 1; break;
      }
      if (unoccupied(current.type, x, y, current.dir)) {
        current.x = x;
        current.y = y;
        invalidate();
        return true;
      }
      else {
        return false;
      }
    }

    function rotate() {
      var newdir = (current.dir == DIR.MAX ? DIR.MIN : current.dir + 1);
      if (unoccupied(current.type, current.x, current.y, newdir)) {
        current.dir = newdir;
        invalidate();
      }
    }

    function drop() {
      if (!move(DIR.DOWN)) {
        addScore(10);
        dropPiece();
        removeLines();
        setCurrentPiece(next);
        setNextPiece(randomPiece());
        clearActions();
        if (occupied(current.type, current.x, current.y, current.dir)) {
          lose();
        }
      }
    }

    function dropPiece() {
      eachblock(current.type, current.x, current.y, current.dir, function(x, y) {
        setBlock(x, y, current.type);
      });
    }

    function removeLines() {
      var x, y, complete, n = 0;
      for(y = ny - 1 ; y >= 0 ; --y) {
        complete = true;
        for(x = 0 ; x < nx ; ++x) {
          if (!getBlock(x, y))
            complete = false;
        }
        if (complete) {
          removeLine(y);
          y = y + 1; // recheck same line
          n++;
        }
      }
      if (n > 0) {
        addRows(n);
        addScore(100*Math.pow(2,n-1)); // 1: 100, 2: 200, 3: 400, 4: 800
      }
    }

    function removeLine(n) {
      var x, y;
      for(y = n ; y >= 0 ; --y) {
        for(x = 0 ; x < nx ; ++x)
          setBlock(x, y, (y == 0) ? null : getBlock(x, y-1));
      }
    }
  function resetBoard(){blocks=[];pieces=[];current=randomPiece();next=randomPiece();lost=false;}
  function snapshot(){
    const grid=Array.from({length:ny},(_,y)=>Array.from({length:nx},(_,x)=>getBlock(x,y)?.color||null));
    const falling=[];eachblock(current.type,current.x,current.y,current.dir,(x,y)=>falling.push({x,y,color:current.type.color}));
    return {kind:'tetris',width:nx,height:ny,grid,falling,rows,score,beats,level,over:lost,next:{blocks:next.type.blocks[next.dir],color:next.type.color}};
  }
  resetBoard();
  return {snapshot,attack(slot){
    if(!Number.isInteger(slot)||slot<0||slot>7)throw new Error('invalid controller slot');
    if(lost){resetBoard();level++;}
    if(slot===0||slot===4)rotate();
    else if(slot===1||slot===5)move(DIR.LEFT);
    else if(slot===2||slot===6)move(DIR.RIGHT);
    // Every accepted note advances one gravity step; no separate game clock.
    drop();beats++;return snapshot();
  }};
}

// Three small arcade games for the retro computer: Snake, Pong and an Invaders-style shooter.
// Each game draws into a 400 x 400 playfield. The computer (os.js) feeds them time, keys and the mouse.

const FONT = 'Consolas, Menlo, "Lucida Console", "Courier New", monospace';
export const GAME_IDS = ['snake', 'pong', 'invaders'];
export const GAME_TITLES = { snake: 'Snake.exe', pong: 'Pong.exe', invaders: 'Invaders.exe' };
const S = 400;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const KEYMAP = { ArrowUp: 'up', w: 'up', ArrowDown: 'down', s: 'down', ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right', ' ': 'fire', Enter: 'fire' };

class Game {
  constructor(playHint) {
    this.state = 'ready'; // ready -> playing -> over
    this.playHint = playHint;
    this.score = 0;
    this.best = 0;
    this.held = new Set();
    this.px = 0; this.py = 0; this.pin = false;
  }
  start() { this.reset(); this.state = 'playing'; }
  // returns true when the key belongs to the game (so the page does not scroll)
  key(k) {
    const a = KEYMAP[k.length === 1 ? k.toLowerCase() : k];
    if (!a) return false;
    this.held.add(a);
    if (a === 'fire' && this.state !== 'playing') { this.start(); return true; }
    if (this.state === 'playing') this.onAction(a);
    return true;
  }
  keyUp(k) { const a = KEYMAP[k.length === 1 ? k.toLowerCase() : k]; if (a) this.held.delete(a); }
  setPointer(x, y, visible) { this.pin = visible && x >= 0 && x <= S && y >= 0 && y <= S; this.px = x; this.py = y; }
  click() { if (this.state !== 'playing') this.start(); else this.onClick(); }
  onAction() {}
  onClick() {}
  finish() { this.state = 'over'; this.best = Math.max(this.best, this.score); }
  hud() { return ['SCORE ' + String(this.score).padStart(4, '0') + '   BEST ' + String(this.best).padStart(4, '0'), this.state === 'playing' ? this.playHint : 'SPACE or click to start']; }
  overlay(ctx, ox, oy, title, lines) {
    if (this.state === 'playing') return;
    ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.fillRect(ox, oy, S, S);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff'; ctx.font = 'bold 40px ' + FONT;
    ctx.fillText(this.state === 'over' ? 'GAME OVER' : title, ox + S / 2, oy + 130);
    ctx.font = '18px ' + FONT; ctx.fillStyle = '#cfe';
    (this.state === 'over' ? ['Score ' + this.score, 'Press SPACE or click to play again'] : lines).forEach((l, i) => ctx.fillText(l, ox + S / 2, oy + 190 + i * 28));
    ctx.textAlign = 'left';
  }
}

// ---------------------------------------------------------------- Snake
class Snake extends Game {
  constructor() { super('Arrows or WASD to steer'); this.reset(); }
  reset() {
    this.n = 20; this.cell = S / this.n;
    this.body = [[10, 10], [9, 10], [8, 10]];
    this.dir = [1, 0]; this.queue = [];
    this.timer = 0; this.step = 0.125; this.score = 0;
    this.placeFood();
  }
  placeFood() {
    for (;;) {
      const f = [Math.floor(Math.random() * this.n), Math.floor(Math.random() * this.n)];
      if (!this.body.some(([x, y]) => x === f[0] && y === f[1])) { this.food = f; return; }
    }
  }
  onAction(a) {
    const map = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
    const d = map[a];
    if (!d) return;
    const last = this.queue.length ? this.queue[this.queue.length - 1] : this.dir;
    if ((d[0] === -last[0] && d[1] === -last[1]) || (d[0] === last[0] && d[1] === last[1])) return; // no U-turns
    if (this.queue.length < 2) this.queue.push(d);
  }
  update(dt) {
    if (this.state !== 'playing') return;
    this.timer += dt;
    while (this.timer >= this.step && this.state === 'playing') { this.timer -= this.step; this.tick(); }
  }
  tick() {
    if (this.queue.length) this.dir = this.queue.shift();
    const [hx, hy] = this.body[0];
    const nx = hx + this.dir[0], ny = hy + this.dir[1];
    const eats = nx === this.food[0] && ny === this.food[1];
    const hitsBody = this.body.some(([x, y], i) => x === nx && y === ny && (eats || i < this.body.length - 1));
    if (nx < 0 || ny < 0 || nx >= this.n || ny >= this.n || hitsBody) { this.finish(); return; }
    this.body.unshift([nx, ny]);
    if (eats) { this.score += 10; this.step = Math.max(0.055, this.step * 0.97); this.placeFood(); } else this.body.pop();
  }
  draw(ctx, ox, oy) {
    const c = this.cell;
    ctx.fillStyle = '#0b1f10'; ctx.fillRect(ox, oy, S, S);
    ctx.fillStyle = 'rgba(80,200,110,0.07)';
    for (let i = 1; i < this.n; i++) { ctx.fillRect(ox + i * c, oy, 1, S); ctx.fillRect(ox, oy + i * c, S, 1); }
    ctx.fillStyle = '#ff5a3c'; // the food
    ctx.fillRect(ox + this.food[0] * c + 3, oy + this.food[1] * c + 3, c - 6, c - 6);
    ctx.fillStyle = '#ffd0c0'; ctx.fillRect(ox + this.food[0] * c + 5, oy + this.food[1] * c + 5, 3, 3);
    this.body.forEach(([x, y], i) => {
      ctx.fillStyle = i === 0 ? '#d8ffd8' : (i % 2 ? '#58e070' : '#4ccf64');
      ctx.fillRect(ox + x * c + 1, oy + y * c + 1, c - 2, c - 2);
    });
    const [hx, hy] = this.body[0]; // eyes
    ctx.fillStyle = '#0b1f10';
    ctx.fillRect(ox + hx * c + 5, oy + hy * c + 5, 3, 3); ctx.fillRect(ox + hx * c + c - 8, oy + hy * c + 5, 3, 3);
    this.overlay(ctx, ox, oy, 'SNAKE', ['Eat the food, avoid the walls', 'and your own tail.', '', 'Press SPACE or click to start']);
  }
}

// ---------------------------------------------------------------- Pong
class Pong extends Game {
  constructor() { super('Mouse or W/S to move'); this.reset(); }
  reset() {
    this.ph = 70; this.pw = 10;
    this.py1 = S / 2 - this.ph / 2; this.py2 = S / 2 - this.ph / 2;
    this.sPlayer = 0; this.sCpu = 0; this.score = 0;
    this.usePointer = true; this.lastPy = -1;
    this.serve(1);
  }
  serve(dirX) {
    this.bx = S / 2; this.by = S / 2;
    const a = (Math.random() - 0.5) * 0.9;
    this.speed = 230;
    this.vx = Math.cos(a) * this.speed * dirX; this.vy = Math.sin(a) * this.speed;
    this.serveT = 0.9;
  }
  hud() { return ['YOU ' + this.sPlayer + '  :  ' + this.sCpu + ' CPU', this.state === 'playing' ? this.playHint : 'SPACE or click to start']; }
  update(dt) {
    if (this.state !== 'playing') return;
    // the player's paddle: follows the mouse, or W/S and the arrow keys
    if (this.held.has('up') || this.held.has('down')) {
      this.usePointer = false;
      this.py1 += ((this.held.has('down') ? 1 : 0) - (this.held.has('up') ? 1 : 0)) * 380 * dt;
    } else if (this.pin && Math.abs(this.py - this.lastPy) > 1.5) this.usePointer = true;
    if (this.usePointer && this.pin) { const target = this.py - this.ph / 2; this.py1 += clamp(target - this.py1, -700 * dt, 700 * dt); }
    this.lastPy = this.py;
    this.py1 = clamp(this.py1, 0, S - this.ph);
    // the computer's paddle: follows the ball, a little slower than it can go, so it can be beaten
    const aim = this.vx > 0 ? this.by - this.ph / 2 : S / 2 - this.ph / 2;
    const diff = aim - this.py2;
    if (Math.abs(diff) > 8) this.py2 += clamp(diff, -(175 + this.sPlayer * 8) * dt, (175 + this.sPlayer * 8) * dt);
    this.py2 = clamp(this.py2, 0, S - this.ph);
    if (this.serveT > 0) { this.serveT -= dt; return; }
    this.bx += this.vx * dt; this.by += this.vy * dt;
    const r = 6;
    if (this.by < r) { this.by = r; this.vy = Math.abs(this.vy); }
    if (this.by > S - r) { this.by = S - r; this.vy = -Math.abs(this.vy); }
    const hit = (px, py, dir) => { // bounce off a paddle, steeper the further from its middle
      if (this.by < py - r || this.by > py + this.ph + r) return false;
      this.speed = Math.min(520, this.speed * 1.06);
      const off = clamp((this.by - (py + this.ph / 2)) / (this.ph / 2), -1, 1);
      this.vy = off * this.speed * 0.8;
      this.vx = dir * Math.sqrt(Math.max(1, this.speed * this.speed - this.vy * this.vy));
      return true;
    };
    if (this.vx < 0 && this.bx - r <= 16 + this.pw && this.bx + r >= 16) { if (hit(16, this.py1, 1)) this.bx = 16 + this.pw + r; }
    if (this.vx > 0 && this.bx + r >= S - 16 - this.pw && this.bx - r <= S - 16) { if (hit(S - 16 - this.pw, this.py2, -1)) this.bx = S - 16 - this.pw - r; }
    if (this.bx < -r) { this.sCpu++; this.afterPoint(1); }
    if (this.bx > S + r) { this.sPlayer++; this.score = this.sPlayer; this.afterPoint(-1); }
  }
  afterPoint(dirX) {
    if (this.sPlayer >= 7 || this.sCpu >= 7) { this.won = this.sPlayer >= 7; this.score = this.sPlayer; this.finish(); return; }
    this.serve(dirX);
  }
  draw(ctx, ox, oy) {
    ctx.fillStyle = '#000'; ctx.fillRect(ox, oy, S, S);
    ctx.fillStyle = '#555';
    for (let y = 8; y < S; y += 24) ctx.fillRect(ox + S / 2 - 2, oy + y, 4, 12);
    ctx.fillStyle = '#9a9a9a'; ctx.font = 'bold 56px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(this.sPlayer), ox + S / 2 - 70, oy + 50); ctx.fillText(String(this.sCpu), ox + S / 2 + 70, oy + 50);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fff';
    ctx.fillRect(ox + 16, oy + this.py1, this.pw, this.ph);
    ctx.fillRect(ox + S - 16 - this.pw, oy + this.py2, this.pw, this.ph);
    if (this.state !== 'ready') ctx.fillRect(ox + this.bx - 6, oy + this.by - 6, 12, 12);
    if (this.state === 'over') { // who won
      ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.fillRect(ox, oy, S, S);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.font = 'bold 40px ' + FONT;
      ctx.fillText(this.won ? 'YOU WIN!' : 'CPU WINS', ox + S / 2, oy + 140);
      ctx.font = '18px ' + FONT; ctx.fillStyle = '#cfe';
      ctx.fillText(this.sPlayer + ' : ' + this.sCpu + '   Press SPACE or click to rematch', ox + S / 2, oy + 200);
      ctx.textAlign = 'left';
    } else this.overlay(ctx, ox, oy, 'PONG', ['First to 7 points wins.', 'Move the mouse, or use W / S.', '', 'Press SPACE or click to serve']);
  }
}

// ---------------------------------------------------------------- Invaders
const SPRITES = [
  [ // top row: squid
    ['...##...', '..####..', '.######.', '##.##.##', '########', '..#..#..', '.#.##.#.', '#.#..#.#'],
    ['...##...', '..####..', '.######.', '##.##.##', '########', '.#.##.#.', '#......#', '.#....#.'],
  ],
  [ // middle rows: crab
    ['..#.....#..', '...#...#...', '..#######..', '.##.###.##.', '###########', '#.#######.#', '#.#.....#.#', '...##.##...'],
    ['..#.....#..', '#..#...#..#', '#.#######.#', '###.###.###', '###########', '.#########.', '..#.....#..', '.#.......#.'],
  ],
  [ // bottom rows: octopus
    ['....####....', '.##########.', '############', '###..##..###', '############', '...##..##...', '..##.##.##..', '##........##'],
    ['....####....', '.##########.', '############', '###..##..###', '############', '..###..###..', '.##..##..##.', '..##....##..'],
  ],
];
const drawSprite = (ctx, rows, cx, cy, sc, color) => {
  const w = rows[0].length;
  ctx.fillStyle = color;
  rows.forEach((row, j) => { for (let i = 0; i < w; i++) if (row[i] === '#') ctx.fillRect(Math.round(cx - (w * sc) / 2 + i * sc), Math.round(cy - (rows.length * sc) / 2 + j * sc), sc, sc); });
};
const ROW_COLORS = ['#ff6ad5', '#ffd23a', '#ffd23a', '#6af0ff', '#6af0ff'];
const ROW_POINTS = [30, 20, 20, 10, 10];

class Invaders extends Game {
  constructor() { super('A / D or mouse to move, SPACE to fire'); this.reset(); }
  reset() {
    this.score = 0; this.lives = 3; this.wave = 1; this.px = 0;
    this.shipX = S / 2; this.shipBullet = null; this.cool = 0; this.invuln = 0;
    this.alienBullets = []; this.ufo = null; this.ufoT = 12; this.fireT = 1;
    this.usePointer = false; this.lastPx = -1;
    this.buildWave();
    this.buildShields();
  }
  buildWave() {
    this.aliens = [];
    for (let r = 0; r < 5; r++) for (let c = 0; c < 8; c++) this.aliens.push({ r, c, alive: true });
    this.gx = 40; this.gy = 52 + Math.min(4, this.wave - 1) * 8; this.gdir = 1; this.frame = 0; this.stepT = 0;
    this.shipBullet = null; this.alienBullets = [];
  }
  buildShields() {
    const shape = ['..######..', '.########.', '##########', '##########', '###....###']; // a bunker with an arch cut out
    this.shields = [];
    for (let i = 0; i < 4; i++) {
      const cells = shape.map((row) => row.split('').map((ch) => ch === '#'));
      this.shields.push({ x: 48 + i * 90, y: 312, cells });
    }
  }
  alive() { return this.aliens.filter((a) => a.alive); }
  alienPos(a) { return [this.gx + a.c * 38, this.gy + a.r * 28]; }
  onAction(a) { if (a === 'fire') this.fire(); }
  onClick() { this.fire(); }
  fire() { if (!this.shipBullet && this.invuln < 1.2) this.shipBullet = { x: this.shipX, y: 358 }; }
  hud() { return ['SCORE ' + String(this.score).padStart(4, '0') + '  LIVES ' + this.lives + '  WAVE ' + this.wave, this.state === 'playing' ? this.playHint : 'SPACE or click to start']; }
  hitShield(x, y) { // a shot (from either side) eats a small hole in a bunker
    for (const s of this.shields) {
      const cx = Math.floor((x - s.x) / 4), cy = Math.floor((y - s.y) / 4);
      if (cy < 0 || cy >= s.cells.length || cx < 0 || cx >= s.cells[0].length || !s.cells[cy][cx]) continue;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
        const yy = cy + j, xx = cx + i;
        if (yy >= 0 && yy < s.cells.length && xx >= 0 && xx < s.cells[0].length && (Math.abs(i) + Math.abs(j) < 2 || Math.random() < 0.4)) s.cells[yy][xx] = false;
      }
      return true;
    }
    return false;
  }
  update(dt) {
    if (this.state !== 'playing') return;
    // the ship: A/D or arrows, or the mouse
    const dir = (this.held.has('right') ? 1 : 0) - (this.held.has('left') ? 1 : 0);
    if (dir) { this.usePointer = false; this.shipX += dir * 230 * dt; }
    else if (this.pin && Math.abs(this.px - this.lastPx) > 1.5) this.usePointer = true;
    if (this.usePointer && this.pin) this.shipX += clamp(this.px - this.shipX, -420 * dt, 420 * dt);
    this.lastPx = this.px;
    this.shipX = clamp(this.shipX, 18, S - 18);
    if (this.held.has('fire')) this.fire();
    this.invuln = Math.max(0, this.invuln - dt);
    // the shot
    if (this.shipBullet) {
      const b = this.shipBullet; b.y -= 460 * dt;
      if (b.y < 0) this.shipBullet = null;
      else if (this.hitShield(b.x, b.y)) this.shipBullet = null;
      else {
        if (this.ufo && Math.abs(b.x - this.ufo.x) < 16 && Math.abs(b.y - 34) < 10) { this.score += 50 * (1 + Math.floor(Math.random() * 3)); this.ufo = null; this.shipBullet = null; }
        else for (const a of this.alive()) {
          const [ax, ay] = this.alienPos(a);
          if (Math.abs(b.x - ax) < 12 && Math.abs(b.y - ay) < 9) { a.alive = false; this.score += ROW_POINTS[a.r]; this.shipBullet = null; break; }
        }
      }
    }
    // the invaders march: the fewer left, the faster
    const live = this.alive();
    if (!live.length) { this.wave++; this.buildWave(); return; }
    this.stepT += dt;
    const interval = Math.max(0.05, (0.06 + 0.7 * (live.length / 40)) / (1 + (this.wave - 1) * 0.18));
    if (this.stepT >= interval) {
      this.stepT = 0; this.frame ^= 1;
      const minC = Math.min(...live.map((a) => a.c)), maxC = Math.max(...live.map((a) => a.c));
      const left = this.gx + minC * 38 - 12, right = this.gx + maxC * 38 + 12;
      if ((this.gdir > 0 && right + 8 > S - 6) || (this.gdir < 0 && left - 8 < 6)) { this.gdir *= -1; this.gy += 14; }
      else this.gx += this.gdir * 8;
    }
    if (live.some((a) => this.alienPos(a)[1] + 8 >= 346)) { this.lives = 0; this.finish(); return; }
    // the invaders shoot back
    this.fireT -= dt;
    if (this.fireT <= 0 && this.alienBullets.length < 3) {
      this.fireT = Math.max(0.35, 0.5 + Math.random() * 0.8 - this.wave * 0.05);
      const cols = [...new Set(live.map((a) => a.c))];
      const col = cols[Math.floor(Math.random() * cols.length)];
      const shooter = live.filter((a) => a.c === col).sort((p, q) => q.r - p.r)[0];
      const [ax, ay] = this.alienPos(shooter);
      this.alienBullets.push({ x: ax, y: ay + 10 });
    }
    this.alienBullets = this.alienBullets.filter((b) => {
      b.y += 175 * dt;
      if (b.y > S || this.hitShield(b.x, b.y + 4)) return false;
      if (this.invuln <= 0 && Math.abs(b.x - this.shipX) < 14 && b.y > 350 && b.y < 372) {
        this.lives--; this.invuln = 1.8;
        if (this.lives <= 0) this.finish();
        return false;
      }
      return true;
    });
    // now and then a bonus saucer crosses the top
    this.ufoT -= dt;
    if (this.ufoT <= 0 && !this.ufo) { this.ufo = { x: -20, v: 90 }; this.ufoT = 14 + Math.random() * 8; }
    if (this.ufo) { this.ufo.x += this.ufo.v * dt; if (this.ufo.x > S + 24) this.ufo = null; }
  }
  draw(ctx, ox, oy) {
    ctx.fillStyle = '#02030a'; ctx.fillRect(ox, oy, S, S);
    ctx.fillStyle = '#fff'; // a few stars
    for (let i = 0; i < 40; i++) ctx.fillRect(ox + (i * 97) % S, oy + (i * 53) % 300, 1, 1);
    this.alive().forEach((a) => {
      const [x, y] = this.alienPos(a);
      const t = a.r === 0 ? 0 : a.r < 3 ? 1 : 2;
      drawSprite(ctx, SPRITES[t][this.frame], ox + x, oy + y, 2, ROW_COLORS[a.r]);
    });
    this.shields.forEach((s) => s.cells.forEach((row, j) => row.forEach((on, i) => { if (on) { ctx.fillStyle = '#3ddc5a'; ctx.fillRect(ox + s.x + i * 4, oy + s.y + j * 4, 4, 4); } })));
    if (this.ufo) { ctx.fillStyle = '#ff3a3a'; ctx.fillRect(ox + this.ufo.x - 14, oy + 30, 28, 8); ctx.fillRect(ox + this.ufo.x - 8, oy + 26, 16, 5); ctx.fillStyle = '#ffd0d0'; [-8, 0, 8].forEach((d) => ctx.fillRect(ox + this.ufo.x + d - 1, oy + 33, 3, 3)); }
    if (this.invuln <= 0 || Math.floor(this.invuln * 10) % 2) { // the ship (it blinks after being hit)
      ctx.fillStyle = '#6dff7c';
      ctx.fillRect(ox + this.shipX - 14, oy + 366, 28, 7); ctx.fillRect(ox + this.shipX - 9, oy + 360, 18, 7); ctx.fillRect(ox + this.shipX - 2, oy + 352, 4, 9);
    }
    if (this.shipBullet) { ctx.fillStyle = '#fff'; ctx.fillRect(ox + this.shipBullet.x - 1, oy + this.shipBullet.y - 6, 3, 10); }
    ctx.fillStyle = '#ffb347';
    this.alienBullets.forEach((b) => { ctx.fillRect(ox + b.x - 1, oy + b.y, 3, 5); ctx.fillRect(ox + b.x - 2, oy + b.y + 5, 5, 3); });
    ctx.fillStyle = '#2f9a45'; ctx.fillRect(ox, oy + 378, S, 2);
    this.overlay(ctx, ox, oy, 'INVADERS', ['Shoot them all before they land.', 'A / D or the mouse to move,', 'SPACE or click to fire.', '', 'Press SPACE or click to start']);
  }
}

export function createGame(id) {
  return id === 'snake' ? new Snake() : id === 'pong' ? new Pong() : new Invaders();
}

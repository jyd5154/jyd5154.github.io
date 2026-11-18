// The "retro computer" that lives on the 3D monitor. It draws onto a 2D canvas,
// which the 3D scene uses as the screen texture.

import { GAME_IDS, GAME_TITLES, createGame } from './games.js';

const FONT = 'Consolas, Menlo, "Lucida Console", "Courier New", monospace';
const W = 1024;
const H = 768;
const TASKBAR = 40;

const ICONS = [
  { id: 'about', label: 'About', kind: 'doc' },
  { id: 'publications', label: 'Publications', kind: 'folder' },
  { id: 'code', label: 'Code', kind: 'code' },
  { id: 'data', label: 'Data', kind: 'data' },
  { id: 'cv', label: 'CV', kind: 'pdf' },
  { id: 'secret', label: 'Secret', kind: 'lock' },
  { id: 'snake', label: 'Snake', kind: 'snake' },
  { id: 'pong', label: 'Pong', kind: 'pong' },
  { id: 'invaders', label: 'Invaders', kind: 'invaders' },
];
const ICON_ROWS = 6; // icons per column on the desktop
const SECRET_CODE = '8868';
// The portrait is stored scrambled (portrait.bin, not a .png), unscrambled only in memory and drawn straight onto the screen canvas,
// so there is no picture to right-click or drag out. (A screenshot can never be prevented by any web page.)
const PORTRAIT_KEY = [14,201,77,130,42,9,188,241,63,120,5,177,98,222,35,150,71,19,244,108,53,166,27,209,90,134,48,255,12,183,66,101];

function wrap(ctx, text, maxW) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const t = line ? line + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = t;
  }
  if (line) lines.push(line);
  return lines;
}

function bevel(ctx, x, y, w, h, pressed = false, fill = '#c0c0c0') {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = pressed ? '#404040' : '#ffffff';
  ctx.fillRect(x, y, w, 2);
  ctx.fillRect(x, y, 2, h);
  ctx.fillStyle = pressed ? '#ffffff' : '#404040';
  ctx.fillRect(x, y + h - 2, w, 2);
  ctx.fillRect(x + w - 2, y, 2, h);
}

function drawIcon(ctx, kind, x, y) {
  // 48x48 pixel-art style icons
  ctx.save();
  ctx.translate(x, y);
  ctx.textBaseline = 'alphabetic';
  if (kind === 'folder') {
    ctx.fillStyle = '#e8c547'; ctx.fillRect(2, 10, 44, 32);
    ctx.fillStyle = '#c9a227'; ctx.fillRect(2, 6, 18, 8);
    ctx.fillStyle = '#f6dd7a'; ctx.fillRect(2, 14, 44, 4);
    ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.strokeRect(3, 11, 42, 30);
  } else if (kind === 'doc' || kind === 'pdf') {
    ctx.fillStyle = '#fff'; ctx.fillRect(8, 2, 32, 44);
    ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.strokeRect(9, 3, 30, 42);
    ctx.fillStyle = kind === 'pdf' ? '#d33' : '#789';
    for (let i = 0; i < 5; i++) ctx.fillRect(14, 10 + i * 7, i === 4 ? 12 : 20, 3);
    if (kind === 'pdf') { ctx.fillStyle = '#d33'; ctx.fillRect(8, 30, 32, 12); ctx.fillStyle = '#fff'; ctx.font = `bold 11px ${FONT}`; ctx.fillText('PDF', 15, 40); }
  } else if (kind === 'code') {
    ctx.fillStyle = '#101820'; ctx.fillRect(2, 6, 44, 36);
    ctx.strokeStyle = '#888'; ctx.lineWidth = 2; ctx.strokeRect(3, 7, 42, 34);
    ctx.fillStyle = '#5f5'; ctx.font = `bold 16px ${FONT}`; ctx.fillText('</>', 9, 31);
  } else if (kind === 'data') {
    ctx.fillStyle = '#fff'; ctx.fillRect(4, 6, 40, 36);
    ctx.strokeStyle = '#1c7a3c'; ctx.lineWidth = 2; ctx.strokeRect(5, 7, 38, 34);
    ctx.fillStyle = '#1c7a3c'; ctx.fillRect(5, 7, 38, 8);
    for (let i = 1; i < 4; i++) { ctx.fillRect(5, 7 + i * 8 + 6, 38, 1); ctx.fillRect(5 + i * 10, 7, 1, 34); }
  }
  else if (kind === 'snake') {
    ctx.fillStyle = '#0b1f10'; ctx.fillRect(2, 4, 44, 40);
    ctx.strokeStyle = '#888'; ctx.lineWidth = 2; ctx.strokeRect(3, 5, 42, 38);
    ctx.fillStyle = '#58e070';
    [[8, 30], [14, 30], [20, 30], [20, 24], [20, 18], [26, 18], [32, 18], [32, 24]].forEach(([px, py]) => ctx.fillRect(px, py, 6, 6));
    ctx.fillStyle = '#d8ffd8'; ctx.fillRect(32, 24, 6, 6);
    ctx.fillStyle = '#ff5a3c'; ctx.fillRect(36, 10, 6, 6);
  } else if (kind === 'pong') {
    ctx.fillStyle = '#000'; ctx.fillRect(2, 4, 44, 40);
    ctx.strokeStyle = '#888'; ctx.lineWidth = 2; ctx.strokeRect(3, 5, 42, 38);
    ctx.fillStyle = '#fff'; ctx.fillRect(8, 14, 4, 14); ctx.fillRect(36, 22, 4, 14); ctx.fillRect(24, 20, 5, 5);
    ctx.fillStyle = '#666'; for (let yy = 8; yy < 40; yy += 8) ctx.fillRect(23, yy, 2, 4);
  } else if (kind === 'invaders') {
    ctx.fillStyle = '#02030a'; ctx.fillRect(2, 4, 44, 40);
    ctx.strokeStyle = '#888'; ctx.lineWidth = 2; ctx.strokeRect(3, 5, 42, 38);
    ctx.fillStyle = '#ff6ad5';
    ['..#.....#..', '...#...#...', '..#######..', '.##.###.##.', '###########', '#.#######.#', '#.#.....#.#', '...##.##...'].forEach((row, j) => { for (let i = 0; i < 11; i++) if (row[i] === '#') ctx.fillRect(7 + i * 3, 9 + j * 3, 3, 3); });
    ctx.fillStyle = '#6dff7c'; ctx.fillRect(18, 37, 12, 3); ctx.fillRect(22, 34, 4, 4);
  } else if (kind === 'lock') {
    ctx.fillStyle = '#101820'; ctx.fillRect(2, 6, 44, 38);
    ctx.strokeStyle = '#888'; ctx.lineWidth = 2; ctx.strokeRect(3, 7, 42, 36);
    ctx.strokeStyle = '#e8c547'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(24, 21, 8, Math.PI, 0); ctx.stroke(); // shackle
    ctx.fillStyle = '#e8c547'; ctx.fillRect(14, 21, 20, 16);
    ctx.fillStyle = '#101820'; ctx.fillRect(22, 26, 4, 7);
  }
  ctx.restore();
}

export class RetroOS {
  constructor(site, { onExit } = {}) {
    this.site = site;
    this.onExit = onExit;
    this.canvas = document.createElement('canvas');
    this.canvas.width = W;
    this.canvas.height = H;
    this.ctx = this.canvas.getContext('2d');
    this.windows = [];
    this.menuOpen = false;
    this.pointer = { x: 0, y: 0, visible: false };
    this.focused = false; // set by the 3D scene: true while the player sits at the computer
    this.hits = [];
    this.dirty = true;
    this.lastMinute = -1;
    this.overlay = this.makeOverlay();
    this.cursorType = 'default';
    this.portrait = null;
    fetch('portrait.bin').then((r) => r.arrayBuffer()).then((buf) => {
      const bytes = new Uint8Array(buf);
      for (let i = 0; i < bytes.length; i++) bytes[i] ^= PORTRAIT_KEY[i % PORTRAIT_KEY.length];
      const url = URL.createObjectURL(new Blob([bytes], { type: 'image/png' }));
      const img = new Image();
      img.onload = () => { this.portrait = img; this.dirty = true; URL.revokeObjectURL(url); };
      img.src = url;
    }).catch(() => {});
    this.code = '';
    this.secretMsg = 'Enter the 4-digit code';
    this.secretBad = false;
    this.secretBusy = false;
    this.secretOn = false;
    this.onDisco = null;
    this.draw();
  }

  makeOverlay() {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = 'rgba(0,0,0,0.11)';
    for (let y = 0; y < H; y += 3) g.fillRect(0, y, W, 1);
    const v = g.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 0.95);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.55)');
    g.fillStyle = v;
    g.fillRect(0, 0, W, H);
    return c;
  }

  openWindow(id) {
    const def = this.site.windows[id] || (GAME_IDS.includes(id) ? { title: GAME_TITLES[id], blocks: [] } : null);
    if (!def) return;
    let win = this.windows.find((w) => w.id === id);
    if (!win) {
      const n = this.windows.length;
      win = id === 'secret'
        ? { id, title: def.title, x: 330 + n * 12, y: 80 + n * 12, w: 360, h: 560, scroll: 0, layout: null }
        : GAME_IDS.includes(id)
          ? { id, title: def.title, x: 214 + n * 20, y: 6 + (n % 3) * 6, w: 632, h: 716, scroll: 0, layout: null, game: createGame(id) }
          : { id, title: def.title, x: 230 + n * 22, y: 30 + n * 22, w: 720, h: 640, scroll: 0, layout: null };
      this.windows.push(win);
    } else {
      this.windows = this.windows.filter((w) => w !== win);
      this.windows.push(win);
    }
    this.menuOpen = false;
    this.dirty = true;
  }

  closeWindow(win) {
    this.windows = this.windows.filter((w) => w !== win);
    this.dirty = true;
  }

  layoutFor(win) {
    if (win.layout) return win.layout;
    const ctx = this.ctx;
    const width = win.w - 12 - 16 - 24;
    const items = [];
    let y = 0, imgBottom = 0;
    for (const b of this.site.windows[win.id].blocks) {
      if (!b.narrow && b.t !== 'img' && y < imgBottom) y = imgBottom; // text below a picture starts underneath it
      if (b.t === 'img') { items.push({ img: true, x: width - b.size, y, w: b.size, h: b.size }); imgBottom = y + b.size + 8; continue; }
      if (b.t === 'gap') { y += 10; continue; }
      const big = b.t === 'h';
      const bold = big || b.t === 'sub';
      const size = big ? 28 : 21;
      const font = `${bold ? 'bold ' : ''}${size}px ${FONT}`;
      ctx.font = font;
      const indent = b.t === 'li' ? 24 : 0;
      const lh = big ? 36 : 29;
      const lines = wrap(ctx, b.text, width - indent - (b.narrow ? 150 : 0)); // narrow: leave room for the picture on the right
      lines.forEach((ln, i) => {
        items.push({
          text: ln, x: indent, y: y + lh * i, font, h: lh, w: ctx.measureText(ln).width,
          color: b.url ? '#0000cc' : big ? '#000080' : '#000', url: b.url, bullet: b.t === 'li' && i === 0,
        });
      });
      y += lines.length * lh + 4;
    }
    win.layout = { items, height: Math.max(y, imgBottom) + 10 };
    return win.layout;
  }

  draw() {
    const ctx = this.ctx;
    this.hits = [];
    // desktop
    ctx.fillStyle = '#0a7a7a';
    ctx.fillRect(0, 0, W, H);
    // icons
    ICONS.forEach((ic, i) => {
      const x = 28 + Math.floor(i / ICON_ROWS) * 100, y = 22 + (i % ICON_ROWS) * 100;
      const hover = this.hoverId === 'icon-' + ic.id;
      drawIcon(ctx, ic.kind, x + 10, y);
      ctx.font = `bold 15px ${FONT}`;
      ctx.textBaseline = 'top';
      const tw = ctx.measureText(ic.label).width;
      const lx = x + 34 - tw / 2;
      if (hover) { ctx.fillStyle = '#000080'; ctx.fillRect(lx - 3, y + 54, tw + 6, 20); }
      ctx.fillStyle = '#000'; ctx.fillText(ic.label, lx + 1, y + 57);
      ctx.fillStyle = '#fff'; ctx.fillText(ic.label, lx, y + 56);
      this.hits.push({ x: x - 10, y, w: 88, h: 80, id: 'icon-' + ic.id, onClick: () => this.openWindow(ic.id) });
    });
    // windows
    this.windows.forEach((win, idx) => this.drawWindow(win, idx === this.windows.length - 1));
    this.drawTaskbar();
    if (this.menuOpen) this.drawMenu();
    // screen effects
    ctx.drawImage(this.overlay, 0, 0);
    // cursor
    if (this.pointer.visible) this.drawCursor();
    this.dirty = false;
  }

  drawWindow(win, active) {
    const ctx = this.ctx;
    const { x, y, w, h } = win;
    bevel(ctx, x, y, w, h);
    this.hits.push({ x, y, w, h, win });
    // title bar
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, active ? '#000080' : '#707070');
    g.addColorStop(1, active ? '#1084d0' : '#a0a0a0');
    ctx.fillStyle = g;
    ctx.fillRect(x + 4, y + 4, w - 8, 26);
    ctx.fillStyle = '#fff';
    ctx.font = `bold 16px ${FONT}`;
    ctx.textBaseline = 'middle';
    ctx.fillText(win.title, x + 12, y + 18);
    // close button
    const cb = { x: x + w - 28, y: y + 7, w: 20, h: 20 };
    const hoverClose = this.hoverId === 'close-' + win.id;
    bevel(ctx, cb.x, cb.y, cb.w, cb.h, hoverClose);
    ctx.fillStyle = '#000';
    ctx.font = `bold 16px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('x', cb.x + 10, cb.y + 9);
    ctx.textAlign = 'left';
    this.hits.push({ ...cb, id: 'close-' + win.id, onClick: () => this.closeWindow(win) });
    if (win.id === 'secret') { this.drawSecret(win); return; }
    if (win.game) { this.drawGameWindow(win); return; }
    // content
    const cx = x + 6, cy = y + 34, cw = w - 12 - 16, ch = h - 40;
    ctx.fillStyle = '#fff';
    ctx.fillRect(cx, cy, cw, ch);
    ctx.fillStyle = '#404040';
    ctx.fillRect(cx - 2, cy - 2, cw + 4, 2);
    ctx.fillRect(cx - 2, cy - 2, 2, ch + 4);
    const lay = this.layoutFor(win);
    const maxScroll = Math.max(0, lay.height - ch + 20);
    win.scroll = Math.min(Math.max(0, win.scroll), maxScroll);
    const clip = { x: cx, y: cy, w: cw, h: ch };
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx, cy, cw, ch);
    ctx.clip();
    ctx.textBaseline = 'top';
    for (const it of lay.items) {
      const ix = cx + 12 + it.x;
      const iy = cy + 10 + it.y - win.scroll;
      if (iy > cy + ch || iy + it.h < cy) continue;
      if (it.img) { // the portrait, framed like a little photo
        ctx.fillStyle = '#fff'; ctx.fillRect(ix, iy, it.w, it.h); // plain white behind it, no frame
        if (this.portrait) { ctx.imageSmoothingEnabled = false; ctx.drawImage(this.portrait, ix, iy, it.w, it.h); ctx.imageSmoothingEnabled = true; }
        continue;
      }
      const hover = it.url && this.hoverId === 'link-' + it.y + win.id;
      ctx.font = it.font;
      ctx.fillStyle = hover ? '#cc0000' : it.color;
      if (it.bullet) ctx.fillText('•', ix - 16, iy);
      ctx.fillText(it.text, ix, iy);
      if (it.url) {
        ctx.fillRect(ix, iy + it.h - 5, it.w, 1);
        this.hits.push({ x: ix, y: iy, w: it.w, h: it.h, clip, id: 'link-' + it.y + win.id, onClick: () => this.openUrl(it.url) });
      }
    }
    ctx.restore();
    // scrollbar
    const sx = x + w - 6 - 16;
    ctx.fillStyle = '#d8d8d8';
    ctx.fillRect(sx, cy, 16, ch);
    if (maxScroll > 0) {
      const th = Math.max(30, ch * (ch / (lay.height + 20)));
      const ty = cy + (ch - th) * (win.scroll / maxScroll);
      bevel(ctx, sx, ty, 16, th);
    }
  }

  // ---- the "Secret" program: a four-digit code lock ----
  pressDigit(d) {
    if (this.secretBusy) return;
    if (d === 'C') { this.code = ''; this.secretBad = false; this.secretMsg = 'Enter the 4-digit code'; this.dirty = true; return; }
    if (d === 'B') { this.code = this.code.slice(0, -1); this.dirty = true; return; }
    if (this.code.length >= 4) return;
    this.code += d;
    this.secretBad = false;
    this.secretMsg = 'Enter the 4-digit code';
    this.dirty = true;
    if (this.code.length < 4) return;
    this.secretBusy = true;
    setTimeout(() => {
      if (this.code === SECRET_CODE) {
        this.secretOn = !this.secretOn; // the same code switches the effect on and off
        this.secretMsg = this.secretOn ? 'ACCESS GRANTED - party on!' : 'Party over.';
        this.secretBad = false;
        if (this.onDisco) this.onDisco(this.secretOn);
      } else {
        this.secretMsg = 'WRONG CODE';
        this.secretBad = true;
      }
      this.code = '';
      this.dirty = true;
      setTimeout(() => { this.secretBusy = false; }, 350);
    }, 350);
  }

  // keyboard input from the real keyboard (only while the Secret window is the front window)
  key(k) {
    const top = this.windows[this.windows.length - 1];
    if (top && top.game) return top.game.key(k);
    if (!top || top.id !== 'secret') return false;
    if (/^[0-9]$/.test(k)) { this.pressDigit(k); return true; }
    if (k === 'Backspace') { this.pressDigit('B'); return true; }
    if (k === 'Delete') { this.pressDigit('C'); return true; }
    return false;
  }

  // ---- the games ----
  drawGameWindow(win) {
    const ctx = this.ctx;
    const { x, y, w, h } = win;
    const game = win.game;
    const SC = 1.5; // the games run on a 400 x 400 playfield, shown one and a half times bigger
    const PF = 400 * SC;
    const cx = x + 6, cy = y + 34;
    ctx.fillStyle = '#c0c0c0';
    ctx.fillRect(cx, cy, w - 12, h - 40);
    const [left, right] = game.hud(); // score strip
    bevel(ctx, cx + 10, cy + 8, PF, 32, true, '#101418');
    ctx.textBaseline = 'middle';
    ctx.font = `bold 18px ${FONT}`; ctx.fillStyle = '#8cff9c'; ctx.textAlign = 'left';
    ctx.fillText(left, cx + 22, cy + 25);
    ctx.font = `14px ${FONT}`; ctx.fillStyle = '#9fb0a8'; ctx.textAlign = 'right';
    ctx.fillText(right, cx + 10 + PF - 12, cy + 25);
    ctx.textAlign = 'left';
    const gx = cx + 10, gy = cy + 48; // the playfield
    ctx.fillStyle = '#404040'; ctx.fillRect(gx - 2, gy - 2, PF + 4, 2); ctx.fillRect(gx - 2, gy - 2, 2, PF + 4);
    ctx.fillStyle = '#fff'; ctx.fillRect(gx - 2, gy + PF, PF + 4, 2); ctx.fillRect(gx + PF, gy - 2, 2, PF + 4);
    game.setPointer((this.pointer.x - gx) / SC, (this.pointer.y - gy) / SC, this.pointer.visible);
    ctx.save();
    ctx.beginPath(); ctx.rect(gx, gy, PF, PF); ctx.clip();
    ctx.translate(gx, gy); ctx.scale(SC, SC);
    game.draw(ctx, 0, 0);
    ctx.restore();
    ctx.font = `13px ${FONT}`; ctx.fillStyle = '#404040'; ctx.textBaseline = 'middle';
    ctx.fillText('Esc: step away from the desk', cx + 12, gy + PF + 18);
    this.hits.push({ x: gx, y: gy, w: PF, h: PF, id: 'game-' + win.id, win, onClick: () => game.click() });
  }

  drawSecret(win) {
    const ctx = this.ctx;
    const { x, y, w, h } = win;
    const cx = x + 8, cy = y + 36, cw = w - 16;
    ctx.fillStyle = '#c0c0c0';
    ctx.fillRect(cx, cy, cw, h - 44);
    // display
    ctx.fillStyle = '#000';
    ctx.fillRect(cx + 16, cy + 16, cw - 32, 70);
    ctx.fillStyle = '#404040'; ctx.fillRect(cx + 14, cy + 14, cw - 28, 2); ctx.fillRect(cx + 14, cy + 14, 2, 74);
    const slotW = (cw - 32 - 40) / 4;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < 4; i++) {
      const sx = cx + 16 + 10 + i * (slotW + 6);
      ctx.fillStyle = '#0a2a14'; ctx.fillRect(sx, cy + 26, slotW, 50);
      ctx.fillStyle = this.secretBad ? '#ff5050' : '#4dff7a';
      ctx.font = `bold 34px ${FONT}`;
      ctx.fillText(i < this.code.length ? '*' : '_', sx + slotW / 2, cy + 54);
    }
    ctx.font = `bold 15px ${FONT}`;
    ctx.fillStyle = this.secretBad ? '#b00000' : '#000080';
    ctx.fillText(this.secretMsg, cx + cw / 2, cy + 112);
    // keypad
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'B'];
    const bw = 84, bh = 62, gx = 14, gy = 12;
    const kx0 = cx + (cw - (3 * bw + 2 * gx)) / 2, ky0 = cy + 136;
    keys.forEach((k, i) => {
      const bx = kx0 + (i % 3) * (bw + gx), by = ky0 + Math.floor(i / 3) * (bh + gy);
      const id = 'key-' + k;
      const hover = this.hoverId === id;
      bevel(ctx, bx, by, bw, bh, hover, hover ? '#d4d4d4' : '#c0c0c0');
      ctx.fillStyle = '#000';
      ctx.font = `bold 28px ${FONT}`;
      ctx.fillText(k === 'B' ? '<' : k, bx + bw / 2, by + bh / 2 + 1);
      this.hits.push({ x: bx, y: by, w: bw, h: bh, id, onClick: () => this.pressDigit(k) });
    });
    if (this.secretOn) { // the status only shows while the secret is active, so nothing hints at it beforehand
      ctx.fillStyle = '#a000a0';
      ctx.font = `bold 15px ${FONT}`;
      ctx.fillText('DISCO: ON', cx + cw / 2, h + y - 22);
    }
    ctx.textAlign = 'left';
  }

  drawTaskbar() {
    const ctx = this.ctx;
    const y = H - TASKBAR;
    bevel(ctx, 0, y, W, TASKBAR);
    // start button
    bevel(ctx, 6, y + 5, 92, 30, this.menuOpen);
    ctx.fillStyle = '#000';
    ctx.font = `bold 17px ${FONT}`;
    ctx.textBaseline = 'middle';
    ctx.fillText('▣ Start', 16, y + 21);
    this.hits.push({ x: 6, y: y + 5, w: 92, h: 30, id: 'start', start: true, onClick: () => { this.menuOpen = !this.menuOpen; this.dirty = true; } });
    // window tabs
    let tx = 108;
    for (const win of this.windows) {
      const active = win === this.windows[this.windows.length - 1];
      bevel(ctx, tx, y + 5, 150, 30, active);
      ctx.fillStyle = '#000';
      ctx.font = `${active ? 'bold ' : ''}14px ${FONT}`;
      ctx.fillText(win.title, tx + 10, y + 21);
      this.hits.push({ x: tx, y: y + 5, w: 150, h: 30, id: 'tab-' + win.id, onClick: () => this.openWindow(win.id) });
      tx += 156;
    }
    // clock
    const d = new Date();
    const hh = d.getHours() % 12 || 12;
    const mm = String(d.getMinutes()).padStart(2, '0');
    const label = `${hh}:${mm} ${d.getHours() >= 12 ? 'PM' : 'AM'}`;
    ctx.font = `15px ${FONT}`;
    const cw = ctx.measureText(label).width + 24;
    bevel(ctx, W - cw - 6, y + 5, cw, 30, true);
    ctx.fillStyle = '#000';
    ctx.fillText(label, W - cw + 6, y + 21);
  }

  drawMenu() {
    const ctx = this.ctx;
    const items = [
      ...ICONS.map((ic) => ({ label: ic.label, id: ic.id, kind: ic.kind })),
      { label: 'Back to the room', exit: true },
    ];
    const mw = 250, rowH = 38;
    const mh = items.length * rowH + 10;
    const mx = 6, my = H - TASKBAR - mh;
    bevel(ctx, mx, my, mw, mh);
    this.hits.push({ x: mx, y: my, w: mw, h: mh, menu: true }); // the backdrop goes first, so the rows added after it are the ones that get hit
    ctx.textBaseline = 'middle';
    items.forEach((it, i) => {
      const ry = my + 5 + i * rowH;
      const hover = this.hoverId === 'menu-' + i;
      if (hover) { ctx.fillStyle = '#000080'; ctx.fillRect(mx + 4, ry, mw - 8, rowH); }
      ctx.fillStyle = hover ? '#fff' : '#000';
      ctx.font = `${it.exit ? '' : 'bold '}17px ${FONT}`;
      ctx.fillText(it.label, mx + 18, ry + rowH / 2);
      if (it.exit) { ctx.fillStyle = '#808080'; ctx.fillRect(mx + 6, ry - 1, mw - 12, 1); }
      this.hits.push({
        x: mx + 4, y: ry, w: mw - 8, h: rowH, id: 'menu-' + i, menu: true,
        onClick: () => { if (it.exit) { this.menuOpen = false; this.dirty = true; this.onExit && this.onExit(); } else this.openWindow(it.id); },
      });
    });
  }

  drawCursor() {
    const ctx = this.ctx;
    const { x, y } = this.pointer;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (this.cursorType === 'pointer') {
      ctx.moveTo(0, 0); ctx.lineTo(0, 20); ctx.lineTo(5, 16); ctx.lineTo(9, 25); ctx.lineTo(13, 23); ctx.lineTo(9, 15); ctx.lineTo(15, 15);
    } else {
      ctx.moveTo(0, 0); ctx.lineTo(0, 20); ctx.lineTo(5, 16); ctx.lineTo(9, 25); ctx.lineTo(13, 23); ctx.lineTo(9, 15); ctx.lineTo(15, 15);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  openUrl(url) {
    window.open(url, '_blank', 'noopener');
  }

  hitTest(x, y) {
    for (let i = this.hits.length - 1; i >= 0; i--) {
      const h = this.hits[i];
      if (x < h.x || x > h.x + h.w || y < h.y || y > h.y + h.h) continue;
      if (h.clip && (x < h.clip.x || x > h.clip.x + h.clip.w || y < h.clip.y || y > h.clip.y + h.clip.h)) continue;
      return h;
    }
    return null;
  }

  // ---- input from the 3D scene (coordinates are canvas pixels) ----
  pointerMove(x, y) {
    this.pointer = { x, y, visible: true };
    const hit = this.hitTest(x, y);
    const id = hit && hit.id ? hit.id : null;
    this.cursorType = hit && hit.onClick ? 'pointer' : 'default';
    if (id !== this.hoverId) this.hoverId = id;
    this.dirty = true;
    return this.cursorType;
  }

  pointerLeave() {
    this.pointer.visible = false;
    this.hoverId = null;
    this.dirty = true;
  }

  click(x, y) {
    const hit = this.hitTest(x, y);
    if (this.menuOpen && !(hit && (hit.menu || hit.start))) {
      this.menuOpen = false;
      this.dirty = true;
      return;
    }
    if (hit) {
      if (hit.win) {
        const win = hit.win;
        if (this.windows[this.windows.length - 1] !== win) {
          this.windows = this.windows.filter((w) => w !== win);
          this.windows.push(win);
        }
      }
      if (hit.onClick) hit.onClick();
    }
    this.dirty = true;
  }

  wheel(x, y, dy) {
    const hit = this.hitTest(x, y);
    const win = hit && hit.win;
    if (!win) return 'none';
    if (win.game) return 'scrolled'; // scrolling over a game does nothing (and never steps away from the desk)
    // Returns 'scrolled' if the window moved, 'edge' if it is already at its limit, 'none' if no window is under the pointer.
    const lay = this.layoutFor(win);
    const max = Math.max(0, lay.height - (win.h - 40) + 20);
    const next = Math.min(Math.max(0, win.scroll + dy), max);
    if (next === win.scroll) return 'edge';
    win.scroll = next;
    this.dirty = true;
    return 'scrolled';
  }

  // Returns true when the texture needs re-uploading.
  update() {
    const now = performance.now();
    const dt = Math.min(0.05, Math.max(0, (now - (this.lastT || now)) / 1000));
    this.lastT = now;
    const top = this.windows[this.windows.length - 1];
    if (this.focused && top && top.game) { top.game.update(dt); this.dirty = true; } // a game runs only while you sit at the computer, in front
    const minute = new Date().getMinutes();
    if (minute !== this.lastMinute) { this.lastMinute = minute; this.dirty = true; }
    if (this.dirty) { this.draw(); return true; }
    return false;
  }
}

export const OS_SIZE = { W, H };

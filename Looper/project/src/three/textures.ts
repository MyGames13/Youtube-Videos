// Canvas textures drawn procedurally (photos, boards, signs). Cached by key.
import * as THREE from 'three';

const cache = new Map<string, THREE.CanvasTexture>();

function make(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  cache.set(key, t);
  return t;
}

// a flat drawn stickman portrait of Gran (round glasses, bun, coral cardigan)
export function drawGran(g: CanvasRenderingContext2D, cx: number, cy: number, s: number, smile = true) {
  g.lineCap = 'round';
  g.lineJoin = 'round';
  // cardigan
  g.fillStyle = '#FF6F61';
  g.beginPath();
  g.moveTo(cx - 0.55 * s, cy + 1.9 * s);
  g.quadraticCurveTo(cx - 0.5 * s, cy + 0.75 * s, cx, cy + 0.7 * s);
  g.quadraticCurveTo(cx + 0.5 * s, cy + 0.75 * s, cx + 0.55 * s, cy + 1.9 * s);
  g.closePath();
  g.fill();
  g.strokeStyle = '#F4F6F8';
  g.lineWidth = 0.07 * s;
  g.beginPath();
  g.moveTo(cx, cy + 0.62 * s);
  g.lineTo(cx, cy + 1.9 * s);
  g.stroke();
  // head
  g.fillStyle = '#F4F6F8';
  g.beginPath();
  g.arc(cx, cy, 0.5 * s, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.arc(cx + 0.05 * s, cy - 0.55 * s, 0.2 * s, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#101018';
  g.strokeStyle = '#101018';
  g.lineWidth = 0.035 * s;
  for (const dx of [-0.17, 0.17]) {
    g.beginPath();
    g.arc(cx + dx * s, cy - 0.02 * s, 0.11 * s, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.arc(cx + dx * s, cy - 0.02 * s, 0.035 * s, 0, Math.PI * 2);
    g.fill();
  }
  g.beginPath();
  g.moveTo(cx - 0.06 * s, cy - 0.02 * s);
  g.lineTo(cx + 0.06 * s, cy - 0.02 * s);
  g.stroke();
  g.beginPath();
  if (smile) g.arc(cx, cy + 0.12 * s, 0.13 * s, 0.2 * Math.PI, 0.8 * Math.PI);
  else {
    g.moveTo(cx - 0.1 * s, cy + 0.22 * s);
    g.lineTo(cx + 0.1 * s, cy + 0.22 * s);
  }
  g.stroke();
}

export function granPhoto() {
  return make('granPhoto', 256, 300, (g) => {
    g.fillStyle = '#F2EAD8';
    g.fillRect(0, 0, 256, 300);
    const bg = g.createLinearGradient(0, 0, 0, 240);
    bg.addColorStop(0, '#FFC24A');
    bg.addColorStop(1, '#E07A3A');
    g.fillStyle = bg;
    g.fillRect(16, 16, 224, 224);
    g.save();
    g.beginPath();
    g.rect(16, 16, 224, 224);
    g.clip();
    drawGran(g, 128, 112, 62);
    g.restore();
    g.fillStyle = '#3b2a1a';
    g.font = 'italic 600 22px Georgia, serif';
    g.textAlign = 'center';
    g.fillText('Gran', 128, 276);
  });
}

export function corkTexture() {
  return make('cork', 512, 340, (g) => {
    g.fillStyle = '#8a5a34';
    g.fillRect(0, 0, 512, 340);
    for (let i = 0; i < 2400; i++) {
      const x = (Math.sin(i * 12.9898) * 43758.5453) % 1;
      const y = (Math.sin(i * 78.233) * 12345.678) % 1;
      g.fillStyle = i % 3 ? 'rgba(60,30,10,0.25)' : 'rgba(200,150,100,0.2)';
      g.fillRect(Math.abs(x) * 512, Math.abs(y) * 340, 2, 2);
    }
    // notes and string
    g.fillStyle = '#F4F6F8';
    g.fillRect(330, 40, 120, 80);
    g.fillRect(60, 220, 110, 70);
    g.fillStyle = '#1EE6C8';
    g.fillRect(360, 200, 100, 90);
    g.strokeStyle = '#FF5C7A';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(200, 120);
    g.lineTo(390, 80);
    g.lineTo(410, 240);
    g.lineTo(115, 255);
    g.stroke();
    g.fillStyle = '#20203a';
    g.font = '700 18px monospace';
    g.fillText('9:14 PM', 345, 85);
    g.fillText('THU', 75, 260);
    g.fillStyle = '#0B0A1E';
    g.fillText('11 YRS', 372, 250);
  });
}

export function signTexture(key: string, lines: {text: string; color: string; size: number; y: number; font?: string}[], w = 512, h = 256, bg = '#101026') {
  return make(key, w, h, (g) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const l of lines) {
      g.fillStyle = l.color;
      g.font = l.font ?? `800 ${l.size}px Inter, Montserrat, sans-serif`;
      g.fillText(l.text, w / 2, l.y);
    }
  });
}

// departures board, row states drawn as text
export function boardTexture(state: number) {
  return make(`board_${state}`, 640, 320, (g) => {
    g.fillStyle = '#0b0b16';
    g.fillRect(0, 0, 640, 320);
    g.font = '700 26px monospace';
    g.fillStyle = '#FFC24A';
    g.fillText('DEPARTURES', 24, 44);
    g.fillStyle = '#7B5CFF';
    g.fillRect(24, 60, 592, 3);
    const rows = [
      ['21:02', 'NORTHGATE', state > 0 ? 'CANCELLED' : 'ON TIME'],
      ['21:06', 'RIVERSIDE', 'DELAYED'],
      ['21:09', 'OLD TOWN', 'CANCELLED'],
      ['21:12', 'HARBOUR', 'CANCELLED'],
    ];
    rows.forEach((r, i) => {
      const y = 110 + i * 56;
      g.fillStyle = '#F4F6F8';
      g.fillText(r[0], 24, y);
      g.fillText(r[1], 130, y);
      g.fillStyle = r[2] === 'ON TIME' ? '#1EE6C8' : '#FF5C7A';
      g.fillText(r[2], 420, y);
    });
  });
}

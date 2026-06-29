// One-off generator: writes public/sprites/monkey.png and mole.png
// (2048x2048, 8x8 grid of 256x256 placeholder cells) using sharp.
// Each cell gets a distinct pastel color + row.column label so the dev
// can visually confirm atlas layout while real AI art is not ready.
import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.resolve(__dirname, '..', 'public', 'sprites');

const W = 2048, H = 2048, CELL = 256, COLS = 8;
const palette = ['#D4673A', '#FAF3E0', '#C44536', '#5A8068', '#7BA7BC', '#DAA520', '#8B6F47', '#E8DAB8'];

async function make(name) {
  const rects = Array.from({ length: 5 }).flatMap((_, row) =>
    Array.from({ length: 8 }).map((_, col) => {
      const fill = palette[col];
      return `
        <rect x="${col * CELL + 2}" y="${row * CELL + 2}" width="${CELL - 4}" height="${CELL - 4}"
              fill="${fill}" stroke="#2C1810" stroke-width="3"/>
        <text x="${col * CELL + CELL / 2}" y="${row * CELL + 80}" text-anchor="middle"
              font-size="40" fill="#2C1810" font-family="sans-serif">${name}</text>
        <text x="${col * CELL + CELL / 2}" y="${row * CELL + 160}" text-anchor="middle"
              font-size="60" fill="#2C1810" font-family="sans-serif" font-weight="bold">${row + 1}.${col + 1}</text>
      `;
    })
  ).join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <rect width="100%" height="100%" fill="#F5EBD7"/>
    ${rects}
  </svg>`;

  const out = path.join(PUBLIC, `${name}.png`);
  await sharp(Buffer.from(svg)).png().toFile(out);
  console.log(`Wrote ${out}`);
}

await make('monkey');
await make('mole');

import type { KeyHandler } from './keyboard';

interface RowDef {
  label: string;
  keys: string[];
  widths?: number[];
}

const ROWS: RowDef[] = [
  { label: 'row-num', keys: ['`','1','2','3','4','5','6','7','8','9','0','-','='] },
  { label: 'row-q', keys: ['q','w','e','r','t','y','u','i','o','p','[',']','\\'] },
  { label: 'row-a', keys: ['a','s','d','f','g','h','j','k','l',';',"'"] },
  { label: 'row-z', keys: ['z','x','c','v','b','n','m',',','.','/'] },
  { label: 'row-space', keys: [' '] }
];

export interface VirtualKeyboardOpts {
  targetKey?: string | null;
  onKey: KeyHandler;
}

export interface VirtualKeyboard {
  highlight(key: string, on: boolean): void;
  setTargetHighlight(key: string | null): void;
  destroy(): void;
}

export function createVirtualKeyboard(root: HTMLElement, opts: VirtualKeyboardOpts): VirtualKeyboard {
  root.innerHTML = `
    <div class="vkb">
      ${ROWS.map(r => `
        <div class="vkb-row vkb-${r.label}">
          ${r.keys.map(k => {
            const label = k === ' ' ? 'Space' : k;
            const dataKey = k === ' ' ? 'space' : k.toLowerCase();
            return `<button class="vkb-key" data-key="${dataKey}">${label}</button>`;
          }).join('')}
        </div>
      `).join('')}
    </div>
  `;

  const buttons = new Map<string, HTMLButtonElement>();
  root.querySelectorAll<HTMLButtonElement>('.vkb-key').forEach(btn => {
    const k = btn.dataset.key!;
    buttons.set(k, btn);
    btn.addEventListener('click', () => opts.onKey({
      key: k === 'space' ? ' ' : k,
      code: k
    }));
  });

  function highlight(key: string, on: boolean) {
    const k = key === ' ' ? 'space' : key.toLowerCase();
    const btn = buttons.get(k);
    if (btn) btn.classList.toggle('active', on);
  }

  function setTargetHighlight(key: string | null) {
    buttons.forEach(b => b.classList.remove('target'));
    if (!key) return;
    const k = key === ' ' ? 'space' : key.toLowerCase();
    buttons.get(k)?.classList.add('target');
  }

  setTargetHighlight(opts.targetKey ?? null);

  return {
    highlight,
    setTargetHighlight,
    destroy: () => { root.innerHTML = ''; }
  };
}

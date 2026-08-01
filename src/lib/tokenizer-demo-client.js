// TokenizerDemo — Client-side interactivity for the tokenizer visualization component.
// Uses data-* attributes for reliable DOM element references (not scoped by Astro).
import { tokenize, getVocabSize } from './tokenizer';

// Color palette — cycles through for distinct token colors
const COLOR_PALETTE = [
  '#5E5CE6', '#6B69F0', '#7B79D6', '#8A88CC',
  '#9896C6', '#A8A5C0', '#B5B3B6', '#C2C0C3',
  '#FF6B50', '#FF7E66', '#FF917D', '#FFA393',
  '#00C4B0', '#14CDBE', '#2AD5C7', '#3FDED0',
  '#E85D75', '#F0708A', '#F7849E', '#404040',
];

function getTokenColor(id) {
  if (id === -1) return '#d4d4d4';
  return COLOR_PALETTE[id % COLOR_PALETTE.length];
}

function getTokenBgColor(id) {
  if (id === -1) return 'transparent';
  return getTokenColor(id) + '18';
}

// Initialize each TokenizerDemo instance on the page
function init() {
  const roots = document.querySelectorAll('[data-tokenizer-root]');

  roots.forEach(root => {
    // Scope all queries to this specific component instance
    const textarea = root.querySelector('[data-tokenizer-textarea]');
    const display = root.querySelector('[data-tokenizer-display]');
    const countEl = root.querySelector('[data-tokenizer-count]');
    const vocabEl = root.querySelector('[data-tokenizer-vocab]');
    const presetBtns = root.querySelectorAll('[data-tokenizer-preset]');

    if (!textarea || !display || !countEl || !vocabEl) return;

    function renderTokens(text) {
      vocabEl.textContent = 'vocab: ' + getVocabSize();

      const tokens = tokenize(text);

      const realTokens = tokens.filter(t => t.id !== -1);
      countEl.textContent = realTokens.length + ' token' + (realTokens.length !== 1 ? 's' : '');

      display.innerHTML = '';

      if (tokens.length === 0) {
        const p = document.createElement('p');
        p.className = 'text-xs text-gray-400 italic w-full text-center py-4';
        p.textContent = 'Tokens will appear here as you type...';
        display.appendChild(p);
        return;
      }

      tokens.forEach((token) => {
        const block = document.createElement('span');
        block.className = 'token-block';

        if (token.id === -1) {
          block.classList.add('ws');
          const textSpan = document.createElement('span');
          textSpan.className = 'token-text';
          block.appendChild(textSpan);
          block.title = 'whitespace';
        } else {
          const color = getTokenColor(token.id);
          const bg = getTokenBgColor(token.id);
          block.style.color = color;
          block.style.backgroundColor = bg;
          block.style.border = `1px solid ${color}33`;

          const textSpan = document.createElement('span');
          textSpan.className = 'token-text';
          textSpan.textContent = token.text;

          const idSpan = document.createElement('span');
          idSpan.className = 'token-id';
          idSpan.textContent = '#' + token.id;

          block.appendChild(textSpan);
          block.appendChild(idSpan);
          block.title = token.text + ' (id: ' + token.id + ')';
        }

        display.appendChild(block);
      });
    }

    let programmaticUpdate = false;

    // Live tokenization on input (skip when value set programmatically)
    textarea.addEventListener('input', () => {
      if (programmaticUpdate) {
        programmaticUpdate = false;
        return;
      }
      renderTokens(textarea.value);

      // Update active preset button
      presetBtns.forEach(btn => {
        const btnText = btn.getAttribute('data-text');
        if (btnText && textarea.value === btnText) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
    });

    // Preset button clicks
    presetBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const presetText = btn.getAttribute('data-text');
        if (presetText) {
          programmaticUpdate = true;
          textarea.value = presetText;
          renderTokens(presetText);

          // Update active state
          presetBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        }
      });
    });

    // Initial render
    renderTokens(textarea.value);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

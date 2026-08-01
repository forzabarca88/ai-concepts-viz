// Simplified BPE tokenizer — illustrative only, not production-grade.
// Demonstrates the core idea: text → subwords → numeric IDs.

// ── Vocabulary ──────────────────────────────────────────────────────
// A small set of common English subword pieces, ordered by frequency.
// Each entry gets an ID starting at 0.

const VOCAB: string[] = [
  // Special tokens
  '<unk>',
  // Common characters (used for unknown text)
  '!', '.', ',', '?',
  // Single letters (for rare/unknown words)
  'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j',
  'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't',
  'u', 'v', 'w', 'x', 'y', 'z',
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J',
  'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T',
  'U', 'V', 'W', 'X', 'Y', 'Z',
  // Common subword pieces
  'the', 'and', 'ing', 'tion', 'ed', 'ly', 'er', 'est',
  'un', 're', 'de', 'pre', 'dis', 'in', 'on', 'en',
  'Hello', 'world', 'quick', 'brown', 'fox', 'love',
  'I', 'AI', 'ai', 'model', 'text', 'data', 'code',
  'learn', 'learning', 'language', 'large', 'neural',
  'network', 'deep', 'machine', 'system', 'computer',
  'science', 'technology', 'information', 'knowledge',
  'this', 'that', 'with', 'from', 'for', 'not', 'is',
  'are', 'was', 'were', 'has', 'have', 'had', 'been',
  'being', 'do', 'does', 'did', 'will', 'would', 'can',
  'could', 'may', 'might', 'shall', 'should',
  'to', 'of', 'it', 'he', 'she', 'we', 'they', 'you',
  'his', 'her', 'its', 'our', 'your', 'their',
  'at', 'by', 'as', 'or', 'but', 'so', 'if',
  'about', 'after', 'before', 'between', 'into',
  'through', 'during', 'over', 'under', 'above',
  'below', 'up', 'down', 'out', 'off', 'on',
  'one', 'two', 'three', 'four', 'five',
  'first', 'second', 'third', 'next', 'last',
  'all', 'each', 'every', 'some', 'many', 'much',
  'more', 'most', 'less', 'only', 'own', 'same',
  'new', 'old', 'good', 'great', 'high', 'long',
  'small', 'large', 'little', 'big', 'young',
  'think', 'know', 'see', 'look', 'find', 'give',
  'make', 'take', 'come', 'go', 'get', 'use',
  'work', 'call', 'try', 'need', 'feel', 'like',
  'important', 'different', 'possible', 'able',
  'actually', 'really', 'already', 'always',
  'never', 'often', 'sometimes', 'usually',
  'because', 'while', 'until', 'since', 'whether',
  'also', 'even', 'just', 'still', 'very',
  'here', 'there', 'where', 'when', 'how',
  'what', 'which', 'who', 'why',
  // Common suffixes
  's', 'es', 'ment', 'ness',
  'ation', 'able', 'ible', 'ful', 'less',
  'ous', 'ive', 'al', 'ic', 'ary', 'ory',
  'ize', 'ise', 'ify', 'log', 'graph',
  // Common word stems
  'com', 'compu', 'prog', 'soft', 'hard', 'elec',
  'math', 'phys', 'chem', 'bio', 'geo',
  'uni', 'vers', 'intern', 'nation', 'world',
  'peo', 'peopl', 'studi', 'resear', 'teach',
  'under', 'understand', 'explain', 'describe',
  'create', 'develop', 'build', 'design', 'implement',
  'analyz', 'analy', 'calcul', 'process', 'gener',
  'predict', 'classif', 'recogn', 'detect', 'identif',
  'optim', 'improv', 'enhanc', 'increas', 'decreas',
  'transform', 'convert', 'translat', 'interpret',
  'represent', 'encod', 'decod', 'stor', 'retriev',
  'train', 'test', 'evaluat', 'perform', 'achiev',
  'result', 'output', 'input', 'param', 'weight',
  'layer', 'activ', 'loss', 'gradient', 'epoch',
  'batch', 'sampl', 'feature', 'vector', 'embed',
  'token', 'vocab', 'model', 'accur', 'precis',
  'recall', 'score', 'metric', 'bench', 'compar',
  'stat', 'probab', 'distrib', 'random', 'determin',
  'log', 'prob', 'entrop', 'similar', 'dissimilar',
  'cluster', 'group', 'categor', 'label', 'tag',
  'search', 'index', 'quer', 'filter', 'sort',
  'merg', 'split', 'comb', 'join', 'link',
  'connect', 'network', 'graph', 'tree', 'hierarch',
  'struct', 'format', 'pars', 'serial', 'deserial',
  'compress', 'decompress', 'encrypt', 'decrypt',
  'authentic', 'authoriz', 'permis', 'access',
  'security', 'privac', 'safe', 'protect', 'defend',
  'attack', 'vulnerab', 'exploit', 'threat', 'risk',
  'monitor', 'observ', 'track', 'log', 'record',
  'report', 'summar', 'analyz', 'visual', 'display',
  'interfac', 'user', 'client', 'server', 'distribut',
  'scal', 'parallel', 'concurrent', 'async', 'sync',
  'thread', 'process', 'schedul', 'alloc', 'dealloc',
  'memor', 'cach', 'buffer', 'queue', 'stack',
  'list', 'set', 'map', 'hash', 'tree', 'heap',
  'sort', 'search', 'traverse', 'iter', 'recur',
  'optim', 'greed', 'dynamic', 'branch', 'bound',
  'approxim', 'heurist', 'randomiz', 'simul',
  'evolution', 'genet', 'neural', 'deep', 'reinforc',
  'superv', 'unsuperv', 'semi', 'self', 'transfer',
  'adapt', 'fine-tun', 'pretrain', 'multitask',
  'multi', 'modal', 'cross', 'domain', 'task',
  'problem', 'solution', 'algorithm', 'method',
  'approach', 'techniqu', 'strategy', 'heuristic',
  'principle', 'rule', 'constraint', 'objective',
  'function', 'equation', 'formula', 'theorem',
  'proof', 'conjectur', 'hypothesis', 'assumption',
  'definition', 'concept', 'model', 'theory',
  'framework', 'architect', 'design', 'pattern',
  'protocol', 'standard', 'specif', 'interface',
  'abstraction', 'encapsul', 'inherit', 'polymorph',
  'gener', 'templ', 'metaprogram', 'reflect',
  'compile', 'interpret', 'transpil', 'assembl',
  'machine', 'byte', 'instruction', 'register',
  'stack', 'heap', 'pointer', 'refer', 'alloc',
  'garbag', 'collect', 'free', 'dealloc', 'leak',
  'deadlock', 'race', 'condit', 'mutex', 'lock',
  'semaphor', 'barrier', 'fenc', 'atom', 'transact',
  'commit', 'rollback', 'isol', 'consist', 'durab',
  'availab', 'rel', 'fault', 'toler', 'redund',
  'replic', 'partition', 'shard', 'replic', 'consens',
  'leader', 'follower', 'primary', 'secondari',
  'master', 'slav', 'activ', 'passiv', 'hot',
  'cold', 'warm', 'standb', 'failover', 'recovery',
  'backup', 'restore', 'migr', 'upgrad', 'deploy',
  'install', 'config', 'setup', 'provision', 'orchestr',
  'container', 'virtual', 'cloud', 'edge', 'fog',
  'iot', 'sensor', 'actu', 'robot', 'autonom',
  'driv', 'navig', 'path', 'plann', 'control',
  'feedback', 'regul', 'pid', 'model', 'predict',
  'estim', 'filter', 'kalman', 'particle', 'monte',
  'carlo', 'simul', 'reduc', 'genet', 'evolution',
  'swarm', 'ant', 'bee', 'hive', 'coloni',
  'reinforc', 'reward', 'penalti', 'bonus', 'punish',
  'explor', 'exploit', 'epsilon', 'greedi', 'q',
  'learn', 'policy', 'value', 'actor', 'critic',
  'advantag', 'baselin', 'trajectori', 'episod',
  'step', 'episod', 'termin', 'reward', 'discount',
  'gamma', 'alpha', 'beta', 'theta', 'lambda',
  'sigma', 'mu', 'pi', 'phi', 'omega', 'delta',
  'epsilon', 'zeta', 'eta', 'kappa', 'rho',
  'nu', 'xi', 'psi', 'chi', 'tau', 'upsilon',
  'alpha', 'beta', 'gamma', 'delta',
  // Numbers
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
  // Punctuation & symbols
  '-', '_', ':', ';', '(', ')', '[', ']', '{', '}',
  '"', "'", '<', '>', '/', '\\', '|', '@', '#',
  '$', '%', '&', '*', '+', '=', '~', '`',
];

// Build lookup map: token string → ID
const VOCAB_MAP: Map<string, number> = new Map();
for (let i = 0; i < VOCAB.length; i++) {
  VOCAB_MAP.set(VOCAB[i], i);
}

const UNK_ID = 0;

export interface Token {
  text: string;
  id: number;
}

/**
 * Tokenize text using a simplified BPE-like greedy approach.
 *
 * Algorithm:
 * 1. Normalize whitespace
 * 2. Try to match the longest possible token from the current position
 * 3. If no match, split into individual characters
 * 4. Unknown characters fall back to <unk>
 *
 * This is illustrative — real BPE uses a merge table trained on data.
 */
export function tokenize(text: string): Token[] {
  if (!text || text.trim() === '') {
    return [];
  }

  const tokens: Token[] = [];
  let pos = 0;
  const normalized = text.replace(/\s+/g, ' ').trim();

  while (pos < normalized.length) {
    // Try to match the longest token starting at current position
    let matched = false;

    // Try longest first (greedy)
    for (let len = Math.min(20, normalized.length - pos); len > 0; len--) {
      const candidate = normalized.substring(pos, pos + len);

      // Check if this exact substring is in vocab
      if (VOCAB_MAP.has(candidate)) {
        tokens.push({
          text: candidate,
          id: VOCAB_MAP.get(candidate)!,
        });
        pos += len;
        matched = true;
        break;
      }

      // Also try lowercase for case-insensitive matching
      const lower = candidate.toLowerCase();
      if (VOCAB_MAP.has(lower)) {
        tokens.push({
          text: candidate, // preserve original casing in display
          id: VOCAB_MAP.get(lower)!,
        });
        pos += len;
        matched = true;
        break;
      }
    }

    // No vocab match — split into individual characters
    if (!matched) {
      const ch = normalized[pos];

      // Whitespace gets its own token
      if (ch === ' ') {
        tokens.push({ text: ' ', id: -1 });
        pos++;
        continue;
      }

      // Check if single character is in vocab
      if (VOCAB_MAP.has(ch)) {
        tokens.push({ text: ch, id: VOCAB_MAP.get(ch)! });
      } else if (VOCAB_MAP.has(ch.toLowerCase())) {
        tokens.push({ text: ch, id: VOCAB_MAP.get(ch.toLowerCase())! });
      } else {
        // Unknown character — use <unk>
        tokens.push({ text: ch, id: UNK_ID });
      }
      pos++;
    }
  }

  return tokens;
}

/**
 * Get vocabulary size (number of known tokens).
 */
export function getVocabSize(): number {
  return VOCAB.length;
}

/**
 * Get the full vocabulary array (read-only).
 */
export function getVocab(): readonly string[] {
  return VOCAB;
}

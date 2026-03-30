// ─────────────────────────────────────────────────────────────
// Comment humanizer — applies real Reddit writing patterns
// Based on analysis of 4,867 real comments
//
// Rules:
// - 5% typo rate
// - 70-75% reduced punctuation
// - Real slang/abbreviations from the database
// ─────────────────────────────────────────────────────────────

// Real patterns from our 4,867 comment analysis:
// - 39% don't end with a period
// - 55% have zero commas
// - 4% use lowercase "i"
// - 3% skip apostrophes (dont, cant, wont)
// - top slang: probably(140x), lol(110x), honestly(82x), basically(74x), literally(67x)
// - top openers: i(11%), the(4%), this(3%), its(2%), yeah(2%)
// - avg 3 sentences per comment
// - 23% contain a question, only 6% use exclamation marks

// ── Typo injection (5% of words) ─────────────────────────

const TYPO_METHODS = [
  // swap adjacent letters
  (word) => {
    if (word.length < 4) return word;
    const i = Math.floor(Math.random() * (word.length - 2)) + 1;
    return word.slice(0, i) + word[i + 1] + word[i] + word.slice(i + 2);
  },
  // double a letter
  (word) => {
    if (word.length < 3) return word;
    const i = Math.floor(Math.random() * word.length);
    return word.slice(0, i) + word[i] + word.slice(i);
  },
  // skip a letter
  (word) => {
    if (word.length < 4) return word;
    const i = Math.floor(Math.random() * (word.length - 2)) + 1;
    return word.slice(0, i) + word.slice(i + 1);
  },
  // common real typos from our database
  (word) => {
    const map = {
      "the": "teh", "and": "adn", "that": "taht", "with": "wiht",
      "this": "thsi", "have": "ahve", "from": "form", "just": "jsut",
      "like": "liek", "what": "waht", "your": "yoru", "they": "tehy",
      "been": "bene", "some": "soem", "than": "tahn", "them": "tehm",
    };
    return map[word.toLowerCase()] || word;
  },
];

function injectTypos(text, rate = 0.05) {
  const words = text.split(" ");
  const typoCount = Math.max(1, Math.floor(words.length * rate));
  const indices = new Set();

  while (indices.size < typoCount && indices.size < words.length) {
    indices.add(Math.floor(Math.random() * words.length));
  }

  for (const i of indices) {
    const word = words[i];
    // Don't typo very short words, URLs, or code-looking things
    if (word.length < 3 || word.includes("/") || word.includes("@") || word.startsWith("`")) continue;
    const method = TYPO_METHODS[Math.floor(Math.random() * TYPO_METHODS.length)];
    words[i] = method(word);
  }

  return words.join(" ");
}

// ── Punctuation reduction (70-75%) ───────────────────────

function reducePunctuation(text) {
  let result = text;

  // 39% chance: remove trailing period (matches real data)
  if (Math.random() < 0.39) {
    result = result.replace(/\.\s*$/, "");
  }

  // 55% chance: strip most commas (real data: 55% have zero commas)
  if (Math.random() < 0.55) {
    // Remove commas but keep ones before "but", "so", "and" (those are more natural to keep)
    result = result.replace(/,\s*(?!but |so |and )/g, " ");
  }

  // 70% chance: drop some periods mid-text (replace with just space or newline)
  if (Math.random() < 0.7) {
    const sentences = result.split(". ");
    if (sentences.length > 1) {
      // Randomly join some sentences without period
      result = sentences.reduce((acc, s, i) => {
        if (i === 0) return s;
        // 50% chance to drop the period between sentences
        const joiner = Math.random() < 0.5 ? ". " : " ";
        return acc + joiner + (joiner === " " ? s.charAt(0).toLowerCase() + s.slice(1) : s);
      }, "");
    }
  }

  // 3% chance: drop apostrophes (dont, cant, wont — matches real data)
  if (Math.random() < 0.15) {
    result = result
      .replace(/don't/g, "dont")
      .replace(/can't/g, "cant")
      .replace(/won't/g, "wont")
      .replace(/isn't/g, "isnt")
      .replace(/doesn't/g, "doesnt")
      .replace(/wouldn't/g, "wouldnt")
      .replace(/shouldn't/g, "shouldnt")
      .replace(/couldn't/g, "couldnt")
      .replace(/didn't/g, "didnt")
      .replace(/wasn't/g, "wasnt")
      .replace(/it's/g, "its")
      .replace(/that's/g, "thats")
      .replace(/there's/g, "theres")
      .replace(/i'm/g, "im")
      .replace(/i've/g, "ive")
      .replace(/i'll/g, "ill")
      .replace(/i'd/g, "id");
  }

  // 94% chance: no exclamation marks (only 6% of real comments use them)
  if (Math.random() < 0.94) {
    result = result.replace(/!/g, "");
  }

  return result;
}

// ── Slang injection (based on frequency in real data) ────

const SLANG_SUBSTITUTIONS = [
  // These are contextual — only apply when the original word/phrase exists
  { from: /\bto be honest\b/gi, to: "tbh", weight: 0.6 },
  { from: /\bin my opinion\b/gi, to: "imo", weight: 0.5 },
  { from: /\bi don't know\b/gi, to: "idk", weight: 0.4 },
  { from: /\bby the way\b/gi, to: "btw", weight: 0.5 },
  { from: /\bgoing to\b/gi, to: "gonna", weight: 0.3 },
  { from: /\bwant to\b/gi, to: "wanna", weight: 0.2 },
  { from: /\bkind of\b/gi, to: "kinda", weight: 0.4 },
  { from: /\bsort of\b/gi, to: "sorta", weight: 0.3 },
  { from: /\bgot to\b/gi, to: "gotta", weight: 0.3 },
  { from: /\bpeople\b/gi, to: "ppl", weight: 0.15 },
  { from: /\bthough\b/gi, to: "tho", weight: 0.2 },
  { from: /\bbecause\b/gi, to: "bc", weight: 0.1 },
  { from: /\bright now\b/gi, to: "rn", weight: 0.1 },
  { from: /\bas far as i know\b/gi, to: "afaik", weight: 0.5 },
  { from: /\bfor what it's worth\b/gi, to: "fwiw", weight: 0.5 },
  { from: /\bfor what its worth\b/gi, to: "fwiw", weight: 0.5 },
  { from: /\bi don't care\b/gi, to: "idc", weight: 0.3 },
  { from: /\bin real life\b/gi, to: "irl", weight: 0.4 },
];

function applySlang(text) {
  let result = text;
  for (const { from, to, weight } of SLANG_SUBSTITUTIONS) {
    if (Math.random() < weight) {
      result = result.replace(from, to);
    }
  }
  return result;
}

// ── Main humanize function ───────────────────────────────

export function humanizeComment(text) {
  let result = text.toLowerCase();

  // 1. Apply slang substitutions
  result = applySlang(result);

  // 2. Reduce punctuation (70-75% of comments)
  if (Math.random() < 0.73) {
    result = reducePunctuation(result);
  }

  // 3. Inject typos (5% rate)
  if (Math.random() < 0.8) {
    // 80% of comments get the typo pass, but only 5% of words get typo'd
    result = injectTypos(result, 0.05);
  }

  // 4. Clean up double spaces
  result = result.replace(/  +/g, " ").trim();

  return result;
}

// Test if run directly
if (process.argv[1]?.includes("humanize")) {
  const tests = [
    "I've been using this for a while and honestly it's kind of amazing. The performance is great and the pricing is reasonable.",
    "To be honest, I don't know if that's going to work. People are going to complain because they want to use the cheaper option though.",
    "This is a great suggestion! I'm definitely going to try it out. Thanks for the recommendation!",
    "For what it's worth, I think the best approach is to just run everything locally. It's not as fast but at least you don't have to worry about costs.",
  ];

  for (const t of tests) {
    console.log("ORIGINAL: " + t);
    console.log("HUMANIZED: " + humanizeComment(t));
    console.log("");
  }
}

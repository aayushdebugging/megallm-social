// ─────────────────────────────────────────────────────────────
// X reply humanizer — applies natural Twitter writing patterns
// Much more casual than Reddit; emoji usage acceptable
// ─────────────────────────────────────────────────────────────

// Real X patterns:
// - 60%+ use emoji
// - Very short paragraphs (1-2 sentences)
// - Incomplete sentences acceptable
// - Exclamation marks frequent (25%)
// - Lowercase openers common (40%)
// - Contractions very common (don't, it's, can't)
// - No lengthy explanations

function injectCasualStartSymbols(text) {
  // 40% chance: lowercase first letter if it's capital
  if (Math.random() < 0.4 && text.length > 0) {
    text = text[0].toLowerCase() + text.slice(1);
  }

  // 20% chance: start with emoji
  const replyEmojis = ["👀", "🔥", "💯", "⚡", "🤔", "👍", "📝", "💡", "🎯"];
  if (Math.random() < 0.2) {
    const emoji = replyEmojis[Math.floor(Math.random() * replyEmojis.length)];
    text = emoji + " " + text;
  }

  return text;
}

function injectEmoji(text) {
  // 40% chance: add emoji somewhere relevant in the text
  if (Math.random() < 0.4) {
    const positions = [];
    for (let i = 0; i < text.length; i += 20) {
      positions.push(Math.floor(i + Math.random() * 20));
    }
    const pos = positions[Math.floor(Math.random() * positions.length)];
    const emojis = ["💯", "🔥", "⚡", "👇", "🎯", "📈", "✨", "🚀"];
    const emoji = emojis[Math.floor(Math.random() * emojis.length)];
    text = text.slice(0, pos) + " " + emoji + " " + text.slice(pos);
  }

  return text;
}

function addExclamationMarks(text) {
  // 25% of comments on X end with exclamation (vs 6% on Reddit)
  if (Math.random() < 0.25 && !text.endsWith("?")) {
    if (text.endsWith(".")) {
      text = text.slice(0, -1) + "!";
    } else {
      text += "!";
    }
  }

  return text;
}

function shortenParagraphs(text) {
  // X people use short lines. If text is a wall, add line breaks
  const sentences = text.split(/([.!?]+)/);
  const result = [];

  for (let i = 0; i < sentences.length; i += 2) {
    const sentence = sentences[i].trim();
    const punct = sentences[i + 1] || "";

    if (sentence.length > 0) {
      // 30% chance: break before this sentence (new line on X = new paragraph)
      if (result.length > 0 && Math.random() < 0.3) {
        result.push("\n");
      }

      result.push(sentence + punct);
    }
  }

  return result.join(" ").replace(/\s+\n/g, "\n").trim();
}

export function humanizeReply(text) {
  let result = text.trim();

  // Apply X-specific patterns in order
  result = injectCasualStartSymbols(result);
  result = injectEmoji(result);
  result = addExclamationMarks(result);
  result = shortenParagraphs(result);

  // Ensure we don't exceed X's character limit (280 chars ≈ 50 words)
  if (result.length > 280) {
    result = result.slice(0, 277) + "...";
  }

  return result;
}

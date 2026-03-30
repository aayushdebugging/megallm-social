// ─────────────────────────────────────────────────────────────
// Post-processor that strips common AI writing patterns.
//
// Run this on every piece of generated content BEFORE it enters
// the post queue. The goal is not to rewrite — just to sand off
// the most obvious "written by ChatGPT" tells.
// ─────────────────────────────────────────────────────────────

/** Apply all humanization rules to `text` and return the cleaned version. */
export function humanize(text: string): string {
  let result = text;

  // 1. Replace overused AI vocabulary with plainer alternatives
  result = replaceAIVocabulary(result);

  // 2. Remove cliche phrases
  result = removeClichePhrases(result);

  // 3. Fix excessive em dashes — replace with commas
  result = reduceEmDashes(result);

  // 4. Strip trailing participial phrases ("ensuring that...", "highlighting...")
  result = stripTrailingParticipials(result);

  // 5. Remove rule-of-three adjective constructions
  result = removeRuleOfThree(result);

  // 6. Remove "It's not just X, it's Y" pattern
  result = removeNotJustPattern(result);

  // 7. Remove attribution to vague authorities
  result = removeVagueAttributions(result);

  // 8. Remove generic closings
  result = removeGenericClosings(result);

  // 9. Remove sycophantic openers
  result = removeSycophancy(result);

  // 10. Strip mid-sentence bold emphasis (keep headings bold)
  result = stripMidSentenceBold(result);

  // 11. Clean up any double spaces or trailing whitespace introduced by replacements
  result = cleanWhitespace(result);

  return result;
}

// ── Individual rules ───────────────────────────────────────

const AI_VOCABULARY: [RegExp, string][] = [
  [/\bdelve(?:s|d)?\b/gi, "dig"],
  [/\btapestry\b/gi, "mix"],
  [/\bvibrant\b/gi, "active"],
  [/\bpivotal\b/gi, "key"],
  [/\blandscape\b(?!\s+(?:photo|image|painting|orientation))/gi, "space"],
  [/\bunderscore(?:s|d)?\b/gi, "highlight"],
  [/\brealm\b/gi, "area"],
  [/\bunleash(?:es|ed|ing)?\b/gi, "unlock"],
  [/\bharness(?:es|ed|ing)?\b/gi, "use"],
  [/\brobust\b/gi, "solid"],
  [/\bseamless(?:ly)?\b/gi, "smooth$1"],
  [/\bleverage(?:s|d)?\b/gi, "use"],
  [/\bsynerg(?:y|ies|ize|izes)\b/gi, "combination"],
  [/\bparadigm\b/gi, "model"],
  [/\bholistic\b/gi, "complete"],
  [/\bfacilitate(?:s|d)?\b/gi, "enable"],
  [/\bgranular\b/gi, "detailed"],
  [/\bactionable\b/gi, "practical"],
  [/\btransformative\b/gi, "significant"],
  [/\bgame[- ]changer\b/gi, "big deal"],
  [/\bcutting[- ]edge\b/gi, "latest"],
  [/\bgroundbreaking\b/gi, "notable"],
  [/\bworld[- ]class\b/gi, "top-tier"],
];

function replaceAIVocabulary(text: string): string {
  let result = text;
  for (const [pattern, replacement] of AI_VOCABULARY) {
    result = result.replace(pattern, (match, ...args) => {
      // Preserve the replacement — handle backreference-style replacements
      const replaced = replacement.replace(/\$(\d+)/g, (_: string, idx: string) => {
        const group = args[parseInt(idx, 10) - 1];
        return group ?? "";
      });
      // Preserve original capitalization of first letter
      if (match[0] === match[0].toUpperCase() && match[0] !== match[0].toLowerCase()) {
        return replaced.charAt(0).toUpperCase() + replaced.slice(1);
      }
      return replaced;
    });
  }
  return result;
}

const CLICHE_PHRASES: [RegExp, string][] = [
  [/serves? as a testament\s+to/gi, "shows"],
  [/stands? as a?\s*/gi, "is "],
  [/marks? a pivotal\s*/gi, "is an important "],
  [/at the end of the day,?\s*/gi, ""],
  [/it goes without saying\s+that\s*/gi, ""],
  [/needless to say,?\s*/gi, ""],
  [/in today'?s rapidly evolving\s*/gi, "in the current "],
  [/in an era (?:where|of)\s*/gi, ""],
  [/(?:the )?(?:ever[- ])?(?:evolving|changing) landscape of\s*/gi, ""],
  [/it is worth noting that\s*/gi, ""],
  [/it'?s important to (?:note|remember|mention) that\s*/gi, ""],
  [/when it comes to\s*/gi, "for "],
  [/at its core,?\s*/gi, ""],
  [/look(?:ing)? no further than\s*/gi, "try "],
];

function removeClichePhrases(text: string): string {
  let result = text;
  for (const [pattern, replacement] of CLICHE_PHRASES) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

/**
 * Reduce em dashes when there are more than 2 in a paragraph.
 * Replace extras with commas to reduce the "AI feel."
 */
function reduceEmDashes(text: string): string {
  return text.replace(/([^\n]+)/g, (line) => {
    const emDashCount = (line.match(/\u2014/g) || []).length;
    if (emDashCount <= 2) return line;

    // Replace every em dash after the first two with a comma
    let count = 0;
    return line.replace(/\u2014/g, () => {
      count++;
      return count > 2 ? "," : "\u2014";
    });
  });
}

/**
 * Strip trailing participial phrases that pad sentences with filler.
 * E.g., "We launched the product, ensuring that customers get value."
 * →     "We launched the product."
 */
function stripTrailingParticipials(text: string): string {
  // Match ", <participle> that/the/a/..." at end of sentence
  const pattern = /,\s+(?:ensuring|highlighting|demonstrating|showcasing|underscoring|emphasizing|illustrating|signaling|paving|making it)\s+(?:that|the|a|an|how|its|their|our)\b[^.!?\n]*([.!?])/gi;
  return text.replace(pattern, "$1");
}

/**
 * Remove rule-of-three adjective lists that feel formulaic.
 * E.g., "innovative, inspiring, and impactful" → keep only the last adjective.
 */
function removeRuleOfThree(text: string): string {
  // Pattern: "adjective, adjective, and adjective" where all three are
  // similarly abstract/fluffy (common AI tell)
  const fluffyAdj = [
    "innovative", "inspiring", "impactful", "dynamic", "powerful",
    "comprehensive", "remarkable", "exceptional", "extraordinary",
    "incredible", "impressive", "transformative", "revolutionary",
    "meaningful", "profound", "significant", "compelling", "exciting",
  ];
  const joined = fluffyAdj.join("|");
  const pattern = new RegExp(
    `\\b(${joined}),\\s+(${joined}),?\\s+and\\s+(${joined})\\b`,
    "gi",
  );
  // Keep only the last adjective (least likely to be pure filler)
  return text.replace(pattern, (_match, _a, _b, c: string) => c);
}

/**
 * Remove the "It's not just X, it's Y" construction.
 * Replace with just the Y part.
 */
function removeNotJustPattern(text: string): string {
  // "It's not just X — it's Y" or "It's not just X, it's Y"
  return text.replace(
    /[Ii]t'?s not just [^,\u2014]+[,\u2014]\s*it'?s\s+/g,
    "It's ",
  );
}

/**
 * Remove vague authority attributions.
 */
function removeVagueAttributions(text: string): string {
  const attributions = [
    /\b[Ee]xperts (?:believe|suggest|agree|note|say|argue|emphasize|predict|recommend)\s+(?:that\s+)?/g,
    /\b[Ii]ndustry (?:observers?|analysts?|experts?|insiders?|leaders?) (?:note|say|believe|suggest|predict|argue|emphasize|point out)\s+(?:that\s+)?/g,
    /\b[Mm]any (?:experts?|analysts?|observers?|industry leaders?) (?:believe|suggest|note|agree|point out)\s+(?:that\s+)?/g,
    /\b[Aa]ccording to (?:experts?|analysts?|industry (?:observers?|insiders?|experts?)),?\s*/g,
  ];
  let result = text;
  for (const pattern of attributions) {
    result = result.replace(pattern, "");
  }
  return result;
}

/**
 * Remove generic, vague closing sentences.
 */
function removeGenericClosings(text: string): string {
  const closings = [
    /\b[Ee]xciting times lie ahead[.!]?\s*/g,
    /\b[Tt]he future (?:is|looks) (?:bright|promising|exciting)[.!]?\s*/g,
    /\b[Oo]nly time will tell[.!]?\s*/g,
    /\b[Oo]ne thing is (?:for )?(?:certain|clear|sure)[:\u2014,]?\s*[^.]*[.!]?\s*/g,
    /\b[Ss]tay tuned for (?:more|what's next|updates)[.!]?\s*/g,
    /\b[Ww]atch this space[.!]?\s*/g,
    /\b[Ii]t will be (?:interesting|fascinating|exciting) to (?:see|watch|observe)\b[^.]*[.!]?\s*/g,
  ];
  let result = text;
  for (const pattern of closings) {
    result = result.replace(pattern, "");
  }
  return result;
}

/**
 * Remove sycophantic openers that LLMs prepend.
 */
function removeSycophancy(text: string): string {
  const openers = [
    /^(?:Great|Excellent|Fantastic|Wonderful|Amazing|Awesome) (?:question|point|observation|insight)[.!]\s*/gim,
    /^(?:Absolutely|Certainly|Definitely|Of course)[.!]\s*/gim,
    /^(?:That'?s? (?:a |an )?(?:great|excellent|fantastic|wonderful|really good|insightful) (?:question|point|observation))[.!]\s*/gim,
    /^(?:I'?m glad you asked)[.!]?\s*/gim,
    /^(?:Thank you for (?:asking|raising|bringing up) (?:that|this))[.!]?\s*/gim,
  ];
  let result = text;
  for (const pattern of openers) {
    result = result.replace(pattern, "");
  }
  return result;
}

/**
 * Strip bold formatting from mid-sentence words/phrases.
 * Preserve bold in headings (lines starting with #) and at line start.
 */
function stripMidSentenceBold(text: string): string {
  return text.replace(/([^\n#])\*\*([^*\n]+)\*\*/g, "$1$2");
}

/**
 * Clean up whitespace artifacts from all the replacements above.
 */
function cleanWhitespace(text: string): string {
  return text
    // Collapse multiple spaces into one
    .replace(/ {2,}/g, " ")
    // Remove spaces before punctuation
    .replace(/ ([.,;:!?])/g, "$1")
    // Fix sentences that now start with lowercase after removal
    .replace(/([.!?]\s+)([a-z])/g, (_match, punct: string, letter: string) =>
      `${punct}${letter.toUpperCase()}`,
    )
    // Remove blank lines that appear more than twice in a row
    .replace(/\n{4,}/g, "\n\n\n")
    // Trim trailing whitespace per line
    .replace(/[ \t]+$/gm, "");
}

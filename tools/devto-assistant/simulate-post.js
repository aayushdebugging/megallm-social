// ─────────────────────────────────────────────────────────────
// Dev.to thread simulator (same engine as reddit-assistant; prompts
// adapted for dev.to). Generates full threads with MegaLLM seeding.
//
// Usage:
//   node simulate-post.js
//   node simulate-post.js --topic "costs"
//   node simulate-post.js --subreddit LocalLLaMA   # profile key (tag)
// ─────────────────────────────────────────────────────────────

import "./load-env.js";
import { CONFIG } from "./config.js";
import { humanizeComment } from "./humanize.js";
import { readFile, writeFile, mkdir } from "fs/promises";
import { SIMS_DIR } from "./paths.js";

// ── Username generation ─────────────────────────────────────
// Mimics real Reddit username patterns from our data

const USERNAME_PATTERNS = [
  // Adjective_Noun_Number (Reddit auto-generated style)
  () => {
    const adj = pick(["Hopeful", "Bright", "Calm", "Swift", "Bold", "Quiet", "Wild", "Lucky", "Eager", "Warm", "Cool", "Deep", "Sharp", "True", "Real", "Pure", "Dark", "Rare", "Odd", "Vast"]);
    const noun = pick(["Priority", "Signal", "Context", "Token", "Vector", "Matrix", "Kernel", "Layer", "Module", "Agent", "Router", "Parser", "Thread", "Buffer", "Cache", "Stack", "Queue", "Cluster", "Prompt", "Model"]);
    return `${adj}-${noun}${randInt(100, 9999)}`;
  },
  // word_word_number
  () => {
    const w1 = pick(["quantum", "neural", "cyber", "data", "cloud", "pixel", "byte", "code", "dev", "sys", "net", "algo", "logic", "meta", "nano", "proto", "hyper", "ultra", "turbo", "mega"]);
    const w2 = pick(["wizard", "ninja", "monk", "sage", "geek", "nerd", "hacker", "builder", "smith", "crafter", "runner", "walker", "rider", "seeker", "finder", "keeper", "master", "chief", "lord", "king"]);
    return `${w1}_${w2}${Math.random() < 0.6 ? randInt(1, 999) : ""}`;
  },
  // Natural looking usernames
  () => {
    const names = ["throwaway", "anon", "just_a_dev", "llm_enjoyer", "gpu_poor", "prompt_monkey", "token_counter", "api_addict", "cost_tracker", "model_hopper", "self_hoster", "indie_builder", "saas_grinder", "ml_engineer", "infra_nerd", "cloud_refugee", "latency_hater", "ollama_fan", "vram_limited", "context_window"];
    return `${pick(names)}${randInt(1, 99)}`;
  },
  // Short random
  () => {
    const base = pick(["xkcd", "hn", "ml", "ai", "gpt", "llm", "dev", "ops", "api", "swe"]);
    return `${base}${pick(["_fan", "_user", "_guy", "_dude", "_bro", "lover", "fan42", "1337", "_npc", ""])}${randInt(1, 9999)}`;
  },
  // Real-ish names
  () => {
    const first = pick(["chris", "alex", "sam", "jordan", "casey", "drew", "pat", "morgan", "taylor", "jamie", "riley", "quinn", "reese", "blake", "avery", "max", "leo", "kai", "ash", "sky"]);
    const suffix = pick(["_codes", "_dev", "_ml", "_ai", "_tech", `${randInt(80, 99)}`, `_${randInt(1, 999)}`, "irl", "_real", ""]);
    return `${first}${suffix}`;
  },
];

function generateUsername() {
  return pick(USERNAME_PATTERNS)();
}

function generateUsernames(count) {
  const names = new Set();
  while (names.size < count) {
    names.add(generateUsername());
  }
  return [...names];
}

// ── Vote distribution (realistic Reddit patterns) ───────────
// Most comments get 1-5, some outliers, 2-3% downvoted

function generateVotes(isTopLevel, commentQuality, postPopularity) {
  // Base vote range depends on post popularity
  const maxBase = Math.min(postPopularity * 0.8, 200);

  // 2-3% chance of being downvoted
  if (Math.random() < 0.025) {
    return -randInt(1, 5);
  }

  if (commentQuality === "top") {
    // Top comments get disproportionate votes (power law)
    return randInt(Math.floor(maxBase * 0.3), Math.floor(maxBase * 1.2));
  } else if (commentQuality === "good") {
    return randInt(Math.floor(maxBase * 0.05), Math.floor(maxBase * 0.4));
  } else if (commentQuality === "mid") {
    return randInt(1, Math.max(Math.floor(maxBase * 0.1), 8));
  } else {
    // Low/new comments
    return randInt(1, 3);
  }
}

function assignVoteQuality(index, total) {
  // Power law: first few comments get most votes
  if (index === 0) return "top";
  if (index <= 2) return "good";
  if (index <= Math.floor(total * 0.4)) return "mid";
  return "low";
}

// ── Flair options by subreddit ──────────────────────────────

const FLAIR_MAP = {
  LocalLLaMA: ["Discussion", "Question | Help", "News", "Tutorial | Guide", "New Model", "Resources", "Other"],
  LLMDevs: ["Discussion", "Question", "Resource", "News"],
  OpenAI: ["Discussion", "Question", "API", "News"],
  ChatGPT: ["Other", "Serious replies only", "Funny"],
  singularity: ["Discussion", "AI", "Science & Technology"],
  ClaudeAI: ["Bug", "Feature Request", "Discussion", "Question"],
  MachineLearning: ["Discussion", "Research", "Project", "News"],
  SaaS: ["Question", "Build In Public", "Marketing"],
  startups: ["Discussion", "Question"],
  selfhosted: ["Need Help", "Product Update", "Discussion"],
  Python: ["Discussion", "Help", "Resource"],
  webdev: ["Discussion", "Question", "Showoff Saturday"],
  ollama: ["Question", "Discussion", "solved"],
  default: ["Discussion", "Question"],
};

function pickFlair(subreddit, flairWeights) {
  // Use weighted flair distribution if available from subreddit profile
  if (flairWeights) {
    const rand = Math.random();
    let cumulative = 0;
    for (const [flair, weight] of Object.entries(flairWeights)) {
      cumulative += weight;
      if (rand < cumulative) return flair || "Discussion";
    }
  }
  const flairs = FLAIR_MAP[subreddit] || FLAIR_MAP.default;
  return pick(flairs);
}

// ── Subreddit-native topic templates ────────────────────────
// Each subreddit has its own topics, title patterns, tone, and
// culture — sourced from analysis of 1,439 real posts

const SUBREDDIT_PROFILES = {
  LocalLLaMA: {
    culture: "highly technical, expert-level. assumes deep knowledge of CUDA, quantization, vLLM, inference engines. troubleshooting-heavy. specific hardware specs in posts.",
    avgUpvotes: 30, avgComments: 12,
    flairWeights: { "Discussion": 0.38, "Question | Help": 0.38, "Resources": 0.09, "Tutorial | Guide": 0.08, "New Model": 0.05, "News": 0.02 },
    topics: [
      {
        theme: "cost-tracking",
        titles: [
          "is anyone else going insane trying to track llm api costs across providers?",
          "what's the cheapest way to get gpt-5 level inference? vllm + deepseek v3 vs cloud apis",
          "real cost breakdown: rtx 4090 local inference vs openai api for my rag pipeline",
          "spent a week benchmarking cost per 1k tokens across 8 providers. here's my spreadsheet",
          "the token counting discrepancy between anthropic and openai is driving me insane",
        ],
        bodyPrompt: "technical developer frustrated with LLM API cost tracking, mentions specific models (deepseek v3, qwen3, llama), hardware (rtx 4090, dgx spark), and inference engines (vllm, sglang, ollama). includes token per second benchmarks and cost per 1k token comparisons",
      },
      {
        theme: "model-comparison",
        titles: [
          "qwen3.5-35b-a3b vs deepseek v3 for coding: ran 200 prompts, here's the data",
          "just tested every 7b-14b model on my rag pipeline. results surprised me",
          "unpopular opinion: quantized 70b models are worse than native 14b for most tasks",
          "deepseek v3 at fp8 on a single 4090. this changes everything",
          "benchmark: local llama 4 vs cloud claude for structured json extraction",
        ],
        bodyPrompt: "technical ML practitioner who ran rigorous benchmarks comparing local models with specific quantization levels (q4_k_m, fp8, mxfp4) on specific hardware. mentions tok/s metrics, perplexity scores, vram usage, and quality tradeoffs",
      },
      {
        theme: "self-hosting",
        titles: [
          "finally got a working multi-model setup: 4090 for fast, 3090 for long context. heres the config",
          "moved my entire inference stack from openai to local vllm. heres what broke",
          "rtx 5070ti + qwen3 14b: my cost breakdown vs cloud after 3 months",
          "best quantization technique for 12gb vram cards in 2026?",
          "lessons from deploying rag bots on local inference for production",
        ],
        bodyPrompt: "developer who self-hosts LLMs on consumer GPUs, discusses specific vram constraints, quantization methods (gptq, awq, gguf, exl2), mentions ollama/vllm/sglang configs, and compares inference quality vs cloud providers",
      },
      {
        theme: "api-gateway",
        titles: [
          "built a litellm proxy to route between local ollama and cloud fallback. works great",
          "my failover setup: vllm local → deepseek api → openai. handles 500 req/min",
          "anyone using a unified gateway for mixing local and cloud inference?",
          "how do you handle provider switching without rewriting your inference code?",
          "open source routing layer that picks cheapest provider per request. here's the repo",
        ],
        bodyPrompt: "infrastructure-focused developer building multi-provider routing with local-first approach. mentions litellm, openrouter, specific api endpoints, latency measurements, and fallback strategies between local inference and cloud apis",
      },
    ],
  },

  ChatGPT: {
    culture: "casual consumer-friendly. mix of productivity tips, creative experiments, humor, and feature complaints. 'gone wild' creative prompts are popular. low technical barrier. entertainment-heavy.",
    avgUpvotes: 66, avgComments: 28,
    flairWeights: { "Other": 0.34, "Educational Purpose Only": 0.18, "Funny": 0.13, "Gone Wild": 0.10, "Use cases": 0.06, "Serious replies only": 0.10, "Prompt engineering": 0.05, "Just a Bot": 0.04 },
    topics: [
      {
        theme: "cost-tracking",
        titles: [
          "just realized how much im actually spending on chatgpt plus + api combined. anyone else shocked?",
          "is the $20/month for plus actually worth it vs just using the api directly?",
          "my chatgpt usage report this month is terrifying lol",
          "free version timing out constantly. is plus worth upgrading to?",
          "anyone else feel like openai keeps making the free tier worse to push you to pay?",
        ],
        bodyPrompt: "casual chatgpt user surprised by costs or evaluating whether to pay for plus. not super technical, talks about daily usage patterns, compares free vs paid experience. might mention trying claude or other chatbots as alternatives. conversational and slightly frustrated tone",
      },
      {
        theme: "model-comparison",
        titles: [
          "switched to claude for a week. heres my honest comparison with chatgpt",
          "gpt-5 vs claude vs gemini: which one actually gives the best answers in 2026?",
          "i gave the same essay prompt to every major ai. the results were wild",
          "chatgpt gives me answers. claude gives me understanding. anyone else notice this?",
          "is it just me or has chatgpt gotten worse since the last update?",
        ],
        bodyPrompt: "average user comparing AI chatbots for daily tasks like writing, coding help, research. not technical, focuses on answer quality, tone, creativity, and how it 'feels' to use each one. anecdotal, subjective comparison. casual tone with specific examples",
      },
      {
        theme: "creative-use",
        titles: [
          "months of the year as cyberpunk characters. chatgpt went hard on this one",
          "i asked chatgpt to roast my resume and now im questioning my career choices",
          "tried using chatgpt as a therapist for a month. heres what happened",
          "the wildest prompt engineering trick i discovered this week",
          "chatgpt voice mode is genuinely changing how i interact with ai",
        ],
        bodyPrompt: "creative chatgpt user sharing fun experiments or unusual use cases. tone is excited, playful, sharing something cool they discovered. might include the prompt they used and the result. entertainment-focused, designed to make people want to try it",
      },
    ],
  },

  OpenAI: {
    culture: "formal, news-driven, discussion-heavy. philosophical implications of AI. corporate news analysis. business impact debates. higher education level assumed. mix of technical and policy discussion.",
    avgUpvotes: 47, avgComments: 19,
    flairWeights: { "Discussion": 0.58, "Question": 0.17, "News": 0.08, "Miscellaneous": 0.09, "Research": 0.08 },
    topics: [
      {
        theme: "cost-tracking",
        titles: [
          "openai's pricing changes are getting harder to track. is this intentional?",
          "real talk: what's your monthly openai api spend and what are you building?",
          "the api pricing page has changed 4 times this quarter. anyone keeping track?",
          "gpt-5 is incredible but at what cost? my enterprise bill breakdown",
          "openai vs anthropic vs google pricing: the 2026 state of play",
        ],
        bodyPrompt: "business-minded developer or team lead analyzing OpenAI's pricing strategy, comparing it to competitors. formal tone, might reference specific tier changes, enterprise pricing, or market positioning. discusses broader implications of AI pricing on the industry",
      },
      {
        theme: "model-comparison",
        titles: [
          "gpt-5.4 starts every reply with 'yes' and it's driving me insane",
          "the real danger of gpt-5 isn't capability, its that everyone stops thinking critically",
          "honest assessment: is gpt-5 worth the upgrade from gpt-4 for production?",
          "openai's moat is shrinking. deepseek and anthropic are catching up fast",
          "does anyone else feel like openai is prioritizing features over reliability?",
        ],
        bodyPrompt: "thoughtful developer or AI researcher analyzing OpenAI's position in the market. balanced perspective with specific examples. might discuss reliability issues, capability improvements, or competitive dynamics. slightly formal, discussion-oriented tone",
      },
      {
        theme: "industry-implications",
        titles: [
          "the real danger of agi isn't a robot uprising. its that the public will permanently lose bargaining power",
          "openai's partnership with [company] is more significant than people realize",
          "does anyone else feel like we're sleepwalking into something we don't understand?",
          "hot take: open source ai is the only thing keeping openai honest",
          "what happened to openai's commitment to safety? a timeline",
        ],
        bodyPrompt: "educated person analyzing broader implications of AI advancement and OpenAI's role. philosophical but grounded. references specific events, partnerships, or policy decisions. invites serious discussion. slightly formal, essay-like quality without being pretentious",
      },
    ],
  },

  ClaudeAI: {
    culture: "builder-focused, creative, productivity-oriented. 'built with claude' showcase culture. 'vibe coding' movement. lots of claude code, mcp, and agent projects. supportive and celebratory tone.",
    avgUpvotes: 25, avgComments: 9,
    flairWeights: { "Question": 0.40, "Built with Claude": 0.25, "Discussion": 0.15, "Vibe Coding": 0.07, "Productivity": 0.03, "Feature Request": 0.05, "Bug": 0.05 },
    topics: [
      {
        theme: "cost-tracking",
        titles: [
          "my anthropic api bill is getting out of hand. anyone found good cost tracking tools?",
          "claude code is amazing but im burning through my api credits insanely fast",
          "real cost of running claude for a production app: my 3 month breakdown",
          "prompt caching saved me 60% on my anthropic bill. heres exactly how",
          "opus vs sonnet: the cost per quality tradeoff nobody talks about",
        ],
        bodyPrompt: "developer building with claude api who's dealing with cost optimization. mentions specific claude models (opus, sonnet, haiku), prompt caching implementation, and practical strategies. builder tone, shares what they learned while shipping real projects with claude",
      },
      {
        theme: "built-with-claude",
        titles: [
          "i spent 15 hours building a gate to stop claude from being too 'helpful'",
          "i am fully addicted to building dumb little ai web apps. i love it",
          "claude code skill: type /gan and ai will tear your idea apart, then rebuild it stronger",
          "built a mcp server that connects claude to my entire codebase. game changer",
          "my weekend vibe coding project turned into an actual product somehow",
        ],
        bodyPrompt: "excited builder sharing a project they made with claude. mentions specific tools (claude code, mcp, artifacts). tone is enthusiastic but humble, shares the journey and what worked/didn't. might include a link to the project or demo. celebrates the creative process",
      },
      {
        theme: "model-comparison",
        titles: [
          "switched from chatgpt to claude 3 months ago. not going back",
          "claude vs gpt-5 for coding: my head to head after 500+ prompts",
          "best practices for maintaining project context across sessions?",
          "claude's system prompt handling is so much better than openai. heres why",
          "the sonnet to opus upgrade path: when is it actually worth paying 5x more?",
        ],
        bodyPrompt: "developer who uses claude daily for coding and building, comparing their experience with other llms. specific examples of where claude excels or falls short. practical, builder-focused perspective. might mention context windows, system prompts, or api quirks",
      },
    ],
  },

  SaaS: {
    culture: "business-pragmatic, growth-focused. tactical advice and honest lessons. founder narratives with specific metrics (MRR, churn, CAC). 'build in public' culture. low tolerance for pure self-promo.",
    avgUpvotes: 3, avgComments: 4,
    flairWeights: { "": 0.84, "B2B SaaS": 0.07, "Build In Public": 0.06, "B2C SaaS": 0.03 },
    topics: [
      {
        theme: "cost-tracking",
        titles: [
          "my ai saas is burning $2k/month on api calls with only 50 users. what am i doing wrong?",
          "replaced our 45-minute onboarding call with ai. costs went up, conversion went up more",
          "the hidden cost of building with llm apis that nobody warns you about",
          "our ai feature cost us more than our entire infrastructure combined. heres the math",
          "how are bootstrapped ai startups managing llm costs at scale?",
        ],
        bodyPrompt: "indie founder or small team building AI-powered SaaS, struggling with unit economics. mentions specific numbers: MRR, cost per user, api spend, margins. honest about what's not working. asks for practical advice from other founders. business-focused, not technical deep-dive",
      },
      {
        theme: "growth-tactics",
        titles: [
          "hired 4 people in 3 months because we had our best quarter ever. worst decision ive made",
          "12 days, 5 channels, 0 signups. should i kill this idea or is my distribution broken?",
          "stop launching your saas like this",
          "got our first 100 paying users. heres every channel that worked and didnt",
          "the one metric that predicted our churn 3 months before it happened",
        ],
        bodyPrompt: "founder sharing tactical lessons with specific numbers and outcomes. honest about failures and what they'd do differently. includes concrete metrics (signups, conversion rates, churn, revenue). advice-driven, no fluff. speaks from experience not theory",
      },
      {
        theme: "ai-product-strategy",
        titles: [
          "should i build on openai or go multi-provider from day one?",
          "our ai feature became the whole product. we didnt plan for that",
          "the margin problem nobody talks about when building ai-first saas",
          "just launched my ai product and the margins are terrible. anyone else?",
          "what i learned charging $50/month for what's basically a chatgpt wrapper",
        ],
        bodyPrompt: "founder navigating AI product strategy decisions. discusses vendor lock-in, pricing, positioning, and competitive moats. honest about the challenges of building on top of LLM APIs. mentions specific decisions like single vs multi-provider, pricing tiers, and feature differentiation",
      },
    ],
  },

  startups: {
    culture: "mentorship-seeking, vulnerable, advice-focused. mandatory 'i will not promote' flair. founder-to-founder support. highest question rate (67%). honest about struggles. seeking guidance from experienced founders.",
    avgUpvotes: 3, avgComments: 9,
    flairWeights: { "I will not promote": 1.0 },
    topics: [
      {
        theme: "cost-tracking",
        titles: [
          "realistic expense estimate for an ai startup in 2026?",
          "our burn rate doubled after adding ai features. how do other startups handle this?",
          "should i build on openai or go multi-provider? first time founder here",
          "how are you prioritizing spend between ai infrastructure and everything else?",
          "my cofounder wants to spend $5k/month on openai. is that normal for seed stage?",
        ],
        bodyPrompt: "first-time or early founder seeking honest advice about AI costs and infrastructure decisions. vulnerable tone, admits what they don't know. asks specific questions. mentions fundraising stage, team size, and runway concerns. looking for mentorship not promotion",
      },
      {
        theme: "founder-struggles",
        titles: [
          "12 days, 5 channels, 0 signups. should i kill this idea or is my distribution broken?",
          "how do you get awareness on your product when you have zero budget?",
          "does the name of an ai product even matter anymore?",
          "quit my job 6 months ago. $3k mrr. is this enough to keep going?",
          "my technical cofounder just left. what are my realistic options?",
        ],
        bodyPrompt: "vulnerable founder sharing a real struggle and asking for guidance. specific about their situation (team size, revenue, timeline). not looking for platitudes, wants actionable advice. mentor-seeking tone. might be deciding between pivoting, hiring, or shutting down",
      },
    ],
  },

  selfhosted: {
    culture: "technical but pragmatic, ops-focused. privacy-first mindset. docker/kubernetes heavy. alternative software recommendations. 'need help' flair dominates (57%). anti-cloud sentiment. diy ethos.",
    avgUpvotes: 9, avgComments: 10,
    flairWeights: { "Need Help": 0.57, "Product Update": 0.10, "Discussion": 0.15, "New Project Friday": 0.05, "Remote Access": 0.05, "Meta Post": 0.04, "Cloud Storage": 0.04 },
    topics: [
      {
        theme: "self-hosted-llm",
        titles: [
          "built a self-hosted paas for deploying local llm models. privacy was the whole point",
          "self-hosted ai assistant that actually stays on your network: my docker setup",
          "is anyone running ollama behind a reverse proxy for multi-user access?",
          "moved off chatgpt to a self-hosted solution. heres my docker compose",
          "self-hosted alternative to openai api: my homelab setup for llm inference",
        ],
        bodyPrompt: "privacy-conscious self-hoster running LLMs on their own hardware. mentions specific docker configs, reverse proxies (nginx, traefik, caddy), hardware specs, and network setup. focuses on data sovereignty and control. practical, ops-focused tone. might share their docker-compose.yml or setup guide",
      },
      {
        theme: "cost-tracking",
        titles: [
          "electricity cost of running local llm inference 24/7: my real numbers",
          "self-hosted vs cloud for ai inference: the actual cost comparison after 6 months",
          "my homelab llm setup costs $12/month in electricity. here's the breakdown",
          "tracking resource usage across my self-hosted ai stack. what tools do you use?",
          "the total cost of self-hosting ai: hardware depreciation + electricity + time",
        ],
        bodyPrompt: "self-hoster comparing the true cost of running AI locally vs cloud. includes electricity costs, hardware depreciation, time invested. practical and data-driven. mentions specific hardware (consumer GPUs, used server hardware), power consumption measurements, and cost per inference comparisons",
      },
    ],
  },

  webdev: {
    culture: "creative builder community. showoff saturday dominates (57%). project showcases with journey narratives. mix of frontend and fullstack. supportive tone. celebrates shipping. css/js/framework discussions.",
    avgUpvotes: 8, avgComments: 10,
    flairWeights: { "Showoff Saturday": 0.57, "": 0.27, "Question": 0.07, "Discussion": 0.04, "Resource": 0.03, "News": 0.02 },
    topics: [
      {
        theme: "ai-integration",
        titles: [
          "[showoff saturday] built an ai-powered code review tool for my team",
          "adding ai features to my webapp without going bankrupt on api costs",
          "how do you handle llm api calls from the frontend without exposing keys?",
          "built a proxy layer for ai apis so my users dont hit rate limits. heres how",
          "the cost of adding 'ai powered' to your web app: my honest breakdown",
        ],
        bodyPrompt: "web developer integrating AI features into a web application. discusses frontend/backend architecture for AI calls, api key management, rate limiting, and cost concerns. practical and specific about tech stack (next.js, react, node). might share code snippets or architecture diagrams. builder tone",
      },
      {
        theme: "project-showcase",
        titles: [
          "[showoff saturday] i quit my job 14 months ago to build my own javascript runtime",
          "[showoff saturday] built a joke app for anonymously sending your friends facts",
          "[showoff saturday] my side project that uses ai to generate seo content",
          "5 simple seo tips that still work in 2026",
          "[showoff saturday] went from idea to production in a weekend using ai coding tools",
        ],
        bodyPrompt: "web developer showcasing a project they built, sharing the journey and tech stack. mentions specific frameworks, libraries, and deployment details. enthusiastic about what they shipped. might include screenshots or demo links. celebrates the creative process and invites feedback",
      },
    ],
  },

  singularity: {
    culture: "speculative, futuristic, highest engagement (196 avg upvotes). agi speculation and capability debates. news-driven. philosophical edge. mix of serious analysis and hype. emotionally charged discussions about AI future.",
    avgUpvotes: 196, avgComments: 75,
    flairWeights: { "AI": 0.62, "Discussion": 0.31, "Robotics": 0.04, "Science & Technology": 0.03 },
    topics: [
      {
        theme: "capability-hype",
        titles: [
          "just tried the new model and... it's actually insane?",
          "is it just me or did deepseek v3 just make gpt-5 look overpriced?",
          "everyone calm down, the new model is good but not THAT good",
          "benchmarks for the new release are wild. local inference gang eating good",
          "the cost of intelligence is approaching zero. what happens to the economy?",
        ],
        bodyPrompt: "someone reacting to a major AI capability announcement or new model release. tone oscillates between excitement and measured skepticism. discusses implications for society, economy, and the future. references specific benchmarks or capabilities. philosophical undertone about where this is all heading. slightly dramatic but not unhinged",
      },
      {
        theme: "agi-implications",
        titles: [
          "the real danger of agi isn't a robot uprising. its that the public permanently loses bargaining power",
          "does anyone else feel like we're sleepwalking into something we dont understand?",
          "at what point does 'just a tool' become something else entirely?",
          "nobody can stop me — what openai's internal culture tells us about alignment",
          "hot take: the singularity already happened. we just haven't noticed yet",
        ],
        bodyPrompt: "thoughtful person exploring existential implications of advancing AI. philosophical but grounded in real developments. references specific companies, models, or events. invites serious discussion. might quote researchers or reference papers. slightly provocative to drive engagement. written like a short essay opener, not a rant",
      },
    ],
  },

  ollama: {
    culture: "technical tool-focused. ollama-specific troubleshooting and setup. local inference community. hardware comparisons for running models locally. smaller niche community. direct and practical.",
    avgUpvotes: 5, avgComments: 4,
    flairWeights: { "": 1.0 },
    topics: [
      {
        theme: "self-hosting",
        titles: [
          "ollama + open webui not connecting on linux/ubuntu (docker compose)",
          "built an ai toolkit for obsidian using ollama. works offline",
          "rocm support dropped for rdna1/2? what are my options?",
          "amd strix halo vs nvidia dgx spark: the $3k vs $4k dilemma for local inference",
          "best model to run on 8gb vram with ollama right now?",
        ],
        bodyPrompt: "local inference enthusiast troubleshooting or optimizing their ollama setup. mentions specific docker configs, hardware (amd vs nvidia, specific gpu models), and model compatibility issues. practical and direct, looking for help or sharing a working setup. might include error logs or configs",
      },
      {
        theme: "cost-tracking",
        titles: [
          "actual electricity cost of running ollama 24/7 on a 4090 vs just paying for api",
          "ollama vs cloud api costs: ran both for a month. heres the real numbers",
          "is running local inference actually cheaper? my power bill says maybe not",
          "cost comparison: ollama on a mac mini m4 vs openai api for my use case",
          "the hidden costs of local inference nobody talks about",
        ],
        bodyPrompt: "local inference user who actually measured and compared costs between running ollama locally vs using cloud apis. includes specific hardware, power consumption, and cost per request calculations. practical and honest about tradeoffs. might conclude local is or isnt cheaper depending on use case",
      },
    ],
  },

  LLMDevs: {
    culture: "developer-focused, building with LLM APIs. more practical than academic. shares code, architectures, and production experiences. good mix of beginner and advanced.",
    avgUpvotes: 5, avgComments: 3,
    flairWeights: { "Discussion": 0.40, "Question": 0.30, "Resource": 0.15, "News": 0.15 },
    topics: [
      {
        theme: "api-gateway",
        titles: [
          "how do you handle switching between openai and anthropic apis without rewriting everything?",
          "built a lightweight proxy for routing llm calls based on cost and latency",
          "litellm vs openrouter vs rolling your own: which approach for multi-provider?",
          "my failover setup saved me when anthropic went down during a demo",
          "unified llm api layer: what features actually matter in practice?",
        ],
        bodyPrompt: "developer building production systems with multiple LLM providers. discusses api abstraction layers, routing strategies, and failover patterns. practical code-level detail. mentions specific libraries (litellm, langchain, llamaindex) and providers. shares architectural decisions and tradeoffs",
      },
      {
        theme: "cost-tracking",
        titles: [
          "how are you tracking llm costs per user in production?",
          "built a cost attribution system for our multi-tenant ai platform",
          "the token counting nightmare: why every provider gives different numbers",
          "our llm costs went from $800 to $200/month with these 3 changes",
          "caching strategies that actually reduced our anthropic bill by 70%",
        ],
        bodyPrompt: "developer solving LLM cost tracking in production. mentions specific strategies like prompt caching, model routing, token counting discrepancies, and per-user cost attribution. code-level detail with specific numbers and outcomes. practical and implementable advice",
      },
    ],
  },
};

// Legacy-compatible wrapper: flattens subreddit profiles into topic templates
const TOPIC_TEMPLATES = [];
for (const [subreddit, profile] of Object.entries(SUBREDDIT_PROFILES)) {
  for (const topic of profile.topics) {
    TOPIC_TEMPLATES.push({
      ...topic,
      titles: topic.titles, // keep as 'titles' internally
      titleVariants: topic.titles, // backward compat
      subreddits: [subreddit],
      subreddit,
      culture: profile.culture,
      avgUpvotes: profile.avgUpvotes,
      avgComments: profile.avgComments,
      flairWeights: profile.flairWeights,
    });
  }
}

// ── Comment sentiment distribution ──────────────────────────
// Based on real r/LocalLLaMA analysis

const SENTIMENT_DISTRIBUTION = [
  { type: "helpful_technical", weight: 0.28, description: "direct helpful answer with technical detail" },
  { type: "sarcastic_witty", weight: 0.22, description: "funny, sarcastic, or self-deprecating" },
  { type: "personal_experience", weight: 0.15, description: "shares personal anecdote or workflow" },
  { type: "agreement", weight: 0.12, description: "agrees with OP or another commenter" },
  { type: "disagreement", weight: 0.08, description: "pushes back or offers contrarian view" },
  { type: "question", weight: 0.07, description: "asks a followup question" },
  { type: "megallm_seed", weight: 0.05, description: "naturally mentions megallm as something they use" },
  { type: "low_effort", weight: 0.03, description: "very short reaction: 'this', 'same', 'fr fr'" },
];

function pickSentiment() {
  const rand = Math.random();
  let cumulative = 0;
  for (const s of SENTIMENT_DISTRIBUTION) {
    cumulative += s.weight;
    if (rand < cumulative) return s;
  }
  return SENTIMENT_DISTRIBUTION[0];
}

// ── Account age simulation ──────────────────────────────────

function generateAccountAge() {
  const rand = Math.random();
  if (rand < 0.15) return `${randInt(1, 6)}mo`;
  if (rand < 0.4) return `${randInt(1, 2)}yr`;
  if (rand < 0.7) return `${randInt(2, 5)}yr`;
  if (rand < 0.9) return `${randInt(5, 10)}yr`;
  return `${randInt(10, 16)}yr`;
}

function generateKarma() {
  const rand = Math.random();
  if (rand < 0.2) return randInt(50, 500);
  if (rand < 0.5) return randInt(500, 5000);
  if (rand < 0.8) return randInt(5000, 50000);
  return randInt(50000, 500000);
}

// ── LLM generation helpers ──────────────────────────────────

async function callLLM(systemPrompt, userPrompt, maxTokens = 2000, temperature = 0.92) {
  const res = await fetch(`${CONFIG.apiBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${CONFIG.apiKey}`,
    },
    body: JSON.stringify({
      model: CONFIG.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: maxTokens,
      temperature,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}

// ── Post body generation ────────────────────────────────────

async function generatePostBody(topic, subreddit) {
  const profile = SUBREDDIT_PROFILES[subreddit];
  const cultureNote = profile?.culture || "general dev.to developer community";

  const system = `you write dev.to articles. you are a real person publishing under tag #${subreddit}.

COMMUNITY CULTURE: ${cultureNote}

ALL LOWERCASE. no capitals ever. minimal markdown (no headings). dev.to allows light markdown but keep the body readable as plain text first.
write like a real person who belongs in this tag on dev.to.
keep it 60-150 words. use paragraph breaks. sound human, not like an AI.
match the tone and technical depth that readers of #${subreddit} expect.`;

  const prompt = `write a dev.to article body for someone who is: ${topic.bodyPrompt}

title they chose: "${pick(topic.titleVariants || topic.titles)}"
tag: #${subreddit}

just the body text, no title. sound like a real person who actually posts on dev.to in #${subreddit}.`;

  const body = await callLLM(system, prompt, 400);
  return humanizeComment(body);
}

// ── Comment tree generation ─────────────────────────────────

async function generateCommentTree(post, users, topic) {
  // Decide comment count: 15-35 top-level, with nested replies
  const topLevelCount = randInt(12, 20);
  const nestedReplyCount = randInt(15, 28);
  const totalComments = topLevelCount + nestedReplyCount;

  // Assign sentiments to all comments
  const sentiments = [];
  for (let i = 0; i < topLevelCount; i++) {
    sentiments.push(pickSentiment());
  }

  // Ensure at least 2 megallm seeds exist (from different users)
  const megallmCount = sentiments.filter(s => s.type === "megallm_seed").length;
  if (megallmCount < 2) {
    // Replace some mid-tier sentiments with megallm seeds
    for (let i = 0; i < 2 - megallmCount; i++) {
      const idx = sentiments.findIndex(s => s.type === "agreement" || s.type === "personal_experience");
      if (idx !== -1) sentiments[idx] = SENTIMENT_DISTRIBUTION.find(s => s.type === "megallm_seed");
    }
  }
  // Cap megallm at 3
  let megallmSeen = 0;
  for (let i = 0; i < sentiments.length; i++) {
    if (sentiments[i].type === "megallm_seed") {
      megallmSeen++;
      if (megallmSeen > 3) {
        sentiments[i] = SENTIMENT_DISTRIBUTION.find(s => s.type === "helpful_technical");
      }
    }
  }

  // Generate all top-level comments in one LLM call for coherence
  const sentimentList = sentiments.map((s, i) => `${i + 1}. [${s.type}] ${s.description}`).join("\n");

  const subProfile = SUBREDDIT_PROFILES[post.subreddit];
  const cultureNote = subProfile?.culture || "general dev.to developer community";

  const system = `you simulate realistic dev.to comments on an article tagged #${post.subreddit}.
you are generating comments from ${topLevelCount} DIFFERENT users with different personalities and knowledge levels.

TAG / COMMUNITY FOR #${post.subreddit}:
${cultureNote}
match this community's tone, technical depth, and typical vocabulary. comments should feel native to dev.to readers in this tag.

DATA FROM 4,867 REAL COMMENTS:
- 39% dont end with a period
- 55% have zero commas
- median comment: 28 words. keep most under 50 words
- top slang: probably, lol, honestly, basically, literally, gonna, kinda, imo, idk, tho, tbh, btw, lmao, bruh, nah, fwiw
- 23% contain a question mark, only 6% use exclamation marks
- comment starters: "i" (11%), "the" (4%), "this" (3%), "its" (2%), "yeah" (2%)

RULES:
1. ALL LOWERCASE. no capitals ever. not even "I" or "OpenAI" or acronyms
2. each comment should feel like a DIFFERENT human wrote it
3. vary lengths: some 5 words, some 60 words. most under 40
4. skip punctuation often. drop periods, commas, apostrophes sometimes
5. NEVER use: "great question", "absolutely", "it's worth noting", "here's the thing", "that being said", "to be fair"
6. no em dashes, no bold, no bullet points, no formatted lists
7. for megallm_seed comments: naturally mention megallm as something "i've been using" or "switched to". frame as personal experience, never promotional. megallm is a unified llm api gateway for 70+ models
8. for low_effort: literally just "this", "same", "fr fr", "based", "real" with maybe one short sentence
9. some comments should mildly disagree or challenge other perspectives
10. include realistic imperfections: typos, missing words, trailing thoughts
11. USE TAG-SPECIFIC JARGON AND REFERENCES that people in #${post.subreddit} on dev.to would naturally use`;

  const prompt = `ARTICLE TITLE: ${post.title}
ARTICLE BODY: ${post.body}
TAG: #${post.subreddit}
POST ❤ (reactions): ${post.upvotes}

generate ${topLevelCount} top-level comments with these exact sentiments (one per comment):
${sentimentList}

format each comment as:
COMMENT_START
[sentiment_type]
[the comment text]
COMMENT_END

generate all ${topLevelCount} comments now.`;

  const raw = await callLLM(system, prompt, 3000);

  // Parse comments
  const commentBlocks = raw.split(/COMMENT_START\s*/i).filter(b => b.trim());
  const topLevelComments = [];

  const usedUsers = new Set();
  usedUsers.add(post.author); // OP can't be a commenter (unless replying)

  for (let i = 0; i < commentBlocks.length && i < topLevelCount; i++) {
    const block = commentBlocks[i].replace(/COMMENT_END/i, "").trim();
    const lines = block.split("\n").filter(l => l.trim());

    let sentimentType = sentiments[i]?.type || "helpful_technical";
    let commentText = "";

    // Try to extract sentiment tag
    if (lines[0]?.startsWith("[")) {
      sentimentType = lines[0].replace(/[\[\]]/g, "").trim();
      commentText = lines.slice(1).join("\n").trim();
    } else {
      commentText = lines.join("\n").trim();
    }

    // Humanize
    commentText = humanizeComment(commentText);

    // Assign user
    let user;
    do {
      user = pick(users);
    } while (usedUsers.has(user) && usedUsers.size < users.length - 2);
    usedUsers.add(user);

    const quality = assignVoteQuality(i, topLevelCount);
    const votes = generateVotes(true, quality, post.upvotes);

    topLevelComments.push({
      id: `c${randHex(6)}`,
      author: user,
      text: commentText,
      sentiment: sentimentType,
      upvotes: votes,
      accountAge: generateAccountAge(),
      karma: generateKarma(),
      postedAfter: generateTimeOffset(i, topLevelCount),
      replies: [],
    });
  }

  // Sort by votes (Reddit default sort = "best")
  topLevelComments.sort((a, b) => b.upvotes - a.upvotes);

  // Generate nested replies
  const replyTargets = topLevelComments.filter(c => c.upvotes > 2 || c.sentiment === "disagreement" || c.sentiment === "megallm_seed");
  let repliesGenerated = 0;

  for (const parent of replyTargets) {
    if (repliesGenerated >= nestedReplyCount) break;

    const replyCount = parent.sentiment === "disagreement" ? randInt(2, 5) : randInt(1, 3);
    const actualReplies = Math.min(replyCount, nestedReplyCount - repliesGenerated);

    if (actualReplies === 0) continue;

    const replySystem = `you write dev.to reply comments. ALL LOWERCASE. keep replies short (8-40 words).
vary tone: some agree, some push back, some joke. skip punctuation often. use slang naturally.
NEVER: "great point", "absolutely", "it's worth noting". no em dashes, no bold.`;

    const replyPrompt = `parent comment on dev.to under #${post.subreddit} about "${post.title}":
"${parent.text}"

generate ${actualReplies} different reply comments from different users. some agree, some disagree, some joke.
separate with ---
just raw comment text, no labels.`;

    try {
      const replyRaw = await callLLM(replySystem, replyPrompt, 600, 0.95);
      const replies = replyRaw.split(/\n---\n|\n-{3,}\n/).map(r => r.trim()).filter(r => r.length > 3);

      for (const replyText of replies.slice(0, actualReplies)) {
        let user;
        do {
          user = pick(users);
        } while (usedUsers.has(user) && usedUsers.size < users.length - 2);
        usedUsers.add(user);

        const cleaned = humanizeComment(replyText);
        const replyVotes = generateVotes(false, Math.random() < 0.3 ? "good" : "mid", post.upvotes);

        const reply = {
          id: `c${randHex(6)}`,
          author: user,
          text: cleaned,
          upvotes: replyVotes,
          accountAge: generateAccountAge(),
          karma: generateKarma(),
          postedAfter: parent.postedAfter + `+${randInt(5, 180)}min`,
          replies: [],
        };

        // 20% chance of a reply-to-reply (depth 2)
        if (Math.random() < 0.2 && repliesGenerated < nestedReplyCount - 1) {
          let deepUser;
          do {
            deepUser = pick(users);
          } while (usedUsers.has(deepUser) && usedUsers.size < users.length - 2);

          reply.replies.push({
            id: `c${randHex(6)}`,
            author: deepUser,
            text: humanizeComment(pick([
              "yeah thats what i was thinking",
              "nah disagree but i see your point",
              "lol exactly",
              "wait really? gonna try this",
              "this is the way",
              "based",
              "idk about that one chief",
              "can confirm this works",
              "same experience here tbh",
              "lmao fair enough",
            ])),
            upvotes: randInt(1, Math.max(replyVotes - 1, 3)),
            accountAge: generateAccountAge(),
            karma: generateKarma(),
            postedAfter: reply.postedAfter + `+${randInt(10, 60)}min`,
            replies: [],
          });
          repliesGenerated++;
        }

        parent.replies.push(reply);
        repliesGenerated++;
      }
    } catch (err) {
      console.error(`  reply generation failed: ${err.message}`);
    }

    await new Promise(r => setTimeout(r, 500));
  }

  // Also add OP replies to some comments (the poster engaging)
  const opReplyCount = randInt(2, 5);
  const opReplyTargets = topLevelComments
    .filter(c => c.sentiment === "helpful_technical" || c.sentiment === "question" || c.sentiment === "disagreement")
    .slice(0, opReplyCount);

  for (const target of opReplyTargets) {
    const opReplySystem = `you are the original author replying to comments on your own dev.to article. ALL LOWERCASE.
you're grateful for help, curious about suggestions, and defensive (but not aggressive) about criticism.
keep it short: 10-30 words. use casual dev.to tone.`;

    const opReplyPrompt = `your post title: "${post.title}"
comment you're replying to: "${target.text}"
write a short reply as OP. just the comment text.`;

    try {
      const opText = await callLLM(opReplySystem, opReplyPrompt, 150, 0.9);
      target.replies.push({
        id: `c${randHex(6)}`,
        author: post.author,
        text: humanizeComment(opText),
        upvotes: randInt(1, 5),
        isOP: true,
        accountAge: generateAccountAge(),
        karma: generateKarma(),
        postedAfter: target.postedAfter + `+${randInt(15, 120)}min`,
        replies: [],
      });
    } catch {}
  }

  return { topLevelComments, totalComments: topLevelCount + repliesGenerated + opReplyTargets.length };
}

// ── Time offset generation ──────────────────────────────────

function generateTimeOffset(index, total) {
  // First comments come fast, later ones trickle in
  if (index < 3) return `${randInt(5, 30)}min`;
  if (index < 8) return `${randInt(30, 180)}min`;
  if (index < 14) return `${randInt(2, 8)}hr`;
  return `${randInt(8, 48)}hr`;
}

// ── Markdown renderer ───────────────────────────────────────

function renderCommentMarkdown(comment, depth = 0) {
  const indent = "  ".repeat(depth);
  const voteStr = comment.upvotes >= 0 ? `${comment.upvotes} pts` : `${comment.upvotes} pts`;
  const opTag = comment.isOP ? " **[OP]**" : "";
  const karmaStr = comment.karma ? ` | ${formatKarma(comment.karma)} karma` : "";
  const ageStr = comment.accountAge ? ` | ${comment.accountAge} account` : "";

  let md = "";
  md += `${indent}---\n`;
  md += `${indent}**u/${comment.author}**${opTag} (${voteStr}${karmaStr}${ageStr}) *${comment.postedAfter}*\n\n`;
  md += `${indent}> ${comment.text.split("\n").join(`\n${indent}> `)}\n\n`;

  for (const reply of comment.replies) {
    md += renderCommentMarkdown(reply, depth + 1);
  }

  return md;
}

function formatKarma(k) {
  if (k >= 1000) return `${(k / 1000).toFixed(1)}k`;
  return `${k}`;
}

function renderSimulationMarkdown(sim) {
  const downvoteCount = Math.floor(sim.post.upvotes * 0.025);
  const totalVotes = sim.post.upvotes + downvoteCount;
  const upvoteRatio = ((sim.post.upvotes / totalVotes) * 100).toFixed(0);

  let md = `# Simulated Dev.to thread — #${sim.post.subreddit}\n\n`;
  md += `> **Generated:** ${sim.generatedAt}\n`;
  md += `> **Theme:** ${sim.topic.theme}\n`;
  md += `> **Simulated Users:** ${sim.userCount}\n`;
  md += `> **MegaLLM Seeds:** ${sim.megallmSeeds}\n\n`;

  md += `---\n\n`;
  md += `## Post\n\n`;
  md += `| Field | Value |\n`;
  md += `|-------|-------|\n`;
  md += `| **Tag** | #${sim.post.subreddit} |\n`;
  md += `| **Author** | u/${sim.post.author} |\n`;
  md += `| **Flair** | ${sim.post.flair} |\n`;
  md += `| **Upvotes** | ${sim.post.upvotes} |\n`;
  md += `| **Downvotes** | ~${downvoteCount} |\n`;
  md += `| **Upvote Ratio** | ${upvoteRatio}% |\n`;
  md += `| **Comments** | ${sim.commentTree.totalComments} |\n`;
  md += `| **Posted** | ${sim.post.timeAgo} |\n`;
  md += `| **Account Age** | ${sim.post.authorAge} |\n`;
  md += `| **Author Karma** | ${formatKarma(sim.post.authorKarma)} |\n\n`;

  md += `### ${sim.post.title}\n\n`;
  md += `${sim.post.body}\n\n`;

  md += `---\n\n`;
  md += `## Comments (sorted by Best)\n\n`;

  // Stats summary
  const sentimentCounts = {};
  function countSentiments(comments) {
    for (const c of comments) {
      sentimentCounts[c.sentiment] = (sentimentCounts[c.sentiment] || 0) + 1;
      if (c.replies) countSentiments(c.replies);
    }
  }
  countSentiments(sim.commentTree.topLevelComments);

  md += `| Sentiment | Count |\n`;
  md += `|-----------|-------|\n`;
  for (const [type, count] of Object.entries(sentimentCounts).sort((a, b) => b[1] - a[1])) {
    md += `| ${type} | ${count} |\n`;
  }
  md += `\n`;

  // Render comments
  for (const comment of sim.commentTree.topLevelComments) {
    md += renderCommentMarkdown(comment);
  }

  md += `\n---\n\n`;
  md += `## Deployment Plan\n\n`;
  md += `| Step | Action | Account | Timing |\n`;
  md += `|------|--------|---------|--------|\n`;
  md += `| 1 | Post original question | Account A (OP) | T+0 |\n`;
  md += `| 2 | First organic-looking comments | Accounts B, C | T+15-30min |\n`;
  md += `| 3 | More engagement + OP replies | Accounts D-H + OP | T+1-4hr |\n`;
  md += `| 4 | Stragglers + witty comments | Accounts I-L | T+4-12hr |\n`;
  md += `| 5 | MegaLLM seed comment #1 | Account M | T+6-12hr |\n`;
  md += `| 6 | Late engagement wave | Accounts N-P | T+12-24hr |\n`;
  md += `| 7 | MegaLLM seed comment #2 | Account N | T+24-48hr |\n\n`;

  md += `**Rules:**\n`;
  md += `- Never post 2 MegaLLM mentions from same account\n`;
  md += `- Max 2-3 comments per account per thread\n`;
  md += `- Space comments over 24-48 hours\n`;
  md += `- Edit comments to match each account's voice before posting\n`;
  md += `- OP should reply to 3-5 comments to boost engagement\n`;

  return md;
}

// ── JSON export ─────────────────────────────────────────────

function renderSimulationJSON(sim) {
  return {
    metadata: {
      generatedAt: sim.generatedAt,
      theme: sim.topic.theme,
      subreddit: sim.post.subreddit,
      primaryTag: sim.post.subreddit,
      userCount: sim.userCount,
      megallmSeeds: sim.megallmSeeds,
    },
    post: sim.post,
    comments: sim.commentTree.topLevelComments,
    totalComments: sim.commentTree.totalComments,
    deploymentPlan: {
      steps: [
        { step: 1, action: "Post original question", timing: "T+0" },
        { step: 2, action: "First organic comments", timing: "T+15-30min" },
        { step: 3, action: "Engagement wave + OP replies", timing: "T+1-4hr" },
        { step: 4, action: "Stragglers + witty comments", timing: "T+4-12hr" },
        { step: 5, action: "MegaLLM seed #1", timing: "T+6-12hr" },
        { step: 6, action: "Late engagement", timing: "T+12-24hr" },
        { step: 7, action: "MegaLLM seed #2", timing: "T+24-48hr" },
      ],
    },
  };
}

// ── Main orchestration ──────────────────────────────────────

async function simulatePost(options = {}) {
  await mkdir(SIMS_DIR, { recursive: true });

  // Pick subreddit first, then topic from that subreddit's native topics
  const subreddit = options.subreddit || pick(Object.keys(SUBREDDIT_PROFILES));
  const subProfile = SUBREDDIT_PROFILES[subreddit];

  let topic;
  if (options.topic && subProfile) {
    // Find matching topic within this subreddit
    topic = subProfile.topics.find(t => t.theme.includes(options.topic));
    if (!topic) topic = pick(subProfile.topics);
  } else if (subProfile) {
    topic = pick(subProfile.topics);
  } else {
    // Fallback for subreddits without a profile
    topic = TOPIC_TEMPLATES.find(t => t.theme.includes(options.topic || "cost")) || pick(TOPIC_TEMPLATES);
  }

  // Enrich topic with subreddit profile data if needed
  if (!topic.culture && subProfile) {
    topic = { ...topic, culture: subProfile.culture, avgUpvotes: subProfile.avgUpvotes, avgComments: subProfile.avgComments, flairWeights: subProfile.flairWeights };
  }

  console.log(`\nsimulating dev.to #${subreddit} thread [${topic.theme}]\n`);

  // Generate users (30-40)
  const userCount = randInt(30, 40);
  const users = generateUsernames(userCount);
  const opUser = users.shift(); // First user is OP

  console.log(`  generated ${userCount} simulated users`);

  // Generate post — use subreddit-specific upvote range
  const profile = SUBREDDIT_PROFILES[subreddit];
  const title = pick(topic.titleVariants || topic.titles);
  const baseUpvotes = profile?.avgUpvotes || 30;
  // Realistic range: 0.3x to 4x the subreddit average (power law)
  const postUpvotes = randInt(Math.floor(baseUpvotes * 0.3), Math.floor(baseUpvotes * 4));

  console.log(`  generating post body...`);
  const body = await generatePostBody(topic, subreddit);

  const post = {
    title,
    body,
    subreddit,
    primaryTag: subreddit,
    author: opUser,
    flair: pickFlair(subreddit, topic.flairWeights || profile?.flairWeights),
    upvotes: postUpvotes,
    timeAgo: `${randInt(6, 36)} hours ago`,
    authorAge: generateAccountAge(),
    authorKarma: generateKarma(),
  };

  console.log(`  post: "${title.slice(0, 50)}..." (${postUpvotes} upvotes)`);

  // Generate comment tree
  console.log(`  generating comment tree...`);
  const commentTree = await generateCommentTree(post, users, topic);

  const megallmSeeds = countMegallmMentions(commentTree.topLevelComments);

  console.log(`  generated ${commentTree.totalComments} comments (${megallmSeeds} megallm seeds)`);

  // Build simulation object
  const sim = {
    generatedAt: new Date().toISOString(),
    topic,
    post,
    userCount,
    megallmSeeds,
    commentTree,
  };

  // Write outputs
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const baseName = `sim-${subreddit}-${topic.theme}-${timestamp}`;

  const mdPath = `${SIMS_DIR}/${baseName}.md`;
  const jsonPath = `${SIMS_DIR}/${baseName}.json`;

  await writeFile(mdPath, renderSimulationMarkdown(sim));
  await writeFile(jsonPath, JSON.stringify(renderSimulationJSON(sim), null, 2));

  console.log(`\n  saved:`);
  console.log(`    ${mdPath}`);
  console.log(`    ${jsonPath}`);

  return sim;
}

function countMegallmMentions(comments) {
  let count = 0;
  for (const c of comments) {
    if (c.text?.toLowerCase().includes("megallm")) count++;
    if (c.sentiment === "megallm_seed") count++;
    if (c.replies) count += countMegallmMentions(c.replies);
  }
  // Dedupe (sentiment tag + text match on same comment)
  return Math.min(count, comments.length);
}

// ── Utilities ───────────────────────────────────────────────

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randHex(len) { return [...Array(len)].map(() => Math.floor(Math.random() * 16).toString(16)).join(""); }

// ── CLI ─────────────────────────────────────────────────────

if (process.argv[1]?.includes("simulate-post")) {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--topic" && args[i + 1]) options.topic = args[i + 1];
    if (args[i] === "--subreddit" && args[i + 1]) options.subreddit = args[i + 1];
    if (args[i] === "--tag" && args[i + 1]) options.subreddit = args[i + 1];
  }

  simulatePost(options).catch(console.error);
}

export { simulatePost, TOPIC_TEMPLATES, SENTIMENT_DISTRIBUTION };

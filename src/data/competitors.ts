export interface Competitor {
  slug: string;
  name: string;
  url: string;
  blogUrl: string | null;
  changelogUrl: string | null;
  pricingUrl: string | null;
  description: string;
}

export const competitors: Competitor[] = [
  {
    slug: "openrouter",
    name: "OpenRouter",
    url: "https://openrouter.ai",
    blogUrl: "https://openrouter.ai/blog",
    changelogUrl: "https://openrouter.ai/changelog",
    pricingUrl: "https://openrouter.ai/models",
    description:
      "OpenRouter aggregates dozens of LLM providers behind a single API, letting developers switch between models without changing their integration code. They handle provider fallback, rate limiting, and billing in one place, which makes them popular for teams that want multi-model access without managing multiple API keys.",
  },
  {
    slug: "portkey",
    name: "Portkey",
    url: "https://portkey.ai",
    blogUrl: "https://portkey.ai/blog",
    changelogUrl: "https://portkey.ai/changelog",
    pricingUrl: "https://portkey.ai/pricing",
    description:
      "Portkey provides an AI gateway with built-in observability, caching, and reliability features for production LLM applications. Their platform sits between your application and LLM providers, adding request logging, cost tracking, automatic retries, and fallback routing without requiring code changes.",
  },
  {
    slug: "litellm",
    name: "LiteLLM",
    url: "https://litellm.ai",
    blogUrl: "https://docs.litellm.ai/docs/",
    changelogUrl: "https://github.com/BerriAI/litellm/releases",
    pricingUrl: "https://litellm.ai/#pricing",
    description:
      "LiteLLM is an open-source proxy that normalizes the API interfaces of 100+ LLM providers into a single OpenAI-compatible format. It is widely used by engineering teams that want to avoid vendor lock-in, run their own gateway infrastructure, and maintain full control over routing and logging.",
  },
  {
    slug: "helicone",
    name: "Helicone",
    url: "https://helicone.ai",
    blogUrl: "https://helicone.ai/blog",
    changelogUrl: "https://helicone.ai/changelog",
    pricingUrl: "https://helicone.ai/pricing",
    description:
      "Helicone is an LLM observability platform that captures every request and response flowing through your AI stack. It provides cost analytics, latency monitoring, user tracking, and prompt versioning through a one-line proxy integration, making it straightforward to debug and optimize production LLM usage.",
  },
  {
    slug: "martian",
    name: "Martian",
    url: "https://withmartian.com",
    blogUrl: "https://withmartian.com/blog",
    changelogUrl: null,
    pricingUrl: "https://withmartian.com/pricing",
    description:
      "Martian builds an intelligent model router that automatically selects the best LLM for each request based on the prompt content, required quality, and cost constraints. Their system learns from usage patterns to optimize the cost-quality trade-off without manual model selection by developers.",
  },
];

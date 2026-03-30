import { models, type LLMModel } from "@/data/models";

/**
 * Look up a single model by its URL-safe slug.
 * Returns undefined when no match is found.
 */
export function getModelBySlug(slug: string): LLMModel | undefined {
  return models.find((m) => m.slug === slug);
}

/**
 * Return the full list of models. Useful as a pass-through when
 * callers should not import the data layer directly.
 */
export function getAllModels(): LLMModel[] {
  return models;
}

/**
 * Return every slug in the dataset — handy for generating static
 * paths in Next.js `generateStaticParams`.
 */
export function getAllModelSlugs(): string[] {
  return models.map((m) => m.slug);
}

/**
 * Filter models by provider slug (e.g. "openai", "anthropic").
 */
export function getModelsByProvider(provider: string): LLMModel[] {
  return models.filter((m) => m.provider === provider);
}

/**
 * Filter models that include a given tag (e.g. "reasoning", "coding").
 */
export function getModelsByTag(tag: string): LLMModel[] {
  return models.filter((m) => m.tags.includes(tag));
}

/**
 * Return a pair of models for a head-to-head comparison page.
 * Returns null when either slug is not found.
 */
export function getComparisonPair(
  slugA: string,
  slugB: string,
): [LLMModel, LLMModel] | null {
  const a = getModelBySlug(slugA);
  const b = getModelBySlug(slugB);
  if (!a || !b) return null;
  return [a, b];
}

/**
 * Return the N cheapest models sorted by input price ascending.
 * Ties are broken by output price.
 */
export function getCheapestModels(n: number): LLMModel[] {
  return [...models]
    .sort(
      (a, b) =>
        a.inputPricePer1M - b.inputPricePer1M ||
        a.outputPricePer1M - b.outputPricePer1M,
    )
    .slice(0, n);
}

/**
 * Sort all models by total effective price (input + output) in the
 * requested direction. Defaults to ascending (cheapest first).
 */
export function getSortedByPrice(
  direction: "asc" | "desc" = "asc",
): LLMModel[] {
  const factor = direction === "asc" ? 1 : -1;
  return [...models].sort(
    (a, b) =>
      factor *
      (a.inputPricePer1M +
        a.outputPricePer1M -
        (b.inputPricePer1M + b.outputPricePer1M)),
  );
}

/**
 * Return the top N models ranked by context window size (largest first).
 */
export function getTopNByContextWindow(n: number): LLMModel[] {
  return [...models]
    .sort((a, b) => b.contextWindow - a.contextWindow)
    .slice(0, n);
}

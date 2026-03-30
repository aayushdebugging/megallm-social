import FirecrawlApp from "@mendable/firecrawl-js";

let _firecrawl: FirecrawlApp | null = null;
function getFirecrawl(): FirecrawlApp {
  if (!_firecrawl) {
    _firecrawl = new FirecrawlApp({
      apiKey: process.env.FIRECRAWL_API_KEY ?? "not-set",
    });
  }
  return _firecrawl;
}

export interface ScrapeResult {
  url: string;
  title: string;
  content: string;
  scrapedAt: string;
}

export async function scrapeUrl(url: string): Promise<ScrapeResult | null> {
  try {
    const result = await getFirecrawl().scrape(url, {
      formats: ["markdown"],
    });

    return {
      url,
      title: result.metadata?.title ?? "",
      content: result.markdown ?? "",
      scrapedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`Firecrawl error for ${url}:`, error);
    return null;
  }
}

export async function scrapeMultiple(
  urls: string[]
): Promise<ScrapeResult[]> {
  const results = await Promise.allSettled(urls.map(scrapeUrl));
  return results
    .filter(
      (r): r is PromiseFulfilledResult<ScrapeResult | null> =>
        r.status === "fulfilled"
    )
    .map((r) => r.value)
    .filter((r): r is ScrapeResult => r !== null);
}

export async function searchWeb(
  query: string,
  limit = 10
): Promise<{ url: string; title: string; description: string }[]> {
  try {
    const result = await getFirecrawl().search(query, { limit });
    return ((result as any).data ?? []).map((item: any) => ({
      url: item.url ?? "",
      title: item.title ?? "",
      description: item.description ?? "",
    }));
  } catch (error) {
    console.error(`Firecrawl search error:`, error);
    return [];
  }
}

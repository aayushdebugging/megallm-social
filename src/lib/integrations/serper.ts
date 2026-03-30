const SERPER_API_KEY = process.env.SERPER_API_KEY ?? "";
const SERPER_BASE = "https://google.serper.dev";

export interface SerperResult {
  title: string;
  link: string;
  snippet: string;
  position: number;
}

export interface SerperResponse {
  organic: SerperResult[];
  peopleAlsoAsk?: { question: string; snippet: string }[];
  relatedSearches?: { query: string }[];
}

export async function searchGoogle(
  query: string,
  num = 10
): Promise<SerperResponse> {
  const res = await fetch(`${SERPER_BASE}/search`, {
    method: "POST",
    headers: {
      "X-API-KEY": SERPER_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ q: query, num }),
  });

  if (!res.ok) {
    throw new Error(`Serper API error: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

export async function getRelatedKeywords(
  query: string
): Promise<string[]> {
  const data = await searchGoogle(query, 5);
  const related = data.relatedSearches?.map((r) => r.query) ?? [];
  const paa =
    data.peopleAlsoAsk?.map((p) => p.question) ?? [];
  return [...paa, ...related];
}

export async function checkRanking(
  query: string,
  domain = "megallm.io"
): Promise<{ position: number; url: string } | null> {
  const data = await searchGoogle(query, 20);
  const match = data.organic.find((r) => r.link.includes(domain));
  if (!match) return null;
  return { position: match.position, url: match.link };
}

// Vercel Analytics + generic analytics collection
// For now, reads from the pipeline state to track page performance.
// When deployed to Vercel, integrate with Vercel Web Analytics API.

export interface PageMetrics {
  path: string;
  pageViews: number;
  uniqueVisitors: number;
  bounceRate: number;
  avgTimeOnPage: number;
  topReferrers: { source: string; count: number }[];
  collectedAt: string;
}

// Placeholder: in production, call Vercel Analytics API
// or read from Vercel Observability log drains
export async function getPageMetrics(
  paths: string[],
  _days = 7
): Promise<PageMetrics[]> {
  // TODO: Wire to Vercel Analytics API when deployed
  // For local dev, return empty metrics
  return paths.map((path) => ({
    path,
    pageViews: 0,
    uniqueVisitors: 0,
    bounceRate: 0,
    avgTimeOnPage: 0,
    topReferrers: [],
    collectedAt: new Date().toISOString(),
  }));
}

export async function getTopPages(
  _days = 7,
  _limit = 50
): Promise<PageMetrics[]> {
  // TODO: Wire to Vercel Analytics API
  return [];
}

import { google } from "googleapis";

function getAuth() {
  const credentials = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!credentials) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON not set");

  const parsed = JSON.parse(credentials);
  return new google.auth.GoogleAuth({
    credentials: parsed,
    scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
  });
}

const siteUrl = process.env.GSC_SITE_URL ?? "https://megallm.io";

export interface GSCRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export async function getSearchPerformance(options: {
  startDate: string;
  endDate: string;
  dimensions?: string[];
  rowLimit?: number;
}): Promise<GSCRow[]> {
  const auth = getAuth();
  const searchconsole = google.searchconsole({ version: "v1", auth });

  const res = await searchconsole.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate: options.startDate,
      endDate: options.endDate,
      dimensions: options.dimensions ?? ["query", "page"],
      rowLimit: options.rowLimit ?? 1000,
    },
  });

  return (res.data.rows ?? []).map((row) => ({
    keys: row.keys ?? [],
    clicks: row.clicks ?? 0,
    impressions: row.impressions ?? 0,
    ctr: row.ctr ?? 0,
    position: row.position ?? 0,
  }));
}

export async function getTopQueries(days = 7): Promise<GSCRow[]> {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);

  return getSearchPerformance({
    startDate: start.toISOString().split("T")[0],
    endDate: end.toISOString().split("T")[0],
    dimensions: ["query"],
    rowLimit: 1000,
  });
}

export async function getPagePerformance(days = 7): Promise<GSCRow[]> {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);

  return getSearchPerformance({
    startDate: start.toISOString().split("T")[0],
    endDate: end.toISOString().split("T")[0],
    dimensions: ["page"],
    rowLimit: 500,
  });
}

export async function getRisingQueries(days = 28): Promise<
  { query: string; impressions: number; ctr: number; position: number }[]
> {
  const rows = await getTopQueries(days);
  return rows
    .filter((r) => r.impressions > 50 && r.ctr < 0.03)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 50)
    .map((r) => ({
      query: r.keys[0],
      impressions: r.impressions,
      ctr: r.ctr,
      position: r.position,
    }));
}

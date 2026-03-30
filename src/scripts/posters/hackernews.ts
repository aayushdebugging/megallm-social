import { chromium, type BrowserContext } from "playwright";
import type { PostQueueItem } from "@/lib/pipeline/types";
import { loadSession, saveSession } from "../auth/session-manager";
import path from "path";

const COOKIES_PATH = path.join(process.cwd(), "src/scripts/auth/cookies/hackernews.json");

async function getContext(): Promise<BrowserContext> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });

  const cookies = await loadSession(COOKIES_PATH);
  if (cookies) {
    await context.addCookies(cookies);
  }

  return context;
}

export async function postToHackerNews(
  item: PostQueueItem
): Promise<{ url: string; id: string }> {
  const context = await getContext();
  const page = await context.newPage();

  try {
    await page.goto("https://news.ycombinator.com/submit", {
      waitUntil: "networkidle",
    });

    // Check if logged in
    const isLoggedIn = await page
      .locator('input[name="title"]')
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (!isLoggedIn) {
      throw new Error(
        "Not logged in to HN. Run `npm run post:login hackernews` first."
      );
    }

    // Fill title
    await page.locator('input[name="title"]').fill(
      item.title ?? item.content.slice(0, 80)
    );

    // Fill URL if we have a blog post URL, otherwise use text
    if (item.postedUrl) {
      await page.locator('input[name="url"]').fill(item.postedUrl);
    } else {
      await page.locator('textarea[name="text"]').fill(item.content);
    }

    // Submit
    await page.locator('input[type="submit"]').click();
    await page.waitForTimeout(3000);

    const cookies = await context.cookies();
    await saveSession(COOKIES_PATH, cookies);

    const postUrl = page.url();
    const idMatch = postUrl.match(/id=(\d+)/);

    return {
      url: postUrl,
      id: idMatch?.[1] ?? `hn-${Date.now()}`,
    };
  } finally {
    await context.close();
  }
}

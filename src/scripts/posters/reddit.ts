import { chromium, type BrowserContext } from "playwright";
import type { PostQueueItem } from "@/lib/pipeline/types";
import { loadSession, saveSession } from "../auth/session-manager";
import path from "path";

const COOKIES_PATH = path.join(process.cwd(), "src/scripts/auth/cookies/reddit.json");

async function getContext(): Promise<BrowserContext> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });

  const cookies = await loadSession(COOKIES_PATH);
  if (cookies) {
    await context.addCookies(cookies);
  }

  return context;
}

export async function postToReddit(
  item: PostQueueItem
): Promise<{ url: string; id: string }> {
  const context = await getContext();
  const page = await context.newPage();

  const subreddit = item.subreddit ?? "MachineLearning";

  try {
    // Navigate to subreddit submit page (old reddit is more automatable)
    await page.goto(
      `https://old.reddit.com/r/${subreddit}/submit?selftext=true`,
      { waitUntil: "networkidle" }
    );

    // Check if logged in
    const isLoggedIn = await page
      .locator('input[name="title"]')
      .isVisible({ timeout: 10000 })
      .catch(() => false);

    if (!isLoggedIn) {
      throw new Error(
        "Not logged in to Reddit. Run `npm run post:login reddit` first."
      );
    }

    // Fill title
    await page.locator('input[name="title"]').fill(item.title ?? item.content.slice(0, 100));

    // Fill body (self text tab)
    const selfTextTab = page.locator('a.text-button:has-text("text")');
    if (await selfTextTab.isVisible()) {
      await selfTextTab.click();
      await page.waitForTimeout(500);
    }

    await page.locator('textarea[name="text"]').fill(item.content);

    // Submit
    await page.locator('button[name="submit"]:has-text("submit")').click();
    await page.waitForTimeout(3000);

    const cookies = await context.cookies();
    await saveSession(COOKIES_PATH, cookies);

    const postUrl = page.url();
    const idMatch = postUrl.match(/comments\/(\w+)/);

    return {
      url: postUrl,
      id: idMatch?.[1] ?? `reddit-${Date.now()}`,
    };
  } finally {
    await context.close();
  }
}

import { chromium, type BrowserContext } from "playwright";
import type { PostQueueItem } from "@/lib/pipeline/types";
import { loadSession, saveSession } from "../auth/session-manager";
import path from "path";

const COOKIES_PATH = path.join(process.cwd(), "src/scripts/auth/cookies/x-twitter.json");

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

export async function postToTwitter(
  item: PostQueueItem
): Promise<{ url: string; id: string }> {
  const context = await getContext();
  const page = await context.newPage();

  try {
    await page.goto("https://x.com/compose/post", {
      waitUntil: "networkidle",
    });

    // Check if logged in
    const isLoggedIn = await page
      .locator('[data-testid="tweetTextarea_0"]')
      .isVisible({ timeout: 10000 })
      .catch(() => false);

    if (!isLoggedIn) {
      throw new Error(
        "Not logged in to X. Run `npm run post:login x-twitter` first to save cookies."
      );
    }

    // Type the tweet
    const textarea = page.locator('[data-testid="tweetTextarea_0"]');
    await textarea.click();
    await textarea.fill(item.content);

    // Click the post button
    const postButton = page.locator('[data-testid="tweetButton"]');
    await postButton.click();

    // Wait for post to go through
    await page.waitForTimeout(3000);

    // Save updated cookies
    const cookies = await context.cookies();
    await saveSession(COOKIES_PATH, cookies);

    // Try to extract tweet URL from redirect or notification
    const currentUrl = page.url();
    const tweetIdMatch = currentUrl.match(/status\/(\d+)/);

    return {
      url: tweetIdMatch
        ? `https://x.com/i/status/${tweetIdMatch[1]}`
        : "https://x.com",
      id: tweetIdMatch?.[1] ?? `tw-${Date.now()}`,
    };
  } finally {
    await context.close();
  }
}

import { chromium, type BrowserContext } from "playwright";
import type { PostQueueItem } from "@/lib/pipeline/types";
import { loadSession, saveSession } from "../auth/session-manager";
import path from "path";

const COOKIES_PATH = path.join(process.cwd(), "src/scripts/auth/cookies/linkedin.json");

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

export async function postToLinkedIn(
  item: PostQueueItem
): Promise<{ url: string; id: string }> {
  const context = await getContext();
  const page = await context.newPage();

  try {
    await page.goto("https://www.linkedin.com/feed/", {
      waitUntil: "networkidle",
    });

    // Check if logged in
    const isLoggedIn = await page
      .locator(".share-box-feed-entry__trigger")
      .isVisible({ timeout: 10000 })
      .catch(() => false);

    if (!isLoggedIn) {
      throw new Error(
        "Not logged in to LinkedIn. Run `npm run post:login linkedin` first."
      );
    }

    // Click "Start a post"
    await page.locator(".share-box-feed-entry__trigger").click();
    await page.waitForTimeout(1500);

    // Type in the post editor
    const editor = page.locator(".ql-editor[data-placeholder]");
    await editor.click();
    await editor.fill(item.content);
    await page.waitForTimeout(500);

    // Click Post button
    const postButton = page.locator(
      'button.share-actions__primary-action:has-text("Post")'
    );
    await postButton.click();
    await page.waitForTimeout(3000);

    // Save cookies
    const cookies = await context.cookies();
    await saveSession(COOKIES_PATH, cookies);

    return {
      url: "https://www.linkedin.com/feed/",
      id: `li-${Date.now()}`,
    };
  } finally {
    await context.close();
  }
}

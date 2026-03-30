import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";

const COOKIES_DIR = path.join(process.cwd(), "src/scripts/auth/cookies");

export interface Cookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Strict" | "Lax" | "None";
}

export async function loadSession(
  cookiesPath: string
): Promise<Cookie[] | null> {
  try {
    const data = await readFile(cookiesPath, "utf-8");
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export async function saveSession(
  cookiesPath: string,
  cookies: Cookie[]
): Promise<void> {
  await mkdir(path.dirname(cookiesPath), { recursive: true });
  await writeFile(cookiesPath, JSON.stringify(cookies, null, 2), "utf-8");
}

/**
 * Interactive login helper.
 * Launches a visible browser for the user to log in manually.
 * Saves cookies after login is complete.
 */
export async function interactiveLogin(
  platform: string,
  loginUrl: string
): Promise<void> {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: false }); // Visible browser
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });

  const page = await context.newPage();
  await page.goto(loginUrl, { waitUntil: "networkidle" });

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Log in to ${platform} in the browser window.`);
  console.log(`Press Enter here when you're done logging in.`);
  console.log(`${"=".repeat(60)}\n`);

  // Wait for user input
  await new Promise<void>((resolve) => {
    process.stdin.once("data", () => resolve());
  });

  const cookies = await context.cookies();
  const cookiesPath = path.join(COOKIES_DIR, `${platform}.json`);
  await saveSession(cookiesPath, cookies as Cookie[]);

  console.log(`Cookies saved to ${cookiesPath}`);
  await browser.close();
}

// CLI: tsx src/scripts/auth/session-manager.ts <platform>
// Only run CLI when this file is the direct entry point
const isDirectRun =
  process.argv[1]?.includes("session-manager") ?? false;

if (isDirectRun) {
  const blogPlatformUrls: Record<string, string> = {
    // Already have posters
    devto: "https://dev.to/enter",
    hashnode: "https://hashnode.com/onboard",
    medium: "https://medium.com/m/signin",
    telegraph: "https://telegra.ph/",
    // Easy signup
    wordpress: "https://wordpress.com/log-in",
    substack: "https://substack.com/sign-in",
    ghost: "https://ghost.org/signin/",
    blogger: "https://www.blogger.com",
    hubpages: "https://discover.hubpages.com/user/new",
    vocal: "https://vocal.media/signup",
    beehiiv: "https://www.beehiiv.com/login",
    tealfeed: "https://tealfeed.com/login",
    // May have friction
    tumblr: "https://www.tumblr.com/register",
    quora: "https://www.quora.com",
    bearblog: "https://bearblog.dev/accounts/register/",
    writeas: "https://write.as/login",
    buttondown: "https://buttondown.com/login",
    gist: "https://gist.github.com",
    // Developer/tech
    hackernoon: "https://hackernoon.com/signup",
    dzone: "https://dzone.com/users/registration",
    codeproject: "https://www.codeproject.com/script/Membership/LogOn.aspx",
    indiehackers: "https://www.indiehackers.com/sign-in",
  };

  const socialPlatformUrls: Record<string, string> = {
    "x-twitter": "https://x.com/login",
    linkedin: "https://www.linkedin.com/login",
    reddit: "https://old.reddit.com/login",
    hackernews: "https://news.ycombinator.com/login",
  };

  const platformUrls: Record<string, string> = {
    ...blogPlatformUrls,
    ...socialPlatformUrls,
  };

  const cliPlatform = process.argv[2];

  const groups: Record<string, Record<string, string>> = {
    blogs: blogPlatformUrls,
    social: socialPlatformUrls,
    all: platformUrls,
  };

  if (cliPlatform && groups[cliPlatform]) {
    const targets = groups[cliPlatform];
    for (const [name, url] of Object.entries(targets)) {
      const cookiesPath = path.join(COOKIES_DIR, `${name}.json`);
      const existing = await loadSession(cookiesPath);
      if (existing) {
        console.log(`⏭  ${name} — already has cookies, skipping`);
        continue;
      }
      console.log(`\n🔜 Next up: ${name}`);
      await interactiveLogin(name, url);
    }
    console.log("\n✅ All done!");
  } else if (cliPlatform && platformUrls[cliPlatform]) {
    interactiveLogin(cliPlatform, platformUrls[cliPlatform]);
  } else if (cliPlatform) {
    console.error(`Unknown platform: ${cliPlatform}`);
    console.error(`Available: blogs, social, all, ${Object.keys(platformUrls).join(", ")}`);
    process.exit(1);
  } else {
    console.error("Usage: tsx src/scripts/auth/session-manager.ts <platform|blogs|social|all>");
    console.error(`Platforms: blogs, social, all, ${Object.keys(platformUrls).join(", ")}`);
  }
}

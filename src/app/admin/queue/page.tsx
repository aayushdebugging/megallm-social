import { getList } from "@/lib/pipeline/state";
import type { PostQueueItem } from "@/lib/pipeline/types";

export const dynamic = "force-dynamic";

export default async function PostQueuePage() {
  const postQueue = await getList<PostQueueItem>("post_queue");

  const pending = postQueue.filter((i) => i.status === "pending");
  const posted = postQueue.filter((i) => i.status === "posted");
  const failed = postQueue.filter((i) => i.status === "failed");

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Post Queue</h1>
        <div className="flex gap-3 text-sm">
          <span className="text-yellow-400">{pending.length} pending</span>
          <span className="text-green-400">{posted.length} posted</span>
          <span className="text-red-400">{failed.length} failed</span>
        </div>
      </div>

      {/* Pending Posts — with copy buttons */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Pending Posts</h2>
        {pending.length === 0 ? (
          <p className="text-[var(--muted)]">
            No pending posts. Run: npm run generate
          </p>
        ) : (
          <div className="space-y-4">
            {pending.map((item) => (
              <PostCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>

      {/* Recently Posted */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Recently Posted</h2>
        {posted.length === 0 ? (
          <p className="text-[var(--muted)]">Nothing posted yet.</p>
        ) : (
          <div className="space-y-2">
            {posted.slice(-10).reverse().map((item) => (
              <div
                key={item.id}
                className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 flex items-center justify-between"
              >
                <div>
                  <span className="text-xs font-mono text-green-400 mr-2">
                    {item.platform}
                  </span>
                  <span className="text-sm">
                    {item.title ?? item.content.slice(0, 80)}...
                  </span>
                </div>
                {item.postedUrl && (
                  <a
                    href={item.postedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[var(--accent)] hover:underline"
                  >
                    View
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Failed */}
      {failed.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3 text-red-400">
            Failed Posts
          </h2>
          <div className="space-y-2">
            {failed.map((item) => (
              <div
                key={item.id}
                className="bg-red-950/20 border border-red-900/30 rounded-lg p-3"
              >
                <span className="text-xs font-mono text-red-400 mr-2">
                  {item.platform}
                </span>
                <span className="text-sm">
                  {item.title ?? item.content.slice(0, 80)}
                </span>
                {item.error && (
                  <p className="text-xs text-red-400 mt-1">{item.error}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function PostCard({ item }: { item: PostQueueItem }) {
  const platformColors: Record<string, string> = {
    "x-twitter": "text-blue-400",
    linkedin: "text-blue-300",
    reddit: "text-orange-400",
    devto: "text-white",
    hackernews: "text-orange-300",
    blog: "text-green-400",
  };

  const platformLinks: Record<string, string> = {
    "x-twitter": "https://x.com/compose/post",
    linkedin: "https://www.linkedin.com/feed/",
    reddit: item.subreddit
      ? `https://old.reddit.com/r/${item.subreddit}/submit?selftext=true`
      : "https://old.reddit.com/submit",
    devto: "https://dev.to/new",
    hackernews: "https://news.ycombinator.com/submit",
  };

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span
          className={`text-sm font-mono font-bold ${
            platformColors[item.platform] ?? "text-[var(--foreground)]"
          }`}
        >
          {item.platform}
          {item.subreddit && ` → ${item.subreddit}`}
        </span>
        <div className="flex gap-2">
          {platformLinks[item.platform] && (
            <a
              href={platformLinks[item.platform]}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs bg-[var(--accent)] text-white px-3 py-1 rounded hover:opacity-80"
            >
              Open Platform
            </a>
          )}
        </div>
      </div>
      {item.title && (
        <p className="font-semibold mb-1">{item.title}</p>
      )}
      <pre className="text-sm text-[var(--muted)] whitespace-pre-wrap bg-black/30 rounded p-3 mt-2 max-h-60 overflow-y-auto">
        {item.content}
      </pre>
    </div>
  );
}

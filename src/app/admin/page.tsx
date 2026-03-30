import { getState, getList, getStrategyState } from "@/lib/pipeline/state";
import type { PipelineRun, ContentQueueItem, PostQueueItem } from "@/lib/pipeline/types";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const strategy = await getStrategyState();
  const contentQueue = await getList<ContentQueueItem>("content_queue");
  const postQueue = await getList<PostQueueItem>("post_queue");
  const pipelineRuns = await getList<PipelineRun>("pipeline_runs");

  const recentRuns = pipelineRuns.slice(-10).reverse();
  const pendingContent = contentQueue.filter((i) => i.status === "pending");
  const pendingPosts = postQueue.filter((i) => i.status === "pending");
  const postedItems = postQueue.filter((i) => i.status === "posted");

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Pipeline Dashboard</h1>

      {/* Status Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card title="Content Queue" value={pendingContent.length} label="pending" />
        <Card title="Post Queue" value={pendingPosts.length} label="pending" />
        <Card title="Posted" value={postedItems.length} label="total" />
        <Card
          title="Strategy Updated"
          value={strategy.updatedAt ? timeAgo(strategy.updatedAt) : "never"}
          label=""
        />
      </div>

      {/* Strategy State */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Current Strategy</h2>
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4 text-sm font-mono">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[var(--muted)] mb-1">Content Weights</p>
              <p>Blog: {strategy.contentTypeWeights.blog}</p>
              <p>Social: {strategy.contentTypeWeights.social}</p>
              <p>Comparison: {strategy.contentTypeWeights.comparison}</p>
            </div>
            <div>
              <p className="text-[var(--muted)] mb-1">Hot Topics</p>
              {strategy.hotTopics.slice(0, 5).map((t) => (
                <p key={t}>{t}</p>
              ))}
            </div>
            <div>
              <p className="text-[var(--muted)] mb-1">Platform Weights</p>
              {Object.entries(strategy.platformWeights)
                .sort(([, a], [, b]) => b - a)
                .map(([p, w]) => (
                  <p key={p}>
                    {p}: {w}
                  </p>
                ))}
            </div>
            <div>
              <p className="text-[var(--muted)] mb-1">Exploration Budget</p>
              <p>{(strategy.explorationBudget * 100).toFixed(0)}%</p>
              <p className="text-[var(--muted)] mt-2 mb-1">Changelog</p>
              <p className="text-xs">{strategy.changelog}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Recent Pipeline Runs */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Recent Pipeline Runs</h2>
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th scope="col" className="text-left p-3 text-[var(--muted)]">Stage</th>
                <th scope="col" className="text-left p-3 text-[var(--muted)]">Status</th>
                <th scope="col" className="text-left p-3 text-[var(--muted)]">Summary</th>
                <th scope="col" className="text-left p-3 text-[var(--muted)]">Time</th>
              </tr>
            </thead>
            <tbody>
              {recentRuns.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-3 text-[var(--muted)]">
                    No pipeline runs yet. Run: npm run analyze
                  </td>
                </tr>
              ) : (
                recentRuns.map((run, i) => (
                  <tr key={i} className="border-b border-[var(--border)] last:border-0">
                    <td className="p-3 font-mono">{run.stage}</td>
                    <td className="p-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs ${
                          run.status === "completed"
                            ? "bg-green-900/30 text-green-400"
                            : run.status === "failed"
                            ? "bg-red-900/30 text-red-400"
                            : "bg-yellow-900/30 text-yellow-400"
                        }`}
                      >
                        {run.status}
                      </span>
                    </td>
                    <td className="p-3 text-[var(--muted)]">{run.summary}</td>
                    <td className="p-3 text-[var(--muted)] text-xs">
                      {run.startedAt ? timeAgo(run.startedAt) : ""}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Content Queue */}
      <section>
        <h2 className="text-lg font-semibold mb-3">
          Content Queue ({contentQueue.length})
        </h2>
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th scope="col" className="text-left p-3 text-[var(--muted)]">Topic</th>
                <th scope="col" className="text-left p-3 text-[var(--muted)]">Type</th>
                <th scope="col" className="text-left p-3 text-[var(--muted)]">Priority</th>
                <th scope="col" className="text-left p-3 text-[var(--muted)]">Status</th>
                <th scope="col" className="text-left p-3 text-[var(--muted)]">Platforms</th>
              </tr>
            </thead>
            <tbody>
              {contentQueue.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-3 text-[var(--muted)]">
                    Queue empty. Run: npm run analyze
                  </td>
                </tr>
              ) : (
                contentQueue.slice(0, 20).map((item) => (
                  <tr key={item.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="p-3">{item.topic}</td>
                    <td className="p-3 font-mono text-xs">{item.type}</td>
                    <td className="p-3">
                      <span
                        className={`text-xs font-mono ${
                          item.priority === "P0"
                            ? "text-red-400"
                            : item.priority === "P1"
                            ? "text-yellow-400"
                            : "text-[var(--muted)]"
                        }`}
                      >
                        {item.priority}
                      </span>
                    </td>
                    <td className="p-3 text-xs">{item.status}</td>
                    <td className="p-3 text-xs text-[var(--muted)]">
                      {item.platformTargets.join(", ")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Card({
  title,
  value,
  label,
}: {
  title: string;
  value: number | string;
  label: string;
}) {
  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
      <p className="text-[var(--muted)] text-sm">{title}</p>
      <p className="text-2xl font-bold mt-1">
        {value}
        {label && <span className="text-sm font-normal text-[var(--muted)] ml-1">{label}</span>}
      </p>
    </div>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

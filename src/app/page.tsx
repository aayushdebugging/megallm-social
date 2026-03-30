"use client";

import { useEffect, useMemo, useState } from "react";

type Stat = {
  label: string;
  value: number;
  suffix?: string;
  helper: string;
};

const STATS: Stat[] = [
  { label: "Tokens Routed", value: 12, suffix: "B+", helper: "tokens monthly" },
  { label: "Models", value: 200, suffix: "+", helper: "available" },
  { label: "Providers", value: 100, suffix: "+", helper: "inference providers" },
  { label: "Gateway Uptime", value: 99.99, suffix: "%", helper: "SLA-ready" },
  { label: "Cost Savings", value: 40, suffix: "%", helper: "at scale" },
  { label: "Latency Overhead", value: 20, suffix: "ms", helper: "sub-threshold" },
];

const FAQS = [
  {
    q: "How does MegaLLM pricing work?",
    a: "You pay provider token cost plus a transparent platform fee. Intelligent routing continuously picks lower-cost routes for your selected model, which is why teams commonly see 20-40% savings at volume.",
  },
  {
    q: "How fast can we migrate from OpenAI or Claude?",
    a: "Usually in minutes. Replace only the base URL with MegaLLM, keep your existing OpenAI-compatible SDK code, and start routing traffic without a full rewrite.",
  },
  {
    q: "How do you keep reliability high?",
    a: "Bifrost monitors provider health in real time and automatically reroutes when latency or error rates rise. Circuit breakers and fallback routing reduce dropped requests and provider lock-in.",
  },
  {
    q: "What do enterprise teams get?",
    a: "Enterprise includes volume pricing, custom SLAs, dedicated support channels, SSO/RBAC readiness, and architecture guidance based on your monthly token volume and workload profile.",
  },
];

function useAnimatedStats(stats: Stat[]) {
  const [values, setValues] = useState<number[]>(stats.map(() => 0));

  useEffect(() => {
    let frame = 0;
    const totalFrames = 50;
    const timer = setInterval(() => {
      frame += 1;
      setValues(
        stats.map((s) => {
          const next = (s.value * frame) / totalFrames;
          return Number.isInteger(s.value) ? Math.round(next) : Number(next.toFixed(2));
        }),
      );
      if (frame >= totalFrames) clearInterval(timer);
    }, 18);

    return () => clearInterval(timer);
  }, [stats]);

  return values;
}

export default function Home() {
  const [showModal, setShowModal] = useState(false);
  const [showAnnouncement, setShowAnnouncement] = useState(true);
  const animatedValues = useAnimatedStats(STATS);

  useEffect(() => {
    const modalDismissedUntil = localStorage.getItem("megallm_modal_dismissed_until");
    const announcementDismissed = localStorage.getItem("megallm_announcement_dismissed");

    if (announcementDismissed === "1") setShowAnnouncement(false);

    if (modalDismissedUntil && Date.now() < Number(modalDismissedUntil)) {
      return;
    }

    const t = window.setTimeout(() => setShowModal(true), 3500);
    return () => window.clearTimeout(t);
  }, []);

  const compatibility = useMemo(
    () => [
      "OpenAI SDK",
      "Anthropic SDK",
      "LangChain",
      "LlamaIndex",
      "Vercel AI SDK",
      "OpenAI-compatible clients",
    ],
    [],
  );

  function dismissModal() {
    const sevenDaysFromNow = Date.now() + 7 * 24 * 60 * 60 * 1000;
    localStorage.setItem("megallm_modal_dismissed_until", String(sevenDaysFromNow));
    setShowModal(false);
  }

  function dismissAnnouncement() {
    localStorage.setItem("megallm_announcement_dismissed", "1");
    setShowAnnouncement(false);
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[var(--background)] text-[var(--foreground)]">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-20 top-20 h-80 w-80 rounded-full bg-cyan-500/15 blur-3xl" />
        <div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-blue-500/15 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-emerald-400/10 blur-3xl" />
      </div>

      {showAnnouncement && (
        <div className="sticky top-0 z-40 border-b border-emerald-500/40 bg-emerald-900/20 backdrop-blur">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-2 text-sm">
            <p className="text-emerald-200">
              NEW: We ship a new feature every week. This week - Intelligent Model Router with cost-aware routing.
              <a href="/changelog" className="ml-2 font-semibold text-emerald-100 underline underline-offset-4">See changelog</a>
            </p>
            <button
              type="button"
              onClick={dismissAnnouncement}
              className="rounded border border-emerald-300/30 px-2 py-0.5 text-emerald-100 hover:bg-emerald-300/10"
              aria-label="Dismiss announcement"
            >
              X
            </button>
          </div>
        </div>
      )}

      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-6">
        <div className="text-xl font-extrabold tracking-tight">MegaLLM</div>
        <nav className="hidden items-center gap-6 text-sm text-[var(--muted)] md:flex">
          <a href="/models" className="hover:text-white">Models</a>
          <a href="/pricing" className="hover:text-white">Pricing</a>
          <a href="/enterprise" className="hover:text-white">Enterprise</a>
          <a href="/docs" className="hover:text-white">Docs</a>
          <a href="/playground" className="hover:text-white">Playground</a>
          <a href="/changelog" className="hover:text-white">Changelog</a>
        </nav>
        <a
          href="/get-api-key"
          className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Get API Key
        </a>
      </header>

      <main className="mx-auto w-full max-w-7xl space-y-20 px-4 pb-20">
        <section className="grid gap-10 py-10 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div>
            <p className="mb-3 inline-flex items-center rounded-full border border-blue-400/30 bg-blue-500/10 px-3 py-1 text-xs text-blue-200">
              Introducing Bifrost Router
            </p>
            <h1 className="text-4xl font-black leading-tight sm:text-5xl md:text-6xl">
              One API. 100+ Providers.
              <span className="block text-cyan-300">Every Model That Matters.</span>
            </h1>
            <p className="mt-5 max-w-2xl text-lg text-[var(--muted)]">
              Route AI traffic across 100+ inference providers through one OpenAI-compatible endpoint.
              Smart routing drives 20-40% cost reduction at volume, with sub-20ms gateway latency and automatic failover.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href="/get-api-key" className="rounded-md bg-[var(--accent)] px-5 py-3 font-semibold text-white hover:opacity-90">
                Get Free API Key
              </a>
              <a href="/playground" className="rounded-md border border-[var(--border)] px-5 py-3 font-semibold hover:bg-white/5">
                Try in Playground
              </a>
            </div>
            <div className="mt-6 flex flex-wrap gap-2 text-xs text-[var(--muted)]">
              {compatibility.map((item) => (
                <span key={item} className="rounded-full border border-[var(--border)] px-3 py-1">
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-2xl shadow-black/30">
            <p className="mb-3 text-xs uppercase tracking-wider text-[var(--muted)]">OpenAI-compatible quick start</p>
            <pre className="overflow-x-auto rounded-xl bg-black/40 p-4 text-xs text-cyan-100">
{`from openai import OpenAI
client = OpenAI(
  base_url="https://ai.megallm.io/v1",
  api_key="your-api-key"
)

response = client.chat.completions.create(
  model="claude-sonnet-4",
  messages=[{"role": "user", "content": "Hello!"}]
)`}
            </pre>
          </div>
        </section>

        <section className="-mx-1 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {STATS.map((s, i) => (
            <article key={s.label} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
              <p className="text-3xl font-extrabold text-white">
                {animatedValues[i]}
                {s.suffix}
              </p>
              <p className="mt-1 text-sm font-semibold">{s.label}</p>
              <p className="text-xs text-[var(--muted)]">{s.helper}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6">
            <p className="text-xs uppercase tracking-wider text-[var(--muted)]">Intelligent routing</p>
            <h2 className="mt-2 text-3xl font-black">Meet Bifrost - The Smartest Model Router in Production</h2>
            <p className="mt-3 text-[var(--muted)]">
              Every request passes through intent classification, real-time provider health checks, and route selection.
              Bifrost picks the fastest, cheapest, and most reliable provider in real time.
            </p>
            <ul className="mt-5 space-y-3 text-sm">
              <li className="rounded-lg border border-[var(--border)] p-3">Cost-aware routing: 20-40% savings at volume.</li>
              <li className="rounded-lg border border-[var(--border)] p-3">Latency optimized: sub-20ms gateway overhead.</li>
              <li className="rounded-lg border border-[var(--border)] p-3">Automatic failover: reroute in under 50ms.</li>
              <li className="rounded-lg border border-[var(--border)] p-3">Load balancing: lower 429s across providers.</li>
            </ul>
            <a href="/docs/router" className="mt-5 inline-block text-sm font-semibold text-cyan-300 underline underline-offset-4">
              Learn how Bifrost works
            </a>
          </div>

          <div className="rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-950/30 to-cyan-950/20 p-6">
            <p className="text-xs uppercase tracking-wider text-cyan-200">Save money, ship faster</p>
            <h3 className="mt-2 text-3xl font-black">Cut AI Spend 20-40% Without Rewriting Your Stack</h3>
            <p className="mt-3 text-cyan-100/85">
              Same model. Same output target. Better routing economics. MegaLLM continuously compares provider pricing and performance.
            </p>
            <div className="mt-5 overflow-hidden rounded-lg border border-cyan-300/20">
              <table className="w-full text-left text-sm">
                <thead className="bg-cyan-900/30 text-cyan-100">
                  <tr>
                    <th scope="col" className="p-3">Model</th>
                    <th scope="col" className="p-3">Direct</th>
                    <th scope="col" className="p-3">Via MegaLLM</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-cyan-400/10">
                    <td className="p-3">Claude Sonnet</td>
                    <td className="p-3">$3 / $15</td>
                    <td className="p-3 text-emerald-300">From $2.4 / $12</td>
                  </tr>
                  <tr className="border-t border-cyan-400/10">
                    <td className="p-3">GPT-4.1</td>
                    <td className="p-3">$2 / $8</td>
                    <td className="p-3 text-emerald-300">From $1.6 / $6.4</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <a href="/pricing" className="mt-5 inline-block rounded-md bg-cyan-400 px-4 py-2 text-sm font-semibold text-black hover:bg-cyan-300">
              See Full Pricing
            </a>
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6">
          <p className="text-xs uppercase tracking-wider text-[var(--muted)]">Enterprise</p>
          <h2 className="mt-2 text-3xl font-black">Built for Teams Running AI at Scale</h2>
          <p className="mt-3 max-w-3xl text-[var(--muted)]">
            Dedicated infrastructure, custom SLAs, volume pricing, and architecture support for high-throughput workloads.
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <ul className="space-y-2 text-sm text-[var(--muted)]">
              <li>Dedicated or shared inference routing</li>
              <li>Custom rate limits and priority queuing</li>
              <li>SSO, RBAC, audit logs, and governance controls</li>
              <li>Dedicated support channel and account manager</li>
            </ul>
            <form className="space-y-3 rounded-xl border border-[var(--border)] bg-black/20 p-4" onSubmit={(e) => e.preventDefault()}>
              <label className="block text-xs text-[var(--muted)]">
                Work email
                <input className="mt-1 w-full rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm" type="email" placeholder="you@company.com" />
              </label>
              <label className="block text-xs text-[var(--muted)]">
                Company name
                <input className="mt-1 w-full rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm" type="text" placeholder="Acme AI" />
              </label>
              <label className="block text-xs text-[var(--muted)]">
                Monthly token volume
                <select className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm">
                  <option>{"<10M"}</option>
                  <option>10M-100M</option>
                  <option>100M-1B</option>
                  <option>1B+</option>
                </select>
              </label>
              <button className="w-full rounded-md bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-gray-200" type="submit">
                Request Enterprise Demo
              </button>
              <p className="text-[11px] text-[var(--muted)]">We will reach out within 24 hours.</p>
            </form>
          </div>
        </section>

        <section>
          <p className="text-xs uppercase tracking-wider text-[var(--muted)]">How it works</p>
          <h2 className="mt-2 text-3xl font-black">From Sign-up to Production in Minutes</h2>
          <div className="mt-6 grid gap-3 md:grid-cols-4">
            {[
              ["Step 1", "Get API Key", "Sign up free and generate your key in seconds."],
              ["Step 2", "Point Your Code", "Change base URL to ai.megallm.io/v1."],
              ["Step 3", "Choose Models", "Pick from 200+ models or auto-route with Bifrost."],
              ["Step 4", "Ship and Monitor", "Track cost, latency, and reliability in one dashboard."],
            ].map(([step, title, body]) => (
              <article key={step} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
                <p className="text-xs text-cyan-300">{step}</p>
                <h3 className="mt-1 text-lg font-bold">{title}</h3>
                <p className="mt-2 text-sm text-[var(--muted)]">{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-3xl font-black">Find Your Path</h2>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <a href="/get-api-key" className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 transition hover:-translate-y-0.5 hover:border-blue-400/40">
              <h3 className="text-lg font-bold">I am a Developer</h3>
              <p className="mt-2 text-sm text-[var(--muted)]">Generate a key, read docs, and start building immediately.</p>
              <p className="mt-4 text-sm font-semibold text-cyan-300">Get Started Free</p>
            </a>
            <a href="/enterprise" className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 transition hover:-translate-y-0.5 hover:border-blue-400/40">
              <h3 className="text-lg font-bold">I am Evaluating for My Team</h3>
              <p className="mt-2 text-sm text-[var(--muted)]">Compare volume pricing, SLAs, and architecture options.</p>
              <p className="mt-4 text-sm font-semibold text-cyan-300">Talk to Sales</p>
            </a>
            <a href="/playground" className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 transition hover:-translate-y-0.5 hover:border-blue-400/40">
              <h3 className="text-lg font-bold">I am Exploring</h3>
              <p className="mt-2 text-sm text-[var(--muted)]">Test models in chat playground and compare output quality.</p>
              <p className="mt-4 text-sm font-semibold text-cyan-300">Open Playground</p>
            </a>
          </div>
        </section>

        <section>
          <h2 className="text-3xl font-black">Frequently Asked Questions</h2>
          <div className="mt-6 space-y-3">
            {FAQS.map((faq) => (
              <details key={faq.q} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
                <summary className="cursor-pointer text-base font-semibold">{faq.q}</summary>
                <p className="mt-2 text-sm text-[var(--muted)]">{faq.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-blue-500/20 bg-gradient-to-r from-blue-950/30 to-cyan-950/20 p-8 text-center">
          <h2 className="text-3xl font-black">Start Building with 200+ AI Models Today</h2>
          <p className="mt-2 text-[var(--muted)]">Join developers reducing cost and improving reliability with smart routing.</p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <a href="/get-api-key" className="rounded-md bg-[var(--accent)] px-5 py-3 font-semibold text-white">Get Free API Key</a>
            <a href="/enterprise" className="rounded-md border border-[var(--border)] px-5 py-3 font-semibold">Book Enterprise Demo</a>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--border)] px-4 py-8 text-sm text-[var(--muted)]">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p>MegaLLM - Intelligence. Innovation. Impact.</p>
          <div className="flex flex-wrap gap-4">
            <a href="/pricing" className="hover:text-white">Pricing</a>
            <a href="/models" className="hover:text-white">Models</a>
            <a href="/docs" className="hover:text-white">Documentation</a>
            <a href="/changelog" className="hover:text-white">Changelog</a>
            <a href="/status" className="hover:text-white">Status</a>
          </div>
        </div>
      </footer>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur">
          <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Try now</p>
                <h3 className="mt-1 text-2xl font-black">Try MegaLLM in 30 Seconds</h3>
                <p className="mt-2 text-sm text-[var(--muted)]">No credit card. No setup. Just pick a model and go.</p>
              </div>
              <button
                type="button"
                onClick={dismissModal}
                className="rounded border border-[var(--border)] px-2 py-0.5 text-xs text-[var(--muted)] hover:bg-white/5"
                aria-label="Close"
              >
                X
              </button>
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <a href="/get-api-key" className="rounded-md bg-[var(--accent)] px-4 py-2 text-center text-sm font-semibold text-white">
                Get Free API Key
              </a>
              <a href="/playground" className="rounded-md border border-[var(--border)] px-4 py-2 text-center text-sm font-semibold">
                Test in Playground
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

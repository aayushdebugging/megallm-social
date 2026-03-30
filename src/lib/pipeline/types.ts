// ─────────────────────────────────────────────────────────────
// Pipeline types — shared across all 5 stages
// ANALYZE → GENERATE → POST → FEEDBACK → IMPROVE
// ─────────────────────────────────────────────────────────────

/** Supported distribution platforms */
export type Platform =
  | "blog"
  | "x-twitter"
  | "linkedin"
  | "reddit"
  | "devto"
  | "hackernews"
  | "hashnode"
  | "medium"
  | "telegraph";

/** Priority levels for content queue items */
export type Priority = "P0" | "P1" | "P2";

/** Content item in the generation queue */
export interface ContentQueueItem {
  id: string;
  type: "blog" | "social" | "comparison";
  topic: string;
  targetKeywords: string[];
  priority: Priority;
  platformTargets: Platform[];
  reasoning: string;
  createdAt: string;
  status: "pending" | "generating" | "generated" | "posted" | "failed";
}

/** Post queue item — ready to publish to a specific platform */
export interface PostQueueItem {
  id: string;
  contentId: string;
  platform: Platform;
  /** The actual text to post */
  content: string;
  /** For blog / reddit / devto */
  title?: string;
  /** For reddit */
  subreddit?: string;
  /** For devto */
  tags?: string[];
  /** For blog MDX stored in Vercel Blob */
  blobPath?: string;
  scheduledTime: string;
  status: "pending" | "posting" | "posted" | "failed";
  postedUrl?: string;
  postedId?: string;
  error?: string;
  postedAt?: string;
}

/** Social engagement metrics collected from a platform */
export interface SocialMetrics {
  platform: Platform;
  postId: string;
  likes: number;
  shares: number;
  comments: number;
  impressions: number;
  clicks: number;
  collectedAt: string;
}

/** Google Search Console performance data for a single URL + date */
export interface SearchPerformance {
  url: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  date: string;
}

/** Aggregated content performance score used by FEEDBACK + IMPROVE */
export interface ContentScore {
  contentId: string;
  slug: string;
  type: "blog" | "social" | "comparison";
  compositeScore: number;
  gscClicks: number;
  socialEngagement: number;
  pageViews: number;
  positionChange: number;
  lastUpdated: string;
}

/** Strategy state — updated by IMPROVE, read by ANALYZE + GENERATE */
export interface StrategyState {
  contentTypeWeights: {
    blog: number;
    social: number;
    comparison: number;
  };
  platformWeights: Record<Platform, number>;
  hotTopics: string[];
  coldTopics: string[];
  keywordPriorities: { cluster: string; weight: number }[];
  toneAdjustments: {
    moreOpinionated: boolean;
    moreTechnical: boolean;
    includeCodeExamples: boolean;
    comparisonTables: boolean;
  };
  bestPostingTimes: Partial<Record<Platform, string>>;
  redditTargets: string[];
  /** 0-1 — portion of content that experiments with new topics/formats */
  explorationBudget: number;
  updatedAt: string;
  changelog: string;
}

/** Trend analysis output produced by the ANALYZE stage */
export interface TrendAnalysis {
  trendingTopics: {
    topic: string;
    relevanceScore: number;
    urgency: "high" | "medium" | "low";
    source: string;
  }[];
  newModelsDetected: {
    name: string;
    provider: string;
    details: string;
  }[];
  contentGaps: {
    keyword: string;
    searchVolumeEstimate: string;
    competition: "low" | "medium" | "high";
  }[];
  competitorMoves: {
    competitor: string;
    action: string;
    ourResponse: string;
  }[];
  recommendedQueue: ContentQueueItem[];
}

/** Pipeline run log entry */
export interface PipelineRun {
  stage: "analyze" | "generate" | "post" | "feedback" | "improve";
  startedAt: string;
  completedAt?: string;
  status: "running" | "completed" | "failed";
  summary: string;
  error?: string;
}

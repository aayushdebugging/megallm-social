// TwitterAPI.io — cheap read-only Twitter metrics API
// https://twitterapi.io — $0.15/1K tweets

const API_KEY = process.env.TWITTERAPI_IO_KEY ?? "";
const BASE_URL = "https://api.twitterapi.io/twitter";

interface TwitterApiResponse {
  status: string;
  data: any;
}

export interface TweetMetrics {
  tweetId: string;
  text: string;
  likes: number;
  retweets: number;
  replies: number;
  impressions: number;
  bookmarks: number;
  createdAt: string;
}

export async function getTweetMetrics(
  tweetId: string
): Promise<TweetMetrics | null> {
  try {
    const res = await fetch(`${BASE_URL}/tweets?tweet_ids=${tweetId}`, {
      headers: { "X-API-Key": API_KEY },
    });

    if (!res.ok) return null;
    const data: TwitterApiResponse = await res.json();
    if (data.status !== "success" || !data.data?.tweets?.length) return null;

    const tweet = data.data.tweets[0];
    return {
      tweetId,
      text: tweet.text ?? "",
      likes: tweet.likeCount ?? 0,
      retweets: tweet.retweetCount ?? 0,
      replies: tweet.replyCount ?? 0,
      impressions: tweet.viewCount ?? 0,
      bookmarks: tweet.bookmarkCount ?? 0,
      createdAt: tweet.createdAt ?? "",
    };
  } catch (error) {
    console.error(`TwitterAPI.io error for ${tweetId}:`, error);
    return null;
  }
}

export async function searchTweets(
  query: string,
  limit = 20
): Promise<TweetMetrics[]> {
  try {
    const res = await fetch(
      `${BASE_URL}/tweet/advanced_search?query=${encodeURIComponent(query)}&queryType=Latest&cursor=`,
      { headers: { "X-API-Key": API_KEY } }
    );

    if (!res.ok) return [];
    const data: TwitterApiResponse = await res.json();
    if (data.status !== "success") return [];

    const tweets = data.data?.tweets ?? [];
    return tweets.slice(0, limit).map((t: any) => ({
      tweetId: t.id ?? "",
      text: t.text ?? "",
      likes: t.likeCount ?? 0,
      retweets: t.retweetCount ?? 0,
      replies: t.replyCount ?? 0,
      impressions: t.viewCount ?? 0,
      bookmarks: t.bookmarkCount ?? 0,
      createdAt: t.createdAt ?? "",
    }));
  } catch (error) {
    console.error(`TwitterAPI.io search error:`, error);
    return [];
  }
}

export async function getMultipleTweetMetrics(
  tweetIds: string[]
): Promise<TweetMetrics[]> {
  const results = await Promise.allSettled(tweetIds.map(getTweetMetrics));
  return results
    .filter(
      (r): r is PromiseFulfilledResult<TweetMetrics | null> =>
        r.status === "fulfilled"
    )
    .map((r) => r.value)
    .filter((r): r is TweetMetrics => r !== null);
}

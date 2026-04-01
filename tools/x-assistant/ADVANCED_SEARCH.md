# Twitter Advanced Search Operators

Reference: https://github.com/igorbrigadir/twitter-advanced-search

## Available Operators for Enhanced Fetching

### Quality & Engagement Filters
```
min_faves:5          Minimum 5 likes (quality baseline)
min_replies:1        Minimum 1 reply (active discussion)
min_retweets:1       Minimum 1 retweet (some sharing)
filter:has_engagement tweets with any engagement
-min_faves:1000      Maximum 1000 likes (avoid mega-viral noise)
```

### Content Type Filters  
```
-filter:nativeretweets    Exclude retweets (original content only)
-filter:replies           Exclude replies (top-level tweets only)
filter:links              Must contain URLs
-filter:videos            Exclude video tweets
filter:images             Must have images
filter:safe               Exclude NSFW content
```

### Verification & Source Filters
```
filter:verified           From verified accounts
filter:blue_verified      Twitter Blue members
source:twitter_web_client From web client
```

### Language Filters
```
lang:en   English language tweets
lang:und  Undefined language
```

## Implementation Strategy

### Phase 1: Core Topics (Priority)
Use stricter filters for high-quality signal:
- `-filter:nativeretweets` (original content only)
- `min_faves:5` (baseline quality)
- `-filter:videos` (text-focused)

### Phase 2-3: Ecosystem & Competitors
Relax filters slightly for broader coverage:
- `-filter:replies` (include replies but not retweets)
- `min_faves:1` (more lenient)
- Allow media

### Phase 4-5: Trending & Audience
Focus on engagement:
- `filter:has_engagement` (must have interaction)
- `-filter:nativeretweets` (interesting original takes)
- `filter:links` (technical discussions with resources)

## Example Enhanced Queries

### Current (English detection only)
```
llm api gateway lang:en
```

### Enhanced (Add quality filters)
```
llm api gateway -filter:nativeretweets min_faves:5 -filter:videos filter:safe lang:en
```

### For News/Articles
```
llm api gateway filter:links filter:safe -filter:videos lang:en
```

### For Community Discussion
```
llm api gateway -filter:replies filter:has_engagement lang:en
```

## Implementation Notes

- These operators work on Twitter Web, Mobile, and Tweetdeck
- Maximum ~22-23 operators per query
- Some operators require others (e.g., time operators need content keyword)
- Always include `lang:en` for English-only results
- Combine with `-filter:videos` to reduce noise
- Use `-filter:nativeretweets` for original takes only

## Future Enhancements

1. Build query builder function to automatically add operators based on phase
2. Add configurable operator templates per phase
3. Test and refine based on result quality feedback
4. Monitor rate limits while using complex queries

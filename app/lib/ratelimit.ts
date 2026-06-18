import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(3, "1 d"),
  prefix: "transitions:anon",
});

// Per-user daily cap (D-031). Signed-in users are the only ones who can run the
// expensive generation; this gives them a generous ceiling while still closing
// the cost hole. Keyed by user id. Shared so the deferred Stage 2 generate route
// applies the same cap without redefining the window.
export const userRatelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(20, "1 d"),
  prefix: "transitions:user",
});

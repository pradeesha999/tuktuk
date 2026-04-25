import process from "node:process";

const targetUrl = process.env.STRESS_URL || "http://localhost:5000/api/v1/auth/login";
const totalRequests = Number.parseInt(process.env.STRESS_REQUESTS || "1000", 10);
const concurrency = Number.parseInt(process.env.STRESS_CONCURRENCY || "50", 10);
const timeoutMs = Number.parseInt(process.env.STRESS_TIMEOUT_MS || "5000", 10);

const stats = {
  total: 0,
  success2xx: 0,
  unauthorized401: 0,
  rateLimited429: 0,
  otherErrors: 0,
  networkErrors: 0
};

const latencies = [];

const oneRequest = async () => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const started = performance.now();
  try {
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "hqadmin", password: "bad-pass" }),
      signal: controller.signal
    });
    const ms = performance.now() - started;
    latencies.push(ms);
    stats.total += 1;
    if (response.status >= 200 && response.status < 300) stats.success2xx += 1;
    else if (response.status === 401) stats.unauthorized401 += 1;
    else if (response.status === 429) stats.rateLimited429 += 1;
    else stats.otherErrors += 1;
  } catch (_error) {
    stats.total += 1;
    stats.networkErrors += 1;
  } finally {
    clearTimeout(timeout);
  }
};

const run = async () => {
  console.log(`Stress test target: ${targetUrl}`);
  console.log(`Total requests: ${totalRequests}, concurrency: ${concurrency}, timeout: ${timeoutMs}ms`);

  const started = performance.now();
  let launched = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (launched < totalRequests) {
      launched += 1;
      await oneRequest();
    }
  });

  await Promise.all(workers);
  const elapsed = (performance.now() - started) / 1000;

  latencies.sort((a, b) => a - b);
  const percentile = (p) => {
    if (latencies.length === 0) return 0;
    const i = Math.min(latencies.length - 1, Math.floor((p / 100) * latencies.length));
    return latencies[i];
  };

  console.log("----- Results -----");
  console.log(`Elapsed: ${elapsed.toFixed(2)}s`);
  console.log(`Throughput: ${(stats.total / elapsed).toFixed(2)} req/s`);
  console.log(`2xx: ${stats.success2xx}`);
  console.log(`401: ${stats.unauthorized401}`);
  console.log(`429 (rate limited): ${stats.rateLimited429}`);
  console.log(`Other HTTP errors: ${stats.otherErrors}`);
  console.log(`Network/timeouts: ${stats.networkErrors}`);
  console.log(`Latency p50: ${percentile(50).toFixed(2)} ms`);
  console.log(`Latency p95: ${percentile(95).toFixed(2)} ms`);
  console.log(`Latency p99: ${percentile(99).toFixed(2)} ms`);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

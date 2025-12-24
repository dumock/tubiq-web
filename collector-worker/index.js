import fetch from "node-fetch";

async function crawl() {
  const res = await fetch("https://example.com");
  const text = await res.text();
  console.log("fetched length:", text.length);
}

console.log("collector-worker started");

setInterval(async () => {
  console.log("crawling...");
  await crawl();
}, 60_000); // 1분마다

const role = process.env.WORKER_ROLE;

if (!role) {
  console.error("❌ WORKER_ROLE is not set (collector | crawler | relay-metadata)");
  process.exit(1);
}

console.log(`🚀 Worker started with role: ${role}`);

if (role === "collector") {
  import("./collector-worker/index.mjs");
} else if (role === "crawler") {
  import("./crawler-worker/index.mjs")
    .then((mod) => {
      if (typeof mod.startCrawler !== "function") {
        throw new Error("startCrawler is not exported");
      }
      return mod.startCrawler();
    })
    .catch((err) => {
      console.error("❌ Failed to start crawler:", err);
      process.exit(1);
    });
} else if (role === "relay-metadata") {
  import("./relay-metadata-worker/index.mjs")
    .then((mod) => {
      // index.mjs가 main()을 export 안 해도, 지금 코드처럼 "직접 실행" 형태면 그냥 import만 해도 됨
      // 다만 안정적으로 가려면 main export를 권장
      if (typeof mod.main === "function") return mod.main();
    })
    .catch((err) => {
      console.error("❌ Failed to start relay-metadata-worker:", err);
      process.exit(1);
    });
} else {
  console.error("❌ Unknown WORKER_ROLE:", role);
  process.exit(1);
}

const role = process.env.WORKER_ROLE;

if (!role) {
  console.error("❌ WORKER_ROLE is not set (collector | crawler)");
  process.exit(1);
}

console.log(`🚀 Worker started with role: ${role}`);

if (role === "collector") {
  import("./collector-worker/index.js");
} else if (role === "crawler") {
  import("./crawler-worker/index.mjs");
} else {
  console.error("❌ Unknown WORKER_ROLE:", role);
  process.exit(1);
}

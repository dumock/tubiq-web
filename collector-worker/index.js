console.log("collector-worker started");

setInterval(() => {
  console.log("worker alive:", new Date().toISOString());
}, 5000);

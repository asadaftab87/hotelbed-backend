module.exports = {
  apps: [
    {
      name: "hotelbed-backend",
      script: "dist/src/app.js",
      // 🚀 EXTREME PERFORMANCE: Optimized V8 flags for speed
      node_args: [
        "--max-old-space-size=8192",      // 8GB heap
        "--max-semi-space-size=128",      // Faster garbage collection
        "--optimize-for-size",            // Better memory efficiency
        "--gc-interval=100",              // More frequent GC
        "--experimental-worker",          // Enable worker threads
      ].join(" "),
      env: {
        NODE_ENV: "production",
        UV_THREADPOOL_SIZE: 16            // Increase libuv thread pool (default: 4)
      }
    }
  ]
}

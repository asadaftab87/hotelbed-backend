module.exports = {
  apps: [
    {
      name: "hotelbed-backend",
      script: "dist/src/app.js",
      // 🚀 OPTIMIZED for r7a.xlarge (4 vCPUs, 32GB RAM)
      node_args: [
        "--max-old-space-size=28672",     // 28GB heap (leave 4GB for system)
        "--max-semi-space-size=128",      // Faster garbage collection
        "--optimize-for-size",            // Better memory efficiency
      ].join(" "),
      env: {
        NODE_ENV: "production",
        UV_THREADPOOL_SIZE: 16            // Increase libuv thread pool (default: 4)
      }
    }
  ]
}

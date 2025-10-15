module.exports = {
  apps: [
    {
      name: "hotelbed-backend",
      script: "dist/src/app.js",
      // 🚀 BALANCED for r7a.xlarge (32GB RAM)
      node_args: [
        "--max-old-space-size=24576",     // 24GB heap (balanced - leaves 8GB for OS)
        "--expose-gc",                    // Allow manual GC calls
        "--max-semi-space-size=64",       // Balanced GC
        "--optimize-for-size",            // Better memory efficiency
      ].join(" "),
      env: {
        NODE_ENV: "production",
        UV_THREADPOOL_SIZE: 16            // Increase libuv thread pool (default: 4)
      }
    }
  ]
}

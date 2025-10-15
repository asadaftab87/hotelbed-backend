module.exports = {
  apps: [
    {
      name: "hotelbed-backend",
      script: "dist/src/app.js",
      // 🚀 Flags as string (PM2 compatibility fix)
      node_args: "--max-old-space-size=24576 --expose-gc --max-semi-space-size=64 --optimize-for-size",
      env: {
        NODE_ENV: "production",
        UV_THREADPOOL_SIZE: "16",
        NODE_OPTIONS: "--max-old-space-size=24576 --expose-gc"  // Backup method
      }
    }
  ]
}

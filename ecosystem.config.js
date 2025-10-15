module.exports = {
  apps: [
    {
      name: "hotelbed-backend",
      script: "dist/src/app.js",
      interpreter: "node",
      interpreter_args: "--max-old-space-size=24576 --expose-gc --max-semi-space-size=64 --optimize-for-size",
      env: {
        NODE_ENV: "production",
        UV_THREADPOOL_SIZE: "16"
      }
    }
  ]
}

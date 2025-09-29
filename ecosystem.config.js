module.exports = {
  apps: [
    {
      name: "hotelbed-backend",
      script: "dist/src/app.js",
      node_args: "--max-old-space-size=8192",
      env: {
        NODE_ENV: "production"
      }
    }
  ]
}

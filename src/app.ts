import { config } from 'dotenv'
config();
import { createServer, Server as HttpServer } from 'http'
import express from 'express'
import { port, environment } from './config/globals'
import { Server } from './Api/server'
import Logger from './core/Logger';
import { prisma } from "./database"
// import { CronJob } from './utils/cronJobs';
export const app: express.Application = new Server().app;

let server: HttpServer;
(async function main(): Promise<void> {
  try {

    await prisma.$connect()

    process.on('uncaughtException', (e) => {
      Logger.error(e);
    });

    // const app: express.Application = new Server().app
    server = createServer(app)

    server.listen(port)

    server.on('listening', () => {
      Logger.info(`node server is listening on port ${port} in ${environment} mode`)
    })
    // new CronJob()

  } catch (err: any) {
    console.log(err);
    Logger.error(err.stack);
  }
})();

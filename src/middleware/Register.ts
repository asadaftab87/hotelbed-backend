import express, { Router } from 'express';
import cors from "cors";
import helmet from "helmet";
import compression from "compression"
import cookieParser from "cookie-parser";
// import session from "express-session"
import passport from 'passport';
import { corsUrl, environment } from '../config/globals';
import { env } from '../config/globals';
import { Request, Response, NextFunction } from 'express'

const registerMiddleware = (router: Router): void => {

  // router.use(express.static(path.join(__dirname, "../../client")));

  // if (environment === 'development') {
  // } else {
  //   router.use(cors({ origin: corsUrl, optionsSuccessStatus: 200 }));
  // }

  router.use(cors({ origin: '*' }));
  // router.use(function (req, res, next) {
  //   res.header("Access-Control-Allow-Origin", "*"); // update to match 
    // the domain you will make the request from
  //   res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content- Type, Accept");
  //   next();
  // });

  router.use(helmet());
  router.use(compression());
  router.use(express.json());

  // router.use(session({ secret: 'google-auth-session' }));
  router.use(cookieParser());
  router.use(passport.initialize());
  // router.use(passport.session());
  // router.use(bodyParser.raw({ type: 'application/vnd.custom-type' }))

}

export default registerMiddleware

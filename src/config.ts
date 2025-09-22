require('dotenv').config()

enum ENVIROMENT_TYPE {
  development = "development",
  production = "production",
}

// @ts-ignore
export const environment: ENVIROMENT_TYPE = process.env.NODE_ENV;
export const port = process.env.PORT;

export const DATABASE = {
  development: process.env.DB_URI,
  production: process.env.DB_URI,
}
// console.log({
//   environment,
//   port,
//   DATABASE
// });

export const corsUrl: string[] = ["http://localhost:3000"];

export const tokenInfo = {
  accessTokenValidityDays: parseInt(process.env.ACCESS_TOKEN_VALIDITY_SEC || '1d'),
  refreshTokenValidityDays: parseInt(process.env.REFRESH_TOKEN_VALIDITY_SEC || '1d'),
  issuer: process.env.DB_URI || 'ZeltaTech',
  audience: process.env.DB_URI || 'ZeltaTech',
};


export const REFERRAL_COMMISSION = {
  yearly: {
    firstTier: 1000,
    secondTier: 300
  },
  monthly: {
    firstTier: 100,
    secondTier: 25
  }
}
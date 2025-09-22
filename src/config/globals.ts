
require('dotenv').config()

enum ENVIROMENT_TYPE {
  development = "development",
  production = "production",
}

// @ts-ignore
export const environment: ENVIROMENT_TYPE = process.env.NODE_ENV;
// @ts-ignore
export const port: number = process.env.PORT;
// @ts-ignore
export const slack_port: number = process.env.SLACK_PORT;

export const APP_NAME: string = process.env.APP_NAME as string;

export const DATABASE = {
  development: process.env.DB_URI,
  production: process.env.DB_URI,
}

export const REDIS_CASHE = {
  development: {
    socket: {
      host: "redis-12863.c263.us-east-1-2.ec2.cloud.redislabs.com",
      port: 12863,
    },
    password: "DuGaeLd3ZrtQ79lQBQ9EBzdW43q3qxth"
  },
  production: {
    socket: {
      host: "redis-12863.c263.us-east-1-2.ec2.cloud.redislabs.com",
      port: 12863,
    },
    password: "DuGaeLd3ZrtQ79lQBQ9EBzdW43q3qxth"
  },
}

export const StripeCred = {
  clientSecret: "sk_test_51MFR2TIadObZ2b5rh7mfKwSaAbNLgR0QxgTSIWNUlzBD0M6RQYDg4YVI7RzLzZOg2pbkrqSZlJyIWP2Ye8JDWG35004dE9L9oI",
  development: {
    clientSecret: "sk_test_51MFR2TIadObZ2b5rh7mfKwSaAbNLgR0QxgTSIWNUlzBD0M6RQYDg4YVI7RzLzZOg2pbkrqSZlJyIWP2Ye8JDWG35004dE9L9oI"
  },
  production: {
    clientSecret: "sk_test_51MFR2TIadObZ2b5rh7mfKwSaAbNLgR0QxgTSIWNUlzBD0M6RQYDg4YVI7RzLzZOg2pbkrqSZlJyIWP2Ye8JDWG35004dE9L9oI"
  }
}

// // Environment variables imported from .env file
export const env = {
  DB: {
    [ENVIROMENT_TYPE.development]: { uri: process.env.DB_URI },
    [ENVIROMENT_TYPE.production]: { uri: process.env.DB_URI },
  },
  NODE_ENV: process.env.NODE_ENV || "development",
  NODE_PORT: process.env.NODE_PORT || process.env.PORT || 8000,
  API_VERSION: "v1",
  DOMAIN: process.env.DOMAIN,
  lOGD_IRECTORY: process.env.LOGDIRECTORY || './logs',
};

export const corsUrl: string[] = [];

export const tokenInfo = {
  accessTokenValidityDays: parseInt('30d'),
  refreshTokenValidityDays: parseInt('30d'),
  issuer: process.env.TOKEN_ISSUER || 'Wedding Sponsor',
  audience: process.env.TOKEN_AUDIENCE || 'Wedding Sponsor',
};

export const SMTP = {
  SENDGRID_API_KEY: "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",
  sender: "no-reply@ecomempire.io",
  TEMPLATE: {
    FORGOT_PASSWORD: "123",
    EMAIL_VERIFICATION: "d-18c4ba2093544fffaa4da345d09f8cf9",
    VA_ACCOUNT_CREATED: "d-c65b026d0c32482fa8904ece0a489f6a",
  }
}

export const streamChat = {
  clientKey: "2mkj8qt7znpa",
  clientSecret: "yd2kz9dbqugvjk7vnrnvuzxgn8vtv9aq2n72q4c55u9cm8zugcxktpasfhs3aufq"
}

export const AccountantApi = {
  BASE_URL: 'https://1800accountant.com/sfapi',
  LEAD_SOURCE: 'Ecom Empire',
  TOKEN: 'b216b56743cb3aaf9443e108c08e99e4b086270f'
}

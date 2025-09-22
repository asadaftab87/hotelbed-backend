// import { createClient } from 'redis';
// import { REDIS_CASHE, environment } from '../config/globals';
// import Logger from '../core/Logger';


// Logger.info(`Connecting to redis in ${environment} mode`);

// const redis_config = REDIS_CASHE[environment];


// export const redis_client = createClient({
//   socket: {
//     host: redis_config.socket.host,
//     port: redis_config.socket.port,
//   },
//   password: redis_config.password
// });

// redis_client.connect()
// // .then(() => {
// //   Logger.info('Redis connection open to ' + redis_config.socket.host + ' in ' + environment + ' mode');
// // })
// // .catch((err) => {
// //   Logger.error('Redis connection error: ' + err);
// // })

// redis_client.on('connect', () => {
//   console.log('##########################################################');
//   console.log('#####            REDIS STORE CONNECTED               #####');
//   console.log('##########################################################\n');
// });

// redis_client.on('error', (err) => {
//   console.log('##########################################################');
//   console.log('#####            REDIS STORE ERROR                   #####');
//   console.log('##########################################################\n');
// });


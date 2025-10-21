import redisClient from '@config/redis';

export const redisManager = {
  connect: async () => {
    return await redisClient.connect();
  },
  
  disconnect: async () => {
    return await redisClient.disconnect();
  },
  
  isReady: () => {
    return redisClient.isReady();
  },
  
  getClient: () => {
    return redisClient.getClient();
  }
};


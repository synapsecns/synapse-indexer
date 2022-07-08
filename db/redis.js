import Redis from "ioredis"

export class RedisConnection {
    _CLIENT

    static async getClient(uriOverride = null) {
        if (!RedisConnection._CLIENT) {
            const redisUri = uriOverride ? uriOverride : process.env.REDIS_URI
            RedisConnection._CLIENT = new Redis(redisUri);
        }
        // while (RedisConnection._CLIENT.status !== 'ready'){}
        return RedisConnection._CLIENT
    }
}

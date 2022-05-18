import Redis from "ioredis"

export class RedisConnection {
    _CLIENT

    static async getClient() {
        if (!RedisConnection._CLIENT) {
            RedisConnection._CLIENT = new Redis(process.env.REDIS_URI);
        }
        // while (RedisConnection._CLIENT.status !== 'ready'){}
        return RedisConnection._CLIENT
    }
}

import redis from "redis"

export class RedisConnection {
    // TODO: Cache
    static async getClient() {
        const client = redis.createClient(process.env.REDIS_URI);
        await client.connect()
        return client;
    }
}

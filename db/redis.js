import redis from "redis"

export class RedisConnection {
    static async getClient() {
        const client = redis.createClient({
            host: 'localhost',
            port: '6379',
        });
        await client.connect()
        return client;
    }
}

import Redis from "ioredis"

export class RedisConnection {
    _CLIENT

    static async getClient() {
        if (!RedisConnection._CLIENT) {
            RedisConnection._CLIENT = new Redis("redis://localhost:6379");
        }
        // while (RedisConnection._CLIENT.status !== 'ready'){}
        return RedisConnection._CLIENT
    }
}

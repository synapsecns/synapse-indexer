import { MongoClient } from "mongodb";

export class MongoConnection {
    static async getClient() {
        let client = await MongoClient.connect(
            process.env.MONGO_URI
        );
        return client.db();
    }
}


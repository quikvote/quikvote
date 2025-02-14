import { MongoClient, ObjectId } from 'mongodb';
import dbUrl from '../../dbconfig';

class HistoryMongoDB {
    private client;
    private db;
    private historyCollection;

    public constructor() {
        this.client = new MongoClient(dbUrl);
        this.db = this.client.db('quikvote');
        this.historyCollection = this.db.collection('history');
    }

    public async createResult(username: string, sortedOptions: any) {
        const result = {
          owner: username,
          sortedOptions,
          timestamp: Date.now()
        }
      
        const insertResult = await this.historyCollection.insertOne(result)
        return {
          ...result,
          _id: insertResult.insertedId
        }
    }

    public async getResult(resultId: any) {
        return await this.historyCollection.findOne(new ObjectId(resultId))
    }

    public async getHistory(username: string) {
        const cursor = this.historyCollection.find(
          { owner: username },
          {
            sort: { timestamp: -1 }
          }
        )
        return await cursor.toArray()
    }

}

export default HistoryMongoDB;
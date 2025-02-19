import { ObjectId } from 'mongodb';
import { HistoryDAO } from '../HistoryDAO';
import { getDB } from './MongoDB';

class HistoryMongoDB implements HistoryDAO {
    private historyCollection: any;

    public async init() {
      const db = await getDB()
      this.historyCollection = db.collection('history');
    }

    public async createResult(username: string, sortedOptions: any) {
        if (!this.historyCollection) await this.init();
        
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
        if (!this.historyCollection) await this.init();

        return await this.historyCollection.findOne(new ObjectId(resultId))
    }

    public async getHistory(username: string) {
        if (!this.historyCollection) await this.init();

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
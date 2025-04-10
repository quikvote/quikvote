import { Collection, Db, ObjectId, WithId } from 'mongodb';
import { HistoryDAO } from '../HistoryDAO';
import { OptionResult, Result } from '../../model';

class HistoryMongoDB implements HistoryDAO {
    private historyCollection: Collection<Result>;

    public constructor(db: Db) {
        this.historyCollection = db.collection<Result>('history');
    }

    public async createResult(username: string, options: OptionResult[]): Promise<WithId<Result>> {
        const result: Result = {
            owner: username,
            options,
            timestamp: Date.now()
        }

        const insertResult = await this.historyCollection.insertOne(result)
        return {
            ...result,
            _id: insertResult.insertedId
        }
    }

    public async getResult(resultId: string): Promise<Result | null> {
        return await this.historyCollection.findOne({ _id: new ObjectId(resultId) })
    }

    public async getHistory(username: string): Promise<Result[]> {
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
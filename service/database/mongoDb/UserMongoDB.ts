import { MongoClient } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
import dbUrl from '../../dbconfig';
import { UserDAO } from '../UserDAO';

class UserMongoDb implements UserDAO {
    private client;
    private db;
    private userCollection;

    public constructor() {
        this.client = new MongoClient(dbUrl);
        this.db = this.client.db('quikvote');
        this.userCollection = this.db.collection('user');
    }

    public getUser(username: string): any {
        return this.userCollection.findOne({ username });
    }
    
    public getUserByToken(token: string): any {
        return this.userCollection.findOne({ token });
    }
    
    public async createUser(username: string, password: string): Promise<any> {
        const passwordHash = await bcrypt.hash(password, 10);
    
        const user = {
          username,
          password: passwordHash,
          token: uuidv4(),
        };
        await this.userCollection.insertOne(user);
      
        return user;
    }
}

export default UserMongoDb;

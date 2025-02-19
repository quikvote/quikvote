import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
import { UserDAO } from '../UserDAO';
import { getDB } from './MongoDB';

class UserMongoDb implements UserDAO {
    private userCollection: any;

    public async init() {
        const db = await getDB()
        this.userCollection = db.collection('user');
    }

    public async getUser(username: string): Promise<any> {
        if (!this.userCollection) await this.init();
        return this.userCollection.findOne({ username });
    }
    
    public async getUserByToken(token: string): Promise<any> {
        if (!this.userCollection) await this.init();
        return this.userCollection.findOne({ token });
    }
    
    public async createUser(username: string, password: string): Promise<any> {
        if (!this.userCollection) await this.init();
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

import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
import { UserDAO } from '../UserDAO';
import { Collection, Db } from 'mongodb';
import { User } from '../../model';


class UserMongoDb implements UserDAO {
    private userCollection: Collection<User>;

    public constructor(db: Db) {
        this.userCollection = db.collection<User>('user');
    }

    public async getUser(username: string): Promise<User | null> {
        return this.userCollection.findOne({ username });
    }

    public async getUserByToken(token: string): Promise<User | null> {
        return this.userCollection.findOne({ token });
    }

    public async createUser(username: string, password: string): Promise<User> {
        const passwordHash = await bcrypt.hash(password, 10);

        const user: User = {
            username,
            password: passwordHash,
            token: uuidv4(),
        };
        await this.userCollection.insertOne(user);

        return user;
    }
}

export default UserMongoDb;

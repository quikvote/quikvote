import { Db } from "mongodb";
import HistoryMongoDB from "../database/mongoDb/HistoryMongoDB";
import RoomMongoDB from "../database/mongoDb/RoomMongoDB";
import UserMongoDb from "../database/mongoDb/UserMongoDB";
import { DaoFactory } from "./DaoFactory";

class MongoDBDaoFactory implements DaoFactory {
    public constructor(private db: Db) { }

    public roomDAO() {
        return new RoomMongoDB(this.db);
    }

    public historyDAO() {
        return new HistoryMongoDB(this.db);
    }

    public userDAO() {
        return new UserMongoDb(this.db);
    }
}

export default MongoDBDaoFactory;

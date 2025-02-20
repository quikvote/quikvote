import HistoryMongoDB from "../database/mongoDb/HistoryMongoDB";
import RoomMongoDB from "../database/mongoDb/RoomMongoDB";
import UserMongoDb from "../database/mongoDb/UserMongoDB";
import { DaoFactory } from "./DaoFactory";

class MongoDBDaoFactory implements DaoFactory {
    public roomDAO() {
        return new RoomMongoDB();
    }

    public historyDAO() {
        return new HistoryMongoDB();
    }

    public userDAO() {
        return new UserMongoDb();
    }
}

export default MongoDBDaoFactory;
import { HistoryDAO } from "../database/HistoryDAO";
import { RoomDAO } from "../database/RoomDAO";
import { UserDAO } from "../database/UserDAO";

export interface DaoFactory {
    roomDAO: () => RoomDAO;
    historyDAO: () => HistoryDAO;
    userDAO: () => UserDAO;
}
import { WithId } from "mongodb";
import { Result } from "../model";

export interface HistoryDAO {
    createResult: (result: Result) => Promise<WithId<Result>>;
    getResult: (resultID: string) => Promise<Result | null>;
    getHistory: (username: string) => Promise<Result[]>;
}

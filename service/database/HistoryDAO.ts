import { WithId } from "mongodb";
import { Result } from "../model";

export interface HistoryDAO {
    createResult: (username: string, sortedOptions: string[]) => Promise<WithId<Result>>;
    getResult: (resultID: string) => Promise<Result | null>;
    getHistory: (username: string) => Promise<Result[]>;
}

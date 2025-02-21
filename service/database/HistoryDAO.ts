import { WithId } from "mongodb";
import { Result } from "../model";

export interface HistoryDAO {
    createResult: (username: string, sortedOptions: any) => Promise<WithId<Result>>;
    getResult: (resultID: any) => Promise<Result | null>;
    getHistory: (username: string) => Promise<Result[]>;
}

import { WithId } from "mongodb";
import { OptionResult, Result } from "../model";

export interface HistoryDAO {
    createResult: (username: string, options: OptionResult[]) => Promise<WithId<Result>>;
    getResult: (resultID: string) => Promise<Result | null>;
    getHistory: (username: string) => Promise<Result[]>;
}
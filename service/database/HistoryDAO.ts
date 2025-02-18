export interface HistoryDAO {
    createResult: (username: string, sortedOptions: any) => any;
    getResult: (resultID: any) => any;
    getHistory: (username: string) => any;
}
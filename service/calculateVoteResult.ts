import { ItemResult, UserVote, UserVoteResult } from "./model";

const calculateVoteResult = (userVotes: UserVote[]) => {
    return sortOptions(calculateTotals(userVotes));
}

const calculateTotals = (userVotes: UserVote[]) => {
    const totals = new Map()
    userVotes.forEach(userVote => {
        Object.keys(userVote.votes).forEach(key => {
            totals.set(key, (totals.get(key) ?? 0) + userVote.votes[key])
        })
    });
    return totals
}

const sortOptions = (totals: Map<any,  any>) => {
    const sorted = Array.from(totals)
        .sort((a, b) => b[1] - a[1])
    const sortedOptions = sorted.map(([key]) => key);
    const sortedTotals = sorted.map(([, value]) => value);
    return {sortedOptions,  sortedTotals}
}

const calculateVoteResultWithUsers = (userVotes: UserVote[]): UserVoteResult => {
    const results: UserVoteResult = new Map<string, ItemResult>()
    userVotes.forEach(userVote => {
        Object.keys(userVote.votes).forEach(key => {
            if (!results.has(key)) {
                results.set(key, {totals: 0, users: []})
            }
            const currEntry = results.get(key)!
            currEntry.totals += userVote.votes[key]
            currEntry.users.push(userVote.username)
        })
    });
    return results;
}

export {calculateVoteResult, calculateTotals, sortOptions, calculateVoteResultWithUsers}

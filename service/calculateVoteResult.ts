import { ItemResult, UserVote, UserVoteResult } from "./model";

const calculateVoteResult = (userVotes: UserVote[], numRunnerUpsToDisplay: number = Infinity) => {
    return sortOptions(calculateVoteResultWithUsers(userVotes), numRunnerUpsToDisplay);
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

const sortOptions = (totals: UserVoteResult, numRunnerUpsToDisplay: number) => {
    const sorted = Array.from(totals)
        .sort((a, b) => b[1].totals - a[1].totals).slice(0, numRunnerUpsToDisplay);
    const sortedOptions = sorted.map(([key]) => key);
    const sortedTotals = sorted.map(([, value]) => value.totals);
    const sortedUsers = sorted.map(([, value]) => value.users);
    return {sortedOptions,  sortedTotals, sortedUsers}
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
            if (userVote.votes[key] > 0) { currEntry.users.push(userVote.username) }
        })
    });

    return results;
}

export {calculateVoteResult}

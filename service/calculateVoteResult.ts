import { UserVote } from "./model";

const calculateVoteResult = (userVotes: UserVote[]) => {
    const totals = new Map()
    userVotes.forEach(userVote => {
        Object.keys(userVote.votes).forEach(key => {
            totals.set(key, (totals.get(key) ?? 0) + userVote.votes[key])
        })
    });
    const sortedOptions = Array.from(totals)
        .sort((a, b) => b[1] - a[1])
        .map(([key]) => key)
    return sortedOptions
}

export default calculateVoteResult;

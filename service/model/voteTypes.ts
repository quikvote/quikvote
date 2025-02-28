import { Result, Room } from ".";

export enum VoteType {
    Score = 'score',
    Rank = 'Rank'
}

export interface BaseModOptions { }
export interface ScoreModOptions extends BaseModOptions {
    minVotesPerOption: number
    maxVotesPerOption: number
}
export interface RankModOptions extends BaseModOptions {

}

export type VoteConfig =
    | { type: VoteType.Score; options: ScoreModOptions }
    | { type: VoteType.Rank; options: RankModOptions }

export type Vote =
    | { type: VoteType.Score; scores: Record<string, number> }
    | { type: VoteType.Rank; rank: string[] }

export const aggregationMap: Record<VoteType, (room: Room) => Result> = {
    [VoteType.Score]: aggregateScoreVote,
    [VoteType.Rank]: aggregateRankVote
}

export function aggregateScoreVote(room: Room): Result {
    const userVotes = room.votes

    if (room.config.type !== VoteType.Score) {
        throw new Error('Vote type must be "score"')
    }

    const totals: Map<string, number> = new Map()
    userVotes.forEach(userVote => {
        if (userVote.vote.type === VoteType.Score) {
            const vote = userVote.vote
            Object.keys(vote.scores).forEach(key => {
                totals.set(key, (totals.get(key) ?? 0) + vote.scores[key])
            })
        }
    });

    const winner = Array.from(totals.entries()).reduce((a, b) => a[1] < b[1] ? b : a)[0]

    return {
        owner: room.owner,
        winner,
        details: Object.fromEntries(totals),
        timestamp: Date.now(),
    }
}

export function aggregateRankVote(room: Room): Result {
    const userVotes = room.votes

    if (room.config.type !== VoteType.Score) {
        throw new Error('Vote type must be "score"')
    }

    const totals: Map<string, number> = new Map()
    userVotes.forEach(userVote => {
        if (userVote.vote.type === VoteType.Score) {
            const vote = userVote.vote
            Object.keys(vote.scores).forEach(key => {
                totals.set(key, (totals.get(key) ?? 0) + vote.scores[key])
            })
        }
    });

    const winner = Array.from(totals.entries()).reduce((a, b) => a[1] < b[1] ? b : a)[0]

    return {
        owner: room.owner,
        winner,
        details: Object.fromEntries(totals),
        timestamp: Date.now(),
    }
}

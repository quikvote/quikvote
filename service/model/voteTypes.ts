import { Result, Room } from ".";

export enum VoteType {
  Score = 'score',
  Rank = 'rank'
}

// Vote options

export interface BaseModOptions {
  numRunnerUps: number
  showNumVotes: boolean
  showWhoVoted: boolean
}
const defaultBaseModOptions: BaseModOptions = {
  numRunnerUps: -1,
  showNumVotes: true,
  showWhoVoted: false
}

export interface ScoreModOptions extends BaseModOptions {
  minVotesPerOption: number
  maxVotesPerOption: number
}
const defaultScoreModOptions: ScoreModOptions = {
  ...defaultBaseModOptions,
  minVotesPerOption: 0,
  maxVotesPerOption: 10
}

export interface RankModOptions extends BaseModOptions { }
const defaultRankModOptions: RankModOptions = {
  ...defaultBaseModOptions
}

export const defaultModOptionsMap: Record<VoteType, BaseModOptions> = {
  [VoteType.Score]: defaultScoreModOptions,
  [VoteType.Rank]: defaultRankModOptions
}

// Vote config

export type VoteConfig =
  | { type: VoteType.Score; options: ScoreModOptions }
  | { type: VoteType.Rank; options: RankModOptions }

export type Vote =
  | { type: VoteType.Score; scores: Record<string, number> }
  | { type: VoteType.Rank; rank: string[] }


// Aggregation Functions

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

  const sorted = Array.from(totals.entries()).sort((a, b) => b[1] - a[1])
  const sortedOptions = sorted.map(([option, _]) => option)
  const sortedTotals = sorted.map(([_, score]) => score)

  return {
    sortedOptions,
    sortedTotals,
    owner: room.owner,
    timestamp: Date.now(),
  }
}

export function aggregateRankVote(room: Room): Result {
  const userVotes = room.votes

  if (room.config.type !== VoteType.Rank) {
    throw new Error('Vote type must be "rank"')
  }

  const totals: Map<string, number> = new Map()
  userVotes.forEach(userVote => {
    if (userVote.vote.type === VoteType.Rank) {
      const vote = userVote.vote
      // TODO: actually implement rank aggregation
      vote.rank.forEach(v => totals.set(v, (totals.get(v) ?? 0) + 1))
    }
  });

  const sorted = Array.from(totals.entries()).sort((a, b) => b[1] - a[1])
  const sortedOptions = sorted.map(([option, _]) => option)
  const sortedTotals = sorted.map(([_, score]) => score)

  return {
    sortedOptions,
    sortedTotals,
    owner: room.owner,
    timestamp: Date.now(),
  }
}

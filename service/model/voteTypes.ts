import { Result, Room } from ".";

/*
  * HOW TO ADD A VOTE TYPE (backend)
  *
  * 1. Add a type to the VoteType enum (eg. Rank = 'rank')
  * 2. Add a mod options interface that extends BaseModOptions
  * 3. Add the vote type to the VoteConfig type with the options
  * 4. Add the vote type to the Vote type with the shape that a single user's vote should take
  * 5. Add an aggregation function to compile several user's votes into a Result object
  * 6. Ensure that the frontend is updated to handle the new vote type (see src/pages/vote/voteTypes/render.jsx)
  *
  */

export enum VoteType {
  Score = 'score',
  Rank = 'rank'
}

// Vote options

export interface BaseModOptions { // options that apply to all vote types (eg. results options)
  numRunnerUps: number
  showNumVotes: boolean
  showWhoVoted: boolean
}

export interface ScoreModOptions extends BaseModOptions {
  minVotesPerOption: number
  maxVotesPerOption: number
}

export interface RankModOptions extends BaseModOptions { }

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

// TODO: currently this bascically copies score vote aggregation. It should do it's own thing instead
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

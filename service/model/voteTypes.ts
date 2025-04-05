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
  Rank = 'rank',
  TopChoices = 'topChoices',
  Approval = 'approval',
  Quadratic = 'quadratic'
}

// Vote options

export enum ResultVisualizationType {
  BarGraph = 'bar',
  PieChart = 'pie',
  Podium = 'podium'
}

export interface BaseModOptions { // options that apply to all vote types (eg. results options)
  // Result display options
  numRunnerUps: number
  showNumVotes: boolean
  showWhoVoted: boolean
  resultType: ResultVisualizationType

  // Multi-round voting options
  enableRound?: boolean        // Whether to enable multi-round voting
  eliminationCount?: number    // How many options to eliminate each round
  maxRounds?: number           // Maximum number of rounds
  autoAdvance?: boolean        // Whether to automatically advance to next round
}
export interface ScoreModOptions extends BaseModOptions {
  minVotesPerOption: number
  maxVotesPerOption: number
}

export interface RankModOptions extends BaseModOptions { }

export interface TopChoicesModOptions extends BaseModOptions {
  numberOfChoices: number
}

export interface ApprovalModOptions extends BaseModOptions { }

export interface QuadraticModOptions extends BaseModOptions {
  creditBudget: number
}

// Vote config

export type VoteConfig =
    | { type: VoteType.Score; options: ScoreModOptions }
    | { type: VoteType.Rank; options: RankModOptions }
    | { type: VoteType.TopChoices; options: TopChoicesModOptions }
    | { type: VoteType.Approval; options: ApprovalModOptions }
    | { type: VoteType.Quadratic; options: QuadraticModOptions }

export type Vote =
    | { type: VoteType.Score; scores: Record<string, number> }
    | { type: VoteType.Rank; rankings: Record<string, number> }
    | { type: VoteType.TopChoices; topChoices: Record<string, string | null> }
    | { type: VoteType.Approval; approvals: Record<string, boolean> }
    | { type: VoteType.Quadratic; votes: Record<string, number>, costs: Record<string, number> }


// Aggregation Functions

export const aggregationMap: Record<VoteType, (room: Room) => Result> = {
  [VoteType.Score]: aggregateScoreVote,
  [VoteType.Rank]: aggregateRankVote,
  [VoteType.TopChoices]: aggregateTopChoicesVote,
  [VoteType.Approval]: aggregateApprovalVote,
  [VoteType.Quadratic]: aggregateQuadraticVote
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

export function aggregateApprovalVote(room: Room): Result {
  const userVotes = room.votes

  if (room.config.type !== VoteType.Approval) {
    throw new Error('Vote type must be "approval"')
  }

  const totals: Map<string, number> = new Map()

  userVotes.forEach(userVote => {
    if (userVote.vote.type === VoteType.Approval) {
      const vote = userVote.vote

      // Count each approval as 1 point
      Object.entries(vote.approvals).forEach(([option, approved]) => {
        if (approved) {
          totals.set(option, (totals.get(option) ?? 0) + 1)
        }
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

export function aggregateQuadraticVote(room: Room): Result {
  const userVotes = room.votes

  if (room.config.type !== VoteType.Quadratic) {
    throw new Error('Vote type must be "quadratic"')
  }

  const totals: Map<string, number> = new Map()

  userVotes.forEach(userVote => {
    if (userVote.vote.type === VoteType.Quadratic) {
      const vote = userVote.vote

      // Sum up the votes (not the costs)
      Object.entries(vote.votes).forEach(([option, voteCount]) => {
        totals.set(option, (totals.get(option) ?? 0) + voteCount)
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
      const numOptions = Object.keys(vote.rankings).length

      // Properly weight the rankings (higher positions get more points)
      Object.entries(vote.rankings).forEach(([option, rank]) => {
        // Invert the rank so first place (rank 1) gets the most points
        const points = numOptions - rank + 1
        totals.set(option, (totals.get(option) ?? 0) + points)
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

export function aggregateTopChoicesVote(room: Room): Result {
  const userVotes = room.votes

  if (room.config.type !== VoteType.TopChoices) {
    throw new Error('Vote type must be "topChoices"')
  }

  const totals: Map<string, number> = new Map()

  userVotes.forEach(userVote => {
    if (userVote.vote.type === VoteType.TopChoices) {
      const vote = userVote.vote
      const numberOfChoices = Object.keys(vote.topChoices).length

      // Assign weighted points based on choice position
      Object.entries(vote.topChoices).forEach(([position, option]) => {
        if (option) {  // Only process non-null selections
          let points = 0

          // Higher positions get more points
          switch(position) {
            case 'first':
              points = numberOfChoices;
              break;
            case 'second':
              points = numberOfChoices - 1;
              break;
            case 'third':
              points = numberOfChoices - 2;
              break;
            default:
              // For positions beyond third, extract the number from the position name
              // e.g., "choice4" gives us 4
              const choiceNum = parseInt(position.replace('choice', ''));
              if (!isNaN(choiceNum)) {
                points = numberOfChoices - (choiceNum - 1);
              }
              break;
          }

          totals.set(option, (totals.get(option) ?? 0) + points)
        }
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
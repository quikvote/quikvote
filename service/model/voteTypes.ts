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

export type UserVoteResult = Map<string, ItemResult>

export interface ItemResult {
  totals: number
  users: string[]
  users_vote: number[]
}

export enum VoteType {
  Score = 'score',
  Rank = 'rank',
  TopChoices = 'topChoices',
  Approval = 'approval',
  Quadratic = 'quadratic'
}

// Vote options

export interface BaseModOptions { // options that apply to all vote types (eg. results options)
  numRunnerUps: number
  showNumVotes: boolean
  showWhoVoted: boolean

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

  // const totals: Map<string, number> = new Map()
  // userVotes.forEach(userVote => {
  //   if (userVote.vote.type === VoteType.Score) {
  //     const vote = userVote.vote
  //     Object.keys(vote.scores).forEach(key => {
  //       totals.set(key, (totals.get(key) ?? 0) + vote.scores[key])
  //     })
  //   }
  // });

  const totals: UserVoteResult = new Map<string, ItemResult>()
    userVotes.forEach(userVote => {
      if (userVote.vote.type === VoteType.Score) {
        const vote = userVote.vote
        Object.keys(vote.scores).forEach(key => {
          // Add default value if it doesn't exist yet.
            if (!totals.has(key)) {
              totals.set(key, {totals: 0, users: [], users_vote: []})
            }
            const currEntry = totals.get(key)!
            currEntry.totals += vote.scores[key]
            // If the user's score is above 0, only then add their name and score to the option.
            if (vote.scores[key] > 0) { currEntry.users.push(userVote.username); currEntry.users_vote.push(vote.scores[key]) }
        })
    }});

    //Slice the results array to only be the length of the number of runner ups.
  const sorted = Array.from(totals.entries()).sort((a, b) => b[1].totals - a[1].totals)
  const sortedOptions = sorted.map(([option, _]) => option)
  const sortedTotals = sorted.map(([_, score]) => score.totals)
  const sortedUsers = sorted.map(([_, users]) => users.users)
  const sortedUsersVotes = sorted.map(([_, votes]) => votes.users_vote)

  return {
    sortedOptions,
    sortedTotals,
    sortedUsers,
    sortedUsersVotes,
    owner: room.owner,
    timestamp: Date.now(),
  }
}

export function aggregateApprovalVote(room: Room): Result {
  const userVotes = room.votes

  if (room.config.type !== VoteType.Approval) {
    throw new Error('Vote type must be "approval"')
  }

  const totals: UserVoteResult = new Map<string, ItemResult>()

  userVotes.forEach(userVote => {
    if (userVote.vote.type === VoteType.Approval) {
      const vote = userVote.vote

      // Count each approval as 1 point
      Object.entries(vote.approvals).forEach(([option, approved]) => {
        if (!totals.has(option)) {
          totals.set(option, {totals: 0, users: [], users_vote: []})
        }
        if (approved) {
          const currEntry = totals.get(option)!
          currEntry.totals += 1;
          currEntry.users.push(userVote.username)
        }
      })
    }
  });

  const sorted = Array.from(totals.entries()).sort((a, b) => b[1].totals - a[1].totals)
  const sortedOptions = sorted.map(([option, _]) => option)
  const sortedTotals = sorted.map(([_, score]) => score.totals)
  const sortedUsers = sorted.map(([_, users]) => users.users)
  //Since everyone just votes once, not needed field
  const sortedUsersVotes: number[][] = []

  return {
    sortedOptions,
    sortedTotals,
    sortedUsers,
    sortedUsersVotes,
    owner: room.owner,
    timestamp: Date.now(),
  }
}

export function aggregateQuadraticVote(room: Room): Result {
  const userVotes = room.votes

  if (room.config.type !== VoteType.Quadratic) {
    throw new Error('Vote type must be "quadratic"')
  }

  const totals: UserVoteResult = new Map<string, ItemResult>()
    userVotes.forEach(userVote => {
      if (userVote.vote.type === VoteType.Quadratic) {
        const vote = userVote.vote
        Object.entries(vote.votes).forEach(([option, voteCount]) => {
          // Add default value if it doesn't exist yet.
            if (!totals.has(option)) {
              totals.set(option, {totals: 0, users: [], users_vote: []})
            }
            const currEntry = totals.get(option)!
            currEntry.totals += voteCount
            // If the user's vote count is above 0, only then add their name and score to the option.
            if (voteCount > 0) { currEntry.users.push(userVote.username); currEntry.users_vote.push(voteCount) }
        })
    }});

    //Slice the results array to only be the length of the number of runner ups.
  const sorted = Array.from(totals.entries()).sort((a, b) => b[1].totals - a[1].totals)
  const sortedOptions = sorted.map(([option, _]) => option)
  const sortedTotals = sorted.map(([_, score]) => score.totals)
  const sortedUsers = sorted.map(([_, users]) => users.users)
  const sortedUsersVotes = sorted.map(([_, votes]) => votes.users_vote)

  return {
    sortedOptions,
    sortedTotals,
    sortedUsers,
    sortedUsersVotes,
    owner: room.owner,
    timestamp: Date.now(),
  }
}

export function aggregateRankVote(room: Room): Result {
  const userVotes = room.votes

  if (room.config.type !== VoteType.Rank) {
    throw new Error('Vote type must be "rank"')
  }

  const totals: UserVoteResult = new Map<string, ItemResult>()

  userVotes.forEach(userVote => {
    if (userVote.vote.type === VoteType.Rank) {
      const vote = userVote.vote
      const numOptions = Object.keys(vote.rankings).length

      // Properly weight the rankings (higher positions get more points)
      Object.entries(vote.rankings).forEach(([option, rank]) => {
        // Invert the rank so first place (rank 1) gets the most points
        const points = numOptions - rank + 1
        if (!totals.has(option)) {
          totals.set(option, {totals: 0, users: [], users_vote: []})
        }
        const currEntry = totals.get(option)!
        //Store the points from the inverted rank in totals
        currEntry.totals += points
        currEntry.users.push(userVote.username); 
        //Push the rank in the users votes field.
        currEntry.users_vote.push(rank)
      })
    }
  });

  const sorted = Array.from(totals.entries()).sort((a, b) => b[1].totals - a[1].totals)
  const sortedOptions = sorted.map(([option, _]) => option)
  const sortedTotals = sorted.map(([_, score]) => score.totals)
  const sortedUsers = sorted.map(([_, users]) => users.users)
  const sortedUsersVotes = sorted.map(([_, votes]) => votes.users_vote)

  return {
    sortedOptions,
    sortedTotals,
    sortedUsers,
    sortedUsersVotes,
    owner: room.owner,
    timestamp: Date.now(),
  }
}

export function aggregateTopChoicesVote(room: Room): Result {
  const userVotes = room.votes

  if (room.config.type !== VoteType.TopChoices) {
    throw new Error('Vote type must be "topChoices"')
  }

  const totals: UserVoteResult = new Map<string, ItemResult>()

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

          if (!totals.has(option)) {
            totals.set(option, {totals: 0, users: [], users_vote: []})
          }
            const currEntry = totals.get(option)!
            currEntry.totals += points;
            currEntry.users.push(userVote.username)
            //For the users vote, push the number of choices minus the points plus one, so it's an ordinal number ranking.
            currEntry.users_vote.push(numberOfChoices - points + 1)

        }
      })
    }
  });

  const sorted = Array.from(totals.entries()).sort((a, b) => b[1].totals - a[1].totals)
  const sortedOptions = sorted.map(([option, _]) => option)
  const sortedTotals = sorted.map(([_, score]) => score.totals)
  const sortedUsers = sorted.map(([_, users]) => users.users)
  const sortedUsersVotes = sorted.map(([_, votes]) => votes.users_vote)

  return {
    sortedOptions,
    sortedTotals,
    sortedUsers,
    sortedUsersVotes,
    owner: room.owner,
    timestamp: Date.now(),
  }
}
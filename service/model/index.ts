import { Vote, VoteConfig } from "./voteTypes";

export interface User {
  nickname: string | null;
  username: string;
  password: string;
  token: string;
}

export interface UserVote {
  username: string
  vote: Vote
}

export interface Room {
  code: string
  owner: string
  state: 'open' | 'closed'
  participants: string[]
  options: string[]
  votes: UserVote[]
  config: VoteConfig

  // ROUND STUFF
  currentRound?: number
  roundHistory?: {
    roundNumber: number
    options: string[]
    eliminatedOptions: string[]
    votes: UserVote[]
    sortedOptions?: string[]
    sortedTotals?: number[]
    timestamp: number
  }[]
}

export function generateRandomRoomCode(): string {
  const alpha = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'M', 'N', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z']
  const numeric = ['2', '3', '4', '5', '6', '7', '8', '9']
  const alphanumeric = alpha.concat(numeric)

  let code = ''
  const numChars = 4

  for (let i = 0; i < numChars; i++) {
    const rand = Math.floor(Math.random() * alphanumeric.length)
    code += alphanumeric[rand]
  }
  return code
}

export interface Result {
  owner: string
  sortedOptions: string[]
  sortedTotals: number[]
  sortedUsers: string[][]
  sortedUsersVotes: number[][]
  timestamp: number
}

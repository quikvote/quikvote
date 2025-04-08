import { Vote, VoteConfig, ResultDisplayType } from "./voteTypes";

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

export interface Option {
  text: string
  username: string
}

export interface Room {
  code: string
  owner: string
  state: 'open' | 'closed'
  participants: string[]
  options: Option[]  // Always an array of Option objects
  votes: UserVote[]
  config: VoteConfig
  resultId: string

  // ROUND STUFF
  currentRound?: number
  roundHistory?: {
    roundNumber: number
    eliminatedOptions: string[]
    result: Result
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

// User vote information
export interface UserVoteInfo {
  username: string
  nickname?: string | null
  votes: number
}

// Option result information
export interface OptionResult {
  name: string
  votes: number
  voters: UserVoteInfo[]
}

export interface Result {
  owner: string
  options: OptionResult[]
  timestamp: number
}

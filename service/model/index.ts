import { VoteConfig, Vote } from "./voteTypes"

export interface User {
  username: string
  nickname: string
  password: string
  token: string
  timestamp: number
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
  timestamp: number
}

export interface Result {
  owner: string
  winner: string
  details: Record<string, number>
  // room_id: string
  timestamp: number
}

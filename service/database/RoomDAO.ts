import { WithId } from "mongodb";
import { Room } from "../model";
import { Vote, VoteConfig } from "../model/voteTypes";

export interface RoomDAO {
  createRoom: (creatorUsername: string, config: VoteConfig) => Promise<WithId<Room>>,
  getRoomByCode: (roomCode: string) => Promise<WithId<Room> | null>,
  getRoomById: (roomId: string) => Promise<WithId<Room> | null>,
  addParticipantToRoom: (roomCode: string, username: string) => Promise<boolean>,
  addOptionToRoom: (roomId: string, option: string) => Promise<boolean>,
  removeOptionFromRoom: (roomId: string, option: string) => Promise<boolean>,
  submitUserVotes: (roomId: string, username: string, vote: Vote) => Promise<boolean>,
  removeUserVotes: (roomId: string, username: string) => Promise<void>,
  closeRoom: (roomId: string, resultId: string) => Promise<boolean>,
  deleteRoom: (roomId: string) => Promise<boolean>,

  // Multi-round voting methods
  completeRound: (roomId: string) => Promise<{ eliminatedOptions: string[], remainingOptions: string[], roundNumber: number } | null>,
  advanceToNextRound: (roomId: string, remainingOptions: string[]) => Promise<boolean>,
  getCurrentRound: (roomId: string) => Promise<number>,
  getRoundHistory: (roomId: string) => Promise<Room['roundHistory'] | undefined>
}

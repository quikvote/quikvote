import { WithId } from "mongodb";
import { Room } from "../model";

export interface RoomDAO {
    createRoom: (creatorUsername: string) => Promise<WithId<Room>>,
    getRoomByCode: (roomCode: string) => Promise<WithId<Room> | null>,
    getRoomById: (roomId: string) => Promise<WithId<Room> | null>,
    addParticipantToRoom: (roomCode: string, username: string) => Promise<boolean>,
    addOptionToRoom: (roomId: string, option: string) => Promise<boolean>,
    submitUserVotes: (roomId: string, username: string, votes: Record<string, number>) => Promise<boolean>,
    removeUserVotes: (roomId: string, username: string) => Promise<void>,
    closeRoom: (roomId: string) => Promise<boolean>,
    deleteRoom: (roomId: string) => Promise<boolean>
}

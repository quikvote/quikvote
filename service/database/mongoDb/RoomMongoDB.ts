import { Collection, Db, ObjectId, WithId } from 'mongodb';
import { RoomDAO } from '../RoomDAO';
import { generateRandomRoomCode, Room } from '../../model';

class RoomMongoDB implements RoomDAO {
    private roomsCollection: Collection<Room>;

    public constructor(db: Db) {
        this.roomsCollection = db.collection<Room>('room');
    }

    public async createRoom(creatorUsername: string): Promise<WithId<Room>> {
        const newRoom: Room = {
            code: generateRandomRoomCode(),
            owner: creatorUsername,
            participants: [creatorUsername],
            options: [],
            votes: [],
            state: 'open'
        }
        const result = await this.roomsCollection.insertOne(newRoom)

        return {
            ...newRoom,
            _id: result.insertedId
        }
    }

    public async getRoomByCode(roomCode: string): Promise<WithId<Room> | null> {
        return this.roomsCollection.findOne({ code: roomCode })
    }

    public async getRoomById(roomId: string): Promise<WithId<Room> | null> {
        return this.roomsCollection.findOne({ _id: new ObjectId(roomId) })
    }

    public async addParticipantToRoom(roomCode: string, username: string): Promise<boolean> {
        const result = await this.roomsCollection.updateOne(
            { code: roomCode, state: 'open' },
            {
                $addToSet: {
                    participants: username
                }
            }
        )
        return result.acknowledged && result.matchedCount === 1
    }

    public async addOptionToRoom(roomId: string, option: string): Promise<boolean> {
        const result = await this.roomsCollection.updateOne(
            { _id: new ObjectId(roomId), state: 'open' },
            {
                $addToSet: {
                    options: option
                }
            }
        )
        return result.acknowledged && result.matchedCount === 1
    }

    // TODO: Figure out what type votes is (probably need a new class).
    public async submitUserVotes(roomId: string, username: string, votes: any): Promise<boolean> {
        const result = await this.roomsCollection.updateOne(
            { _id: new ObjectId(roomId), "votes.username": { $ne: username } },
            {
                $push: {
                    votes: {
                        username,
                        votes
                    }
                }
            }
        )
        return result.acknowledged && result.matchedCount === 1
    }

    public async removeUserVotes(roomId: string, username: string): Promise<void> {
        await this.roomsCollection.updateOne(
            { _id: new ObjectId(roomId) },
            {
                $pull: {
                    votes: {
                        username
                    }
                }
            }
        )
    }

    public async closeRoom(roomId: string): Promise<boolean> {
        const result = await this.roomsCollection.updateOne(
            { _id: new ObjectId(roomId) },
            {
                $set: {
                    state: 'closed'
                }
            }
        )
        return result.acknowledged && result.matchedCount === 1
    }

    public async deleteRoom(roomId: string): Promise<boolean> {
        const result = await this.roomsCollection.deleteOne({ _id: new ObjectId(roomId) })
        return result.acknowledged && result.deletedCount == 1
    }
}

export default RoomMongoDB;

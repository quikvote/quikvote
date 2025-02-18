import { MongoClient, ObjectId } from 'mongodb';
import dbUrl from '../../dbconfig';
import { RoomDAO } from '../RoomDAO';

class RoomMongoDB implements RoomDAO {
    private client;
    private db;
    private roomsCollection;

    public constructor() {
        this.client = new MongoClient(dbUrl);
        this.db = this.client.db('quikvote');
        this.roomsCollection = this.db.collection('room');
    }

    // TODO: move this out of the DAO
    private generateRandomRoomCode(): string {
        const alpha = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'M', 'N', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z']
        const numeric = ['2', '3', '4', '5', '6', '7', '8', '9']
        const alphanumeric = alpha.concat(numeric)
      
        let code = ''
        let numChars = 4
      
        for (let i = 0; i < numChars; i++) {
          const rand = Math.floor(Math.random() * alphanumeric.length)
          code += alphanumeric[rand]
        }
        return code
    }

    public async createRoom(creatorUsername: string) {
        const newRoom = {
          code: this.generateRandomRoomCode(),
          owner: creatorUsername,
          participants: [creatorUsername],
          options: [],
          votes: [],
          state: 'open'
        }
        const result = await this.roomsCollection.insertOne(newRoom)
      
        return {
          ...newRoom,
          id: result.insertedId
        }
    }

    public async getRoomByCode(roomCode: string) {
        return await this.roomsCollection.findOne({ code: roomCode })
    }

    public async getRoomById(roomId: string) {
        return await this.roomsCollection.findOne(new ObjectId(roomId))
    }

    public async addParticipantToRoom(roomCode: string, username: string) {
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

    public async addOptionToRoom(roomId: string, option: string) {
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
    public async submitUserVotes(roomId: string, username: string, votes: any) {
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

    public async closeRoom(roomId: string) {
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

    public async deleteRoom(roomId: string) {
        const result = await this.roomsCollection.deleteOne(new ObjectId(roomId))
        return result.acknowledged && result.deletedCount == 1
    }
}

export default RoomMongoDB;
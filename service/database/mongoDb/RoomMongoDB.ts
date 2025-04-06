import { Collection, Db, ObjectId, WithId } from 'mongodb';
import { RoomDAO } from '../RoomDAO';
import { generateRandomRoomCode, Room } from '../../model';
import { Vote, VoteConfig, aggregationMap } from '../../model/voteTypes';

class RoomMongoDB implements RoomDAO {
  private roomsCollection: Collection<Room>;

  public constructor(db: Db) {
    this.roomsCollection = db.collection<Room>('room');
  }

  public async createRoom(creatorUsername: string, config: VoteConfig): Promise<WithId<Room>> {
    const newRoom: Room = {
      code: generateRandomRoomCode(),
      owner: creatorUsername,
      participants: [creatorUsername],
      options: [],
      votes: [],
      state: 'open',
      resultId: '',
      config
    }

    // Initialize multi-round properties if enabled
    if (config.options?.enableRound) {
      newRoom.currentRound = 1;
      newRoom.roundHistory = [];
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

  public async removeOptionFromRoom(roomId: string, option: string): Promise<boolean> {
    const result = await this.roomsCollection.updateOne(
      { _id: new ObjectId(roomId) },
      {
        $pull: { options: option }
      }
    )
    return result.acknowledged && result.matchedCount === 1;
  }

  public async submitUserVotes(roomId: string, username: string, vote: Vote): Promise<boolean> {
    const result = await this.roomsCollection.updateOne(
      { _id: new ObjectId(roomId), "votes.username": { $ne: username } },
      {
        $push: {
          votes: {
            username,
            vote
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

  public async closeRoom(roomId: string, resultId: string): Promise<boolean> {
    const result = await this.roomsCollection.updateOne(
      { _id: new ObjectId(roomId) },
      {
        $set: {
          state: 'closed',
          resultId
        }
      }
    )
    return result.acknowledged && result.matchedCount === 1
  }

  public async deleteRoom(roomId: string): Promise<boolean> {
    const result = await this.roomsCollection.deleteOne({ _id: new ObjectId(roomId) })
    return result.acknowledged && result.deletedCount == 1
  }

  /**
   * Completes the current round and prepares for the next one
   * Stores round results in the room's roundHistory
   */
  public async completeRound(roomId: string): Promise<{ eliminatedOptions: string[], remainingOptions: string[], roundNumber: number } | null> {
    // Get the current room state
    const room = await this.getRoomById(roomId);
    if (!room) return null;

    const currentRound = room.currentRound || 1;
    const eliminationCount = room.config.options?.eliminationCount || 1;

    // Calculate the current round results
    const aggregator = aggregationMap[room.config.type];
    const result = aggregator(room);

    // Ensure all options are included in the results, even those with zero votes
    const allOptions = room.options;
    const resultOptions = result.sortedOptions;
    const resultTotals = result.sortedTotals;

    // Find options missing from the results (those with zero votes)
    const missingOptions = allOptions.filter(opt => !resultOptions.includes(opt));

    // Include missing options in the results with zero votes
    const completeOptions = [...resultOptions, ...missingOptions];
    const completeTotals = [...resultTotals, ...missingOptions.map(() => 0)];

    // Determine which options to eliminate (from the bottom)
    const eliminatedOptions = completeOptions.slice(-eliminationCount);

    // Calculate remaining options for next round
    const remainingOptions = allOptions.filter(opt => !eliminatedOptions.includes(opt));

    // Save the detailed round data to history
    await this.roomsCollection.updateOne(
      { _id: room._id },
      {
        $push: {
          roundHistory: {
            roundNumber: currentRound,
            options: room.options,
            eliminatedOptions: eliminatedOptions,
            votes: room.votes,
            sortedOptions: completeOptions,
            sortedTotals: completeTotals,
            timestamp: Date.now()
          }
        }
      }
    );

    return {
      eliminatedOptions,
      remainingOptions,
      roundNumber: currentRound
    };
  }

  /**
   * Advances to the next round with the remaining options
   * Resets votes for the new round
   */
  public async advanceToNextRound(roomId: string, remainingOptions: string[]): Promise<boolean> {
    const room = await this.getRoomById(roomId);
    if (!room) return false;

    const newRoundNumber = (room.currentRound || 1) + 1;

    const result = await this.roomsCollection.updateOne(
      { _id: new ObjectId(roomId) },
      {
        $set: {
          currentRound: newRoundNumber,
          options: remainingOptions,
          votes: []
        }
      }
    );

    return result.acknowledged && result.matchedCount === 1;
  }

  /**
   * Gets the current round number for a room
   */
  public async getCurrentRound(roomId: string): Promise<number> {
    const room = await this.roomsCollection.findOne(
      { _id: new ObjectId(roomId) },
      { projection: { currentRound: 1 } }
    );
    return room?.currentRound || 1;
  }

  /**
   * Gets the history of all completed rounds
   */
  public async getRoundHistory(roomId: string): Promise<Room['roundHistory'] | undefined> {
    const room = await this.roomsCollection.findOne(
      { _id: new ObjectId(roomId) },
      { projection: { roundHistory: 1 } }
    );
    return room?.roundHistory;
  }
}

export default RoomMongoDB;

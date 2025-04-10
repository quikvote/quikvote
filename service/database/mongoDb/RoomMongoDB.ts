import { Collection, Db, ObjectId, WithId } from 'mongodb';
import { RoomDAO } from '../RoomDAO';
import { generateRandomRoomCode, Option, Room } from '../../model';
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
      options: [], // Empty array of Option objects
      votes: [],
      state: config.options?.enablePreliminaryRound ? 'preliminary' : 'open',
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

  public async getRoomByResultId(resultId: string): Promise<WithId<Room> | null> {
    return this.roomsCollection.findOne({ resultId })
  }

  public async addParticipantToRoom(roomCode: string, username: string): Promise<boolean> {
    const result = await this.roomsCollection.updateOne(
      { code: roomCode, state: { $in: ['open', 'preliminary'] } },
      {
        $addToSet: {
          participants: username
        }
      }
    )
    return result.acknowledged && result.matchedCount === 1
  }

  public async addOptionToRoom(roomId: string, option: string, creator?: string): Promise<boolean> {
    const room = await this.getRoomById(roomId);
    if (!room) return false;
    
    // Always use the Option format
    const updateQuery = {
      $push: {
        options: {
          text: option,
          username: creator || room.owner
        }
      }
    };
    
    const result = await this.roomsCollection.updateOne(
      { _id: new ObjectId(roomId), state: { $in: ['open', 'preliminary'] } },
      updateQuery
    );
    
    return result.acknowledged && result.matchedCount === 1;
  }

  public async removeOptionFromRoom(roomId: string, option: string): Promise<boolean> {
    const room = await this.getRoomById(roomId);
    if (!room) return false;
    
    // Always remove by text field with Option format
    const result = await this.roomsCollection.updateOne(
      { _id: new ObjectId(roomId), state: { $in: ['open', 'preliminary'] } },
      {
        $pull: { 
          options: { text: option }
        }
      }
    );
    
    return result.acknowledged && result.matchedCount === 1;
  }

  public async submitUserVotes(roomId: string, username: string, vote: Vote): Promise<boolean> {
    // First, verify the room is not in preliminary state
    const room = await this.getRoomById(roomId);
    if (!room || room.state === 'preliminary') {
      return false;
    }
    
    const result = await this.roomsCollection.updateOne(
      { 
        _id: new ObjectId(roomId), 
        state: 'open',  // Only allow voting in open rooms
        "votes.username": { $ne: username } 
      },
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
      { 
        _id: new ObjectId(roomId),
        state: { $in: ['open', 'preliminary'] } 
      },
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
   * Ends the preliminary round and changes the room state to 'open' to allow voting
   */
  public async endPreliminaryRound(roomId: string): Promise<boolean> {
    const result = await this.roomsCollection.updateOne(
      { _id: new ObjectId(roomId), state: 'preliminary' },
      {
        $set: {
          state: 'open'
        }
      }
    )
    return result.acknowledged && result.matchedCount === 1
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

    // Get all option names from the results
    const optionNames = result.options.map(opt => opt.name);
    
    // Determine which options to eliminate (from the bottom)
    const eliminatedOptions = result.options.slice(-eliminationCount).map(opt => opt.name);

    // Calculate remaining options for next round - extract just the text
    const remainingOptionsObjects = room.options.filter(opt => !eliminatedOptions.includes(opt.text));
    const remainingOptionTexts = remainingOptionsObjects.map(opt => opt.text);

    // Save the detailed round data to history
    await this.roomsCollection.updateOne(
      { _id: room._id },
      {
        $push: {
          roundHistory: {
            roundNumber: currentRound,
            eliminatedOptions: eliminatedOptions,
            result: result
          }
        }
      }
    );

    return {
      eliminatedOptions,
      remainingOptions: remainingOptionTexts,
      roundNumber: currentRound
    };
  }

  /**
   * Advances to the next round with the remaining options
   * Resets votes for the new round
   */
  public async advanceToNextRound(roomId: string, remainingOptions: Option[]): Promise<boolean> {
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

import { Collection, Db, ObjectId, WithId } from 'mongodb';
import { RoomDAO } from '../RoomDAO';
import { generateRandomRoomCode, Room, RoomOption } from '../../model';
import { Vote, VoteConfig, aggregationMap } from '../../model/voteTypes';

class RoomMongoDB implements RoomDAO {
  private roomsCollection: Collection<Room>;

  public constructor(db: Db) {
    this.roomsCollection = db.collection<Room>('room');
  }

  public async createRoom(creatorUsername: string, config: VoteConfig): Promise<WithId<Room>> {
    // Determine initial state based on preliminary round setting
    let initialState: 'open' | 'preliminary' = 'open';
    if (config.options?.preliminaryRound === true) {
      initialState = 'preliminary';
    }
    
    const newRoom: Room = {
      code: generateRandomRoomCode(),
      owner: creatorUsername,
      participants: [creatorUsername],
      options: [],
      votes: [],
      state: initialState,
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

  public async getRoomByOwner(ownerUsername: string): Promise<WithId<Room> | null> {
    // Get the most recent room created by this owner
    return this.roomsCollection.findOne({ owner: ownerUsername }, { sort: { _id: -1 } })
  }

  public async addParticipantToRoom(roomCode: string, username: string): Promise<boolean> {
    const result = await this.roomsCollection.updateOne(
        { 
          code: roomCode, 
          $or: [{ state: 'open' }, { state: 'preliminary' }] 
        },
        {
          $addToSet: {
            participants: username
          }
        }
    )
    return result.acknowledged && result.matchedCount === 1
  }

  /**
   * Add a participant as an option to the room
   * Uses their nickname if available, otherwise uses their username
   */
  public async addParticipantAsOption(roomId: string, username: string, nickname: string | null): Promise<boolean> {
    try {
      // First check if the room exists and is in a valid state
      const room = await this.getRoomById(roomId);
      if (!room) {
        console.warn(`Room ${roomId} not found`);
        return false;
      }
      
      if (room.state !== 'open' && room.state !== 'preliminary') {
        console.warn(`Room ${roomId} is in state ${room.state}, not accepting options`);
        return false;
      }

      // Create option with the user's nickname or username
      const optionText = nickname || username;
      
      // Check if this option already exists
      const optionExists = Array.isArray(room.options) && room.options.some(opt => {
        return opt.text.toLowerCase() === optionText.toLowerCase();
      });
      
      if (optionExists) {
        // Option already exists, nothing to do
        return true;
      }
      
      // Create the option object
      const option: RoomOption = {
        text: optionText,
        addedBy: username, 
        addedAt: new Date()
      };
      
      // Add the option to the room
      const result = await this.roomsCollection.updateOne(
        { _id: new ObjectId(roomId) },
        {
          $push: {
            options: option
          }
        }
      );
      
      return result.acknowledged && result.matchedCount === 1;
    } catch (error) {
      console.error(`Error adding participant as option to room ${roomId}:`, error);
      return false;
    }
  }

  public async addOptionToRoom(roomId: string, option: RoomOption): Promise<boolean> {
    try {
      // First check if the room exists and is in a valid state
      const room = await this.getRoomById(roomId);
      if (!room) {
        console.warn(`Room ${roomId} not found`);
        return false;
      }
      
      if (room.state !== 'open' && room.state !== 'preliminary') {
        console.warn(`Room ${roomId} is in state ${room.state}, not accepting options`);
        return false;
      }
      
      // Then add the option
      const result = await this.roomsCollection.updateOne(
          { _id: new ObjectId(roomId) },
          {
            $push: {
              options: option
            }
          }
      );
      return result.acknowledged && result.matchedCount === 1;
    } catch (error) {
      console.error(`Error adding option to room ${roomId}:`, error);
      return false;
    }
  }
  
  public async startVotingPhase(roomId: string): Promise<boolean> {
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

  /**
   * Completes the current round and prepares for the next one
   * Stores round results in the room's roundHistory
   */
  public async completeRound(roomId: string): Promise<{eliminatedOptions: string[], remainingOptions: string[], roundNumber: number} | null> {
    // Get the current room state
    const room = await this.getRoomById(roomId);
    if (!room) return null;

    const currentRound = room.currentRound || 1;
    const eliminationCount = room.config.options?.eliminationCount || 1;

    // Calculate the current round results
    const aggregator = aggregationMap[room.config.type];
    const result = aggregator(room);

    // Get option texts for easier processing
    const allOptionTexts = room.options.map(opt => opt.text);
    const resultOptions = result.sortedOptions;
    const resultTotals = result.sortedTotals;

    // Find options missing from the results (those with zero votes)
    const missingOptionTexts = allOptionTexts.filter(optText => !resultOptions.includes(optText));

    // Include missing options in the results with zero votes
    const completeOptions = [...resultOptions, ...missingOptionTexts];
    const completeTotals = [...resultTotals, ...missingOptionTexts.map(() => 0)];

    // Determine which options to eliminate (from the bottom)
    const eliminatedOptionTexts = completeOptions.slice(-eliminationCount);

    // Calculate remaining options for next round
    const remainingOptionTexts = allOptionTexts.filter(optText => 
      !eliminatedOptionTexts.includes(optText)
    );
    
    // Keep the original option objects for the remaining options
    const remainingOptions = room.options.filter(opt => 
      remainingOptionTexts.includes(opt.text)
    );

    // Save the detailed round data to history
    await this.roomsCollection.updateOne(
        { _id: room._id },
        {
          $push: {
            roundHistory: {
              roundNumber: currentRound,
              options: room.options,
              eliminatedOptions: eliminatedOptionTexts,
              votes: room.votes,
              sortedOptions: completeOptions,
              sortedTotals: completeTotals,
              timestamp: Date.now()
            }
          }
        }
    );

    return {
      eliminatedOptions: eliminatedOptionTexts,
      remainingOptions: remainingOptionTexts,
      roundNumber: currentRound
    };
  }

  /**
   * Advances to the next round with the remaining options
   * Resets votes for the new round
   */
  public async advanceToNextRound(roomId: string, remainingOptionTexts: string[]): Promise<boolean> {
    const room = await this.getRoomById(roomId);
    if (!room) return false;

    const newRoundNumber = (room.currentRound || 1) + 1;
    
    // Filter the original options array to keep only the remaining options
    const remainingOptions = room.options.filter(opt => 
      remainingOptionTexts.includes(opt.text)
    );

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
  
  /**
   * Gets all rooms (limit to recent ones for performance)
   */
  public async getAllRooms(): Promise<WithId<Room>[]> {
    // For now, return a limited number of the most recent rooms
    // In a production app, you'd want to add more sophisticated querying
    return this.roomsCollection.find({})
      .sort({ _id: -1 })
      .limit(100)
      .toArray();
  }
}

export default RoomMongoDB;
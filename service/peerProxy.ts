import { RawData, WebSocket, WebSocketServer } from 'ws';
import { UserDAO } from "./database/UserDAO";
import { RoomDAO } from "./database/RoomDAO";
import { HistoryDAO } from "./database/HistoryDAO";
import { DaoFactory } from "./factory/DaoFactory";
import { v4 as uuidv4 } from 'uuid';
import { IncomingMessage, Server } from 'http';
import internal from 'stream';
import { Result, Room, RoomOption, User } from './model';
import { aggregationMap, Vote } from './model/voteTypes';
import { WithId } from 'mongodb';

const authCookieName = 'token';

interface Connection {
  id: string
  alive: boolean
  ws: WebSocket
  user: string
}

interface WSEvent {
  type: 'new_option' | 'lock_in' | 'close_room' | 'unlock_vote' | 'start_voting' | 'start_next_round'
}

interface NewOptionEvent extends WSEvent {
  room: string
  option: string
}

interface LockInEvent extends WSEvent {
  room: string
  vote: Vote
}

interface UnlockVoteEvent extends WSEvent {
  room: string
}

interface CloseRoomEvent extends WSEvent {
  room: string
}

interface StartNextRoundEvent extends WSEvent {
  room: string
}

interface StartVotingEvent extends WSEvent {
  room: string
}

class PeerProxy {
  private userDAO: UserDAO;
  private roomDAO: RoomDAO;
  private historyDAO: HistoryDAO;

  public constructor(daoFactory: DaoFactory) {
    this.userDAO = daoFactory.userDAO();
    this.roomDAO = daoFactory.roomDAO();
    this.historyDAO = daoFactory.historyDAO();
  }

  public onSocketError(err: Error) {
    console.error(err)
  }

  public async authenticate(request: IncomingMessage, next: (err: string | undefined, arg1: User | undefined) => void) {
    const authToken = request.rawHeaders.find(h => h.startsWith(authCookieName))?.split('=')[1]
    if (!authToken) {
      next('Not Authorized', undefined)
      return
    }

    const user = await this.userDAO.getUserByToken(authToken);

    if (user) {
      next(undefined, user);
    } else {
      next('Not Authorized', undefined)
    }
  }

  public peerProxy(httpServer: Server) {
    const wss = new WebSocketServer({ noServer: true });

    httpServer.on('upgrade', (request: IncomingMessage, socket: internal.Duplex, head: Buffer) => {
      socket.on('error', this.onSocketError)

      this.authenticate(request, (err: string | undefined, user: User | undefined) => {
        if (err || !user) {
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          socket.destroy();
          return;
        }

        socket.removeListener('error', this.onSocketError);

        wss.handleUpgrade(request, socket, head, function done(ws: WebSocket) {
          wss.emit('connection', ws, request, user);
        });
      })
    });

    const connections: Connection[] = [];

    wss.on('connection', async (ws: WebSocket, _request: IncomingMessage, user: User) => {
      const connection: Connection = {id: uuidv4(), alive: true, ws: ws, user: user.username};
      connections.push(connection);

      // Notify all participants about the new connection if needed
      await this.notifyParticipantChange(connections, user.username);

      ws.on('message', async (data: RawData) => {
        const dataString = data.toString();
        const dataParsed = JSON.parse(dataString) as WSEvent;
        console.log(`Received ws message from ${connection.user}: ${JSON.stringify(dataParsed, undefined, 4)}`);
        if (dataParsed.type == 'new_option') {
          this.handleNewOption(JSON.parse(dataString) as NewOptionEvent, connection, connections);
        } else if (dataParsed.type == 'lock_in') {
          this.handleLockIn(JSON.parse(dataString) as LockInEvent, connection, connections);
        } else if (dataParsed.type == 'close_room') {
          this.handleCloseRoom(JSON.parse(dataString) as CloseRoomEvent, connection, connections);
        } else if (dataParsed.type == 'unlock_vote') {
          this.handleUnlockVote(JSON.parse(dataString) as UnlockVoteEvent, connection, connections);
        } else if (dataParsed.type == 'start_voting') {
          this.handleStartVoting(JSON.parse(dataString) as StartVotingEvent, connection, connections);
        } else if (dataParsed.type == 'start_next_round') {
          this.handleStartNextRound(JSON.parse(dataString) as StartNextRoundEvent, connection, connections);
        }
      });


      ws.on('close', () => {
        const pos = connections.findIndex(c => c.id === connection.id);

        if (pos >= 0) {
          connections.splice(pos, 1);

          // Notify remaining participants that someone left
          this.notifyParticipantChange(connections, connection.user, true);
        }
      });

      ws.on('pong', () => {
        connection.alive = true;
      });
    });

    setInterval(() => {
      connections.forEach(c => {
        if (!c.alive) {
          c.ws.terminate();
        } else {
          c.alive = false;
          c.ws.ping();
        }
      });
    }, 10000);
  }

  public async handleNewOption(event: NewOptionEvent, connection: Connection, connections: Connection[]) {
    const room = await this.roomDAO.getRoomById(event.room);

    if (!room) {
      console.warn(`no room with id ${event.room}`)
      return
    }
    // Allow adding options in both 'open' and 'preliminary' states
    if (room.state !== 'open' && room.state !== 'preliminary') {
      console.warn('room is closed')
      return
    }
    if (!room.participants.includes(connection.user)) {
      console.warn(`room does not include user ${connection.user}`)
      return
    }

    // Check option adding mode restrictions
    const optionAddingMode = room.config.options?.optionAddingMode || 'everyone';
    
    // Only owner can add options
    if (optionAddingMode === 'owner_only' && room.owner !== connection.user) {
      console.warn(`Option adding mode is owner-only and user ${connection.user} is not the owner`);
      connection.ws.send(JSON.stringify({ 
        type: 'error', 
        message: 'Only the room owner can add options' 
      }));
      return;
    }
    
    // Check if preliminary round is enabled
    const preliminaryRoundEnabled = room.config.options?.preliminaryRound === true;
    
    // If preliminary round is enabled but we're not in preliminary state,
    // only allow adding options during the preliminary phase
    if (preliminaryRoundEnabled && room.state !== 'preliminary') {
      console.warn(`Room has preliminary round enabled but voting has already started`);
      connection.ws.send(JSON.stringify({ 
        type: 'error', 
        message: 'Cannot add options after voting has started in preliminary mode' 
      }));
      return;
    }
    
    // Check limited per user option
    if (optionAddingMode === 'limited_per_user') {
      const maxOptionsPerUser = room.config.options?.optionsPerUser || 3;
      
      // Count how many options this user has already added
      const userOptions = room.options.filter(opt => 
        typeof opt === 'object' && opt && 'addedBy' in opt && opt.addedBy === connection.user
      ).length;
      
      if (userOptions >= maxOptionsPerUser) {
        console.warn(`User ${connection.user} has reached their option limit of ${maxOptionsPerUser}`);
        connection.ws.send(JSON.stringify({ 
          type: 'error', 
          message: `You can only add up to ${maxOptionsPerUser} options` 
        }));
        return;
      }
    }

    const newOptionText = event.option;
    
    // Check if option text already exists in the room
    try {
      // Handle the case where options might be strings in old data
      const optionExists = Array.isArray(room.options) && room.options.some(opt => {
          return opt.text.toLowerCase() === newOptionText.toLowerCase();
      });
      
      if (optionExists) {
        console.warn('room already includes option');
        connection.ws.send(JSON.stringify({ 
          type: 'error', 
          message: 'This option already exists' 
        }));
        return;
      }
    } catch (error) {
      console.error('Error checking existing options:', error);
      connection.ws.send(JSON.stringify({ 
        type: 'error', 
        message: 'Error checking options' 
      }));
      return;
    }

    // Create a proper RoomOption object
    const optionWithMetadata: RoomOption = {
      text: newOptionText,
      addedBy: connection.user,
      addedAt: new Date()
    };

    try {
      const added = await this.roomDAO.addOptionToRoom(event.room, optionWithMetadata);
      if (added) {
        // Get updated room with the new option
        const updatedRoom = await this.roomDAO.getRoomById(event.room);
        if (updatedRoom && Array.isArray(updatedRoom.options)) {
          // First send an acknowledgment to the client who added the option
          connection.ws.send(JSON.stringify({ 
            type: 'option_added',
            option: {
              text: optionWithMetadata.text,
              addedBy: optionWithMetadata.addedBy,
              addedAt: optionWithMetadata.addedAt
            },
            success: true
          }));
          
          connections.filter(c => room.participants.includes(c.user)).forEach(c => {
            c.ws.send(JSON.stringify({ 
              type: 'option_added',
              options: updatedRoom.options
            }));
          });
        } else {
          console.warn('Failed to retrieve updated room after adding option');
          connection.ws.send(JSON.stringify({ 
            type: 'option_added',
            option: {
              text: optionWithMetadata.text,
              addedBy: optionWithMetadata.addedBy,
              addedAt: optionWithMetadata.addedAt
            },
            success: false,
            message: 'Option was added but failed to refresh options list'
          }));
        }
      } else {
        console.warn('Failed to add option to room');
        connection.ws.send(JSON.stringify({ 
          type: 'option_added',
          option: optionWithMetadata,
          success: false,
          message: 'Could not add option to room'
        }));
      }
    } catch (error) {
      console.error('Error handling option addition:', error);
      connection.ws.send(JSON.stringify({ 
        type: 'error',
        message: 'Server error while adding option'
      }));
    }
  }

  public async handleLockIn(event: LockInEvent, connection: Connection, connections: Connection[]) {
    const user = connection.user
    const roomId = event.room
    const room = await this.roomDAO.getRoomById(roomId);

    if (!room) {
      console.warn(`no room with id ${event.room}`)
      return
    }

    if (room.state !== 'open') {
      console.warn('room is closed')
      return
    }

    if (!room.participants.includes(user)) {
      console.warn(`room does not include user ${connection.user}`)
      return
    }

    await this.roomDAO.submitUserVotes(roomId, user, event.vote);
    const new_room = await this.roomDAO.getRoomById(roomId);

    if (!new_room) {
      console.warn(`something went wrong. there was a room and now there isn't. roomId: ${roomId}`)
      return
    }

    // Check if multi-round voting is enabled
    const enableMultiRound = new_room.config.options?.enableRound || false;
    const autoAdvance = new_room.config.options?.autoAdvance || false;
    const currentRound = new_room.currentRound || 1;
    const maxRounds = new_room.config.options?.maxRounds || 1;

    if (new_room.votes.length == new_room.participants.length) {
      // All users have voted

      if (enableMultiRound && currentRound < maxRounds) {
        // This is a multi-round vote and we're not in the final round
        const roundResult = await this.roomDAO.completeRound(roomId);

        if (!roundResult) {
          console.warn(`Failed to process round results for roomId: ${roomId}`);
          return;
        }

        // Get the updated room with the new round history
        const updatedRoom = await this.roomDAO.getRoomById(roomId);
        if (!updatedRoom || !updatedRoom.roundHistory || updatedRoom.roundHistory.length === 0) {
          console.warn(`Failed to get round history for roomId: ${roomId}`);
          return;
        }

        const latestRound = updatedRoom.roundHistory[updatedRoom.roundHistory.length - 1];

        // If auto-advance is enabled, immediately start the next round
        if (autoAdvance) {
          await this.roomDAO.advanceToNextRound(roomId, roundResult.remainingOptions);

          // Notify all participants about the new round
          connections.filter(c => updatedRoom.participants.includes(c.user)).forEach(c => {
            c.ws.send(JSON.stringify({
              type: 'next_round_started',
              roundNumber: currentRound + 1,
              remainingOptions: roundResult.remainingOptions,
              eliminatedOptions: roundResult.eliminatedOptions,
              roundResults: {
                sortedOptions: latestRound.sortedOptions,
                sortedTotals: latestRound.sortedTotals
              }
            }));
          });
        } else {
          // Otherwise, notify the room about the round completion and wait for manual advancement
          connections.filter(c => updatedRoom.participants.includes(c.user)).forEach(c => {
            c.ws.send(JSON.stringify({
              type: 'round_completed',
              roundNumber: currentRound,
              eliminatedOptions: roundResult.eliminatedOptions,
              roundResults: {
                sortedOptions: latestRound.sortedOptions,
                sortedTotals: latestRound.sortedTotals
              }
            }));
          });
        }
      } else {
        // This is either a single-round vote or the final round of a multi-round vote
        const result = await this.closeRoom(new_room);

        connections.filter(c => new_room.participants.includes(c.user)).forEach(c => {
          c.ws.send(JSON.stringify({
            type: 'results-available',
            id: result._id,
            isFinalResult: true
          }));
        });
      }
    }
  }

  public async handleUnlockVote(event: UnlockVoteEvent, connection: Connection, connections: Connection[]) {
    const user = connection.user;
    const roomId = event.room;
    const room = await this.roomDAO.getRoomById(roomId);

    if (!room) {
      console.warn(`no room with id ${event.room}`);
      return;
    }

    if (room.state !== 'open') {
      console.warn('room is already closed');
      return;
    }

    if (!room.participants.includes(user)) {
      console.warn(`room does not include user ${user}`);
      return;
    }

    // Remove the user's votes
    await this.roomDAO.removeUserVotes(roomId, user);

    // Get the updated room state
    const updatedRoom = await this.roomDAO.getRoomById(roomId);

    if (!updatedRoom) {
      console.warn(`something went wrong. room disappeared after unlocking votes. roomId: ${roomId}`);
      return;
    }

    connection.ws.send(JSON.stringify({
      type: 'votes_unlocked',
      room: roomId
    }));
  }

  public async handleCloseRoom(event: CloseRoomEvent, connection: Connection, connections: Connection[]) {
    const user = connection.user
    const roomId = event.room;
    const room = await this.roomDAO.getRoomById(roomId);

    if (!room) {
      console.warn(`no room with id ${event.room}`)
      return
    }

    if (room.state !== 'open') {
      console.warn('room is closed')
      return
    }

    if (room.owner !== user) {
      console.warn('user is not owner of room')
      return
    }

    const result = await this.closeRoom(room)

    connections.filter(c => room.participants.includes(c.user)).forEach(c => {
      c.ws.send(JSON.stringify({
        type: 'results-available',
        id: result._id,
        isFinalResult: true
      }));
    });
  }
  
  public async handleStartVoting(event: StartVotingEvent, connection: Connection, connections: Connection[]) {
    const user = connection.user;
    const roomId = event.room;
    const room = await this.roomDAO.getRoomById(roomId);

    if (!room) {
      console.warn(`no room with id ${event.room}`);
      return;
    }

    if (room.state !== 'preliminary') {
      console.warn('room is not in preliminary state');
      connection.ws.send(JSON.stringify({ 
        type: 'error', 
        message: 'Room is not in option adding phase' 
      }));
      return;
    }

    if (room.owner !== user) {
      console.warn('user is not owner of room');
      connection.ws.send(JSON.stringify({ 
        type: 'error', 
        message: 'Only the room owner can start voting' 
      }));
      return;
    }

    const success = await this.roomDAO.startVotingPhase(roomId);
    
    if (success) {
      // Get updated room with 'open' state
      const updatedRoom = await this.roomDAO.getRoomById(roomId);
      if (!updatedRoom) {
        console.warn('Failed to get updated room after starting voting phase');
        return;
      }
      
      connections.filter(c => room.participants.includes(c.user)).forEach(c => {
        c.ws.send(JSON.stringify({ 
          type: 'voting_started',
          message: 'Voting has started. No new options can be added.',
          roomState: 'open',
          isOwner: updatedRoom.owner === c.user,
          options: updatedRoom.options
        }));
      });
    }
  }

  public async handleStartNextRound(event: StartNextRoundEvent, connection: Connection, connections: Connection[]) {
    const user = connection.user;
    const roomId = event.room;
    const room = await this.roomDAO.getRoomById(roomId);

    if (!room) {
      console.warn(`no room with id ${event.room}`);
      return;
    }

    if (room.state !== 'open') {
      console.warn('room is closed');
      return;
    }

    if (room.owner !== user) {
      console.warn('user is not owner of room');
      return;
    }

    // Get the latest round history
    if (!room.roundHistory || room.roundHistory.length === 0) {
      console.warn('no round history found to start next round');
      return;
    }

    const latestRound = room.roundHistory[room.roundHistory.length - 1];
    const currentOptionTexts = room.options.map(opt => opt.text);
    const eliminatedOptionTexts = latestRound.eliminatedOptions;

    // Calculate remaining options
    const remainingOptionTexts = currentOptionTexts.filter(
      optText => !eliminatedOptionTexts.includes(optText)
    );

    // Advance to the next round
    await this.roomDAO.advanceToNextRound(roomId, remainingOptionTexts);

    // Notify all participants about the new round
    connections.filter(c => room.participants.includes(c.user)).forEach(c => {
      c.ws.send(JSON.stringify({
        type: 'next_round_started',
        roundNumber: (room.currentRound || 1) + 1,
        remainingOptions: remainingOptionTexts,
        eliminatedOptions: eliminatedOptionTexts,
        roundResults: {
          sortedOptions: latestRound.sortedOptions,
          sortedTotals: latestRound.sortedTotals
        }
      }));
    });
  }

  private async closeRoom(room: WithId<Room>): Promise<WithId<Result>> {
    await this.roomDAO.closeRoom(room._id.toHexString());

    const aggregator = aggregationMap[room.config.type]
    const result = aggregator(room)
    return await this.historyDAO.createResult(result.owner, result.sortedOptions, result.sortedTotals);
  }
  
  // Notify participants about changes in participant list
  private async notifyParticipantChange(connections: Connection[], username: string, isLeaving: boolean = false) {
    // Find all rooms that the user is in
    const rooms = await this.findRoomsForUser(username);
    
    // For each room, notify other participants
    for (const room of rooms) {
      // Get user details including nickname
      const userInfo = await this.userDAO.getUser(username);
      
      // If user is leaving, remove them from the participants list for notification
      let participants = [...room.participants];
      if (isLeaving) {
        participants = participants.filter(p => p !== username);
      }
      
      // Get detailed participant info including nicknames
      const participantDetails = await Promise.all(
        participants.map(async (participantUsername) => {
          const participantInfo = await this.userDAO.getUser(participantUsername);
          return {
            username: participantUsername,
            nickname: participantInfo?.nickname || null,
            isOwner: participantUsername === room.owner
          };
        })
      );
      
      // Notify all connected participants in this room
      const roomConnections = connections.filter(c => room.participants.includes(c.user));
      
      // Add participant as option if that feature is enabled
      if (!isLeaving && room.config?.options?.addParticipantsAsOptions) {
        // Check if the participant is already an option
        const optionExists = room.options.some(opt =>
          (typeof opt === 'object' && opt.text === (userInfo?.nickname || username))
        );
        
        console.log(`Checking if participant ${username} (${userInfo?.nickname || 'no nickname'}) exists as option: ${optionExists ? 'YES' : 'NO'}`);
        console.log(`Room has ${roomConnections.length} active connections`);
        
        if (!optionExists) {
          // Add the participant as an option
          await this.roomDAO.addParticipantAsOption(room._id.toString(), username, userInfo?.nickname || null);
          
          // Get the updated room with new options
          const updatedRoom = await this.roomDAO.getRoomById(room._id.toString());
          if (updatedRoom) {
            console.log(`Broadcasting options update for room ${room._id} to ${roomConnections.length} connections`);
            
            // Send updated options to all participants
            roomConnections.forEach(c => {
              console.log(`Sending option_added event to participant: ${c.user}`);
              c.ws.send(JSON.stringify({
                type: 'option_added',
                options: updatedRoom.options,
                message: `${userInfo?.nickname || username} was added as an option`
              }));
            });
          }
        }
      }
      
      // Send participant updates only if showParticipants is enabled
      if (room.config?.options?.showParticipants) {
        roomConnections.forEach(c => {
          c.ws.send(JSON.stringify({
            type: isLeaving ? 'participant_left' : 'participant_joined',
            username: username,
            nickname: userInfo?.nickname || null,
            participants: participantDetails
          }));
        });
      }
    }
  }
  
  // Helper method to find all rooms a user is in
  private async findRoomsForUser(username: string): Promise<WithId<Room>[]> {
    const allRooms = await this.roomDAO.getAllRooms();
    return allRooms.filter(room => 
      room.participants.includes(username) && 
      (room.state === 'open' || room.state === 'preliminary')
    );
  }
}

export default PeerProxy;
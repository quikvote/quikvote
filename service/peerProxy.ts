import { RawData, WebSocket, WebSocketServer } from 'ws';
import { UserDAO } from "./database/UserDAO";
import { RoomDAO } from "./database/RoomDAO";
import { HistoryDAO } from "./database/HistoryDAO";
import { DaoFactory } from "./factory/DaoFactory";
import { v4 as uuidv4 } from 'uuid';
import { IncomingMessage, Server } from 'http';
import internal from 'stream';
import { Result, Room, User } from './model';
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
  type: 'new_option' | 'remove_option' | 'lock_in' | 'close_room' | 'unlock_vote' | 'start_next_round'
}

interface OptionEvent extends WSEvent {
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

    wss.on('connection', (ws: WebSocket, _request: IncomingMessage, user: User) => {
      const connection: Connection = { id: uuidv4(), alive: true, ws: ws, user: user.username };
      connections.push(connection);

      ws.on('message', async (data: RawData) => {
        const dataString = data.toString();
        const dataParsed = JSON.parse(dataString) as WSEvent;
        console.log(`Received ws message from ${connection.user}: ${JSON.stringify(dataParsed, undefined, 4)}`);
        if (dataParsed.type == 'new_option') {
          this.handleNewOption(JSON.parse(dataString) as OptionEvent, connection, connections);
        } else if (dataParsed.type == 'remove_option') {
          this.handleRemoveOption(JSON.parse(dataString) as OptionEvent, connection, connections);
        } else if (dataParsed.type == 'lock_in') {
          this.handleLockIn(JSON.parse(dataString) as LockInEvent, connection, connections);
        } else if (dataParsed.type == 'close_room') {
          this.handleCloseRoom(JSON.parse(dataString) as CloseRoomEvent, connection, connections);
        } else if (dataParsed.type == 'unlock_vote') {
          this.handleUnlockVote(JSON.parse(dataString) as UnlockVoteEvent, connection, connections);
        } else if (dataParsed.type == 'start_next_round') {
          this.handleStartNextRound(JSON.parse(dataString) as StartNextRoundEvent, connection, connections);
        }
      });


      ws.on('close', () => {
        const pos = connections.findIndex(c => c.id === connection.id);

        if (pos >= 0) {
          connections.splice(pos, 1);
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

  public async handleNewOption(event: OptionEvent, connection: Connection, connections: Connection[]) {
    const room = await this.roomDAO.getRoomById(event.room);

    if (!room) {
      console.warn(`no room with id ${event.room}`)
      return
    }
    if (room.state !== 'open') {
      console.warn('room is closed')
      return
    }
    if (!room.participants.includes(connection.user)) {
      console.warn(`room does not include user ${connection.user}`)
      return
    }
    if (!room.config.options.allowNewOptions && room.owner !== connection.user) {
      console.warn(`user is not room owner`);
      return
    }

    const newOption = event.option
    if (room.options.map(opt => opt.toLowerCase()).includes(newOption.toLowerCase())) {
      console.warn('room already includes option')
      return
    }

    if (await this.roomDAO.addOptionToRoom(event.room, newOption)) {
      connections.filter(c => room.participants.includes(c.user)).forEach(c => {
        c.ws.send(JSON.stringify({ type: 'options', options: [...room.options, newOption] }));
      });
    }
  }

  public async handleRemoveOption(event: OptionEvent, connection: Connection, connections: Connection[]) {
    let room = await this.roomDAO.getRoomById(event.room);

    if (!room) {
      console.warn(`no room with id ${event.room}`)
      return
    }
    if (room.state !== 'open') {
      console.warn('room is closed')
      return
    }
    if (!room.participants.includes(connection.user)) {
      console.warn(`room does not include user ${connection.user}`)
      return
    }

    if (room.owner !== connection.user) {
      console.warn('user is not owner of room')
      return
    }

    const option = event.option
    if (!room.options.map(opt => opt).includes(option)) {
      console.warn('room does not include this option')
      return
    }

    if (await this.roomDAO.removeOptionFromRoom(event.room, option)) {
      // Grab the updated room
      room = await this.roomDAO.getRoomById(event.room);

      // Check if the room was deleted before the updated room was retrieved.
      if (!room) {
        console.warn(`no room with id ${event.room}`);
        return;
      }

      connections.filter(c => room!.participants.includes(c.user)).forEach(c => {
        c.ws.send(JSON.stringify({ type: 'options', options: [...room!.options] }));
      });
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
    const currentOptions = room.options;
    const eliminatedOptions = latestRound.eliminatedOptions;

    // Calculate remaining options
    const remainingOptions = currentOptions.filter(opt => !eliminatedOptions.includes(opt));

    // Advance to the next round
    await this.roomDAO.advanceToNextRound(roomId, remainingOptions);

    // Notify all participants about the new round
    connections.filter(c => room.participants.includes(c.user)).forEach(c => {
      c.ws.send(JSON.stringify({
        type: 'next_round_started',
        roundNumber: (room.currentRound || 1) + 1,
        remainingOptions: remainingOptions,
        eliminatedOptions: eliminatedOptions,
        roundResults: {
          sortedOptions: latestRound.sortedOptions,
          sortedTotals: latestRound.sortedTotals
        }
      }));
    });
  }

  private async closeRoom(room: WithId<Room>): Promise<WithId<Result>> {
    const aggregator = aggregationMap[room.config.type]
    const result = aggregator(room)
    const storedResult = await this.historyDAO.createResult(result.owner, result.sortedOptions, result.sortedTotals, result.sortedUsers, result.sortedUsersVotes);

    await this.roomDAO.closeRoom(room._id.toHexString(), storedResult._id.toHexString());
    return storedResult
  }
}

export default PeerProxy;

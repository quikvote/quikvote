import { RawData, WebSocket, WebSocketServer } from 'ws';
import { UserDAO } from "./database/UserDAO";
import { RoomDAO } from "./database/RoomDAO";
import { HistoryDAO } from "./database/HistoryDAO";
import { DaoFactory } from "./factory/DaoFactory";
import { v4 as uuidv4 } from 'uuid';
import { IncomingMessage, Server } from 'http';
import internal from 'stream';
import { aggregationMap, Vote } from './model/voteTypes';
import { Result, Room, User } from './model';
import { WithId } from 'mongodb';

const authCookieName = 'token';

interface Connection {
    id: string
    alive: boolean
    ws: WebSocket
    user: string
}

interface WSEvent {
    type: 'new_option' | 'lock_in' | 'unlock' | 'close_room'
}

interface NewOptionEvent extends WSEvent {
    roomId: string
    option: string
}

interface LockInEvent extends WSEvent {
    roomId: string
    votes: Vote
}

interface UnlockEvent extends WSEvent {
    roomId: string
}

interface CloseRoomEvent extends WSEvent {
    roomId: string
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

        let connections: Connection[] = [];

        wss.on('connection', (ws: WebSocket, _request: IncomingMessage, user: User) => {
            const connection: Connection = { id: uuidv4(), alive: true, ws: ws, user: user.username };
            connections.push(connection);

            ws.on('message', async (data: RawData) => {
                const dataString = data.toString()
                const dataParsed = JSON.parse(dataString) as WSEvent
                console.debug(`Recieved ws message from ${connection.user}: ${JSON.stringify(dataParsed, undefined, 4)}`)
                if (dataParsed.type == 'new_option') {
                    this.handleNewOption(JSON.parse(dataString) as NewOptionEvent, connection, connections)
                } else if (dataParsed.type == 'lock_in') {
                    this.handleLockIn(JSON.parse(dataString) as LockInEvent, connection, connections)
                } else if (dataParsed.type == 'unlock') {
                    this.handleUnlock(JSON.parse(dataString) as UnlockEvent, connection)
                } else if (dataParsed.type == 'close_room') {
                    this.handleCloseRoom(JSON.parse(dataString) as CloseRoomEvent, connection, connections)
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

    private async handleNewOption(event: NewOptionEvent, connection: Connection, connections: Connection[]) {
        const room = await this.roomDAO.getRoomById(event.roomId);

        if (!room) {
            console.warn(`no room with id ${event.roomId}`)
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

        const newOption = event.option
        if (room.options.map(opt => opt.toLowerCase()).includes(newOption.toLowerCase())) {
            console.warn('room already includes option')
            return
        }

        if (await this.roomDAO.addOptionToRoom(event.roomId, newOption)) {
            connections.filter(c => room.participants.includes(c.user)).forEach(c => {
                c.ws.send(JSON.stringify({ type: 'options', options: [...room.options, newOption] }));
            });
        }
    }

    private async handleLockIn(event: LockInEvent, connection: Connection, connections: Connection[]) {
        const user = connection.user
        const roomId = event.roomId
        const room = await this.roomDAO.getRoomById(roomId);

        if (!room) {
            console.warn(`no room with id ${event.roomId}`)
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

        await this.roomDAO.submitUserVotes(roomId, user, event.votes);
        const new_room = await this.roomDAO.getRoomById(roomId);

        if (!new_room) {
            console.warn(`something went wrong. there was a room and now there isn't. roomId: ${roomId}`)
            return
        }

        if (new_room.votes.length == new_room.participants.length) {
            // all users have voted
            const result = await this.closeRoom(new_room)

            connections.filter(c => new_room.participants.includes(c.user)).forEach(c => {
                c.ws.send(JSON.stringify({ type: 'results-available', id: result._id }));
            });
        }
    }

    private async handleUnlock(event: UnlockEvent, connection: Connection) {
        const user = connection.user
        const roomId = event.roomId
        const room = await this.roomDAO.getRoomById(roomId)

        if (!room) {
            console.warn(`no room with id ${event.roomId}`)
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

        await this.roomDAO.removeUserVotes(roomId, user)
    }

    private async handleCloseRoom(event: CloseRoomEvent, connection: Connection, connections: Connection[]) {
        const user = connection.user
        const roomId = event.roomId;
        const room = await this.roomDAO.getRoomById(roomId);

        if (!room) {
            console.warn(`no room with id ${event.roomId}`)
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
            c.ws.send(JSON.stringify({ type: 'results-available', id: result._id }));
        });
    }

    private async closeRoom(room: WithId<Room>): Promise<WithId<Result>> {
        await this.roomDAO.closeRoom(room._id.toHexString());

        const aggregator = aggregationMap[room.config.type]
        const result = aggregator(room)
        return await this.historyDAO.createResult(result);
    }
}

export default PeerProxy;

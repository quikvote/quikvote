import HistoryMongoDB from "./database/mongoDb/HistoryMongoDB";
import RoomMongoDB from "./database/mongoDb/RoomMongoDB";
import UserMongoDb from "./database/mongoDb/UserMongoDB";
const { WebSocketServer } = require('ws');
import calculateVoteResult from "./calculateVoteResult";
const uuid = require('uuid');

const authCookieName = 'token';

class PeerProxy {
    public onSocketError(err: any) {
        console.error(err)
    }

    public async authenticate(request: any, next: any) {
        const authToken = request.rawHeaders.find((h: any) => h.startsWith(authCookieName))?.split('=')[1]
        const userDAO = new UserMongoDb();
        const user = await userDAO.getUserByToken(authToken);
        // const user = await DB.getUserByToken(authToken);
        if (user) {
            next(undefined, user);
        } else {
            next('Not Authorized', undefined)
        }
    }

    public peerProxy(httpServer: any) {
        const wss = new WebSocketServer({ noServer: true });

        httpServer.on('upgrade', (request: any, socket: any, head: any) => {
            socket.on('error', this.onSocketError)

            this.authenticate(request, (err: any, user: any) => {
                if (err || !user) {
                    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
                    socket.destroy();
                    return;
                }

                socket.removeListener('error', this.onSocketError);

                wss.handleUpgrade(request, socket, head, function done(ws: any) {
                    wss.emit('connection', ws, request, user);
                });
            })
        });

        let connections: any = [];

        wss.on('connection', (ws: any, _request: any, user: any) => {
            const connection = { id: uuid.v4(), alive: true, ws: ws, user: user.username };
            connections.push(connection);

            ws.on('message', async (data: any) => {
                const dataParsed = JSON.parse(data)
                console.log(`Recieved ws message from ${connection.user}: ${JSON.stringify(dataParsed, undefined, 4)}`)
                if (dataParsed.type == 'new_option') {
                    this.handleNewOption(dataParsed, connection, connections)
                } else if (dataParsed.type == 'lock_in') {
                    this.handleLockIn(dataParsed, connection, connections)
                } else if (dataParsed.type == 'close_room') {
                    this.handleCloseRoom(dataParsed, connection, connections)
                }
            });

            ws.on('close', () => {
                const pos = connections.findIndex((o: any, i: any) => o.id === connection.id);

                if (pos >= 0) {
                    connections.splice(pos, 1);
                }
            });

            ws.on('pong', () => {
                connection.alive = true;
            });
        });

        setInterval(() => {
            connections.forEach((c: any) => {
                if (!c.alive) {
                    c.ws.terminate();
                } else {
                    c.alive = false;
                    c.ws.ping();
                }
            });
        }, 10000);
    }

    public async handleNewOption(event: any, connection: any, connections: any) {
        const roomDAO = new RoomMongoDB();
        const room = await roomDAO.getRoomById(event.room);
        // const room = await DB.getRoomById(event.room)
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

        const newOption = event.option
        if (room.options.map((opt: any) => opt.toLowerCase()).includes(newOption.toLowerCase())) {
            console.warn('room already includes option')
            return
        }

        if (await roomDAO.addOptionToRoom(event.room, newOption)) {
            connections.filter((c: any) => room.participants.includes(c.user)).forEach((c: any) => {
                c.ws.send(JSON.stringify({ type: 'options', options: [...room.options, newOption] }));
            });
        }
    }

    public async handleLockIn(event: any, connection: any, connections: any) {
        const user = connection.user
        const roomId = event.room
        const roomDAO = new RoomMongoDB();
        const room = await roomDAO.getRoomById(roomId);
        // const room = await DB.getRoomById(roomId)

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

        await roomDAO.submitUserVotes(roomId, user, event.votes);
        // await DB.submitUserVotes(roomId, user, event.votes)

        const new_room = await roomDAO.getRoomById(roomId);
        // const new_room = await DB.getRoomById(roomId)
        if (new_room!.votes.length == new_room!.participants.length) {
            // all users have voted
            await roomDAO.closeRoom(roomId);
            // await DB.closeRoom(roomId)

            const sortedOptions = calculateVoteResult(new_room!.votes)
            const historyDAO = new HistoryMongoDB();
            const result = await historyDAO.createResult(user, sortedOptions);
            // const result = await DB.createResult(user, sortedOptions)
            connections.filter((c: any) => new_room!.participants.includes(c.user)).forEach((c: any) => {
                c.ws.send(JSON.stringify({ type: 'results-available', id: result._id }));
            });
        }
    }

    public async handleCloseRoom(event: any, connection: any, connections: any) {
        const user = connection.user
        const roomId = event.room
        const roomDAO = new RoomMongoDB();
        const room = await roomDAO.getRoomById(roomId);
        // const room = await DB.getRoomById(roomId)

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

        await roomDAO.closeRoom(roomId);
        // await DB.closeRoom(roomId)

        const sortedOptions = calculateVoteResult(room.votes)
        const historyDAO = new HistoryMongoDB();
        const result = await historyDAO.createResult(user, sortedOptions);
        // const result = await DB.createResult(user, sortedOptions)
        connections.filter((c: any) => room.participants.includes(c.user)).forEach((c: any) => {
            c.ws.send(JSON.stringify({ type: 'results-available', id: result._id }));
        });
    }
}

export default PeerProxy;
// module.exports = { peerProxy };

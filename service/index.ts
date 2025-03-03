import express, { NextFunction, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import cookieParser from 'cookie-parser';
import PeerProxy from './peerProxy';
import { calculateVoteResult } from './calculateVoteResult';
import { closeDB, getDB } from './database/mongoDb/MongoDB';
import MongoDBDaoFactory from './factory/MongoDBDaoFactory';
import { DaoFactory } from './factory/DaoFactory';

void main()

async function main() {
    const app = express();

    // DB Connections
    const daoFactory: DaoFactory = new MongoDBDaoFactory(await getDB());
    const userDAO = daoFactory.userDAO();
    const roomDAO = daoFactory.roomDAO();
    const historyDAO = daoFactory.historyDAO();

    const authCookieName = 'token';

    const port = process.argv.length > 2 ? process.argv[2] : 4000;

    app.use(express.json());
    app.use(cookieParser());
    app.use(express.static('public'));

    const apiRouter = express.Router();
    app.use('/api', apiRouter);

    apiRouter.post('/register', async (req: Request, res: Response) => {
        if (!req.body.username) {
            res.status(400).send({ msg: 'Missing username' })
            return
        }
        if (!req.body.password) {
            res.status(400).send({ msg: 'Missing password' })
            return
        }

        let user = await userDAO.getUser(req.body.username);
        if (user) {
            res.status(409).send({ msg: 'Existing user' });
            return
        }

        if (req.body.nickname) {
            // Anonymous user
            user = await userDAO.createUser(req.body.username, req.body.password, req.body.nickname);
        } else {
            user = await userDAO.createUser(req.body.username, req.body.password, null);
        }

        console.log(user);
        setAuthCookie(res, user.token);

        res.status(201).send({ username: user.nickname ?? user.username });
    });

    apiRouter.post('/login', async (req: Request, res: Response) => {
        if (!req.body.username) {
            res.status(400).send({ msg: 'Missing username' })
            return
        }
        if (!req.body.password) {
            res.status(400).send({ msg: 'Missing password' })
            return
        }

        const user = await userDAO.getUser(req.body.username);

        if (user && await bcrypt.compare(req.body.password, user.password)) {
            setAuthCookie(res, user.token);
            res.status(200).send({ username: user.username });
        } else {
            res.status(400).send({ msg: 'Invalid username and/or password' })
        }
    });

    apiRouter.delete('/logout', (_req: Request, res: Response) => {
        res.clearCookie(authCookieName);
        res.status(204).end();
    })

    async function getUserFromRequest(req: Request) {
        const authToken = req.cookies[authCookieName];
        const user = await userDAO.getUserByToken(authToken);

        return user
    }

    apiRouter.get('/me', async (req: Request, res: Response) => {
        const user = await getUserFromRequest(req)

        if (user) {
            res.status(200).send({ username: user.nickname ?? user.username })
        } else {
            res.status(204).end()
        }
    })

    const secureApiRouter = express.Router();
    apiRouter.use(secureApiRouter);

    secureApiRouter.use(async (req: Request, res: Response, next: NextFunction) => {
        const user = await getUserFromRequest(req);
        if (user) {
            next();
        } else {
            res.status(401).send({ msg: 'Unauthorized' });
        }
    });

    secureApiRouter.post('/room', async (req: Request, res: Response) => {
        const user = await getUserFromRequest(req)
        const newRoom = await roomDAO.createRoom(user!.username);
        await roomDAO.addParticipantToRoom(newRoom.code, user!.username);
        res.status(201).send({ id: newRoom._id, code: newRoom.code })
    })

    secureApiRouter.get('/room/:id', async (req: Request, res: Response) => {
        const user = await getUserFromRequest(req)
        const roomId = req.params.id
        const room = await roomDAO.getRoomById(roomId);

        if (!room) {
            res.status(404).send({ msg: `Room ${roomId} does not exist` })
            return
        }

        if (room.state !== 'open') {
            res.status(409).send({ msg: 'Room is not open' })
            return
        }

        await roomDAO.addParticipantToRoom(room.code, user!.username);

        res.status(200).send({ ...room, isOwner: room.owner === user!.username })
    })

    secureApiRouter.post('/room/:code/join', async (req: Request, res: Response) => {
        const user = await getUserFromRequest(req)
        const roomCode = req.params.code
        const room = await roomDAO.getRoomByCode(roomCode);

        if (!room) {
            res.status(404).send({ msg: `Room ${roomCode} does not exist` })
            return
        }

        if (room.state !== 'open') {
            res.status(409).send({ msg: 'Room is not open' })
            return
        }

        const success = await roomDAO.addParticipantToRoom(roomCode, user!.username);

        if (success) {
            res.status(200).send({ id: room._id })
        } else {
            res.status(500).send({ msg: 'error adding participant' })
        }
    })

    secureApiRouter.post('/room/:id/options', async (req: Request, res: Response) => {
        if (!req.body.option) {
            res.status(400).send({ msg: 'Missing option' })
            return
        }

        const user = await getUserFromRequest(req)
        const roomId = req.params.id
        const room = await roomDAO.getRoomById(roomId);

        if (!room) {
            res.status(404).send({ msg: `Room ${roomId} does not exist` })
            return
        }

        if (room.state !== 'open') {
            res.status(409).send({ msg: 'Room is not open' })
            return
        }

        if (!room.participants.includes(user!.username)) {
            res.status(403).send({ msg: 'User is not allowed to add options to room' })
            return
        }

        const newOption = req.body.option
        if (room.options.map(opt => opt.toLowerCase()).includes(newOption.toLowerCase())) {
            res.status(409).send({ msg: 'Option already exists' })
            return
        }

        if (await roomDAO.addOptionToRoom(roomId, newOption)) {
            res.status(201).send({ options: [...room.options, newOption] })
            return
        }
        res.status(500).send({ msg: 'unknown server error' })
    })

    secureApiRouter.post('/room/:id/lockin', async (req: Request, res: Response) => {
        if (!req.body.votes) {
            res.status(400).send({ msg: 'Missing votes' })
            return
        }

        const user = await getUserFromRequest(req)
        const roomId = req.params.id
        const room = await roomDAO.getRoomById(roomId);

        if (!room) {
            res.status(404).send({ msg: `Room ${roomId} does not exist` })
            return
        }

        if (room.state !== 'open') {
            res.status(409).send({ msg: 'Room is not open' })
            return
        }

        if (!room.participants.includes(user!.username)) {
            res.status(403).send({ msg: 'User is not allowed to participate in room' })
            return
        }
        await roomDAO.submitUserVotes(roomId, user!.username, req.body.votes)

        const isOwner = room.owner === user!.username

        res.status(200).send({ resultsId: '', isOwner })
    })

    secureApiRouter.delete('/room/:id/unlock', async (req: Request, res: Response) => {
        const user = await getUserFromRequest(req);
        const roomId = req.params.id;
        const room = await roomDAO.getRoomById(roomId);

        if (!room) {
            res.status(404).send({ msg: `Room ${roomId} does not exist` })
            return
        }

        if (room.state !== 'open') {
            res.status(409).send({ msg: 'Room is not open' })
            return
        }

        if (!room.participants.includes(user!.username)) {
            res.status(403).send({ msg: 'User is not allowed to participate in room' })
            return
        }

        await roomDAO.removeUserVotes(roomId, user!.username);

        res.status(200).send();
    })

    secureApiRouter.post('/room/:id/close', async (req: Request, res: Response) => {
        const user = await getUserFromRequest(req)
        const roomId = req.params.id
        const room = await roomDAO.getRoomById(roomId);

        if (!room) {
            res.status(404).send({ msg: `Room ${roomId} does not exist` })
            return
        }
        const isOwner = room.owner === user!.username

        if (!isOwner) {
            res.status(403).send({ msg: 'User is not owner of room' })
            return
        }

        if (room.state !== 'open') {
            res.status(409).send({ msg: 'Room is not open' })
            return
        }

        await roomDAO.closeRoom(roomId);

        const {sortedOptions, sortedTotals} = calculateVoteResult(room.votes)
        const result = await historyDAO.createResult(user!.username, sortedOptions, sortedTotals);

        res.status(200).send({ resultsId: result._id })
    })

    secureApiRouter.get('/results/:id', async (req: Request, res: Response) => {
        const resultsId = req.params.id
        const result = await historyDAO.getResult(resultsId);

        if (!result) {
            res.status(404).send({ msg: `Result does not exist` })
            return
        }

        res.status(200).send({ results: result.sortedOptions, totals: result.sortedTotals })
    })

    secureApiRouter.get('/history', async (req: Request, res: Response) => {
        const user = await getUserFromRequest(req)
        const history = await historyDAO.getHistory(user!.username);

        res.status(200).send({ history })
    })

    app.use(function(err: Error, _req: Request, res: Response, _next: NextFunction) {
        res.status(500).send({ type: err.name, message: err.message });
    });

    app.use((_req: Request, res: Response) => {
        res.sendFile('index.html', { root: 'public' });
    });

    function setAuthCookie(res: Response, authToken: string) {
        res.cookie(authCookieName, authToken, {
            secure: true,
            httpOnly: true,
            sameSite: 'strict',
        });
    }

    const httpService = app.listen(port, () => {
        console.log(`Listening on port ${port}`);
    });

    // Close the DB connection on server shutdown.
    const gracefulShutdown = async () => {
        console.log('Shutting down gracefully...');
        await closeDB();
        process.exit(0);
    };
    // Handle termination signals
    process.on('SIGINT', gracefulShutdown); // Ctrl+C in terminal
    process.on('SIGTERM', gracefulShutdown); // Cloud provider shutdown


    const proxy = new PeerProxy(daoFactory);
    proxy.peerProxy(httpService);
}

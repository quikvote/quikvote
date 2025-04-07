import express, { NextFunction, Request, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import cookieParser from 'cookie-parser';
import PeerProxy from './peerProxy';
import { closeDB, getDB } from './database/mongoDb/MongoDB';
import MongoDBDaoFactory from './factory/MongoDBDaoFactory';
import { DaoFactory } from './factory/DaoFactory';
import { VoteConfig } from './model/voteTypes';

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

  const anonymousApiRouter = express.Router();
  apiRouter.use(anonymousApiRouter);

  anonymousApiRouter.use(async (req: Request, res: Response, next: NextFunction) => {
    let user = await getUserFromRequest(req);
    if (user) {
      next();
    } else {
      // Generate random UUID for username and password
      const uuid = crypto.randomUUID()
      const anonymousUsername = `anon_${uuid}`
      const anonymousPassword = uuid
      user = await userDAO.createUser(anonymousUsername, anonymousPassword, null);
      req.cookies[authCookieName] = user.token;
      setAuthCookie(res, user.token);
      next();
    }
  });

  anonymousApiRouter.get('/room/:id', async (req: Request, res: Response) => {
    const user = await getUserFromRequest(req)
    const roomId = req.params.id
    const room = await roomDAO.getRoomById(roomId);

    if (!user) {
      res.status(404).send({ msg: `User not signed in` })
      return
    }

    if (!room) {
      res.status(404).send({ msg: `Room ${roomId} does not exist` })
      return
    }

    await roomDAO.addParticipantToRoom(room.code, user.username);

    const currentVote = room.votes.find(uv => uv.username === user.username)?.vote
    const lockedIn = currentVote !== undefined;

    res.status(200).send({
      ...room,
      isOwner: room.owner === user.username,
      lockedIn,
      currentVote
    })
  })

  anonymousApiRouter.post('/room/:code/join', async (req: Request, res: Response) => {
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
    const config = req.body as VoteConfig
    const newRoom = await roomDAO.createRoom(user!.username, config);
    res.status(201).send({ id: newRoom._id, code: newRoom.code })
  })

  secureApiRouter.get('/results/:id', async (req: Request, res: Response) => {
    const resultsId = req.params.id
    const result = await historyDAO.getResult(resultsId);

    if (!result) {
      res.status(404).send({ msg: `Result does not exist` })
      return
    }

    const room = await roomDAO.getRoomByResultId(resultsId);
    const config = room ? room.config : null;

    // Add nickname information to all voters
    const optionsWithNicknames = await Promise.all(result.options.map(async (option) => {
      const votersWithNicknames = await Promise.all(option.voters.map(async (voter) => {
        const user = await userDAO.getUser(voter.username);
        return {
          ...voter,
          nickname: user?.nickname || null
        };
      }));

      return {
        ...option,
        voters: votersWithNicknames
      };
    }));

    res.status(200).send({ 
      options: optionsWithNicknames,
      config: config
    });
  })

  secureApiRouter.get('/history', async (req: Request, res: Response) => {
    const user = await getUserFromRequest(req)
    const history = await historyDAO.getHistory(user!.username);

    res.status(200).send({ history })
  })

  app.get('*', (_: Request, res: Response) => {
    res.sendFile('index.html', { root: 'public' });
  })

  app.use(function(err: Error, _req: Request, res: Response) {
    res.status(500).send({ type: err.name, message: err.message });
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

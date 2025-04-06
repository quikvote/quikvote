import express, { NextFunction, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import cookieParser from 'cookie-parser';
import PeerProxy from './peerProxy';
import { closeDB, getDB } from './database/mongoDb/MongoDB';
import MongoDBDaoFactory from './factory/MongoDBDaoFactory';
import { DaoFactory } from './factory/DaoFactory';
import { VoteConfig } from './model/voteTypes';
import { UserVote } from './model';

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

    if (room.state !== 'open' && room.state !== 'preliminary') {
      res.status(409).send({ msg: 'Room is not open or in preliminary phase' })
      return
    }

    await roomDAO.addParticipantToRoom(room.code, user.username);
    
    // NOTE: We're no longer adding the participant as an option here
    // This will be handled exclusively by the WebSocket notification in notifyParticipantChange
    // to ensure all clients get notified properly

    res.status(200).send({ ...room, isOwner: room.owner === user.username })
  })
  
  // Endpoint to get participant information including nicknames
  anonymousApiRouter.get('/room/:id/participants', async (req: Request, res: Response) => {
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
    
    // Get participant details for everyone in the room
    const participantDetails = await Promise.all(
      room.participants.map(async (username) => {
        const userInfo = await userDAO.getUser(username);
        return {
          username,
          nickname: userInfo?.nickname || null,
          isOwner: username === room.owner
        };
      })
    );

    res.status(200).send({ 
      participants: participantDetails,
      roomId: roomId,
      roomCode: room.code
    });
  })

  anonymousApiRouter.post('/room/:code/join', async (req: Request, res: Response) => {
    const user = await getUserFromRequest(req)
    const roomCode = req.params.code
    const room = await roomDAO.getRoomByCode(roomCode);

    if (!room) {
      res.status(404).send({ msg: `Room ${roomCode} does not exist` })
      return
    }

    if (room.state !== 'open' && room.state !== 'preliminary') {
      res.status(409).send({ msg: 'Room is not open or in preliminary phase' })
      return
    }

    const success = await roomDAO.addParticipantToRoom(roomCode, user!.username);

    if (success) {
      // NOTE: We're no longer adding the participant as an option here
      // This will be handled exclusively by the WebSocket notification in notifyParticipantChange
      // to ensure all clients get notified properly
      
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

    // Get the room configuration to access voting options
    const room = await roomDAO.getRoomByOwner(result.owner);
    
    // If room exists, include its config options
    if (room) {
      const configOptions = {
        numRunnerUps: room.config.options.numRunnerUps,
        showNumVotes: room.config.options.showNumVotes,
        showWhoVoted: room.config.options.showWhoVoted,
        resultType: room.config.options.resultType || 'bar'
      };
      
      const responseData: any = { 
        results: result.sortedOptions, 
        totals: result.sortedTotals,
        config: configOptions
      };
      
      // Include voter information if showWhoVoted is enabled
      if (configOptions.showWhoVoted) {
        // First, collect usernames that voted for each option
        const voterUsernames: Record<string, string[]> = {};
        
        // Initialize empty arrays for each option
        result.sortedOptions.forEach(option => {
          voterUsernames[option] = [];
        });
        
        // Find the room with the latest votes from history if available
        // TODO UPDATE THIS LOGIC - GARETT WHIMPLE
        const processVotes = (votes: UserVote[]) => {
          votes.forEach(vote => {
            // Handle different vote types to determine what options each user voted for
            switch (vote.vote.type) {
              case 'score':
                // For score voting, consider votes with score > 0
                Object.entries((vote.vote as { scores: Record<string, number> }).scores).forEach(([option, score]) => {
                  if (score > 0 && voterUsernames[option as string] !== undefined) {
                    voterUsernames[option as string].push(vote.username);
                  }
                });
                break;
                
              case 'rank':
                // For rank voting, consider all ranked options
                Object.entries((vote.vote as { rankings: Record<string, number> }).rankings).forEach(([option, _]) => {
                  if (voterUsernames[option as string] !== undefined) {
                    voterUsernames[option as string].push(vote.username);
                  }
                });
                break;
                
              case 'topChoices':
                // For top choices, add username to each chosen option
                Object.entries((vote.vote as { topChoices: Record<string, string | null> }).topChoices).forEach(([_, optionValue]) => {
                  if (optionValue && voterUsernames[optionValue as string] !== undefined) {
                    voterUsernames[optionValue as string].push(vote.username);
                  }
                });
                break;
                
              case 'approval':
                // For approval, add user to approved options
                Object.entries((vote.vote as { approvals: Record<string, boolean> }).approvals).forEach(([option, approved]) => {
                  if (approved && voterUsernames[option as string] !== undefined) {
                    voterUsernames[option as string].push(vote.username);
                  }
                });
                break;
                
              case 'quadratic':
                // For quadratic, consider options with votes > 0
                Object.entries((vote.vote as { votes: Record<string, number> }).votes).forEach(([option, voteCount]) => {
                  if (voteCount > 0 && voterUsernames[option as string] !== undefined) {
                    voterUsernames[option as string].push(vote.username);
                  }
                });
                break;
            }
          });
        };
        
        if (room.roundHistory && room.roundHistory.length > 0) {
          // Get the latest completed round
          const latestRound = room.roundHistory[room.roundHistory.length - 1];
          processVotes(latestRound.votes);
        } else if (room.votes) {
          // If no roundHistory, use current room votes
          processVotes(room.votes);
        }
        
        // Now convert usernames to display names (nickname or username)
        const displayNamePromises: Promise<void>[] = [];
        const voters: Record<string, string[]> = {};
        
        // Initialize the result structure
        result.sortedOptions.forEach(option => {
          voters[option] = [];
        });
        
        // For each option, convert usernames to display names
        for (const option of result.sortedOptions) {
          for (const username of voterUsernames[option]) {
            const promise = userDAO.getUser(username)
              .then(user => {
                if (user) {
                  const displayName = user.nickname || user.username;
                  voters[option].push(displayName);
                } else {
                  voters[option].push(username);
                }
              })
              .catch(() => {
                // If error, use the username
                voters[option].push(username);
              });
            
            displayNamePromises.push(promise);
          }
        }

        await Promise.all(displayNamePromises);

        responseData.voters = voters;
      }
      
      res.status(200).send(responseData);
    } else {
      res.status(200).send({ results: result.sortedOptions, totals: result.sortedTotals });
    }
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

# [QuikVote](https://startup.quikvote.click/)

Struggling to decide what to do with friends? Whether it’s picking a
restaurant, movie, or activity, **QuikVote** makes group decisions fast and fair.
Simply create a vote room, share it, and let everyone vote simultaneously.
Don’t like the options? Add a new one in seconds! Once the votes are in,
the results are clear, and you can get on with your plans. Make decisions
effortlessly with **QuikVote**—the quick, easy solution to group indecision!

## Key features

* Create/join a QuikVote room
* Easily add voting choices
* Vote!
* View results
* Create an account to save/view past QuikVotes

## Development

Copy `service/dbconfig.temp.ts` to `service/dbconfig.ts` and fill in the `url` field.
Paste in the connection string to your MongoDB instance.
It should look something like `mongodb+srv://username:password@host...`.

### Backend
To run the backend server, `cd` into `service/` and run
```bash
npm install
npm run dev
```

This will start the server locally on `localhost:4000`.

### Frontend
To run the frontend, start in the root directory and run
```bash
npm install
npm run dev
```

This will start `vite` in development mode and it will expect a backend running on `localhost:4000`.

## Diagrams

### High-level User Flow

```mermaid
graph TD;
    Home["Home<br />home/home.jsx"] --> Create["Create<br />new/new.jsx"];
    Home --> Join["Join<br />join/join.jsx"];
    Create --> Vote["Vote<br />vote/vote.jsx<br />vote/websocket_handler.js"];
    Join --> Vote;
    Vote --> Results["Results<br />results/results.jsx"];
    Results --> Home;
```

Users start at the home page. 

They then either create a new room or join an existing room. 
If they create a room, they will be given a randomly generated 4-character alphanumeric code 
(excluding the characters 'O', '0', '1', 'L', and 'I' for clarity). 
Those who are joining a room will enter in the 4-character code that the room creater shared with them.

Once in the voting room, any user can add an option at any time. 
Whenever a user adds an option, the server updates all connected users with the updated list of options.
Once a user is satisfied with their votes, they "lock in". This sends the server that user's votes and tells the server that they're locked in.
Once each user in the room is locked in, the server aggregates the votes and then notifies all users in the room that the results are ready.

The users can view the results, and then return to the home page.

### Live Voting Websocket Messages

Here is a sequence diagram of the websocket messages that might occur during a voting session.
This process is defined in `service/peerProxy.js` on the backend, and `src/pages/vote/websocket_handler.js` on the frontend.

```mermaid
sequenceDiagram
    participant Jane
    participant Server
    participant Joe

    Jane ->> Server: connect

    Joe ->> Server: connect

    Jane ->> Server: new_option
    Server -->> Joe: options
    Server -->> Jane: options

    Joe ->> Server: lock_in
    Jane ->> Server: lock_in

    Server -->> Jane: results-available
    Server -->> Joe: results-available
```

Jane and Joe both connect to the room. Jane enters a new voting option with the `new_option`. 
Both Jane and Joe are notified of the new list of options with the `options` message.
Later, Joe and Jane decide to lock in their votes with the `lock_in` message.
The server aggregates the votes and notifies Jane and Joe that the results are ready with the `results-available` message.

The only websocket message not shown here is the `close_room` message. 
This can only be sent by the room owner, and will immediately close the room.
The server will aggregate the votes of any user that had already locked in, and then send the `results-available` message to all users in the room.


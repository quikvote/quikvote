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

Copy `service/dbconfig.temp.json` to `service/dbconfig.json` and fill in the `url` field.
It should look something like `mongodb+srv://username:password@host...`.

### Backend
To run the backend server, `cd` into `service/` and run
```bash
npm install
npm start
```

This will start the server locally on `localhost:4000`.

### Frontend
To run the frontend, start in the root directory and run
```bash
npm install
npm run dev
```

This will start `vite` in development mode and it will expect a backend running on `localhost:4000`.

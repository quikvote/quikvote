import React from 'react';
import ScoreVote from './score'

/*
  *
  * HOW TO ADD A VOTE TYPE (frontend)
  *
  * 1. Ensure that the backend is updated with the new vote type (see service/model/voteTypes.ts)
  * 2. Add a component for the new vote type in this folder (see ./score.jsx for an example)
  * 2.1 Use the options defined in the backend to configure the component
  * 2.2 Make sure that the `vote` object matches the shape defined in the backend (see the `Vote` type in service/model/voteTypes.ts)
  * 2.2.1 Note: the `vote` object does not need to have the `type` field defined. The main `Vote` component adds it on when the vote is locked in
  * 2.3 Add the new component to the switch statement in this `renderVote` function
  * 2.4 Ensure the mod options defined in the backend are configurable on the frontend on the new room page
  *
  */

export default function renderVote(config, options, vote, setVote, disabled) {
  switch (config.type) {
    case 'score':
      return (<ScoreVote
        config={config}
        options={options}
        vote={vote}
        setVote={setVote}
        disabled={disabled}
      />)
    default:
      return (<p>Error</p>)
  }
}

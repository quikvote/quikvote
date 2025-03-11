import React from 'react';
import ScoreVote from './score'

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

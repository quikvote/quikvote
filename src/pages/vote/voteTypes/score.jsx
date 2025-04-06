import React, { useEffect } from 'react';
import '../vote.css'

export default function ScoreVote({ config, options, vote, setVote, disabled }) {
  // Initialize scores for all options when component mounts or options change
  useEffect(() => {
    // Only do this if we don't have scores yet or if scores are empty
    if (!vote.scores || Object.keys(vote.scores).length === 0) {
      const min = config.options.minVotesPerOption || 0;
      const max = config.options.maxVotesPerOption || 10;
      const defaultValue = Math.floor(min + (max - min) / 2);
      
      // Create an object with default scores for all options
      const defaultScores = {};
      options.forEach(name => {
        defaultScores[name] = defaultValue;
      });
      
      // Update the vote state with these default scores
      setVote({
        scores: defaultScores
      });
      
      console.log("Initialized score defaults:", defaultScores);
    }
  }, [options, config.options.minVotesPerOption, config.options.maxVotesPerOption]);

  return options.map((name, i) => (
    <ScoreVoteOption
      config={config}
      name={name}
      key={i}
      value={vote.scores?.[name]}
      setValue={(val) =>
        setVote({
          scores: {
            ...vote.scores,
            [name]: val
          }
        })}
      disabled={disabled}
    />
  ))
}

function ScoreVoteOption({ config, name, value, setValue, disabled }) {
  useEffect(() => {
    if (value === undefined) {
      // Calculate the default value as halfway between min and max
      const min = config.options.minVotesPerOption || 0;
      const max = config.options.maxVotesPerOption || 10;
      const defaultValue = Math.floor(min + (max - min) / 2);
      setValue(defaultValue);
    }
  }, [name, config.options.minVotesPerOption, config.options.maxVotesPerOption])

  function increaseValue() {
    if (value === config.options.maxVotesPerOption) {
      return
    }
    setValue(value + 1)
  }
  function decreaseValue() {
    if (value === config.options.minVotesPerOption) {
      return
    }
    setValue(value - 1)
  }
  return (
    <li className="vote-options__item">{name}
      <div className="vote-buttons">
        <button
          className={`vote-buttons__button ${disabled ? 'vote-buttons__button--disabled' : ''}`}
          onClick={decreaseValue}
          disabled={disabled}
        >
          <span className="material-symbols-outlined">arrow_downward</span>
        </button>
        <span className="vote-buttons__value">{value}</span>
        <button
          className={`vote-buttons__button ${disabled ? 'vote-buttons__button--disabled' : ''}`}
          onClick={increaseValue}
          disabled={disabled}
        >
          <span className="material-symbols-outlined">arrow_upward</span>
        </button>
      </div>
    </li>
  )
}

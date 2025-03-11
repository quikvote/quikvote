import React, { useEffect } from 'react';
import '../vote.css'

export default function ScoreVote({ config, options, vote, setVote, disabled }) {
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
      setValue(config.minVotesPerOption)
    }
  }, [])

  function increaseValue() {
    if (value == config.maxVotesPerOption) {
      return
    }
    setValue(value + 1)
  }
  function decreaseValue() {
    if (value == config.minVotesPerOption) {
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

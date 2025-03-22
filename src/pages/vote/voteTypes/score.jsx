import React, { useEffect } from 'react';
import '../vote.css'
import RemoveOptionButton from '../removeOptionButton';

export default function ScoreVote({ config, options, vote, setVote, disabled, isRoomOwner }) {
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
      isRoomOwner={isRoomOwner}
    />
  ))
}

function ScoreVoteOption({ config, name, value, setValue, disabled, isRoomOwner }) {
  useEffect(() => {
    if (value === undefined) {
      setValue(config.options.minVotesPerOption)
    }
  }, [])

  function increaseValue() {
    if (value == config.options.maxVotesPerOption) {
      return
    }
    setValue(value + 1)
  }
  function decreaseValue() {
    if (value == config.options.minVotesPerOption) {
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
        <RemoveOptionButton isRoomOwner={isRoomOwner} disabled={disabled} option={name} />
      </div>
    </li>
  )
}

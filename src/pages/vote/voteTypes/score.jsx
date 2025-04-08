import React, { useEffect } from 'react';
import '../vote.css'
import RemoveOptionButton from '../removeOptionButton';

export default function ScoreVote({ config, options, vote, setVote, disabled, isRoomOwner }) {
  return options.map((option, i) => {
    return (
      <ScoreVoteOption
        config={config}
        option={option}
        key={i}
        value={vote.scores?.[option.text]}
        setValue={(val) =>
          setVote({
            scores: {
              ...vote.scores,
              [option.text]: val
            }
          })}
        disabled={disabled}
        isRoomOwner={isRoomOwner}
      />
    );
  });
}

function ScoreVoteOption({ config, option, value, setValue, disabled, isRoomOwner }) {
  const optionText = option.text;
  
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
    <li className="vote-options__item">{optionText}
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
        <RemoveOptionButton isRoomOwner={isRoomOwner} disabled={disabled} option={option} />
      </div>
    </li>
  )
}

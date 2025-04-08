import React, { useEffect } from 'react';
import '../vote.css'
import RemoveOptionButton from '../removeOptionButton';

export default function ScoreVote({ config, options, vote, setVote, disabled, isRoomOwner }) {
  // Initialize all scores at once when options change or votes are reset
  useEffect(() => {
    // Check if we need to initialize any scores
    if (!vote.scores || options.some(option => vote.scores?.[option.text] === undefined)) {
      const initialScores = {};
      
      // Initialize scores for all options that don't have a value yet
      options.forEach(option => {
        // Use existing value if defined, otherwise use the minimum
        initialScores[option.text] = vote.scores?.[option.text] !== undefined
          ? vote.scores[option.text]
          : config.options.minVotesPerOption;
      });
      
      // Update vote state with all initialized scores
      setVote({
        scores: initialScores
      });
    }
  }, [options, config.options.minVotesPerOption, vote.scores, setVote]);

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

import React, { useEffect } from 'react';
import './score.css';
import RemoveOptionButton from '../removeOptionButton';

export default function ScoreVote({ config, options, vote, setVote, disabled, isRoomOwner }) {
  useEffect(() => {
    if (!vote.scores || options.some(option => vote.scores?.[option.text] === undefined)) {
      const initialScores = {};
      options.forEach(option => {
        initialScores[option.text] = vote.scores?.[option.text] !== undefined
          ? vote.scores[option.text]
          : config.options.minVotesPerOption;
      });
      setVote({ scores: initialScores });
    }
  }, [options, config.options.minVotesPerOption, vote.scores, setVote]);

  return options.map((option, i) => (
    <ScoreVoteOption
      config={config}
      option={option}
      key={i}
      value={vote.scores?.[option.text]}
      setValue={(val) =>
        setVote({
          scores: { ...vote.scores, [option.text]: val },
        })}
      disabled={disabled}
      isRoomOwner={isRoomOwner}
    />
  ));
}

function ScoreVoteOption({ config, option, value, setValue, disabled, isRoomOwner }) {
  const optionText = option.text;

  function handleSliderChange(event) {
    setValue(Number(event.target.value));
  }

  return (
    <li className="vote-options__item">
      <div className="vote-option__content">
        <span className="vote-option__text">{optionText}</span>
        <div className="vote-slider-container">
          <input
            type="range"
            min={config.options.minVotesPerOption}
            max={config.options.maxVotesPerOption}
            value={value ?? config.options.minVotesPerOption ?? 0}
            onChange={handleSliderChange}
            disabled={disabled}
            className={`vote-slider ${disabled ? 'vote-slider--disabled' : ''}`}
          />
          <span className="vote-slider__value">{value}</span>
        </div>
      </div>
      <RemoveOptionButton isRoomOwner={isRoomOwner} disabled={disabled} option={option} />
    </li>
  );
}

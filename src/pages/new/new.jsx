import React, { useEffect, useState } from 'react';
import './new.css';
import { NavLink, useNavigate } from 'react-router-dom';
import {RESULT_TYPES} from "../results/results";

const defaultConfig = {
  type: 'score',
  options: {
    // Results options
    numRunnerUps: -1,
    showNumVotes: true,
    showWhoVoted: false,
    resultType: RESULT_TYPES.BAR_GRAPH,

    // Score vote specific options
    minVotesPerOption: 0,
    maxVotesPerOption: 10,

    // Round options
    enableRound: false,
    eliminationCount: 1,
    maxRounds: 3,
    autoAdvance: true
  }
}

export default function New() {
  useEffect(() => {
    document.title = 'New QuikVote'
  }, [])

  const [config, setConfig] = useState(defaultConfig)
  const [voteType, setVoteType] = useState('score')

  const navigate = useNavigate()

  // Update vote type and reset options to appropriate defaults
  const handleVoteTypeChange = (type) => {
    let newOptions = {
      ...config.options,
      numRunnerUps: config.options.numRunnerUps,
      showNumVotes: config.options.showNumVotes,
      showWhoVoted: config.options.showWhoVoted,
      resultType: config.options.resultType,
      enableRound: config.options.enableRound,
      eliminationCount: config.options.eliminationCount,
      maxRounds: config.options.maxRounds,
      autoAdvance: config.options.autoAdvance
    };

    // Add type-specific options
    switch (type) {
      case 'score':
        newOptions = {
          ...newOptions,
          minVotesPerOption: 0,
          maxVotesPerOption: 10
        };
        break;
      case 'rank':
        // Rank has no special options
        break;
      case 'topChoices':
        newOptions = {
          ...newOptions,
          numberOfChoices: 3
        };
        break;
      case 'approval':
        // Approval has no special options
        break;
      case 'quadratic':
        newOptions = {
          ...newOptions,
          creditBudget: 100
        };
        break;
      default:
        break;
    }

    setVoteType(type);
    setConfig({
      type: type,
      options: newOptions
    });
  };

  // Handle changes to common options
  const handleCommonOptionChange = (option, value) => {
    setConfig({
      ...config,
      options: {
        ...config.options,
        [option]: value
      }
    });
  };

  // Handle changes to type-specific options
  const handleSpecificOptionChange = (option, value) => {
    setConfig({
      ...config,
      options: {
        ...config.options,
        [option]: value
      }
    });
  };

  async function createRoom(event) {
    event.preventDefault()

    const response = await fetch('/api/room', {
      method: 'POST',
      headers: {
        'Content-type': 'application/json; charset=UTF-8'
      },
      body: JSON.stringify(config)
    })

    const body = await response.json()
    if (response.status == 201) {
      navigate(`/vote/${body.id}`)
    }
  }

  // Render type-specific options based on selected vote type
  const renderTypeSpecificOptions = () => {
    switch (voteType) {
      case 'score':
        return (
            <div className="option-group">
              <h3>Score Vote Options</h3>
              <div className="option-row">
                <label htmlFor="minVotes">Minimum Score:</label>
                <input
                    type="number"
                    id="minVotes"
                    value={config.options.minVotesPerOption}
                    onChange={(e) => handleSpecificOptionChange('minVotesPerOption', parseInt(e.target.value))}
                    min="0"
                    max={config.options.maxVotesPerOption}
                />
              </div>
              <div className="option-row">
                <label htmlFor="maxVotes">Maximum Score:</label>
                <input
                    type="number"
                    id="maxVotes"
                    value={config.options.maxVotesPerOption}
                    onChange={(e) => handleSpecificOptionChange('maxVotesPerOption', parseInt(e.target.value))}
                    min={config.options.minVotesPerOption}
                />
              </div>
            </div>
        );

      case 'topChoices':
        return (
            <div className="option-group">
              <h3>Top Choices Options</h3>
              <div className="option-row">
                <label htmlFor="numChoices">Number of Choices:</label>
                <input
                    type="number"
                    id="numChoices"
                    value={config.options.numberOfChoices}
                    onChange={(e) => handleSpecificOptionChange('numberOfChoices', parseInt(e.target.value))}
                    min="1"
                    max="10"
                />
              </div>
            </div>
        );

      case 'quadratic':
        return (
            <div className="option-group">
              <h3>Quadratic Vote Options</h3>
              <div className="option-row">
                <label htmlFor="creditBudget">Credit Budget:</label>
                <input
                    type="number"
                    id="creditBudget"
                    value={config.options.creditBudget}
                    onChange={(e) => handleSpecificOptionChange('creditBudget', parseInt(e.target.value))}
                    min="10"
                    max="1000"
                    step="10"
                />
              </div>
            </div>
        );

      case 'rank':
      case 'approval':
        return (
            <div className="option-group">
              <h3>{voteType === 'rank' ? 'Rank' : 'Approval'} Vote Options</h3>
              <p className="option-note">No special configuration needed for this vote type.</p>
            </div>
        );

      default:
        return null;
    }
  };

  return (
      <>
        <header className="header header--center-with-back">
          <nav>
            <ul className="header__nav-list">
              <li>
                <NavLink className="header__nav-link" to="/">
                  <span className="material-symbols-outlined">arrow_back</span>
                </NavLink>
              </li>
            </ul>
          </nav>
          <h1 className="header__title header__title--center">Create QuikVote</h1>
        </header>
        <main className="main">
          <div className="config-container">
            <div className="option-group">
              <h3>Vote Type</h3>
              <div className="vote-type-selector">
                <div
                    className={`vote-type-option ${voteType === 'score' ? 'vote-type-option--selected' : ''}`}
                    onClick={() => handleVoteTypeChange('score')}
                >
                  <div className="vote-type-icon">0-10</div>
                  <div className="vote-type-label">Score</div>
                </div>

                <div
                    className={`vote-type-option ${voteType === 'rank' ? 'vote-type-option--selected' : ''}`}
                    onClick={() => handleVoteTypeChange('rank')}
                >
                  <div className="vote-type-icon">
                    <span className="material-symbols-outlined">drag_indicator</span>
                  </div>
                  <div className="vote-type-label">Rank</div>
                </div>

                <div
                    className={`vote-type-option ${voteType === 'topChoices' ? 'vote-type-option--selected' : ''}`}
                    onClick={() => handleVoteTypeChange('topChoices')}
                >
                  <div className="vote-type-icon">123</div>
                  <div className="vote-type-label">Top Choices</div>
                </div>

                <div
                    className={`vote-type-option ${voteType === 'approval' ? 'vote-type-option--selected' : ''}`}
                    onClick={() => handleVoteTypeChange('approval')}
                >
                  <div className="vote-type-icon">
                    <span className="material-symbols-outlined">check</span>
                  </div>
                  <div className="vote-type-label">Approval</div>
                </div>

                <div
                    className={`vote-type-option ${voteType === 'quadratic' ? 'vote-type-option--selected' : ''}`}
                    onClick={() => handleVoteTypeChange('quadratic')}
                >
                  <div className="vote-type-icon">x²</div>
                  <div className="vote-type-label">Quadratic</div>
                </div>
              </div>
              
              <div className="vote-type-description">
                {voteType === 'score' && (
                    <p>Score voting allows participants to rate each option on a scale from {config.options.minVotesPerOption} to {config.options.maxVotesPerOption}.</p>
                )}
                {voteType === 'rank' && (
                    <p>Rank voting allows participants to drag and reorder options based on their preference. The highest ranked option gets the most points.</p>
                )}
                {voteType === 'topChoices' && (
                    <p>Top Choices voting allows participants to select their top {config.options.numberOfChoices} choices in order of preference.</p>
                )}
                {voteType === 'approval' && (
                    <p>Approval voting allows participants to select all options they approve of. Each approved option receives one point.</p>
                )}
                {voteType === 'quadratic' && (
                    <p>Quadratic voting gives participants {config.options.creditBudget} credits to allocate. The cost of votes increases quadratically (1 vote = 1 credit, 2 votes = 4 credits, etc.).</p>
                )}
              </div>
            </div>

            {renderTypeSpecificOptions()}

            <div className="option-group">
              <h3>Results Options</h3>
              
              {/* Results visualization type cards */}
              <div className="vote-type-selector">
                <div
                    className={`vote-type-option ${config.options.resultType === RESULT_TYPES.BAR_GRAPH ? 'vote-type-option--selected' : ''}`}
                    onClick={() => handleCommonOptionChange('resultType', RESULT_TYPES.BAR_GRAPH)}
                >
                  <div className="vote-type-icon">
                    <span className="material-symbols-outlined">bar_chart</span>
                  </div>
                  <div className="vote-type-label">Bar Graph</div>
                </div>

                <div
                    className={`vote-type-option ${config.options.resultType === RESULT_TYPES.PIE_CHART ? 'vote-type-option--selected' : ''}`}
                    onClick={() => handleCommonOptionChange('resultType', RESULT_TYPES.PIE_CHART)}
                >
                  <div className="vote-type-icon">
                    <span className="material-symbols-outlined">pie_chart</span>
                  </div>
                  <div className="vote-type-label">Pie Chart</div>
                </div>

                <div
                    className={`vote-type-option ${config.options.resultType === RESULT_TYPES.PODIUM ? 'vote-type-option--selected' : ''}`}
                    onClick={() => handleCommonOptionChange('resultType', RESULT_TYPES.PODIUM)}
                >
                  <div className="vote-type-icon">
                    <span className="material-symbols-outlined">emoji_events</span>
                  </div>
                  <div className="vote-type-label">Podium</div>
                </div>
              </div>
              
              {/* Result visualization description */}
              <div className="vote-type-description">
                {config.options.resultType === RESULT_TYPES.BAR_GRAPH && 
                  <p>Bar graph will display options as horizontal bars showing relative vote counts.</p>
                }
                {config.options.resultType === RESULT_TYPES.PIE_CHART && 
                  <p>Pie chart will show the proportion of votes each option received.</p>
                }
                {config.options.resultType === RESULT_TYPES.PODIUM && 
                  <p>Podium view will display options in ranking order with visual podium heights.</p>
                }
              </div>
              
              <div className="option-row">
                <label htmlFor="numRunnerUps">Number of Runner-ups to Show:</label>
                <select
                    id="numRunnerUps"
                    value={config.options.numRunnerUps}
                    onChange={(e) => handleCommonOptionChange('numRunnerUps', parseInt(e.target.value))}
                >
                  <option value="-1">Show All</option>
                  <option value="0">Winner Only</option>
                  <option value="1">Winner + 1</option>
                  <option value="2">Winner + 2</option>
                  <option value="3">Winner + 3</option>
                  <option value="4">Winner + 4</option>
                  <option value="5">Winner + 5</option>
                </select>
              </div>

              <div className="checkbox-row">
                <label>
                  <input
                      type="checkbox"
                      checked={config.options.showNumVotes}
                      onChange={(e) => handleCommonOptionChange('showNumVotes', e.target.checked)}
                  />
                  Show Number of Votes
                </label>
              </div>

              <div className="checkbox-row">
                <label>
                  <input
                      type="checkbox"
                      checked={config.options.showWhoVoted}
                      onChange={(e) => handleCommonOptionChange('showWhoVoted', e.target.checked)}
                  />
                  Show Who Voted
                </label>
              </div>
            </div>

            <div className="option-group">
              <h3>Multi-Round Options</h3>
              <div className="checkbox-row">
                <label>
                  <input
                      type="checkbox"
                      checked={config.options.enableRound}
                      onChange={(e) => handleCommonOptionChange('enableRound', e.target.checked)}
                  />
                  Enable Multi-round Voting
                </label>
              </div>

              {config.options.enableRound && (
                  <>
                    <div className="option-row">
                      <label htmlFor="eliminationCount">Number of Options to Eliminate Each Round:</label>
                      <input
                          type="number"
                          id="eliminationCount"
                          value={config.options.eliminationCount}
                          onChange={(e) => handleCommonOptionChange('eliminationCount', parseInt(e.target.value))}
                          min="1"
                          max="5"
                      />
                    </div>

                    <div className="option-row">
                      <label htmlFor="maxRounds">Maximum Number of Rounds:</label>
                      <input
                          type="number"
                          id="maxRounds"
                          value={config.options.maxRounds}
                          onChange={(e) => handleCommonOptionChange('maxRounds', parseInt(e.target.value))}
                          min="2"
                          max="10"
                      />
                    </div>

                    <div className="checkbox-row">
                      <label>
                        <input
                            type="checkbox"
                            checked={config.options.autoAdvance}
                            onChange={(e) => handleCommonOptionChange('autoAdvance', e.target.checked)}
                        />
                        Automatically Advance to Next Round
                      </label>
                    </div>

                    <div className="round-info">
                      <p>With these settings, the bottom {config.options.eliminationCount} option(s) will be eliminated after each round.</p>
                      <p>Voting will continue for up to {config.options.maxRounds} rounds or until a winner is determined.</p>
                      {config.options.autoAdvance ?
                          <p>Rounds will advance automatically once all votes are in.</p> :
                          <p>The room owner will need to manually start each new round.</p>
                      }
                    </div>
                  </>
              )}
            </div>

            {config.options.enableRound && (
              <div className="option-group">
                <h3>Round Information</h3>
                <div className="vote-type-description">
                  <p className="round-note">Multi-round voting is enabled. After each round, the lowest-scoring options will be eliminated, and participants will vote again on the remaining options.</p>
                </div>
              </div>
            )}
          </div>

          <button className="main__button" onClick={createRoom}>Begin QuikVote</button>
        </main>
      </>
  )
}
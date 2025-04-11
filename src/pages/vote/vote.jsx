import React, { useEffect, useState } from 'react';
import './vote.css';
import { NavLink, useParams } from 'react-router-dom';
import { WSHandler } from './websocket_handler'
import ShareModal from './shareModal'
import renderVote from './voteTypes/render'

function AddOption(props) {
  const [value, setValue] = useState('')
  function submit() {
    props.onSubmit(value)
    setValue('')
  }
  function onKeyDown(event) {
    if (event.key == "Enter" && !checkDisabled()) {
      submit()
    }
  }
  function addButtonClicked(event) {
    event.preventDefault()
    submit()
  }
  function checkDisabled() {
    return props.disabled || value == ''
  }
  return (
    <form className="add-option">
      <input
        className="add-option__input"
        type="text"
        onKeyDown={onKeyDown}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Add to list" />
      <button
        className={`add-option__button ${checkDisabled() ? 'add-option__button--disabled' : ''}`}
        type="submit"
        onClick={addButtonClicked}
        disabled={checkDisabled()}>
        <span className="material-symbols-outlined">add</span>
      </button>
    </form>
  )
}

export default function Vote() {
  useEffect(() => {
    document.title = 'QuikVote'
  }, [])
  const [options, setOptions] = useState([])
  const [config, setConfig] = useState({})
  const [vote, setVote] = useState({}) // set by voteType component. should follow shape for vote type defined in service/model/voteTypes.ts
  const [lockedIn, setLockedIn] = useState(false)
  const [isRoomOwner, setIsRoomOwner] = useState(false)
  const [resultsId, setResultsId] = useState('')
  const [code, setCode] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  
  // Alert state
  const [alert, setAlert] = useState({ show: false, message: '', type: 'info' })

  // Room state
  const [roomState, setRoomState] = useState('open')
  
  // Multi-round specific state
  const [currentRound, setCurrentRound] = useState(1)
  const [maxRounds, setMaxRounds] = useState(1)
  const [roundEnabled, setRoundEnabled] = useState(false)
  const [eliminatedOptions, setEliminatedOptions] = useState([])
  const [roundResults, setRoundResults] = useState([])
  const [waitingForNextRound, setWaitingForNextRound] = useState(false)
  const [roundComplete, setRoundComplete] = useState(false)

  const { id } = useParams()

  useEffect(() => {
    const fetchRoom = async () => {
      const response = await fetch(`/api/room/${id}`, {
        method: 'GET',
        headers: {
          'Content-type': 'application/json; charset=UTF-8'
        }
      })
      if (response.status == 200) {
        const body = await response.json()
        setCode(body.code)
        setConfig(body.config)
        setOptions(body.options)
        setIsRoomOwner(body.isOwner)
        setLockedIn(body.lockedIn)
        if (body.currentVote) {
          setVote(body.currentVote)
        }
        setResultsId(body.resultId)
        setRoomState(body.state || 'open')

        // Initialize round state
        if (body.config?.options?.enableRound) {
          setRoundEnabled(true)
          setMaxRounds(body.config.options.maxRounds || 1)
          setCurrentRound(body.currentRound || 1)

          // If we have round history, get the eliminated options
          if (body.roundHistory && body.roundHistory.length > 0) {
            // Collect all eliminated options from all previous rounds
            const allEliminatedOptions = body.roundHistory.flatMap(round => round.eliminatedOptions || []);
            setEliminatedOptions(allEliminatedOptions);

            // Store results from the most recent round
            const latestRound = body.roundHistory[body.roundHistory.length - 1];
            if (latestRound.result) {
              setRoundResults(latestRound.result);
            }
          }
        }
      }
    }
    fetchRoom()
      .then(() => {
        // After fetchRoom in case an anonymous user needs to be made before using websocket.
        WSHandler.connect()
      })
      .catch(console.error)

  }, [])

  useEffect(() => {
    WSHandler.addHandler(receiveEvent)

    return () => WSHandler.removeHandler(receiveEvent)
  })

  function receiveEvent(event) {
    console.log("WebSocket event received:", event)

    if (event.type == 'options') {
      const new_options = event.options
      if (options.length && new_options.length && options.length != new_options.length) {
        scrollToBottom()
      }
      setOptions(new_options)
    } else if (event.type == 'results-available') {
      setLockedIn(true)
      setResultsId(event.id || '')
      setRoundComplete(true)

      // If this is a round result
      if (event.isRoundResult) {
        setWaitingForNextRound(true)

        if (event.eliminatedOptions) {
          setEliminatedOptions(prev => [...prev, ...event.eliminatedOptions])
        }

        if (event.roundResults) {
          setRoundResults(event.roundResults)
        }
      }
    } else if (event.type == 'votes_unlocked') {
      setLockedIn(false)
    } else if (event.type == 'next_round_started') {
      // Reset state for next round
      setCurrentRound(event.roundNumber)
      // Handle remainingOptions as Option objects
      setOptions(Array.isArray(event.remainingOptions) ? event.remainingOptions : [])
      setLockedIn(false)
      setVote({})
      setResultsId('')
      setWaitingForNextRound(false)
      setRoundComplete(false)

      // Update round results and eliminated options if provided
      if (event.roundResults) {
        setRoundResults(event.roundResults)
      }

      if (event.eliminatedOptions) {
        setEliminatedOptions(prev => [...prev, ...event.eliminatedOptions])
      }
    } else if (event.type == 'round_completed') {
      // Handle round completion event (when round is completed but not yet advanced)
      setRoundComplete(true)
      setWaitingForNextRound(true)
      
      if (event.eliminatedOptions) {
        setEliminatedOptions(prev => [...prev, ...event.eliminatedOptions])
      }
      
      if (event.roundResults) {
        setRoundResults(event.roundResults)
      }
    } else if (event.type == 'preliminary_round_ended') {
      // Update room state when preliminary round ends
      setRoomState('open');
      setAlert({
        show: true,
        message: "The preliminary round has ended. Voting is now open!",
        type: 'info'
      });
      
      setTimeout(() => {
        setAlert(prev => ({ ...prev, show: false }))
      }, 5000);
    } else if (event.type == 'alert') {
      // Show the alert message
      setAlert({ 
        show: true, 
        message: event.message, 
        type: event.alertType || 'info' 
      })
      
      // Automatically hide the alert after 5 seconds
      setTimeout(() => {
        setAlert(prev => ({ ...prev, show: false }))
      }, 5000)
    }
  }

  function scrollToBottom() {
    const scrollDiv = document.getElementById("main-element")
    scrollDiv.scrollTop = scrollDiv.scrollHeight
  }

  async function addOption(optionText) {
    WSHandler.addOption(id, optionText)
  }

  function unlockVotes() {
    WSHandler.unlockVote(id)
  }

  function startNextRound() {
    WSHandler.startNextRound(id)
  }
  
  function endPreliminaryRound() {
    WSHandler.endPreliminaryRound(id)
  }

  function renderOptions() {
    if (code.length == 0) { // room hasn't loaded yet
      return (<p>Loading...</p>)
    }
    if (options.length == 0) {
      return (<p>Add an option...</p>)
    }
    return renderVote(config, options, vote, setVote, lockedIn, isRoomOwner)
  }

  function renderRoundIndicator() {
    // Show preliminary round indicator
    if (roomState === 'preliminary') {
      return (
        <div className="round-indicator">
          <span className="round-badge preliminary-badge">Preliminary Round</span>
          <span className="round-status">
            Add options before voting begins
          </span>
        </div>
      );
    }
    
    if (!roundEnabled) return null;

    return (
      <div className="round-indicator">
        <span className="round-badge">Round {currentRound} of {maxRounds}</span>
        <span className="round-status">
          {roundComplete ? "Round complete" : "Voting in progress"}
        </span>
      </div>
    )
  }

  function renderPreviousRoundResults() {
    if (!roundEnabled || currentRound === 1 || !roundResults || !roundResults.options) return null;

    // Show top options from previous round results
    const topOptions = roundResults.options.slice(0, 3).map(opt => opt.name);

    // Show eliminated options
    const latestEliminated = eliminatedOptions.slice(-config.options.eliminationCount);

    return (
      <div className="round-results-summary">
        <div className="round-results-title">Round {currentRound - 1} Results:</div>

        <p>Top options: {topOptions.join(', ')}</p>

        <div className="eliminated-options">
          <p>Eliminated options:</p>
          {latestEliminated.map((optionText, index) => (
            <span key={index} className="eliminated-option">{optionText}</span>
          ))}
        </div>
      </div>
    );
  }

  function renderButton() {
    // Check if we're in preliminary round mode
    if (roomState === 'preliminary') {
      if (isRoomOwner) {
        return (
          <button
            className="main__button"
            onClick={endPreliminaryRound}
          >
            End Preliminary Round & Begin Voting
            <span className="material-symbols-outlined" style={{marginLeft: '8px'}}>arrow_forward</span>
          </button>
        );
      } else {
        return (
          <div className="preliminary-message">
            <p>This is a preliminary round for adding options. Voting will begin when the room owner ends this phase.</p>
          </div>
        );
      }
    }
    
    // If we're waiting for the next round to start
    if (waitingForNextRound) {
      if (isRoomOwner && !config.options?.autoAdvance) {
        return (
          <button
            className="next-round-button"
            onClick={startNextRound}
          >
            Start Round {currentRound + 1}
            <span className="material-symbols-outlined">arrow_forward</span>
          </button>
        );
      }
      return (
        <button
          className="next-round-button next-round-button--disabled"
          disabled
        >
          Waiting for next round...
        </button>
      );
    }

    // Standard vote buttons
    const lockInButton = roomState === 'preliminary' ? (
      <button
        className="main__button main__button--disabled"
        disabled
      >
        Voting disabled during preliminary round
      </button>
    ) : (
      <button
        className="main__button"
        onClick={() => {
          setLockedIn(true)
          WSHandler.lockIn(id, { type: config.type, ...vote })
        }}
      >Lock in vote</button>
    )

    const lockedInButton = (
      <div className="button-group">
        <button
          className="main__button main__button--disabled"
          disabled
        >
          Locked in
        </button>
        <button
          className="main__button main__button--secondary"
          onClick={unlockVotes}
        >
          Unlock vote
        </button>
      </div>
    )

    const closeVoteButton = (<button
      className="main__button"
      onClick={() => WSHandler.closeRoom(id)}
    >Close vote</button>)

    const viewResultsButton = (<NavLink
      className="main__button"
      to={`/results/${resultsId}`}
    >View Results</NavLink>)

    if (!lockedIn) {
      return lockInButton
    }
    if (resultsId === '') {
      if (isRoomOwner) {
        return (
          <div className="button-group">
            {closeVoteButton}
            <button
              className="main__button main__button--secondary"
              onClick={unlockVotes}
            >
              Unlock vote
            </button>
          </div>
        )
      }
      return lockedInButton
    }

    // If this is the final round or rounds are not enabled
    if (!roundEnabled || currentRound >= maxRounds) {
      return viewResultsButton
    }

    // If rounds are enabled and this is not the final round
    if (isRoomOwner && !config.options?.autoAdvance) {
      return (
        <div className="button-group">
          {viewResultsButton}
          <button
            className="next-round-button"
            onClick={startNextRound}
          >
            Start Round {currentRound + 1}
            <span className="material-symbols-outlined">arrow_forward</span>
          </button>
        </div>
      )
    }

    return viewResultsButton
  }

  // Alert component
  const AlertNotification = () => {
    if (!alert.show) return null;
    
    const alertClasses = {
      info: 'alert alert--info',
      warning: 'alert alert--warning',
      error: 'alert alert--error'
    };
    
    return (
      <div className={alertClasses[alert.type] || alertClasses.info}>
        <span className="alert__message">{alert.message}</span>
        <button 
          className="alert__close" 
          onClick={() => setAlert(prev => ({ ...prev, show: false }))}
        >
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>
    );
  };

  return (
    <>
      <header className="header header--room-code" onClick={() => setModalOpen(true)}>
        <h3>Share this QuikVote!</h3>
        <span className="material-symbols-outlined">ios_share</span>
      </header>
      {alert.show && <AlertNotification />}
      <main className="main" id="main-element">
        {renderRoundIndicator()}

        <div className="vote-content">
          {renderPreviousRoundResults()}
          <ul className="vote-options">
            {renderOptions()}
          </ul>
        </div>
        {/* Determine whether to show add option based on room state and config */}
        {((roomState === 'preliminary' && config.options && 
             (config.options.allowNewOptions === 'everyone' || 
              config.options.allowNewOptions === 'votesPerPerson' || 
              isRoomOwner)) ||
           (roomState === 'open' && 
             ((config.options?.enablePreliminaryRound && isRoomOwner) || // After preliminary round, only owner can add
              (!config.options?.enablePreliminaryRound && // If no preliminary round, follow normal settings
                (config.options?.allowNewOptions === 'everyone' || 
                 config.options?.allowNewOptions === 'votesPerPerson' || 
                 isRoomOwner))))) &&
          (<AddOption onSubmit={addOption} disabled={lockedIn || waitingForNextRound} />)
        }
        {renderButton()}
      </main>
      <ShareModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        code={code}
        url={window.location.href}
      ></ShareModal>
    </>
  )
}

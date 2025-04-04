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
            if (latestRound.sortedOptions) {
              setRoundResults(latestRound.sortedOptions);
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
      setOptions(event.remainingOptions)
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
    }
  }

  function scrollToBottom() {
    const scrollDiv = document.getElementById("main-element")
    scrollDiv.scrollTop = scrollDiv.scrollHeight
  }

  async function addOption(opt) {
    WSHandler.addOption(id, opt)
  }

  function unlockVotes() {
    WSHandler.unlockVote(id)
  }

  function startNextRound() {
    WSHandler.startNextRound(id)
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
    if (!roundEnabled || currentRound === 1 || !roundResults.sortedOptions) return null;

    // Show top options from previous round results
    const topOptions = roundResults.sortedOptions.slice(0, 3);

    // Show eliminated options
    const latestEliminated = eliminatedOptions.slice(-config.options.eliminationCount);

    return (
      <div className="round-results-summary">
        <div className="round-results-title">Round {currentRound - 1} Results:</div>

        <p>Top options: {topOptions.join(', ')}</p>

        <div className="eliminated-options">
          <p>Eliminated options:</p>
          {latestEliminated.map((option, index) => (
            <span key={index} className="eliminated-option">{option}</span>
          ))}
        </div>
      </div>
    );
  }

  function renderButton() {
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
    const lockInButton = (<button
      className="main__button"
      onClick={() => {
        setLockedIn(true)
        WSHandler.lockIn(id, { type: config.type, ...vote })
      }}
    >Lock in vote</button>)

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

  return (
    <>
      <header className="header header--room-code" onClick={() => setModalOpen(true)}>
        <h3>Share this QuikVote!</h3>
        <span className="material-symbols-outlined">ios_share</span>
      </header>
      <main className="main" id="main-element">
        {renderRoundIndicator()}
        {renderPreviousRoundResults()}

        <ul className="vote-options">
          {renderOptions()}
        </ul>
        <AddOption onSubmit={addOption} disabled={lockedIn || waitingForNextRound} />
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

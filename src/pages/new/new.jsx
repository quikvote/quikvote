import React, { useEffect, useState } from 'react';
import './new.css';
import { NavLink, useNavigate } from 'react-router-dom';

const defaultConfig = {
  type: 'score',
  options: {
    numRunnerUps: -1,
    showNumVotes: true,
    showWhoVoted: false,

    // TODO: change these options based on vote type
    minVotesPerOption: 0,
    maxVotesPerOption: 10
  }
}

export default function New() {
  useEffect(() => {
    document.title = 'New QuikVote'
  }, [])
  const [config] = useState(defaultConfig)

  const navigate = useNavigate()

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
        <h1 className="header__title header__title--center">Create</h1>
      </header>
      <main className="main">
        <p className="room-code__note">Options go here</p>
        <button className="main__button" onClick={createRoom}>Begin QuikVote</button>
      </main>
    </>
  )
}

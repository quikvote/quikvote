import React, { useEffect, useState } from 'react';
import './vote.css';
import { NavLink, useParams } from 'react-router-dom';
import { WSHandler } from './websocket_handler'
import ShareModal from './shareModal'
import renderVote from './voteTypes/renderVote'

function AddOption({ onSubmit, disabled }) {
    const [value, setValue] = useState('')
    function submit() {
        onSubmit(value)
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
        return disabled || value == ''
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
    const [vote, setVote] = useState({})
    const [lockedIn, setLockedIn] = useState(false)
    const [isRoomOwner, setIsRoomOwner] = useState(false)
    const [resultsId, setResultsId] = useState('')
    const [code, setCode] = useState('')
    const [modalOpen, setModalOpen] = useState(false)

    const { id } = useParams()

    useEffect(() => {
        WSHandler.connect()
        const fetchRoom = async () => {
            const response = await fetch(`/api/room/${id}`, {
                method: 'GET',
                headers: {
                    'Content-type': 'application/json; charset=UTF-8'
                }
            })
            if (response.status == 200) {
                const body = await response.json()
                setCode(body.room.code)
                setConfig(body.room.config)
                // body.options.forEach(opt => {
                //     if (!values.has(opt)) {
                //         values.set(opt, 5)
                //     }
                // })
                // setValues(new Map(values))
                setOptions(body.room.options)
                setIsRoomOwner(body.isOwner)
            }
        }
        fetchRoom().catch(console.error)
    }, [])

    useEffect(() => {
        WSHandler.addHandler(receiveEvent)
        return () => WSHandler.removeHandler(receiveEvent)
    })

    function receiveEvent(event) {
        if (event.type == 'options') {
            const new_options = event.options
            // new_options.forEach(opt => {
            //     if (!values.has(opt)) {
            //         values.set(opt, 5)
            //     }
            // })
            // setValues(new Map(values))
            setOptions(new_options)
        } else if (event.type == 'results-available') {
            setLockedIn(true)
            setResultsId(event.id)
        }
    }

    async function addOption(name) {
        WSHandler.addOption(id, name)
    }
    function renderOptions() {
        if (code.length == 0) { // haven't got response from room endpoint yet
            return (<p>Loading...</p>)
        }
        if (options.length == 0) {
            return (<p>Add an option...</p>)
        }
        return renderVote(config, options, vote, setVote, lockedIn)
    }

    function renderButton() {
        const lockInButton = (<button
            className="main__button"
            onClick={() => {
                setLockedIn(true)
                WSHandler.lockIn(id, { type: config.type, ...vote })
            }}
        >Lock in vote</button>)
        const lockedInButton = (<button className="main__button main__button--disabled" disabled>Locked in</button>)
        const closeVoteButton = (<button
            className="main__button"
            onClick={() => WSHandler.closeRoom(id)}
        > Close vote</button >)
        const viewResultsButton = (<NavLink
            className="main__button"
            to={`/results/${resultsId}`}
        >View Results</NavLink>)

        if (!lockedIn) {
            return lockInButton
        }
        if (resultsId === '') {
            if (isRoomOwner) { return closeVoteButton }
            return lockedInButton
        }
        return viewResultsButton
    }

    return (
        <>
            <header className="header header--room-code" onClick={() => setModalOpen(true)}>
                <h3>Share this QuikVote!</h3>
                <span className="material-symbols-outlined">ios_share</span>
            </header>
            <main className="main">
                <ul className="vote-options">
                    {renderOptions()}
                </ul>
                <AddOption onSubmit={addOption} disabled={lockedIn} />
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

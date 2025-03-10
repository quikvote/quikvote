import React, { useContext, useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { UserContext } from '../../../context/userContext';
import { MessageDialog } from '../messageDialog';

export default function AnonymousLogin() {
    useEffect(() => {
        document.title = 'Anonymous Login'
    }, [])

    const [nickname, setNickname] = useState('')
    const [displayError, setDisplayError] = React.useState(null);

    const { setCurrentUser } = useContext(UserContext)
    const navigate = useNavigate()

    async function registerAnonymously(event) {
        event.preventDefault()

        // Generate random UUID for username and password
        const uuid = crypto.randomUUID()
        const anonymousUsername = `anon_${uuid}`
        const anonymousPassword = uuid

        const response = await fetch('/api/register', {
            method: 'POST',
            body: JSON.stringify({
                username: anonymousUsername,
                password: anonymousPassword,
                nickname: nickname
            }),
            headers: {
                'Content-type': 'application/json; charset=UTF-8',
            }
        })

        const body = await response.json();
        if (response.status === 201) {
            setCurrentUser({ username: anonymousUsername, nickname })
            navigate('/')
        } else {
            setDisplayError(`⚠ Error: ${body.msg}`);
        }
    }

    return (
        <>
            <header className="header header--center-with-back">
                <nav>
                    <ul className="header__nav-list">
                        <li>
                            <NavLink className="header__nav-link" to="/login">
                                <span className="material-symbols-outlined">arrow_back</span>
                            </NavLink>
                        </li>
                    </ul>
                </nav>
                <h1 className="header__title header__title--center">Anonymous Login</h1>
            </header>
            <main className="main">
                <div className="login">
                    <form className="login__form">
                        <label className="login-field__label" htmlFor="nickname">
                            Choose a Nickname
                        </label>
                        <input
                            className="login-field__input"
                            id="nickname"
                            name="nickname"
                            type="text"
                            value={nickname}
                            onChange={(event) => setNickname(event.target.value)}
                            placeholder="Enter your nickname"
                            required
                        />
                        <button
                            className="main__button"
                            onClick={registerAnonymously}
                        >
                            Continue Anonymously
                        </button>
                    </form>
                </div>
            </main>

            <MessageDialog
                message={displayError}
                onHide={() => setDisplayError(null)}
            />
        </>
    )
}
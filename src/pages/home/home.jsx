import React, { useContext, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { UserContext } from '../../context/userContext';

export default function Home() {
  useEffect(() => {
    document.title = 'QuikVote'
  }, [])
  const { currentUser } = useContext(UserContext)

  return (
    <>
      <header className="header">
        <h1 className="header__title">QuikVote</h1>
        <nav>
          <ul className="header__nav-list">
            {currentUser && (
              <li>
                <NavLink className="header__nav-link" to='history'>
                  <span className="material-symbols-outlined">history</span>
                </NavLink>
              </li>
            )}
            <li>
              <NavLink className="header__nav-link" to='login'>
                <span className="material-symbols-outlined">account_circle</span>
              </NavLink>
            </li>
          </ul>
        </nav>
      </header>
      <div className='logo__bg'>
        <h1 className='logo'>QuikVote</h1>
      </div>
      <main className="main">
        {currentUser && (
          <>
            <NavLink className="main__button" to="/new">New QuikVote</NavLink>
            <NavLink className="main__button" to="/join">Join QuikVote</NavLink>
          </>
        )}
        {!currentUser &&
          <>
            <NavLink className="home__button" to="/login">Login/Register</NavLink>
            <p style={{color: '#8a97b8'}}>- or -</p>
            <p>
              <NavLink className="home__link" to="/login/anonymous">Continue without signing in</NavLink>
            </p>
          </>
        }
      </main>
    </>
  )
}

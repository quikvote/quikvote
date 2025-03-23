import React, { useEffect, useState } from 'react';
import './results.css';
import { NavLink, useParams } from 'react-router-dom';
import BarGraph from '../../components/barGraph';

export default function Results() {
  useEffect(() => {
    document.title = 'Results'
  }, [])
  const [items, setItems] = useState([])
  const [totals, setTotals] = useState([])
  const [users, setUsers] = useState([])
  const [usersVotes, setUsersVotes] = useState([])
  const { id: resultsId } = useParams()
  useEffect(() => {
    const fetchItems = async () => {
      const response = await fetch(`/api/results/${resultsId}`, {
        method: 'GET',
        headers: {
          'Content-type': 'application/json; charset=UTF-8'
        }
      })
      const body = await response.json()
      setItems(body.results)
      if (body.totals) {
        setTotals(body.totals);
      }
      if (body.users) {
        setUsers(body.users);
        console.log("Sorted list of Users who voted for each option:\n", body.users);
      }
      if (body.usersVotes) {
        setUsersVotes(body.usersVotes);
        console.log("Sorted list of each Users' vote totals for each option:\n", body.usersVotes);
      }
    }

    fetchItems().catch(console.error)
  }, [])
  return (
    <>
      <header className="header header--center">
        <h1 className="header__title header__title--center">Results</h1>
      </header>
      <main className="main">
        <h2>{items[0] ?? ''} wins!</h2>
        <BarGraph items={items} totals={totals} users={users} usersVotes={usersVotes} />
        <NavLink className="main__button" to="/">Home</NavLink>
      </main>
    </>
  )
}

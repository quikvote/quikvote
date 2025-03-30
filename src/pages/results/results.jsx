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
      /*
      Currently this value will always been given by the server even if the showTotals option is false.
      */
      if (body.totals) {
        setTotals(body.totals);
      }

      /*
      This is an array of an array of strings. The outer array corresponds to the options, sorted in the same order as the options array from the same body.
      Each inner array is the users who voted for each option. The order is the order that was given by the server when it was aggregated and has not particular significance.
      This list will be empty if the option showWhoVted is false.
      */
      if (body.users) {
        setUsers(body.users);
        console.log("Sorted list of Users who voted for each option:\n", users);
      }

      /*
      This is an array of an array of numbers. The outer array corresponds to the options, sorted in the same order as the options array from the same body.
      Each inner array is the number of votes, or the ranking given to each option by each user. The order of these numbers is the same as the users double array
        *When it is a rank or top choices vote, the number is the rank, not the calculate points. So if a user specified an option as their 1st choice, it have the value of '1'
      This list will be empty if the voting method is incompatible (approval voting, since it's always 1), or if either showWhoVoted or Totals is false
      */
      if (body.usersVotes) {
        setUsersVotes(body.usersVotes);
        console.log("Sorted list of each Users' vote totals for each option:\n", usersVotes);
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

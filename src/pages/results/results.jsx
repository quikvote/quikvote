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
    }

    fetchItems().catch(console.error)
  }, [])
  function renderItems() {
    return items.map((item, i) => (
      <li className="results-list__item" key={i}>{item}<div className="quantity">{totals[i]} votes</div></li>
    ))
  }
  return (
    <>
      <header className="header header--center">
        <h1 className="header__title header__title--center">Results</h1>
      </header>
      <main className="main">
        <h2>{items[0] ?? ''} wins!</h2>
        <BarGraph items={items} totals={totals}/>
        <NavLink className="main__button" to="/">Home</NavLink>
      </main>
    </>
  )
}

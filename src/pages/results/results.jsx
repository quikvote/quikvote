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
    const [winner, setWinner] = useState('')
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
            setWinner(body.winner)
            const sortedDetails = Object.entries(body.details).sort(([, a], [, b]) => b - a);
            setItems(sortedDetails.map(([key]) => key))
            setTotals(sortedDetails.map(([, value]) => value))
        }

        fetchItems().catch(console.error)
    }, [])
    return (
        <>
            <header className="header header--center">
                <h1 className="header__title header__title--center">Results</h1>
            </header>
            <main className="main">
                <h2>{winner} wins!</h2>
                <BarGraph items={items} totals={totals} />
                <NavLink className="main__button" to="/">Home</NavLink>
            </main>
        </>
    )
}

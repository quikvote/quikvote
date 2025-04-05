import React, { useEffect, useState } from 'react';
import './results.css';
import { NavLink, useParams } from 'react-router-dom';
import BarGraph from '../../components/barGraph';
import PieChart from '../../components/pieChart';
import PodiumView from '../../components/podiumView';
import '../../components/podiumView.css';

export const RESULT_TYPES = {
  BAR_GRAPH: 'bar',
  PIE_CHART: 'pie',
  PODIUM: 'podium'
};

export default function Results() {
  useEffect(() => {
    document.title = 'Results'
  }, [])
  const [items, setItems] = useState([])
  const [totals, setTotals] = useState([])
  const [voters, setVoters] = useState({})
  const [roomConfig, setRoomConfig] = useState({
    numRunnerUps: -1,
    showNumVotes: true,
    showWhoVoted: false,
    resultType: RESULT_TYPES.BAR_GRAPH
  })
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
      
      // Extract room configuration if available
      if (body.config) {
        setRoomConfig({
          numRunnerUps: body.config.numRunnerUps ?? -1,
          showNumVotes: body.config.showNumVotes ?? true,
          showWhoVoted: body.config.showWhoVoted ?? false,
          resultType: body.config.resultType ?? RESULT_TYPES.BAR_GRAPH
        });
        console.log("Result type from API:", body.config.resultType);
      }
      
      let displayItems = [...body.results]
      let displayTotals = [...(body.totals || [])]

      if (roomConfig.numRunnerUps >= 0 && displayItems.length > roomConfig.numRunnerUps + 1) {
        displayItems = displayItems.slice(0, roomConfig.numRunnerUps + 1)
        if (displayTotals.length) {
          displayTotals = displayTotals.slice(0, roomConfig.numRunnerUps + 1)
        }
      }
      
      setItems(displayItems)
      if (displayTotals.length) {
        setTotals(displayTotals)
      }

      if (body.voters) {
        setVoters(body.voters)
      }
    }

    fetchItems().catch(console.error)
  }, [resultsId])

  const renderVisualization = () => {
    const visualizationProps = {
      items,
      totals,
      showNumVotes: roomConfig.showNumVotes
    };

    console.log("Current visualization type:", roomConfig.resultType);
    
    switch (roomConfig.resultType) {
      case RESULT_TYPES.PIE_CHART:
        console.log("Rendering pie chart");
        return <PieChart {...visualizationProps} />;
      case RESULT_TYPES.PODIUM:
        console.log("Rendering podium view");
        return <PodiumView {...visualizationProps} />;
      case RESULT_TYPES.BAR_GRAPH:
      default:
        console.log("Rendering bar graph (default)");
        return <BarGraph {...visualizationProps} />;
    }
  };

  const renderVoters = () => {
    if (!roomConfig.showWhoVoted || Object.keys(voters).length === 0) {
      return null;
    }

    return (
      <div className="voters-container">
        <h3>Who Voted</h3>
        <div className="voters-grid">
          {items.map((option, index) => (
            <div key={index} className="option-voters">
              <div className="option-name">{option}</div>
              {voters[option] && voters[option].length > 0 ? (
                <div className="voters-list">
                  {voters[option].map((voter, i) => (
                    <span key={i} className="voter">{voter}</span>
                  ))}
                </div>
              ) : (
                <div className="no-voters">No votes</div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <>
      <header className="header header--center">
        <h1 className="header__title header__title--center">Results</h1>
      </header>
      <main className="main">
        <div className="results-layout">
          <div className="results-main">
            <h2>{items[0] ?? ''} wins!</h2>
            {renderVisualization()}
            
            <NavLink className="main__button" to="/">Home</NavLink>
          </div>

          {roomConfig.showWhoVoted && (
            <div className="results-sidebar">
              {renderVoters()}
            </div>
          )}
        </div>
      </main>
    </>
  )
}

import React, { useEffect, useState } from 'react';
import './results.css';
import { NavLink, useParams } from 'react-router-dom';
import BarGraph from '../../components/barGraph';
import ReactApexChart from 'react-apexcharts';

// Podium component for showing winners
const Podium = ({ options }) => {
  // Get top 5 options (or as many as we have)
  const topOptions = options.slice(0, 5);
  const maxHeight = 200; // Maximum height for first place
  const maxVotes = topOptions.length > 0 ? topOptions[0].votes : 0;
  
  // Calculate heights proportionally
  const getHeight = (votes) => {
    if (maxVotes === 0) return 50; // Default minimum height
    return Math.max(50, (votes / maxVotes) * maxHeight);
  };

  // Get color based on position - blue gradient
  const getColor = (index) => {
    const blueGradients = [
      '#0a2463', // Very dark blue
      '#1e40af', // Dark blue
      '#3b82f6', // Medium blue
      '#60a5fa', // Light blue
      '#93c5fd'  // Very light blue
    ];
    return blueGradients[index] || '#dbeafe'; // Default lightest blue
  };
  
  // Get ordinal string (1st, 2nd, 3rd, etc)
  const getOrdinal = (position) => {
    if (position === 1) return '1st';
    if (position === 2) return '2nd';
    if (position === 3) return '3rd';
    return `${position}th`;
  };

  return (
    <div className="podium-container">
      <div className="podium-places">
        {topOptions.map((option, index) => (
          <div key={index} className={`podium-place place-${index + 1}`}>
            <div className="podium-name" title={option.name}>
              {option.name.length > 12 ? option.name.substring(0, 10) + '...' : option.name}
            </div>
            <div className="podium-score">{option.votes}</div>
            <div 
              className="podium-pillar" 
              style={{
                height: `${getHeight(option.votes)}px`,
                backgroundColor: getColor(index)
              }}
            >
              {getOrdinal(index + 1)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Pie Chart component
const PieChart = ({ options }) => {
  const series = options.map(option => option.votes);
  const labels = options.map(option => option.name);
  
  // Blue gradient colors for pie slices
  const getBlueColors = () => {
    // Blue gradient colors (from darkest to lightest)
    const blueGradients = [
      '#0a2463', // Very dark blue
      '#1e40af', // Dark blue
      '#3b82f6', // Medium blue
      '#60a5fa', // Light blue
      '#93c5fd'  // Very light blue
    ];
    
    // Default color for remaining items
    const defaultColor = '#dbeafe'; // Lightest blue
    
    // Create an array of colors based on position
    return options.map((_, index) => {
      return index < blueGradients.length ? blueGradients[index] : defaultColor;
    });
  };
  
  const chartOptions = {
    chart: {
      type: 'pie',
    },
    labels: labels,
    colors: getBlueColors(),
    legend: {
      position: 'bottom',
      fontSize: '14px'
    },
    tooltip: {
      y: {
        formatter: function(value) {
          return value + ' votes';
        }
      }
    },
    responsive: [{
      breakpoint: 480,
      options: {
        chart: {
          width: 300
        },
        legend: {
          position: 'bottom'
        }
      }
    }]
  };

  return (
    <div>
      <ReactApexChart options={chartOptions} series={series} type="pie" height={325} />
    </div>
  );
};

// Modified BarGraph wrapper to work with new data structure
const BarGraphWrapper = ({ options }) => {
  const items = options.map(option => option.name);
  const totals = options.map(option => option.votes);
  
  return <BarGraph items={items} totals={totals} />;
};

// VoterList component to show who voted for each option
const VoterList = ({ options, voteType }) => {
  // Get label for vote count based on vote type
  const getVoteLabel = () => {
    switch (voteType) {
      case 'rank':
        return 'Points';
      case 'topChoices':
        return 'Points';
      case 'approval':
        return 'Approved';
      case 'quadratic':
        return 'Votes';
      case 'score':
      default:
        return 'Points';
    }
  };

  return (
    <div className="voters-container">
      <h3>Voter Breakdown</h3>
      <div className="vote-type-info">
        {voteType && <p><strong>Vote type:</strong> {voteType}</p>}
        <p className="vote-count-label">The number in each voter badge shows {getVoteLabel().toLowerCase()} given</p>
      </div>
      {options.map((option, index) => (
        <div key={index} className="voter-option">
          <h4>{option.name}</h4>
          <div className="voter-dots">
            {option.voters.map((voter, voterIndex) => {
              const displayName = voter.nickname || voter.username;
              
              return (
                <div 
                  key={voterIndex} 
                  className="voter-oval"
                  data-vote-count={voter.votes}
                  title={`${displayName}: ${voter.votes} ${getVoteLabel()}`}
                >
                  <span className="voter-name">{displayName}</span>
                  <span className="voter-count">{voter.votes}</span>
                  <span className="voter-tooltip">
                    {displayName}: {voter.votes} {getVoteLabel()}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default function Results() {
  useEffect(() => {
    document.title = 'Results'
  }, [])
  const [options, setOptions] = useState([])
  const [resultDisplayType, setResultDisplayType] = useState('bar') // Default to bar chart
  const [showWhoVoted, setShowWhoVoted] = useState(false)
  const [voteType, setVoteType] = useState('') // To store the vote type
  const { id: resultsId } = useParams()
  
  useEffect(() => {
    const fetchResults = async () => {
      const response = await fetch(`/api/results/${resultsId}`, {
        method: 'GET',
        headers: {
          'Content-type': 'application/json; charset=UTF-8'
        }
      })
      const body = await response.json()
      
      if (body.options) {
        setOptions(body.options);
        
        // Determine if we should show who voted
        const hasVoters = body.options.some(option => 
          option.voters && option.voters.length > 0
        );
        setShowWhoVoted(hasVoters);
      }
      
      // Set the display type from the config if available
      if (body.config && body.config.options && body.config.options.resultDisplayType) {
        setResultDisplayType(body.config.options.resultDisplayType);
        console.log("Setting result display type to:", body.config.options.resultDisplayType);
      } else {
        console.log("No result display type found in config:", body.config);
      }
      
      // Store the vote type if available
      if (body.config && body.config.type) {
        setVoteType(body.config.type);
        console.log("Vote type:", body.config.type);
      }
    }

    fetchResults().catch(console.error)
  }, [resultsId])

  // Render the appropriate graph based on display type
  const renderResultsGraph = () => {
    // Make sure we have data to display
    if (!options || options.length === 0) {
      return <div>Loading results...</div>;
    }

    console.log(`Rendering result display type: ${resultDisplayType}`);
    
    switch (resultDisplayType) {
      case 'pie':
        return <PieChart options={options} />;
      case 'podium':
        return <Podium options={options} />;
      case 'bar':
      default:
        return <BarGraphWrapper options={options} />;
    }
  };

  // Get the winner
  const winner = options.length > 0 ? options[0].name : '';

  return (
    <>
      <header className="header header--center">
        <h1 className="header__title header__title--center">Results</h1>
      </header>
      <main className="main">
        <h2>{winner} wins!</h2>
        
        <div className="results-container">
          <div className="results-graph">
            {renderResultsGraph()}
          </div>
          
          {showWhoVoted && (
            <div className="results-voters">
              <VoterList options={options} voteType={voteType} />
            </div>
          )}
        </div>
        
        <NavLink className="main__button" to="/">Home</NavLink>
      </main>
    </>
  )
}

import React from 'react';
import './visualizations.css';

export default function PodiumView({ items = [], totals = [], showNumVotes = true }) {
  if (items.length === 0) return null;
  
  return (
    <div className="podium-container">
      {items.map((item, index) => {
        // Determine podium position class
        let positionClass = 'podium-position';
        if (index === 0) positionClass += ' podium-gold';
        else if (index === 1) positionClass += ' podium-silver';
        else if (index === 2) positionClass += ' podium-bronze';
        
        // Calculate height - winner has max height, others are proportional
        const maxHeight = 180; // Max height in pixels
        const maxValue = Math.max(...totals);
        const height = maxValue > 0 ? (totals[index] / maxValue) * maxHeight : 50;
        
        // Determine medal emoji
        let medal = '';
        if (index === 0) medal = '🥇';
        else if (index === 1) medal = '🥈';
        else if (index === 2) medal = '🥉';
        
        return (
          <div key={index} className={positionClass}>
            <div className="podium-name-container">
              <div className="podium-medal">{medal}</div>
              <div className="podium-name">{item}</div>
              {showNumVotes && (
                <div className="podium-votes">{totals[index]} votes</div>
              )}
            </div>
            <div 
              className="podium-block" 
              style={{ height: `${height}px` }}
            >
              <div className="podium-rank">{index + 1}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
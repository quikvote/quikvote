import React, { useEffect, useState } from 'react';
import './quadratic.css';
import RemoveOptionButton from '../removeOptionButton';

export default function QuadraticVote({ config, options, vote, setVote, disabled, isRoomOwner }) {
    // Get the credit budget from config, default to 100 if not specified
    const creditBudget = config.options?.creditBudget || 100;

    // State to track remaining credits
    const [remainingCredits, setRemainingCredits] = useState(creditBudget);

    // Helper function to calculate the cost of votes
    // Cost = votes^2
    const calculateCost = (votes) => {
        return votes * votes;
    };

    // Initialize from existing vote if it exists
    useEffect(() => {
        if (!vote.votes) {
            // Initialize with zero votes for each option
            const initialVotes = {};
            options.forEach(option => {
                initialVotes[option.text] = 0;
            });
            setVote({
                votes: initialVotes,
                costs: {}
            });
            setRemainingCredits(creditBudget);
        } else {            
            // Filter out deleted options from votes and costs
            const filteredVotes = Object.fromEntries(
                Object.entries(vote.votes || {}).filter(([optionText]) => options.some(opt => opt.text === optionText))
            );
            const filteredCosts = Object.fromEntries(
                Object.entries(vote.costs || {}).filter(([optionText]) => options.some(opt => opt.text === optionText))
            );

            setVote({
                votes: filteredVotes,
                costs: filteredCosts
            });

            // Calculate remaining credits
            let usedCredits = 0;
            Object.values(filteredCosts || {}).forEach(cost => {
                usedCredits += cost;
            });
            setRemainingCredits(creditBudget - usedCredits);
        }
    }, [options, creditBudget]);

    const incrementVote = (optionText) => {
        if (disabled) return;

        const currentVotes = vote.votes[optionText] || 0;
        const newVotes = currentVotes + 1;

        // Calculate the additional cost for increasing the vote
        const additionalCost = calculateCost(newVotes) - calculateCost(currentVotes);

        // Check if we have enough credits
        if (additionalCost > remainingCredits) {
            return; // Not enough credits
        }

        // Update votes and costs
        const newCosts = { ...(vote.costs || {}) };
        newCosts[optionText] = calculateCost(newVotes);

        setVote({
            votes: {
                ...vote.votes,
                [optionText]: newVotes
            },
            costs: newCosts
        });

        setRemainingCredits(prev => prev - additionalCost);
    };

    const decrementVote = (optionText) => {
        if (disabled) return;

        const currentVotes = vote.votes[optionText] || 0;
        if (currentVotes <= 0) return;

        const newVotes = currentVotes - 1;

        // Calculate the cost reduction
        const costReduction = calculateCost(currentVotes) - calculateCost(newVotes);

        // Update votes and costs
        const newCosts = { ...(vote.costs || {}) };
        newCosts[optionText] = calculateCost(newVotes);

        setVote({
            votes: {
                ...vote.votes,
                [optionText]: newVotes
            },
            costs: newCosts
        });

        setRemainingCredits(prev => prev + costReduction);
    };

    // Calculate total used credits
    const totalUsedCredits = creditBudget - remainingCredits;
    const percentUsed = (totalUsedCredits / creditBudget) * 100;

    return (
        <>
            <div className="quadratic-instructions">
                <p>Distribute your voice credits across options. Each vote costs the square of the number of votes.</p>
                <div className="credit-display">
                    <div className="credit-label">Credits remaining: {remainingCredits} of {creditBudget}</div>
                    <div className="credit-bar">
                        <div
                            className="credit-bar-filled"
                            style={{ width: `${percentUsed}%` }}
                        ></div>
                    </div>
                </div>
            </div>

            {options.map((option, index) => {
                const voteCount = vote.votes?.[option.text] || 0;
                const voteCost = vote.costs?.[option.text] || 0;

                return (
                    <li key={index} className="vote-options__item quadratic-item">
                        <div className="option-name">{option.text}</div>

                        <div className="quadratic-controls">
                            <div className="vote-info">
                                <div className="vote-count">{voteCount}</div>
                                <div className="vote-cost">Cost: {voteCost} credits</div>
                            </div>

                            <div className="vote-buttons">
                                <button
                                    className={`vote-button ${disabled ? 'vote-button--disabled' : ''}`}
                                    onClick={() => decrementVote(option.text)}
                                    disabled={disabled || voteCount <= 0}
                                >
                                    <span className="material-symbols-outlined">remove</span>
                                </button>
                                <button
                                    className={`vote-button ${disabled ? 'vote-button--disabled' : ''}`}
                                    onClick={() => incrementVote(option.text)}
                                    disabled={disabled || remainingCredits < (2 * voteCount + 1)}
                                >
                                    <span className="material-symbols-outlined">add</span>
                                </button>
                            </div>
                            <RemoveOptionButton isRoomOwner={isRoomOwner} disabled={disabled} option={option} />
                        </div>
                    </li>
                );
            })}

            <div className="quadratic-summary">
                <table className="cost-table">
                    <thead>
                    <tr>
                        <th>Votes</th>
                        <th>Cost</th>
                    </tr>
                    </thead>
                    <tbody>
                    {[1, 2, 3, 4, 5].map(votes => (
                        <tr key={votes}>
                            <td>{votes}</td>
                            <td>{calculateCost(votes)} credits</td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>
        </>
    );
}

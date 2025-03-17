import React, { useEffect, useState } from 'react';
import '../vote.css';

export default function RankVote({ config, options, vote, setVote, disabled }) {
    const [draggedItem, setDraggedItem] = useState(null);
    const [rankedItems, setRankedItems] = useState([]);

    // Initialize the ranked items when options change or on first load
    useEffect(() => {
        if (options.length > 0) {
            // If we have existing rankings, use them
            if (vote.rankings && Object.keys(vote.rankings).length > 0) {
                // Sort options based on existing rankings
                const sortedOptions = [...options].sort((a, b) => {
                    return (vote.rankings[a] || Number.MAX_VALUE) - (vote.rankings[b] || Number.MAX_VALUE);
                });
                setRankedItems(sortedOptions);
            } else {
                // Otherwise use the options as they come
                setRankedItems([...options]);

                // Initialize rankings object with default values (position in array)
                const initialRankings = {};
                options.forEach((name, index) => {
                    initialRankings[name] = index + 1;
                });

                setVote({
                    rankings: initialRankings
                });
            }
        }
    }, [options]);

    // Update vote state when rankedItems change
    useEffect(() => {
        if (rankedItems.length > 0) {
            const newRankings = {};
            rankedItems.forEach((name, index) => {
                newRankings[name] = index + 1;
            });

            setVote({
                rankings: newRankings
            });
        }
    }, [rankedItems]);

    const handleDragStart = (e, index) => {
        if (disabled) return;
        setDraggedItem(index);
        // For better drag appearance
        e.dataTransfer.effectAllowed = "move";
        // This makes the drag image transparent in most browsers
        setTimeout(() => {
            e.target.style.opacity = '0.5';
        }, 0);
    };

    const handleDragEnd = (e) => {
        if (disabled) return;
        e.target.style.opacity = '1';
        setDraggedItem(null);
    };

    const handleDragOver = (e, index) => {
        e.preventDefault();
        if (disabled) return;
        if (draggedItem === null) return;
        if (draggedItem === index) return;

        const newRankedItems = [...rankedItems];
        const item = newRankedItems[draggedItem];
        newRankedItems.splice(draggedItem, 1);
        newRankedItems.splice(index, 0, item);

        setDraggedItem(index);
        setRankedItems(newRankedItems);
    };

    if (rankedItems.length === 0) {
        return <p>Loading rankings...</p>;
    }

    return (
        <>
            {rankedItems.map((name, index) => (
                <li
                    key={index}
                    className={`vote-options__item vote-options__item--draggable ${disabled ? 'vote-options__item--disabled' : ''} ${draggedItem === index ? 'vote-options__item--dragging' : ''}`}
                    draggable={!disabled}
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => handleDragOver(e, index)}
                >
                    <div className="rank-display">
                        <span className="rank-number">{index + 1}</span>
                    </div>
                    <div className="rank-item-name">{name}</div>
                    {!disabled && (
                        <span className="material-symbols-outlined drag-handle">drag_indicator</span>
                    )}
                </li>
            ))}
            <div className="rank-instructions">
                {disabled ?
                    <p>Your rankings are locked in.</p> :
                    <p>Drag items to rank them - top item is your first choice.</p>
                }
            </div>
        </>
    );
}
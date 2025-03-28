import React, { useEffect, useState } from 'react';
import './topChoices.css';
import RemoveOptionButton from '../removeOptionButton';

export default function TopChoicesVote({ config, options, vote, setVote, disabled, isRoomOwner }) {
    // Get the number of choices from config, default to 3 if not specified
    const numberOfChoices = config.options?.numberOfChoices || 3;

    // Initialize selections state
    const [selections, setSelections] = useState({});

    // Helper to get ordinal suffix for numbers (1st, 2nd, 3rd, etc.)
    const getOrdinalSuffix = (num) => {
        const j = num % 10;
        const k = num % 100;
        if (j === 1 && k !== 11) {
            return num + "st";
        }
        if (j === 2 && k !== 12) {
            return num + "nd";
        }
        if (j === 3 && k !== 13) {
            return num + "rd";
        }
        return num + "th";
    };

    // Generate positions array (e.g., ["first", "second", "third", ...])
    const positions = Array.from({ length: numberOfChoices }, (_, i) => {
        switch (i) {
            case 0: return "first";
            case 1: return "second";
            case 2: return "third";
            default: return `choice${i + 1}`;
        }
    });

    // Initialize from existing vote if it exists
    useEffect(() => {
        if (vote.topChoices) {
            // Initialize with existing vote data
            setSelections({ ...vote.topChoices });
        } else {
            // Create empty selections object
            const initialSelections = {};
            positions.forEach(position => {
                initialSelections[position] = null;
            });
            setSelections(initialSelections);
        }
    }, []);

    // Update vote state when selections change
    useEffect(() => {
        if (Object.keys(selections).length > 0) {
            setVote({
                topChoices: { ...selections }
            });
        }
    }, [selections]);

    // Handle a removed vote
    useEffect(() => {
        if (selections) {
            const filteredSelections = Object.fromEntries(
                Object.entries(selections).filter(([key, value]) => options.includes(value))
            );
            setSelections(filteredSelections);
        }
    }, [options])

    const handleSelection = (option, position) => {
        if (disabled) return;

        // If this option is already selected in another position, remove it from there
        const newSelections = { ...selections };

        Object.keys(newSelections).forEach(key => {
            if (newSelections[key] === option && key !== position) {
                newSelections[key] = null;
            }
        });

        // Toggle selection for the current position
        if (newSelections[position] === option) {
            newSelections[position] = null;
        } else {
            newSelections[position] = option;
        }

        setSelections(newSelections);
    };

    const isSelectedAnywhere = (option) => {
        return Object.values(selections).includes(option);
    };

    const getPositionLabel = (option) => {
        for (let i = 0; i < positions.length; i++) {
            if (selections[positions[i]] === option) {
                return getOrdinalSuffix(i + 1);
            }
        }
        return "";
    };

    return (
        <>
            <div className="top-choices-instructions">
                <p>Select your top {numberOfChoices} choices in order of preference:</p>
            </div>

            <div className="selection-indicators">
                {positions.map((position, index) => (
                    <div key={position} className="selection-indicator">
                        <span className="indicator-label">{getOrdinalSuffix(index + 1)} Choice:</span>
                        <span className="indicator-value">{selections[position] || "Not selected"}</span>
                    </div>
                ))}
            </div>

            {options.map((name, index) => (
                <li key={index} className="vote-options__item top-choices-item">
                    <span className="option-name">{name}</span>

                    <div className="top-choices-buttons">
                        {isSelectedAnywhere(name) ? (
                            <div className="selected-badge">
                                {getPositionLabel(name)}
                            </div>
                        ) : (
                            <div className="selection-buttons">
                                {positions.map((position, posIndex) => (
                                    <button
                                        key={position}
                                        className={`selection-button ${disabled ? 'selection-button--disabled' : ''}`}
                                        onClick={() => handleSelection(name, position)}
                                        disabled={disabled}
                                    >
                                        {getOrdinalSuffix(posIndex + 1)}
                                    </button>
                                ))}
                            </div>
                        )}

                        {isSelectedAnywhere(name) && !disabled && (
                            <button
                                className="remove-selection-button"
                                onClick={() => {
                                    const newSelections = { ...selections };
                                    Object.keys(newSelections).forEach(key => {
                                        if (newSelections[key] === name) {
                                            newSelections[key] = null;
                                        }
                                    });
                                    setSelections(newSelections);
                                }}
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        )}
                        <RemoveOptionButton isRoomOwner={isRoomOwner} disabled={disabled} option={name} />
                    </div>
                </li>
            ))}
        </>
    );
}
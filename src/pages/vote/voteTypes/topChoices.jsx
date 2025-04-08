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
            // Convert option objects to option text strings
            const topChoicesStrings = Object.fromEntries(
                Object.entries(selections).map(([position, optionObj]) => 
                    [position, optionObj ? optionObj.text : null]
                )
            );
            
            setVote({
                topChoices: topChoicesStrings
            });
        }
    }, [selections]);

    // Handle a removed vote
    useEffect(() => {
        if (selections) {
            const filteredSelections = Object.fromEntries(
                Object.entries(selections).filter(([, value]) => value && options.some(opt => opt.text === value.text))
            );
            setSelections(filteredSelections);
        }
    }, [options])

    const handleSelection = (option, position) => {
        if (disabled) return;

        // If this option is already selected in another position, remove it from there
        const newSelections = { ...selections };

        Object.keys(newSelections).forEach(key => {
            if (newSelections[key]?.text === option.text && key !== position) {
                newSelections[key] = null;
            }
        });

        // Toggle selection for the current position
        if (newSelections[position]?.text === option.text) {
            newSelections[position] = null;
        } else {
            newSelections[position] = option;
        }

        setSelections(newSelections);
    };

    const isSelectedAnywhere = (option) => {
        return Object.values(selections).some(sel => sel && sel.text === option.text);
    };

    const getPositionLabel = (option) => {
        for (let i = 0; i < positions.length; i++) {
            if (selections[positions[i]] && selections[positions[i]].text === option.text) {
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
                        <span className="indicator-value">{selections[position] ? selections[position].text : "Not selected"}</span>
                    </div>
                ))}
            </div>

            {options.map((option, index) => (
                <li key={index} className="vote-options__item top-choices-item">
                    <span className="option-name">{option.text}</span>

                    <div className="top-choices-buttons">
                        {isSelectedAnywhere(option) ? (
                            <div className="selected-badge">
                                {getPositionLabel(option)}
                            </div>
                        ) : (
                            <div className="selection-buttons">
                                {positions.map((position, posIndex) => (
                                    <button
                                        key={position}
                                        className={`selection-button ${disabled ? 'selection-button--disabled' : ''}`}
                                        onClick={() => handleSelection(option, position)}
                                        disabled={disabled}
                                    >
                                        {getOrdinalSuffix(posIndex + 1)}
                                    </button>
                                ))}
                            </div>
                        )}

                        {isSelectedAnywhere(option) && !disabled && (
                            <button
                                className="remove-selection-button"
                                onClick={() => {
                                    const newSelections = { ...selections };
                                    Object.keys(newSelections).forEach(key => {
                                        if (newSelections[key] && newSelections[key].text === option.text) {
                                            newSelections[key] = null;
                                        }
                                    });
                                    setSelections(newSelections);
                                }}
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        )}
                        <RemoveOptionButton isRoomOwner={isRoomOwner} disabled={disabled} option={option} />
                    </div>
                </li>
            ))}
        </>
    );
}
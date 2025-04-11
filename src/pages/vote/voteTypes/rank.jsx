import React, { useEffect, useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import './rank.css';
import RemoveOptionButton from '../removeOptionButton';

export default function RankVote({ options, vote, setVote, disabled, isRoomOwner }) {
    const [rankedItems, setRankedItems] = useState([]);
    const [isTouchDevice, setIsTouchDevice] = useState(false);

    // Detect input type
    useEffect(() => {
        // Check pointer type with matchMedia
        const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
        const isTouchCapable = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

        // Set initial state: prioritize coarse pointer (touch) if present, else assume mouse
        setIsTouchDevice(isCoarsePointer || isTouchCapable);

        const handleTouchStart = () => setIsTouchDevice(true);
        const handleMouseDown = (e) => {
            // Ensure it's a mouse event, not a touch-emulated mouse event
            if (e.buttons === 1 && !e.pointerType?.includes('touch')) {
                setIsTouchDevice(false);
            }
        };

        window.addEventListener('touchstart', handleTouchStart);
        window.addEventListener('mousedown', handleMouseDown);

        return () => {
            window.removeEventListener('touchstart', handleTouchStart);
            window.removeEventListener('mousedown', handleMouseDown);
        };
    }, []);

    // Initialize ranked items from options or existing rankings
    useEffect(() => {
        if (options.length > 0) {
            if (vote.rankings && Object.keys(vote.rankings).length > 0) {
                const sortedOptions = [...options].sort((a, b) => {
                    return (vote.rankings[a.text] || Number.MAX_VALUE) - (vote.rankings[b.text] || Number.MAX_VALUE);
                });
                setRankedItems(sortedOptions);
            } else {
                setRankedItems([...options]);
                const initialRankings = {};
                options.forEach((option, index) => {
                    initialRankings[option.text] = index + 1;
                });
                setVote({ rankings: initialRankings });
            }
        }
    }, [options]);

    // Update vote state when rankedItems change
    useEffect(() => {
        if (rankedItems.length > 0) {
            const newRankings = {};
            rankedItems.forEach((option, index) => {
                newRankings[option.text] = index + 1;
            });
            setVote({ rankings: newRankings });
        }
    }, [rankedItems]);

    // Handle drag end event
    const onDragEnd = (result) => {
        if (disabled || !result.destination) return; // Exit if dropped outside or disabled

        const newRankedItems = [...rankedItems];
        const [movedItem] = newRankedItems.splice(result.source.index, 1);
        newRankedItems.splice(result.destination.index, 0, movedItem);
        setRankedItems(newRankedItems);
    };

    if (rankedItems.length === 0) {
        return <p>Loading rankings...</p>;
    }

    return (
        <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="ranked-list">
                {(provided) => (
                    <ul
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className="vote-options"
                    >
                        {rankedItems.map((option, index) => (
                            <Draggable
                                key={option.text} // Use name as key since it’s unique
                                draggableId={option.text}
                                index={index}
                                isDragDisabled={disabled}
                            >
                                {(provided, snapshot) => (
                                    <li
                                        ref={provided.innerRef}
                                        {...provided.draggableProps}
                                        {...(!isTouchDevice ? provided.dragHandleProps : {})}
                                        className={`vote-options__item vote-options__item--draggable ${disabled ? 'vote-options__item--disabled' : ''
                                            } ${snapshot.isDragging ? 'vote-options__item--dragging' : ''}`}
                                    >
                                        {!disabled && (
                                            <span {...(isTouchDevice ? provided.dragHandleProps : {})} className="material-symbols-outlined drag-handle">
                                                drag_indicator
                                            </span>
                                        )}
                                        <div className="rank-display">
                                            <span className="rank-number">{index + 1}</span>
                                        </div>
                                        <div className="rank-item-name">{option.text}</div>
                                        <RemoveOptionButton
                                            isRoomOwner={isRoomOwner}
                                            disabled={disabled}
                                            option={option}
                                        />
                                    </li>
                                )}
                            </Draggable>
                        ))}
                        {provided.placeholder}
                    </ul>
                )}
            </Droppable>
            <div className="rank-instructions">
                {disabled ? (
                    <p>Your rankings are locked in.</p>
                ) : (
                    <p>Drag items to rank them - top item is your first choice.</p>
                )}
            </div>
        </DragDropContext>
    );
}

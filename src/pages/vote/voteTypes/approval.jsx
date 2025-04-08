import React, { useEffect } from 'react';
import './approval.css';
import RemoveOptionButton from '../removeOptionButton';

export default function ApprovalVote({ options, vote, setVote, disabled, isRoomOwner }) {
    // Initialize from existing vote if it exists
    useEffect(() => {
        if (!vote.approvals) {
            // Initialize with empty approvals
            const initialApprovals = {};
            options.forEach(option => {
                initialApprovals[option.text] = false;
            });
            setVote({
                approvals: initialApprovals
            });
        }
    }, [options]);

    const toggleApproval = (optionText) => {
        if (disabled) return;

        setVote({
            approvals: {
                ...vote.approvals,
                [optionText]: !vote.approvals[optionText]
            }
        });
    };

    return (
        <>
            <div className="approval-instructions">
                <p>Select all options that you approve of:</p>
            </div>

            {options.map((option, index) => {
                return (
                    <li key={index} className="vote-options__item approval-item">
                        <div
                            className={`approval-checkbox ${vote.approvals?.[option.text] ? 'approval-checkbox--checked' : ''} ${disabled ? 'approval-checkbox--disabled' : ''}`}
                            onClick={() => toggleApproval(option.text)}
                        >
                            {vote.approvals?.[option.text] && (
                                <span className="material-symbols-outlined">check</span>
                            )}
                        </div>
                        <span className="option-name">{option.text}</span>
                        <RemoveOptionButton isRoomOwner={isRoomOwner} disabled={disabled} option={option} />
                    </li>
                );
            })}

            <div className="approval-summary">
                {vote.approvals && (
                    <p>You have approved {Object.values(vote.approvals).filter(Boolean).length} out of {options.length} options.</p>
                )}
            </div>
        </>
    );
}
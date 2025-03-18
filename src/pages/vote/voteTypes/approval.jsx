import React, { useEffect } from 'react';
import './approval.css';

export default function ApprovalVote({ options, vote, setVote, disabled }) {
    // Initialize from existing vote if it exists
    useEffect(() => {
        if (!vote.approvals) {
            // Initialize with empty approvals
            const initialApprovals = {};
            options.forEach(option => {
                initialApprovals[option] = false;
            });
            setVote({
                approvals: initialApprovals
            });
        }
    }, [options]);

    const toggleApproval = (option) => {
        if (disabled) return;

        setVote({
            approvals: {
                ...vote.approvals,
                [option]: !vote.approvals[option]
            }
        });
    };

    return (
        <>
            <div className="approval-instructions">
                <p>Select all options that you approve of:</p>
            </div>

            {options.map((name, index) => (
                <li key={index} className="vote-options__item approval-item">
                    <div
                        className={`approval-checkbox ${vote.approvals?.[name] ? 'approval-checkbox--checked' : ''} ${disabled ? 'approval-checkbox--disabled' : ''}`}
                        onClick={() => toggleApproval(name)}
                    >
                        {vote.approvals?.[name] && (
                            <span className="material-symbols-outlined">check</span>
                        )}
                    </div>
                    <span className="option-name">{name}</span>
                </li>
            ))}

            <div className="approval-summary">
                {vote.approvals && (
                    <p>You have approved {Object.values(vote.approvals).filter(Boolean).length} out of {options.length} options.</p>
                )}
            </div>
        </>
    );
}
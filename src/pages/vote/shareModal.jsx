import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import './shareModal.css';

export default function ShareModal({ isOpen, onClose, url, code }) {
    const [copiedFlags, setCopiedFlags] = useState({});

    useEffect(() => {
        setCopiedFlags({});
    }, [isOpen, url, code]);

    if (!isOpen) return null;

    const handleCopy = (content, key) => {
        navigator.clipboard.writeText(content)
            .then(() => {
                setCopiedFlags(prevFlags => ({
                    ...prevFlags,
                    [key]: true
                }));
                setTimeout(() => {
                    setCopiedFlags(prevFlags => ({
                        ...prevFlags,
                        [key]: false
                    }));
                }, 2000);
            })
            .catch(err => console.error('Failed to copy:', err));
    };

    const handleOverlayClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    return (
        <div className="modal-overlay" onClick={handleOverlayClick}>
            <div className="modal-content">
                <button className="modal-close-btn" onClick={onClose}>
                    <span className="material-symbols-outlined">
                        close
                    </span>
                </button>

                <div className="share-section">
                    <h2 className="share-title">Grab the Link!</h2>
                    <div className="qr-container">
                        <QRCodeSVG
                            value={url}
                            size={200}
                            level="H"
                        />
                    </div>
                    <div className="link-container">
                        <input
                            id="url"
                            type="text"
                            value={url}
                            readOnly
                            className="url-input"
                        />
                        <button
                            onClick={() => handleCopy(url, 'url')}
                            className={`copy-btn ${copiedFlags['url'] ? 'copied' : ''}`}
                        >
                            {copiedFlags['url'] ? 'Copied!' : 'Copy'}
                        </button>
                    </div>
                </div>

                <div className="share-section">
                    <h2 className="share-title">Or Use the Code!</h2>
                    <div className="link-container">
                        <input
                            id="code"
                            type="text"
                            value={code}
                            readOnly
                            className="url-input"
                        />
                        <button
                            onClick={() => handleCopy(code, 'code')}
                            className={`copy-btn ${copiedFlags['code'] ? 'copied' : ''}`}
                        >
                            {copiedFlags['code'] ? 'Copied!' : 'Copy'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

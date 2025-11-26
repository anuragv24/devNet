import React, { useState, useEffect } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { dracula } from '@uiw/codemirror-theme-dracula';
import ACTIONS from '../Actions';

const Editor = ({ socketRef, roomId, onCodeChange }) => {
    const [code, setCode] = useState("// Write your code here...");

    // 1. Listen for incoming code changes from Socket
    useEffect(() => {
        if (socketRef.current) {
            socketRef.current.on(ACTIONS.CODE_CHANGE, ({ code: newCode }) => {
                if (newCode !== null) {
                    setCode(newCode);
                    // Also update the parent ref so Sync works for new joiners
                    onCodeChange(newCode); 
                }
            });
        }

        return () => {
            if(socketRef.current) socketRef.current.off(ACTIONS.CODE_CHANGE);
        };
    }, [socketRef.current, onCodeChange]);

    // 2. Handle local updates (User typing)
    const handleChange = (val, viewUpdate) => {
        setCode(val);
        onCodeChange(val);
        
        // Only emit if the socket is ready
        // We do NOT emit if the change came from the socket (to avoid loops).
        // The backend `socket.in(roomId)` ensures we don't get our own events back,
        // so we can safely emit here whenever the user types.
        if (socketRef.current) {
            socketRef.current.emit(ACTIONS.CODE_CHANGE, {
                roomId,
                code: val,
            });
        }
    };

    return (
        <div style={{ fontSize: '16px', lineHeight: '1.6' }}>
            <CodeMirror
                value={code}
                height="100vh"
                theme={dracula}
                extensions={[javascript({ jsx: true })]}
                onChange={handleChange}
            />
        </div>
    );
};

export default Editor;
// This is your new, complete src/Editor.jsx file

import React, { useEffect, useRef } from 'react';
import { EditorState, Transaction } from '@codemirror/state';
import { EditorView, basicSetup } from 'codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { dracula } from '@uiw/codemirror-theme-dracula';
import ACTIONS from '../Actions';

// This annotation is used to mark transactions that originate from the socket
const remoteAnnotation = Transaction.remote.of(true);

const Editor = ({ socketRef, roomId, onCodeChange }) => {
    const editorParentRef = useRef(null);
    const viewRef = useRef(null);

    // Effect for initializing the editor
    useEffect(() => {
        if (!editorParentRef.current) return;

        // --- Debounce helper function ---
        function debounce(func, delay) {
            let timeout;
            return (...args) => {
                clearTimeout(timeout);
                timeout = setTimeout(() => func.apply(this, args), delay);
            };
        }

        // --- Debounced emit function ---
        const debouncedEmit = debounce((code) => {
            if (socketRef.current) {
                socketRef.current.emit(ACTIONS.CODE_CHANGE, {
                    roomId,
                    code,
                });
            }
        }, 300); // 300ms delay

        // The update listener
        const onUpdate = EditorView.updateListener.of((update) => {
            if (update.docChanged) {
                const code = update.state.doc.toString();
                onCodeChange(code); // Prop callback

                // --- THIS IS THE CRITICAL ANTI-ECHO CHECK ---
                const isRemote = update.transactions.some((tr) =>
                    tr.annotation(remoteAnnotation)
                );

                // If the change was local, emit it (debounced)
                if (!isRemote) {
                    debouncedEmit(code);
                }
            }
        });

        const extensions = [
            basicSetup,
            javascript({ json: true }),
            dracula,
            onUpdate, // Our custom update listener
        ];

        const startState = EditorState.create({
            doc: '// Your collaborative code starts here...\n',
            extensions: extensions,
        });

        const view = new EditorView({
            state: startState,
            parent: editorParentRef.current,
        });

        viewRef.current = view;

        return () => {
            view.destroy();
            viewRef.current = null;
        };
    }, []); // Runs only once

    // Effect for handling incoming socket events
    useEffect(() => {
        if (!socketRef.current) {
            return;
        }

        const handler = ({ code }) => {
            const view = viewRef.current;
            if (view && code !== null && code !== view.state.doc.toString()) {
                view.dispatch({
                    changes: { from: 0, to: view.state.doc.length, insert: code },
                    annotations: [remoteAnnotation], // Mark this as a remote change
                });
            }
        };

        socketRef.current.on(ACTIONS.CODE_CHANGE, handler);

        return () => {
            if (socketRef.current) {
                socketRef.current.off(ACTIONS.CODE_CHANGE, handler);
            }
        };
    }, [socketRef.current]);

    return <div ref={editorParentRef} id="realtimeEditor"></div>;
};

export default Editor;
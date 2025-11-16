import React, { useEffect, useRef } from 'react';
import { EditorState, Transaction } from '@codemirror/state';
import { EditorView, basicSetup } from 'codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { dracula } from '@uiw/codemirror-theme-dracula'; // The v6 dracula theme
import ACTIONS from '../Actions';

// This annotation is used to mark transactions that originate from the socket
const remoteAnnotation = Transaction.remote.of(true);

const Editor = ({ socketRef, roomId, onCodeChange }) => {
    // Ref for the editor's parent element (a div)
    const editorParentRef = useRef(null);
    // Ref to store the EditorView instance
    const viewRef = useRef(null);

    // Effect for initializing the editor (runs only once)
    useEffect(() => {
        if (!editorParentRef.current) return;

        // The update listener
        const onUpdate = EditorView.updateListener.of((update) => {
            // Check if the document changed
            if (update.docChanged) {
                const code = update.state.doc.toString();
                onCodeChange(code); // Prop callback

                // Check if the change was local (not remote)
                const isRemote = update.transactions.some((tr) =>
                    tr.annotation(remoteAnnotation)
                );

                // If the change was local, emit it
                if (!isRemote) {
                    socketRef.current.emit(ACTIONS.CODE_CHANGE, {
                        roomId,
                        code,
                    });
                }
            }
        });

        // --- Map v5 options to v6 extensions ---
        const extensions = [
            basicSetup, // Includes lineNumbers, autoCloseBrackets
            javascript({ json: true }), // mode: { name: 'javascript', json: true }
            dracula, // theme: 'dracula'
            onUpdate, // Our custom update listener
        ];
        // v5 'autoCloseTags' was for HTML/XML, not needed for JS.

        // Create the initial state
        const startState = EditorState.create({
            doc: '// Your collaborative code starts here...\n',
            extensions: extensions,
        });

        // Create the EditorView
        const view = new EditorView({
            state: startState,
            parent: editorParentRef.current,
        });

        // Save the view instance to the ref
        viewRef.current = view;

        // --- Cleanup function ---
        return () => {
            view.destroy();
            viewRef.current = null;
        };
    }, []); // Empty dependency array ensures this runs only once

    // Effect for handling incoming socket events
    useEffect(() => {
        // Wait for both the socket and the editor view to be ready
        if (!socketRef.current || !viewRef.current) {
            return;
        }

        const handler = ({ code }) => {
            const view = viewRef.current;
            if (code !== null && code !== view.state.doc.toString()) {
                // Dispatch a transaction to update the editor
                view.dispatch({
                    changes: { from: 0, to: view.state.doc.length, insert: code },
                    annotations: [remoteAnnotation], // Mark this as a remote change
                });
            }
        };

        socketRef.current.on(ACTIONS.CODE_CHANGE, handler);

        // --- Cleanup function ---
        return () => {
            socketRef.current.off(ACTIONS.CODE_CHANGE, handler);
        };
    }, [socketRef.current]); // Re-run this effect if socketRef changes

    // Use a <div> as the mount point, not a <textarea>
    return <div ref={editorParentRef} id="realtimeEditor"></div>;
};

export default Editor;
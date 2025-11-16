import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import Client from "../components/Client";
import Editor from "../components/Editor";
import ACTIONS from "../Actions";
import { initSocket } from "../socket";
import {
  useLocation,
  useNavigate,
  Navigate,
  useParams,
} from "react-router-dom";

import myLogo from "../assets/devnet.svg"

//configuration for STUN server
const iceServers = {
  iceServers: [
    {
      urls: [
        "stun:stun.l.google.com:19302",
        "stun:stun1.l.google.com:19302",
      ],
    },
  ],
};

const EditorPage = () => {
  // states for editor....
  const [clients, setClients] = useState([]);

  //states for webtrc
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);

  const[isCallActive, setIsCallActive] = useState(false)

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);

  const socketRef = useRef(null);
  const codeRef = useRef(null);

  const location = useLocation();
  const { roomId } = useParams();
  const reactNavigator = useNavigate();


  const createPeerConnection = (partnerSocketId) => {
    // If a connection already exists, close it
    if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
    }

    const pc = new RTCPeerConnection(iceServers);

    // --- Add local video/audio tracks to the connection ---
    // This sends video to the other person
    if (localStream) {
        localStream.getTracks().forEach((track) => {
            pc.addTrack(track, localStream);
        });
    }
  // --- Handle incoming ICE candidates ---
    pc.onicecandidate = (event) => {
        if (event.candidate && socketRef.current) {
            console.log('Sending ICE candidate');
            socketRef.current.emit('webrtc:ice-candidate', {
                toSocketId: partnerSocketId,
                candidate: event.candidate,
            });
        }
    };

    // --- Handle incoming remote video stream ---
    pc.ontrack = (event) => {
        console.log('Received remote track');
        setRemoteStream(event.streams[0]);
    };

    peerConnectionRef.current = pc;
    return pc;
  };

  // const startCall = async (partnerSocketId, isOfferer) => {
  //   try {
  //       console.log(`Starting call to ${partnerSocketId}. Is Offerer: ${isOfferer}`);
  //       // 1. Get local video/audio
  //       const stream = await navigator.mediaDevices.getUserMedia({
  //           video: true,
  //           audio: true,
  //       });
  //       setLocalStream(stream);

  //       // 2. Create the peer connection
  //       const pc = createPeerConnection(partnerSocketId);

  //       // 3. If this user is the "offerer", create and send the offer
  //       if (isOfferer) {
  //           console.log('Creating offer...');
  //           const offer = await pc.createOffer();
  //           await pc.setLocalDescription(offer);
  //           socketRef.current.emit('webrtc:offer', {
  //               toSocketId: partnerSocketId,
  //               offer: offer,
  //           });
  //       }
  //       return true
  //   } catch (err) {
  //       console.error('Error starting video call:', err);
  //       toast.error('Could not start video call.');
  //       return false
  //   }
  // };

  // --- THIS IS THE NEW (FIXED) CODE ---
const startCall = async (partnerSocketId, isOfferer) => {
    try {
        console.log(`Starting call to ${partnerSocketId}. Is Offerer: ${isOfferer}`);
        
        let stream; // Define stream variable

        // --- 1. Try to get video + audio ---
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true,
            });
        } catch (err) {
            console.warn('Could not get video device. Trying audio-only.');
            
            // --- 2. If it fails, try to get audio-only ---
            // This handles the 'NotFoundError'
            if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
                toast.error('Video device not found. Starting audio-only call.');
                stream = await navigator.mediaDevices.getUserMedia({
                    video: false, // <-- This is the fallback
                    audio: true,
                });
            } else {
                // Handle other errors, like if the user clicks "Block"
                console.error('Error starting media:', err);
                toast.error('Could not start call. Check media permissions.');
                return false; // Signal failure
            }
        }
        
        setLocalStream(stream); // Set the stream (either video or audio-only)

        // --- 3. Create the peer connection ---
        const pc = createPeerConnection(partnerSocketId);

        // --- 4. If this user is the "offerer", create and send the offer ---
        if (isOfferer) {
            console.log('Creating offer...');
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socketRef.current.emit('webrtc:offer', {
                toSocketId: partnerSocketId,
                offer: offer,
            });
        }
        return true; // Signal success

    } catch (err) {
        // This will catch any remaining errors (e.g., no microphone)
        console.error('Error starting video call:', err);
        toast.error('Could not start call. Check your microphone.');
        return false; // Signal failure
    }
};

  const stopCall = () => {
    console.log('Stopping call.');
    // Stop local media tracks
    if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
    }
    // Close the peer connection
    if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
    }
    // Clear streams
    setLocalStream(null);
    setRemoteStream(null);
    setIsCallActive(false)
  };

  const handleOffer = async ({ offer, fromSocketId }) => {
    console.log(`Received offer from ${fromSocketId}`);
    try {
        // 1. Get local video (if not already)
        let stream = localStream;
        if (!stream) {
            stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            setLocalStream(stream);
        }

        // 2. Create peer connection
        const pc = createPeerConnection(fromSocketId);

        // 3. Set the remote description (the offer)
        await pc.setRemoteDescription(new RTCSessionDescription(offer));

        // 4. Create an answer
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        // 5. Send the answer back
        socketRef.current.emit('webrtc:answer', {
            toSocketId: fromSocketId,
            answer: answer,
        });
    } catch (err) {
        console.error('Error handling offer:', err);
    }
  };

  const handleAnswer = async ({ answer }) => {
    console.log('Received answer');
    if (peerConnectionRef.current) {
        await peerConnectionRef.current.setRemoteDescription(
            new RTCSessionDescription(answer)
        );
    }
  };

  const handleIceCandidate = async ({ candidate }) => {
    console.log('Received ICE candidate');
    if (peerConnectionRef.current && candidate) {
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
    }
  };

  const handleStartCallClick = async () => {
    if(clients.length === 2){
      const otherUser = clients.find(
        (client) => client.socketId !== socketRef.current.id
      )
      if(otherUser){
        const isOfferer = socketRef.current.id > otherUser.socketId
        const callStarted = await startCall(otherUser.socketId, isOfferer)
        if(callStarted){
          setIsCallActive(true)
        }
      }
    } else if (clients.length > 2){
      toast.error("Video chat is available with only 2 participants.")
    } else {
      toast.error("You need two participants to start a video chat.")
    }
  }


  useEffect(() => {
    const init = async () => {
      socketRef.current = await initSocket();
      socketRef.current.on("connect_error", (err) => handleErrors(err));
      socketRef.current.on("connect_failed", (err) => handleErrors(err));

      function handleErrors(e) {
        console.log("socket error", e);
        toast.error("Socket connection failed, try again later.");
        reactNavigator("/");
      }

      socketRef.current.emit(ACTIONS.JOIN, {
        roomId,
        username: location.state?.username,
      });

      socketRef.current.on(
        ACTIONS.JOINED,
        ({ clients, username, socketId }) => {
          if (username !== location.state?.username) {
            toast.success(`${username} joined the room.`);
            console.log(`${username} joined`);
          }
          setClients(clients);
          socketRef.current.emit(ACTIONS.SYNC_CODE, {
            code: codeRef.current,
            socketId,
          });
        }
      );

      // socketRef.current.on(
      //     ACTIONS.DISCONNECTED,
      //     ({ socketId, username }) => {
      //         toast.success(`${username} left the room.`);
      //         setClients((prev) => {
      //             return prev.filter(
      //                 (client) => client.socketId !== socketId
      //             );
      //         });
      //     }
      // );

      // This is the NEW (fixed) code
      socketRef.current.on(
        ACTIONS.DISCONNECTED,
        ({ socketId, username, clients }) => {
          // <-- Get the 'clients' list
          toast.success(`${username} left the room.`);
          // --- Use the new, correct list from the server ---
          setClients(clients);
        }
      );

      //webrtc listener
      socketRef.current.on('webrtc:offer', handleOffer);
      socketRef.current.on('webrtc:answer', handleAnswer);
      socketRef.current.on('webrtc:ice-candidate', handleIceCandidate);
    };
    init();

    return () => {
      stopCall()
      if (socketRef.current) {
        socketRef.current.off('webrtc:offer');
        socketRef.current.off('webrtc:answer');
        socketRef.current.off('webrtc:ice-candidate');

        socketRef.current.disconnect();
        socketRef.current.off(ACTIONS.JOINED);
        socketRef.current.off(ACTIONS.DISCONNECTED);
      }
    };
  }, []);

    // This effect now ONLY handles STOPPING the call
    useEffect(() => {
        // If a call is active but the client count is no longer 2, stop the call
        if (isCallActive && clients.length !== 2) {
            stopCall();
        }
    }, [clients, isCallActive]);

  // This effect assigns the media streams to the video elements
  useEffect(() => {
    if (localVideoRef.current && localStream) {
        localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
        remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);


  async function copyRoomId() {
    try {
      await navigator.clipboard.writeText(roomId);
      toast.success("Room ID has been copied to your clipboard");
    } catch (err) {
      toast.error("Could not copy the Room ID");
      console.error(err);
    }
  }

  function leaveRoom() {
    reactNavigator("/");
  }

  if (!location.state) {
    return <Navigate to="/" />;
  }

  return (
    <div className="mainWrap">
      <div className="aside">
        <div className="asideInner">
          <div className="logo">
            <img className="logoImage" src={myLogo} alt="logo" />
          </div>
          <h3>Connected</h3>
          <div className="clientsList">
            {clients.map((client) => (
              <Client key={client.socketId} username={client.username} />
            ))}
          </div>
        </div>

       {/* --- NEW CONDITIONAL RENDER WITH STOP BUTTON --- */}
    {isCallActive ? (
        <>
            <div className="videoChatWrap">
                <div className="videoBox">
                    <h4>My Video</h4>
                    <video
                        ref={localVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className="videoElement"
                    />
                </div>
                <div className="videoBox">
                    <h4>Partner Video</h4>
                    <video
                        ref={remoteVideoRef}
                        autoPlay
                        playsInline
                        className="videoElement"
                    />
                </div>
            </div>
            
            {/* --- THIS IS THE NEW BUTTON --- */}
            <button 
                className="btn leaveBtn" /* We re-use the red 'leave' style */
                onClick={stopCall} /* Just call the existing stopCall function */
            >
                Stop Video Call
            </button>
        </>
    ) : (
        <button 
            className="btn videoBtn" 
            onClick={handleStartCallClick}
        >
            Start Video Chat
        </button>
    )}
    {/* --- END NEW --- */}

        <button className="btn copyBtn" onClick={copyRoomId}>
          Copy ROOM ID
        </button>
        <button className="btn leaveBtn" onClick={leaveRoom}>
          Leave
        </button>
      </div>
      <div className="editorWrap">
        <Editor
          socketRef={socketRef}
          roomId={roomId}
          onCodeChange={(code) => {
            codeRef.current = code;
          }}
        />
      </div>
    </div>
  );
};

export default EditorPage;

import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from "path";
import ACTIONS from './src/Actions.js'

import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express();
const server = http.createServer(app);

const io = new Server(server);

// app.use(express.static("build"));
// app.use((req, res, next) => {
//   res.sendFile(path.join(__dirname, "build", "index.html"));
// });

app.use(express.static(path.join(__dirname, "dist")));
app.use((req, res, next) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

const userSocketMap = {};
function getAllConnectedClients(roomId) {
  return Array.from(io.sockets.adapter.rooms.get(roomId) || []).map(
    (socketId) => {
      return {
        socketId,
        username: userSocketMap[socketId],
      };
    }
  );
}

// io.on("connection", (socket) => {
//   console.log("socket connected", socks(roomId);
//     clients.forEach(({ socketId }) => {et.id);

//   socket.on(ACTIONS.JOIN, ({ roomId, username }) => {
//     userSocketMap[socket.id] = username;
//     socket.join(roomId);
//     const clients = getAllConnectedClient
//       io.to(socketId).emit(ACTIONS.JOINED, {
//         clients,
//         username,
//         socketId: socket.id,
//       });
//     });
//   });

io.on("connection", (socket) => {
  console.log("socket connected", socket.id);

  socket.on(ACTIONS.JOIN, ({ roomId, username }) => {
    userSocketMap[socket.id] = username;
    socket.join(roomId);
    const clients = getAllConnectedClients(roomId);
    
    // Broadcast to everyone in the room (cleaner than forEach)
    io.in(roomId).emit(ACTIONS.JOINED, {
      clients,
      username,
      socketId: socket.id,
    });
  });


  socket.on(ACTIONS.CODE_CHANGE, ({ roomId, code }) => {
    socket.in(roomId).emit(ACTIONS.CODE_CHANGE, { code });
  });

  socket.on(ACTIONS.SYNC_CODE, ({ socketId, code }) => {
    io.to(socketId).emit(ACTIONS.CODE_CHANGE, { code });
  });

  // socket.on("disconnecting", () => {
  //   const rooms = [...socket.rooms];
  //   rooms.forEach((roomId) => {
  //     socket.in(roomId).emit(ACTIONS.DISCONNECTED, {
  //       socketId: socket.id,
  //       username: userSocketMap[socket.id],
  //     });
  //   });
  //   delete userSocketMap[socket.id];
  //   socket.leave();
  // });

  socket.on('disconnecting', () => {
        const username = userSocketMap[socket.id]; // Get username *before* deleting
        const rooms = [...socket.rooms];

        // --- 1. Delete the user from the map FIRST ---
        delete userSocketMap[socket.id];

        rooms.forEach((roomId) => {
            // Ignore the socket's own room ID
            if (roomId !== socket.id) {
                
                // --- 2. Manually make the socket leave the room ---
                // This synchronously updates io.sockets.adapter.rooms
                socket.leave(roomId);

                // --- 3. Get the NEW, correct client list ---
                // Because the socket has now left, this list is accurate
                const clients = getAllConnectedClients(roomId);

                // --- 4. Broadcast the 'disconnected' event AND the new list ---
                // Use io.in() to broadcast to everyone still in the room
                io.in(roomId).emit(ACTIONS.DISCONNECTED, {
                    socketId: socket.id,
                    username: username,
                    clients: clients, // <-- Send the new, correct list
                });
            }
        });
    });

    //webRTc handler code:

    socket.on('webrtc:offer', ({ offer, toSocketId }) => {
        console.log(`Relaying offer to ${toSocketId}`);
        // Relay the offer to the specific user
        io.to(toSocketId).emit('webrtc:offer', {
            offer,
            fromSocketId: socket.id,
        });
    });

    socket.on('webrtc:answer', ({ answer, toSocketId }) => {
        console.log(`Relaying answer to ${toSocketId}`);
        // Relay the answer back to the original offerer
        io.to(toSocketId).emit('webrtc:answer', {
            answer,
            fromSocketId: socket.id,
        });
    });

    socket.on('webrtc:ice-candidate', ({ candidate, toSocketId }) => {
        console.log(`Relaying ICE candidate to ${toSocketId}`);
        // Relay the ICE candidate
        io.to(toSocketId).emit('webrtc:ice-candidate', {
            candidate,
            fromSocketId: socket.id,
        });
    });

});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Listening on port ${PORT} `));

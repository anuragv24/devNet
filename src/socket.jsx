import {io} from 'socket.io-client'

export const initSocket = async () => {
    const options = {
       'force new connection' : true,
       reconnectionAttempt: 'Infinity',
       timeout: 10000,
       transports: ['websocket'] 
    }
    const RENDER_SERVER_URL = 'https://realtime-editor-server-ajh2.onrender.com'
    return io(RENDER_SERVER_URL, options )
}
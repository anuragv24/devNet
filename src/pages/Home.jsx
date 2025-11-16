
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {v4} from 'uuid'
import toast from 'react-hot-toast'
import myLogo from "../assets/devnet.svg"

const Home = () => {

    const navigate = useNavigate()

    const[roomId, setRoomId] = useState("")
    const[username, setUsername] = useState("")

    const createNewRoom = (e) => {
        e.preventDefault()
        const id = v4()
        setRoomId(id)
        toast.success('Created a new ROOM')
    }

    const joinRoom = () => {
        if(!roomId){
            toast.error('ROOM ID is required')
            return
        }
        if(!username){
            toast.error('USERNAME is required')
            return
        }

        navigate(`/editor/${roomId}`, {
            state: {
                username,
            }
        })
    }

    const handleInputEnter = (e) => {
        if(e.code === 'Enter' ){
            joinRoom()
        }
    }

  return (
    <div className="homePageWrapper">
        <div className="formWrapper">
            <div className="logo">
                        <img className="logoImage" src={myLogo} alt="logo" />
                      </div>
            {roomId ?
             <h4 className='mainLabel'>Create new ROOM ID</h4> :             
             <h4 className="mainLabel">Past invitation ROOM ID</h4>
             }
            
            <div className="inputGroup">
                <input 
                    type="text" 
                    className="inputBox" 
                    placeholder="ROOM ID"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value) }
                    onKeyUp={handleInputEnter}
                />
                <input 
                    type="text" 
                    className="inputBox" 
                    placeholder="USERNAME"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onKeyUp={handleInputEnter}
                />
                <button className="btn joinBtn" onClick={joinRoom}>Join</button>
                <span className="createInfo">
                    If you don't have an invite then create &nbsp; 
                    {/* <a onClick={createNewRoom} href="" className="createNewBtn">
                        new room
                    </a> */}
                    <Link 
                        to='/'
                        className='createNewBtn' 
                        onClick={createNewRoom} 
                    >
                    new room
                    </Link>
                </span>
            </div>
        </div>

    </div>
  )
}

export default Home
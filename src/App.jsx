import {BrowserRouter, Routes, Route} from 'react-router-dom'
import Home from './pages/Home'
import EditorPage from './pages/EditorPage'
import './App.css'
import { Toaster } from 'react-hot-toast'
function App() {

  return (
    <>
    <div className="">
      <Toaster 
        position='top-right' 
        toastOptions={{
          success : {
            theme: {
              primary : 'green',
            }
          }
        }}
      />
    </div>
        <BrowserRouter>
        <Routes>
          <Route path='/' element={<Home/>} />
          <Route path='/editor/:roomId' element={<EditorPage/>} />
        </Routes>
      </BrowserRouter>
    </>
  )
}

export default App

//57.56

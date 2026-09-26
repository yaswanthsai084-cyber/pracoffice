import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import Dashboard from "./pages/Dashboard"
import Login from "./pages/Login"
import Registration from "./pages/Registration"
import Exam from "./components/exam/Exam"
import Results from "./components/results/Results"
function App() {
  return (
    <BrowserRouter>
      <Routes>

        <Route path="/" element={<Navigate to ="Login" />} />

        <Route path="/login" element={<Login />} />

        <Route path="/register" element={<Registration />} />
        <Route path="/dashboard" element={<Dashboard />} />  
        <Route path="/exam" element={<Exam/>} />
        <Route path="/results" element={<Results/>}/>         
         </Routes>
    </BrowserRouter>
  )
}

export default App
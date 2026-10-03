import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import Dashboard from "./pages/Dashboard"
import Login from "./pages/Login"
import Registration from "./pages/Registration"
import Exam from "./components/exam/Exam"
import ExamInstructions from "./pages/ExamInstructions"
import Results from "./components/results/Results"
import OfficeTest from "./pages/OfficeTest"
import RequireAuth from "./components/common/RequireAuth"
function App() {
  return (
    <BrowserRouter>
      <Routes>

        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        <Route path="/login" element={<Login />} />

        <Route path="/register" element={<Registration />} />
        <Route path="/dashboard" element={<Dashboard />} />  
        <Route path="/exam/instructions" element={<RequireAuth><ExamInstructions/></RequireAuth>} />
        <Route path="/exam" element={<RequireAuth><Exam/></RequireAuth>} />
        <Route path="/results" element={<RequireAuth><Results/></RequireAuth>}/>
        <Route path="/office-test" element={<RequireAuth><OfficeTest/></RequireAuth>} />         
         </Routes>
    </BrowserRouter>
  )
}

export default App
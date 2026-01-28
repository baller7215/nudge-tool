import { Box } from "@chakra-ui/react"
import { Route, Routes } from "react-router-dom"
import { useEffect } from "react"
import HomePage from "./pages/HomePage"
import LoginPage from "./pages/LoginPage"
import SignupPage from "./pages/SignupPage"
import { SessionProvider } from "./context/SessionContext"

function App() {
  // Add beforeunload warning when user tries to close tab
  useEffect(() => {
    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "Are you sure you want to leave? Your work may not be saved.";
      return "Are you sure you want to leave? Your work may not be saved.";
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    // Cleanup function to remove the event listener
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  return (
    <SessionProvider>
      <Box minH={"100vh"}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
        </Routes>
      </Box>
    </SessionProvider>
  )
}

export default App

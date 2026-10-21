import React from "react";
import Classifier from "./Classifier";
import "./App.css";
 
function App() {
  return (
    <div className="app-container">
      <header className="app-header">
        <h1 className="title">Exam cheating detection</h1>
        <p className="subtitle">
          The camera watches head direction (straight, left, down) and logs a warning when a student
          looks away for too long.
        </p>
      </header>
      <Classifier />
    </div>
  );
}
 
export default App;
 












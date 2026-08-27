import React from "react";
import Classifier from "./Classifier";
import "./App.css";

function App() {
  return (
    <div className="app-container">
      <h1 className="title">🎯 AI Exam Cheating Detection</h1>
      <p className="subtitle">
        Detecting: Looking Straight | Left | Down
      </p>

      <div className="card">
        <Classifier />
      </div>
    </div>
  );
}

export default App;
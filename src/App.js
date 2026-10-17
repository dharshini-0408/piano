import React from "react";
import Piano from "./Piano";
import Background3D from "./Background3D";
import "./App.css";

function App() {
  return (
    <div className="app">
      <Background3D />
      <div className="app-content">
        <Piano />
      </div>
    </div>
  );
}

export default App;

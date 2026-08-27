import React, { useRef, useState } from "react";
import * as tmImage from "@teachablemachine/image";

const MODEL_URL = "/model/";

function Classifier() {
  const webcamRef = useRef(null);
  const isRunning = useRef(false); // ✅ FIX (important)

  const [model, setModel] = useState(null);
  const [webcam, setWebcam] = useState(null);

  const [webcamPrediction, setWebcamPrediction] = useState("Not started");
  const [imagePrediction, setImagePrediction] = useState("No image");

  const [imagePreview, setImagePreview] = useState(null);

  // Load model
  const loadModel = async () => {
    if (model) return model;

    const loadedModel = await tmImage.load(
      MODEL_URL + "model.json",
      MODEL_URL + "metadata.json"
    );

    setModel(loadedModel);
    return loadedModel;
  };

  // Start webcam (LIVE)
  const startWebcam = async () => {
    const loadedModel = await loadModel();

    const cam = new tmImage.Webcam(300, 300, true);
    await cam.setup();
    await cam.play();

    webcamRef.current.innerHTML = "";
    webcamRef.current.appendChild(cam.canvas);

    setWebcam(cam);
    isRunning.current = true; // ✅ start loop

    loop(cam, loadedModel);
  };

  // Stop webcam
  const stopWebcam = () => {
    if (webcam) {
      webcam.stop();
      webcamRef.current.innerHTML = "";
      isRunning.current = false; // ✅ stop loop
      setWebcamPrediction("Stopped");
    }
  };

  // 🔥 TRUE LIVE LOOP
  const loop = async (cam, modelRef) => {
    if (!cam || !modelRef) return;

    cam.update();

    const predictions = await modelRef.predict(cam.canvas);

    const top = predictions.sort(
      (a, b) => b.probability - a.probability
    )[0];

    setWebcamPrediction(
      `${top.className} (${(top.probability * 100).toFixed(2)}%)`
    );

    // ✅ CONTINUOUS LOOP (no React delay issue)
    if (isRunning.current) {
      requestAnimationFrame(() => loop(cam, modelRef));
    }
  };

  // Upload image
  const handleUpload = async (e) => {
    const loadedModel = await loadModel();

    const file = e.target.files[0];
    if (!file) return;

    const img = document.createElement("img");
    img.src = window.URL.createObjectURL(file);

    setImagePreview(img.src);

    img.onload = async () => {
      const predictions = await loadedModel.predict(img);

      const top = predictions.sort(
        (a, b) => b.probability - a.probability
      )[0];

      setImagePrediction(
        `${top.className} (${(top.probability * 100).toFixed(2)}%)`
      );
    };
  };

  return (
    <div className="classifier">

      {/* Webcam */}
      <h3>🎥 Live Webcam</h3>

      <div className="buttons">
        <button onClick={startWebcam}>
          ▶ Start Webcam
        </button>

        <button onClick={stopWebcam}>
          ⏹ Stop Webcam
        </button>
      </div>

      <div ref={webcamRef} className="webcam-box"></div>

      <h4 className="result">Webcam: {webcamPrediction}</h4>

      <hr />

      {/* Upload */}
      <h3>📁 Upload Image</h3>

      <input type="file" accept="image/*" onChange={handleUpload} />

      {imagePreview && (
        <img src={imagePreview} alt="preview" className="preview" />
      )}

      <h4 className="result">Image: {imagePrediction}</h4>
    </div>
  );
}

export default Classifier;
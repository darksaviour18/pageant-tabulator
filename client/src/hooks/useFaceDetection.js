import { useState, useCallback, useRef } from 'react';

export function useFaceDetection() {
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const faceApiRef = useRef(null);

  const loadModels = useCallback(async () => {
    if (modelsLoaded) return true;
    
    try {
      const faceApi = await import('face-api.js');
      faceApiRef.current = faceApi;

      // Load models from bundled local files (offline/LAN compatible)
      const modelPath = '/models';
      await faceApi.nets.tinyFaceDetector.loadFromUri(modelPath);
      
      setModelsLoaded(true);
      return true;
    } catch (err) {
      console.warn('Failed to load face detection models:', err);
      setError('Face detection unavailable');
      return false;
    }
  }, [modelsLoaded]);

  const detectFace = useCallback(async (imageElement) => {
    if (!faceApiRef.current || !modelsLoaded) {
      return null;
    }

    try {
      const detections = await faceApiRef.current.detectAllFaces(
        imageElement,
        new faceApiRef.current.TinyFaceDetectorOptions()
      );

      if (detections.length === 0) {
        return null;
      }

      return detections[0].box;
    } catch (err) {
      console.warn('Face detection error:', err);
      return null;
    }
  }, [modelsLoaded]);

  const detectFaceFromFile = useCallback(async (file) => {
    if (!modelsLoaded) {
      return null;
    }

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = async () => {
        const box = await detectFace(img);
        resolve(box);
      };
      img.onerror = () => resolve(null);
      img.src = URL.createObjectURL(file);
    });
  }, [modelsLoaded, detectFace]);

  return {
    modelsLoaded,
    loadModels,
    detectFace,
    detectFaceFromFile,
    loading,
    error,
  };
}
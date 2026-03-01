import os
try:
    import cv2
except ImportError as e:
    if "libGL.so.1" in str(e):
        raise ImportError(
            "Missing system dependencies for OpenCV (libGL.so.1). "
            "Please install 'opencv-python-headless' instead of 'opencv-python', "
            "or install 'libgl1' in your environment."
        ) from e
    raise e
import numpy as np
from ultralytics import YOLO
import requests

class HeadMovementDetector:
    def __init__(self, model_folder="model", model_name="yolov8n-pose.pt"):
        self.base_path = os.path.dirname(os.path.abspath(__file__))
        self.model_dir = os.path.join(self.base_path, model_folder)
        self.model_path = os.path.join(self.model_dir, model_name)
        
        # Ensure model directory exists
        os.makedirs(self.model_dir, exist_ok=True)
        
        # Download model if not present
        if not os.path.exists(self.model_path):
            print(f"Downloading {model_name} to {self.model_dir}...")
            url = f"https://github.com/ultralytics/assets/releases/download/v8.2.0/{model_name}"
            try:
                response = requests.get(url)
                response.raise_for_status()
                with open(self.model_path, "wb") as f:
                    f.write(response.content)
                print("Model downloaded successfully.")
            except Exception as e:
                print(f"Error downloading model: {e}")
                # Fallback to letting ultralytics handle download (might go to root)
                self.model_path = model_name

        self.model = YOLO(self.model_path)

        # Sensitivity Thresholds (Tune these to adjust strictness)
        self.YAW_THRESHOLD = 0.2       # +/- deviation from center for Left/Right
        self.PITCH_UP_THRESHOLD = 0.3  # Deviation for looking Up
        self.PITCH_DOWN_THRESHOLD = 0.3 # Deviation for looking Down

    def _extract_metrics(self, keypoints):
        """Helper to calculate yaw and pitch ratios from keypoints."""
        nose = keypoints[0]
        left_eye = keypoints[1]
        right_eye = keypoints[2]
        left_ear = keypoints[3]
        right_ear = keypoints[4]
        
        conf_thresh = 0.5
        
        # Ensure ears are visible for accurate metric calculation
        if left_ear[2] < conf_thresh or right_ear[2] < conf_thresh:
            return None

        ear_width = abs(right_ear[0] - left_ear[0])
        if ear_width == 0: return None

        # Yaw Ratio (Nose position relative to ears)
        nose_to_left = abs(nose[0] - left_ear[0])
        yaw_ratio = nose_to_left / ear_width
        
        # Pitch Ratio (Vertical distance between eyes and ears)
        pitch_ratio = 0
        if left_eye[2] > conf_thresh and right_eye[2] > conf_thresh:
            y_ears = (left_ear[1] + right_ear[1]) / 2
            y_eyes = (left_eye[1] + right_eye[1]) / 2
            pitch_ratio = (y_ears - y_eyes) / ear_width
            
        return {"yaw": yaw_ratio, "pitch": pitch_ratio}

    def detect(self, image_array):
        """
        Detects head movement from an image array (OpenCV format).
        Returns: status (str), details (str), box (list)
        """
        results = self.model(image_array, verbose=False)
        
        if not results or len(results[0].keypoints) == 0:
            return "WARNING", "No person detected", None

        # Get keypoints for the first detected person
        # YOLOv8-pose keypoints: 0: Nose, 1: Left Eye, 2: Right Eye, 3: Left Ear, 4: Right Ear
        keypoints = results[0].keypoints.data[0].cpu().numpy()
        
        # Get bounding box [x1, y1, x2, y2]
        box = results[0].boxes.xyxy[0].cpu().numpy().tolist()
        
        # Check confidence (x, y, conf)
        nose = keypoints[0]
        left_eye = keypoints[1]
        right_eye = keypoints[2]
        left_ear = keypoints[3]
        right_ear = keypoints[4]

        # Confidence threshold
        conf_thresh = 0.5

        # 1. Basic Face Visibility Check
        if nose[2] < conf_thresh:
            return "WARNING", "Face not clearly visible", box

        # 2. Check for extreme turning (one ear hidden)
        has_left_ear = left_ear[2] > conf_thresh
        has_right_ear = right_ear[2] > conf_thresh

        if has_left_ear and not has_right_ear:
            return "WARNING", "Looking Right", box
        if not has_left_ear and has_right_ear:
            return "WARNING", "Looking Left", box

        # 3. Calculate Metrics
        metrics = self._extract_metrics(keypoints)
        
        if metrics:
            # Use default baseline values
            base_yaw = 0.5
            base_pitch = 0.1

            # Check Yaw
            if metrics["yaw"] < base_yaw - self.YAW_THRESHOLD:
                return "WARNING", "Looking Left", box
            if metrics["yaw"] > base_yaw + self.YAW_THRESHOLD:
                return "WARNING", "Looking Right", box
            
            # Check Pitch
            if metrics["pitch"] < base_pitch - self.PITCH_DOWN_THRESHOLD:
                return "WARNING", "Looking Down", box
            if metrics["pitch"] > base_pitch + self.PITCH_UP_THRESHOLD:
                return "WARNING", "Looking Up", box

        return "OK", "Head straight", box
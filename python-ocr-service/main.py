"""
BGMI Tournament Video Processing Microservice
Extracts scoreboard data from BGMI tournament videos using OCR
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import cv2
import easyocr
import numpy as np
import os
import re
from typing import List, Dict, Optional
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="BGMI OCR Service",
    description="Extract scoreboard data from BGMI tournament videos",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize EasyOCR reader (English only for better performance)
logger.info("🔄 Initializing EasyOCR reader...")
reader = easyocr.Reader(['en'], gpu=False)
logger.info("✅ EasyOCR reader initialized")


class VideoProcessRequest(BaseModel):
    video_path: str
    tournament_id: str


class TeamScore(BaseModel):
    rank: int
    team_name: str
    kills: int
    points: int
    confidence: float


class ProcessResponse(BaseModel):
    success: bool
    tournament_id: str
    teams: List[TeamScore]
    total_teams: int
    message: str


def extract_end_game_frame(video_path: str) -> Optional[np.ndarray]:
    """
    Extract the end-game scoreboard frame from video.
    Looks for frames in the last 30 seconds of the video.
    """
    try:
        cap = cv2.VideoCapture(video_path)
        
        if not cap.isOpened():
            logger.error(f"❌ Failed to open video: {video_path}")
            return None
        
        # Get video properties
        fps = cap.get(cv2.CAP_PROP_FPS)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        duration = total_frames / fps
        
        logger.info(f"📹 Video: {duration:.1f}s, {fps:.1f} FPS, {total_frames} frames")
        
        # Start from last 30 seconds
        start_time = max(0, duration - 30)
        start_frame = int(start_time * fps)
        
        cap.set(cv2.CAP_PROP_POS_FRAMES, start_frame)
        
        # Sample every 2 seconds in the last 30 seconds
        sample_interval = int(fps * 2)
        best_frame = None
        max_text_density = 0
        
        logger.info(f"🔍 Scanning last 30 seconds for scoreboard...")
        
        frame_count = 0
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
            
            frame_count += 1
            
            # Sample every N frames
            if frame_count % sample_interval == 0:
                # Convert to grayscale
                gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                
                # Calculate text density (white pixels in middle region)
                h, w = gray.shape
                roi = gray[int(h*0.2):int(h*0.8), int(w*0.1):int(w*0.9)]
                _, binary = cv2.threshold(roi, 200, 255, cv2.THRESH_BINARY)
                text_density = np.sum(binary) / binary.size
                
                if text_density > max_text_density:
                    max_text_density = text_density
                    best_frame = frame.copy()
                    logger.info(f"  📊 Better frame found (density: {text_density:.4f})")
        
        cap.release()
        
        if best_frame is not None:
            logger.info(f"✅ Best scoreboard frame found (density: {max_text_density:.4f})")
            return best_frame
        else:
            logger.warning("⚠️ No suitable scoreboard frame found")
            return None
            
    except Exception as e:
        logger.error(f"❌ Error extracting frame: {str(e)}")
        return None


def preprocess_frame(frame: np.ndarray) -> np.ndarray:
    """
    Preprocess frame for better OCR accuracy.
    """
    # Convert to grayscale
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    
    # Increase contrast
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)
    
    # Upscale for better OCR
    upscaled = cv2.resize(enhanced, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
    
    # Denoise
    denoised = cv2.fastNlMeansDenoising(upscaled, None, 10, 7, 21)
    
    # Threshold
    _, binary = cv2.threshold(denoised, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    
    return binary


def extract_scoreboard_data(frame: np.ndarray) -> List[TeamScore]:
    """
    Extract team rankings, names, kills, and points from scoreboard frame.
    """
    try:
        # Preprocess frame
        processed = preprocess_frame(frame)
        
        # Extract text using EasyOCR
        logger.info("🔍 Running OCR on scoreboard...")
        results = reader.readtext(processed)
        
        logger.info(f"📝 OCR found {len(results)} text regions")
        
        # Extract all text with positions
        text_data = []
        for (bbox, text, confidence) in results:
            # Get center Y position
            y_center = (bbox[0][1] + bbox[2][1]) / 2
            text_data.append({
                'text': text.strip(),
                'y': y_center,
                'confidence': confidence
            })
        
        # Sort by Y position (top to bottom)
        text_data.sort(key=lambda x: x['y'])
        
        # Group text by rows (similar Y positions)
        rows = []
        current_row = []
        last_y = -1
        y_threshold = 30  # pixels
        
        for item in text_data:
            if last_y == -1 or abs(item['y'] - last_y) < y_threshold:
                current_row.append(item)
                last_y = item['y']
            else:
                if current_row:
                    rows.append(current_row)
                current_row = [item]
                last_y = item['y']
        
        if current_row:
            rows.append(current_row)
        
        logger.info(f"📊 Grouped into {len(rows)} rows")
        
        # Extract team data from rows
        teams = []
        rank = 1
        
        for row in rows:
            row_text = ' '.join([item['text'] for item in row])
            avg_confidence = sum([item['confidence'] for item in row]) / len(row)
            
            # Skip header rows
            if any(keyword in row_text.lower() for keyword in ['rank', 'team', 'kills', 'points', 'total']):
                continue
            
            # Try to extract: Rank, Team Name, Kills, Points
            # Pattern: number, text, number, number
            numbers = re.findall(r'\d+', row_text)
            
            if len(numbers) >= 2:  # At least kills and points
                # Extract team name (non-numeric text)
                team_name_parts = []
                for item in row:
                    if not item['text'].isdigit():
                        team_name_parts.append(item['text'])
                
                team_name = ' '.join(team_name_parts).strip()
                
                # Clean team name
                team_name = re.sub(r'[^\w\s]', '', team_name)
                
                if team_name and len(team_name) >= 2:
                    try:
                        kills = int(numbers[-2]) if len(numbers) >= 2 else 0
                        points = int(numbers[-1]) if len(numbers) >= 1 else 0
                        
                        teams.append(TeamScore(
                            rank=rank,
                            team_name=team_name,
                            kills=kills,
                            points=points,
                            confidence=round(avg_confidence, 2)
                        ))
                        
                        rank += 1
                        logger.info(f"  ✅ Team {rank-1}: {team_name} - {kills} kills, {points} pts")
                        
                    except ValueError:
                        continue
        
        # Sort by points (highest first)
        teams.sort(key=lambda x: x.points, reverse=True)
        
        # Update ranks after sorting
        for i, team in enumerate(teams):
            team.rank = i + 1
        
        logger.info(f"✅ Extracted {len(teams)} teams from scoreboard")
        
        return teams
        
    except Exception as e:
        logger.error(f"❌ Error extracting scoreboard data: {str(e)}")
        return []


@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "service": "BGMI OCR Service",
        "status": "running",
        "version": "1.0.0"
    }


@app.post("/process-video", response_model=ProcessResponse)
async def process_video(request: VideoProcessRequest):
    """
    Process BGMI tournament video and extract scoreboard data.
    """
    try:
        logger.info(f"🎥 Processing video for tournament: {request.tournament_id}")
        logger.info(f"📁 Video path: {request.video_path}")
        
        # Validate video file exists
        if not os.path.exists(request.video_path):
            raise HTTPException(
                status_code=404,
                detail=f"Video file not found: {request.video_path}"
            )
        
        # Extract end-game scoreboard frame
        frame = extract_end_game_frame(request.video_path)
        
        if frame is None:
            raise HTTPException(
                status_code=400,
                detail="Failed to extract scoreboard frame from video"
            )
        
        # Extract scoreboard data
        teams = extract_scoreboard_data(frame)
        
        if not teams:
            raise HTTPException(
                status_code=400,
                detail="No team data could be extracted from scoreboard"
            )
        
        logger.info(f"✅ Successfully processed video - found {len(teams)} teams")
        
        return ProcessResponse(
            success=True,
            tournament_id=request.tournament_id,
            teams=teams,
            total_teams=len(teams),
            message=f"Successfully extracted {len(teams)} teams from scoreboard"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error processing video: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

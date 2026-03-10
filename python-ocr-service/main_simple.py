"""
Simplified BGMI OCR Service - For testing without heavy dependencies
This version returns mock data to test the integration
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import os
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="BGMI OCR Service (Simple Mode)",
    description="Simplified version for testing - returns mock data",
    version="1.0.0-simple"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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


@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "service": "BGMI OCR Service (Simple Mode)",
        "status": "running",
        "version": "1.0.0-simple",
        "note": "This is a simplified version that returns mock data for testing"
    }


@app.post("/process-video", response_model=ProcessResponse)
async def process_video(request: VideoProcessRequest):
    """
    Process BGMI tournament video - MOCK VERSION
    Returns sample data for testing integration
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
        
        logger.info("⚠️ SIMPLE MODE: Returning mock data for testing")
        
        # Return mock scoreboard data
        mock_teams = [
            TeamScore(rank=1, team_name="Team Alpha", kills=25, points=85, confidence=0.95),
            TeamScore(rank=2, team_name="Team Bravo", kills=22, points=78, confidence=0.92),
            TeamScore(rank=3, team_name="Team Charlie", kills=20, points=72, confidence=0.90),
            TeamScore(rank=4, team_name="Team Delta", kills=18, points=68, confidence=0.88),
            TeamScore(rank=5, team_name="Team Echo", kills=16, points=64, confidence=0.87),
            TeamScore(rank=6, team_name="Team Foxtrot", kills=15, points=60, confidence=0.85),
            TeamScore(rank=7, team_name="Team Golf", kills=14, points=56, confidence=0.83),
            TeamScore(rank=8, team_name="Team Hotel", kills=12, points=52, confidence=0.82),
            TeamScore(rank=9, team_name="Team India", kills=11, points=48, confidence=0.80),
            TeamScore(rank=10, team_name="Team Juliet", kills=10, points=45, confidence=0.78),
        ]
        
        logger.info(f"✅ Returning {len(mock_teams)} mock teams")
        
        return ProcessResponse(
            success=True,
            tournament_id=request.tournament_id,
            teams=mock_teams,
            total_teams=len(mock_teams),
            message=f"[MOCK DATA] Successfully extracted {len(mock_teams)} teams from scoreboard"
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
    logger.info("🚀 Starting BGMI OCR Service in SIMPLE MODE")
    logger.info("⚠️ This version returns mock data for testing")
    uvicorn.run(app, host="0.0.0.0", port=8000)

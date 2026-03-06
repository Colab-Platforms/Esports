# BGMI OCR Microservice

Python FastAPI microservice for extracting scoreboard data from BGMI tournament videos using OCR.

## Quick Start (Simple Mode - Recommended for Testing)

If you're having trouble installing dependencies, use the simple mode which returns mock data:

```bash
start_simple.bat
```

This will:
- Install only FastAPI, Uvicorn, and Pydantic (lightweight)
- Return mock scoreboard data for testing
- Let you test the full integration without heavy OCR dependencies

## Full Installation (With Real OCR)

For production use with actual video processing:

```bash
install.bat
```

This will install all dependencies including:
- EasyOCR (text recognition)
- OpenCV (video processing)
- PyTorch (ML backend)
- Total download: ~2GB

## Running the Service

### Simple Mode (Mock Data)
```bash
start_simple.bat
```

### Full Mode (Real OCR)
```bash
start.bat
```

Service will run on `http://localhost:8000`

## API Endpoints

### Health Check
```
GET /
```

### Process Video
```
POST /process-video
Content-Type: application/json

{
  "video_path": "/path/to/video.mp4",
  "tournament_id": "tournament_id_here"
}
```

Response:
```json
{
  "success": true,
  "tournament_id": "tournament_id_here",
  "teams": [
    {
      "rank": 1,
      "team_name": "Team Alpha",
      "kills": 15,
      "points": 45,
      "confidence": 0.92
    }
  ],
  "total_teams": 20,
  "message": "Successfully extracted 20 teams from scoreboard"
}
```

## How It Works

1. **Frame Extraction**: Scans last 30 seconds of video to find scoreboard frame
2. **Preprocessing**: Enhances image quality (grayscale, contrast, upscale, denoise)
3. **OCR**: Uses EasyOCR to extract text from scoreboard
4. **Data Parsing**: Groups text by rows and extracts team data
5. **Sorting**: Ranks teams by points

## Notes

- First run will download EasyOCR models (~100MB)
- Processing time: 30-60 seconds per video
- Works best with 1080p videos
- Requires clear, unobstructed scoreboard view

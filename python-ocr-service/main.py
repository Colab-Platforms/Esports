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
from urllib.request import urlopen

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


class ScoreboardImageProcessRequest(BaseModel):
    image_url: Optional[str] = None
    image_path: Optional[str] = None
    game_type: str = "freefire"


class ScoreboardImageRow(BaseModel):
    rawTeamName: str
    placement: Optional[int] = None
    kills: Optional[int] = None
    placementPoints: Optional[int] = None
    killPoints: Optional[int] = None
    totalPoints: Optional[int] = None
    confidence: Dict[str, float]


class ScoreboardImageProcessResponse(BaseModel):
    success: bool
    game_type: str
    layout: str
    rows: List[ScoreboardImageRow]
    total_rows: int
    detectedText: List[str]
    headers: List[str]
    reasonCode: Optional[str] = None
    imageMetadata: Dict
    warnings: List[str]
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


def preprocess_scoreboard_variants(frame: np.ndarray) -> List[Dict]:
    h, w = frame.shape[:2]
    scale = max(1.0, 1200 / max(w, 1), 900 / max(h, 1)) if w < 900 or h < 700 else 1.0
    resized = cv2.resize(frame, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
    gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(clipLimit=2.8, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)
    blurred = cv2.GaussianBlur(enhanced, (0, 0), 1.0)
    sharpened = cv2.addWeighted(enhanced, 1.6, blurred, -0.6, 0)
    adaptive = cv2.adaptiveThreshold(
        sharpened,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        31,
        8
    )
    _, otsu = cv2.threshold(sharpened, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    variants = [
        {"name": "upscaled_grayscale_contrast", "image": enhanced},
        {"name": "upscaled_sharpened", "image": sharpened},
        {"name": "adaptive_threshold", "image": adaptive},
        {"name": "otsu_threshold", "image": otsu}
    ]

    # Table screenshots often have useful content away from browser/window edges.
    margin_y = int(resized.shape[0] * 0.04)
    margin_x = int(resized.shape[1] * 0.04)
    if resized.shape[0] > margin_y * 2 and resized.shape[1] > margin_x * 2:
        cropped = resized[margin_y:resized.shape[0] - margin_y, margin_x:resized.shape[1] - margin_x]
        cropped_gray = cv2.cvtColor(cropped, cv2.COLOR_BGR2GRAY)
        cropped_enhanced = clahe.apply(cropped_gray)
        variants.append({"name": "table_region_contrast", "image": cropped_enhanced})

    return variants


def load_image_from_request(request: ScoreboardImageProcessRequest) -> np.ndarray:
    if request.image_path:
        if not os.path.exists(request.image_path):
            raise HTTPException(status_code=404, detail=f"Image file not found: {request.image_path}")
        image = cv2.imread(request.image_path)
        if image is None:
            raise HTTPException(status_code=400, detail="Unable to read image file")
        return image

    if request.image_url:
        with urlopen(request.image_url, timeout=20) as response:
            data = np.asarray(bytearray(response.read()), dtype=np.uint8)
            image = cv2.imdecode(data, cv2.IMREAD_COLOR)
        if image is None:
            raise HTTPException(status_code=400, detail="Unable to decode image URL")
        return image

    raise HTTPException(status_code=400, detail="image_url or image_path is required")


def confidence_value(value: float) -> float:
    try:
        return round(float(value), 2)
    except Exception:
        return 0.0


def normalize_detected_text(results) -> List[Dict]:
    text_data = []
    for bbox, text, confidence in results:
        y_center = (bbox[0][1] + bbox[2][1]) / 2
        x_center = (bbox[0][0] + bbox[2][0]) / 2
        text_data.append({
            "text": text.strip(),
            "x": x_center,
            "y": y_center,
            "confidence": confidence_value(confidence)
        })
    return text_data


def run_scoreboard_ocr(image: np.ndarray) -> Dict:
    logger.info("Running OCR on Free Fire scoreboard image...")
    variants = preprocess_scoreboard_variants(image)
    best = {"name": "none", "results": [], "text_data": []}

    for variant in variants:
        results = reader.readtext(variant["image"])
        text_data = normalize_detected_text(results)
        logger.info(f"OCR variant {variant['name']} found {len(text_data)} text regions")
        if len(text_data) > len(best["text_data"]):
            best = {"name": variant["name"], "results": results, "text_data": text_data}

    return best


def text_rows_from_data(text_data: List[Dict]) -> List[List[Dict]]:
    if not text_data:
        return []

    text_data.sort(key=lambda item: (item["y"], item["x"]))
    rows = []
    current_row = []
    last_y = None
    y_threshold = 34

    for item in text_data:
        if last_y is None or abs(item["y"] - last_y) < y_threshold:
            current_row.append(item)
            last_y = item["y"]
        else:
            if current_row:
                rows.append(current_row)
            current_row = [item]
            last_y = item["y"]

    if current_row:
        rows.append(current_row)
    return rows


def classify_scoreboard_layout(detected_text: List[str], rows: List[List[Dict]]) -> str:
    text = " ".join(detected_text).lower()
    game_column_count = len(re.findall(r"\bgame\s*\d+\b", text))
    has_aggregate_headers = (
        game_column_count >= 2
        and "rank" in text
        and "team" in text
        and "total" in text
        and "points" in text
    )
    if has_aggregate_headers:
        return "TOURNAMENT_AGGREGATE_SCOREBOARD"

    has_match_headers = (
        ("kill" in text or "kills" in text)
        and ("placement" in text or "place" in text or "rank" in text)
        and "team" in text
    )
    if has_match_headers:
        return "MATCH_RESULT_SCOREBOARD"

    for row in rows:
        row_text = " ".join(item["text"] for item in row)
        if len(re.findall(r"\d+", row_text)) >= 3:
            return "MATCH_RESULT_SCOREBOARD"

    return "UNKNOWN"


def extract_headers(rows: List[List[Dict]]) -> List[str]:
    headers = []
    for row in rows[:4]:
        row_text = " ".join(item["text"] for item in row).strip()
        lowered = row_text.lower()
        if any(keyword in lowered for keyword in ["rank", "team", "game", "kill", "point", "placement", "total"]):
            headers.append(row_text)
    return headers[:8]


def extract_freefire_scoreboard_rows_from_text_rows(rows: List[List[Dict]]) -> List[ScoreboardImageRow]:
    extracted_rows = []

    for row in rows:
        row.sort(key=lambda item: item["x"])
        row_text = " ".join(item["text"] for item in row)
        lowered = row_text.lower()
        header_hits = sum(1 for keyword in ["rank", "team", "kills", "points", "total", "place"] if keyword in lowered)
        if header_hits >= 2 and not re.search(r"\d", row_text):
            continue

        numbers = [int(value) for value in re.findall(r"\d+", row_text)]
        name_tokens = [
            item["text"] for item in row
            if not re.fullmatch(r"[\d\s#.\-]+", item["text"])
        ]
        team_name = re.sub(r"[^\w\s&.-]", "", " ".join(name_tokens)).strip()

        if len(team_name) < 2 or len(numbers) < 2:
            continue

        avg_confidence = sum(item["confidence"] for item in row) / len(row)
        placement = numbers[0] if len(numbers) >= 3 else None
        kills = numbers[-2]
        total_points = numbers[-1]
        placement_points = numbers[-3] if len(numbers) >= 4 else None
        kill_points = numbers[-2] if len(numbers) >= 4 else None

        extracted_rows.append(ScoreboardImageRow(
            rawTeamName=team_name,
            placement=placement,
            kills=kills,
            placementPoints=placement_points,
            killPoints=kill_points,
            totalPoints=total_points,
            confidence={
                "row": confidence_value(avg_confidence),
                "teamName": confidence_value(avg_confidence),
                "numbers": confidence_value(avg_confidence)
            }
        ))

    return extracted_rows


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


@app.post("/process-scoreboard-image", response_model=ScoreboardImageProcessResponse)
async def process_scoreboard_image(request: ScoreboardImageProcessRequest):
    """
    Process a scoreboard image and return OCR rows only. Tournament matching,
    validation, and result creation remain in the Node API.
    """
    try:
        game_type = request.game_type.lower().strip()
        if game_type != "freefire":
            raise HTTPException(status_code=400, detail="Only Free Fire scoreboard images are supported")

        image = load_image_from_request(request)
        height, width = image.shape[:2]
        ocr = run_scoreboard_ocr(image)
        text_rows = text_rows_from_data(ocr["text_data"])
        detected_text = [item["text"] for item in ocr["text_data"] if item["text"]]
        headers = extract_headers(text_rows)
        layout = classify_scoreboard_layout(detected_text, text_rows)
        rows = []
        warnings = []
        reason_code = None

        if width < 600 or height < 400:
            warnings.append(f"IMAGE_TOO_LOW_RESOLUTION: Image is {width}x{height}; OCR may be unreliable.")

        if not detected_text:
            reason_code = "NO_TEXT_DETECTED"
            warnings.append("NO_TEXT_DETECTED: OCR did not detect readable text in this image.")
        elif layout == "TOURNAMENT_AGGREGATE_SCOREBOARD":
            reason_code = "UNSUPPORTED_SCOREBOARD_LAYOUT"
            warnings.append("UNSUPPORTED_SCOREBOARD_LAYOUT: Tournament aggregate scoreboard detected. It cannot be safely converted into one match result.")
        else:
            rows = extract_freefire_scoreboard_rows_from_text_rows(text_rows)
            if not rows:
                reason_code = "NO_SUPPORTED_ROWS_DETECTED"
                warnings.append("NO_SUPPORTED_ROWS_DETECTED: OCR found text, but no supported Free Fire match-result rows were parsed.")

        return ScoreboardImageProcessResponse(
            success=True,
            game_type=game_type,
            layout=layout,
            rows=rows,
            total_rows=len(rows),
            detectedText=detected_text[:80],
            headers=headers,
            reasonCode=reason_code,
            imageMetadata={
                "width": width,
                "height": height,
                "preprocessing": [ocr["name"]]
            },
            warnings=warnings,
            message=f"Extracted {len(rows)} Free Fire scoreboard rows"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing scoreboard image: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail={
                "code": "OCR_SERVICE_ERROR",
                "message": "OCR service failed while processing this image."
            }
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

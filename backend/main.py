import os
import subprocess
import hashlib
from typing import Optional
# pyrefly: ignore [missing-import]
from fastapi import FastAPI, Request, HTTPException, status
# pyrefly: ignore [missing-import]
from fastapi.responses import StreamingResponse, FileResponse, JSONResponse
# pyrefly: ignore [missing-import]
from fastapi.middleware.cors import CORSMiddleware
# pyrefly: ignore [missing-import]
from fastapi.staticfiles import StaticFiles

app = FastAPI(title="Personal Video Streaming API")

# Enable CORS for frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

VIDEO_DIR = os.getenv("VIDEO_DIR", "/media/videos")
CACHE_DIR = os.getenv("CACHE_DIR", "/app/cache")
THUMBNAIL_DIR = os.path.join(CACHE_DIR, "thumbnails")

# Ensure cache directories exist
os.makedirs(THUMBNAIL_DIR, exist_ok=True)

# Mount static files for thumbnails
app.mount("/static/thumbnails", StaticFiles(directory=THUMBNAIL_DIR), name="thumbnails")


def get_file_hash(filename: str) -> str:
    return hashlib.md5(filename.encode("utf-8")).hexdigest()


def generate_thumbnail(video_path: str, thumbnail_path: str) -> bool:
    """Extract a thumbnail frame at 5 seconds using FFmpeg."""
    if os.path.exists(thumbnail_path):
        return True
    try:
        command = [
            "ffmpeg",
            "-ss", "00:00:05",
            "-i", video_path,
            "-vframes", "1",
            "-q:v", "2",
            "-vf", "scale=480:-1",
            thumbnail_path,
            "-y"
        ]
        result = subprocess.run(command, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return result.returncode == 0
    except Exception as e:
        print(f"Error generating thumbnail for {video_path}: {e}")
        return False


def format_size(size_in_bytes: int) -> str:
    """Format bytes to human-readable size string."""
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if size_in_bytes < 1024.0:
            return f"{size_in_bytes:.2f} {unit}"
        size_in_bytes /= 1024.0
    return f"{size_in_bytes:.2f} PB"


@app.get("/api/health")
def health_check():
    return {"status": "ok", "video_dir": VIDEO_DIR, "videos_found": len(get_video_list())}


def get_video_list():
    """Scan VIDEO_DIR for supported video formats."""
    supported_extensions = ('.mp4', '.mkv', '.webm', '.mov', '.avi')
    videos = []
    
    if not os.path.exists(VIDEO_DIR):
        return videos

    for root, _, files in os.walk(VIDEO_DIR):
        for file in sorted(files):
            if file.lower().endswith(supported_extensions):
                rel_path = os.path.relpath(os.path.join(root, file), VIDEO_DIR)
                full_path = os.path.join(VIDEO_DIR, rel_path)
                file_size = os.path.getsize(full_path)
                file_hash = get_file_hash(rel_path)
                
                thumb_filename = f"{file_hash}.jpg"

                # Pretty title: cleanup filename
                title = os.path.splitext(file)[0].replace('_', ' ').replace('-', ' ')
                
                videos.append({
                    "id": file_hash,
                    "filename": rel_path,
                    "title": title,
                    "size_bytes": file_size,
                    "formatted_size": format_size(file_size),
                    "thumbnail_url": f"/api/thumbnail/{rel_path}",
                    "stream_url": f"/api/stream/{rel_path}"
                })
    return videos


@app.get("/api/videos")
def list_videos():
    """Endpoint returning all available videos and metadata instantly."""
    return get_video_list()


@app.get("/api/thumbnail/{video_path:path}")
def get_thumbnail(video_path: str):
    """Serve cached thumbnail image, generating it on-demand if missing."""
    full_path = os.path.join(VIDEO_DIR, video_path)
    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail="Video file not found")
        
    file_hash = get_file_hash(video_path)
    thumb_filename = f"{file_hash}.jpg"
    thumb_path = os.path.join(THUMBNAIL_DIR, thumb_filename)
    
    if not os.path.exists(thumb_path):
        generate_thumbnail(full_path, thumb_path)

    if os.path.exists(thumb_path):
        return FileResponse(thumb_path, media_type="image/jpeg")

    raise HTTPException(status_code=404, detail="Thumbnail could not be generated")



@app.get("/api/stream/{video_path:path}")
def stream_video(video_path: str, request: Request):
    """HTTP Range request streaming endpoint for video playback & seeking."""
    full_path = os.path.join(VIDEO_DIR, video_path)
    
    if not os.path.exists(full_path) or not os.path.isfile(full_path):
        raise HTTPException(status_code=404, detail="Video file not found")
        
    file_size = os.path.getsize(full_path)
    range_header = request.headers.get("range")
    
    # Standard content type detection
    content_type = "video/mp4"
    if video_path.lower().endswith(".webm"):
        content_type = "video/webm"
    elif video_path.lower().endswith(".mkv"):
        content_type = "video/x-matroska"

    if range_header:
        # Range header format: "bytes=start-end"
        try:
            unit, range_val = range_header.strip().split("=")
            if unit != "bytes":
                raise ValueError()
                
            start_str, end_str = range_val.split("-")
            start = int(start_str) if start_str else 0
            end = int(end_str) if end_str else file_size - 1
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_416_REQUESTED_RANGE_NOT_SATISFIABLE,
                detail="Invalid range header"
            )

        if start >= file_size or end >= file_size:
            headers = {"Content-Range": f"bytes */{file_size}"}
            raise HTTPException(
                status_code=status.HTTP_416_REQUESTED_RANGE_NOT_SATISFIABLE,
                headers=headers
            )

        # Limit chunk size to 2MB for responsive streaming
        chunk_size = 2 * 1024 * 1024
        end = min(end, start + chunk_size - 1)
        content_length = (end - start) + 1

        def video_stream_generator(file_path, start_pos, count):
            with open(file_path, "rb") as video_file:
                video_file.seek(start_pos)
                bytes_left = count
                while bytes_left > 0:
                    read_bytes = min(64 * 1024, bytes_left)
                    data = video_file.read(read_bytes)
                    if not data:
                        break
                    bytes_left -= len(data)
                    yield data

        headers = {
            "Content-Range": f"bytes {start}-{end}/{file_size}",
            "Accept-Ranges": "bytes",
            "Content-Length": str(content_length),
            "Content-Type": content_type,
        }

        return StreamingResponse(
            video_stream_generator(full_path, start, content_length),
            status_code=206,
            headers=headers,
        )
    else:
        # Full file streaming (if Range header is missing)
        headers = {
            "Accept-Ranges": "bytes",
            "Content-Length": str(file_size),
            "Content-Type": content_type,
        }
        return FileResponse(full_path, headers=headers, media_type=content_type)

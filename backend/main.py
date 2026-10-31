import os
import time
import subprocess
import hashlib
import hmac
import json
import secrets
import threading
from collections import defaultdict, deque
from typing import Optional
# pyrefly: ignore [missing-import]
from fastapi import FastAPI, Request, Response, HTTPException, status
# pyrefly: ignore [missing-import]
from fastapi.responses import StreamingResponse, FileResponse, JSONResponse
# pyrefly: ignore [missing-import]
from fastapi.staticfiles import StaticFiles

app = FastAPI(title="Personal Video Streaming API")

VIDEO_DIR = os.getenv("VIDEO_DIR", "/media/videos")
CACHE_DIR = os.getenv("CACHE_DIR", "/app/cache")
THUMBNAIL_DIR = os.path.join(CACHE_DIR, "thumbnails")
SITE_PASSWORD = os.getenv("SITE_PASSWORD", "")
if not SITE_PASSWORD:
    raise RuntimeError("SITE_PASSWORD must be set in the environment (.env)")
AUTH_COOKIE_NAME = "aether_session"

SESSION_TTL_SHORT = 12 * 60 * 60          # 12 hours (session cookie)
SESSION_TTL_REMEMBER = 30 * 24 * 60 * 60  # 30 days ("remember me")
MAX_FAILED_LOGINS = 5
LOGIN_WINDOW_SECONDS = 15 * 60

# Ensure cache directories exist
os.makedirs(THUMBNAIL_DIR, exist_ok=True)

# Mount static files for thumbnails
app.mount("/static/thumbnails", StaticFiles(directory=THUMBNAIL_DIR), name="thumbnails")


def get_file_hash(filename: str) -> str:
    return hashlib.md5(filename.encode("utf-8")).hexdigest()


def safe_join(base: str, relative: str) -> str:
    """Join a user-supplied relative path onto base, refusing paths that escape it."""
    full = os.path.realpath(os.path.join(base, relative))
    if os.path.commonpath([os.path.realpath(base), full]) != os.path.realpath(base):
        raise HTTPException(status_code=404, detail="Video file not found")
    return full


def generate_thumbnail(video_path: str, thumbnail_path: str) -> bool:
    """Extract a single frame (5s in, or the first frame for short clips) as a 16:9-friendly JPEG."""
    if os.path.exists(thumbnail_path):
        return True
    tmp_path = f"{thumbnail_path}.{secrets.token_hex(4)}.tmp.jpg"
    try:
        for timestamp in ("00:00:05", "00:00:00"):
            command = [
                "ffmpeg", "-y",
                "-ss", timestamp, "-i", video_path,
                "-frames:v", "1",
                "-vf", "scale=640:-2",
                "-q:v", "3",
                tmp_path,
            ]
            result = subprocess.run(command, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            if result.returncode == 0 and os.path.exists(tmp_path) and os.path.getsize(tmp_path) > 0:
                os.replace(tmp_path, thumbnail_path)
                return True
        return False
    except Exception as e:
        print(f"Error generating thumbnail for {video_path}: {e}")
        return False
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


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

# ------------------------------------------------------------------
# Session management (server-side, persisted so restarts keep logins)
# ------------------------------------------------------------------
SESSIONS_FILE = os.path.join(CACHE_DIR, "sessions.json")
_sessions_lock = threading.Lock()
_sessions = {}  # sha256(token) -> expiry timestamp


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _load_sessions():
    try:
        with open(SESSIONS_FILE, "r", encoding="utf-8") as f:
            now = time.time()
            return {k: v for k, v in json.load(f).items() if v > now}
    except (OSError, ValueError):
        return {}


def _save_sessions():
    try:
        tmp = SESSIONS_FILE + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(_sessions, f)
        os.replace(tmp, SESSIONS_FILE)
    except OSError as e:
        print(f"Could not persist sessions: {e}")


_sessions = _load_sessions()


def create_session(ttl: int) -> str:
    token = secrets.token_urlsafe(32)
    now = time.time()
    with _sessions_lock:
        for key in [k for k, exp in _sessions.items() if exp <= now]:
            del _sessions[key]
        _sessions[_hash_token(token)] = now + ttl
        _save_sessions()
    return token


def session_valid(token: Optional[str]) -> bool:
    if not token:
        return False
    key = _hash_token(token)
    with _sessions_lock:
        expiry = _sessions.get(key)
        if expiry is None:
            return False
        if expiry <= time.time():
            del _sessions[key]
            _save_sessions()
            return False
        return True


def destroy_session(token: Optional[str]):
    if not token:
        return
    with _sessions_lock:
        if _sessions.pop(_hash_token(token), None) is not None:
            _save_sessions()


# ------------------------------------------------------------------
# Login rate limiting (per client IP)
# ------------------------------------------------------------------
_failed_logins = defaultdict(deque)


def client_ip(request: Request) -> str:
    return request.headers.get("x-real-ip") or (request.client.host if request.client else "unknown")


def retry_after(ip: str) -> int:
    """Seconds until the IP may try again, or 0 if it is not locked out."""
    attempts = _failed_logins[ip]
    now = time.time()
    while attempts and now - attempts[0] > LOGIN_WINDOW_SECONDS:
        attempts.popleft()
    if len(attempts) >= MAX_FAILED_LOGINS:
        return int(LOGIN_WINDOW_SECONDS - (now - attempts[0])) + 1
    return 0


@app.post("/api/login")
async def login(request: Request, response: Response):
    ip = client_ip(request)
    wait = retry_after(ip)
    if wait:
        raise HTTPException(
            status_code=429,
            detail="Too many failed attempts. Try again later.",
            headers={"Retry-After": str(wait)},
        )

    try:
        data = await request.json()
        password = str(data.get("password", ""))
        remember = bool(data.get("remember", False))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid request")

    if not hmac.compare_digest(password.encode("utf-8"), SITE_PASSWORD.encode("utf-8")):
        _failed_logins[ip].append(time.time())
        raise HTTPException(status_code=401, detail="Invalid password")

    _failed_logins.pop(ip, None)
    ttl = SESSION_TTL_REMEMBER if remember else SESSION_TTL_SHORT
    token = create_session(ttl)
    response.set_cookie(
        key=AUTH_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=request.headers.get("x-forwarded-proto") == "https",
        samesite="lax",
        path="/",
        # "Remember me" gets a persistent cookie; otherwise a browser-session cookie
        max_age=ttl if remember else None,
    )
    return {"status": "success"}


@app.post("/api/logout")
def logout(request: Request, response: Response):
    destroy_session(request.cookies.get(AUTH_COOKIE_NAME))
    response.delete_cookie(key=AUTH_COOKIE_NAME, path="/")
    return {"status": "logged_out"}


@app.get("/api/auth_check")
def auth_check(request: Request):
    """Endpoint for Nginx auth_request module to verify the session cookie."""
    if session_valid(request.cookies.get(AUTH_COOKIE_NAME)):
        return Response(status_code=200)
    raise HTTPException(status_code=401, detail="Unauthorized")


@app.get("/api/session")
def session_status():
    """Protected by Nginx auth_request; the frontend polls it to detect expiry."""
    return {"status": "ok"}


# Cache for video list to avoid scanning the filesystem on every request
_video_cache = {
    "timestamp": 0,
    "data": []
}
CACHE_TTL_SECONDS = 30

def get_video_list():
    """Scan VIDEO_DIR for supported video formats and metadata."""
    global _video_cache
    if time.time() - _video_cache["timestamp"] < CACHE_TTL_SECONDS:
        return _video_cache["data"]

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
                mtime = os.path.getmtime(full_path)
                file_hash = get_file_hash(rel_path)
                
                title = os.path.splitext(file)[0].replace('_', ' ').replace('-', ' ')
                
                videos.append({
                    "id": file_hash,
                    "filename": rel_path,
                    "title": title,
                    "size_bytes": file_size,
                    "formatted_size": format_size(file_size),
                    "mtime": mtime,
                    "thumbnail_url": f"/api/thumbnail/{rel_path}",
                    "stream_url": f"/api/stream/{rel_path}"
                })
                
    _video_cache["data"] = videos
    _video_cache["timestamp"] = time.time()
    return videos


@app.get("/api/videos")
def list_videos():
    """Endpoint returning all available videos and metadata instantly."""
    return get_video_list()


@app.get("/api/thumbnail/{video_path:path}")
def get_thumbnail(video_path: str):
    """Serve the cached thumbnail image, generating it on-demand if missing."""
    full_path = safe_join(VIDEO_DIR, video_path)
    if not os.path.isfile(full_path):
        raise HTTPException(status_code=404, detail="Video file not found")
        
    file_hash = get_file_hash(video_path)
    thumb_filename = f"{file_hash}_thumb.jpg"
    thumb_path = os.path.join(THUMBNAIL_DIR, thumb_filename)
    
    if not os.path.exists(thumb_path):
        generate_thumbnail(full_path, thumb_path)

    if os.path.exists(thumb_path):
        return FileResponse(
            thumb_path,
            media_type="image/jpeg",
            headers={"Cache-Control": "private, max-age=86400"},
        )

    raise HTTPException(status_code=404, detail="Thumbnail could not be generated")



@app.get("/api/stream/{video_path:path}")
def stream_video(video_path: str, request: Request):
    """HTTP Range request streaming endpoint for video playback & seeking."""
    full_path = safe_join(VIDEO_DIR, video_path)
    
    if not os.path.isfile(full_path):
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

        # Limit chunk size to 20MB to reduce HTTP request overhead
        chunk_size = 20 * 1024 * 1024
        end = min(end, start + chunk_size - 1)
        content_length = (end - start) + 1

        def video_stream_generator(file_path, start_pos, count):
            with open(file_path, "rb") as video_file:
                video_file.seek(start_pos)
                bytes_left = count
                while bytes_left > 0:
                    # Read in 1MB chunks to reduce generator overhead
                    read_bytes = min(1024 * 1024, bytes_left)
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

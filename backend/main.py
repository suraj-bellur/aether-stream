import os
import time
import subprocess
import hashlib
import hmac
import json
import secrets
import threading
from collections import defaultdict, deque
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from typing import Optional
# pyrefly: ignore [missing-import]
from PIL import Image, ImageOps
# pyrefly: ignore [missing-import]
from fastapi import FastAPI, Request, Response, HTTPException, status
# pyrefly: ignore [missing-import]
from fastapi.responses import StreamingResponse, FileResponse, JSONResponse
# pyrefly: ignore [missing-import]
from fastapi.staticfiles import StaticFiles

app = FastAPI(title="Personal Media Streaming API")


@app.on_event("startup")
async def raise_threadpool_limit():
    # Thumbnail requests block worker threads while they queue for a generation slot;
    # give the pool enough headroom that API calls are never starved behind them.
    # pyrefly: ignore [missing-import]
    from anyio import to_thread
    to_thread.current_default_thread_limiter().total_tokens = 100


# VIDEO_DIR is the media root; it holds videos and photos, at the top level or in sub-folders
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


# Bump THUMB_VERSION whenever the selection logic changes so stale thumbnails regenerate
THUMB_VERSION = "v2"
THUMB_MAX_EDGE = 1280
THUMB_CANDIDATE_POINTS = (0.15, 0.35, 0.55, 0.75)
# Each thumbnail runs several ffmpeg passes; cap how many generate at once
_thumb_semaphore = threading.BoundedSemaphore(3)


def probe_duration(video_path: str) -> float:
    try:
        result = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", video_path],
            capture_output=True, text=True, timeout=30,
        )
        return float(result.stdout.strip())
    except (ValueError, OSError, subprocess.SubprocessError):
        return 0.0


def generate_thumbnail(video_path: str, thumbnail_path: str) -> bool:
    """Pick a representative, detailed frame and save it as a JPEG.

    A frame is sampled at several points through the video (ffmpeg's `thumbnail`
    filter picks the most representative frame of a short burst at each point),
    and the candidate with the largest JPEG wins: black fades, title cards and
    blurry transitions compress to tiny files, detailed scenes do not.
    """
    if os.path.exists(thumbnail_path):
        return True
    with _thumb_semaphore:
        if os.path.exists(thumbnail_path):
            return True
        duration = probe_duration(video_path)
        if duration > 2:
            timestamps = [duration * p for p in THUMB_CANDIDATE_POINTS]
        else:
            timestamps = [0.0]
        scale = (f"scale='min({THUMB_MAX_EDGE},iw)':'min({THUMB_MAX_EDGE},ih)'"
                 ":force_original_aspect_ratio=decrease:force_divisible_by=2")
        token = secrets.token_hex(4)
        candidates = []
        try:
            for i, ts in enumerate(timestamps):
                tmp_path = f"{thumbnail_path}.{token}.{i}.tmp.jpg"
                candidates.append(tmp_path)
                command = [
                    "ffmpeg", "-y", "-v", "error",
                    "-ss", f"{ts:.2f}", "-i", video_path,
                    "-an", "-sn",
                    "-vf", f"thumbnail=40,{scale}",
                    "-frames:v", "1",
                    "-q:v", "3",
                    tmp_path,
                ]
                subprocess.run(command, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=60)

            produced = [p for p in candidates if os.path.exists(p) and os.path.getsize(p) > 0]
            if not produced:
                # Last resort: the very first frame, no filters beyond scaling
                tmp_path = f"{thumbnail_path}.{token}.first.tmp.jpg"
                candidates.append(tmp_path)
                subprocess.run(
                    ["ffmpeg", "-y", "-v", "error", "-i", video_path, "-frames:v", "1",
                     "-vf", scale, "-q:v", "3", tmp_path],
                    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=60,
                )
                produced = [tmp_path] if os.path.exists(tmp_path) and os.path.getsize(tmp_path) > 0 else []
            if not produced:
                return False

            os.replace(max(produced, key=os.path.getsize), thumbnail_path)
            return True
        except Exception as e:
            print(f"Error generating thumbnail for {video_path}: {e}")
            return False
        finally:
            for path in candidates:
                if os.path.exists(path):
                    os.remove(path)


def format_size(size_in_bytes: int) -> str:
    """Format bytes to human-readable size string."""
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if size_in_bytes < 1024.0:
            return f"{size_in_bytes:.2f} {unit}"
        size_in_bytes /= 1024.0
    return f"{size_in_bytes:.2f} PB"


@app.get("/api/health")
def health_check():
    library = get_library()
    return {
        "status": "ok",
        "video_dir": VIDEO_DIR,
        "videos_found": len(library["videos"]),
        "photos_found": len(library["photos"]),
        "folders_found": len(library["folders"]),
    }

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


# ------------------------------------------------------------------
# Library scanning (videos, photos and the folder tree)
# ------------------------------------------------------------------
VIDEO_EXTENSIONS = ('.mp4', '.mkv', '.webm', '.mov', '.avi', '.m4v')
PHOTO_EXTENSIONS = ('.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp')
# System folders that never hold the user's media (compared lower-case)
SKIP_DIRS = {"system volume information", "$recycle.bin", "lost+found", "@eadir"}
FOLDER_COVER_COUNT = 3
CACHE_TTL_SECONDS = 30

# Photo dimensions/EXIF are expensive to read over the VirtualBox share, so they
# are persisted and only re-read when a file's size or mtime changes.
PHOTO_META_FILE = os.path.join(CACHE_DIR, "photo_meta.json")
EXIF_ORIENTATION = 274
EXIF_DATETIME = 306
EXIF_IFD = 0x8769
EXIF_DATETIME_ORIGINAL = 36867

_library_lock = threading.Lock()
_library_cache = {"timestamp": 0, "data": None}


def _load_photo_meta() -> dict:
    try:
        with open(PHOTO_META_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def _save_photo_meta(meta: dict):
    try:
        tmp = PHOTO_META_FILE + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(meta, f)
        os.replace(tmp, PHOTO_META_FILE)
    except OSError as e:
        print(f"Could not persist photo metadata: {e}")


def parse_exif_date(value) -> Optional[str]:
    """EXIF stores 'YYYY:MM:DD HH:MM:SS'; return it as a naive ISO string (camera local time)."""
    if not value:
        return None
    try:
        text = str(value).strip().strip("\x00")
        return datetime.strptime(text[:19], "%Y:%m:%d %H:%M:%S").isoformat()
    except ValueError:
        return None


def read_photo_meta(full_path: str) -> dict:
    """Read display dimensions (after EXIF rotation) and the capture date of a photo."""
    try:
        with Image.open(full_path) as img:
            width, height = img.size
            exif = img.getexif()
            # Orientations 5-8 are rotated 90 degrees, so width and height swap on display
            if exif.get(EXIF_ORIENTATION) in (5, 6, 7, 8):
                width, height = height, width
            taken = exif.get_ifd(EXIF_IFD).get(EXIF_DATETIME_ORIGINAL) or exif.get(EXIF_DATETIME)
            return {"w": width, "h": height, "taken": parse_exif_date(taken)}
    except Exception as e:
        print(f"Could not read photo metadata for {full_path}: {e}")
        return {"w": 4, "h": 3, "taken": None, "broken": True}


def _add_to_folders(folders: dict, rel_dir: str, kind: str, rel_path: str):
    """Count the file towards its folder and every ancestor folder (recursive totals)."""
    parts = rel_dir.split("/") if rel_dir else []
    for depth in range(len(parts), 0, -1):
        path = "/".join(parts[:depth])
        folder = folders.setdefault(path, {
            "path": path,
            "name": parts[depth - 1],
            "parent": "/".join(parts[:depth - 1]),
            "videos": 0,
            "photos": 0,
            "cover_videos": [],
            "cover_photos": [],
        })
        folder[kind] += 1
        covers = folder[f"cover_{kind}"]
        if len(covers) < FOLDER_COVER_COUNT:
            covers.append(rel_path)


def get_library() -> dict:
    """Return the library, rescanning in the background once the cached copy is stale.

    Only the very first call (nothing cached yet) waits for a scan; after that a
    stale copy is served instantly while a fresh scan runs, so a slow drive never
    delays page loads.
    """
    cached = _library_cache["data"]
    if cached is None:
        with _library_lock:
            if _library_cache["data"] is None:
                _scan_library()
        return _library_cache["data"]

    if time.time() - _library_cache["timestamp"] >= CACHE_TTL_SECONDS and _library_lock.acquire(blocking=False):
        def refresh():
            try:
                _scan_library()
            except Exception as e:
                print(f"Library rescan failed: {e}")
            finally:
                _library_lock.release()
        threading.Thread(target=refresh, daemon=True).start()
    return cached


def _scan_library():
    """Scan VIDEO_DIR (recursively) for videos, photos and the folders that contain them.

    Callers must hold _library_lock.
    """
    videos, photos, folders = [], [], {}
    if os.path.isdir(VIDEO_DIR):
        for root, dirs, files in os.walk(VIDEO_DIR):
            # Prune hidden and system folders in place so os.walk never descends into them
            dirs[:] = sorted(
                (d for d in dirs if not d.startswith(".") and d.lower() not in SKIP_DIRS),
                key=str.lower,
            )
            rel_dir = os.path.relpath(root, VIDEO_DIR).replace(os.sep, "/")
            if rel_dir == ".":
                rel_dir = ""

            for file in sorted(files, key=str.lower):
                if file.startswith("."):
                    continue
                ext = os.path.splitext(file)[1].lower()
                if ext in VIDEO_EXTENSIONS:
                    kind = "videos"
                elif ext in PHOTO_EXTENSIONS:
                    kind = "photos"
                else:
                    continue

                rel_path = f"{rel_dir}/{file}" if rel_dir else file
                try:
                    stat = os.stat(os.path.join(root, file))
                except OSError:
                    continue

                item = {
                    "id": get_file_hash(rel_path),
                    "filename": rel_path,
                    "folder": rel_dir,
                    "size_bytes": stat.st_size,
                    "formatted_size": format_size(stat.st_size),
                    "mtime": stat.st_mtime,
                }
                if kind == "videos":
                    item["title"] = os.path.splitext(file)[0].replace('_', ' ').replace('-', ' ')
                    videos.append(item)
                else:
                    item["name"] = file
                    photos.append(item)
                _add_to_folders(folders, rel_dir, kind, rel_path)

    _attach_photo_meta(photos)

    _library_cache["data"] = {
        "root_name": os.path.basename(os.path.normpath(VIDEO_DIR)) or "Library",
        "videos": videos,
        "photos": photos,
        "folders": sorted(folders.values(), key=lambda f: f["path"].lower()),
    }
    _library_cache["timestamp"] = time.time()
    # New or changed files: let the background warmer pre-render anything missing
    _warm_wakeup.set()


def _attach_photo_meta(photos: list):
    stored = _load_photo_meta()
    fresh = {}
    missing = []
    for photo in photos:
        entry = stored.get(photo["filename"])
        if entry and entry.get("size") == photo["size_bytes"] and entry.get("mtime") == photo["mtime"]:
            fresh[photo["filename"]] = entry
        else:
            missing.append(photo)

    if missing:
        started = time.time()
        with ThreadPoolExecutor(max_workers=8) as pool:
            results = pool.map(lambda p: read_photo_meta(os.path.join(VIDEO_DIR, p["filename"])), missing)
            for photo, meta in zip(missing, results):
                fresh[photo["filename"]] = {**meta, "size": photo["size_bytes"], "mtime": photo["mtime"]}
        print(f"Read metadata for {len(missing)} photos in {time.time() - started:.1f}s")

    # Rewrite when anything changed (new photos read, or deleted photos dropped)
    if missing or len(fresh) != len(stored):
        _save_photo_meta(fresh)

    for photo in photos:
        meta = fresh[photo["filename"]]
        photo["width"] = meta["w"]
        photo["height"] = meta["h"]
        photo["taken"] = meta.get("taken") or datetime.fromtimestamp(photo["mtime"]).isoformat(timespec="seconds")


@app.get("/api/library")
def library():
    """Everything the UI needs in one call: videos, photos and the folder tree."""
    return get_library()


@app.get("/api/videos")
def list_videos():
    """Video list only (kept for compatibility)."""
    return get_library()["videos"]


@app.get("/api/thumbnail/{video_path:path}")
def get_thumbnail(video_path: str):
    """Serve the cached thumbnail image, generating it on-demand if missing."""
    full_path = safe_join(VIDEO_DIR, video_path)
    if not os.path.isfile(full_path):
        raise HTTPException(status_code=404, detail="Video file not found")
        
    file_hash = get_file_hash(video_path)
    thumb_filename = f"{file_hash}_{THUMB_VERSION}.jpg"
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


# ------------------------------------------------------------------
# Photo renditions (the originals are often 10MB+, far too big for a grid)
# ------------------------------------------------------------------
PHOTO_RENDITIONS = {
    # name: (max width, max height, JPEG quality)
    "thumb": (1440, 480, 80),   # grid tiles: 480px tall covers ~240px rows on 2x screens
    "view": (2048, 2048, 85),   # lightbox
}
_photo_semaphore = threading.BoundedSemaphore(4)


def photo_rendition_path(photo_path: str, rendition: str) -> str:
    return os.path.join(THUMBNAIL_DIR, f"{get_file_hash(photo_path)}_{rendition}.jpg")


def render_photo(src: str, photo_path: str) -> bool:
    """Write every missing rendition of a photo from a single read of the original.

    On a slow drive, reading the 10-20MB original dominates the cost, so the grid
    thumbnail and the viewer copy are always produced together.
    """
    missing = [r for r in PHOTO_RENDITIONS if not os.path.exists(photo_rendition_path(photo_path, r))]
    if not missing:
        return True
    with _photo_semaphore:
        missing = [r for r in missing if not os.path.exists(photo_rendition_path(photo_path, r))]
        if not missing:
            return True
        token = secrets.token_hex(4)
        temps = []
        try:
            with Image.open(src) as img:
                # Let the JPEG decoder downscale by 1/2, 1/4 or 1/8 while decoding (much faster).
                # Size for the largest rendition needed, as a square box so rotated photos are never undersized.
                edge = max(min(PHOTO_RENDITIONS[r][0], PHOTO_RENDITIONS[r][1]) for r in missing)
                img.draft("RGB", (edge, edge))
                img = ImageOps.exif_transpose(img)
                if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
                    rgba = img.convert("RGBA")
                    img = Image.new("RGB", rgba.size, (14, 14, 22))
                    img.paste(rgba, mask=rgba.split()[-1])
                elif img.mode != "RGB":
                    img = img.convert("RGB")

                # Largest first, so each smaller rendition is resized from an already-reduced image
                for rendition in sorted(missing, key=lambda r: -PHOTO_RENDITIONS[r][0] * PHOTO_RENDITIONS[r][1]):
                    max_w, max_h, quality = PHOTO_RENDITIONS[rendition]
                    img.thumbnail((max_w, max_h), Image.LANCZOS)
                    dest = photo_rendition_path(photo_path, rendition)
                    tmp = f"{dest}.{token}.tmp.jpg"
                    temps.append(tmp)
                    img.save(tmp, "JPEG", quality=quality, optimize=True, progressive=True)
                    os.replace(tmp, dest)
            return True
        except Exception as e:
            print(f"Error rendering photo {src}: {e}")
            return False
        finally:
            for tmp in temps:
                if os.path.exists(tmp):
                    os.remove(tmp)


# ------------------------------------------------------------------
# Background cache warmer
# ------------------------------------------------------------------
# Pre-renders every missing video thumbnail and photo rendition so nobody waits on
# the (slow, USB) media drive while browsing. Reads are throttled so the warmer
# never starves video playback, which shares the same drive.
WARM_MAX_MB_PER_SEC = float(os.getenv("WARM_MAX_MB_PER_SEC", "12"))
_warm_wakeup = threading.Event()
_warm_failed = set()  # paths that failed once are not retried until the backend restarts


def _throttle(started: float, bytes_read: int):
    if WARM_MAX_MB_PER_SEC <= 0:
        return
    budget = bytes_read / (WARM_MAX_MB_PER_SEC * 1024 * 1024)
    remaining = budget - (time.time() - started)
    if remaining > 0:
        time.sleep(remaining)


def _warm_cache(library: dict):
    todo_videos = [
        v for v in library["videos"]
        if v["filename"] not in _warm_failed
        and not os.path.exists(os.path.join(THUMBNAIL_DIR, f"{v['id']}_{THUMB_VERSION}.jpg"))
    ]
    todo_photos = [
        p for p in library["photos"]
        if p["filename"] not in _warm_failed
        and any(not os.path.exists(photo_rendition_path(p["filename"], r)) for r in PHOTO_RENDITIONS)
    ]
    if not todo_videos and not todo_photos:
        return

    print(f"Warming cache: {len(todo_videos)} video thumbnails, {len(todo_photos)} photos")
    started_all = time.time()
    for video in todo_videos:
        thumb_path = os.path.join(THUMBNAIL_DIR, f"{video['id']}_{THUMB_VERSION}.jpg")
        if not generate_thumbnail(os.path.join(VIDEO_DIR, video["filename"]), thumb_path):
            _warm_failed.add(video["filename"])
    for photo in todo_photos:
        started = time.time()
        if not render_photo(os.path.join(VIDEO_DIR, photo["filename"]), photo["filename"]):
            _warm_failed.add(photo["filename"])
        _throttle(started, photo["size_bytes"])
    print(f"Cache warm in {time.time() - started_all:.0f}s")


def _warm_loop():
    while True:
        _warm_wakeup.wait()
        _warm_wakeup.clear()
        library = _library_cache["data"]
        if not library:
            continue
        try:
            _warm_cache(library)
        except Exception as e:
            print(f"Cache warming stopped: {e}")


@app.on_event("startup")
def start_background_work():
    threading.Thread(target=_warm_loop, name="cache-warmer", daemon=True).start()
    # Scan right away so the first visitor never waits for the drive (this also wakes the warmer)
    threading.Thread(target=get_library, name="initial-scan", daemon=True).start()


@app.get("/api/photo/{rendition}/{photo_path:path}")
def get_photo(rendition: str, photo_path: str):
    """Serve a cached, resized JPEG of a photo. Originals are served by Nginx via /api/stream/."""
    if rendition not in PHOTO_RENDITIONS:
        raise HTTPException(status_code=404, detail="Unknown rendition")
    if not photo_path.lower().endswith(PHOTO_EXTENSIONS):
        raise HTTPException(status_code=404, detail="Not a photo")
    full_path = safe_join(VIDEO_DIR, photo_path)
    if not os.path.isfile(full_path):
        raise HTTPException(status_code=404, detail="Photo not found")

    dest = photo_rendition_path(photo_path, rendition)
    if os.path.exists(dest) or (render_photo(full_path, photo_path) and os.path.exists(dest)):
        return FileResponse(
            dest,
            media_type="image/jpeg",
            headers={"Cache-Control": "private, max-age=604800"},
        )
    raise HTTPException(status_code=404, detail="Photo could not be rendered")



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

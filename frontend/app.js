/**
 * AETHER STREAM - Ambient Cinema Logic
 */
document.addEventListener('DOMContentLoaded', () => {
  const $ = (id) => document.getElementById(id);
  const root = document.documentElement;

  // Top bar & nav
  const topbar = $('topbar');
  const brandLink = $('brand-link');
  const segNav = $('seg-nav');
  const segIndicator = segNav.querySelector('.seg-indicator');
  const modeButtons = segNav.querySelectorAll('.seg-item[data-mode]');
  const searchInput = $('search-input');
  const clearSearchBtn = $('clear-search-btn');
  const sortSelect = $('sort-select');
  const navRandomBtn = $('nav-random-btn');
  const navLogoutBtn = $('nav-logout-btn');
  const videoCountText = $('video-count-text');

  // Context bar & folders
  const crumbs = $('crumbs');
  const videoFilters = $('video-filters');
  const filterButtons = videoFilters.querySelectorAll('.chip-btn[data-filter]');
  const folderHead = $('folder-head');
  const folderTitle = $('folder-title');
  const folderMeta = $('folder-meta');
  const folderUpBtn = $('folder-up-btn');
  const foldersSection = $('folders-section');
  const foldersCount = $('folders-count');
  const folderGrid = $('folder-grid');

  // Auth Elements
  const authScreen = $('auth-screen');
  const authCard = $('auth-card');
  const mainApp = $('main-app');
  const authForm = $('auth-form');
  const authPassword = $('auth-password');
  const authRemember = $('auth-remember');
  const authError = $('auth-error');
  const authSubmitBtn = $('auth-submit-btn');
  const authSubmitLabel = $('auth-submit-label');

  // Hero Elements
  const heroSection = $('hero-section');
  const heroAmbientLayers = heroSection.querySelectorAll('.ambient-layer');
  const heroStage = $('hero-stage');
  const heroScreen = $('hero-screen');
  const heroFrameLayers = heroScreen.querySelectorAll('.frame-layer');
  const heroCopy = $('hero-copy');
  const heroIndex = $('hero-index');
  const heroTitle = $('hero-title');
  const heroMeta = $('hero-meta');
  const heroProgress = $('hero-progress');
  const heroPlayBtn = $('hero-play-btn');
  const heroPlayLabel = $('hero-play-label');
  const heroNextBtn = $('hero-next-btn');
  const heroScreenPlay = $('hero-screen-play');
  const heroReel = $('hero-reel');

  // Rails & Grid
  const continueSection = $('continue-section');
  const continueRail = $('continue-rail');
  const continueAllBtn = $('continue-all-btn');
  const catalogSection = $('catalog-section');
  const rowTitle = $('row-title');
  const rowCount = $('row-count');
  const skeletonGrid = $('skeleton-grid');
  const videoGrid = $('video-grid');
  const gridSentinel = $('grid-sentinel');
  const emptyState = $('empty-state');
  const emptyDesc = $('empty-desc');
  const emptyIcon = $('empty-icon-svg');

  // Photos
  const photosSection = $('photos-section');
  const photosTitle = $('photos-title');
  const photosCount = $('photos-count');
  const photoGroups = $('photo-groups');

  // Player Elements
  const playerModal = $('player-modal');
  const playerScreen = $('player-screen');
  const mainVideoPlayer = $('main-video-player');
  const modalTitle = $('modal-title');
  const playerPosition = $('player-position');
  const ambilight = $('player-ambilight');
  const modalCloseBtn = $('modal-close-btn');
  const modalShuffleBtn = $('modal-shuffle-btn');
  const modalPrevBtn = $('modal-prev-btn');
  const modalNextBtn = $('modal-next-btn');
  const playerToast = $('player-toast');
  const playerToastText = $('player-toast-text');
  const playerToastAction = $('player-toast-action');
  const upnext = $('upnext');
  const upnextThumb = $('upnext-thumb');
  const upnextTitle = $('upnext-title');
  const upnextCount = $('upnext-count');
  const upnextPlay = $('upnext-play');
  const upnextCancel = $('upnext-cancel');

  // Photo viewer
  const lightbox = $('lightbox');
  const lightboxBackdrop = $('lightbox-backdrop');
  const lightboxStage = $('lightbox-stage');
  const lightboxImg = $('lightbox-img');
  const lightboxPosition = $('lightbox-position');
  const lightboxTitle = $('lightbox-title');
  const lightboxMeta = $('lightbox-meta');
  const lightboxDownload = $('lightbox-download');
  const lightboxClose = $('lightbox-close');
  const lightboxPrev = $('lightbox-prev');
  const lightboxNext = $('lightbox-next');

  // App State
  let allVideos = [];
  let allPhotos = [];
  let foldersByPath = new Map();
  let libraryLoaded = false;
  let mode = 'videos';            // videos, photos
  let currentFolder = '';         // '' is the library root
  let activeFilter = 'all';       // all, continue, large (videos only)
  let currentFilteredVideos = [];
  let currentPhotos = [];
  let renderedCount = 0;
  let currentVideo = null;
  let playQueue = [];
  let featured = [];
  let featuredIndex = 0;

  const BATCH_SIZE = 24;
  const FEATURED_COUNT = 6;
  const LARGE_FILE_BYTES = 500 * 1024 * 1024;
  const NEW_WINDOW_SECONDS = 7 * 24 * 60 * 60;
  const UPNEXT_SECONDS = 8;
  const PROGRESS_KEY = 'aether_progress';
  // Must match THUMB_VERSION in backend/main.py so browsers drop cached old thumbnails
  const THUMB_VERSION = 'v2';

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

  // ==========================================
  // HELPERS
  // ==========================================
  function encodePath(path) {
    return path.split('/').map(encodeURIComponent).join('/');
  }

  function streamUrl(item) {
    return `/api/stream/${encodePath(item.filename)}`;
  }

  function videoThumbUrl(filename) {
    return `/api/thumbnail/${encodePath(filename)}?${THUMB_VERSION}`;
  }

  function thumbUrl(video) {
    return videoThumbUrl(video.filename);
  }

  function photoUrl(filename, rendition) {
    return `/api/photo/${rendition}/${encodePath(filename)}`;
  }

  function formatDate(mtime) {
    if (!mtime) return '';
    return new Date(mtime * 1000).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function formatTime(seconds) {
    const s = Math.max(0, Math.floor(seconds));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = String(s % 60).padStart(2, '0');
    return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
  }

  // Photo dates are naive ISO strings in camera-local time, so parse them as local time
  function formatDay(dayKey) {
    const date = new Date(`${dayKey}T00:00:00`);
    const today = new Date();
    const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString(undefined, {
      weekday: 'short', day: 'numeric', month: 'short',
      year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric'
    });
  }

  function formatTaken(taken) {
    if (!taken) return '';
    return new Date(taken).toLocaleString(undefined, {
      day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit'
    });
  }

  function plural(count, word) {
    return `${count} ${word}${count === 1 ? '' : 's'}`;
  }

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function pickRandom(list = allVideos) {
    return list.length ? list[Math.floor(Math.random() * list.length)] : null;
  }

  function shuffled(list) {
    const copy = [...list];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  // Stable hue (per id or path) for generated fallback artwork
  function hashHue(id) {
    const text = String(id);
    if (/^[0-9a-f]{6}/i.test(text)) return parseInt(text.slice(0, 6), 16) % 360 || 262;
    let hash = 0;
    for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) % 360;
    return hash;
  }

  function initials(title) {
    return title.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  }

  function isNew(video) {
    return video.mtime && (Date.now() / 1000 - video.mtime) < NEW_WINDOW_SECONDS;
  }

  function isInViewport(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.bottom > 0 && rect.top < window.innerHeight;
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ==========================================
  // IMAGE ANALYSIS (fit + dominant colour)
  // ==========================================
  // Frames that are close to 16:9 fill the frame; everything else (portrait,
  // 4:3, ultra-wide) is letterboxed over a blurred copy of itself so nothing
  // important gets cropped away.
  const imageInfo = new Map();
  const sampleCanvas = document.createElement('canvas');
  sampleCanvas.width = sampleCanvas.height = 16;
  const sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });

  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    let h = 0;
    let s = 0;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return { h: Math.round(h), s: s * 100, l: l * 100 };
  }

  function analyzeImage(img, video) {
    const ratio = img.naturalWidth / img.naturalHeight;
    const info = { cover: Math.abs(ratio - 16 / 9) < 0.2, h: hashHue(video.id), s: 60, l: 55 };
    try {
      sampleCtx.drawImage(img, 0, 0, 16, 16);
      const data = sampleCtx.getImageData(0, 0, 16, 16).data;
      let r = 0, g = 0, b = 0, total = 0;
      for (let i = 0; i < data.length; i += 4) {
        const max = Math.max(data[i], data[i + 1], data[i + 2]);
        const min = Math.min(data[i], data[i + 1], data[i + 2]);
        if (max < 24) continue; // ignore near-black letterbox pixels
        const weight = (max - min) / 255 + 0.05; // favour colourful pixels over greys
        r += data[i] * weight;
        g += data[i + 1] * weight;
        b += data[i + 2] * weight;
        total += weight;
      }
      if (total > 0) Object.assign(info, rgbToHsl(r / total, g / total, b / total));
    } catch (err) { /* canvas unavailable */ }
    info.s = clamp(info.s, 40, 85);
    info.l = clamp(info.l, 50, 62);
    imageInfo.set(video.id, info);
    return info;
  }

  function fallbackInfo(video) {
    return { cover: true, h: hashHue(video.id), s: 65, l: 56 };
  }

  function applyColor(el, info) {
    el.style.setProperty('--h', info.h);
    el.style.setProperty('--s', `${info.s}%`);
    el.style.setProperty('--l', `${info.l}%`);
  }

  function setTint(info) {
    root.style.setProperty('--tint-h', info.h);
    root.style.setProperty('--tint-s', `${info.s}%`);
    root.style.setProperty('--tint-l', `${info.l}%`);
  }

  function loadImage(src, timeout = 6000) {
    return new Promise(resolve => {
      const img = new Image();
      img.decoding = 'async';
      const timer = setTimeout(() => resolve(null), timeout);
      img.onload = () => { clearTimeout(timer); resolve(img); };
      img.onerror = () => { clearTimeout(timer); resolve(null); };
      img.src = src;
    });
  }

  // ==========================================
  // WATCH PROGRESS (stored per browser)
  // ==========================================
  function loadProgress() {
    try {
      return JSON.parse(localStorage.getItem(PROGRESS_KEY)) || {};
    } catch (err) {
      return {};
    }
  }

  function saveProgress(video, time, duration) {
    if (!video || !duration || !isFinite(duration)) return;
    const progress = loadProgress();
    if (time < 5 || time > duration - 10) {
      delete progress[video.id];
    } else {
      progress[video.id] = { t: Math.floor(time), d: Math.floor(duration), u: Date.now() };
    }
    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
    } catch (err) { /* storage unavailable */ }
  }

  function continueList(progress = loadProgress()) {
    return allVideos
      .filter(v => progress[v.id])
      .sort((a, b) => progress[b.id].u - progress[a.id].u);
  }

  // ==========================================
  // 1. FETCH & INITIALIZATION
  // ==========================================
  function showApp() {
    authScreen.classList.add('hidden');
    mainApp.classList.remove('hidden');
    requestAnimationFrame(moveIndicator);
  }

  async function fetchLibrary() {
    try {
      const response = await fetch('/api/library');

      if (response.status === 401) {
        showLogin();
        return;
      }

      showApp();

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      const library = await response.json();
      allVideos = library.videos || [];
      allPhotos = library.photos || [];
      foldersByPath = new Map((library.folders || []).map(f => [f.path, f]));
      libraryLoaded = true;
      skeletonGrid.classList.add('hidden');

      videoCountText.textContent = `${plural(allVideos.length, 'video')} · ${plural(allPhotos.length, 'photo')}`;
      buildFeatured();
      route(true);
    } catch (error) {
      console.error('Failed to load library:', error);
      skeletonGrid.classList.add('hidden');
      heroSection.classList.add('hidden');
      showEmptyState('Could not reach the streaming server.');
      videoCountText.textContent = 'Offline';
    }
  }

  // ==========================================
  // 2. ROUTING (#/videos/<folder> or #/photos/<folder>)
  // ==========================================
  function defaultMode() {
    return allVideos.length || !allPhotos.length ? 'videos' : 'photos';
  }

  function parseHash() {
    const match = location.hash.match(/^#\/(videos|photos)(?:\/(.*))?$/);
    if (!match) return { mode: defaultMode(), folder: '' };
    let folder = '';
    try {
      folder = match[2] ? decodeURIComponent(match[2]) : '';
    } catch (err) { /* malformed hash */ }
    return { mode: match[1], folder };
  }

  function navigate(newMode, folder) {
    const hash = `#/${newMode}${folder ? `/${encodeURIComponent(folder)}` : ''}`;
    if (location.hash === hash) route();
    else location.hash = hash; // fires hashchange -> route()
  }

  function route(initial) {
    if (!libraryLoaded) return;
    const parsed = parseHash();
    const folder = parsed.folder && foldersByPath.has(parsed.folder) ? parsed.folder : '';
    const changed = parsed.mode !== mode || folder !== currentFolder;
    mode = parsed.mode;
    currentFolder = folder;
    if (changed) {
      searchInput.value = '';
      activeFilter = 'all';
    }
    withTransition(() => {
      render();
      if (changed) window.scrollTo(0, 0);
    }, initial || !changed);
  }

  window.addEventListener('hashchange', () => route());

  // Cross-fade whole-page view changes (folder or mode switches)
  function withTransition(update, skip) {
    if (skip || !canMorph()) {
      update();
      return;
    }
    document.startViewTransition(update);
  }

  // When switching mode, stay in this folder if it has that media, else climb to an ancestor that does
  function setMode(newMode) {
    let folder = currentFolder;
    while (folder && !((foldersByPath.get(folder) || {})[newMode] > 0)) {
      folder = (foldersByPath.get(folder) || {}).parent || '';
    }
    navigate(newMode, folder);
  }

  // ==========================================
  // 3. RENDER
  // ==========================================
  function childFolders(path) {
    return [...foldersByPath.values()].filter(f => f.parent === path && f[mode] > 0);
  }

  function sortItems(list) {
    const isPhotos = mode === 'photos';
    const date = isPhotos ? (p) => p.taken || '' : (v) => v.mtime || 0;
    const name = isPhotos ? (p) => p.name : (v) => v.title;
    switch (sortSelect.value) {
      case 'oldest': return list.sort((a, b) => (date(a) > date(b) ? 1 : date(a) < date(b) ? -1 : 0));
      case 'name': return list.sort((a, b) => name(a).localeCompare(name(b), undefined, { numeric: true, sensitivity: 'base' }));
      case 'largest': return list.sort((a, b) => (b.size_bytes || 0) - (a.size_bytes || 0));
      default: return list.sort((a, b) => (date(a) < date(b) ? 1 : date(a) > date(b) ? -1 : 0));
    }
  }

  function itemsInView(query) {
    const source = mode === 'videos' ? allVideos : allPhotos;
    if (query) {
      // Search spans the whole library; the path includes folder names too
      return sortItems(source.filter(item =>
        item.filename.toLowerCase().includes(query) || (item.title || '').toLowerCase().includes(query)));
    }
    if (mode === 'videos' && activeFilter === 'continue') return continueList();
    if (mode === 'videos' && activeFilter === 'large') {
      return sortItems(source.filter(v => (v.size_bytes || 0) > LARGE_FILE_BYTES));
    }
    return sortItems(source.filter(item => item.folder === currentFolder));
  }

  function render() {
    if (!libraryLoaded) return;
    const rawQuery = searchInput.value.trim();
    const query = rawQuery.toLowerCase();
    const isVideos = mode === 'videos';
    const filtering = isVideos && activeFilter !== 'all';
    const global = Boolean(query) || filtering;
    const isRoot = currentFolder === '';

    modeButtons.forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
    moveIndicator();
    videoFilters.classList.toggle('hidden', !isVideos);
    filterButtons.forEach(b => b.classList.toggle('active', b.dataset.filter === activeFilter));
    clearSearchBtn.classList.toggle('hidden', !rawQuery);
    searchInput.placeholder = isVideos ? 'Search videos' : 'Search photos';

    renderCrumbs(global, rawQuery);
    renderFolderHead(!isRoot && !global);

    // Hero and the continue rail only on the video home view
    const isHome = isVideos && isRoot && !global;
    heroSection.classList.toggle('hidden', !isHome || featured.length === 0);
    renderContinueRail(isHome);

    const folders = global
      ? (query ? [...foldersByPath.values()].filter(f => f[mode] > 0 && f.name.toLowerCase().includes(query)) : [])
      : childFolders(currentFolder);
    renderFolders(folders);

    const items = itemsInView(query);
    if (isVideos) {
      stopPreview();
      photosSection.classList.add('hidden');
      currentPhotos = [];
      photoGroups.innerHTML = '';
      currentFilteredVideos = items;
      rowTitle.textContent = query ? `Videos matching "${rawQuery}"`
        : activeFilter === 'continue' ? 'Continue watching'
        : activeFilter === 'large' ? 'Large files'
        : 'Videos';
      rowCount.textContent = plural(items.length, 'title');
      catalogSection.classList.toggle('hidden', items.length === 0);
      renderGrid();
    } else {
      catalogSection.classList.add('hidden');
      videoGrid.innerHTML = '';
      currentFilteredVideos = [];
      currentPhotos = items;
      photosTitle.textContent = query ? `Photos matching "${rawQuery}"` : 'Photos';
      photosCount.textContent = plural(items.length, 'photo');
      renderPhotos();
    }

    if (items.length === 0 && folders.length === 0) {
      emptyIcon.innerHTML = `<use href="#${isVideos ? 'i-film' : 'i-image'}"/>`;
      showEmptyState(emptyMessage(rawQuery));
    } else {
      emptyState.classList.add('hidden');
    }
  }

  function emptyMessage(rawQuery) {
    const noun = mode === 'videos' ? 'videos' : 'photos';
    if (rawQuery) return `No ${noun} or folders match "${rawQuery}".`;
    if (mode === 'videos' && activeFilter === 'continue') return 'Nothing in progress yet. Start a video and it will show up here.';
    if (mode === 'videos' && activeFilter === 'large') return 'No videos over 500 MB.';
    if ((mode === 'videos' ? allVideos : allPhotos).length === 0) return `No ${noun} in your library yet. Add some to your media folder and refresh.`;
    return `This folder has no ${noun}.`;
  }

  function showEmptyState(desc) {
    emptyDesc.textContent = desc;
    emptyState.classList.remove('hidden');
  }

  // ==========================================
  // 4. BREADCRUMBS & FOLDERS
  // ==========================================
  function addCrumb(label, path, current, icon) {
    const el = document.createElement(current ? 'span' : 'button');
    el.className = current ? 'crumb current' : 'crumb';
    if (icon) el.innerHTML = `<svg><use href="#${icon}"/></svg>`;
    el.appendChild(document.createTextNode(label));
    if (current) {
      el.setAttribute('aria-current', 'page');
    } else {
      el.addEventListener('click', () => {
        searchInput.value = '';
        activeFilter = 'all';
        navigate(mode, path);
        if (path === currentFolder) render();
      });
    }
    crumbs.appendChild(el);
  }

  function addCrumbSeparator() {
    crumbs.insertAdjacentHTML('beforeend', '<svg class="crumb-sep" aria-hidden="true"><use href="#i-chevron-right"/></svg>');
  }

  function renderCrumbs(global, rawQuery) {
    crumbs.innerHTML = '';
    const parts = currentFolder ? currentFolder.split('/') : [];
    if (global) {
      addCrumb('Library', '', false, 'i-home');
      addCrumbSeparator();
      const label = rawQuery ? `Search "${rawQuery}"`
        : activeFilter === 'continue' ? 'Continue watching' : 'Large files';
      addCrumb(label, '', true);
      return;
    }
    addCrumb('Library', '', parts.length === 0, 'i-home');
    parts.forEach((part, i) => {
      addCrumbSeparator();
      addCrumb(part, parts.slice(0, i + 1).join('/'), i === parts.length - 1);
    });
    crumbs.scrollLeft = crumbs.scrollWidth;
  }

  function folderSummary(folder) {
    const parts = [];
    if (folder.videos) parts.push(plural(folder.videos, 'video'));
    if (folder.photos) parts.push(plural(folder.photos, 'photo'));
    const subfolders = [...foldersByPath.values()].filter(f => f.parent === folder.path).length;
    if (subfolders) parts.push(plural(subfolders, 'folder'));
    return parts.join(' · ');
  }

  function renderFolderHead(show) {
    folderHead.classList.toggle('hidden', !show);
    if (!show) return;
    const folder = foldersByPath.get(currentFolder);
    folderTitle.textContent = folder.name;
    folderMeta.textContent = folderSummary(folder);
  }

  folderUpBtn.addEventListener('click', () => {
    const folder = foldersByPath.get(currentFolder);
    navigate(mode, folder ? folder.parent : '');
  });

  function renderFolders(folders) {
    folderGrid.innerHTML = '';
    foldersSection.classList.toggle('hidden', folders.length === 0);
    foldersCount.textContent = folders.length ? plural(folders.length, 'folder') : '';
    const fragment = document.createDocumentFragment();
    folders.forEach((folder, i) => fragment.appendChild(createFolderCard(folder, i)));
    folderGrid.appendChild(fragment);
  }

  function createFolderCard(folder, index) {
    const isVideos = mode === 'videos';
    const count = folder[mode];
    const covers = isVideos ? folder.cover_videos.slice(0, 1) : folder.cover_photos;

    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'folder-card';
    card.style.setProperty('--delay', `${(index % 6) * 55}ms`);
    card.style.setProperty('--fallback-h', hashHue(folder.path));
    card.setAttribute('aria-label', `Open folder ${folder.name}, ${plural(count, isVideos ? 'video' : 'photo')}`);

    const cover = document.createElement('div');
    cover.className = 'folder-cover';
    const inner = document.createElement('div');
    inner.className = covers.length >= 3 ? 'folder-cover-inner mosaic' : 'folder-cover-inner';
    (covers.length >= 3 ? covers.slice(0, 3) : covers.slice(0, 1)).forEach(filename => {
      const img = document.createElement('img');
      img.alt = '';
      img.loading = 'lazy';
      img.decoding = 'async';
      img.addEventListener('load', () => img.classList.add('loaded'), { once: true });
      img.addEventListener('error', () => img.remove(), { once: true });
      img.src = isVideos ? videoThumbUrl(filename) : photoUrl(filename, 'thumb');
      inner.appendChild(img);
    });
    const icon = document.createElement('div');
    icon.className = 'folder-icon';
    icon.innerHTML = '<svg><use href="#i-folder"/></svg>';
    const badge = document.createElement('span');
    badge.className = 'folder-badge';
    badge.innerHTML = `<svg><use href="#${isVideos ? 'i-video' : 'i-image'}"/></svg>`;
    badge.appendChild(document.createTextNode(count));
    cover.append(inner, icon, badge);

    const name = document.createElement('p');
    name.className = 'folder-name';
    name.textContent = folder.name;
    name.title = folder.path;
    const sub = document.createElement('p');
    sub.className = 'folder-sub';
    sub.textContent = folderSummary(folder);

    card.append(cover, name, sub);
    card.addEventListener('click', () => {
      searchInput.value = '';
      activeFilter = 'all';
      navigate(mode, folder.path);
    });
    revealObserver.observe(card);
    return card;
  }

  // ==========================================
  // 5. HERO STAGE
  // ==========================================
  let heroToken = 0;
  let activeFrame = 0;

  function buildFeatured() {
    featured = shuffled(allVideos).slice(0, Math.min(FEATURED_COUNT, allVideos.length));
    heroReel.innerHTML = '';
    featured.forEach((video, i) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'reel-item';
      item.setAttribute('role', 'tab');
      item.setAttribute('aria-label', `Feature ${video.title}`);
      item.style.backgroundImage = `url("${thumbUrl(video)}")`;
      const bar = document.createElement('span');
      bar.className = 'reel-bar';
      // The progress bar animation doubles as the rotation timer, so pausing it pauses rotation
      bar.addEventListener('animationend', () => {
        if (i === featuredIndex && featured.length > 1) showFeatured((featuredIndex + 1) % featured.length);
      });
      item.appendChild(bar);
      item.addEventListener('click', () => showFeatured(i));
      heroReel.appendChild(item);
    });
    heroReel.classList.toggle('hidden', featured.length < 2);
    heroNextBtn.classList.toggle('hidden', featured.length < 2);
    if (featured.length) showFeatured(0, true);
  }

  function showFeatured(index, immediate) {
    const video = featured[index];
    if (!video) return;
    featuredIndex = index;
    const token = ++heroToken;

    [...heroReel.children].forEach((el, i) => {
      el.classList.toggle('active', i === index);
      el.setAttribute('aria-selected', String(i === index));
    });
    heroIndex.textContent = featured.length > 1 ? `${pad(index + 1)} / ${pad(featured.length)}` : '';

    if (!immediate) heroCopy.classList.add('leaving');
    const minDelay = sleep(immediate ? 0 : 380);

    Promise.all([loadImage(thumbUrl(video)), minDelay]).then(([img]) => {
      if (token !== heroToken) return;
      const info = img ? (imageInfo.get(video.id) || analyzeImage(img, video)) : fallbackInfo(video);
      swapFrame(img ? img.src : null, info, video);
      setTint(info);
      renderHeroCopy(video);
      heroCopy.classList.remove('leaving');
    });
  }

  function swapFrame(src, info, video) {
    activeFrame = 1 - activeFrame;
    const layer = heroFrameLayers[activeFrame];
    const previous = heroFrameLayers[1 - activeFrame];
    const frameImg = layer.querySelector('.frame-img');

    layer.classList.toggle('fit-cover', info.cover);
    layer.classList.toggle('empty', !src);
    layer.style.setProperty('--fallback-h', hashHue(video.id));
    layer.querySelector('.frame-fill').style.backgroundImage = src ? `url("${src}")` : '';
    if (src) frameImg.src = src;
    else frameImg.removeAttribute('src');

    // Restart the ken-burns drift on the incoming frame
    layer.classList.remove('active');
    void layer.offsetWidth;
    layer.classList.add('active');
    previous.classList.remove('active');

    const ambientIn = heroAmbientLayers[activeFrame];
    ambientIn.style.backgroundImage = src ? `url("${src}")` : '';
    ambientIn.classList.add('active');
    heroAmbientLayers[1 - activeFrame].classList.remove('active');
  }

  function renderHeroCopy(video) {
    heroTitle.innerHTML = '';
    video.title.split(/\s+/).filter(Boolean).forEach((word, i) => {
      const outer = document.createElement('span');
      outer.className = 'w';
      const inner = document.createElement('span');
      inner.textContent = word;
      inner.style.setProperty('--d', `${Math.min(i, 14) * 55}ms`);
      outer.appendChild(inner);
      heroTitle.append(outer, ' ');
    });

    const saved = loadProgress()[video.id];
    const chips = [];
    if (isNew(video)) chips.push({ text: 'New', accent: true });
    if (video.folder) chips.push({ text: video.folder.split('/').pop() });
    if (video.mtime) chips.push({ text: String(new Date(video.mtime * 1000).getFullYear()) });
    if (video.formatted_size) chips.push({ text: video.formatted_size });
    if (saved) chips.push({ text: `${formatTime(saved.d - saved.t)} left`, accent: true });

    heroMeta.innerHTML = '';
    chips.forEach((chip, i) => {
      const el = document.createElement('span');
      el.className = chip.accent ? 'chip chip-accent' : 'chip';
      el.textContent = chip.text;
      el.style.setProperty('--d', `${200 + i * 70}ms`);
      heroMeta.appendChild(el);
    });

    heroProgress.classList.toggle('hidden', !saved);
    heroProgress.firstElementChild.style.width = saved ? `${Math.min(100, (saved.t / saved.d) * 100)}%` : '0';
    heroPlayLabel.textContent = saved ? 'Resume' : 'Play';

    const play = () => openPlayer(video, { from: heroScreen, queue: featured });
    heroPlayBtn.onclick = play;
    heroScreenPlay.onclick = play;
  }

  heroNextBtn.addEventListener('click', () => {
    if (featured.length > 1) showFeatured((featuredIndex + 1) % featured.length);
  });

  heroSection.addEventListener('pointerenter', () => heroSection.classList.add('paused'));
  heroSection.addEventListener('pointerleave', () => {
    if (playerModal.classList.contains('hidden')) heroSection.classList.remove('paused');
  });

  // Parallax tilt of the hero screen following the pointer
  heroStage.addEventListener('pointermove', (e) => {
    if (!finePointer.matches || reducedMotion.matches) return;
    const rect = heroStage.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    heroScreen.style.setProperty('--ry', `${-9 + x * 14}deg`);
    heroScreen.style.setProperty('--rx', `${4 - y * 10}deg`);
    heroScreen.style.setProperty('--gx', `${(x + 0.5) * 100}%`);
    heroScreen.style.setProperty('--gy', `${(y + 0.5) * 100}%`);
  });
  heroStage.addEventListener('pointerleave', () => {
    ['--rx', '--ry', '--gx', '--gy'].forEach(p => heroScreen.style.removeProperty(p));
  });

  // ==========================================
  // 6. NAV, FILTERING, SORTING
  // ==========================================
  function moveIndicator() {
    const active = segNav.querySelector('.seg-item.active');
    if (!active || !active.offsetWidth) return;
    segIndicator.style.width = `${active.offsetWidth}px`;
    segIndicator.style.transform = `translateX(${active.offsetLeft}px)`;
  }

  modeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.mode !== mode) setMode(btn.dataset.mode);
    });
  });

  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      activeFilter = btn.dataset.filter;
      searchInput.value = '';
      withTransition(render);
      window.scrollTo({ top: 0, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
    });
  });

  brandLink.addEventListener('click', (e) => {
    e.preventDefault();
    searchInput.value = '';
    activeFilter = 'all';
    navigate('videos', '');
  });

  continueAllBtn.addEventListener('click', () => {
    activeFilter = 'continue';
    withTransition(render);
    window.scrollTo({ top: 0, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
  });

  navRandomBtn.addEventListener('click', () => {
    if (mode === 'photos') {
      const list = currentPhotos.length ? currentPhotos : allPhotos;
      const photo = pickRandom(list);
      if (photo) openLightbox(photo, null, list);
      return;
    }
    const video = pickRandom();
    if (video) openPlayer(video, { queue: allVideos });
  });

  let searchTimer = null;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(render, 140);
  });
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      searchInput.value = '';
      render();
      searchInput.blur();
    }
  });
  sortSelect.addEventListener('change', render);
  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    render();
    searchInput.focus();
  });

  window.addEventListener('scroll', () => {
    topbar.classList.toggle('scrolled', window.scrollY > 8);
  }, { passive: true });

  window.addEventListener('resize', moveIndicator);
  if (document.fonts) document.fonts.ready.then(moveIndicator);

  // ==========================================
  // 7. VIDEO CARDS
  // ==========================================
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { rootMargin: '0px 0px -30px 0px' });

  function setCardProgress(card, video, saved) {
    const media = card.querySelector('.card-media');
    let bar = media.querySelector('.card-progress');
    if (saved && saved.d) {
      if (!bar) {
        bar = document.createElement('div');
        bar.className = 'card-progress';
        bar.appendChild(document.createElement('span'));
        media.appendChild(bar);
      }
      bar.firstElementChild.style.width = `${Math.min(100, (saved.t / saved.d) * 100)}%`;
    } else if (bar) {
      bar.remove();
    }
    const meta = saved
      ? [`${formatTime(saved.d - saved.t)} left`, video.formatted_size]
      : [video.formatted_size, formatDate(video.mtime)];
    card.querySelector('.card-meta').textContent = meta.filter(Boolean).join(' · ');
  }

  function createCard(video, index, progress, queue) {
    const card = document.createElement('article');
    card.className = 'card';
    card.dataset.id = video.id;
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `Play ${video.title}`);
    card.style.setProperty('--delay', `${(index % 6) * 55}ms`);
    card.style.setProperty('--fallback-h', hashHue(video.id));

    const media = document.createElement('div');
    media.className = 'card-media';

    const fallback = document.createElement('div');
    fallback.className = 'card-fallback';
    fallback.innerHTML = '<svg><use href="#i-film"/></svg>';
    const fallbackText = document.createElement('span');
    fallbackText.textContent = initials(video.title);
    fallback.appendChild(fallbackText);

    const fill = document.createElement('div');
    fill.className = 'card-fill';

    const img = document.createElement('img');
    img.className = 'card-img';
    img.alt = '';
    img.loading = 'lazy';
    img.decoding = 'async';

    const shine = document.createElement('div');
    shine.className = 'card-shine';

    const play = document.createElement('div');
    play.className = 'card-play';
    play.innerHTML = '<svg><use href="#i-play"/></svg>';

    media.append(fallback, fill, img, shine, play);

    if (isNew(video)) {
      const badge = document.createElement('span');
      badge.className = 'card-badge';
      badge.textContent = 'NEW';
      media.appendChild(badge);
    }

    const cached = imageInfo.get(video.id);
    if (cached) {
      card.classList.toggle('fit-cover', cached.cover);
      applyColor(card, cached);
    }

    img.addEventListener('load', () => {
      const info = imageInfo.get(video.id) || analyzeImage(img, video);
      card.classList.toggle('fit-cover', info.cover);
      applyColor(card, info);
      fill.style.backgroundImage = `url("${img.src}")`;
      media.classList.add('loaded');
    }, { once: true });
    img.addEventListener('error', () => {
      applyColor(card, fallbackInfo(video));
      media.classList.add('failed');
    }, { once: true });
    img.src = thumbUrl(video);

    const body = document.createElement('div');
    body.className = 'card-info';
    const title = document.createElement('h3');
    title.className = 'card-title';
    title.textContent = video.title;
    title.title = video.title;
    const meta = document.createElement('p');
    meta.className = 'card-meta';
    body.append(title, meta);

    card.append(media, body);
    setCardProgress(card, video, progress[video.id]);

    const open = () => openPlayer(video, { from: media, queue });
    card.addEventListener('click', open);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open();
      }
    });
    attachCardMotion(card, media, video);
    revealObserver.observe(card);
    return card;
  }

  // Tilt, cursor spotlight and hover-to-preview (mouse/trackpad only)
  let previewTimer = null;
  let previewCard = null;

  function attachCardMotion(card, media, video) {
    let frame = 0;
    card.addEventListener('pointermove', (e) => {
      if (!finePointer.matches || reducedMotion.matches) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = media.getBoundingClientRect();
        const x = clamp((e.clientX - rect.left) / rect.width, 0, 1);
        const y = clamp((e.clientY - rect.top) / rect.height, 0, 1);
        card.classList.add('tilting');
        media.style.setProperty('--mx', `${x * 100}%`);
        media.style.setProperty('--my', `${y * 100}%`);
        media.style.setProperty('--ry', `${(x - 0.5) * 10}deg`);
        media.style.setProperty('--rx', `${(0.5 - y) * 8}deg`);
      });
    });
    card.addEventListener('pointerenter', () => {
      if (!finePointer.matches || reducedMotion.matches) return;
      schedulePreview(card, media, video);
    });
    card.addEventListener('pointerleave', () => {
      cancelAnimationFrame(frame);
      card.classList.remove('tilting');
      media.style.removeProperty('--rx');
      media.style.removeProperty('--ry');
      if (previewCard === card) stopPreview();
    });
  }

  function schedulePreview(card, media, video) {
    stopPreview();
    previewCard = card;
    previewTimer = setTimeout(() => {
      const preview = document.createElement('video');
      preview.className = 'card-preview';
      preview.muted = true;
      preview.loop = true;
      preview.playsInline = true;
      preview.preload = 'metadata';
      preview.addEventListener('loadedmetadata', () => {
        if (isFinite(preview.duration) && preview.duration > 20) preview.currentTime = preview.duration * 0.3;
        preview.play().catch(() => {});
      }, { once: true });
      preview.addEventListener('playing', () => {
        preview.classList.add('playing');
        card.classList.add('previewing');
      }, { once: true });
      preview.addEventListener('error', stopPreview, { once: true });
      preview.src = streamUrl(video);
      media.insertBefore(preview, media.querySelector('.card-shine'));
    }, 750);
  }

  function stopPreview() {
    clearTimeout(previewTimer);
    previewTimer = null;
    if (!previewCard) return;
    const preview = previewCard.querySelector('.card-preview');
    if (preview) {
      preview.pause();
      preview.removeAttribute('src');
      preview.load();
      preview.remove();
    }
    previewCard.classList.remove('previewing');
    previewCard = null;
  }

  // ==========================================
  // 8. CONTINUE RAIL & INFINITE GRID
  // ==========================================
  function renderContinueRail(isHome, progress = loadProgress()) {
    const list = continueList(progress);
    const show = isHome && list.length > 0;
    continueSection.classList.toggle('hidden', !show);
    continueRail.innerHTML = '';
    if (!show) return;
    const fragment = document.createDocumentFragment();
    list.slice(0, 12).forEach((video, i) => fragment.appendChild(createCard(video, i, progress, list)));
    continueRail.appendChild(fragment);
  }

  function renderGrid() {
    stopPreview();
    videoGrid.innerHTML = '';
    renderedCount = 0;
    videoGrid.classList.toggle('hidden', currentFilteredVideos.length === 0);
    appendBatch();
  }

  function appendBatch() {
    if (renderedCount >= currentFilteredVideos.length) return;
    const progress = loadProgress();
    const queue = currentFilteredVideos;
    const slice = queue.slice(renderedCount, renderedCount + BATCH_SIZE);
    const fragment = document.createDocumentFragment();
    slice.forEach((video, i) => fragment.appendChild(createCard(video, i, progress, queue)));
    videoGrid.appendChild(fragment);
    renderedCount += slice.length;
    // Keep filling while the sentinel is still near the viewport (tall screens)
    requestAnimationFrame(maybeLoadMore);
  }

  function maybeLoadMore() {
    if (videoGrid.classList.contains('hidden') || catalogSection.classList.contains('hidden')) return;
    if (mainApp.classList.contains('hidden')) return;
    if (gridSentinel.getBoundingClientRect().top < window.innerHeight + 900) appendBatch();
  }

  new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) maybeLoadMore();
  }, { rootMargin: '0px 0px 900px 0px' }).observe(gridSentinel);

  // Refresh progress bars in place so the morph-back target stays in the DOM
  function refreshProgressUI() {
    const progress = loadProgress();
    const byId = new Map(allVideos.map(v => [v.id, v]));
    videoGrid.querySelectorAll('.card').forEach(card => {
      const video = byId.get(card.dataset.id);
      if (video) setCardProgress(card, video, progress[video.id]);
    });
    if (mode !== 'videos') return;
    const isHome = !searchInput.value.trim() && activeFilter === 'all' && currentFolder === '';
    renderContinueRail(isHome, progress);
    if (activeFilter === 'continue' && !searchInput.value.trim()) render();
    const hero = featured[featuredIndex];
    if (hero && !heroSection.classList.contains('hidden')) renderHeroCopy(hero);
  }

  // ==========================================
  // 9. PHOTOS (justified rows grouped by day)
  // ==========================================
  // Each row is scaled so its photos exactly fill the width at their natural
  // aspect ratio; nothing is cropped, like a phone gallery app.
  let photoLayout = [];
  let lastLayoutWidth = 0;

  function photoMetrics() {
    const w = window.innerWidth;
    if (w >= 1400) return { target: 260, gap: 4 };
    if (w >= 1000) return { target: 220, gap: 4 };
    if (w >= 600) return { target: 170, gap: 4 };
    return { target: 118, gap: 2 };
  }

  function photoAspect(photo) {
    return clamp((photo.width || 4) / (photo.height || 3), 0.4, 3.5);
  }

  function groupPhotosByDay(photos) {
    const groups = [];
    let current = null;
    photos.forEach(photo => {
      const key = (photo.taken || '').slice(0, 10);
      if (!current || current.key !== key) {
        current = { key, label: key ? formatDay(key) : 'Unknown date', photos: [] };
        groups.push(current);
      }
      current.photos.push(photo);
    });
    return groups;
  }

  function createPhotoTile(photo) {
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'photo-tile';
    tile.dataset.id = photo.id;
    tile.setAttribute('aria-label', `Open photo ${photo.name}`);
    const img = document.createElement('img');
    img.alt = '';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.addEventListener('load', () => tile.classList.add('loaded'), { once: true });
    img.addEventListener('error', () => tile.classList.add('failed'), { once: true });
    img.src = photoUrl(photo.filename, 'thumb');
    tile.appendChild(img);
    tile.addEventListener('click', () => openLightbox(photo, tile, currentPhotos));
    return tile;
  }

  function renderPhotos() {
    photoGroups.innerHTML = '';
    photoLayout = [];
    photosSection.classList.toggle('hidden', currentPhotos.length === 0);
    if (!currentPhotos.length) return;

    const byDate = sortSelect.value === 'newest' || sortSelect.value === 'oldest';
    const groups = byDate ? groupPhotosByDay(currentPhotos) : [{ label: null, photos: currentPhotos }];

    groups.forEach(group => {
      const section = document.createElement('section');
      section.className = 'photo-group';
      if (group.label) {
        const heading = document.createElement('h3');
        heading.className = 'photo-date';
        heading.textContent = group.label;
        const count = document.createElement('span');
        count.textContent = plural(group.photos.length, 'photo');
        heading.appendChild(count);
        section.appendChild(heading);
      }
      const rows = document.createElement('div');
      rows.className = 'photo-rows';
      section.appendChild(rows);
      photoGroups.appendChild(section);
      photoLayout.push({
        rows,
        tiles: group.photos.map(photo => ({ aspect: photoAspect(photo), el: createPhotoTile(photo) })),
      });
    });
    lastLayoutWidth = 0;
    layoutPhotos();
  }

  function layoutPhotos() {
    const width = photoGroups.clientWidth;
    if (!width || !photoLayout.length) return;
    lastLayoutWidth = width;
    const { target, gap } = photoMetrics();
    photoGroups.style.setProperty('--pgap', `${gap}px`);

    photoLayout.forEach(group => {
      const fragment = document.createDocumentFragment();
      let row = [];
      let aspectSum = 0;

      const flush = (height) => {
        const rowEl = document.createElement('div');
        rowEl.className = 'photo-row';
        rowEl.style.height = `${height}px`;
        row.forEach(tile => {
          tile.el.style.width = `${tile.aspect * height}px`;
          rowEl.appendChild(tile.el);
        });
        fragment.appendChild(rowEl);
        row = [];
        aspectSum = 0;
      };

      group.tiles.forEach(tile => {
        row.push(tile);
        aspectSum += tile.aspect;
        const rowWidth = aspectSum * target + gap * (row.length - 1);
        if (rowWidth >= width) flush((width - gap * (row.length - 1)) / aspectSum);
      });
      // The last, partial row keeps the target height instead of stretching
      if (row.length) flush(target);

      group.rows.replaceChildren(fragment);
    });
  }

  let layoutFrame = 0;
  new ResizeObserver(() => {
    if (Math.abs(photoGroups.clientWidth - lastLayoutWidth) < 1) return;
    cancelAnimationFrame(layoutFrame);
    layoutFrame = requestAnimationFrame(layoutPhotos);
  }).observe(photoGroups);

  // ==========================================
  // 10. PHOTO VIEWER
  // ==========================================
  let lbList = [];
  let lbIndex = -1;
  let lbToken = 0;

  function lightboxOpen() {
    return !lightbox.classList.contains('hidden');
  }

  function sizeLightboxImg(photo) {
    const styles = getComputedStyle(lightboxStage);
    const availW = lightboxStage.clientWidth - parseFloat(styles.paddingLeft) - parseFloat(styles.paddingRight);
    const availH = lightboxStage.clientHeight - parseFloat(styles.paddingTop) - parseFloat(styles.paddingBottom);
    const w = photo.width || 4;
    const h = photo.height || 3;
    // Never upscale past the original's resolution
    const scale = Math.min(availW / w, availH / h, 1);
    lightboxImg.style.width = `${Math.round(w * scale)}px`;
    lightboxImg.style.height = `${Math.round(h * scale)}px`;
  }

  function showLightboxPhoto(direction) {
    const photo = lbList[lbIndex];
    if (!photo) return null;
    const token = ++lbToken;

    setZoom(false);
    lightboxImg.classList.remove('from-left', 'from-right');
    // The grid thumbnail is already cached, so show it instantly and sharpen once the large version arrives
    lightboxImg.src = photoUrl(photo.filename, 'thumb');
    sizeLightboxImg(photo);
    if (direction) {
      void lightboxImg.offsetWidth;
      lightboxImg.classList.add(direction > 0 ? 'from-right' : 'from-left');
    }
    lightboxBackdrop.style.backgroundImage = `url("${photoUrl(photo.filename, 'thumb')}")`;

    lightboxPosition.textContent = lbList.length > 1 ? `${lbIndex + 1} of ${lbList.length}` : '';
    lightboxTitle.textContent = photo.name;
    lightboxTitle.title = photo.filename;
    lightboxMeta.textContent = [
      formatTaken(photo.taken),
      photo.width && photo.height ? `${photo.width} × ${photo.height}` : '',
      photo.formatted_size,
      photo.folder,
    ].filter(Boolean).join(' · ');
    lightboxDownload.href = streamUrl(photo);
    lightboxDownload.setAttribute('download', photo.name);
    lightboxPrev.disabled = lbIndex <= 0;
    lightboxNext.disabled = lbIndex >= lbList.length - 1;

    lightbox.classList.add('loading');
    loadImage(photoUrl(photo.filename, 'view'), 30000).then(img => {
      if (token !== lbToken) return;
      lightbox.classList.remove('loading');
      if (img) lightboxImg.src = img.src;
    });
    // Warm the neighbours so stepping through feels instant
    [lbList[lbIndex + 1], lbList[lbIndex - 1]].forEach(p => {
      if (p) new Image().src = photoUrl(p.filename, 'view');
    });

    return Promise.race([lightboxImg.decode().catch(() => {}), sleep(350)]);
  }

  function openLightbox(photo, tile, list) {
    lbList = list && list.length ? list : allPhotos;
    lbIndex = lbList.findIndex(p => p.id === photo.id);
    if (lbIndex === -1) {
      lbList = allPhotos;
      lbIndex = lbList.findIndex(p => p.id === photo.id);
    }
    const show = () => {
      lightbox.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
      return showLightboxPhoto(0);
    };
    const from = tile && isInViewport(tile) ? tile : null;
    if (!morph(from, lightboxImg, show)) {
      lightbox.classList.add('pop');
      setTimeout(() => lightbox.classList.remove('pop'), 550);
    }
  }

  function closeLightbox(immediate) {
    if (!lightboxOpen()) return;
    lbToken++;
    setZoom(false);
    const photo = lbList[lbIndex];
    const hide = () => {
      lightbox.classList.add('hidden');
      lightbox.classList.remove('loading');
      document.body.style.overflow = '';
      lightboxImg.removeAttribute('src');
    };
    if (immediate) {
      hide();
      return;
    }
    let tile = photo ? photoGroups.querySelector(`.photo-tile[data-id="${photo.id}"]`) : null;
    // The viewer may have stepped far from the opened tile; bring it into view so it can morph back
    if (tile && !isInViewport(tile)) tile.scrollIntoView({ block: 'center' });
    if (!isInViewport(tile)) tile = null;
    morph(lightboxImg, tile, hide);
  }

  function stepPhoto(delta) {
    const next = lbIndex + delta;
    if (next < 0 || next >= lbList.length) return;
    lbIndex = next;
    showLightboxPhoto(delta);
  }

  function setZoom(on, e) {
    lightboxImg.classList.toggle('zoomed', on);
    lightbox.classList.toggle('zoomed-mode', on);
    if (on && e) panZoom(e);
    if (!on) lightboxImg.style.transformOrigin = '';
  }

  function panZoom(e) {
    const rect = lightboxImg.getBoundingClientRect();
    const x = clamp((e.clientX - rect.left) / rect.width, 0, 1) * 100;
    const y = clamp((e.clientY - rect.top) / rect.height, 0, 1) * 100;
    lightboxImg.style.transformOrigin = `${x}% ${y}%`;
  }

  lightboxImg.addEventListener('dblclick', (e) => setZoom(!lightboxImg.classList.contains('zoomed'), e));
  lightboxImg.addEventListener('pointermove', (e) => {
    if (lightboxImg.classList.contains('zoomed') && e.pointerType === 'mouse') panZoom(e);
  });

  // Swipe left/right to step, swipe down to close (touch and pen)
  let swipe = null;
  let swiped = false;
  lightboxStage.addEventListener('pointerdown', (e) => {
    swiped = false;
    swipe = e.pointerType === 'mouse' ? null : { x: e.clientX, y: e.clientY };
  });
  lightboxStage.addEventListener('pointerup', (e) => {
    if (!swipe || lightboxImg.classList.contains('zoomed')) {
      swipe = null;
      return;
    }
    const dx = e.clientX - swipe.x;
    const dy = e.clientY - swipe.y;
    swipe = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      swiped = true;
      stepPhoto(dx < 0 ? 1 : -1);
    } else if (dy > 90 && dy > Math.abs(dx) * 1.4) {
      swiped = true;
      closeLightbox();
    }
  });
  lightboxStage.addEventListener('click', (e) => {
    if (!swiped && e.target === lightboxStage) closeLightbox();
  });

  lightboxClose.addEventListener('click', () => closeLightbox());
  lightboxPrev.addEventListener('click', () => stepPhoto(-1));
  lightboxNext.addEventListener('click', () => stepPhoto(1));
  window.addEventListener('resize', () => {
    if (lightboxOpen() && lbList[lbIndex]) sizeLightboxImg(lbList[lbIndex]);
  });

  // ==========================================
  // 11. CINEMA PLAYER
  // ==========================================
  let lastSavedAt = 0;

  function canMorph() {
    return typeof document.startViewTransition === 'function' && !reducedMotion.matches;
  }

  // Morph one element into another with the View Transitions API
  function morph(fromEl, toEl, update) {
    if (!canMorph() || !fromEl || !toEl) {
      update();
      return null;
    }
    fromEl.style.viewTransitionName = 'player-stage';
    const transition = document.startViewTransition(() => {
      fromEl.style.viewTransitionName = '';
      toEl.style.viewTransitionName = 'player-stage';
      return update();
    });
    transition.finished.finally(() => { toEl.style.viewTransitionName = ''; });
    return transition;
  }

  function findVisibleMedia(video) {
    if (!video) return null;
    const candidates = [...document.querySelectorAll(`.card[data-id="${video.id}"] .card-media`)];
    if (featured[featuredIndex] && featured[featuredIndex].id === video.id && !heroSection.classList.contains('hidden')) {
      candidates.unshift(heroScreen);
    }
    return candidates.find(isInViewport) || null;
  }

  function currentIndex() {
    return currentVideo ? playQueue.findIndex(v => v.id === currentVideo.id) : -1;
  }

  function updateNavButtons() {
    const idx = currentIndex();
    modalPrevBtn.disabled = idx <= 0;
    modalNextBtn.disabled = idx === -1 || idx >= playQueue.length - 1;
    playerPosition.textContent = idx >= 0 && playQueue.length > 1
      ? `Now playing · ${idx + 1} of ${playQueue.length}`
      : 'Now playing';
  }

  function loadIntoPlayer(video) {
    modalTitle.textContent = video.title;
    mainVideoPlayer.poster = thumbUrl(video);
    mainVideoPlayer.src = streamUrl(video);
    ambilightCtx.clearRect(0, 0, ambilight.width, ambilight.height);
    updateNavButtons();
    mainVideoPlayer.play().catch(err => {
      console.log('Autoplay deferred by browser:', err);
    });
  }

  let swapTimer = null;

  function openPlayer(video, opts = {}) {
    const alreadyOpen = !playerModal.classList.contains('hidden');
    persistCurrentProgress();
    hideUpNext();
    hideToast();
    stopPreview();

    playQueue = opts.queue && opts.queue.length ? opts.queue : (currentFilteredVideos.length ? currentFilteredVideos : allVideos);
    currentVideo = video;

    if (alreadyOpen) {
      // In-player navigation: a quick blur-crossfade of the screen
      clearTimeout(swapTimer);
      playerScreen.classList.add('swapping');
      swapTimer = setTimeout(() => {
        loadIntoPlayer(video);
        playerScreen.classList.remove('swapping');
      }, 180);
      return;
    }

    const from = opts.from && isInViewport(opts.from) ? opts.from : null;
    const show = () => {
      playerModal.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
      heroSection.classList.add('paused');
      loadIntoPlayer(video);
    };
    if (!morph(from, playerScreen, show)) {
      playerModal.classList.add('pop');
      setTimeout(() => playerModal.classList.remove('pop'), 650);
    }
  }

  function persistCurrentProgress() {
    if (currentVideo && mainVideoPlayer.getAttribute('src')) {
      saveProgress(currentVideo, mainVideoPlayer.currentTime, mainVideoPlayer.duration);
    }
  }

  function closePlayer(immediate) {
    if (playerModal.classList.contains('hidden')) return;
    persistCurrentProgress();
    hideUpNext();
    hideToast();
    stopAmbilight();
    clearTimeout(swapTimer);
    playerScreen.classList.remove('swapping');

    const hide = () => {
      mainVideoPlayer.pause();
      mainVideoPlayer.removeAttribute('src');
      mainVideoPlayer.removeAttribute('poster');
      mainVideoPlayer.load();
      playerModal.classList.add('hidden');
      document.body.style.overflow = '';
      heroSection.classList.remove('paused');
      currentVideo = null;
    };

    if (immediate) {
      hide();
      return;
    }
    // Refresh cards so progress bars / continue-watching reflect the latest position
    const after = () => { if (allVideos.length) refreshProgressUI(); };
    const transition = morph(playerScreen, findVisibleMedia(currentVideo), hide);
    if (transition) transition.finished.finally(after);
    else after();
  }

  function stepVideo(delta) {
    const target = playQueue[currentIndex() + delta];
    if (target) openPlayer(target, { queue: playQueue });
  }

  // Ambient light: a tiny canvas mirrors the video and is blurred into a glow
  const ambilightCtx = ambilight.getContext('2d');
  let ambilightTimer = null;

  function drawAmbilight() {
    try {
      ambilightCtx.drawImage(mainVideoPlayer, 0, 0, ambilight.width, ambilight.height);
    } catch (err) { /* frame not ready */ }
  }

  function startAmbilight() {
    stopAmbilight();
    drawAmbilight();
    if (!reducedMotion.matches) ambilightTimer = setInterval(drawAmbilight, 220);
  }

  function stopAmbilight() {
    clearInterval(ambilightTimer);
    ambilightTimer = null;
  }

  mainVideoPlayer.addEventListener('playing', startAmbilight);
  mainVideoPlayer.addEventListener('pause', stopAmbilight);
  mainVideoPlayer.addEventListener('seeked', drawAmbilight);
  mainVideoPlayer.addEventListener('loadeddata', drawAmbilight);

  // Toast (resume notice)
  let toastTimer = null;

  function showToast(text, actionLabel, action) {
    playerToastText.textContent = text;
    playerToastAction.textContent = actionLabel;
    playerToastAction.onclick = () => { action(); hideToast(); };
    playerToast.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, 6000);
  }

  function hideToast() {
    clearTimeout(toastTimer);
    playerToast.classList.add('hidden');
  }

  // Up next (auto-advance through the queue)
  let upNextTimer = null;
  let upNextVideo = null;

  function showUpNext(video) {
    upNextVideo = video;
    let remaining = UPNEXT_SECONDS;
    upnextTitle.textContent = video.title;
    upnextThumb.style.backgroundImage = `url("${thumbUrl(video)}")`;
    upnextCount.textContent = remaining;
    upnext.style.setProperty('--upnext-dur', `${UPNEXT_SECONDS}s`);
    upnext.classList.remove('hidden');
    clearInterval(upNextTimer);
    upNextTimer = setInterval(() => {
      remaining -= 1;
      upnextCount.textContent = remaining;
      if (remaining <= 0) playUpNext();
    }, 1000);
  }

  function hideUpNext() {
    clearInterval(upNextTimer);
    upNextTimer = null;
    upNextVideo = null;
    upnext.classList.add('hidden');
  }

  function playUpNext() {
    const video = upNextVideo;
    hideUpNext();
    if (video) openPlayer(video, { queue: playQueue });
  }

  upnextPlay.addEventListener('click', playUpNext);
  upnextCancel.addEventListener('click', hideUpNext);

  // Resume where the viewer left off
  mainVideoPlayer.addEventListener('loadedmetadata', () => {
    if (!currentVideo) return;
    const saved = loadProgress()[currentVideo.id];
    if (saved && saved.t > 5 && saved.t < mainVideoPlayer.duration - 10) {
      mainVideoPlayer.currentTime = saved.t;
      showToast(`Resumed at ${formatTime(saved.t)}`, 'Start over', () => {
        mainVideoPlayer.currentTime = 0;
        mainVideoPlayer.play().catch(() => {});
      });
    }
  });

  mainVideoPlayer.addEventListener('timeupdate', () => {
    const now = Date.now();
    if (now - lastSavedAt > 5000) {
      lastSavedAt = now;
      persistCurrentProgress();
    }
  });
  mainVideoPlayer.addEventListener('pause', persistCurrentProgress);
  mainVideoPlayer.addEventListener('ended', () => {
    if (!currentVideo) return;
    saveProgress(currentVideo, 0, mainVideoPlayer.duration);
    const next = playQueue[currentIndex() + 1];
    if (next) showUpNext(next);
  });
  window.addEventListener('pagehide', persistCurrentProgress);

  modalCloseBtn.addEventListener('click', () => closePlayer());
  modalPrevBtn.addEventListener('click', () => stepVideo(-1));
  modalNextBtn.addEventListener('click', () => stepVideo(1));

  modalShuffleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const video = pickRandom();
    if (video) openPlayer(video, { queue: allVideos });
  });

  playerModal.addEventListener('click', (e) => {
    if (e.target === playerModal) closePlayer();
  });

  mainVideoPlayer.addEventListener('contextmenu', (e) => e.preventDefault());

  document.addEventListener('keydown', (e) => {
    const typing = e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT';

    if (lightboxOpen()) {
      if (e.key === 'Escape') closeLightbox();
      else if (e.key === 'ArrowRight') stepPhoto(1);
      else if (e.key === 'ArrowLeft') stepPhoto(-1);
      return;
    }

    if (playerModal.classList.contains('hidden')) {
      // Library shortcuts: "/" or Ctrl/Cmd+K jumps to search
      if (mainApp.classList.contains('hidden') || typing) return;
      if (e.key === '/' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) {
        e.preventDefault();
        searchInput.focus();
      }
      return;
    }

    // Let the native controls handle keys when a button is focused
    if (e.target.tagName === 'BUTTON' && (e.key === ' ' || e.key === 'Enter')) return;

    if (e.key === 'Escape') {
      closePlayer();
    } else if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      if (mainVideoPlayer.paused) mainVideoPlayer.play();
      else mainVideoPlayer.pause();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      mainVideoPlayer.currentTime += 5;
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      mainVideoPlayer.currentTime -= 5;
    } else if (e.key === 'f' || e.key === 'F') {
      e.preventDefault();
      if (document.fullscreenElement) document.exitFullscreen();
      else mainVideoPlayer.requestFullscreen();
    } else if (e.key === 'm' || e.key === 'M') {
      e.preventDefault();
      mainVideoPlayer.muted = !mainVideoPlayer.muted;
    } else if (e.key === 'n' || e.key === 'N') {
      stepVideo(1);
    } else if (e.key === 'p' || e.key === 'P') {
      stepVideo(-1);
    }
  });

  // ==========================================
  // AUTHENTICATION LOGIC
  // ==========================================
  const DEFAULT_AUTH_ERROR = 'Incorrect passkey. Please try again.';

  function shakeAuthCard() {
    authCard.classList.remove('shake');
    void authCard.offsetWidth;
    authCard.classList.add('shake');
  }

  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    authError.classList.add('hidden');
    authSubmitBtn.disabled = true;
    authSubmitLabel.textContent = 'Unlocking…';

    const password = authPassword.value;
    const remember = authRemember ? authRemember.checked : false;

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, remember })
      });

      if (res.ok) {
        authPassword.value = '';
        authError.textContent = DEFAULT_AUTH_ERROR;
        showApp();
        skeletonGrid.classList.remove('hidden');
        catalogSection.classList.remove('hidden');
        fetchLibrary();
      } else {
        authError.textContent = res.status === 429
          ? 'Too many attempts. Please wait a few minutes and try again.'
          : DEFAULT_AUTH_ERROR;
        authError.classList.remove('hidden');
        shakeAuthCard();
      }
    } catch (err) {
      authError.textContent = 'Server unreachable.';
      authError.classList.remove('hidden');
      shakeAuthCard();
    } finally {
      authSubmitBtn.disabled = false;
      authSubmitLabel.textContent = 'Unlock';
    }
  });

  // ==========================================
  // SESSION HANDLING (logout + expiry detection)
  // ==========================================
  function showLogin() {
    heroToken++;
    closePlayer(true);
    closeLightbox(true);
    stopPreview();
    libraryLoaded = false;
    allVideos = [];
    allPhotos = [];
    foldersByPath = new Map();
    currentFilteredVideos = [];
    currentPhotos = [];
    featured = [];
    videoGrid.innerHTML = '';
    continueRail.innerHTML = '';
    heroReel.innerHTML = '';
    folderGrid.innerHTML = '';
    photoGroups.innerHTML = '';
    photoLayout = [];
    skeletonGrid.classList.add('hidden');
    [heroSection, continueSection, foldersSection, photosSection, folderHead, emptyState].forEach(el => el.classList.add('hidden'));
    mainApp.classList.add('hidden');
    authScreen.classList.remove('hidden');
    authPassword.focus();
  }

  async function logout() {
    try {
      await fetch('/api/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout request failed:', err);
    }
    showLogin();
  }

  navLogoutBtn.addEventListener('click', logout);

  async function checkSession() {
    if (mainApp.classList.contains('hidden')) return;
    try {
      const res = await fetch('/api/session');
      if (res.status === 401) showLogin();
    } catch (err) {
      // Network blips shouldn't log the user out
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) checkSession();
  });
  setInterval(checkSession, 60 * 1000);

  // Run initial fetch
  fetchLibrary();
});

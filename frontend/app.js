/**
 * AETHER STREAM - Modern Cinema Experience Logic (Optimized for High-Speed Streaming)
 */
document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const searchInput = document.getElementById('search-input');
  const clearSearchBtn = document.getElementById('clear-search-btn');
  const videoCountText = document.getElementById('video-count-text');
  
  // Hero Elements
  const heroSection = document.getElementById('hero-section');
  const heroTitle = document.getElementById('hero-title');
  const heroBackdrop = document.getElementById('hero-backdrop');
  const heroSizeBadge = document.getElementById('hero-size-badge');
  const heroPlayBtn = document.getElementById('hero-play-btn');
  
  // Grid & States
  const skeletonGrid = document.getElementById('skeleton-grid');
  const videoGrid = document.getElementById('video-grid');
  const emptyState = document.getElementById('empty-state');
  const emptyTitle = document.getElementById('empty-title');
  const emptyDesc = document.getElementById('empty-desc');
  const filterPills = document.getElementById('filter-pills');

  // Modal Player Elements
  const playerModal = document.getElementById('player-modal');
  const mainVideoPlayer = document.getElementById('main-video-player');
  const modalVideoTitle = document.getElementById('modal-video-title');
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const upNextList = document.getElementById('up-next-list');
  const upNextCount = document.getElementById('up-next-count');

  // App State
  let allVideos = [];
  let currentFilteredVideos = [];
  let activeFilter = 'all';
  let currentVideo = null;

  // ==========================================
  // 1. FETCH & INITIALIZATION
  // ==========================================
  async function fetchVideos() {
    try {
      const response = await fetch('/api/videos');
      if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
      allVideos = await response.json();

      skeletonGrid.classList.add('hidden');
      
      if (!allVideos || allVideos.length === 0) {
        showEmptyState('No Videos Found', 'Please add .mp4 video files into your server directory.');
        videoCountText.textContent = '0 Videos';
        return;
      }

      videoCountText.textContent = `${allVideos.length} ${allVideos.length === 1 ? 'Video' : 'Videos'}`;
      
      // Setup Featured Spotlight Video (First Video)
      setupHeroSpotlight(allVideos[0]);

      // Apply initial filter & render grid
      applyFilters();
    } catch (error) {
      console.error('Failed to load videos:', error);
      skeletonGrid.classList.add('hidden');
      showEmptyState('Connection Failed', 'Could not reach streaming backend server.');
      videoCountText.textContent = 'Offline';
    }
  }

  // ==========================================
  // 2. HERO SPOTLIGHT BANNER
  // ==========================================
  function setupHeroSpotlight(video) {
    if (!video) return;
    heroTitle.textContent = video.title;
    heroSizeBadge.textContent = video.formatted_size || 'HD';
    
    if (video.thumbnail_url) {
      heroBackdrop.style.backgroundImage = `url('${video.thumbnail_url}')`;
    } else {
      heroBackdrop.style.background = 'linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%)';
    }

    heroPlayBtn.onclick = () => openPlayer(video);
    heroSection.classList.remove('hidden');
  }

  // ==========================================
  // 3. FILTERING & SEARCH LOGIC
  // ==========================================
  function applyFilters() {
    let result = [...allVideos];
    const query = searchInput.value.trim().toLowerCase();

    // 1. Search Query Filter
    if (query) {
      result = result.filter(v => v.title.toLowerCase().includes(query));
      clearSearchBtn.classList.remove('hidden');
    } else {
      clearSearchBtn.classList.add('hidden');
    }

    // 2. Category Pill Filter
    if (activeFilter === 'recent') {
      result = [...result].reverse();
    } else if (activeFilter === 'large') {
      // Filter videos > 500MB (524,288,000 bytes)
      result = result.filter(v => (v.size_bytes || 0) > 500 * 1024 * 1024);
    }

    currentFilteredVideos = result;
    renderGrid(currentFilteredVideos);
  }

  // Filter Pills Event Listeners
  if (filterPills) {
    filterPills.querySelectorAll('.pill-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        filterPills.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeFilter = btn.dataset.filter;
        applyFilters();
      });
    });
  }

  // Search Input Listener
  searchInput.addEventListener('input', applyFilters);
  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    applyFilters();
    searchInput.focus();
  });

  // Keyboard shortcut '/'
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== searchInput) {
      e.preventDefault();
      searchInput.focus();
    }
  });

  // ==========================================
  // 4. RENDER RESPONSIVE VIDEO GRID
  // ==========================================
  function renderGrid(videos) {
    videoGrid.innerHTML = '';
    
    if (videos.length === 0) {
      videoGrid.classList.add('hidden');
      showEmptyState('No Matching Videos', 'Try searching for another keyword or change your filter.');
      return;
    }

    emptyState.classList.add('hidden');
    videoGrid.classList.remove('hidden');

    videos.forEach(video => {
      const card = document.createElement('article');
      card.className = 'video-card';

      card.innerHTML = `
        <div class="card-thumb-wrapper">
          <img class="card-thumb-img" src="${video.thumbnail_url}" alt="${video.title}" loading="lazy"
               onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
          <div class="thumb-fallback" style="display:none;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
          </div>
          <div class="play-overlay-glow">
            <div class="play-circle-btn">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
            </div>
          </div>
          <span class="card-size-badge">${video.formatted_size || 'MP4'}</span>
        </div>
        <div class="card-body-content">
          <h3 class="card-title-text" title="${video.title}">${video.title}</h3>
          <div class="card-footer-meta">
            <span>Local Stream</span>
            <span>HD</span>
          </div>
        </div>
      `;

      card.addEventListener('click', () => openPlayer(video));
      videoGrid.appendChild(card);
    });
  }

  function showEmptyState(title, desc) {
    emptyTitle.textContent = title;
    emptyDesc.textContent = desc;
    emptyState.classList.remove('hidden');
  }

  // ==========================================
  // 5. CINEMA MODAL PLAYER & PLAYLIST (HIGH PERFORMANCE)
  // ==========================================
  function openPlayer(video) {
    currentVideo = video;
    modalVideoTitle.textContent = video.title;
    
    // 1. Instantly set stream URL and play video FIRST (Highest Priority for Instant Start)
    mainVideoPlayer.src = video.stream_url;
    playerModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    // Trigger video playback immediately
    mainVideoPlayer.play().catch(err => {
      console.log('Autoplay deferred by browser:', err);
    });

    // 2. Defer rendering the playlist sidebar by 300ms so network sockets prioritize video stream chunks
    setTimeout(() => {
      renderUpNextList(allVideos, video.id);
    }, 300);
  }

  function closePlayer() {
    mainVideoPlayer.pause();
    mainVideoPlayer.removeAttribute('src');
    mainVideoPlayer.load();
    playerModal.classList.add('hidden');
    document.body.style.overflow = '';
  }

  function renderUpNextList(videos, currentId) {
    upNextList.innerHTML = '';
    const otherVideos = videos.filter(v => v.id !== currentId);
    upNextCount.textContent = `${otherVideos.length} Videos`;

    videos.forEach(video => {
      const isPlaying = video.id === currentId;
      const item = document.createElement('div');
      item.className = `playlist-item ${isPlaying ? 'active-playing' : ''}`;

      item.innerHTML = `
        <img src="${video.thumbnail_url}" alt="${video.title}" loading="lazy"
             onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'100%\\' height=\\'100%\\' fill=\\'%230f172a\\'></svg>';"/>
        <div class="playlist-item-info">
          <h5 class="playlist-item-title">${video.title}</h5>
          <span class="playlist-item-size">${isPlaying ? '▶ Now Playing' : (video.formatted_size || 'MP4')}</span>
        </div>
      `;

      if (!isPlaying) {
        item.addEventListener('click', () => openPlayer(video));
      }

      upNextList.appendChild(item);
    });
  }

  // Event Listeners for Modal Close & Protection
  modalCloseBtn.addEventListener('click', closePlayer);
  playerModal.addEventListener('click', (e) => {
    if (e.target === playerModal) closePlayer();
  });

  // Prevent right-click context menu on video player ("Save Video As...")
  mainVideoPlayer.addEventListener('contextmenu', (e) => {
    e.preventDefault();
  });

  // Global Player Keyboard Shortcuts
  document.addEventListener('keydown', (e) => {
    if (playerModal.classList.contains('hidden')) return;

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
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        mainVideoPlayer.requestFullscreen();
      }
    } else if (e.key === 'm' || e.key === 'M') {
      e.preventDefault();
      mainVideoPlayer.muted = !mainVideoPlayer.muted;
    }
  });

  // Run initial fetch
  fetchVideos();
});

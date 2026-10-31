/**
 * AETHER STREAM - Cinematic Experience Logic
 */
document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const searchInput = document.getElementById('search-input');
  const clearSearchBtn = document.getElementById('clear-search-btn');
  const sortSelect = document.getElementById('sort-select');
  const navRandomBtn = document.getElementById('nav-random-btn');
  const navLogoutBtn = document.getElementById('nav-logout-btn');
  const videoCountText = document.getElementById('video-count-text');

  // Auth Elements
  const authScreen = document.getElementById('auth-screen');
  const mainApp = document.getElementById('main-app');
  const authForm = document.getElementById('auth-form');
  const authPassword = document.getElementById('auth-password');
  const authRemember = document.getElementById('auth-remember');
  const authError = document.getElementById('auth-error');
  const authSubmitBtn = document.getElementById('auth-submit-btn');

  // Hero Elements
  const heroSection = document.getElementById('hero-section');
  const heroBackdrop = document.getElementById('hero-backdrop');
  const heroTitle = document.getElementById('hero-title');
  const heroSizeBadge = document.getElementById('hero-size-badge');
  const heroYearBadge = document.getElementById('hero-year-badge');
  const heroPlayBtn = document.getElementById('hero-play-btn');

  // Grid & Pagination Elements
  const rowTitle = document.getElementById('row-title');
  const rowCount = document.getElementById('row-count');
  const skeletonGrid = document.getElementById('skeleton-grid');
  const videoGrid = document.getElementById('video-grid');
  const emptyState = document.getElementById('empty-state');
  const emptyDesc = document.getElementById('empty-desc');

  const paginationWrapper = document.getElementById('pagination-wrapper');
  const prevPageBtn = document.getElementById('prev-page-btn');
  const nextPageBtn = document.getElementById('next-page-btn');
  const pageNumbers = document.getElementById('page-numbers');

  // Modal Player Elements
  const playerModal = document.getElementById('player-modal');
  const mainVideoPlayer = document.getElementById('main-video-player');
  const modalTitle = document.getElementById('modal-title');
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const modalShuffleBtn = document.getElementById('modal-shuffle-btn');
  const modalPrevBtn = document.getElementById('modal-prev-btn');
  const modalNextBtn = document.getElementById('modal-next-btn');

  // Sidebar filter buttons
  const filterButtons = document.querySelectorAll('.sidebar-nav .nav-item[data-filter]');

  // App State
  let allVideos = [];
  let currentFilteredVideos = [];
  let activeFilter = 'all'; // all, continue, large
  let currentPage = 1;
  let currentVideo = null;
  let heroInterval = null;
  const itemsPerPage = 12;
  const LARGE_FILE_BYTES = 500 * 1024 * 1024;
  const PROGRESS_KEY = 'aether_progress';

  // ==========================================
  // HELPERS
  // ==========================================
  function encodePath(path) {
    return path.split('/').map(encodeURIComponent).join('/');
  }

  function streamUrl(video) {
    return `/api/stream/${encodePath(video.filename)}`;
  }

  function thumbUrl(video) {
    return `/api/thumbnail/${encodePath(video.filename)}`;
  }

  function formatDate(mtime) {
    if (!mtime) return '';
    return new Date(mtime * 1000).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function pickRandom() {
    return allVideos.length ? allVideos[Math.floor(Math.random() * allVideos.length)] : null;
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

  // ==========================================
  // 1. FETCH & INITIALIZATION
  // ==========================================
  async function fetchVideos() {
    try {
      const response = await fetch('/api/videos');

      if (response.status === 401) {
        showLogin();
        return;
      }

      authScreen.classList.add('hidden');
      mainApp.classList.remove('hidden');

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      allVideos = await response.json();
      skeletonGrid.classList.add('hidden');

      if (!allVideos || allVideos.length === 0) {
        heroSection.classList.add('hidden');
        rowCount.textContent = '';
        showEmptyState('Add video files to your server folder and refresh.');
        videoCountText.textContent = '0 Videos';
        return;
      }

      videoCountText.textContent = `${allVideos.length} ${allVideos.length === 1 ? 'Video' : 'Videos'}`;
      startHeroRotation();
      applyFilters();
    } catch (error) {
      console.error('Failed to load videos:', error);
      skeletonGrid.classList.add('hidden');
      heroSection.classList.add('hidden');
      showEmptyState('Could not reach the streaming server.');
      videoCountText.textContent = 'Offline';
    }
  }

  // ==========================================
  // 2. HERO SPOTLIGHT BANNER
  // ==========================================
  function setupHeroSpotlight(video, animate) {
    if (!video) return;

    const apply = () => {
      heroTitle.textContent = video.title;
      heroSizeBadge.textContent = video.formatted_size || '';
      heroYearBadge.textContent = video.mtime ? new Date(video.mtime * 1000).getFullYear() : '';
      heroBackdrop.style.backgroundImage = `url("${thumbUrl(video)}")`;
      heroPlayBtn.onclick = () => openPlayer(video);
      heroBackdrop.classList.remove('swap');
    };

    if (animate) {
      heroBackdrop.classList.add('swap');
      setTimeout(apply, 600);
    } else {
      apply();
    }
  }

  function startHeroRotation() {
    if (allVideos.length === 0) return;
    setupHeroSpotlight(pickRandom(), false);

    if (heroInterval) clearInterval(heroInterval);
    heroInterval = setInterval(() => {
      if (document.hidden || !playerModal.classList.contains('hidden')) return;
      setupHeroSpotlight(pickRandom(), true);
    }, 20000);
  }

  // ==========================================
  // 3. NAV, FILTERING, SORTING
  // ==========================================
  function applyFilters() {
    let result = [...allVideos];
    const query = searchInput.value.trim().toLowerCase();
    const progress = loadProgress();

    if (query) {
      result = result.filter(v => (v.filename || '').toLowerCase().includes(query) || (v.title || '').toLowerCase().includes(query));
      clearSearchBtn.classList.remove('hidden');
      rowTitle.textContent = `Results for "${searchInput.value.trim()}"`;
    } else {
      clearSearchBtn.classList.add('hidden');

      if (activeFilter === 'continue') {
        result = result.filter(v => progress[v.id]);
        result.sort((a, b) => progress[b.id].u - progress[a.id].u);
        rowTitle.textContent = 'Continue watching';
      } else if (activeFilter === 'large') {
        result = result.filter(v => (v.size_bytes || 0) > LARGE_FILE_BYTES);
        rowTitle.textContent = 'Large files';
      } else {
        rowTitle.textContent = 'All videos';
      }
    }

    // Sorting (Continue watching keeps its most-recently-watched order)
    if (!(activeFilter === 'continue' && !query)) {
      switch (sortSelect.value) {
        case 'oldest': result.sort((a, b) => (a.mtime || 0) - (b.mtime || 0)); break;
        case 'name': result.sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' })); break;
        case 'largest': result.sort((a, b) => (b.size_bytes || 0) - (a.size_bytes || 0)); break;
        default: result.sort((a, b) => (b.mtime || 0) - (a.mtime || 0));
      }
    }

    // Hero only on the unfiltered home view
    const showHero = !query && activeFilter === 'all';
    heroSection.classList.toggle('hidden', !showHero);

    currentFilteredVideos = result;
    rowCount.textContent = `${result.length} ${result.length === 1 ? 'title' : 'titles'}`;
    currentPage = 1;
    renderGridPage();
  }

  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      filterButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.filter;
      searchInput.value = '';
      applyFilters();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  if (navRandomBtn) {
    navRandomBtn.addEventListener('click', () => {
      const video = pickRandom();
      if (video) openPlayer(video);
    });
  }

  searchInput.addEventListener('input', applyFilters);
  sortSelect.addEventListener('change', applyFilters);
  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    applyFilters();
    searchInput.focus();
  });

  // ==========================================
  // 4. RENDER PAGINATED GRID
  // ==========================================
  const PLAY_ICON = '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>';
  const FILM_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="18" rx="2"></rect><line x1="7" y1="3" x2="7" y2="21"></line><line x1="17" y1="3" x2="17" y2="21"></line><line x1="2" y1="12" x2="22" y2="12"></line></svg>';

  function createCard(video, index, progress) {
    const card = document.createElement('article');
    card.className = 'video-card';
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `Play ${video.title}`);
    card.style.setProperty('--i', index);

    const thumb = document.createElement('div');
    thumb.className = 'card-thumb';

    const img = document.createElement('img');
    img.className = 'card-thumb-img';
    img.alt = '';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.addEventListener('load', () => thumb.classList.add('loaded'));
    img.addEventListener('error', () => thumb.classList.add('failed'));
    img.src = thumbUrl(video);
    thumb.appendChild(img);

    const fallback = document.createElement('div');
    fallback.className = 'card-fallback';
    fallback.innerHTML = FILM_ICON;
    thumb.appendChild(fallback);

    const play = document.createElement('div');
    play.className = 'card-play';
    play.innerHTML = `<div class="play-circle-small">${PLAY_ICON}</div>`;
    thumb.appendChild(play);

    const saved = progress[video.id];
    if (saved && saved.d) {
      const bar = document.createElement('div');
      bar.className = 'card-progress';
      const fill = document.createElement('div');
      fill.className = 'card-progress-bar';
      fill.style.width = `${Math.min(100, (saved.t / saved.d) * 100)}%`;
      bar.appendChild(fill);
      thumb.appendChild(bar);
    }

    const body = document.createElement('div');
    body.className = 'card-body';
    const title = document.createElement('h3');
    title.className = 'card-title';
    title.textContent = video.title;
    title.title = video.title;
    const sub = document.createElement('p');
    sub.className = 'card-sub';
    sub.textContent = [video.formatted_size, formatDate(video.mtime)].filter(Boolean).join(' • ');
    body.append(title, sub);

    card.append(thumb, body);
    card.addEventListener('click', () => openPlayer(video));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openPlayer(video);
      }
    });
    return card;
  }

  function renderGridPage() {
    videoGrid.innerHTML = '';

    if (currentFilteredVideos.length === 0) {
      videoGrid.classList.add('hidden');
      paginationWrapper.classList.add('hidden');
      showEmptyState(activeFilter === 'continue' && !searchInput.value.trim()
        ? 'Nothing in progress yet. Start a video and it will show up here.'
        : 'No titles found for your selection.');
      return;
    }

    emptyState.classList.add('hidden');
    videoGrid.classList.remove('hidden');

    const startIndex = (currentPage - 1) * itemsPerPage;
    const pageVideos = currentFilteredVideos.slice(startIndex, startIndex + itemsPerPage);
    const progress = loadProgress();

    const fragment = document.createDocumentFragment();
    pageVideos.forEach((video, i) => fragment.appendChild(createCard(video, i, progress)));
    videoGrid.appendChild(fragment);

    renderPaginationControls();
  }

  // Smart Pagination with Ellipsis
  function renderPaginationControls() {
    const totalPages = Math.ceil(currentFilteredVideos.length / itemsPerPage);

    if (totalPages <= 1) {
      paginationWrapper.classList.add('hidden');
      return;
    }

    paginationWrapper.classList.remove('hidden');
    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage === totalPages;

    pageNumbers.innerHTML = '';

    const maxVisibleBtns = 5;
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + maxVisibleBtns - 1);

    if (endPage - startPage < maxVisibleBtns - 1) {
      startPage = Math.max(1, endPage - maxVisibleBtns + 1);
    }

    const addEllipsis = () => {
      const ell = document.createElement('span');
      ell.className = 'page-ellipsis';
      ell.textContent = '…';
      pageNumbers.appendChild(ell);
    };

    if (startPage > 1) {
      pageNumbers.appendChild(createPageBtn(1));
      if (startPage > 2) addEllipsis();
    }

    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.appendChild(createPageBtn(i));
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) addEllipsis();
      pageNumbers.appendChild(createPageBtn(totalPages));
    }
  }

  function goToPage(page) {
    currentPage = page;
    renderGridPage();
    window.scrollTo({ top: document.getElementById('catalog-section').offsetTop - 80, behavior: 'smooth' });
  }

  function createPageBtn(pageNum) {
    const btn = document.createElement('button');
    btn.className = `page-num-btn ${pageNum === currentPage ? 'active' : ''}`;
    btn.textContent = pageNum;
    btn.setAttribute('aria-label', `Page ${pageNum}`);
    if (pageNum === currentPage) btn.setAttribute('aria-current', 'page');
    btn.addEventListener('click', () => goToPage(pageNum));
    return btn;
  }

  prevPageBtn.addEventListener('click', () => {
    if (currentPage > 1) goToPage(currentPage - 1);
  });

  nextPageBtn.addEventListener('click', () => {
    const totalPages = Math.ceil(currentFilteredVideos.length / itemsPerPage);
    if (currentPage < totalPages) goToPage(currentPage + 1);
  });

  function showEmptyState(desc) {
    emptyDesc.textContent = desc;
    emptyState.classList.remove('hidden');
  }

  // ==========================================
  // 5. CINEMA MODAL PLAYER
  // ==========================================
  let lastSavedAt = 0;

  function currentIndex() {
    return currentVideo ? currentFilteredVideos.findIndex(v => v.id === currentVideo.id) : -1;
  }

  function updateNavButtons() {
    const idx = currentIndex();
    modalPrevBtn.disabled = idx <= 0;
    modalNextBtn.disabled = idx === -1 || idx >= currentFilteredVideos.length - 1;
  }

  function openPlayer(video) {
    persistCurrentProgress();
    currentVideo = video;
    modalTitle.textContent = video.title;
    mainVideoPlayer.src = streamUrl(video);
    playerModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    updateNavButtons();

    mainVideoPlayer.play().catch(err => {
      console.log('Autoplay deferred by browser:', err);
    });
  }

  function persistCurrentProgress() {
    if (currentVideo && mainVideoPlayer.getAttribute('src')) {
      saveProgress(currentVideo, mainVideoPlayer.currentTime, mainVideoPlayer.duration);
    }
  }

  function closePlayer() {
    if (playerModal.classList.contains('hidden')) return;
    persistCurrentProgress();
    mainVideoPlayer.pause();
    mainVideoPlayer.removeAttribute('src');
    mainVideoPlayer.load();
    playerModal.classList.add('hidden');
    document.body.style.overflow = '';
    currentVideo = null;
    // Refresh cards so progress bars / continue-watching reflect the latest position
    if (allVideos.length) renderGridPage();
  }

  function stepVideo(delta) {
    const target = currentFilteredVideos[currentIndex() + delta];
    if (target) openPlayer(target);
  }

  // Resume where the viewer left off
  mainVideoPlayer.addEventListener('loadedmetadata', () => {
    if (!currentVideo) return;
    const saved = loadProgress()[currentVideo.id];
    if (saved && saved.t > 5 && saved.t < mainVideoPlayer.duration - 10) {
      mainVideoPlayer.currentTime = saved.t;
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
    if (currentVideo) saveProgress(currentVideo, 0, mainVideoPlayer.duration);
  });
  window.addEventListener('pagehide', persistCurrentProgress);

  modalCloseBtn.addEventListener('click', closePlayer);
  modalPrevBtn.addEventListener('click', () => stepVideo(-1));
  modalNextBtn.addEventListener('click', () => stepVideo(1));

  modalShuffleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const video = pickRandom();
    if (video) openPlayer(video);
  });

  playerModal.addEventListener('click', (e) => {
    if (e.target === playerModal) closePlayer();
  });

  mainVideoPlayer.addEventListener('contextmenu', (e) => e.preventDefault());

  document.addEventListener('keydown', (e) => {
    if (playerModal.classList.contains('hidden')) return;
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

  if (authForm) {
    authForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      authError.classList.add('hidden');
      authSubmitBtn.disabled = true;
      authSubmitBtn.textContent = 'Unlocking...';

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
          authScreen.classList.add('hidden');
          mainApp.classList.remove('hidden');
          skeletonGrid.classList.remove('hidden');
          fetchVideos();
        } else {
          authError.textContent = res.status === 429
            ? 'Too many attempts. Please wait a few minutes and try again.'
            : DEFAULT_AUTH_ERROR;
          authError.classList.remove('hidden');
        }
      } catch (err) {
        authError.textContent = 'Server unreachable.';
        authError.classList.remove('hidden');
      } finally {
        authSubmitBtn.disabled = false;
        authSubmitBtn.textContent = 'Unlock';
      }
    });
  }

  // ==========================================
  // SESSION HANDLING (logout + expiry detection)
  // ==========================================
  function showLogin() {
    if (heroInterval) clearInterval(heroInterval);
    heroInterval = null;
    closePlayer();
    allVideos = [];
    currentFilteredVideos = [];
    videoGrid.innerHTML = '';
    skeletonGrid.classList.add('hidden');
    heroSection.classList.add('hidden');
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

  if (navLogoutBtn) navLogoutBtn.addEventListener('click', logout);

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
  fetchVideos();
});

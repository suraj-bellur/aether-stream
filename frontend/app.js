/**
 * AETHER STREAM - Cinematic Experience Logic
 */
document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const searchInput = document.getElementById('search-input');
  const searchContainer = document.getElementById('search-container');
  const clearSearchBtn = document.getElementById('clear-search-btn');
  const navSearchBtn = document.getElementById('nav-search-btn');
  const navRandomBtn = document.getElementById('nav-random-btn');
  const videoCountText = document.getElementById('video-count-text');
  
  // Hero Elements
  const heroSection = document.getElementById('hero-section');
  const heroBackdrop = document.getElementById('hero-backdrop');
  const heroSizeBadge = document.getElementById('hero-size-badge');
  const heroYearBadge = document.getElementById('hero-year-badge');
  const heroPlayBtn = document.getElementById('hero-play-btn');
  
  // Grid & Pagination Elements
  const rowTitle = document.getElementById('row-title');
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
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const modalShuffleBtn = document.getElementById('modal-shuffle-btn');

  // Sidebar Nav Elements
  const navItems = document.querySelectorAll('.sidebar-nav .nav-item');

  // App State
  let allVideos = [];
  let currentFilteredVideos = [];
  let activeFilter = 'all'; // all, recent, large
  let currentPage = 1;
  const itemsPerPage = 10;
  let heroInterval = null;

  function formatDate(mtime) {
    if (!mtime) return 'Recent';
    const date = new Date(mtime * 1000);
    return date.getFullYear().toString();
  }

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
        showEmptyState('Please add video files into your server directory.');
        videoCountText.textContent = '0 Videos';
        return;
      }

      videoCountText.textContent = `${allVideos.length} ${allVideos.length === 1 ? 'Video' : 'Videos'}`;
      
      // Start Hero Rotation
      startHeroRotation();

      // Apply initial filter & render grid
      applyFilters();
    } catch (error) {
      console.error('Failed to load videos:', error);
      skeletonGrid.classList.add('hidden');
      showEmptyState('Could not reach streaming backend server.');
      videoCountText.textContent = 'Offline';
    }
  }

  // ==========================================
  // 2. HERO SPOTLIGHT BANNER
  // ==========================================
  function setupHeroSpotlight(video) {
    if (!video) return;
    
    if (heroSizeBadge) heroSizeBadge.textContent = video.formatted_size || 'HD';
    if (heroYearBadge) heroYearBadge.textContent = formatDate(video.mtime);
    
    if (video.thumbnail_url) {
      heroBackdrop.style.backgroundImage = `url('${video.thumbnail_url}')`;
    } else {
      heroBackdrop.style.background = '#181818';
    }

    heroPlayBtn.onclick = () => openPlayer(video);
    heroSection.classList.remove('hidden');
  }

  function startHeroRotation() {
    if (allVideos.length === 0) return;
    
    // Pick initial random video
    setupHeroSpotlight(allVideos[Math.floor(Math.random() * allVideos.length)]);
    
    if (heroInterval) clearInterval(heroInterval);
    heroInterval = setInterval(() => {
      const randomVideo = allVideos[Math.floor(Math.random() * allVideos.length)];
      setupHeroSpotlight(randomVideo);
    }, 15000);
  }

  // ==========================================
  // 3. NAV, FILTERING, SORTING
  // ==========================================
  
  // Search toggle
  navSearchBtn.addEventListener('click', (e) => {
    e.preventDefault();
    searchContainer.classList.toggle('hidden');
    if (!searchContainer.classList.contains('hidden')) {
      searchInput.focus();
    }
  });

  function applyFilters() {
    let result = [...allVideos];
    const query = searchInput.value.trim().toLowerCase();

    // 1. Search Query
    if (query) {
      result = result.filter(v => (v.filename || '').toLowerCase().includes(query) || (v.title || '').toLowerCase().includes(query));
      clearSearchBtn.classList.remove('hidden');
      rowTitle.textContent = `Search Results: "${query}"`;
    } else {
      clearSearchBtn.classList.add('hidden');
      
      // 2. Category Pill Filter
      if (activeFilter === 'recent') {
        result.sort((a, b) => (b.mtime || 0) - (a.mtime || 0));
        rowTitle.textContent = "Recently Added";
      } else if (activeFilter === 'large') {
        result = result.filter(v => (v.size_bytes || 0) > 500 * 1024 * 1024);
        rowTitle.textContent = "Epic Movies (Large Files)";
      } else {
        rowTitle.textContent = "Trending Now";
      }
    }

    currentFilteredVideos = result;
    currentPage = 1;
    renderGridPage();
  }

  // Sidebar Nav Event Listeners
  navItems.forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.id === 'nav-search-btn' || btn.id === 'nav-random-btn') return;
      
      navItems.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      if (btn.dataset.filter) {
        activeFilter = btn.dataset.filter;
        searchInput.value = '';
        searchContainer.classList.add('hidden');
        applyFilters();
      }
    });
  });

  if (navRandomBtn) {
    navRandomBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (allVideos.length > 0) {
        const randomVideo = allVideos[Math.floor(Math.random() * allVideos.length)];
        openPlayer(randomVideo);
      }
    });
  }

  searchInput.addEventListener('input', applyFilters);
  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    applyFilters();
    searchInput.focus();
  });

  // ==========================================
  // 4. RENDER PAGINATED GRID
  // ==========================================
  function renderGridPage() {
    videoGrid.innerHTML = '';
    
    if (currentFilteredVideos.length === 0) {
      videoGrid.classList.add('hidden');
      paginationWrapper.classList.add('hidden');
      showEmptyState('No titles found for your selection.');
      return;
    }

    emptyState.classList.add('hidden');
    videoGrid.classList.remove('hidden');

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, currentFilteredVideos.length);
    const pageVideos = currentFilteredVideos.slice(startIndex, endIndex);

    pageVideos.forEach(video => {
      const card = document.createElement('article');
      card.className = 'video-card';

      card.innerHTML = `
        <img class="card-thumb-img" src="${video.thumbnail_url}" alt="Video preview" loading="lazy" />
        <div class="card-info-overlay">
          <div class="play-circle-small">
            <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
          </div>
          <span class="card-meta-row">
            <span class="card-match">98% Match</span> 
            ${formatDate(video.mtime)} 
            <span class="maturity-rating">HD</span>
          </span>
        </div>
      `;

      card.addEventListener('click', () => openPlayer(video));
      videoGrid.appendChild(card);
    });

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

    // Logic for 1 ... 4 5 6 ... 85
    const maxVisibleBtns = 5;
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + maxVisibleBtns - 1);
    
    if (endPage - startPage < maxVisibleBtns - 1) {
      startPage = Math.max(1, endPage - maxVisibleBtns + 1);
    }

    if (startPage > 1) {
      pageNumbers.appendChild(createPageBtn(1));
      if (startPage > 2) {
        const ell = document.createElement('span');
        ell.className = 'page-ellipsis';
        ell.textContent = '...';
        pageNumbers.appendChild(ell);
      }
    }

    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.appendChild(createPageBtn(i));
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        const ell = document.createElement('span');
        ell.className = 'page-ellipsis';
        ell.textContent = '...';
        pageNumbers.appendChild(ell);
      }
      pageNumbers.appendChild(createPageBtn(totalPages));
    }
  }

  function createPageBtn(pageNum) {
    const btn = document.createElement('button');
    btn.className = `page-num-btn ${pageNum === currentPage ? 'active' : ''}`;
    btn.textContent = pageNum;
    btn.addEventListener('click', () => {
      currentPage = pageNum;
      renderGridPage();
      window.scrollTo({ top: rowTitle.offsetTop - 100, behavior: 'smooth' });
    });
    return btn;
  }

  prevPageBtn.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      renderGridPage();
      window.scrollTo({ top: rowTitle.offsetTop - 100, behavior: 'smooth' });
    }
  });

  nextPageBtn.addEventListener('click', () => {
    const totalPages = Math.ceil(currentFilteredVideos.length / itemsPerPage);
    if (currentPage < totalPages) {
      currentPage++;
      renderGridPage();
      window.scrollTo({ top: rowTitle.offsetTop - 100, behavior: 'smooth' });
    }
  });

  function showEmptyState(desc) {
    emptyDesc.textContent = desc;
    emptyState.classList.remove('hidden');
  }

  // ==========================================
  // 5. CINEMA MODAL PLAYER
  // ==========================================
  function openPlayer(video) {
    mainVideoPlayer.src = video.stream_url;
    playerModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    mainVideoPlayer.play().catch(err => {
      console.log('Autoplay deferred by browser:', err);
    });
  }

  function closePlayer() {
    mainVideoPlayer.pause();
    mainVideoPlayer.removeAttribute('src');
    mainVideoPlayer.load();
    playerModal.classList.add('hidden');
    document.body.style.overflow = '';
  }

  modalCloseBtn.addEventListener('click', closePlayer);
  
  if (modalShuffleBtn) {
    modalShuffleBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // prevent modal click from closing
      if (allVideos.length > 0) {
        const randomVideo = allVideos[Math.floor(Math.random() * allVideos.length)];
        openPlayer(randomVideo);
      }
    });
  }

  playerModal.addEventListener('click', (e) => {
    if (e.target === playerModal) closePlayer();
  });

  mainVideoPlayer.addEventListener('contextmenu', (e) => {
    e.preventDefault();
  });

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

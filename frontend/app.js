document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const videoGrid = document.getElementById('video-grid');
  const loadingSpinner = document.getElementById('loading-spinner');
  const noVideosMsg = document.getElementById('no-videos-msg');
  const videoCountBadge = document.getElementById('video-count-badge');
  const searchInput = document.getElementById('search-input');
  const orbitalCarousel = document.getElementById('orbital-carousel');
  const orbPrev = document.getElementById('orb-prev');
  const orbNext = document.getElementById('orb-next');
  const orbDots = document.getElementById('orb-dots');

  // Modal Elements
  const playerModal = document.getElementById('player-modal');
  const videoPlayer = document.getElementById('video-player');
  const modalVideoTitle = document.getElementById('modal-video-title');
  const modalCloseBtn = document.getElementById('modal-close-btn');

  let allVideos = [];
  let currentOrbIndex = 0;
  let orbitalVideos = [];

  // ==========================================
  // 1. STARFIELD BACKGROUND ANIMATION CANVAS
  // ==========================================
  function initStarfield() {
    const canvas = document.getElementById('starfield-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    window.addEventListener('resize', () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    });

    const stars = Array.from({ length: 90 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 1.8 + 0.4,
      speed: Math.random() * 0.4 + 0.1,
      opacity: Math.random() * 0.7 + 0.3
    }));

    function animate() {
      ctx.clearRect(0, 0, width, height);
      stars.forEach(star => {
        star.y -= star.speed;
        if (star.y < 0) star.y = height;

        ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
      });
      requestAnimationFrame(animate);
    }
    animate();
  }
  initStarfield();

  // ==========================================
  // 2. FETCH VIDEOS & INITIALIZATION
  // ==========================================
  async function loadVideos() {
    try {
      const response = await fetch('/api/videos');
      if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
      allVideos = await response.json();

      loadingSpinner.classList.add('hidden');
      videoCountBadge.textContent = `${allVideos.length} VIDEOS`;

      if (allVideos.length === 0) {
        noVideosMsg.classList.remove('hidden');
      } else {
        renderVideos(allVideos);
        setupOrbitalCarousel(allVideos.slice(0, 7));
      }
    } catch (error) {
      console.error('Failed to load videos:', error);
      loadingSpinner.classList.add('hidden');
      noVideosMsg.classList.remove('hidden');
    }
  }

  // ==========================================
  // 3. 3D ORBITAL CAROUSEL STAGE
  // ==========================================
  function setupOrbitalCarousel(items) {
    if (!items || items.length === 0) return;
    orbitalVideos = items;
    orbitalCarousel.innerHTML = '';
    orbDots.innerHTML = '';

    const total = items.length;
    const radius = 380; // 3D Ring Radius

    items.forEach((video, index) => {
      // 3D Item Panel
      const orbItem = document.createElement('div');
      orbItem.className = 'orb-item';
      orbItem.dataset.index = index;

      orbItem.innerHTML = `
        <img src="${video.thumbnail_url}" alt="${video.title}" 
             onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'100%\\' height=\\'100%\\' fill=\\'%23151c2c\\'><text x=\\'50%\\' y=\\'50%\\' fill=\\'%2394a3b8\\' text-anchor=\\'middle\\'>Stream</text></svg>';"/>
        <div class="orb-info">
          <h4 title="${video.title}">${video.title}</h4>
          <span>STREAM ID #${video.id.substring(0, 6)}</span>
        </div>
      `;

      orbItem.addEventListener('click', () => {
        if (index === currentOrbIndex) {
          openPlayer(video);
        } else {
          currentOrbIndex = index;
          updateOrbitalPosition();
        }
      });

      orbitalCarousel.appendChild(orbItem);

      // Dot Navigation
      const dot = document.createElement('div');
      dot.className = `orb-dot ${index === 0 ? 'active' : ''}`;
      dot.addEventListener('click', () => {
        currentOrbIndex = index;
        updateOrbitalPosition();
      });
      orbDots.appendChild(dot);
    });

    updateOrbitalPosition();
  }

  function updateOrbitalPosition() {
    const orbItems = document.querySelectorAll('.orb-item');
    const dots = document.querySelectorAll('.orb-dot');
    const total = orbItems.length;
    if (total === 0) return;

    const angleStep = 360 / total;

    orbItems.forEach((item, index) => {
      const offset = index - currentOrbIndex;
      const angle = offset * angleStep;
      
      // Calculate 3D transformation around orbital ring
      const transformStr = `rotateY(${angle}deg) translateZ(360px)`;
      item.style.transform = transformStr;
      item.style.opacity = Math.abs(offset) > 2 ? '0.2' : '1';

      if (index === currentOrbIndex) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    dots.forEach((dot, index) => {
      dot.classList.toggle('active', index === currentOrbIndex);
    });
  }

  orbPrev.addEventListener('click', () => {
    if (orbitalVideos.length === 0) return;
    currentOrbIndex = (currentOrbIndex - 1 + orbitalVideos.length) % orbitalVideos.length;
    updateOrbitalPosition();
  });

  orbNext.addEventListener('click', () => {
    if (orbitalVideos.length === 0) return;
    currentOrbIndex = (currentOrbIndex + 1) % orbitalVideos.length;
    updateOrbitalPosition();
  });

  // ==========================================
  // 4. 3D PARALLAX TILT VIDEO GRID CARDS
  // ==========================================
  function renderVideos(videos) {
    videoGrid.innerHTML = '';
    if (videos.length === 0) {
      noVideosMsg.classList.remove('hidden');
      return;
    }
    noVideosMsg.classList.add('hidden');

    videos.forEach(video => {
      const card = document.createElement('div');
      card.className = 'video-card';

      card.innerHTML = `
        <div class="thumbnail-wrapper">
          <img class="thumbnail-img" src="${video.thumbnail_url}" alt="${video.title}"
               onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"/>
          <div class="fallback-thumb" style="display:none; position:absolute; inset:0; align-items:center; justify-content:center; background:#090d16; color:#94a3b8;">
            <svg style="width:40px;height:40px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
          </div>
          <div class="play-overlay">
            <div class="play-btn-glow">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
            </div>
          </div>
        </div>
        <div class="card-body">
          <h4 class="card-title" title="${video.title}">${video.title}</h4>
          <div class="card-footer">
            <span class="size-tag">${video.formatted_size}</span>
          </div>
        </div>
      `;

      // 3D Tilt Parallax Tracking
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;

        const rotateX = (-y / rect.height) * 16;
        const rotateY = (x / rect.width) * 16;

        card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.03)`;
      });

      card.addEventListener('mouseleave', () => {
        card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)';
      });

      card.addEventListener('click', () => openPlayer(video));
      videoGrid.appendChild(card);
    });
  }

  // Live search filtering
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    const filtered = allVideos.filter(v => v.title.toLowerCase().includes(query));
    renderVideos(filtered);
  });

  // Keyboard shortcut '/' to search
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== searchInput) {
      e.preventDefault();
      searchInput.focus();
    }
  });

  // ==========================================
  // 5. MODAL PLAYER CONTROLS
  // ==========================================
  function openPlayer(video) {
    modalVideoTitle.textContent = video.title;
    videoPlayer.src = video.stream_url;
    playerModal.classList.remove('hidden');
    videoPlayer.play().catch(e => console.log('Autoplay handled:', e));
  }

  function closePlayer() {
    videoPlayer.pause();
    videoPlayer.removeAttribute('src');
    videoPlayer.load();
    playerModal.classList.add('hidden');
  }

  modalCloseBtn.addEventListener('click', closePlayer);
  playerModal.addEventListener('click', (e) => {
    if (e.target === playerModal) closePlayer();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !playerModal.classList.contains('hidden')) closePlayer();
  });

  // Start app
  loadVideos();
});

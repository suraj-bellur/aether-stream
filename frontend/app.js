document.addEventListener('DOMContentLoaded', () => {
  const videoGrid = document.getElementById('video-grid');
  const loadingSpinner = document.getElementById('loading-spinner');
  const noVideosMsg = document.getElementById('no-videos-msg');
  const videoCountBadge = document.getElementById('video-count-badge');
  const searchInput = document.getElementById('search-input');
  
  // Modal Elements
  const playerModal = document.getElementById('player-modal');
  const videoPlayer = document.getElementById('video-player');
  const modalVideoTitle = document.getElementById('modal-video-title');
  const modalCloseBtn = document.getElementById('modal-close-btn');

  let allVideos = [];

  // Fetch videos from Backend API
  async function loadVideos() {
    try {
      const response = await fetch('/api/videos');
      if (!response.ok) {
        throw new Error(`API Error: ${response.statusText}`);
      }
      allVideos = await response.json();
      
      loadingSpinner.classList.add('hidden');
      videoCountBadge.textContent = `${allVideos.length} Videos`;

      if (allVideos.length === 0) {
        noVideosMsg.classList.remove('hidden');
      } else {
        renderVideos(allVideos);
      }
    } catch (error) {
      console.error('Failed to load videos:', error);
      loadingSpinner.classList.add('hidden');
      noVideosMsg.classList.remove('hidden');
      noVideosMsg.querySelector('h3').textContent = 'Failed to load video library';
      noVideosMsg.querySelector('p').textContent = 'Could not connect to the backend server API.';
    }
  }

  // Render video cards
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
      card.dataset.title = video.title.toLowerCase();

      card.innerHTML = `
        <div class="thumbnail-wrapper">
          <img class="thumbnail-img" src="${video.thumbnail_url}" alt="${video.title}" 
               onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"/>
          <div class="fallback-thumb" style="display:none; position:absolute; inset:0; align-items:center; justify-content:center; background:#111827; color:#6b7280;">
            <svg style="width:40px;height:40px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
          </div>
          <div class="play-overlay">
            <div class="play-btn-circle">
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

      card.addEventListener('click', () => openPlayer(video));
      videoGrid.appendChild(card);
    });
  }

  // Live search filter
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    const filtered = allVideos.filter(v => v.title.toLowerCase().includes(query));
    renderVideos(filtered);
  });

  // Modal open player
  function openPlayer(video) {
    modalVideoTitle.textContent = video.title;
    videoPlayer.src = video.stream_url;
    playerModal.classList.remove('hidden');
    videoPlayer.play().catch(e => console.log('Autoplay prevented:', e));
  }

  // Modal close player
  function closePlayer() {
    videoPlayer.pause();
    videoPlayer.removeAttribute('src');
    videoPlayer.load();
    playerModal.classList.add('hidden');
  }

  modalCloseBtn.addEventListener('click', closePlayer);

  playerModal.addEventListener('click', (e) => {
    if (e.target === playerModal) {
      closePlayer();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !playerModal.classList.contains('hidden')) {
      closePlayer();
    }
  });

  // Initial load
  loadVideos();
});

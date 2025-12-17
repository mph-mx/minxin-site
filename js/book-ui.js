// [file name]: book-ui.js
// [file content begin]
// js/book-ui.js
// Shared UI helpers for Minxin Reading Lists:
// - Book details modal
// - Favorites (hearts) with localStorage
// - Blur + fade-in images
// - Scroll-to-top button
// - Netflix row scroll hints
// - Platform Search (NEW)

(function () {
  const STORAGE_KEY = 'mxReadingFavorites_v1';

  const state = {
    favorites: loadFavorites()
  };

  function bookKey(book) {
    return `${(book.title || '').trim()}::${(book.author || '').trim()}`;
  }

  function loadFavorites() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function saveFavorites() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.favorites));
    } catch (e) {
      // ignore
    }
  }

  function isFavorite(book) {
    const key = bookKey(book);
    return state.favorites.includes(key);
  }

  function toggleFavorite(book) {
    const key = bookKey(book);
    const idx = state.favorites.indexOf(key);
    if (idx === -1) {
      state.favorites.push(key);
    } else {
      state.favorites.splice(idx, 1);
    }
    saveFavorites();
    document.dispatchEvent(new CustomEvent('mxFavoritesChanged'));
  }

  function createHeartButton(book) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'heart-btn';
    
    // SVG for iOS compatibility
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>';

    if (isFavorite(book)) {
      btn.classList.add('active');
    }

    btn.addEventListener('click', (evt) => {
      evt.stopPropagation();
      toggleFavorite(book);
      btn.classList.toggle('active', isFavorite(book));

      // pop animation
      btn.classList.remove('pop');
      void btn.offsetWidth; // forces reflow so animation can replay
      btn.classList.add('pop');
    });

    return btn;
  }
  

  /* ------------ Modal ------------ */

  function ensureModalElements() {
    let backdrop = document.querySelector('.book-modal-backdrop');
    if (backdrop) return backdrop;

    backdrop = document.createElement('div');
    backdrop.className = 'book-modal-backdrop hidden';

    const modal = document.createElement('div');
    modal.className = 'book-modal';

    modal.innerHTML = `
      <button class="book-modal-close" aria-label="Close modal">&times;</button>
      <div class="book-modal-body">
        <div class="book-modal-left">
          <img class="book-modal-cover" alt="">
          <!-- Added: Platform search button placeholder -->
          <a href="#" target="_blank" class="book-action-btn hidden" id="modalSearchBtn">Find Online</a>
        </div>
        <div class="book-modal-right">
          <h2 class="book-modal-title"></h2>
          <div class="book-modal-author"></div>
          <div class="book-modal-meta"></div>
          <div class="book-modal-pills"></div>
        </div>
      </div>
      <div class="book-modal-description"></div>
      <div class="book-modal-more">
        <h3>More like this</h3>
        <div class="book-modal-more-row"></div>
      </div>
    `;

    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    function closeModal() {
      backdrop.classList.add('hidden');
      document.body.classList.remove('modal-open');
    }

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        closeModal();
      }
    });

    modal.querySelector('.book-modal-close').addEventListener('click', closeModal);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !backdrop.classList.contains('hidden')) {
        closeModal();
      }
    });

    return backdrop;
  }

  // NEW: Helper to generate search URLs
  function getSearchUrl(platform, bookTitle, bookAuthor) {
    const query = encodeURIComponent(`${bookTitle} ${bookAuthor}`);
    switch (platform) {
      case 'dangdang': return `http://search.dangdang.com/?key=${query}`;
      case 'jd': return `https://search.jd.com/Search?keyword=${query}`;
      case 'wechat': return `https://weread.qq.com/web/search/global?keyword=${query}`;
      case 'baidu': return `https://yuedu.baidu.com/search?word=${query}`;
      case 'amazon': return `https://www.amazon.com/s?k=${query}`;
      case 'google': return `https://www.google.com/search?tbm=bks&q=${query}`;
      case 'apple': return `https://www.google.com/search?q=site:books.apple.com+${query}`;
      default: return `https://www.google.com/search?q=${query}`;
    }
  }

  function fillModal(book, allBooks) {
    const backdrop = ensureModalElements();
    const modal = backdrop.querySelector('.book-modal');

    const cover = modal.querySelector('.book-modal-cover');
    cover.src = book.image;
    cover.alt = `${book.title || ''} cover`;
    cover.classList.remove('loaded');
    
    // Apply blur logic
    decorateImage(cover);

    // NEW: Logic to update the "Find Online" button
    const searchBtn = modal.querySelector('#modalSearchBtn');
    const platformSelector = document.getElementById('platformSelector');
    
    // Only show button if a platform is actually selected (value is not empty)
    if (platformSelector && searchBtn && platformSelector.value !== "") {
        const platform = platformSelector.value;
        const platformName = platformSelector.options[platformSelector.selectedIndex].text.split('(')[0].trim();
        
        searchBtn.classList.remove('hidden');
        searchBtn.textContent = `Shop on ${platformName}`;
        searchBtn.href = getSearchUrl(platform, book.title || '', book.author || '');
    } else if (searchBtn) {
        searchBtn.classList.add('hidden');
    }

    modal.querySelector('.book-modal-title').textContent = book.title || '';
    modal.querySelector('.book-modal-author').textContent = book.author || '';

    const metaParts = [];
    if (book.reading_level) metaParts.push(book.reading_level);
    if (book.age_band) metaParts.push(book.age_band);
    modal.querySelector('.book-modal-meta').textContent = metaParts.join(' · ');

    const pillsContainer = modal.querySelector('.book-modal-pills');
    pillsContainer.innerHTML = '';

    const pillSource = (book.genre_pills && book.genre_pills.length)
      ? book.genre_pills
      : (book.genres || []);

    Array.from(new Set(pillSource)).forEach(p => {
      const span = document.createElement('span');
      span.className = 'pill-genre';
      span.textContent = p;
      pillsContainer.appendChild(span);
    });

    modal.querySelector('.book-modal-description').textContent =
      book.description || 'No description available yet.';
  const desc = modal.querySelector('.book-modal-description');
  desc.textContent = book.description || '';

  /* Minxin Library location */
  if (book.minxin_library && book.minxin_location_en) {
    const location = document.createElement('div');
    location.className = 'book-modal-library';
    location.innerHTML = `📚 ${book.minxin_location_en}`;
    desc.appendChild(location);
  }

    const moreSection = modal.querySelector('.book-modal-more');
    const moreRow = modal.querySelector('.book-modal-more-row');
    moreRow.innerHTML = '';

    if (Array.isArray(allBooks) && allBooks.length) {
      const currentKey = bookKey(book);
      const primaryGenre = (book.genres && book.genres[0]) || null;

      const similar = allBooks
        .filter(b => bookKey(b) !== currentKey)
        .filter(b => {
          if (primaryGenre && (b.genres || []).includes(primaryGenre)) return true;
          if (book.reading_level && b.reading_level === book.reading_level) return true;
          return false;
        })
        .slice(0, 6);

      similar.forEach(sim => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'more-like-card';
        btn.innerHTML = `
          <img src="${sim.image}" alt="${sim.title || ''} cover" loading="lazy">
          <span>${sim.title || ''}</span>
        `;
        decorateImage(btn.querySelector('img'));
        btn.addEventListener('click', () => openModal(sim, allBooks));
        moreRow.appendChild(btn);
      });

      moreSection.style.display = similar.length ? 'block' : 'none';
    } else {
      moreSection.style.display = 'none';
    }
  }

  function openModal(book, allBooks) {
    const backdrop = ensureModalElements();
    fillModal(book, allBooks || []);
    backdrop.classList.remove('hidden');
    document.body.classList.add('modal-open');
  }

  /* ------------ Card decoration ------------ */

  function decorateImage(img) {
    if (!img) return;
    
    const markLoaded = () => {
        img.classList.add('loaded');
    };

	// Always remove blur after a short delay
	requestAnimationFrame(() => {
	  img.classList.add('loaded');
	});

	// Also listen for load if it does fire
	img.addEventListener('load', () => {
	  img.classList.add('loaded');
	}, { once: true });

  }

	function createMinxinBadge(book) {
	  if (!book || !book.minxin_library) return null;

	  const badge = document.createElement('div');
	  badge.className = 'minxin-badge';
	  badge.innerHTML = `
		<span>📚</span>
		<span>Minxin</span>
	  `;
	  return badge;
	}


	function attachCard(cardEl, book, allBooks) {
	  if (!cardEl || !book) return;

	  cardEl.dataset.bookKey = bookKey(book);

	  cardEl.addEventListener('click', () => {
		openModal(book, allBooks || []);
	  });

	  const badge = createMinxinBadge(book);
	  if (badge) cardEl.appendChild(badge);

	  const heart = createHeartButton(book);
	  cardEl.appendChild(heart);

	  const img = cardEl.querySelector('img');
	  decorateImage(img);
	}

  /* ------------ Scroll-to-top + Netflix hints ------------ */

  function initScrollTop() {
    const existing = document.getElementById('scrollTopBtn');
    if (existing) return;

    const btn = document.createElement('button');
    btn.id = 'scrollTopBtn';
    btn.className = 'scroll-top-btn';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Scroll to top');
    btn.innerHTML = '↑';
    document.body.appendChild(btn);

    btn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    window.addEventListener('scroll', () => {
      if (window.scrollY > 600) {
        btn.classList.add('visible');
      } else {
        btn.classList.remove('visible');
      }
    });
  }

  function applyGenreScrollHints() {
    document.querySelectorAll('.genre-scroll').forEach(scroller => {
      if (scroller.scrollWidth > scroller.clientWidth + 10) {
        scroller.classList.add('scroll-fade');
      } else {
        scroller.classList.remove('scroll-fade');
      }
    });
  }

  function initGenreScrollHints() {
    applyGenreScrollHints();
    window.addEventListener('resize', applyGenreScrollHints);
  }

  function initGlobal() {
    initScrollTop();
    initGenreScrollHints();
    initDarkMode();
  }

  function initDarkMode() {
    const toggle = document.getElementById('darkModeToggle');
    if (!toggle) return;

    const saved = localStorage.getItem('mx_darkmode');
    if (saved === '1') {
      document.body.classList.add('dark');
      toggle.textContent = '☀️ Light';
    }

    toggle.addEventListener('click', () => {
      const isDark = document.body.classList.toggle('dark');
      toggle.textContent = isDark ? '☀️ Light' : '🌙 Dark';
      localStorage.setItem('mx_darkmode', isDark ? '1' : '0');
    });
  }

  document.addEventListener('DOMContentLoaded', initGlobal);

  /* ------------ Public API ------------ */

  window.BookUI = {
    attachCard,
    isFavorite,
    getFavorites: () => state.favorites.slice(),
    bookKey,
    openModal,
    
    // 1. Helper to get the actual book objects
    getFavoriteBooks: function(allBooks) {
        const favorites = this.getFavorites();
        if (!allBooks || !Array.isArray(allBooks)) return [];
        return allBooks.filter(b => favorites.includes(this.bookKey(b)));
    },

    // 2. Shared function to download favorites as a Text File
    downloadFavoritesAsTxt: function(allBooks, listName = "My Reading List") {
        const favorites = this.getFavoriteBooks(allBooks);
        
        if (!favorites || favorites.length === 0) {
            alert("You have no favorites to export!");
            return;
        }

        let text = `MY FAVORITE BOOKS - ${listName.toUpperCase()}\n`;
        text += `========================================\n\n`;
        text += `Exported: ${new Date().toLocaleDateString()}\n`;
        text += `Total: ${favorites.length} book${favorites.length === 1 ? '' : 's'}\n\n`;

        favorites.forEach((book, index) => {
            text += `${index + 1}. ${book.title}\n`;
            text += `   Author: ${book.author || 'Unknown'}\n`;
            if (book.reading_level) text += `   Level: ${book.reading_level}\n`;
            if (book.age_band) text += `   Age: ${book.age_band}\n`;
            if (book.genres && book.genres.length) {
            text += `   Genres: ${book.genres.join(', ')}\n`;
            }
            if (book.description) {
                const shortDesc = book.description.length > 200 
                    ? book.description.substring(0, 200) + '...' 
                    : book.description;
                text += `   About: ${shortDesc}\n`;
            }
            text += '\n';
        });

        text += `\n---\nExported from Minxin Reading Lists\n`;
        
        // Trigger download
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const dateStr = new Date().toISOString().split('T')[0];
        link.download = `minxin-favorites-${dateStr}.txt`;
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
  };
})();
// [file content end]
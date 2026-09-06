const TMDB_CONFIG = {
    apiKey: '64672e64858d59449d385e4df7e296d1',
    baseUrl: 'https://api.themoviedb.org/3'
};

const tmdbImageBaseUrl = 'https://image.tmdb.org/t/p/w342';
const searchParams = new URLSearchParams(window.location.search);
const query = searchParams.get('q') || '';
const category = searchParams.get('type') || '';
const currentPage = Math.max(1, Number(searchParams.get('page')) || 1);
const resultsGrid = document.getElementById('results-grid');
const searchTitle = document.getElementById('search-title');
const pagination = document.getElementById('tmdb-pagination');

function escapeHtml(value) {
    return String(value || '').replace(/[&<>'"]/g, function(character) {
        return {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[character];
    });
}

function renderResults(results) {
    var usableResults = results.filter(function(result) {
        return (result.media_type === 'movie' || result.media_type === 'tv') && (result.backdrop_path || result.poster_path);
    }).slice(0, 24);

    if (!usableResults.length) {
        resultsGrid.innerHTML = '<div class="tmdb-search-message">No movies or shows found for <strong>' + escapeHtml(query) + '</strong>.</div>';
        return;
    }

    resultsGrid.innerHTML = usableResults.map(function(result) {
        var type = result.media_type === 'tv' ? 'TV show' : 'Movie';
        var title = result.title || result.name || 'Untitled';
        var date = result.release_date || result.first_air_date || '';
        var rating = result.vote_average ? result.vote_average.toFixed(1) : 'N/A';

        var imagePath = result.backdrop_path ? 'https://image.tmdb.org/t/p/w780' + result.backdrop_path : tmdbImageBaseUrl + result.poster_path;

        return '<a class="tmdb-result" href="index.html?title=' + encodeURIComponent(title) + '">' +
            '<img src="' + imagePath + '" alt="' + escapeHtml(title) + ' backdrop">' +
            '<span class="tmdb-result-content"><strong>' + escapeHtml(title) + '</strong><small>' + type + ' &middot; ' + (date ? date.slice(0, 4) : 'Unknown year') + ' &middot; ' + rating + '/10</small></span>' +
            '</a>';
    }).join('');
}

function renderPagination(totalPages, page) {
    var safeTotalPages = Math.min(Number(totalPages) || 1, 500);
    if (safeTotalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }

    var firstPage = Math.max(1, Math.min(page - 2, safeTotalPages - 4));
    var lastPage = Math.min(safeTotalPages, firstPage + 4);
    var buttons = '<button type="button" class="tmdb-page-button tmdb-page-arrow" data-page="' + Math.max(1, page - 1) + '"' + (page === 1 ? ' disabled' : '') + ' aria-label="Previous page"><i class="fa fa-chevron-left"></i></button>';

    for (var pageNumber = firstPage; pageNumber <= lastPage; pageNumber += 1) {
        buttons += '<button type="button" class="tmdb-page-button' + (pageNumber === page ? ' is-active' : '') + '" data-page="' + pageNumber + '" aria-current="' + (pageNumber === page ? 'page' : 'false') + '">' + pageNumber + '</button>';
    }

    buttons += '<button type="button" class="tmdb-page-button tmdb-page-arrow" data-page="' + Math.min(safeTotalPages, page + 1) + '"' + (page === safeTotalPages ? ' disabled' : '') + ' aria-label="Next page"><i class="fa fa-chevron-right"></i></button>';
    pagination.innerHTML = buttons;
}

function renderCategoryResults(data, mediaType, page) {
    var results = (data.results || []).filter(function(result) {
        return result.backdrop_path || result.poster_path;
    }).map(function(result) {
        result.media_type = mediaType;
        return result;
    });
    renderResults(results);
    renderPagination(data.total_pages, page);
}

function renderSearchResults(data, page) {
    renderResults(data.results || []);
    renderPagination(data.total_pages, page);
}

function loadResults(page) {
    var endpoint;

    if (category === 'movie' || category === 'tv') {
        endpoint = TMDB_CONFIG.baseUrl + '/discover/' + category + '?api_key=' + encodeURIComponent(TMDB_CONFIG.apiKey) + '&language=en-US&include_adult=false&sort_by=popularity.desc&page=' + page;
    } else {
        endpoint = TMDB_CONFIG.baseUrl + '/search/multi?api_key=' + encodeURIComponent(TMDB_CONFIG.apiKey) + '&language=en-US&include_adult=false&query=' + encodeURIComponent(query) + '&page=' + page;
    }

    resultsGrid.innerHTML = '<div class="tmdb-search-message">Loading page ' + page + '...</div>';
    pagination.innerHTML = '';
    fetch(endpoint)
        .then(function(response) {
            if (!response.ok) {
                throw new Error('TMDB request failed');
            }
            return response.json();
        })
        .then(function(data) {
            if (category === 'movie' || category === 'tv') {
                renderCategoryResults(data, category, page);
            } else {
                renderSearchResults(data, page);
            }
            window.history.replaceState({}, '', 'search-results.html?' + (category ? 'type=' + encodeURIComponent(category) : 'q=' + encodeURIComponent(query)) + '&page=' + page);
        })
        .catch(function() {
            resultsGrid.innerHTML = '<div class="tmdb-search-message">TMDB is unavailable right now. Please try again.</div>';
        });
}

pagination.addEventListener('click', function(event) {
    var button = event.target.closest('.tmdb-page-button');
    if (!button || button.disabled) {
        return;
    }
    loadResults(Number(button.getAttribute('data-page')) || 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

if (category === 'movie' || category === 'tv') {
    var categoryName = category === 'movie' ? 'Movies' : 'TV Shows';
    searchTitle.textContent = categoryName;
    loadResults(currentPage);
} else if (!query) {
    searchTitle.textContent = 'Search movies and shows';
    resultsGrid.innerHTML = '<div class="tmdb-search-message">Enter a title from the home page to start searching.</div>';
} else {
    searchTitle.textContent = 'Results for "' + query + '"';
    loadResults(currentPage);
}

const RESULTS_TMDB_CONFIG = {
    apiKey: '64672e64858d59449d385e4df7e296d1',
    baseUrl: 'https://api.themoviedb.org/3'
};

const tmdbImageBaseUrl = 'https://image.tmdb.org/t/p/w342';
const searchParams = new URLSearchParams(window.location.search);
const query = searchParams.get('q') || '';
const category = searchParams.get('type') || '';
const currentPage = Math.max(1, Number(searchParams.get('page')) || 1);
const currentSort = searchParams.get('sort') || '';
const currentGenre = searchParams.get('genre') || '';
const currentYear = searchParams.get('year') || '';
const resultsGrid = document.getElementById('results-grid');
const searchTitle = document.getElementById('search-title');
const pagination = document.getElementById('tmdb-pagination');
const resultsFilters = document.getElementById('results-filters');
const sortSelect = document.getElementById('sort-select');
const genreSelect = document.getElementById('genre-select');
const yearSelect = document.getElementById('year-select');

const genreOptions = {
    movie: [
        { id: 28, name: 'Action' },
        { id: 12, name: 'Adventure' },
        { id: 16, name: 'Animation' },
        { id: 35, name: 'Comedy' },
        { id: 80, name: 'Crime' },
        { id: 99, name: 'Documentary' },
        { id: 18, name: 'Drama' },
        { id: 10751, name: 'Family' },
        { id: 14, name: 'Fantasy' },
        { id: 36, name: 'History' },
        { id: 27, name: 'Horror' },
        { id: 10402, name: 'Music' },
        { id: 9648, name: 'Mystery' },
        { id: 10749, name: 'Romance' },
        { id: 878, name: 'Science Fiction' },
        { id: 53, name: 'Thriller' },
        { id: 10752, name: 'War' },
        { id: 37, name: 'Western' }
    ],
    tv: [
        { id: 10759, name: 'Action & Adventure' },
        { id: 16, name: 'Animation' },
        { id: 35, name: 'Comedy' },
        { id: 80, name: 'Crime' },
        { id: 99, name: 'Documentary' },
        { id: 18, name: 'Drama' },
        { id: 10751, name: 'Family' },
        { id: 10762, name: 'Kids' },
        { id: 9648, name: 'Mystery' },
        { id: 10763, name: 'News' },
        { id: 10764, name: 'Reality' },
        { id: 10765, name: 'Sci-Fi & Fantasy' },
        { id: 10766, name: 'Soap' },
        { id: 10767, name: 'Talk' },
        { id: 10768, name: 'War & Politics' },
        { id: 37, name: 'Western' }
    ]
};

const sortOptionsByType = {
    movie: [
        { value: 'popularity.desc', label: 'Popular' },
        { value: 'vote_count.desc', label: 'Most Watched' },
        { value: 'vote_average.desc', label: 'Top Rated' }
    ],
    tv: [
        { value: 'popularity.desc', label: 'Popular' },
        { value: 'vote_count.desc', label: 'Most Watched' },
        { value: 'vote_average.desc', label: 'Top Rated' }
    ]
};

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

function setFilterDefaults() {
    if (!resultsFilters || !sortSelect || !genreSelect || !yearSelect) {
        return;
    }

    var mediaType = category === 'tv' ? 'tv' : 'movie';
    var sortValue = currentSort || 'popularity.desc';
    sortSelect.innerHTML = sortOptionsByType[mediaType].map(function(option) {
        return '<option value="' + option.value + '"' + (option.value === sortValue ? ' selected' : '') + '>' + option.label + '</option>';
    }).join('');

    var currentYearValue = Number(currentYear) || 0;
    var years = [];
    for (var year = new Date().getFullYear(); year >= 2000; year -= 1) {
        years.push(year);
    }
    yearSelect.innerHTML = '<option value="">All Years</option>' + years.map(function(year) {
        return '<option value="' + year + '"' + (String(year) === String(currentYearValue) ? ' selected' : '') + '>' + year + '</option>';
    }).join('');

    var genres = genreOptions[mediaType] || genreOptions.movie;
    genreSelect.innerHTML = '<option value="">All Genres</option>' + genres.map(function(genre) {
        return '<option value="' + genre.id + '"' + (String(genre.id) === String(currentGenre) ? ' selected' : '') + '>' + escapeHtml(genre.name) + '</option>';
    }).join('');
}

function renderResults(results) {
    var usableResults = results.filter(function(result) {
        return (result.media_type === 'movie' || result.media_type === 'tv') && (result.backdrop_path || result.poster_path);
    }).slice(0, 24);

    if (!usableResults.length) {
        resultsGrid.innerHTML = '<div class="tmdb-search-message">No movies or shows found for <strong>' + escapeHtml(query || (category === 'tv' ? 'TV shows' : 'movies')) + '</strong>.</div>';
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
        var hasMovieFields = result.title && result.release_date && !result.name && !result.first_air_date;
        var hasTvFields = result.name && result.first_air_date && !result.title && !result.release_date;
        var hasExpectedMediaType = mediaType === 'movie' ? hasMovieFields : hasTvFields;
        return hasExpectedMediaType && (result.backdrop_path || result.poster_path);
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

function buildCategoryEndpoint(mediaType, page) {
    var sortBy = sortSelect && sortSelect.value ? sortSelect.value : sortOptionsByType[mediaType][0].value;
    var genreId = genreSelect && genreSelect.value ? genreSelect.value : '';
    var yearValue = yearSelect && yearSelect.value ? yearSelect.value : '';
    var endpoint = RESULTS_TMDB_CONFIG.baseUrl + '/discover/' + mediaType + '?api_key=' + encodeURIComponent(RESULTS_TMDB_CONFIG.apiKey) + '&language=en-US&include_adult=false&sort_by=' + encodeURIComponent(sortBy) + '&page=' + page;

    if (sortBy === 'vote_average.desc') {
        var releaseDateField = mediaType === 'tv' ? 'first_air_date.lte' : 'primary_release_date.lte';
        endpoint += '&' + releaseDateField + '=' + new Date().toISOString().slice(0, 10);
    }

    if (genreId) {
        endpoint += '&with_genres=' + encodeURIComponent(genreId);
    }
    if (yearValue) {
        endpoint += '&' + (mediaType === 'tv' ? 'first_air_date_year' : 'primary_release_year') + '=' + encodeURIComponent(yearValue);
    }

    return endpoint;
}

function updateCategoryUrl(page) {
    var params = new URLSearchParams();
    params.set('type', category);
    params.set('page', String(page));

    if (sortSelect && sortSelect.value && sortSelect.value !== sortOptionsByType[category === 'tv' ? 'tv' : 'movie'][0].value) {
        params.set('sort', sortSelect.value);
    }
    if (genreSelect && genreSelect.value) {
        params.set('genre', genreSelect.value);
    }
    if (yearSelect && yearSelect.value) {
        params.set('year', yearSelect.value);
    }

    window.history.replaceState({}, '', 'search-results.html?' + params.toString());
}

function loadResults(page) {
    var endpoint;

    if (category === 'movie' || category === 'tv') {
        endpoint = buildCategoryEndpoint(category, page);
    } else {
        endpoint = RESULTS_TMDB_CONFIG.baseUrl + '/search/multi?api_key=' + encodeURIComponent(RESULTS_TMDB_CONFIG.apiKey) + '&language=en-US&include_adult=false&query=' + encodeURIComponent(query) + '&page=' + page;
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
                updateCategoryUrl(page);
            } else {
                renderSearchResults(data, page);
                window.history.replaceState({}, '', 'search-results.html?' + (category ? 'type=' + encodeURIComponent(category) : 'q=' + encodeURIComponent(query)) + '&page=' + page);
            }
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

if (resultsFilters && sortSelect && genreSelect && yearSelect) {
    sortSelect.addEventListener('change', function() { loadResults(1); });
    genreSelect.addEventListener('change', function() { loadResults(1); });
    yearSelect.addEventListener('change', function() { loadResults(1); });
}

if (category === 'movie' || category === 'tv') {
    var categoryName = category === 'movie' ? 'Movies' : 'Shows';
    document.title = categoryName + ' | Kioko';
    if (searchTitle) {
        searchTitle.textContent = categoryName;
    }
    if (resultsFilters) {
        resultsFilters.style.display = 'grid';
    }
    setFilterDefaults();
    loadResults(currentPage);
} else if (!query) {
    if (resultsFilters) {
        resultsFilters.style.display = 'none';
    }
    searchTitle.textContent = 'Search movies and shows';
    resultsGrid.innerHTML = '<div class="tmdb-search-message">Enter a title from the home page to start searching.</div>';
} else {
    if (resultsFilters) {
        resultsFilters.style.display = 'none';
    }
    searchTitle.textContent = 'Results for "' + query + '"';
    loadResults(currentPage);
}

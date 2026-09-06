const TMDB_CONFIG = {
    apiKey: '64672e64858d59449d385e4df7e296d1',
    baseUrl: 'https://api.themoviedb.org/3'
};

const tmdbImageBaseUrl = 'https://image.tmdb.org/t/p/w342';
const query = new URLSearchParams(window.location.search).get('q') || '';
const resultsGrid = document.getElementById('results-grid');
const searchTitle = document.getElementById('search-title');

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
        return (result.media_type === 'movie' || result.media_type === 'tv') && result.poster_path;
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

        return '<a class="tmdb-result" href="https://www.themoviedb.org/' + result.media_type + '/' + result.id + '" target="_blank" rel="noopener noreferrer">' +
            '<img src="' + tmdbImageBaseUrl + result.poster_path + '" alt="' + escapeHtml(title) + ' poster">' +
            '<span class="tmdb-result-content"><strong>' + escapeHtml(title) + '</strong><small>' + type + ' &middot; ' + (date ? date.slice(0, 4) : 'Unknown year') + ' &middot; ' + rating + '/10</small></span>' +
            '</a>';
    }).join('');
}

if (!query) {
    searchTitle.textContent = 'Search movies and shows';
    resultsGrid.innerHTML = '<div class="tmdb-search-message">Enter a title from the home page to start searching.</div>';
} else {
    searchTitle.textContent = 'Results for "' + query + '"';
    fetch(TMDB_CONFIG.baseUrl + '/search/multi?api_key=' + encodeURIComponent(TMDB_CONFIG.apiKey) + '&language=en-US&include_adult=false&query=' + encodeURIComponent(query))
        .then(function(response) {
            if (!response.ok) {
                throw new Error('TMDB request failed');
            }
            return response.json();
        })
        .then(function(data) {
            renderResults(data.results || []);
        })
        .catch(function() {
            resultsGrid.innerHTML = '<div class="tmdb-search-message">TMDB is unavailable right now. Please try again.</div>';
        });
}

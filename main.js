const TMDB_CONFIG = {
    apiKey: '64672e64858d59449d385e4df7e296d1',
    baseUrl: 'https://api.themoviedb.org/3'
};

const VIDKING_CONFIG = {
    baseUrl: 'https://www.vidking.net/embed',
    color: 'e50914'
};

const CINESRC_CONFIG = {
    baseUrl: 'https://cinesrc.st/embed'
};

const TVMAZE_CONFIG = {
    baseUrl: 'https://api.tvmaze.com'
};

(function (jQuery){
    "use strict";
    jQuery(document).ready(function(){
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('./sw.js').catch(function() {});
        }

        const tmdbImageBaseUrl = 'https://image.tmdb.org/t/p/w342';

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

        function resultTitle(result) {
            return result.title || result.name || 'Untitled';
        }

        function resultYear(result) {
            var date = result.release_date || result.first_air_date || '';
            return date ? date.slice(0, 4) : 'Unknown year';
        }

        function stripHtml(value) {
            return String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        }

        function mapTvMazeShowToTmdbShape(show) {
            if (!show) {
                return null;
            }

            var embedded = show._embedded || {};
            var seasons = Array.isArray(embedded.seasons) ? embedded.seasons.map(function(season) {
                return {
                    season_number: season.number,
                    name: season.name
                };
            }) : [];

            return {
                media_type: 'tv',
                id: show.id,
                title: show.name,
                name: show.name,
                poster_path: show.image && show.image.original ? show.image.original : '',
                backdrop_path: show.image && show.image.original ? show.image.original : '',
                overview: stripHtml(show.summary || ''),
                first_air_date: show.premiered || '',
                vote_average: show.rating && show.rating.average ? Number(show.rating.average) : 0,
                number_of_seasons: show.ended ? Math.max((show._embedded && show._embedded.seasons ? show._embedded.seasons.length : 0), 1) : (show._embedded && show._embedded.seasons ? show._embedded.seasons.length : 1),
                genres: Array.isArray(show.genres) ? show.genres.map(function(genre) { return { name: genre }; }) : [],
                seasons: seasons,
                release_date: show.premiered || '',
                results: Array.isArray(embedded.episodes) ? embedded.episodes : []
            };
        }

        function fetchTvMazeShow(query) {
            if (!query) {
                return Promise.resolve(null);
            }

            return fetch(TVMAZE_CONFIG.baseUrl + '/search/shows?q=' + encodeURIComponent(query))
                .then(function(response) {
                    if (!response.ok) {
                        return null;
                    }
                    return response.json();
                })
                .then(function(results) {
                    var entry = (results || []).find(function(item) { return item && item.show; });
                    if (!entry || !entry.show) {
                        return null;
                    }
                    return entry.show;
                })
                .catch(function() {
                    return null;
                });
        }

        function fetchTvMazeCast(query) {
            if (!query) {
                return Promise.resolve([]);
            }

            return fetchTvMazeShow(query)
                .then(function(show) {
                    if (!show || !show.id) {
                        return [];
                    }

                    return fetch(TVMAZE_CONFIG.baseUrl + '/shows/' + show.id + '?embed[]=cast&embed[]=seasons')
                        .then(function(response) {
                            if (!response.ok) {
                                return [];
                            }
                            return response.json();
                        })
                        .then(function(showDetails) {
                            var cast = (showDetails && showDetails._embedded && showDetails._embedded.cast) || [];
                            return cast.slice(0, 6).map(function(actor) {
                                return {
                                    name: actor && actor.person ? actor.person.name : 'Unknown actor'
                                };
                            });
                        });
                })
                .catch(function() {
                    return [];
                });
        }

        function renderSearchResults(resultsContainer, results, query) {
            var usableResults = results.filter(function(result) {
                return (result.media_type === 'movie' || result.media_type === 'tv') && result.poster_path;
            }).slice(0, 12);

            if (!usableResults.length) {
                resultsContainer.html('<div class="tmdb-search-message">No movies or shows found for <strong>' + escapeHtml(query) + '</strong>.</div>');
                return;
            }

            resultsContainer.html(usableResults.map(function(result) {
                var type = result.media_type === 'tv' ? 'TV show' : 'Movie';
                var tmdbUrl = 'https://www.themoviedb.org/' + result.media_type + '/' + result.id;
                var posterUrl = tmdbImageBaseUrl + result.poster_path;
                var rating = result.vote_average ? result.vote_average.toFixed(1) : 'N/A';

                return '<a class="tmdb-result" href="' + tmdbUrl + '" target="_blank" rel="noopener noreferrer">' +
                    '<img src="' + posterUrl + '" alt="' + escapeHtml(resultTitle(result)) + ' poster">' +
                    '<span class="tmdb-result-content">' +
                    '<strong>' + escapeHtml(resultTitle(result)) + '</strong>' +
                    '<small>' + type + ' &middot; ' + resultYear(result) + ' &middot; ' + rating + '/10</small>' +
                    '</span></a>';
            }).join(''));
        }

        function searchTmdb(query, resultsContainer) {
            resultsContainer.html('<div class="tmdb-search-message">Searching TMDB...</div>');

            var endpoint = TMDB_CONFIG.baseUrl + '/search/multi?api_key=' + encodeURIComponent(TMDB_CONFIG.apiKey) +
                '&language=en-US&include_adult=false&query=' + encodeURIComponent(query);

            fetch(endpoint)
                .then(function(response) {
                    if (!response.ok) {
                        throw new Error('TMDB request failed');
                    }
                    return response.json();
                })
                .then(function(data) {
                    renderSearchResults(resultsContainer, data.results || [], query);
                })
                .catch(function() {
                    resultsContainer.html('<div class="tmdb-search-message">TMDB is unavailable right now. Please try again.</div>');
                });
        }

        function setupTmdbSearch() {
            var resultsSection = jQuery('<section class="tmdb-results-section" aria-live="polite"><div class="tmdb-results-header"><h2>Search results</h2><button type="button" class="tmdb-results-close" aria-label="Close search results">&times;</button></div><div class="tmdb-results-grid"></div></section>');
            var resultsContainer = resultsSection.find('.tmdb-results-grid');
            jQuery('body').append(resultsSection);

            var searchModal = jQuery('<div class="tmdb-search-modal" aria-hidden="true"><div class="tmdb-search-dialog" role="dialog" aria-modal="true" aria-labelledby="tmdb-search-title"><div class="tmdb-search-modal-header"><h2 id="tmdb-search-title">Search</h2><div class="tmdb-search-modal-actions"><button type="button" class="tmdb-search-type" aria-label="Search content type">Movies &amp; TV Shows <i class="fa fa-chevron-down" aria-hidden="true"></i></button><button type="button" class="tmdb-search-close" aria-label="Close search">&times;</button></div></div><form class="tmdb-search-form"><div class="tmdb-search-field"><i class="fa fa-search" aria-hidden="true"></i><input type="search" class="tmdb-search-input" placeholder="Type here to search..." autocomplete="off"></div></form><div class="tmdb-live-results" aria-live="polite"></div></div></div>');
            var searchInput = searchModal.find('.tmdb-search-input');
            var liveResults = searchModal.find('.tmdb-live-results');
            var searchTimer;
            jQuery('body').append(searchModal);

            function closeSearchModal() {
                searchModal.removeClass('is-visible').attr('aria-hidden', 'true');
            }

            jQuery('.search-box').each(function() {
                jQuery(this).prev('.search-toggle').on('click', function(event) {
                    event.preventDefault();
                    event.stopPropagation();
                    searchModal.addClass('is-visible').attr('aria-hidden', 'false');
                    window.setTimeout(function() {
                        searchInput.trigger('focus');
                    }, 0);
                });
            });

            function searchAsYouType(query) {
                window.clearTimeout(searchTimer);
                if (query.length < 2) {
                    liveResults.empty();
                    return;
                }

                liveResults.html('<div class="tmdb-live-message">Searching...</div>');
                searchTimer = window.setTimeout(function() {
                    fetch(TMDB_CONFIG.baseUrl + '/search/multi?api_key=' + encodeURIComponent(TMDB_CONFIG.apiKey) + '&language=en-US&include_adult=false&query=' + encodeURIComponent(query))
                        .then(function(response) { return response.json(); })
                        .then(function(data) {
                            var matches = (data.results || []).filter(function(result) {
                                return (result.media_type === 'movie' || result.media_type === 'tv') && result.poster_path;
                            }).slice(0, 8);

                            if (!matches.length) {
                                liveResults.html('<div class="tmdb-live-message">No movies or shows found.</div>');
                                return;
                            }

                            liveResults.html(matches.map(function(result) {
                                var title = resultTitle(result);
                                var date = result.release_date || result.first_air_date || '';
                                var type = result.media_type === 'tv' ? 'TV show' : 'Movie';
                                return '<button type="button" class="tmdb-live-result" data-title="' + escapeHtml(title) + '"><img src="' + tmdbImageBaseUrl + result.poster_path + '" alt=""><span><strong>' + escapeHtml(title) + '</strong><small>' + type + ' &middot; ' + (date ? date.slice(0, 4) : 'New') + '</small></span></button>';
                            }).join(''));
                        })
                        .catch(function() {
                            liveResults.html('<div class="tmdb-live-message">Search is unavailable right now.</div>');
                        });
                }, 250);
            }

            searchInput.on('input', function() {
                searchAsYouType(searchInput.val().trim());
            });

            searchModal.on('click', '.tmdb-live-result', function() {
                var title = jQuery(this).attr('data-title');
                closeSearchModal();
                var titleLink = jQuery('<a href="search-results.html?q=' + encodeURIComponent(title) + '"></a>');
                jQuery('body').append(titleLink);
                titleLink.trigger('click');
                titleLink.remove();
            });

            searchModal.on('submit', '.tmdb-search-form', function(event) {
                event.preventDefault();
                var query = searchInput.val().trim();

                if (query) {
                    searchAsYouType(query);
                }
            });

            searchModal.on('click', function(event) {
                if (event.target === searchModal[0]) {
                    closeSearchModal();
                }
            });

            searchModal.on('click', '.tmdb-search-close', closeSearchModal);

            jQuery('.searchbox').on('submit', function(event) {
                event.preventDefault();
                var input = jQuery(this).find('.search-input');
                var query = input.val().trim();

                if (!query) {
                    input.trigger('focus');
                    return;
                }

                searchModal.addClass('is-visible').attr('aria-hidden', 'false');
                searchInput.val(query);
                searchAsYouType(query);
            });

            resultsSection.on('click', '.tmdb-results-close', function() {
                resultsSection.removeClass('is-visible');
            });

            jQuery(document).on('keydown', function(event) {
                if (event.key === 'Escape') {
                    resultsSection.removeClass('is-visible');
                    closeSearchModal();
                }
            });
        }

        setupTmdbSearch();

        var globalPlayerModal = null;
        var globalPlayerFrame = null;
        var lastPlaybackTitle = '';
        var currentPlayback = null;

        function closePlayer() {
            if (!globalPlayerFrame || !globalPlayerModal) {
                return;
            }

            try {
                if (document.fullscreenElement && typeof document.exitFullscreen === 'function') {
                    document.exitFullscreen();
                }
            } catch (error) {
                // ignore fullscreen exit errors
            }

            var detailIsOpen = jQuery('.title-detail-modal.is-visible').length > 0;
            globalPlayerFrame.attr('src', 'about:blank');
            globalPlayerModal.removeClass('is-visible').attr('aria-hidden', 'true');
            jQuery('.title-detail-modal').removeClass('is-playing');
            currentPlayback = null;

            if (lastPlaybackTitle && window.openTitleDetails && !detailIsOpen) {
                setTimeout(function() {
                    window.openTitleDetails(lastPlaybackTitle);
                    lastPlaybackTitle = '';
                }, 50);
            } else {
                lastPlaybackTitle = '';
            }
        }

        function openPlayer(sourceUrl) {
            if (!sourceUrl) {
                window.alert('The player could not be loaded right now.');
                return;
            }

            if (!globalPlayerFrame || !globalPlayerModal) {
                window.location.href = sourceUrl;
                return;
            }

            var isMobile = window.matchMedia && window.matchMedia('(max-width: 767px)').matches || window.innerWidth <= 767 || /Android|iPhone|iPad|iPod/i.test(window.navigator.userAgent);
            globalPlayerModal.css('z-index', '1003');
            globalPlayerModal.toggleClass('is-mobile-fullscreen', isMobile);
            globalPlayerFrame.attr('src', sourceUrl);
            globalPlayerModal.addClass('is-visible').attr('aria-hidden', 'false');

            if (isMobile) {
                try {
                    if (globalPlayerModal[0] && typeof globalPlayerModal[0].requestFullscreen === 'function') {
                        globalPlayerModal[0].requestFullscreen();
                    } else if (document.documentElement && typeof document.documentElement.requestFullscreen === 'function') {
                        document.documentElement.requestFullscreen();
                    }
                } catch (error) {
                    // ignore fullscreen request failures and keep the full-screen overlay fallback
                }
            }

            window.setTimeout(function() {
                var modalTop = globalPlayerModal.offset().top || 0;
                var currentScroll = jQuery(window).scrollTop() || 0;
                if (modalTop > currentScroll + 80) {
                    jQuery('html, body').stop(true, true).animate({ scrollTop: modalTop - 40 }, 300);
                }
            }, 80);
        }

        function buildPlayerUrl(provider, playback) {
            var playerUrl;

            if (provider === 'cinesrc') {
                playerUrl = CINESRC_CONFIG.baseUrl + '/' + playback.mediaType + '/' + playback.mediaId;
                var cinesrcParams = ['autonext=true', 'autoplay=true', 'quality=720'];
                if (playback.mediaType === 'tv') {
                    if (playback.season) {
                        cinesrcParams.push('s=' + encodeURIComponent(playback.season));
                    }
                    if (playback.episode) {
                        cinesrcParams.push('e=' + encodeURIComponent(playback.episode));
                    }
                }
                return playerUrl + '?' + cinesrcParams.join('&');
            }

            playerUrl = VIDKING_CONFIG.baseUrl + '/' + playback.mediaType + '/' + playback.mediaId;
            var vidkingParams = new URLSearchParams({
                color: VIDKING_CONFIG.color,
                autoPlay: 'true'
            });
            if (playback.mediaType === 'tv') {
                playerUrl += '/' + (playback.season || 1) + '/' + (playback.episode || 1);
                vidkingParams.set('nextEpisode', 'true');
                vidkingParams.set('episodeSelector', 'true');
            }
            return playerUrl + '?' + vidkingParams.toString();
        }

        function openMediaPlayback(mediaType, mediaId, title, season, episode, provider) {
            if (!mediaType || !mediaId) {
                window.alert('This title cannot be played right now.');
                return;
            }

            lastPlaybackTitle = (title || '').trim();
            currentPlayback = {
                mediaType: mediaType,
                mediaId: mediaId,
                season: season,
                episode: episode,
                provider: provider || 'cinesrc'
            };
            jQuery('.video-provider-button').removeClass('is-active');
            jQuery('.video-provider-button[data-provider="' + currentPlayback.provider + '"]').addClass('is-active');
            jQuery('.title-detail-trailer').attr('src', 'about:blank');
            openPlayer(buildPlayerUrl(currentPlayback.provider, currentPlayback));
        }

        function setupVideoPlayer() {
            var playerModal = jQuery('<div class="video-player-modal" aria-hidden="true"><div class="video-player-dialog" role="dialog" aria-modal="true"><div class="video-provider-switch"><button type="button" class="video-provider-button" data-provider="cinesrc">CineSrc</button><button type="button" class="video-provider-button" data-provider="vidking">VidKing</button></div><button type="button" class="video-player-close" aria-label="Close video">&times;</button><iframe class="video-player" title="Video player" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div></div>');
            globalPlayerModal = playerModal;
            globalPlayerFrame = playerModal.find('.video-player');
            jQuery('body').append(playerModal);

            playerModal.on('click', '.video-provider-button', function() {
                var provider = jQuery(this).attr('data-provider');
                if (!currentPlayback || currentPlayback.provider === provider) {
                    return;
                }
                currentPlayback.provider = provider;
                playerModal.find('.video-provider-button').removeClass('is-active');
                jQuery(this).addClass('is-active');
                openPlayer(buildPlayerUrl(provider, currentPlayback));
            });

            function findTrailer(videos) {
                return (videos || []).filter(function(video) {
                    return video.site === 'YouTube' && video.key && (video.type === 'Trailer' || video.type === 'Teaser');
                }).sort(function(first, second) {
                    return Number(second.official) - Number(first.official);
                })[0];
            }

            function showTrailer(video) {
                if (!video) {
                    window.alert('No YouTube trailer is available for this title yet.');
                    return;
                }

                lastPlaybackTitle = '';
                openPlayer('https://www.youtube.com/embed/' + encodeURIComponent(video.key) + '?autoplay=1&rel=0');
            }

            function loadTrailer(trigger) {
                var mediaType = trigger.attr('data-media-type');
                var mediaId = trigger.attr('data-media-id');
                var title = trigger.attr('data-title') || trigger.closest('.slide').find('.slider-text').first().text().trim();
                var detailsRequest;

                if (mediaId && mediaType) {
                    detailsRequest = fetch(TMDB_CONFIG.baseUrl + '/' + mediaType + '/' + mediaId + '/videos?api_key=' + encodeURIComponent(TMDB_CONFIG.apiKey) + '&language=en-US');
                } else {
                    detailsRequest = fetch(TMDB_CONFIG.baseUrl + '/search/movie?api_key=' + encodeURIComponent(TMDB_CONFIG.apiKey) + '&language=en-US&query=' + encodeURIComponent(title));
                }

                detailsRequest.then(function(response) {
                    if (!response.ok) {
                        throw new Error('TMDB request failed');
                    }
                    return response.json();
                }).then(function(data) {
                    if (mediaId && mediaType) {
                        showTrailer(findTrailer(data.results));
                        return;
                    }

                    var movie = (data.results || [])[0];
                    if (!movie) {
                        throw new Error('Movie not found');
                    }
                    return fetch(TMDB_CONFIG.baseUrl + '/movie/' + movie.id + '/videos?api_key=' + encodeURIComponent(TMDB_CONFIG.apiKey) + '&language=en-US');
                        
                }).then(function(data) {
                    if (data) {
                        showTrailer(findTrailer(data.results));
                    }
                }).catch(function() {
                    window.alert('The trailer could not be loaded right now.');
                });
            }

            jQuery(document).on('click', '.video-open', function(event) {
                event.preventDefault();
                loadTrailer(jQuery(this));
            });

            playerModal.on('click', function(event) {
                if (event.target === playerModal[0]) {
                    closePlayer();
                }
            });
            playerModal.on('click', '.video-player-close', closePlayer);
            jQuery(document).on('keydown', function(event) {
                if (event.key === 'Escape') {
                    closePlayer();
                }
            });
        }

        jQuery(document).on('click', '.direct-play', function(event) {
            event.preventDefault();
            openMediaPlayback(
                jQuery(this).attr('data-media-type'),
                jQuery(this).attr('data-media-id'),
                jQuery(this).attr('data-title') || ''
            );
        });

        function setupSiteLinks() {
            jQuery('#top-menu a').each(function() {
                var label = jQuery(this).text().trim().toLowerCase();
                var href = jQuery(this).attr('href');

                if (label === 'home') {
                    jQuery(this).attr('href', 'index.html#home');
                } else if (label === 'movies' || label === 'movie') {
                    href = 'search-results.html?type=movie&page=1';
                    jQuery(this).attr('href', href).off('click.categoryReload').on('click.categoryReload', function(event) {
                        event.preventDefault();
                        window.location.assign(href);
                    });
                } else if (label === 'shows' || label === 'tv shows' || label === 'tv' || label === 'series') {
                    href = 'search-results.html?type=tv&page=1';
                    jQuery(this).attr('href', href).off('click.categoryReload').on('click.categoryReload', function(event) {
                        event.preventDefault();
                        window.location.assign(href);
                    });
                }
            });

            jQuery('.block-description a, .trending-text').each(function() {
                var title = jQuery(this).text().trim();
                if (title) {
                    jQuery(this).attr('href', 'search-results.html?q=' + encodeURIComponent(title));
                }
            });

            jQuery('.hover-buttons .iq-button, .btn-link').each(function() {
                var card = jQuery(this).closest('.slide, .movie, li');
                var title = card.find('.slider-text, .movie-name, .block-description a, .trending-text').first().text().trim();
                if (title) {
                    jQuery(this).attr('href', 'search-results.html?q=' + encodeURIComponent(title));
                }
            });
        }

        function setupTitleDetails() {
            var detailModal = jQuery('<div class="title-detail-modal" aria-hidden="true"><div class="title-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="title-detail-heading"><button type="button" class="title-detail-close" aria-label="Close title details">&times;</button><div class="title-detail-content"><div class="title-detail-loading">Loading title details...</div></div></div></div>');
            var detailContent = detailModal.find('.title-detail-content');
            jQuery('body').append(detailModal);

            function closeDetails() {
                detailModal.removeClass('is-visible is-playing').attr('aria-hidden', 'true');
                window.history.replaceState({}, '', window.location.pathname);
            }

            function renderSeasonEpisodes(showId, seasonNumber, episodesContainer) {
                if (!showId || !seasonNumber) {
                    episodesContainer.html('<div class="title-detail-no-trailer">No season details available.</div>');
                    return;
                }

                fetch(TMDB_CONFIG.baseUrl + '/tv/' + showId + '/season/' + seasonNumber + '?api_key=' + encodeURIComponent(TMDB_CONFIG.apiKey) + '&language=en-US')
                    .then(function(response) {
                        if (!response.ok) { throw new Error('TMDB season request failed'); }
                        return response.json();
                    })
                    .then(function(seasonData) {
                        var episodes = seasonData.episodes || [];

                        if (!episodes.length) {
                            episodesContainer.html('<div class="title-detail-no-trailer">No episodes are available for this season yet.</div>');
                            return;
                        }

                        episodesContainer.html(episodes.slice(0, 12).map(function(episode) {
                            var airDate = episode.air_date || '';
                            var overview = episode.overview || 'Episode details are not available yet.';
                            var episodeSeason = episode.season_number || seasonNumber;
                            var episodeNumber = episode.episode_number || '';
                            var thumb = episode.still_path ? '<img src="https://image.tmdb.org/t/p/w300' + episode.still_path + '" alt="' + escapeHtml(episode.name || 'Episode thumbnail') + '" class="title-detail-episode-thumb">' : '<div class="title-detail-episode-thumb title-detail-episode-thumb-empty">E' + episodeNumber + '</div>';
                            return '<div class="title-detail-episode"><div class="title-detail-episode-visual"><div class="title-detail-episode-thumb-wrap">' + thumb + '<button type="button" class="title-detail-episode-play-overlay" data-media-type="tv" data-media-id="' + showId + '" data-season="' + episodeSeason + '" data-episode="' + episodeNumber + '" data-title="' + encodeURIComponent(episode.name || 'Episode ' + episodeNumber) + '" aria-label="Play episode"><i class="fa fa-play"></i></button></div></div><div class="title-detail-episode-body"><div class="title-detail-episode-header"><span class="title-detail-episode-index">E' + episodeNumber + '</span><strong>' + escapeHtml(episode.name || 'Episode ' + episodeNumber) + '</strong></div><div class="title-detail-episode-meta"><span>' + (airDate ? airDate.slice(0, 4) : 'New') + '</span><span>' + (episode.vote_average ? episode.vote_average.toFixed(1) : 'N/A') + '/10</span></div><p>' + escapeHtml(overview) + '</p><button type="button" class="title-detail-episode-play" data-media-type="tv" data-media-id="' + showId + '" data-season="' + episodeSeason + '" data-episode="' + episodeNumber + '" data-title="' + encodeURIComponent(episode.name || 'Episode ' + episodeNumber) + '"><i class="fa fa-play mr-2"></i>Play</button></div></div>';
                        }).join(''));
                    })
                    .catch(function() {
                        episodesContainer.html('<div class="title-detail-no-trailer">Episodes could not be loaded right now.</div>');
                    });
            }

            function renderDetails(result, details, videos, credits) {
                var title = result.title || result.name || 'Untitled';
                var date = result.release_date || result.first_air_date || '';
                var type = result.media_type === 'tv' ? 'TV show' : 'Movie';
                var isSeries = result.media_type === 'tv' || !!details.number_of_seasons;
                var backdrop = details.backdrop_path || result.backdrop_path;
                var backdropUrl = backdrop ? 'https://image.tmdb.org/t/p/original' + backdrop : '';
                var posterUrl = result.poster_path ? 'https://image.tmdb.org/t/p/w500' + result.poster_path : '';
                var genres = (details.genres || []).slice(0, 3).map(function(genre) { return genre.name; }).join(', ');
                var seasons = (details.seasons || []).filter(function(season) { return season.season_number && season.season_number > 0; });
                var defaultSeason = seasons.length ? seasons[0].season_number : 1;
                var seasonMarkup = isSeries ? '<div class="title-detail-series-panel"><div class="title-detail-series-header"><h2>Seasons & Episodes</h2></div><div class="title-detail-season-picker"><label for="title-detail-season-select">Season</label><select id="title-detail-season-select" class="title-detail-season-select" data-show-id="' + result.id + '">' + seasons.map(function(season) { return '<option value="' + season.season_number + '">Season ' + season.season_number + '</option>'; }).join('') + '</select></div><div class="title-detail-episodes" data-show-id="' + result.id + '" data-season="' + defaultSeason + '"></div></div>' : '';
                var castList = ((credits || []).length) ? (credits || []).slice(0, 6).map(function(actor) {
                    return '<span class="title-detail-cast-actor">' + escapeHtml(actor.name || 'Unknown actor') + '</span>';
                }).join('') : '';
                var castMarkup = castList ? '<div class="title-detail-cast"><div class="title-detail-cast-label">Cast</div><div class="title-detail-cast-list">' + castList + '</div></div>' : '';
                var mediaTypeKey = isSeries ? 'tv' : 'movie';
                var trailerButton = '<button type="button" class="title-detail-trailer-toggle" data-media-type="' + mediaTypeKey + '" data-media-id="' + result.id + '" data-title="' + encodeURIComponent(title) + '"><i class="fa fa-play-circle mr-2"></i>Trailer</button>';

                detailModal.find('.title-detail-dialog').css('background-image', backdropUrl ? 'url("' + backdropUrl + '")' : 'none').css('--title-detail-backdrop', backdropUrl ? 'url("' + backdropUrl + '")' : 'none');
                detailContent.html('<div class="title-detail-topbar"><a class="title-detail-topbar-brand" href="index.html">KIOKO</a><nav><a href="index.html#home">Home</a><a href="search-results.html?type=movie&page=1">Movies</a><a href="search-results.html?type=tv&page=1">TV Shows</a></nav></div><div class="title-detail-scrim"></div><div class="title-detail-body"><div class="title-detail-poster">' + (posterUrl ? '<img src="' + posterUrl + '" alt="' + escapeHtml(title) + ' poster">' : '') + '</div><div class="title-detail-copy"><h1 id="title-detail-heading">' + escapeHtml(title) + '</h1><div class="title-detail-meta"><span>' + type + '</span><span>' + (date ? date.slice(0, 4) : 'New') + '</span><span>' + (result.vote_average ? result.vote_average.toFixed(1) : 'N/A') + '/10</span><span>' + escapeHtml(genres || 'Drama, Entertainment') + '</span></div><p>' + escapeHtml(details.overview || result.overview || 'Discover more about this title.') + '</p><div class="title-detail-actions"><button type="button" class="btn btn-hover title-detail-play" data-media-type="' + mediaTypeKey + '" data-media-id="' + result.id + '" data-title="' + encodeURIComponent(title) + '"><i class="fa fa-play mr-2"></i>Play</button>' + trailerButton + '</div>' + castMarkup + '</div></div>' + seasonMarkup + '');

                if (isSeries && seasons.length) {
                    var episodesContainer = detailModal.find('.title-detail-episodes');
                    renderSeasonEpisodes(result.id, defaultSeason, episodesContainer);
                }
            }

            function openDetails(query) {
                detailModal.addClass('is-visible').attr('aria-hidden', 'false');
                detailContent.html('<div class="title-detail-loading">Loading title details...</div>');

                window.history.replaceState({}, '', window.location.pathname + '?title=' + encodeURIComponent(query));

                if (query && query.toLowerCase().indexOf('tv') !== -1) {
                    // use TV Maze for TV show details when the title is clearly a series title
                }

                fetch(TMDB_CONFIG.baseUrl + '/search/multi?api_key=' + encodeURIComponent(TMDB_CONFIG.apiKey) + '&language=en-US&include_adult=false&query=' + encodeURIComponent(query))
                    .then(function(response) {
                        if (!response.ok) { throw new Error('TMDB request failed'); }
                        return response.json();
                    })
                    .then(function(data) {

            window.openTitleDetails = openDetails;
                        var result = (data.results || []).filter(function(item) {
                            return (item.media_type === 'movie' || item.media_type === 'tv');
                        })[0];
                        if (!result) {
                            return fetchTvMazeShow(query).then(function(tvMazeShow) {
                                if (!tvMazeShow) { throw new Error('Title not found'); }
                                return fetch(TVMAZE_CONFIG.baseUrl + '/shows/' + tvMazeShow.id + '?embed[]=cast&embed[]=seasons').then(function(response) {
                                    if (!response.ok) { throw new Error('TV Maze request failed'); }
                                    return response.json();
                                }).then(function(showDetails) {
                                    var mappedResult = mapTvMazeShowToTmdbShape(showDetails);
                                    var credits = (showDetails && showDetails._embedded && showDetails._embedded.cast) ? showDetails._embedded.cast.slice(0, 6).map(function(actor) {
                                        return { name: actor && actor.person ? actor.person.name : 'Unknown actor' };
                                    }) : [];
                                    renderDetails(mappedResult, mappedResult, [], credits);
                                });
                            });
                        }

                        var mediaType = result.media_type;
                        var detailRequests = [
                            fetch(TMDB_CONFIG.baseUrl + '/' + mediaType + '/' + result.id + '?api_key=' + encodeURIComponent(TMDB_CONFIG.apiKey) + '&language=en-US').then(function(response) { return response.json(); }),
                            fetch(TMDB_CONFIG.baseUrl + '/' + mediaType + '/' + result.id + '/videos?api_key=' + encodeURIComponent(TMDB_CONFIG.apiKey) + '&language=en-US').then(function(response) { return response.json(); })
                        ];

                        if (mediaType === 'movie' || mediaType === 'tv') {
                            detailRequests.push(
                                fetch(TMDB_CONFIG.baseUrl + '/' + mediaType + '/' + result.id + '/credits?api_key=' + encodeURIComponent(TMDB_CONFIG.apiKey) + '&language=en-US').then(function(response) { return response.json(); })
                            );
                        }

                        if (mediaType === 'tv') {
                            return Promise.all(detailRequests).then(function(data) {
                                var tmdbDetails = data[0] || {};
                                var tmdbCredits = (data[2] && data[2].cast) ? data[2].cast : [];
                                var credits = tmdbCredits.slice(0, 6);
                                var shouldUseTvMazeFallback = !(tmdbDetails.seasons && tmdbDetails.seasons.length) || credits.length === 0;

                                if (!shouldUseTvMazeFallback) {
                                    renderDetails(result, tmdbDetails, data[1].results, credits);
                                    return;
                                }

                                return fetchTvMazeShow(result.name || result.title).then(function(show) {
                                    if (!show || !show.id) {
                                        renderDetails(result, tmdbDetails, data[1].results, credits);
                                        return;
                                    }

                                    return fetch(TVMAZE_CONFIG.baseUrl + '/shows/' + show.id + '?embed[]=cast&embed[]=seasons').then(function(response) {
                                        if (!response.ok) {
                                            renderDetails(result, tmdbDetails, data[1].results, credits);
                                            return;
                                        }
                                        return response.json();
                                    }).then(function(showDetails) {
                                        var tvMazeCredits = (showDetails && showDetails._embedded && showDetails._embedded.cast) ? showDetails._embedded.cast.slice(0, 6).map(function(actor) {
                                            return { name: actor && actor.person ? actor.person.name : 'Unknown actor' };
                                        }) : [];
                                        var mappedResult = mapTvMazeShowToTmdbShape(showDetails || show);
                                        var combinedCredits = credits.length ? credits : tvMazeCredits;

                                        if (mappedResult && (!(tmdbDetails.seasons && tmdbDetails.seasons.length) || credits.length === 0)) {
                                            renderDetails(mappedResult, mappedResult, [], combinedCredits);
                                            return;
                                        }

                                        renderDetails(result, tmdbDetails, data[1].results, combinedCredits);
                                    }).catch(function() {
                                        renderDetails(result, tmdbDetails, data[1].results, credits);
                                    });
                                }).catch(function() {
                                    renderDetails(result, tmdbDetails, data[1].results, credits);
                                });
                            });
                        }

                        return Promise.all(detailRequests).then(function(data) {
                            var credits = (data[2] && data[2].cast) ? data[2].cast : [];
                            renderDetails(result, data[0], data[1].results, credits);
                        });
                    })
                    .catch(function() {
                        detailContent.html('<div class="title-detail-loading">This title could not be loaded right now.</div>');
                    });
            }
            window.openTitleDetails = openDetails;

            jQuery(document).on('click', 'a[href^="search-results.html?q="]:not(#top-menu a)', function(event) {
                event.preventDefault();
                openDetails(decodeURIComponent(jQuery(this).attr('href').split('q=')[1] || ''));
            });
            detailModal.on('click', '.title-detail-close', closeDetails);
            detailModal.on('click', function(event) {
                if (event.target === detailModal[0]) { closeDetails(); }
            });
            jQuery(document).on('keydown', function(event) {
                if (event.key === 'Escape') { closeDetails(); }
            });

            function openTrailerFromDetails(trigger) {
                var mediaType = trigger.attr('data-media-type');
                var mediaId = trigger.attr('data-media-id');
                var title = decodeURIComponent(trigger.attr('data-title') || '');

                if (!mediaType || !mediaId) {
                    return;
                }

                fetch(TMDB_CONFIG.baseUrl + '/' + mediaType + '/' + mediaId + '/videos?api_key=' + encodeURIComponent(TMDB_CONFIG.apiKey) + '&language=en-US')
                    .then(function(response) {
                        if (!response.ok) {
                            throw new Error('TMDB trailer fetch failed');
                        }
                        return response.json();
                    })
                    .then(function(data) {
                        var trailer = (data && data.results || []).filter(function(video) {
                            return video.site === 'YouTube' && video.key && (video.type === 'Trailer' || video.type === 'Teaser');
                        }).sort(function(first, second) {
                            return Number(second.official) - Number(first.official);
                        })[0];

                        if (!trailer) {
                            window.alert('No trailer is available for this title yet.');
                            return;
                        }

                        lastPlaybackTitle = '';
                        openPlayer('https://www.youtube.com/embed/' + encodeURIComponent(trailer.key) + '?autoplay=1&rel=0');
                    })
                    .catch(function() {
                        window.alert('The trailer could not be loaded right now.');
                    });
            }

            detailModal.on('click', '.title-detail-play', function() {
                var mediaType = jQuery(this).attr('data-media-type');
                var mediaId = jQuery(this).attr('data-media-id');
                var title = decodeURIComponent(jQuery(this).attr('data-title') || '');
                openMediaPlayback(mediaType, mediaId, title);
            });

            detailModal.on('click', '.title-detail-trailer-toggle', function() {
                openTrailerFromDetails(jQuery(this));
            });

            detailModal.on('change', '.title-detail-season-select', function() {
                var showId = jQuery(this).attr('data-show-id');
                var seasonNumber = jQuery(this).val();
                var episodesContainer = detailModal.find('.title-detail-episodes');
                renderSeasonEpisodes(showId, seasonNumber, episodesContainer);
            });

            detailModal.on('click', '.title-detail-episode-play, .title-detail-episode-play-overlay', function() {
                var mediaType = jQuery(this).attr('data-media-type');
                var mediaId = jQuery(this).attr('data-media-id');
                var title = decodeURIComponent(jQuery(this).attr('data-title') || '');
                var season = jQuery(this).attr('data-season');
                var episode = jQuery(this).attr('data-episode');
                openMediaPlayback(mediaType, mediaId, title, season, episode);
            });
        }

        function setupTopPicks() {
            var picksSlider = jQuery('#iq-favorites .favorites-slider');
            if (!picksSlider.length) {
                return;
            }

            picksSlider.html('<li class="slide-item tmdb-picks-loading"><div class="tmdb-search-message">Loading movies and shows...</div></li>');

            fetch(TMDB_CONFIG.baseUrl + '/trending/all/week?api_key=' + encodeURIComponent(TMDB_CONFIG.apiKey) + '&language=en-US')
                .then(function(response) {
                    if (!response.ok) {
                        throw new Error('TMDB request failed');
                    }
                    return response.json();
                })
                .then(function(data) {
                    var results = (data.results || []).filter(function(result) {
                        return (result.media_type === 'movie' || result.media_type === 'tv') && result.poster_path;
                    }).slice(0, 12);

                    if (!results.length) {
                        throw new Error('No results');
                    }

                    picksSlider.html(results.map(function(result) {
                        var title = resultTitle(result);
                        var date = result.release_date || result.first_air_date || '';
                        var type = result.media_type === 'tv' ? 'TV show' : 'Movie';
                        var rating = result.vote_average ? result.vote_average.toFixed(1) : 'N/A';
                        var searchUrl = 'search-results.html?q=' + encodeURIComponent(title);

                        return '<li class="slide-item"><div class="block-images position-relative"><div class="img-box"><img src="' + tmdbImageBaseUrl + result.poster_path + '" class="img-fluid" alt="' + escapeHtml(title) + ' poster"></div><div class="block-description"><h6 class="iq-title"><a href="' + searchUrl + '">' + escapeHtml(title) + '</a></h6><div class="movie-time d-flex align-items-center my-2"><div class="badge badge-secondary p-1 mr-2">' + type + '</div><span class="text-white">' + (date ? date.slice(0, 4) : 'New') + ' &middot; ' + rating + '/10</span></div><div class="hover-buttons"><a href="#" data-media-type="' + result.media_type + '" data-media-id="' + result.id + '" data-title="' + escapeHtml(title) + '" class="btn btn-hover iq-button direct-play"><i class="fa fa-play mr-1"></i>Play</a><a href="' + searchUrl + '" class="btn btn-link">View Details</a></div></div></div></li>';
                    }).join(''));

                    picksSlider.slick({
                        dots: false,
                        arrows: true,
                        infinite: true,
                        speed: 300,
                        autoplay: false,
                        slidesToShow: 5,
                        slidesToScroll: 1,
                        nextArrow: '<a href="#" class="slick-arrow slick-next"><i class="fa fa-chevron-right"></i></a>',
                        prevArrow: '<a href="#" class="slick-arrow slick-prev"><i class="fa fa-chevron-left"></i></a>',
                        responsive: [
                            { breakpoint: 1200, settings: { slidesToShow: 4 } },
                            { breakpoint: 992, settings: { slidesToShow: 3 } },
                            { breakpoint: 576, settings: { slidesToShow: 2 } }
                        ]
                    });
                })
                .catch(function() {
                    picksSlider.html('<li class="slide-item"><div class="tmdb-search-message">Top picks are unavailable right now. Please try again.</div></li>');
                });
        }

        function setupPopularMovies() {
            var popularSlider = jQuery('#iq-upcoming-movie .favorites-slider');
            if (!popularSlider.length) {
                return;
            }

            popularSlider.html('<li class="slide-item tmdb-picks-loading"><div class="tmdb-search-message">Loading popular movies...</div></li>');

            fetch(TMDB_CONFIG.baseUrl + '/movie/popular?api_key=' + encodeURIComponent(TMDB_CONFIG.apiKey) + '&language=en-US&page=1')
                .then(function(response) {
                    if (!response.ok) {
                        throw new Error('TMDB request failed');
                    }
                    return response.json();
                })
                .then(function(data) {
                    var movies = (data.results || []).filter(function(movie) {
                        return movie.poster_path;
                    }).slice(0, 12);

                    if (!movies.length) {
                        throw new Error('No movies found');
                    }

                    popularSlider.html(movies.map(function(movie) {
                        var title = movie.title || 'Untitled';
                        var releaseDate = movie.release_date || '';
                        var rating = movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A';
                        var searchUrl = 'search-results.html?q=' + encodeURIComponent(title);

                        return '<li class="slide-item"><div class="block-images position-relative"><div class="img-box"><img src="' + tmdbImageBaseUrl + movie.poster_path + '" class="img-fluid" alt="' + escapeHtml(title) + ' poster"></div><div class="block-description"><h6 class="iq-title"><a href="' + searchUrl + '">' + escapeHtml(title) + '</a></h6><div class="movie-time d-flex align-items-center my-2"><div class="badge badge-secondary p-1 mr-2">Movie</div><span class="text-white">' + (releaseDate ? releaseDate.slice(0, 4) : 'New') + ' &middot; ' + rating + '/10</span></div><div class="hover-buttons"><a href="#" data-media-type="movie" data-media-id="' + movie.id + '" data-title="' + escapeHtml(title) + '" class="btn btn-hover iq-button direct-play"><i class="fa fa-play mr-1"></i>Play</a><a href="' + searchUrl + '" class="btn btn-link">View Details</a></div></div></div></li>';
                    }).join(''));

                    popularSlider.slick({
                        dots: false,
                        arrows: true,
                        infinite: true,
                        speed: 300,
                        autoplay: false,
                        slidesToShow: 5,
                        slidesToScroll: 1,
                        nextArrow: '<a href="#" class="slick-arrow slick-next"><i class="fa fa-chevron-right"></i></a>',
                        prevArrow: '<a href="#" class="slick-arrow slick-prev"><i class="fa fa-chevron-left"></i></a>',
                        responsive: [
                            { breakpoint: 1200, settings: { slidesToShow: 4 } },
                            { breakpoint: 992, settings: { slidesToShow: 3 } },
                            { breakpoint: 576, settings: { slidesToShow: 2 } }
                        ]
                    });
                })
                .catch(function() {
                    popularSlider.html('<li class="slide-item"><div class="tmdb-search-message">Popular movies are unavailable right now. Please try again.</div></li>');
                });
        }

        function setupSuggestedMovies() {
            var suggestedSlider = jQuery('#iq-suggested-movies .favorites-slider');
            if (!suggestedSlider.length) {
                return;
            }

            suggestedSlider.html('<li class="slide-item tmdb-picks-loading"><div class="tmdb-search-message">Loading suggested movies and shows...</div></li>');

            fetch(TMDB_CONFIG.baseUrl + '/trending/all/week?api_key=' + encodeURIComponent(TMDB_CONFIG.apiKey) + '&language=en-US')
                .then(function(response) {
                    if (!response.ok) {
                        throw new Error('TMDB request failed');
                    }
                    return response.json();
                })
                .then(function(data) {
                    var suggestions = (data.results || []).filter(function(result) {
                        return (result.media_type === 'movie' || result.media_type === 'tv') && result.poster_path;
                    }).slice(0, 12);

                    if (!suggestions.length) {
                        throw new Error('No suggestions found');
                    }

                    suggestedSlider.html(suggestions.map(function(result) {
                        var title = resultTitle(result);
                        var date = result.release_date || result.first_air_date || '';
                        var type = result.media_type === 'tv' ? 'TV show' : 'Movie';
                        var rating = result.vote_average ? result.vote_average.toFixed(1) : 'N/A';
                        var searchUrl = 'search-results.html?q=' + encodeURIComponent(title);

                        return '<li class="slide-item"><div class="block-images position-relative"><div class="img-box"><img src="' + tmdbImageBaseUrl + result.poster_path + '" class="img-fluid" alt="' + escapeHtml(title) + ' poster"></div><div class="block-description"><h6 class="iq-title"><a href="' + searchUrl + '">' + escapeHtml(title) + '</a></h6><div class="movie-time d-flex align-items-center my-2"><div class="badge badge-secondary p-1 mr-2">' + type + '</div><span class="text-white">' + (date ? date.slice(0, 4) : 'New') + ' &middot; ' + rating + '/10</span></div><div class="hover-buttons"><a href="#" data-media-type="' + result.media_type + '" data-media-id="' + result.id + '" data-title="' + escapeHtml(title) + '" class="btn btn-hover iq-button direct-play"><i class="fa fa-play mr-1"></i>Play</a><a href="' + searchUrl + '" class="btn btn-link">View Details</a></div></div></div></li>';
                    }).join(''));

                    suggestedSlider.slick({
                        dots: false,
                        arrows: true,
                        infinite: true,
                        speed: 300,
                        autoplay: false,
                        slidesToShow: 5,
                        slidesToScroll: 1,
                        nextArrow: '<a href="#" class="slick-arrow slick-next"><i class="fa fa-chevron-right"></i></a>',
                        prevArrow: '<a href="#" class="slick-arrow slick-prev"><i class="fa fa-chevron-left"></i></a>',
                        responsive: [
                            { breakpoint: 1200, settings: { slidesToShow: 4 } },
                            { breakpoint: 992, settings: { slidesToShow: 3 } },
                            { breakpoint: 576, settings: { slidesToShow: 2 } }
                        ]
                    });
                })
                .catch(function() {
                    suggestedSlider.html('<li class="slide-item"><div class="tmdb-search-message">Suggested movies and shows are unavailable right now.</div></li>');
                });
        }

        function setupTrendingMovies() {
            var trendingSlider = jQuery('#top-ten-slider');
            var trendingNav = jQuery('#top-ten-slider-nav');
            if (!trendingSlider.length || !trendingNav.length) {
                return;
            }

            trendingSlider.empty();
            trendingNav.empty();

            fetch(TMDB_CONFIG.baseUrl + '/trending/movie/week?api_key=' + encodeURIComponent(TMDB_CONFIG.apiKey) + '&language=en-US')
                .then(function(response) {
                    if (!response.ok) {
                        throw new Error('TMDB request failed');
                    }
                    return response.json();
                })
                .then(function(data) {
                    var movies = (data.results || []).filter(function(movie) {
                        return movie.poster_path;
                    }).slice(0, 10);

                    if (!movies.length) {
                        throw new Error('No trending movies found');
                    }

                    if (trendingSlider.hasClass('slick-initialized')) {
                        trendingSlider.slick('unslick');
                    }
                    if (trendingNav.hasClass('slick-initialized')) {
                        trendingNav.slick('unslick');
                    }

                    trendingSlider.html(movies.map(function(movie) {
                        var title = movie.title || 'Untitled';
                        var searchUrl = 'search-results.html?q=' + encodeURIComponent(title);
                        return '<li class="slick-bg"><a href="' + searchUrl + '"><img src="' + tmdbImageBaseUrl + movie.poster_path + '" class="img-fluid w-100" alt="' + escapeHtml(title) + ' poster"><h6 class="iq-title">' + escapeHtml(title) + '</h6></a></li>';
                    }).join(''));

                    trendingNav.html(movies.map(function(movie) {
                        var title = movie.title || 'Untitled';
                        var releaseDate = movie.release_date || '';
                        var rating = movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A';
                        var searchUrl = 'search-results.html?q=' + encodeURIComponent(title);
                        return '<li><div class="block-images position-relative"><a href="' + searchUrl + '"><img src="' + tmdbImageBaseUrl + movie.poster_path + '" class="img-fluid w-100" alt="' + escapeHtml(title) + ' poster"></a><div class="block-description"><h5>' + escapeHtml(title) + '</h5><div class="movie-time d-flex align-items-center my-2"><div class="badge badge-secondary p-1 mr-2">Movie</div><span class="text-white">' + (releaseDate ? releaseDate.slice(0, 4) : 'New') + ' &middot; ' + rating + '/10</span></div><div class="hover-buttons"><a href="#" data-media-type="movie" data-media-id="' + movie.id + '" data-title="' + escapeHtml(title) + '" class="btn btn-hover direct-play" tabindex="0"><i class="fa fa-play mr-1" aria-hidden="true"></i>Play</a><a href="' + searchUrl + '" class="btn btn-link" tabindex="0">View Details</a></div></div></div></li>';
                    }).join(''));

                    trendingSlider.slick({
                        slidesToScroll: 1,
                        slidesToShow: 1,
                        arrows: false,
                        fade: true,
                        asNavFor: '#top-ten-slider-nav',
                        responsive: [{ breakpoint: 992, settings: { asNavFor: false, arrows: true, nextArrow: '<button class="NextArrow"><i class="fa fa-angle-right"></i></button>', prevArrow: '<button class="PrevArrow"><i class="fa fa-angle-left"></i></button>' } }]
                    });
                    trendingNav.slick({
                        slidesToShow: 3,
                        slidesToScroll: 1,
                        asNavFor: '#top-ten-slider',
                        dots: false,
                        arrows: true,
                        infinite: true,
                        vertical: true,
                        verticalSwiping: true,
                        centerMode: false,
                        nextArrow: '<button class="NextArrow"><i class="fa fa-angle-down"></i></button>',
                        prevArrow: '<button class="PrevArrow"><i class="fa fa-angle-up"></i></button>',
                        focusOnSelect: true,
                        responsive: [{ breakpoint: 1200, settings: { slidesToShow: 2 } }, { breakpoint: 600, settings: { asNavFor: false } }]
                    });
                })
                .catch(function() {
                    trendingSlider.prepend('<li class="tmdb-search-message">Trending movies are unavailable right now.</li>');
                });
        }

        function setupNowPlayingMovies() {
            var homeSlider = jQuery('#home-slider');
            if (!homeSlider.length) {
                return;
            }

            homeSlider.html('<div class="tmdb-search-message">Loading movies...</div>');

            fetch(TMDB_CONFIG.baseUrl + '/movie/now_playing?api_key=' + encodeURIComponent(TMDB_CONFIG.apiKey) + '&language=en-US&page=1')
                .then(function(response) {
                    if (!response.ok) {
                        throw new Error('TMDB request failed');
                    }
                    return response.json();
                })
                .then(function(data) {
                    var movies = (data.results || []).filter(function(movie) {
                        return movie.backdrop_path && movie.poster_path;
                    }).slice(0, 6);

                    if (!movies.length) {
                        throw new Error('No now-playing movies found');
                    }

                    if (homeSlider.hasClass('slick-initialized')) {
                        homeSlider.slick('unslick');
                    }

                    homeSlider.html(movies.map(function(movie) {
                        var title = movie.title || 'Untitled';
                        var releaseDate = movie.release_date || '';
                        var rating = movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A';
                        var searchUrl = 'search-results.html?q=' + encodeURIComponent(title);
                        var backdropUrl = 'https://image.tmdb.org/t/p/original' + movie.backdrop_path;
                        var overview = movie.overview || 'Discover this movie now playing in cinemas and streaming services.';

                        return '<div class="slide slick-bg" style="background-image: url(' + backdropUrl + ');"><div class="container-fluid position-relative h-100"><div class="slider-inner h-100"><div class="row align-items-center h--100"><div class="col-xl-6 col-lg-12 col-md-12"><div class="channel-logo" data-animation-in="fadeInLeft" data-delay-in="0.5"><img src="images/logo.png" class="c-logo" alt=""></div><h1 class="slider-text big-title title text-uppercase" data-animation-in="fadeInLeft" data-delay-in="0.6">' + escapeHtml(title) + '</h1><div class="d-flex flex-wrap align-items-center fadeInLeft animated" data-animation-in="fadeInLeft"><div class="slider-ratting d-flex align-items-center mr-4 mt-2 mt-md-3"><ul class="ratting-start p-0 m-0 list-inline text-primary d-flex align-items-center"><li><i class="fa fa-star"></i></li><li><i class="fa fa-star"></i></li><li><i class="fa fa-star"></i></li><li><i class="fa fa-star"></i></li><li><i class="fa fa-star-half-o"></i></li></ul><span class="text-white ml-2">' + rating + '/10</span></div><div class="d-flex align-items-center mt-2 mt-md-3"><span class="badge badge-secondary p-2">13+</span><span class="ml-3">' + (releaseDate ? releaseDate.slice(0, 4) : 'Now playing') + '</span></div></div><p data-animation-in="fadeInUp">' + escapeHtml(overview) + '</p><div class="d-flex align-items-center r-mb-23 mt-4" data-animation-in="fadeInUp"><a href="#" data-media-type="movie" data-media-id="' + movie.id + '" data-title="' + escapeHtml(title) + '" class="btn btn-hover iq-button direct-play"><i class="fa fa-play mr-3"></i>Play Now</a><a href="' + searchUrl + '" class="btn btn-link">View Details</a></div></div><div class="col-xl-5 col-lg-12 col-md-12 trailor-video"><a href="#" data-media-type="movie" data-media-id="' + movie.id + '" data-title="' + escapeHtml(title) + '" class="video-open playbtn"><img src="images/play.png" class="play" alt=""><span class="w-trailor">Watch Trailer</span></a></div></div></div></div></div>';
                    }).join(''));

                    homeSlider.slick({
                        autoplay: false,
                        speed: 800,
                        lazyLoad: 'progressive',
                        arrows: true,
                        dots: false,
                        prevArrow: '<div class="slick-nav prev-arrow"><i class="fa fa-chevron-right"></i></div>',
                        nextArrow: '<div class="slick-nav next-arrow"><i class="fa fa-chevron-left"></i></div>',
                        responsive: [{ breakpoint: 992, settings: { dots: true, arrows: false } }]
                    }).slickAnimation();
                    document.body.classList.remove('tmdb-live-loading');
                })
                .catch(function() {
                    homeSlider.before('<div class="tmdb-search-message">New movies are unavailable right now.</div>');
                    document.body.classList.remove('tmdb-live-loading');
                });
        }

        function setupTrendingSection() {
            var trendingNav = jQuery('#trending-slider-nav');
            var trendingSlider = jQuery('#trending-slider');
            if (!trendingNav.length || !trendingSlider.length) {
                return;
            }

            trendingNav.empty();
            trendingSlider.empty();

            fetch(TMDB_CONFIG.baseUrl + '/trending/movie/week?api_key=' + encodeURIComponent(TMDB_CONFIG.apiKey) + '&language=en-US')
                .then(function(response) {
                    if (!response.ok) {
                        throw new Error('TMDB request failed');
                    }
                    return response.json();
                })
                .then(function(data) {
                    var movies = (data.results || []).filter(function(movie) {
                        return movie.poster_path && movie.backdrop_path;
                    }).slice(0, 6);

                    if (!movies.length) {
                        throw new Error('No trending movies found');
                    }

                    if (trendingNav.hasClass('slick-initialized')) {
                        trendingNav.slick('unslick');
                    }
                    if (trendingSlider.hasClass('slick-initialized')) {
                        trendingSlider.slick('unslick');
                    }

                    trendingNav.html(movies.map(function(movie) {
                        var title = movie.title || 'Untitled';
                        var searchUrl = 'search-results.html?q=' + encodeURIComponent(title);
                        return '<li><a href="' + searchUrl + '"><div class="movie-slick position-relative"><img src="' + tmdbImageBaseUrl + movie.poster_path + '" class="img-fluid" alt="' + escapeHtml(title) + ' poster"></div></a></li>';
                    }).join(''));

                    trendingSlider.html(movies.map(function(movie, index) {
                        var title = movie.title || 'Untitled';
                        var releaseDate = movie.release_date || '';
                        var rating = movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A';
                        var overview = movie.overview || 'Discover this trending movie from TMDB.';
                        var searchUrl = 'search-results.html?q=' + encodeURIComponent(title);
                        var backdropUrl = 'https://image.tmdb.org/t/p/original' + movie.backdrop_path;
                        var tabId = 'tmdb-trending-data-' + index;

                        return '<li><div class="tranding-block position-relative" style="background-image: url(' + backdropUrl + ');"><div class="trending-custom-tab"><div class="tab-title-info position-relative"><ul class="trending-pills d-flex nav nav-pills justify-content-center align-items-center text-center" role="tablist"><li class="nav-item"><a href="#' + tabId + '" class="nav-link active show" data-toggle="pill" role="tab">Overview</a></li><li class="nav-item"><a href="' + searchUrl + '" class="nav-link">Details</a></li></ul></div><div class="trending-content"><div id="' + tabId + '" class="overview-tab tab-pane fade active show"><div class="trending-info align-items-center w-100 animated fadeInUp"><a href="' + searchUrl + '" tabindex="0"><div class="res-logo"><div class="channel-logo"><img src="images/logo.png" class="c-logo" alt=""></div></div></a><h1 class="trending-text big-title text-uppercase">' + escapeHtml(title) + '</h1><div class="d-flex align-items-center text-white text-detail"><span class="badge badge-secondary p-3">Movie</span><span class="ml-3">' + (releaseDate ? releaseDate.slice(0, 4) : 'Now trending') + '</span><span class="trending-year">' + rating + '/10</span></div><div class="d-flex align-items-center series mb-4"><span class="text-gold">Trending this week</span></div><p class="trending-dec">' + escapeHtml(overview) + '</p><div class="p-btns"><div class="d-flex align-items-center p-0"><a href="' + searchUrl + '" class="btn btn-hover mr-2" tabindex="0"><i class="fa fa-search mr-2"></i>View Details</a><a href="#" data-media-type="movie" data-media-id="' + movie.id + '" data-title="' + escapeHtml(title) + '" class="btn btn-link video-open" tabindex="0"><i class="fa fa-play mr-2"></i>Watch Trailer</a></div></div></div></div></div></div></div></li>';
                    }).join(''));

                    trendingSlider.slick({
                        slidesToShow: 1,
                        slidesToScroll: 1,
                        arrows: false,
                        fade: true,
                        draggable: false,
                        asNavFor: '#trending-slider-nav'
                    });
                    trendingNav.slick({
                        slidesToShow: 5,
                        slidesToScroll: 1,
                        asNavFor: '#trending-slider',
                        dots: false,
                        arrows: true,
                        nextArrow: '<a href="#" class="slick-arrow slick-next"><i class="fa fa-chevron-right"></i></a>',
                        prevArrow: '<a href="#" class="slick-arrow slick-prev"><i class="fa fa-chevron-left"></i></a>',
                        infinite: true,
                        centerMode: true,
                        centerPadding: 0,
                        focusOnSelect: true,
                        responsive: [{ breakpoint: 1024, settings: { slidesToShow: 2, slidesToScroll: 1 } }, { breakpoint: 600, settings: { slidesToShow: 1, slidesToScroll: 1 } }]
                    });
                })
                .catch(function() {
                    trendingSlider.before('<div class="tmdb-search-message">Trending movies are unavailable right now.</div>');
                });
        }

        setupVideoPlayer();
        setupSiteLinks();
        setupTitleDetails();
        var requestedTitle = new URLSearchParams(window.location.search).get('title');
        if (requestedTitle && window.openTitleDetails) {
            window.openTitleDetails(requestedTitle);
        }
        setupTopPicks();
        setupPopularMovies();
        setupSuggestedMovies();
        setupTrendingMovies();
        setupNowPlayingMovies();
        setupTrendingSection();

        function activaTav(pill){
            jQuery(pill).addClass('active show');
        }

        // sticky header anmation and height 
        function headerHeight(){
            var height = jQuery("#main-header").height();
            jQuery('.iq-height').css('height',height + 'px');
        }

        jQuery(function(){
            var header = jQuery("#main-header"),
            yOffset = 0,
            triggerPoint = 80;
            headerHeight();
            jQuery(window).resize(headerHeight);
            jQuery(window).on('scroll', function() {
                yOffset = jQuery(window).scrollTop();

                if(yOffset >= triggerPoint){
                    header.addClass("menu-sticky animated slideDown");
                } else {
                    header.removeClass("menu-sticky animated slideDown");
                }
            });
        });

        // header menu dropdown 
        jQuery('[data-toggle=more-toggle]').on('click', function () {
            jQuery(this).next().toggleClass('show');
        });

        jQuery(document).on('click', function(e){
            let myTargetElement = e.target;
            let selector, mainElement;
            if(jQuery(myTargetElement).hasClass('search-toggle') || jQuery(myTargetElement).parent().hasClass('search-toggle') || jQuery(myTargetElement).parent().parent().hasClass('search-toggle') ){
                if(jQuery(myTargetElement).hasClass('search-toggle')) {
                    selector = jQuery(myTargetElement).parent();
                    mainElement = jQuery(myTargetElement);
                } else if (jQuery(myTargetElement).parent().hasClass('search-toggle')){
                    selector = jQuery(myTargetElement).parent().parent();
                    mainElement = jQuery(myTargetElement).parent();
                }else if (jQuery(myTargetElement).parent().parent().hasClass('search-toggle')){
                    selector = jQuery(myTargetElement).parent().parent().parent();
                    mainElement = jQuery(myTargetElement).parent().parent();
                }
                if(!mainElement.hasClass('active') && jQuery('.navbar-list li').find('.active')){
                    jQuery('.navbar-right li').removeClass('.iq-show');
                    jQuery('.navbar-right li .search-toggle').removeClass('active');
                }

                selector.toggleClass('iq-show');
                mainElement.toggleClass('active');
                e.preventDefault();
            } else if (jQuery(myTargetElement).is('search-input')){} else {
                jQuery('.navbar-right li').removeClass('.iq-show');
                jQuery('.navbar-right li .search-toggle').removeClass('active');
            }
        });
        jQuery(document).on('click', function(event){
            var $trigger = jQuery(".main-header .navbar");
            if($trigger !== event.target && !$trigger.has(event.target).length){
                jQuery(".main-header .navbar-collapse").collapse('hide');
                jQuery('body').removeClass('nav-open');
            }
        });
        jQuery('.c-toggler').on("click", function(){
            jQuery('body').addClass('nav-open');
        });


        if (false) {
        $('#home-slider').slick({
            autoplay : false,
            speed : 800,
            lazyload : 'progressive',
            arrows : true,
            dots : false,
            prevArrow : '<div class="slick-nav prev-arrow"><i class="fa fa-chevron-right"></i></div>',
            nextArrow : '<div class="slick-nav next-arrow"><i class="fa fa-chevron-left"></i></div>',
            responsive : [
                {
                    breakpoint : 992,
                    settings : {
                        dots : true,
                        arrows : false,
                    }
                }
            ]
        }).slickAnimation();
        $(".slick-nav").on("click touch", function (e){
            e.preventDefault();

            var arrow = $(this);

            if(!arrow.hasClass('animate')){
                arrow.addClass('animate');
                setTimeout(() => {
                    arrow.removeClass('animate');
                }, 1600);
            }
        });

        jQuery('#top-ten-slider').slick({
            slidesToScroll : 1,
            slidesToShow : 1,
            arrows : false,
            fade : true,
            asNavFor : '#top-ten-slider-nav',
            responsive : [
                {
                    breakpoint : 992,
                    settings : {
                        asNavFor : false,
                        arrows : true ,
                        nextArrow : '<button class="NextArrow"><i class="fa fa-angle-right"></i></button>',
                        prevArrow : '<button class="PrevArrow"><i class="fa fa-angle-left"></i></button>',
                    }
                }
            ]
        });
        jQuery('#top-ten-slider-nav').slick({
            slidesToShow : 3,
            slidesToScroll : 1,
            asNavFor : '#top-ten-slider',
            dots: false,
            arrows : true,
            infinite : true,
            vertical : true,
            verticalSwiping : true,
            centerMode :false,
            nextArrow : '<button class="NextArrow"><i class="fa fa-angle-down"></i></button>',
            prevArrow : '<button class="PrevArrow"><i class="fa fa-angle-up"></i></button>',
            focusOnSelect : true,
            responsive : [
                {
                    breakpoint : 1200,
                    settings : {
                        slidesToShow : 2,
                    }
                },
                {
                    breakpoint : 600,
                    settings : {
                        asNavFor : false,
                    }
                },
            ]
        });
        

        jQuery("#trending-slider").slick({
            slidesToShow : 1,
            slidesToScroll : 1,
            arrows : false,
            fade : true,
            draggable : false,
            asNavFor : "#trending-slider-nav",
        });

        jQuery("#trending-slider-nav").slick({
            slidesToShow : 5,
            slidesToScroll : 1,
            asNavFor : "#trending-slider",
            dots : false ,
            arrows : true ,
            nextArrow: '<a href="#" class="slick-arrow slick-next"><i class="fa fa-chevron-right"></i></a>',
            prevArrow: '<a href="#" class="slick-arrow slick-prev"><i class="fa fa-chevron-left"></i></a>',
            infinite : true,
            centerMode : true,
            centerPadding : 0,
            focusOnSelect : true,
            responsive : [
                {
                    breakpoint : 1024,
                    settings : {
                        slidesToShow : 2,
                        slidesToScroll : 1,
                    }
                },
                {
                    breakpoint : 600,
                    settings : {
                        slidesToShow : 1,
                        slidesToScroll : 1,
                    }
                }
            ]
        });

        }

        jQuery('.episodes-slider1').owlCarousel({
            loop : true,
            margin : 20,
            nav: true,
            navText : ["<i class='fa fa-angle-left'></i>", "<i class='fa fa-angle-right'></i> "],
            dots : false,
            responsive : {
                0:{
                    items : 1
                },
                600: {
                    items : 1
                },
                1000 : {
                    items : 4
                }
            }
        });


        jQuery('.trending-content').each(function(){
            var highestBox = 0;
            jQuery('.tab-pane', this).each(function(){
                if(jQuery(this).height() > highestBox){
                    highestBox = jQuery(this).height();
                }
            });
            jQuery('.tab-pane', this).height(highestBox);
        });

        if(jQuery('select').hasClass('season-select')){
            jQuery('select').select2({
                theme : 'bootstrap4',
                allowClear : false,
                width : 'resolve'
            });
        }
        



    });
})(jQuery);

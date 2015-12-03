(function() {
	var reviewsApp = angular.module('reviewsApp',['ngSanitize', 'ngRoute', 'ngAnimate', 'ui.bootstrap', 'wu.masonry']);

	reviewsApp.config(['$httpProvider', '$routeProvider', '$locationProvider', function ($httpProvider, $routeProvider, $locationProvider) {
	    delete $httpProvider.defaults.headers.common['X-Requested-With'];

	    $routeProvider.when('/feed/:id', {templateUrl: 'partials/feed.html', controller: 'FeedCtrl'})
	    			  .when('/', {templateUrl: 'partials/feed.html', controller: 'FeedCtrl'})
	    			  .otherwise({redirectTo: '/'});

	    // $locationProvider.html5Mode(true);
	}]);

	reviewsApp.factory('feedAjaxService', ['$http', function($http) {
		return {
			getFeedData: function(feedUrl) {
				return $http.jsonp("https://query.yahooapis.com/v1/public/yql?q=select%20*%20from%20feed%20where%20url%3D'" + encodeURI(feedUrl) + "'&format=json&diagnostics=true&callback=JSON_CALLBACK");
			}
		}
	}]);

	reviewsApp.factory('feedList', function() {
		var list = {};
		var settings = {
			feedSources: [
				{
				  name: "Pitchfork",
				  url: "http://pitchfork.com/rss/reviews/albums/",
				  seperator: ":",
				  canonical: "pitchfork",
				  ratings: true
				},
				{
				  name: "eMusic",
				  url: "http://www.emusic.com/reviews/feed/",
				  seperator: ",",
				  canonical: "emusic",
				  ratings: false
				},
				{
				  name: "NME",
				  url: "http://feeds2.feedburner.com/nme/SdML",
				  seperator: "-",
				  canonical: "nme",
				  ratings: false
				},
				{
				  name: "MetaCritic",
				  url: "http://www.metacritic.com/rss/music",
				  seperator: " by ",
				  canonical: "metacritic",
				  ratings: false
				},
				{
				  name: "Rolling Stone",
				  url: "http://www.rollingstone.com/siteServices/rss/albumReviews",
				  seperator: "***",
				  canonical: "rolling-stone",
				  ratings: false
				}				
  			],
			selectedFeedSource: {
				  name: "Pitchfork",
				  url: "http://pitchfork.com/rss/reviews/albums/",
				  seperator: ":",
				  canonical: "pitchfork",
				  ratings: true
			}
		};

		list.getSelectedFeed = function(canonical) {
			for (i = 0; i < settings.feedSources.length; i++) {
				if(settings.feedSources[i].canonical == canonical) {
					return settings.feedSources[i];
					break;
				}
			}
		}

		list.getUserOptions = function() {
			var options = window.localStorage.getItem("userOptions");
			return JSON.parse(options);
		}

		list.list = function() {
			return settings;
		}

		return list;
	});

	reviewsApp.controller("AppCtrl", ['$scope', 'feedList', function($scope, feedList) {
		$scope.playThisAlbum = [];
		$scope.thisAlbumsReview = [];
		$scope.panels = {player: {open: false}, review: {open: false}, settings: {open: false}};
		$scope.userOptions = feedList.getUserOptions();
	}]);

	reviewsApp.controller("FeedCtrl", ['$scope', '$http', '$sce', 'feedAjaxService', 'feedList', '$q', '$routeParams', function($scope, $http, $sce, feedAjaxService, feedList, $q, $routeParams) {

		//Check to see if the user has set a favorite feed. Use it if so. If not, use pitchfork as the default.
		if (!$routeParams.id) {
			if ($scope.userOptions) {$routeParams.id = $scope.userOptions.canonical}
			else {$routeParams.id = 'pitchfork';}
		}

		$scope.selectedFeed = feedList.getSelectedFeed($routeParams.id);
		//Store selected feed's data in here and make ajax call to grab RSS data
		$scope.selectedFeedData = [];
		feedAjaxService.getFeedData($scope.selectedFeed.url).then(function(data) {
			console.log(data);
			$scope.selectedFeedData = data.data.query.results.item;
			console.log($scope.selectedFeedData);
			$scope.populateFeed();
		});

		$scope.populateFeed = function() {
			angular.forEach($scope.selectedFeedData, function(review) {

				//Seperate album artist and title from the review's title
				var seperator = $scope.selectedFeed.seperator;
				var reviewTitle = review.title.split(seperator);
				review.albumArtist = reviewTitle[0];
				review.albumTitle = reviewTitle[1];

				//Get rid of characters to get better search results
				var sanitizedTitle = review.albumTitle ? review.albumTitle.replace(/['\!\?\(\)+]/gi, '') : '',
				sanitizedArtist = review.albumArtist ? review.albumArtist.replace(/['\!\?\(\)+]/gi, '') : '';

				//Get pitchfork album ratings with YQL...repurposed from lukecod.es
				//Scrapes review page for the score
			    function getAlbumScore() {
			        
			        //NME
			        // var query = encodeURIComponent('select content from html where url="' + review.link + '" and compat="html5" and xpath=\'//div[@id="main"]/div[@id="content"]/div[@itemprop="description"]/span[@id="rating"]/span[@itemprop="ratingValue"]\'')

			        // Create YQL query to get span containing score
			        var query = encodeURIComponent('select content from html where url="' + review.link + '" and compat="html5" and xpath=\'//div[@id="main"]/ul/li/div[@class="info"]/span\''),
			            
		            // JSONP url for YQL query
		            yqlurl = 'http://query.yahooapis.com/v1/public/yql?q=' + query + '&format=json&callback=JSON_CALLBACK';

		            $http.jsonp(yqlurl).success(function(data) {
		            	review.albumRating = data.query.results.span;
		            })
			 
			    };

				//Grab album cover art from Lastfm API
				var getAlbumCover =	$http.jsonp("http:" + "//ws.audioscrobbler.com/2.0/?method=album.getinfo&api_key=45c831736b907e7eeae80171259181a6&artist=" + encodeURIComponent(sanitizedArtist) + "&album=" + encodeURIComponent(sanitizedTitle) + "&autocorrect=1&format=json&callback=JSON_CALLBACK").then(function(lastfm) {
						if (lastfm.data.album) {
							review.albumCoverArtUrl = lastfm.data.album.image[3]['#text'] ? lastfm.data.album.image[3]['#text'] : 'images/no-cover-art.png';
						}
						else {review.albumCoverArtUrl = 'images/no-cover-art.png';}						
				});

				//Grab Spotify album URL (Spotify doesn't support JSONP)
				var getSpotifyUrl = $http.get("http:" + "//ws.spotify.com/search/1/album?q=" + encodeURIComponent(sanitizedArtist + " " + sanitizedTitle)).then(function(spotify) {
					review.spotifyLink = spotify.data.albums.length ? spotify.data.albums[0].href : false;

				});

				//Do a second pass of missing album covers
				$q.all([getAlbumCover, getSpotifyUrl]).then(function(){
					if ((review.albumCoverArtUrl == 'images/no-cover-art.png' || !review.albumCoverArtUrl) && review.spotifyLink) {
						$http.jsonp("http:" + "//embed.spotify.com/oembed/?url=" + review.spotifyLink + "&callback=JSON_CALLBACK").success(function(data) {
							review.albumCoverArtUrl = data.thumbnail_url;
						});
					}
				});

				//Get pitchfork album rating
				if($scope.selectedFeed.ratings) {
					getAlbumScore();
				};

			});
		}	

		//Set spotify url for iframe
		$scope.loadSpotifyPlayer = function($index, panel) {
			//Set clicked album as active spotify url
			$scope.playThisAlbum.spotifyEmbedUrl = $sce.trustAsResourceUrl("https://embed.spotify.com/?uri=" + $scope.selectedFeedData[$index].spotifyLink);
			//Open up the player menu
			$scope.panels.player.open = true;
			//Close review panel if open
			$scope.panels.review.open = false;
			$scope.panels.settings.open = false;
			//Set album data for player panel
			$scope.playThisAlbum.hasSelectedAlbum = true;
			$scope.populateSelectedAlbum($index, panel);
		}

		//Toggle review panel
		$scope.openReview = function($index, panel) {
			$scope.panels.player.open = false;
			$scope.panels.settings.open = false;

			$scope.panels.review.open = true;
			$scope.populateSelectedAlbum($index, panel);
		}

		//Save album data of last clicked album
		$scope.populateSelectedAlbum = function($index, panel) {
			var currentItem = $scope.selectedFeedData[$index];
			angular.extend(panel, currentItem);
		}

		//Close player panel & close review panel
		$scope.closeAllPanels = function() {
			angular.forEach($scope.panels, function(panel) {
					panel.open = false;
			});
		}

	}]);

	reviewsApp.controller("NavigationCtrl", ['$scope', 'feedAjaxService', 'feedList', '$location', '$timeout', function($scope, feedAjaxService, feedList, $location, $timeout) {
		
		//Get selected feed
		$scope.selectedFeed = $scope.userOptions ? $scope.userOptions : feedList.getSelectedFeed("pitchfork");
		$scope.$on('$routeChangeSuccess', function() {
			$scope.panels.settings.open = false;
			var route = $location.path().split('/')[2];
			if(route) {
				$scope.selectedFeed = feedList.getSelectedFeed(route);
			}
		});

		//Alerts that shows when selecting a default feed
		$scope.alerts = [];

		//Get entire feed list
		$scope.settings = feedList.list();

		$scope.togglePlayer = function() {
			$scope.panels.review.open = false;
			$scope.panels.settings.open = false;

			if ($scope.panels.player.open == false) {
				$scope.panels.player.open = true;
			}
			else {$scope.panels.player.open = false;};
			
		};

		$scope.toggleSettings = function() {
			$scope.panels.review.open = false;
			$scope.panels.player.open = false;

			if ($scope.panels.settings.open == false) {
				$scope.panels.settings.open = true;
			}
			else {$scope.panels.settings.open = false};
		};

		$scope.setAsFavorite = function(feedSource) {
			$scope.userOptions = feedSource;
			window.localStorage.setItem("userOptions", JSON.stringify($scope.userOptions));
			$scope.addAlert();
			console.log(feedSource);
		}

		$scope.addAlert = function() {
			var message = $scope.userOptions.name + " is set as your default feed!"
			$scope.alerts.push({msg: message});
			$timeout(function() {
				$scope.alerts.splice(0,1);
			}, 3000)
		}
		
	}]);

})();

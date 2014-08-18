var GloryPL = function(access_token, userId, limit, country){
  this.access_token = access_token;
  this.limit = limit || 5;
  this.country = country || 'GB';
  this.userId = userId;
  this.queue = [];
  this.parsed = [];
  this.playlist = [];
  this.baseAPI = 'https://api.spotify.com/v1';
  this.thresold = {
    popular: 50,
    unpopular: 40
  }
}

GloryPL.prototype = {
  init: function(keyword){
    var self = this;
    self.api('GET','/search?type=artist&q=' + encodeURI(keyword))
      .then(function(result){
        self.enqueueArtists(result.artists.items);
        self.run();
      });
  },
  enqueue: function(item){
    if(this.queue.indexOf(item) === -1 && this.parsed.indexOf(item) === -1){
      this.queue.push(item);
    }
    return this;
  },
  enqueueArtists: function(items){
    var self = this;
    items.forEach(function(item){
      if(Math.random() > 0.7){
        self.enqueue(item.id);
      }
    });
  },
  run: function(){
    var self = this;
    if( self.queue.length > 0 && self.playlist.length < self.limit ){
      self.parsed.unshift(self.queue.shift());
      self.parse(self.parsed[0])
        .then(self.populate.bind(self))
        .then(self.run.bind(self));
    }else{
      var playlist_name = 'Falling Stars - ' + new Date();
      self.api('POST','/users/' + self.userId + '/playlists', {
        name: playlist_name,
        public: false
      }).then(function(result){
        self.api('POST','/users/' + self.userId + '/playlists/' + result.id + '/tracks', 
          self.playlist.map(function(track){
            return track.uri;
          })
        ).then(function(){
          self.message('playlist', playlist_name);
        });
      });
    }
  },
  parse: function(item){
    var self = this;
    return new Promise(function(resolve, reject){
      self.api('GET','/artists/' + item + '/top-tracks?country=' + self.country)
        .then(function(result){
          self.message('artist', result);
          var tracks = result.tracks;
          var populars = tracks.filter(function(track){
            return track.popularity >= self.thresold.popular;
          });
          var unpopulars = tracks.filter(function(track){
            return track.popularity <= self.thresold.unpopular;
          });          
          if( populars.length + unpopulars.length === tracks.length && 
              populars.length === 1 ){
            self.message('track', populars[0]);
            self.playlist.push(populars.pop());
          }
          resolve(item);
        });
    });
  },
  populate: function(item){
    var self = this;
    return new Promise(function(resolve, reject){
      self.api('GET','/artists/' + item + '/related-artists')
        .then(function(result){
          self.enqueueArtists(result.artists);          
          resolve();
        });
    });
  },
  api: function(method, url, data){
    var self = this;
    return new Promise(function(resolve, reject){
      var httpRequest = new XMLHttpRequest()
      httpRequest.onreadystatechange = function(){
        if(httpRequest.readyState === 4){
          if(httpRequest.status < 300 && httpRequest.status > 199){
            resolve(httpRequest.responseText ? JSON.parse(httpRequest.responseText) : {});
          }else{
            alert('Ops error! Maybe no results found for the artist you searched');
            window.location.reload();
          }
        }
      };
      httpRequest.open(method, self.baseAPI + url);
      httpRequest.setRequestHeader('Authorization', 'Bearer ' + self.access_token);
      httpRequest.send(data ? JSON.stringify(data) : null);
    });
  },
  message: function(type, detail){
    document.dispatchEvent(
      new CustomEvent(type, {"detail": detail})
    );
  }
};
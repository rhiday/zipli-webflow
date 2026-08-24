(function () {
  var videos = document.querySelectorAll('.hero-bg-video');
  var fadeWindow = 1;

  videos.forEach(function (video) {
    video.addEventListener('timeupdate', function () {
      if (video.duration && video.duration - video.currentTime < fadeWindow) {
        video.style.opacity = 0;
      }
    });
    video.addEventListener('seeked', function () {
      if (video.currentTime < fadeWindow) {
        video.style.opacity = 1;
      }
    });
  });
})();

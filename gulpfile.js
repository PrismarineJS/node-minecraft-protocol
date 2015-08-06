var gulp = require('gulp');

var plumber = require('gulp-plumber');
var babel = require('gulp-babel');
var options = {
  stage: 0, // Dat ES7 goodness
  optional: ["runtime"]
};

var sourcemaps = require('gulp-sourcemaps');

gulp.task('compile', function() {
  return gulp
    .src('src/**/*.js')
    .pipe(plumber({
      errorHandler: function(err) {
        console.error(err.stack);
        this.emit('end');
      }
    }))
    .pipe(sourcemaps.init())
    .pipe(babel(options))
    .pipe(plumber.stop())
    .pipe(sourcemaps.write('maps/'))
    .pipe(gulp.dest('dist/'));
});

gulp.task('watch', function() {
  return gulp.watch('src/**/*.js', ['compile']);
});

gulp.task('default', ['compile']);

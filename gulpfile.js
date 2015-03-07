var gulp = require('gulp');

var babel   = require('gulp-babel');
var options = {
    experimental: true // Dat ES7 goodness
};

var sourcemaps = require('gulp-sourcemaps');

gulp.task('compile', function() {
    gulp
        .src('src/*.js')
        .pipe(sourcemaps.init())
        .pipe(babel(options))
        .pipe(sourcemaps.write('maps/'))
        .pipe(gulp.dest('dist/'));
});

gulp.task('watch', function() {
    gulp.watch('src/*.js', ['compile']);
});

gulp.task('default', ['compile']);

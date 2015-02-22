var gulp = require('gulp');

var babel   = require('gulp-babel');
var options = {
    experimental: true // Dat ES7 goodness
};

gulp.task('compile', function() {
    gulp
        .src('lib/*.js')
        .pipe(babel(options))
        .pipe(gulp.dest('build/'));
});

gulp.task('watch', function() {
    gulp.watch('lib/*.js', ['compile']);
});

gulp.task('default', ['compile']);

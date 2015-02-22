var gulp = require('gulp');

var babel   = require('gulp-babel');
var options = {
    experimental: true // Dat ES7 goodness
};

gulp.task('compile', function() {
    gulp
        .src('src/*.js')
        .pipe(babel(options))
        .pipe(gulp.dest('dist/'));
});

gulp.task('watch', function() {
    gulp.watch('src/*.js', ['compile']);
});

gulp.task('default', ['compile']);

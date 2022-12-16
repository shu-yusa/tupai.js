/**
 * @author <a href='bocelli.hu@gmail.com'>bocelli.hu</a>
 * @since tupai.js 0.1
 */
var fs = require('fs');
var path = require('path');
var tupai = require(__dirname);
var temp = require('temp');

function compileTemplate(url, output, packageName, options) {

    var data = fs.readFileSync(url);
    console.log('      ' + url);

    var needMinify = true;
    if(options && options.minify === false) {
        needMinify = false;
    }

    function compile(url, end) {
        var pargs = [
            path.join(tupai.baseDir, 'scripts', 'phantomjs', 'build_template.js'),
            url,
            output,
            packageName
        ];
        tupai.execute(tupai.getBinPath('phantomjs'), pargs, {
            onStdoutData: options.onStdoutData,
            onStderrData: options.onStderrData,
            end: function(code) {
                end && end(code, url);
            }
        });
    }

    if (needMinify) {
        var html = require('html-minifier').minify(data.toString(), {
            removeComments: true,
            collapseWhitespace: true,
            useShortDoctype: true
        });

        temp.open({suffix: '.html'}, function(err, info) {
            if(err) {
                console.log('an error occured:', err);
                return;
            }
            fs.writeSync(info.fd, html);
            fs.close(info.fd, function(err) {
                if(err) {
                    console.log('an error occured:', err);
                    return;
                }
                var tempUrl = info.path;
                compile(tempUrl, function(code) {
                    fs.unlinkSync(tempUrl);
                    options && options.end && options.end(code, url);
                });
            });
        });

    } else {
        compile(url, (options && options.end));
    }

}

function collectTemplates(dir, templates) {
    const files = fs.readdirSync(dir);
    files.forEach(function(f) {
        const filePath = path.join(dir, f);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            collectTemplates(filePath, templates)
        } else {
            if (f.endsWith('.html')) {
                templates.push(filePath);
            }
        }
    })
    return templates;
}

function compileTemplates(input, output) {
    return collectTemplates(input, []);
}

exports.compileTemplate = function(input, output, packageName, options) {
    require('mkdirp').sync(output);
    compileTemplate.apply(undefined, arguments);
};
exports.compileTemplates = function(input, output) {
    if(!fs.existsSync(input)) {
        console.error(input + ' is not exists.');
        process.exit(1);
    }
    require('mkdirp').sync(output);
    return compileTemplates.apply(undefined, arguments);
};


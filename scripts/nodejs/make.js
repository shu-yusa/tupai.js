/**
 * @author <a href='bocelli.hu@gmail.com'>bocelli.hu</a>
 * @since tupai.js 0.1
 */
var fs = require('fs');
var path = require('path');
var ejs = require('ejs');
var mkdirp = require('mkdirp').sync;
var tupai = require(__dirname);
const cluster = require("cluster");
const cpuNum = require('os').cpus().length;

exports.make = function(target, options) {
    const tupaiConfig = tupai.getConfig();
    const meOptions = {
        classPath: [
            tupaiConfig.sources,
            tupaiConfig.genTemplates,
            tupaiConfig.genConfigs
        ],
        output: path.join(tupaiConfig.gen, tupaiConfig.name + '.js')
    };
    const outputJs = path.join(tupaiConfig.web, 'js', tupaiConfig.name + '.js');
    const callBack = {
        onStdoutData: function(data) {
            //console.log("    " + data.toString().split('\n')[0]);
        },
        end: function(code) {
            console.log('INDEX:', process.env.processIndex);
            if (process.env.processIndex === '0') {
                if (code !== 0) {
                    console.error('gen template files fails');
                    return;
                }
                console.log('gen configs:');
                tupai.compileConfigSync(
                    tupaiConfig.configs,
                    tupaiConfig.genConfigs,
                    'Config'
                );
                console.log('consistency check: ');
                tupai.merge('check', meOptions, function(code) {
                    // merge classes to one file
                    if (code === 0) {
                        console.log('    ok');
                    } else {
                        console.error('    ng', code);
                        return;
                    }
                    console.log('merge classes: ');
                    tupai.merge('merge', meOptions, function() {
                        const inputJs = meOptions.output;
                        // copy it
                        console.log('copy: ');
                        console.log('    ' + inputJs + ' -> ' + outputJs);
                        fs.createReadStream(inputJs).pipe(fs.createWriteStream(outputJs));
                    });
                });
            }
        }
    };

    if (cluster.isWorker) {
        console.log("index:", process.env.processIndex);
        JSON.parse(process.env.templates).forEach((template) => {
            const packageName = template.replace(`${tupaiConfig.templates}/`, '').replace(/\.html$/, '').replace(/\//g, '.');
            tupai.compileTemplate(template, tupaiConfig.genTemplates, packageName, callBack);
        })
        return;
    }

    if(!tupai.isTupaiProjectDir()) {
        console.error('current dir is not a tupai project dir.');
        return undefined;
    }

    target = target || 'release';
    if(['debug', 'release', 'clean'].indexOf(target) < 0) {
        console.error('known target (' + target+')');
        process.exit(1);
    }

    var outputTupaiJs = path.join(tupaiConfig.web, 'js', 'tupai.min.js');
    if(target === 'clean') {
        console.log('unlink files:');

        [outputJs, outputTupaiJs].forEach(function(f) {
            console.log('    ' + f);
            if(fs.existsSync(f)) {
                fs.unlinkSync(f);
            }
        });

        console.log('    ' + tupaiConfig.gen);
        tupai.rmdirSync(tupaiConfig.gen);
        return;
    }

    if (!fs.existsSync(outputTupaiJs)) {
        const fileName = target === 'debug' ? 'tupai-last.js' : 'tupai-last.min.js';
        var tupaijs = path.join(__dirname, '..', '..', 'releases', 'web', fileName);
        console.log('copy tupai.js:');
        // fs.createReadStream(tupaijs).pipe(fs.createWriteStream(outputTupaiJs));
        fs.symlinkSync(tupaijs, outputTupaiJs, 'file');
        console.log('    ' + outputTupaiJs);
    }

    console.log('gen template files:');
    console.log('    ' + tupaiConfig.templates + ' -> ' + tupaiConfig.genTemplates);
    const templates = tupai.compileTemplates(tupaiConfig.templates, tupaiConfig.genTemplates, '', callBack);
    console.log(templates);

    options = callBack || {};
    options.end ||= (code, url) => {};
    options.end = (code, url) => {
        if(code !== 0) {
            options.end(0);
        }
        // processFile();
    }

    let parts = [];
    const p = Math.ceil(templates.length / cpuNum);
    for (let i = 0; i < cpuNum; i++) {
        parts[i] = templates.slice(p * i, Math.min(p * (i + 1), templates.length));
        cluster.fork({
            processIndex: i,
            templates: JSON.stringify(parts[i]),
        }).on("message", msg => console.log("HELLO"));
    }
}


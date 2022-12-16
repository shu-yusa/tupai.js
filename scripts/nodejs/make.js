/**
 * @author <a href='bocelli.hu@gmail.com'>bocelli.hu</a>
 * @since tupai.js 0.1
 */
const fs = require('fs');
const path = require('path');
const ejs = require('ejs');
const mkdirp = require('mkdirp').sync;
const tupai = require(__dirname);
const EventEmitter = require('events');

const postCompileCheck = (tupaiConfig, outputJs) => {
    const meOptions = {
        classPath: [
            tupaiConfig.sources,
            tupaiConfig.genTemplates,
            tupaiConfig.genConfigs
        ],
        output: path.join(tupaiConfig.gen, tupaiConfig.name + '.js')
    };
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
};

exports.make = function(target, options) {
    const tupaiConfig = tupai.getConfig();

    if (!tupai.isTupaiProjectDir()) {
        console.error('current dir is not a tupai project dir.');
        return undefined;
    }

    target = target || 'release';
    if(['debug', 'release', 'clean'].indexOf(target) < 0) {
        console.error('known target (' + target+')');
        process.exit(1);
    }

    const outputJs = path.join(tupaiConfig.web, 'js', tupaiConfig.name + '.js');
    const outputTupaiJs = path.join(tupaiConfig.web, 'js', 'tupai.min.js');
    if (target === 'clean') {
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
        const tupaiJs = path.join(__dirname, '..', '..', 'releases', 'web', fileName);
        console.log('copy tupai.js:');
        // fs.createReadStream(tupaiJs).pipe(fs.createWriteStream(outputTupaiJs));
        fs.symlinkSync(tupaiJs, outputTupaiJs, 'file');
        console.log('    ' + outputTupaiJs);
    }

    console.log('gen template files:');
    console.log('    ' + tupaiConfig.templates + ' -> ' + tupaiConfig.genTemplates);

    const templates = tupai.compileTemplates(tupaiConfig.templates, tupaiConfig.genTemplates);

    EventEmitter.setMaxListeners(templates.length);
    const FINISH_EVENT = 'finished';
    const eventEmitter = new EventEmitter();
    let counter = 0;
    eventEmitter.on(FINISH_EVENT, (code) => {
        if (code !== 0) {
            throw new Error("Failed to compile template");
        }
        counter += 1;
        if (counter === templates.length) {
            postCompileCheck(tupaiConfig, outputJs)
        }
    });
    templates.forEach((template) => {
        const packageName = template.replace(`${tupaiConfig.templates}/`, '').replace(/\.html$/, '').replace(/\//g, '.');
        tupai.compileTemplate(template, tupaiConfig.genTemplates, packageName, {
            onStdoutData: (data) => {},
            end: (code) => {
                eventEmitter.emit(FINISH_EVENT, code)
            }
        });
    })
}


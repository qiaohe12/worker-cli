'use strict'
const { Command } = require('commander')
const chalk = require('chalk')
const semver = require('semver')
const validateProjectName = require('validate-npm-package-name')
const path = require('path')
const fs = require('fs-extra')
const inquirer = require('inquirer')
const CFonts = require('cfonts')
const Metalsmith = require('metalsmith')
const Handlebars = require('handlebars')
const logSymbols = require('log-symbols')
const spawn = require('cross-spawn')
const packageJson = require('../../package.json')
const download = require('../download')
const CLI_NAME = 'worker'

const program = new Command(packageJson.name)
    .usage('<program-name>')
    .parse(process.argv)

const projectName = program.args[0]

if (typeof projectName === 'undefined') {
    console.error('Please specify the project directory:')
    console.log(
        `${chalk.cyan(CLI_NAME)} ${chalk.green('<project-directory>')}`
    )
    console.log()
    console.log('For example:')
    console.log(` ${chalk.cyan(CLI_NAME)} ${chalk.green('my-app')}`);
    process.exit(1)
}

const checkAppName = (appName: string) => {
    // 判断输入的项目名称是否符合npm包命名规范
    const validationResult = validateProjectName(appName)
    if (!validationResult) {
        console.error(
            chalk.red(
                `Cannot create a project named ${chalk.green(appName)} because of npm naming restrictions:\n`
            )
        );
        [
            ...(validationResult.errors || []),
            ...(validationResult.warnings || [])
        ].forEach(err => (
            console.error(chalk.red(` *${err}`))
        ))
        console.error(chalk.red('\nPlease choose a different project name.'))
        process.exit(1)
    }
    const dependendies = ['react', 'react-dom']
    if (dependendies.includes(appName)) {
        console.error(
            chalk.red(
                `Cannot create a project named ${chalk.green(appName)} because a dependency with a same name exists.`
            )
        )
        process.exit(1)
    }
}

const isSafeToCreateProjectIn = (root, name) => {
    // 文件夹下允许存在的文件
    const validFiles = [
        '.DS_Store',
        '.git',
        '.gitattributes',
        '.gitignore',
        '.gitlab-ci.yml',
        '.hg',
        '.hgcheck',
        '.hgignore',
        '.idea',
        '.npmignore',
        '.travis.yml',
        'docs',
        'LICENSE',
        'README.md',
        'mkdocs.yml',
        'Thumbs.db'
    ]
    const conflicts = fs.readdirSync(root).filter(file => !validFiles.includes(file))
    if (conflicts && conflicts.length) {
        console.log(`The directory ${chalk.green(name)} contains files that could conflict:`)
        console.log()
        for (const file of conflicts) {
            try {
                const stats = fs.lstatSync(path.join(root, file))
                if (stats.isDirectory()) {
                    console.log(` ${chalk.blue(`${file}/`)}`);
                } else {
                    console.log(` ${file}`)
                }
            } catch (e) {
                console.log(` ${file}`)
            }
        }
        console.log()
        console.log('Either try using a new directory name, or remove the files listed above.')
        process.exit(1)
    }
}
// package工具包
const downloadToolsApp = (projectName) => {
    download(projectName, 'tools-tpl').then(() => {
        console.log(chalk.green('恭喜，项目已经初始化完成'))
    }).catch( error => {
        console.error(error)
        console.error('模板下载失败，请重试')
    })
}

function removeDir(dir) {
    let files = fs.readdirSync(dir)
    for (var i = 0; i < files.length; i++) {
        let newPath = path.join(dir, files[i]);
        let stat = fs.statSync(newPath)
        if (stat.isDirectory()) {
            //如果是文件夹就递归下去
            removeDir(newPath);
        } else {
            //删除文件
            fs.unlinkSync(newPath);
        }
    }
    fs.rmdirSync(dir)//如果文件夹是空的，就将自己删除掉
}

function generator(context) {
    let metadata = context.data; // 用户自定义信息
    let src = context.downloadTemp; // 暂时存放文件目录
    let dest = `./${context.projectName}`; //项目的根目录

    if (!src) {
        return Promise.reject(new Error(`无效的source：${src}`))
    }

    return new Promise((resolve, reject) => {
        const metalsmith = Metalsmith(process.cwd())
            .metadata(metadata) // 将用户输入信息放入
            .clean(false)
            .source(src)
            .destination(dest);
        metalsmith.use((files, metalsmith, done) => {
            const meta = metalsmith.metadata()
            Object.keys(files).forEach(fileName => {
                if (fileName.split('.').pop() !== 'ico') {
                    const t = files[fileName].contents.toString()
                    files[fileName].contents = Buffer.from(Handlebars.compile(t)(meta), 'utf8')
                }
            })
            done()
        }).build(err => {
            err && console.log(err)
            removeDir(src);
            err ? reject(err) : resolve(context);
        })
    })
}

function install (projectName) {
    const currentPath = process.cwd()
    const command = 'npm'
    const args = ['install']
    const child = spawn(
        command,
        args,
        {
            stdio: 'inherit',
            cwd: path.join(currentPath,projectName)
        },
    )
    return new Promise((res, rej) => {
        child.on('close', code => {
            if (code !== 0) {
                console.error('安装失败')
                process.exit(1)
                rej({
                    command: `${command} ${args.join(' ')}`
                })
                return
            }
            res({ success: true })
        })
    })
}


// react 项目
const downloadTemplete = (projectName) => {
    inquirer.prompt([{
        name: 'projectName',
        message: '项目名称',
        default: projectName
    }, {
        name: 'projectDes',
        message: '项目描述',
        default: `A project named ${projectName}`
    }]).then(res => {
        return { data: res }
    }).then(context => {
        const { data } = context
        return download(projectName, 'react-tpl', '.download-temp').then(target => {
            return {
                projectName,
                downloadTemp: target,
                data
            }
        }).catch(err => console.error(err))
    }).then(context => {
        console.log('生成文件')
        // 删除临时文件夹，将文件移动到目标目录下
        return generator(context) // 插值处理
    }).then(context => {
        console.log(logSymbols.success, chalk.green('创建成功'))
        return inquirer.prompt([{
            name: 'install',
            message: '是否安装依赖',
            default: 'yes'
        }]).then(res => {
            let isInstall = res.install.toUpperCase()
            return {
                ...context,
                isInstall: isInstall === 'YES' || isInstall === 'Y'
            }
        })
    }).then(context => {
        if (context.isInstall) {
            return install(projectName)
        }
        return 
    }).then(() => {
        console.log(chalk.green('恭喜，项目已经初始化完成'))
        console.log()
        console.log('你可以执行以下命令运行开发环境')
        console.log()
        console.log(chalk.green(` cd ${projectName}       `));
        console.log(chalk.green(` npm start`));

    }).catch(err => {
        console.error('err')
        console.error(logSymbols.error, chalk.red(`创建失败：${err.message}`))
    })
}

const createApp = (projectName: string) => {
    // 判断node版本，版本过低则提示用户并退出程序
    const unsupportedNodeVersion = !semver.satisfies(process.version, '>=10')
    if (unsupportedNodeVersion) {
        console.log(
            chalk.yellow(
                `You are using Node ${process.version}\n Please update to Node 10 or higher.`
            )
        )
        process.exit(1)
    }
    checkAppName(projectName)
    const root = path.resolve(projectName)
    // 确保文件夹存在，如果没有就创建
    fs.ensureDirSync(projectName)
    // 判断当前文件夹下是否存在冲突文件
    isSafeToCreateProjectIn(root, projectName)
    inquirer.prompt([{
        message: '请选择项目模板',
        type: 'list',
        name: 'type',
        choices: [
            'react-tpl',
            'tools'
        ],
        default: 'react-tpl'
    }]).then(res => {
        const { type } = res
        console.log()
        console.log(`Creating a new app in ${chalk.green(root)}.`)
        console.log()
        CFonts.say(CLI_NAME.toUpperCase(), {
            font: 'block',
            align: 'left',
            background: 'transparent',
            letterSpacing: 1,
            lineHeight: 1,
            space: true,
            maxLength: '0',
        })
        if (type === 'tools') {
            return downloadToolsApp(projectName)
        }
        return downloadTemplete(projectName)
    }).catch(err => {
        console.error(err)
        console.error('创建失败')
    })
}



createApp(projectName)

export{}

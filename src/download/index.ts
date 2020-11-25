const download = require('download-git-repo')
const path = require('path')
const ora = require('ora')
// .download-temp
module.exports = function (target, project, file = '') {
    target = path.join(target || '.', file);
    return new Promise((res, rej) => {
        let url = `qiaohe12/${project}#master`
        const spinner = ora(`正在下载项目模板...`)
        spinner.start()
        download(url, target, { clone: false }, err => {
            if (err) {
                spinner.fail()
                rej(err)
            } else {
                spinner.succeed()
                res(target)
            }
        })
    })
}

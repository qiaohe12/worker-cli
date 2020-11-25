#!/usr/bin/env node
'use strict';
const chalk = require('chalk')
// 判断当前node版本，如果node版本 < 10,则提示用户，且退出程序
const currentNodeVersion: string = process.versions.node  
const nodeVersion: number = Number(currentNodeVersion.split('.')[0])

if (nodeVersion < 10) {
    // 告知用户需要更高的 node 版本
    console.error(
        chalk.red(`You are running Node ${currentNodeVersion}. \nqiao-react-cli requires Node 10 or higher. \nPlease update your versions of node`)
    )
    // 退出进程
    process.exit(1)
}

// node版本符合条件，则进入init

require('./init')

export {}

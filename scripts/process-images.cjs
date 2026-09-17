const fs = require('fs')

const nodeModules = fs.readdirSync('node_modules')
const imageLibs = nodeModules.filter((m) => /sharp|jimp|png|canvas|jpeg|image/i.test(m))

throw new Error('DEBUG_TEST: modules=' + imageLibs.join(',') + ' total=' + nodeModules.length)

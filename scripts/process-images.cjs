const fs = require('fs')
console.log('--- TEST RUNNING NODE SCRIPT ---')
console.log('files:', fs.readdirSync('src/assets'))
for (const f of fs.readdirSync('src/assets')) {
  const stat = fs.statSync(`src/assets/${f}`)
  console.log(`Asset ${f}: ${stat.size} bytes`)
}

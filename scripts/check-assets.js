import fs from 'node:fs'

console.log(
  'logo-novo-corteplan size:',
  fs.statSync('src/assets/logo-novo-corteplan-f44ab.png').size,
)
console.log('logo-1-2ad68 size:', fs.statSync('src/assets/logo-1-2ad68.jpg').size)
console.log(
  'mascot size:',
  fs.statSync('src/assets/geminigeneratedimageuklpi8uklpi8uklp-f231b.png').size,
)
console.log(
  'a81fb size:',
  fs.statSync('src/assets/a81fb19c-16e8-45bf-8922-ff319310fd6d-a8846.png').size,
)
console.log('image-df size:', fs.statSync('src/assets/image-df978-1-280a6.png').size)

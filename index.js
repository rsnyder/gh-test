console.log(window.config)

let stylesheet = document.createElement('link')
stylesheet.rel = 'stylesheet'
stylesheet.href = 'https://cdn.jsdelivr.net/npm/juncture-digital/css/index.css'
document.head.appendChild(stylesheet)

let script = document.createElement('script')
script.src = 'https://cdn.jsdelivr.net/npm/juncture-digital/js/index.js'
script.type = 'module'
document.head.appendChild(script)

console.log(window.config.content)
let el = new DOMParser().parseFromString(window.config.content, 'text/html').querySelector('body')
console.log(el)
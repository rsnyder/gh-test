console.log(window.config)

let stylesheet = document.createElement('link')
stylesheet.rel = 'stylesheet'
stylesheet.href = 'https://cdn.jsdelivr.net/npm/juncture-digital/css/index.css'
document.head.appendChild(stylesheet)

let script = document.createElement('script')
script.src = 'https://cdn.jsdelivr.net/npm/juncture-digital/js/index.js'
document.head.appendChild(script)
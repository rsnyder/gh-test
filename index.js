console.log(window.config)

let stylesheet = document.createElement('link')
stylesheet.rel = 'stylesheet'
stylesheet.href = 'https://cdn.jsdelivr.net/npm/juncture-digital/css/index.css'
document.head.appendChild(stylesheet)

let script = document.createElement('script')
script.src = 'https://cdn.jsdelivr.net/npm/juncture-digital/js/index.js'
script.type = 'module'
document.head.appendChild(script)

console.log(document.body.main)

let main = new DOMParser().parseFromString(window.config.content, 'text/html').querySelector('body')
main.querySelectorAll('code').forEach(codeEl => {
    let junctureEl = document.createElement('ve-image')
    junctureEl.setAttribute('src', 'wc:Sunflower_sky_backdrop.jpg')
    junctureEl.classList.add('right')
    codeEl.replaceWith(junctureEl)
})
console.log(main)

document.body.main.replaceWith(main)

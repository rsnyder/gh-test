console.log(window.config)

console.log('add stylesheet')

function addStylesheet() {
  console.log('add stylesheet')
  let stylesheet = document.createElement('link')
  stylesheet.rel = 'stylesheet'
  stylesheet.href = 'https://cdn.jsdelivr.net/npm/juncture-digital/css/index.css'
  document.head.appendChild(stylesheet)
}

function addWc() {
  console.log('add web component script')
  let script = document.createElement('script')
  script.src = 'https://cdn.jsdelivr.net/npm/juncture-digital/js/index.js'
  script.type = 'module'
  document.head.appendChild(script)
  }

function docReady(fn) {
  if (document.readyState === 'complete' || document.readyState === 'interactive') setTimeout(fn, 1)
  else document.addEventListener('DOMContentLoaded', fn)
}

addStylesheet()
addWc()

docReady(function() {
  console.log('init')
  
  let orig = document.querySelector('article')
  
  let article = new DOMParser().parseFromString(window.config.content, 'text/html').querySelector('body')
  article.querySelectorAll('code').forEach(codeEl => {
      let junctureEl = document.createElement('ve-image')
      junctureEl.setAttribute('src', 'wc:Sunflower_sky_backdrop.jpg')
      junctureEl.classList.add('right')
      codeEl.replaceWith(junctureEl)
  })
  console.log(article)
  
  orig.replaceWith(article)
})

 console.log('js loaded')
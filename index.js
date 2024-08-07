console.log(window.config)

console.log('add stylesheet')

function addLink(attrs) {
  console.log('addLink', attrs)
  let stylesheet = document.createElement('link')
  Object.entries(attrs).map(([key, value]) => stylesheet.setAttribute(key, value))
  document.head.appendChild(stylesheet)
}

function addScriot(attrs) {
  console.log('addScriot', attrs)
  let script = document.createElement('script')
  Object.entries(attrs).map(([key, value]) => script.setAttribute(key, value))
  document.body.appendChild(script)
  }

function docReady(fn) {
  if (document.readyState === 'complete' || document.readyState === 'interactive') setTimeout(fn, 1)
  else document.addEventListener('DOMContentLoaded', fn)
}

addLink({rel: 'stylesheet', type: 'text/css', href: 'https://cdn.jsdelivr.net/npm/juncture-digital/css/index.css'})
addScript({src: 'https://cdn.jsdelivr.net/npm/juncture-digital/js/index.js', type: 'module'})

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
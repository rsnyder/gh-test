import { marked } from "https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js";
import 'https://cdn.jsdelivr.net/npm/marked-footnote/dist/index.umd.min.js'
import * as yaml from 'https://cdn.jsdelivr.net/npm/yaml@2.3.4/browser/index.min.js'

function addLink(attrs) {
  let stylesheet = document.createElement('link')
  Object.entries(attrs).map(([key, value]) => stylesheet.setAttribute(key, value))
  document.head.appendChild(stylesheet)
}

function addScript(attrs) {
  let script = document.createElement('script')
  Object.entries(attrs).map(([key, value]) => script.setAttribute(key, value))
  document.head.appendChild(script)
  }

function docReady(fn) {
  if (document.readyState === 'complete' || document.readyState === 'interactive') setTimeout(fn, 1)
  else document.addEventListener('DOMContentLoaded', fn)
}

const classes = new Set('left right full sticky'.split(' '))
const components = {
  've-animated-image': {
    booleans: 'autoplay',
    positional: 'src caption'
  },
  've-audio': {
    booleans: 'autoplay muted no-caption sync',
    positional: 'src caption'
  },
  've-breadcrumbs': {},
  've-compare': {
    positional: 'src'
  },
  've-entities': {
    booleans: 'cards'
  },
  've-gallery': {
    booleans: 'caption'
  },
  've-header': {
    booleans: 'breadcrumbs no-manifest-popover pdf-download-enabled',
    positional: 'title background subtitle options position'
  },
  've-iframe': {
    booleans: 'allow-full-screen allow-transparency full left right sticky',
    positional: 'src'
  },
  've-image': {
    booleans: 'no-caption static repo-is-writable zoom-on-scroll',
    positional: 'src caption'
  },
  've-knightlab-timeline': {
    booleans: 'has-bookmark'
  },
  've-map': {
    booleans: 'cards full left marker prefer-geojson popup-on-hover zoom-on-scroll zoom-on-click',
    positional: 'center caption'
  },
  've-menu': {
    booleans: 'pdf-download-enabled'
  },
  've-mermaid': {},
  've-meta': {},
  've-plant-specimen': {
    booleans: 'full left right sticky',
    positional: 'qid max'
  },
  've-snippet': {},
  've-video': {
    booleans: 'autoplay muted no-caption sync',
    positional: 'src caption'
  },
  've-visjs': {
    booleans: 'hierarchical'
  }
}
let tagMap = {}
Object.entries(components).forEach(([tag, attrs]) => {
  let tagObj = { 
    booleans : new Set((attrs.booleans || '').split(' ').filter(s => s)),
    positional: (attrs.positional || '').split(' ').filter(s => s)
  }
  tagMap[tag] = tagObj
  tagMap[tag.slice(3)] = tagObj
})
console.log(tagMap)

function parseHeadline(s) {
  let tokens = []
  s = s.replace(/”/g,'"').replace(/”/g,'"').replace(/’/g,"'")
  s?.match(/[^\s"]+|"([^"]*)"/gmi)?.filter(t => t).forEach(token => {
    if (tokens.length > 0 && tokens[tokens.length-1].indexOf('=') === tokens[tokens.length-1].length-1) tokens[tokens.length-1] = `${tokens[tokens.length-1]}${token}`
    else tokens.push(token)
  })
  let parsed = {}
  let tokenIdx = 0
  while (tokenIdx < tokens.length) {
    let token = tokens[tokenIdx].replace(/<em>/g, '_').replace(/<\/em>/g, '_')
    if (token.indexOf('=') > 0 && /^[\w-:]+=/.test(token)) {
      let idx = token.indexOf('=')
      let key = token.slice(0, idx)
      let value = token.slice(idx+1)
      value = value[0] === '"' && value[value.length-1] === '"' ? value.slice(1, -1) : value
      if (key[0] === ':') { // style
        key = camelToKebab(key.slice(1))
        if (!parsed.style) parsed.style = {}
        parsed.style[key] = value
      } else { // kwargs
        if (!parsed.kwargs) parsed.kwargs = {}
        if (parsed.kwargs[key]) parsed.kwargs[key] += ` ${value}`
        else parsed.kwargs[key] = value
      }
    }
    else if (token[0] === '.' || classes.has(token)) {
      let className = token.replace(/^\./,'')
      if (parsed.class) parsed.class += ` ${className}`
      else parsed.class = className
    }
    else if (token[0] === '"') {
      if (!parsed.args) parsed.args = []
      parsed.args.push(token.slice(1,-1))
    }
    else if (/#\w+/.test(token)) parsed['id'] = token.slice(1)
    else if (/^Q\d+$/.test(token) && !parsed.tag) { // entity identifier
      if (!parsed.entities) parsed.entities = []
      parsed.entities.push(token)
    }
    else if (tokenIdx === 0 && !parsed.tag && tagMap[token.replace(/^\./,'')]) {
      let tag = token.replace(/^\./,'')
      parsed.tag = tag.indexOf('ve-') === 0 ? tag : `ve-${tag}`
    } else if (token === 'script' || token === 'link') parsed.tag = token
    else {
      if (parsed.tag === 'script' && !parsed.src) parsed.src = token
      else if (parsed.tag === 'link' && !parsed.href) parsed.href= token
      else {
        let tagObj = tagMap[parsed.tag]
        if (tagObj?.booleans.has(token)) {
          if (!parsed.booleans) parsed.booleans = []
          parsed.booleans.push(token)
        } else {
          if (!parsed.args) parsed.args = []
          parsed.args.push(token)
        }
      }
    }
    tokenIdx++
  }

  if (parsed.tag && parsed.args) {
    let tagObj = tagMap[parsed.tag]
    let listArgs = []
    parsed.args.forEach((value, idx) => {
      if (idx >= tagObj.positional?.length) {
        listArgs.push(value)
      } else {
        let key = tagObj.positional[idx]
        value = value[0] === '"' && value[value.length-1] === '"' ? value.slice(1, -1) : value
        if (!parsed.kwargs) parsed.kwargs = {}
        if (parsed.kwargs[key]) parsed.kwargs[key] += ` ${value}`
        else parsed.kwargs[key] = value  
      }
    })
    if (listArgs.length) parsed.args = listArgs
    else delete parsed.args
  }
  return parsed
}

function parseCodeEl(codeEl) {
  let codeElems = codeEl.textContent?.replace(/\s+\|\s+/g,'\n')
    .split('\n')
    .map(l => l.trim())
    // .map(l => l.replace(/<em>/g, '_').replace(/<\/em>/g, '_'))
    .filter(x => x) || []
  let parsed = parseHeadline(codeElems?.[0]) || {}
  if (parsed.tag === 've-mermaid') {
    parsed.raw = codeEl.textContent.split('\n').slice(1).join('\n')
  } else if (codeElems.length > 1) parsed.args = parsed.args ? [...parsed.args, ...codeElems.slice(1)] : codeElems.slice(1)
  return parsed
}

function makeEl(parsed) {
  let el = document.createElement(parsed.tag)
  if (parsed.id) el.id = parsed.id
  if (parsed.class) parsed.class.split(' ').forEach(c => el.classList.add(c))
  if (parsed.style) el.setAttribute('style', Object.entries(parsed.style).map(([k,v]) => `${k}:${v}`).join(';'))
  if (parsed.entities) el.setAttribute('entities', parsed.entities.join(' '))
  if (parsed.kwargs) for (const [k,v] of Object.entries(parsed.kwargs)) el.setAttribute(k, v === true ? '' : v)
  if (parsed.booleans) parsed.booleans.forEach(b => el.setAttribute(b, '') )
  if (parsed.args) {
    let ul = document.createElement('ul')
    el.appendChild(ul)
    for (const arg of parsed.args) {
      let argEl = new DOMParser().parseFromString(marked.parse(arg.replace(/^\s*-\s*/, '')), 'text/html').body.firstChild
      let li = document.createElement('li')
      li.innerHTML = argEl.innerHTML.indexOf('wc:') === 0 ? argEl.innerHTML.replace(/<em>([^<]+)<\/em>/g, '_$1_') : argEl.innerHTML
      ul.appendChild(li)
    }
  }
  if (parsed.raw) el.textContent = parsed.raw
  return el
}
    
addLink({rel: 'stylesheet', type: 'text/css', href: 'https://cdn.jsdelivr.net/npm/juncture-digital/css/index.css'})
addScript({src: 'https://cdn.jsdelivr.net/npm/juncture-digital/js/index.js', type: 'module'})

function deleteAllComments(rootEl) {
  var iterator = document.createNodeIterator(rootEl, NodeFilter.SHOW_COMMENT, () => { return NodeFilter.FILTER_ACCEPT}, false);
  var curNode
  while (curNode = iterator.nextNode()) { curNode.remove() }
}

function isNumeric(arg) { return !isNaN(arg) }
function computeDataId(el) {
  let dataId = []
  while (el.parentElement) {
    let siblings = Array.from(el.parentElement.children).filter(c => c.tagName === el.tagName)
    dataId.push(siblings.indexOf(el) + 1)
    el = el.parentElement
  }
  return dataId.reverse().join('.')
}

// convert juncture tags to web component elements
function convertTags(rootEl) {
  // remove "view as" buttons
  Array.from(rootEl.querySelectorAll('a > img'))
  .filter(img => img.src.indexOf('ve-button.png') > -1 || img.src.indexOf('wb.svg') > -1)
  .forEach(viewAsButton => viewAsButton?.parentElement?.parentElement?.remove())

  Array.from(rootEl.querySelectorAll('p'))
    .filter(p => /^\.ve-\w+\S/.test(p.childNodes.item(0)?.nodeValue?.trim() || ''))
    .forEach(p => {
      let codeEl = document.createElement('code')
      codeEl.setAttribute('class', 'language-juncture2')
      let replacementText = p.innerHTML.trim().slice(1)
        .replace(/\n\s*-\s+/g, '\n')
        .replace(/<a href="/g, '')
        .replace(/">[^<]*<\/a>/g, '')
      codeEl.textContent = replacementText
      p.textContent = ''
      p.appendChild(codeEl)
    })
  Array.from(rootEl.querySelectorAll('param'))
  .filter(param => Array.from(param.attributes).filter(attr => attr.name.indexOf('ve-') === 0).length)
  .forEach(param => {
    let tag = Array.from(param.attributes).find(attr => attr.name.indexOf('ve-') === 0).name
    if (tag) {
      let tagObj = tagMap[tag]
      let parsed = { tag }
      Array.from(param.attributes).forEach(attr => {
        if (attr.name !== tag) {
          if (tagObj.booleans.has(attr.name)) {
            if (!parsed.booleans) parsed.booleans = []
            parsed.booleans.push(attr.name)
          } else {
            if (!parsed.kwargs) parsed.kwargs = {}
            if (parsed.kwargs[attr.name]) parsed.kwargs[attr.name] += ` ${attr.value}`
            else parsed.kwargs[attr.name] = attr.value
          }
        }
      })
      param.replaceWith(makeEl(parsed))
    }
  })
  rootEl.querySelectorAll('code').forEach(codeEl => {
    let parsed = parseCodeEl(codeEl)
    if (parsed.tag === 've-header') {
      header = makeEl(parsed)
      codeEl.parentElement.parentElement.parentElement.remove()
    } else if (parsed.tag === 've-footer') {
      footer = makeEl(parsed)
      codeEl.parentElement.parentElement.parentElement.remove()
    } else if (parsed.tag) {
      codeEl.replaceWith(makeEl(parsed))
    }
  })
}

// Restructure the content to have hierarchical sections and segments
function restructure(rootEl) {
  let styleSheet = rootEl.querySelector('style')
  deleteAllComments(rootEl)

  let main = document.createElement('main')
  if (styleSheet) main.appendChild(styleSheet.cloneNode(true))
  
  main.className = 'page-content markdown-body'
  main.setAttribute('aria-label', 'Content')
  main.setAttribute('data-theme', 'light')
  let currentSection = main;
  let sectionParam
  Array.from(rootEl?.children || []).forEach(el => {
    if (el.tagName[0] === 'H' && isNumeric(el.tagName.slice(1))) {
      let heading = el
      let sectionLevel = parseInt(heading.tagName.slice(1))
      if (currentSection) {
        (Array.from(currentSection.children))
          .filter(child => !/^H\d/.test(child.tagName))
          .filter(child => !/PARAM/.test(child.tagName))
          .filter(child => !/STYLE/.test(child.tagName))
          .filter(child => !/^VE--/.test(child.tagName))
          .forEach((child, idx) => { 
            let segId = `${currentSection.getAttribute('data-id') || 0}.${idx+1}`
            child.setAttribute('data-id', segId)
            child.id = segId
            child.classList.add('segment')
          })
      }

      currentSection = document.createElement('section')
      currentSection.classList.add(`section${sectionLevel}`)
      Array.from(heading.classList).forEach(c => currentSection.classList.add(c))
      heading.className = ''
      if (heading.id) {
        currentSection.id = heading.id
        heading.removeAttribute('id')
      }

      currentSection.innerHTML += heading.outerHTML

      let headings = []
      for (let lvl = 1; lvl < sectionLevel; lvl++) {
        headings = [...headings, ...Array.from(main.querySelectorAll(`H${lvl}`)).filter(h => h.parentElement.tagName === 'SECTION')]
      }

      let parent = (sectionLevel === 1 || headings.length === 0) 
        ? main 
        : headings.pop()?.parentElement
      parent?.appendChild(currentSection)
      currentSection.setAttribute('data-id', computeDataId(currentSection))

    } else  {
      let segId = `${currentSection.getAttribute('data-id') || 0}.${currentSection.children.length}`
      el.setAttribute('data-id', segId)
      el.id = segId
      el.classList.add('segment')
      if (el !== sectionParam) {
        currentSection.innerHTML += el.outerHTML
      }
    }
  })

  let article = document.createElement('article')

  let header = main.querySelector('ve-header')
  if (header) {
    article.appendChild(header)
    header.parentElement.parentElement.parentElement.remove()
  }

  article.appendChild(main)

  let footer = main.querySelector('ve-footer')
  if (footer) {
    article.appendChild(footer)
    footer.parentElement.parentElement.parentElement.remove()
  }

  return article
}

function setMeta() {
  let meta
  let header
  Array.from(document.getElementsByTagName('*')).forEach(el => {
    if (!/^\w+-\w+/.test(el.tagName)) return
    if (el.tagName.split('-')[1] === 'META') meta = el
    else if (el.tagName.split('-')[1] === 'HEADER') header = el
  })
  if (!meta) meta = document.querySelector('param[ve-config]')

  let firstHeading = document.querySelector('h1, h2, h3')?.innerText.trim()
  let firstParagraph = document.querySelector('p')?.innerText.trim()

  console.log('firstHeading', firstHeading)
  console.log('firstParagraph', firstParagraph)

  let jldEl = document.querySelector('script[type="application/ld+json"]')
  let seo = jldEl ? JSON.parse(jldEl.innerText) : {'@context':'https://schema.org', '@type':'WebSite', description:'', headline:'', name:'', url:''}
  seo.url = location.href

  let title = meta?.getAttribute('title')
    ? meta.getAttribute('title')
    : window.config?.title
      ? window.config.title
      : header?.getAttribute('label')
        ? header.getAttribute('label')
        : firstHeading || ''

  let description =  meta?.getAttribute('description')
    ? meta.getAttribute('description')
    : window.config?.description
      ? window.config.description
      : firstParagraph || ''

  let robots = meta?.getAttribute('robots')
    ? meta?.getAttribute('robots')
    : window.config?.robots
      ? window.config.robots
      : '' 

  if (title) {
    document.title = title
    seo.name = title
    seo.headline = title
    document.querySelector('meta[name="og:title"]')?.setAttribute('content', title)
    document.querySelector('meta[property="og:site_name"]')?.setAttribute('content', title)
    document.querySelector('meta[property="twitter:title"]')?.setAttribute('content', title)
  }
  if (description) {
    document.querySelector('meta[name="description"]')?.setAttribute('content', description)
    document.querySelector('meta[property="og:description"]')?.setAttribute('content', description)
    seo.description = description
  }
  if (robots) {
    let robotsMeta = document.createElement('meta')
    robotsMeta.setAttribute('name', 'robots')
    robotsMeta.setAttribute('content', robots)
    document.head.appendChild(robotsMeta)
  }

  if (meta && meta.getAttribute('ve-config') === null) meta.remove()
  if (jldEl) jldEl.innerText = JSON.stringify(seo)

  return {meta: {title, description, robots, seo}}
}

// set the configuration
function setConfig() {
  window.config = {
    ...yaml.parse(window.options || ''), 
    ...(window.jekyll || {}), 
    ...(window.config || {}),
    ...{
      baseurl: window.jekyll.site.baseurl,
      source: {
        owner: window.jekyll.site.github.owner_name,
        repository: window.jekyll.site.github.repository_name,
        branch: window.jekyll.site.github.source.branch,
        dir: window.jekyll.page.dir,
        path: window.jekyll.page.path,
        name: window.jekyll.page.name
      }
    },
    ...setMeta()
  }
}

// mount the content
function mount(mountPoint, html) {
  mountPoint = mountPoint || document.querySelector('body > article, body > main, body > section')
  html = html || window.config.content
  
  let contentEl = document.createElement('main')
  contentEl.innerHTML = html
 
  convertTags(contentEl)
  let article = restructure(contentEl)
  mountPoint.replaceWith(article)
}

docReady(function() {  
  setConfig()
  console.log(window.config)
  mount()
})

export { mount }
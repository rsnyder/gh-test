import { marked } from "https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js";
import 'https://cdn.jsdelivr.net/npm/marked-footnote/dist/index.umd.min.js'
import * as yaml from 'https://cdn.jsdelivr.net/npm/yaml@2.3.4/browser/index.min.js'

console.log(window.config)

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
  juncture3: {
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
}
let tagMap = {}
Object.values(components).forEach(langComponents => {
  Object.entries(langComponents).forEach(([tag, attrs]) => {
    let tagObj = { 
      booleans : new Set((attrs.booleans || '').split(' ').filter(s => s)),
      positional: (attrs.positional || '').split(' ').filter(s => s)
    }
    tagMap[tag] = tagObj
    tagMap[tag.slice(3)] = tagObj
  })
})

function parseHeadline(s, codeLang) {
  codeLang = codeLang || 'juncture3'
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
      parsed.lang = codeLang || components.juncture3[parsed.tag] ? 'juncture3' : 'juncture2'
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

function parseCodeEl(codeEl, codeLang) {
  let codeElems = codeEl.textContent?.replace(/\s+\|\s+/g,'\n')
    .split('\n')
    .map(l => l.trim())
    // .map(l => l.replace(/<em>/g, '_').replace(/<\/em>/g, '_'))
    .filter(x => x) || []
  let parsed = parseHeadline(codeElems?.[0], codeLang) || {}
  if (parsed.tag === 've-mermaid') {
    parsed.raw = codeEl.textContent.split('\n').slice(1).join('\n')
  } else if (codeElems.length > 1) parsed.args = parsed.args ? [...parsed.args, ...codeElems.slice(1)] : codeElems.slice(1)
  parsed.lang = parsed.lang || codeLang || ((parsed.tag || parsed.class || parsed.style || parsed.id) ? 'juncture3' : 'plain')
  return parsed
}

function makeEl(parsed) {
  console.log(parsed)
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

docReady(function() {  
  let orig = document.querySelector('article')
  let header
  let footer
  let main = document.createElement('main')
  main.classList.add('page-content')
  main.classList.add('markdown-body')
  main.setAttribute('aria-label', 'Content')
  main.innerHTML = window.config.content
  Array.from(main.querySelectorAll('p'))
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
  Array.from(main.querySelectorAll('param'))
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
  main.querySelectorAll('code').forEach(codeEl => {
    let parsed = parseCodeEl(codeEl)
    if (parsed.tag === 've-header') {
      header = makeEl(parsed)
      codeEl.parentElement.removeChild(codeEl)
    } else if (parsed.tag === 've-footer') {
      footer = makeEl(parsed)
      codeEl.parentElement.removeChild(codeEl)
    } else if (parsed.tag) {
      codeEl.replaceWith(makeEl(parsed))
    }
  })
  
  let article = document.createElement('article')
  if (header) article.appendChild(header)
  article.appendChild(main)
  if (footer) article.appendChild(footer)

  console.log(article)
  
  orig.replaceWith(article)
})

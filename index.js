console.log(window.config)

console.log('add stylesheet')

function addLink(attrs) {
  console.log('addLink', attrs)
  let stylesheet = document.createElement('link')
  Object.entries(attrs).map(([key, value]) => stylesheet.setAttribute(key, value))
  document.head.appendChild(stylesheet)
}

function addScript(attrs) {
  console.log('addScriot', attrs)
  let script = document.createElement('script')
  Object.entries(attrs).map(([key, value]) => script.setAttribute(key, value))
  document.body.appendChild(script)
  }

function docReady(fn) {
  if (document.readyState === 'complete' || document.readyState === 'interactive') setTimeout(fn, 1)
  else document.addEventListener('DOMContentLoaded', fn)
}

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
      positional: ['center', 'caption']
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
  Object.keys(langComponents).forEach(tag => {
    let tagObj = { 
      booleans : new Set(langComponents[(tag.booleans || '').split(' ').filter(s => s)]),
      positional: langComponents[(tag.positional || '').split(' ').filter(s => s)]
    }
    tagMap[tag] = tagObj
    tagMap[tag.slice(3)] = tagObj
  })
})
console.log(tagMap)

function parseHeadline(s, codeLang) {
  codeLang = codeLang || 'juncture3'
  let tokens = []
  s = s.replace(/”/g,'"').replace(/”/g,'"').replace(/’/g,"'")
  s?.match(/[^\s"]+|"([^"]*)"/gmi)?.filter(t => t).forEach(token => {
    if (tokens.length > 0 && tokens[tokens.length-1].indexOf('=') === tokens[tokens.length-1].length-1) tokens[tokens.length-1] = `${tokens[tokens.length-1]}${token}`
    else tokens.push(token)
  })
  // console.log(tokens)
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
    else if (token[0] === '.') {
      let key = 'class'
      let value = token.slice(1)
      value = value[0] === '"' && value[value.length-1] === '"' ? value.slice(1, -1) : value
      if (parsed[key]) parsed[key] += ` ${value}`
      else parsed[key] = value
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
    else if (tokenIdx === 0 && !parsed.tag && tagMap[token]) {
      parsed.tag = tagMap[token]
      parsed.lang = codeLang || components.juncture3[parsed.tag] ? 'juncture3' : 'juncture2'
    } else if (token === 'script' || token === 'link') parsed.tag = token
    else {
      if (parsed.tag === 'script' && !parsed.src) parsed.src = token
      else if (parsed.tag === 'link' && !parsed.href) parsed.href= token
      else {
        if (components[codeLang]?.[parsed.tag] && components[codeLang]?.[parsed.tag].booleans.has(token)) {
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
  if (parsed.tag && components[codeLang]?.[parsed.tag]?.raw) {
  } else if (parsed.tag && components[codeLang]?.[parsed.tag]?.positional && parsed.args) {
    if (!parsed.kwargs) parsed.kwargs = {}
    parsed.args.forEach((value, idx) => {
      let key = components[codeLang][parsed.tag].positional[idx]
      value = value[0] === '"' && value[value.length-1] === '"' ? value.slice(1, -1) : value
      if (!parsed.kwargs) parsed.kwargs = {}
      if (parsed.kwargs[key]) parsed.kwargs[key] += ` ${value}`
      else parsed.kwargs[key] = value    
    })
    delete parsed.args
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

addLink({rel: 'stylesheet', type: 'text/css', href: 'https://cdn.jsdelivr.net/npm/juncture-digital/css/index.css'})
addScript({src: 'https://cdn.jsdelivr.net/npm/juncture-digital/js/index.js', type: 'module'})

docReady(function() {
  console.log('init')
  
  let orig = document.querySelector('article')
  
  let article = new DOMParser().parseFromString(window.config.content, 'text/html').querySelector('body')
  article.querySelectorAll('code').forEach(codeEl => {
    let parsed = parseCodeEl(codeEl)
    console.log(parsed)
  })
  console.log(article)
  
  orig.replaceWith(article)
})

 console.log('js loaded')
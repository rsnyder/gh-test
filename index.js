import { marked } from "https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js";
import 'https://cdn.jsdelivr.net/npm/marked-footnote/dist/index.umd.min.js'
import * as yaml from 'https://cdn.jsdelivr.net/npm/yaml@2.3.4/browser/index.min.js'

const mode = location.hostname === 'localhost' || location.pathname === '/editor' ? 'dev' : 'prod'
const isMobile = ('ontouchstart' in document.documentElement && /mobi/i.test(navigator.userAgent) )

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
  've-media': {
    // booleans: 'no-caption static repo-is-writable zoom-on-scroll',
    positional: 'src caption'
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
  } else if (parsed.tag === 've-media') {
    console.log(parsed)
    parsed.tag = 've-image' //TODO: implement ve-media conversion
  } else if (codeElems.length > 1) {
    parsed.args = parsed.args ? [...parsed.args, ...codeElems.slice(1)] : codeElems.slice(1)
  }
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
  .filter(param => param.getAttribute('ve-config') === null)
  .forEach(param => {
    let tag = Array.from(param.attributes).find(attr => attr.name.indexOf('ve-') === 0).name
    if (tag) {
      let tagObj = tagMap[tag] || {}
      let parsed = { tag }
      Array.from(param.attributes).forEach(attr => {
        if (attr.name !== tag) {
          if (tagObj.booleans?.has(attr.name)) {
            if (!parsed.booleans) parsed.booleans = []
            parsed.booleans.push(attr.name)
          } else {
            if (!parsed.kwargs) parsed.kwargs = {}
            if (parsed.kwargs[attr.name]) parsed.kwargs[attr.name] += ` ${attr.value}`
            else parsed.kwargs[attr.name] = attr.value
          }
        }
      })
      // if (!window.config.isJunctureV1) param.replaceWith(makeEl(parsed))
    }
  })
  rootEl.querySelectorAll('code').forEach(codeEl => {
    let parsed = parseCodeEl(codeEl)
    if (parsed.tag) codeEl.replaceWith(makeEl(parsed))
  })
}

// Restructure the content to have hierarchical sections and segments
function restructure(rootEl) {
  let styleSheet = rootEl.querySelector('style')
  deleteAllComments(rootEl)

  // Move child params to be siblings with parent element
  rootEl.querySelectorAll('ul, ol').forEach(list => {
    let ref = list
    list.querySelectorAll('param').forEach(param => {
      ref.parentNode.insertBefore(param, ref.nextSibling)
      ref = param
    })
  })

  let main = document.createElement('main')
  if (styleSheet) main.appendChild(styleSheet.cloneNode(true))
  
  main.className = 'page-content markdown-body'
  main.setAttribute('aria-label', 'Content')
  main.setAttribute('data-theme', 'light')
  let currentSection = main;
  let sectionParam

  // Converts empty headings (changed to paragraphs by markdown converter) to headings with the correct level
  Array.from(rootEl?.querySelectorAll('p'))
  .filter(p => /^[#*]{1,6}$/.test(p.childNodes.item(0)?.nodeValue?.trim() || ''))
  .forEach(p => {
    let ptext = p.childNodes.item(0).nodeValue?.trim()
    let codeEl = p.querySelector('code')
    let heading = document.createElement(`h${ptext?.length}`)
    p.replaceWith(heading)
    if (codeEl) {
      let codeWrapper = document.createElement('p')
      codeWrapper.appendChild(codeEl)
      heading.parentElement?.insertBefore(codeWrapper, heading.nextSibling)
    }
  })

  // For compatibility with Juncture V1
  Array.from(rootEl?.querySelectorAll('param'))
  .filter(param => Array.from(param.attributes).filter(attr => attr.name.indexOf('ve-') === 0).length === 0)
  .forEach(param => {
    let priorEl = param.previousElementSibling
    param.classList.forEach(c => priorEl?.classList.add(c))
    let idAttr = Array.from(param.attributes).find(attr => attr.name === 'id')
    let styleAttr = Array.from(param.attributes).find(attr => attr.name === 'style')
    if (idAttr || styleAttr) {
      if (idAttr) priorEl?.setAttribute('id', idAttr.value)
      if (styleAttr) priorEl?.setAttribute('style', styleAttr.value)
      param.remove()
    }
  })

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

  let header, footer
  let article = document.createElement('article')

  if (window.config.isJunctureV1) {
    article.classList.add('j1')
    let veConfig = main.querySelector('param[ve-config]')
    header = document.createElement('ve-header')
    header.className = 'sticky'
    Array.from(veConfig?.attributes || []).forEach(attr => {
      if (attr.name === 'banner') header.setAttribute('background', attr.value)
      if (attr.name === 'title') header.setAttribute('title', attr.value)
      if (attr.name === 'subtitle' || attr.name === 'author') header.setAttribute('subtitle', attr.value)
    })
    article.appendChild(header)
    veConfig.remove()
  } else {
    header = main.querySelector('ve-header')
    if (header) {
      let toRemove = header
      while (toRemove.parentElement.tagName !== 'MAIN') toRemove = toRemove.parentElement 
      article.appendChild(header)
      toRemove.remove()
    }
  }

  article.appendChild(main)

  footer = main.querySelector('ve-footer')
  if (footer) {
    let toRemove = footer
    while (toRemove.parentElement.tagName !== 'MAIN') toRemove = toRemove.parentElement 
    article.appendChild(footer)
    toRemove.remove()
  }

  return article
}

function restructureForJ1(article) {
  console.log('restructuring for Juncture V1', article)
  Array.from(article.querySelectorAll('[data-id]')).forEach(seg => {
    if (seg.tagName === 'SECTION') return

    if (!seg.innerHTML.trim()) { // remove empty segments
      seg.remove()
      return
    }

    let id = seg.getAttribute('data-id') || ''
    let wrapper = document.createElement('div')
    wrapper.setAttribute('data-id', id)
    wrapper.id = id
    wrapper.className = seg.className
    seg.removeAttribute('id')
    seg.removeAttribute('data-id')
    seg.className = ''
    wrapper.appendChild(seg.cloneNode(true))
    let viewersDiv = document.createElement('div')

    viewersDiv.setAttribute('data-id', id)
    viewersDiv.className = 'viewers'

    let params = []
    let sib = seg.nextSibling
    while (sib && sib.tagName === 'PARAM') {
      params.push(sib)
      sib = sib.nextSibling
    }
    params.forEach(p => viewersDiv.appendChild(p))
    wrapper.appendChild(viewersDiv)

    seg.replaceWith(wrapper)
  })

  Array.from(article.querySelectorAll('[data-id]')).forEach(seg => {
    if (seg.tagName === 'SECTION') return
    let id = seg.getAttribute('data-id') || ''
    let para = seg.querySelector('p, ol, ul')
    let viewersDiv = seg.querySelector('.viewers')
    if (!viewersDiv) return
    
    const params = Array.from(viewersDiv.querySelectorAll(':scope > param'))
      .map((param, idx) => ({ ...Object.fromEntries(Array.from(param.attributes).map(a => [a.name, a.value])), ...{idx} }))
    
    let idx = params.length
    let parent = viewersDiv.parentElement
    while (parent && parent.tagName !== 'ARTICLE') {
      Array.from(parent.querySelectorAll(':scope > param')).forEach(param => {
        params.push({...Object.fromEntries(Array.from(param.attributes).map(a => [a.name, a.value])), ...{idx} })
        idx++
      })
      parent = parent.parentElement
    }
    console.log('params', params)

    const veTags = {}
    params.forEach(p => {
      let tag = Object.keys(p).find(k => k.indexOf('ve-') === 0 && !p[k])
      if (!tag) {
        tag = 've-entity'
        p[tag] = ''
      } else if (tag === 've-d3plus-ring-network') {
        tag = 've-visjs'
      }
      if (!veTags[tag]) veTags[tag] = []
      veTags[tag].push(p)
    })
    console.log(veTags)

    let entities = []
    Object.values(veTags['ve-entity'] || []).forEach(veEntity => {
      let qid = veEntity.eid || veEntity.qid
      let aliases = veEntity.aliases?.split('|').filter(a => a) || []
      let file = veEntity.file ||veEntity.article
      if (aliases.length || file) {
        if (!window.customEntityData[qid]) window.customEntityData[qid] = {aliases: aliases, file: file}
        }
      entities.push(qid)
    })
    delete veTags['ve-entity']

    para?.setAttribute('data-entities', entities.join(' '))

    function propsList(tagProps) {
      let ul = document.createElement('ul')
      tagProps.forEach(tp => {
        let li = document.createElement('li')
        li.innerText = serializeProps(tp)
        ul.appendChild(li)
      })
      return ul
    }

    function setElProps(el, props, nameMap) {
      Object.entries(props)
        .filter(([key, value]) => nameMap[key] !== undefined)
        .forEach(([key, value]) => {
          el.setAttribute(nameMap[key] || key, value === 'false' ? '' : value === 'true' ? null : value)
        })
    }

    function makeViewerEl(tagName, slotName, tagProps) {
      console.log(`makeViewerEL ${tagName} ${slotName} ${Object.keys(tagProps[0] || {})}`)
      let viewerEl = document.createElement(tagName)
      viewerEl.setAttribute('slot', slotName)
      if (slotName === 've-compare') {
        setElProps(viewerEl, tagProps[0], {caption:''})
        viewerEl.appendChild(propsList(tagProps))
      } else if (slotName === 've-iframe') {
        setElProps(viewerEl, tagProps[0], {allow:'', allowfullscreen:'', allowtransparency:'', frameborder:'', loading:'', name:'', src:''})
      } else if (slotName === 've-image' || slotName === 've-gallery') {
        if (tagProps.length === 1) {
          setElProps(viewerEl, tagProps[0], {attribution:'', caption:'', data:'', 'data-id':'', description:'', 'fit':'', label:'', license:'', src:'', title:'', url:'', 'zoom-on-scroll':''})
        } else {
          setElProps(viewerEl, tagProps[0], {'zoom-on-scroll':''})
          viewerEl.appendChild(propsList(tagProps))
        }
      } else if (slotName === 've-knightlab-timeline') {
        setElProps(viewerEl, tagProps[0], {caption:'', 'hash-bookmark':'', 'initial-zoom':'', source:'', 'timenav-position':''})
      } else if (slotName === 've-map') {
        setElProps(viewerEl, tagProps[0], {basemap:'basemaps', caption:'', center:'', data:'', 'data-id':'', entities:'', 'gesture-handling':'', 'gh-dir':'', marker:'', overlay:'', 'prefer-geojson':'', 'scroll-wheel-zoom':'', title:'', zoom:'', 'zoom-on-click':''})
        viewerEl.appendChild(propsList(tagProps.slice(1)))
      } else if (slotName === 've-plant-specimen') {
        setElProps(viewerEl, tagProps[0], {caption:'', eid:'', jpid:'', max:'', qid:'', 'taxon-name':'', wdid:''})
      } else if (slotName === 've-video') {
        setElProps(viewerEl, tagProps[0], {alt:'', autoplay:'', caption:'', 'data-id':'', end:'', id:'', muted:'', 'no-caption':'', poster:'', src:'', start:'', sync:'', vid:''})
      } else if (slotName === 've-visjs') {
        setElProps(viewerEl, tagProps[0], {caption:'', edges:'', hierarchical:'', nodes:'', title:'caption', url:''})
      } else if (slotName === 'data') {
        viewerEl.appendChild(propsList(tagProps))
      } else {
        console.log(`makeViewer: slotName ${slotName} not recognized, props=${Object.keys(tagProps[0] || {})}`)
      }
      console.log(viewerEl)
      return viewerEl
    }

    let j1Viewers = document.createElement('ve-j1-viewers-slots')
    j1Viewers.dataset.id = id
    viewersDiv.appendChild(j1Viewers)
    j1Viewers.setAttribute('viewers', [
      ...Object.keys(veTags).filter(tag => tag !== 've-map-marker' && tag !== 've-map-layer'),
      ...(mode === 'dev' ? ['data'] : [])
    ].join(' '))

    Object.entries(veTags).forEach(([tag, tagProps]) => {
      if (tag === 've-map-marker' || tag === 've-map-layer') return
      tagProps[0].entities = entities.join(' ')
      tagProps[0]['data-id'] = j1Viewers.dataset.id
      if (tag === 've-map') {
        j1Viewers.appendChild(makeViewerEl('ve-map', tag,
          [...tagProps,
           ...Object.values(veTags['ve-map-marker'] || {}), ...Object.values(veTags['ve-map-layer'] || {})
          ].sort((a,b) => a.idx - b.idx)
        ))
      } else {
        j1Viewers.appendChild(makeViewerEl(tag, tag, tagProps))
      }
    })
    j1Viewers.appendChild(makeViewerEl('div', 'data', params))

  })

  Array.from(article.querySelectorAll('.segment')).forEach(seg => {
    let viewers = seg.children[1]
    let parent = seg.parentElement
    while (parent && parent.tagName !== 'ARTICLE') {
      parent.querySelectorAll(':scope > param').forEach(param => viewers.appendChild(param.cloneNode(true)))
      parent = parent.parentElement
    }
  })

  return article
}

function setStickyOffsets(root) {
  function topIsVisible(el) {
    let bcr = el.getBoundingClientRect()
    return el.tagName === 'VE-HEADER' || el.tagName === 'VE-BREADCRUMBS' || (bcr.top >= 0 && bcr.top <= window.innerHeight)
  }

  let stickyElems = Array.from(root.querySelectorAll('.sticky'))
    .filter(stickyEl => topIsVisible(stickyEl))
    .sort((a,b) => {
        let aTop = a.getBoundingClientRect().top
        let bTop = b.getBoundingClientRect().top
        return aTop < bTop ? -1 : 1
      })

  if (stickyElems.length > 1) {
    stickyElems[0].style.zIndex = `${stickyElems.length}`
    for (let i = 1; i < stickyElems.length; i++) {
      let bcr = stickyElems[i].getBoundingClientRect()
      let left = bcr.x
      let right = bcr.x + bcr.width
      for (let j = i-1; j >= 0; --j) {
        let priorSticky = stickyElems[j]
        let bcrPrior = priorSticky.getBoundingClientRect()
        let leftPrior = bcrPrior.x
        let rightPrior = bcrPrior.x + bcrPrior.width
        if ((leftPrior <= right) && (rightPrior >= left)) {
          let priorTop = parseInt(priorSticky.style.top.replace(/px/,'')) || 0
          if (stickyElems[i].style) {
            stickyElems[i].style.top = `${Math.floor(priorTop + bcrPrior.height)}px`
          }
          break
        }
      }
    }
  }
}

let priorActiveParagraph
let currentActiveParagraph

function observeVisible(rootEl, setActiveParagraph, offset=0) {
  setActiveParagraph = setActiveParagraph || false
  let topMargin = offset + Array.from(rootEl.querySelectorAll('VE-HEADER'))
  .map(stickyEl => (parseInt(stickyEl.style.top.replace(/px/,'')) || 0) + stickyEl.getBoundingClientRect().height)?.[0] || 0

  isJunctureV1 = true

  // console.log(`observeVisible: setActiveParagraph=${setActiveParagraph} topMargin=${topMargin} isJunctureV1=${isJunctureV1}`)

  const visible = {}
  const observer = new IntersectionObserver((entries, observer) => {
    
    for (const entry of entries) {
      let para = entry.target
      let paraId = para.id || para.parentElement?.id || ''
      let intersectionRatio = entry.intersectionRatio
      if (intersectionRatio > 0) visible[paraId] = {para, intersectionRatio}
      else delete visible[paraId]
    }

    let sortedVisible = Object.values(visible)
      .sort((a,b) => b.intersectionRatio - a.intersectionRatio || a.para.getBoundingClientRect().top - b.para.getBoundingClientRect().top)

    // if (sortedVisible.length) console.log(sortedVisible)

    if (setActiveParagraph) {
        currentActiveParagraph = sortedVisible[0]?.para
    } else {
      let found = sortedVisible.find(e => e.para.classList.contains('active'))
      if (found) currentActiveParagraph = found.para
    }
      
    if (currentActiveParagraph !== priorActiveParagraph) {
      // console.log('activeParagraph', currentActiveParagraph)

      let priorViewers, currentViewers
      if (isJunctureV1) {
        priorViewers = priorActiveParagraph?.nextElementSibling
        currentViewers = currentActiveParagraph?.nextElementSibling
        if (priorViewers) priorViewers.classList.remove('active')
      }

      priorActiveParagraph = currentActiveParagraph
      if (setActiveParagraph) { 
        rootEl.querySelectorAll('p.active, ol.active, ul.active').forEach(p => p.classList.remove('active'))
        currentActiveParagraph?.classList.add('active')
        if (currentViewers) currentViewers.classList.add('active')
      }

      setStickyOffsets(rootEl)
    }

  }, { root: null, threshold: [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0], rootMargin: `${topMargin ? -topMargin : 0}px 0px 0px 0px`})

  // target the elements to be observed
  rootEl.querySelectorAll('p, .segment > ol, .segment > ul').forEach((paragraph) => observer.observe(paragraph))
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

  let firstHeading = document.querySelector('h1, h2, h3')?.innerHTML.trim()
  let firstParagraph = Array.from(document.querySelectorAll('p'))
    .find(p => {
      let ptext = p.childNodes.item(0).nodeValue?.trim()
      return p.childNodes[0].tagName !== 'CODE' && ptext?.length && !/^\.\w+-\w+/.test(ptext)
    })?.innerHTML.trim()

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

  // if (meta && meta.getAttribute('ve-config') === null) meta.remove()
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

function isJunctureV1(contentEl) {
  return contentEl.querySelector('param[ve-config]') ? true : false
}

function readMoreSetup() {
  const ps = document.querySelectorAll('.read-more p')
  const observer = new ResizeObserver(entries => {
    for (let entry of entries) {
      entry.target.classList[entry.target.scrollHeight > (entry.contentRect.height + 10) ? 'add' : 'remove']('truncated')
    }
  })
  ps.forEach(p => observer.observe(p))
}

function setViewersPosition() {
  let header = document.querySelector('ve-header')
  let viewers = document.querySelector('.viewers')
  let top = header.getBoundingClientRect().top
  let height = header.getBoundingClientRect().height
  let offset = top + height
  viewers.style.top = `${offset}px`
  viewers.style.height = `calc(100dvh - ${offset+2}px)`
  // console.log(offset, parseInt(window.getComputedStyle(viewers).height.replace(/px/,'')))
}

// mount the content
function mount(mountPoint, html) {
  mountPoint = mountPoint || document.querySelector('body > article, body > main, body > section')
  html = html || window.config.content
  
  let contentEl = document.createElement('main')
  contentEl.innerHTML = html
 
  window.config.isJunctureV1 = isJunctureV1(contentEl)
  console.log(window.config)

  convertTags(contentEl)
  let article = restructure(contentEl)
  // if (window.config.isJunctureV1) article = restructureForJ1(article)

  mountPoint.replaceWith(article)

  if (window.config.isJunctureV1 && !isMobile) {
    document.addEventListener('scroll', () => setViewersPosition())
    setTimeout(() => setViewersPosition(), 100)
  }

  // console.log(article.querySelector('ve-video[sync]'))
  observeVisible(article, article.querySelector('ve-video[sync]') ? false : true)
  readMoreSetup()
  return article
}

docReady(function() {  
  setConfig()
  mount()
})

export { mount }
#!/usr/bin/env python
# -*- coding: utf-8 -*-

'''
Python dev server for Juncture.
Dependencies: bs4 fastapi html5lib Markdown pymdown-extensions PyYAML uvicorn
'''

import logging
logging.basicConfig(format='%(asctime)s : %(filename)s : %(levelname)s : %(message)s')
logger = logging.getLogger()
logger.setLevel(logging.INFO)

import argparse, json, os, re

BASEDIR = os.path.dirname(os.path.abspath(os.path.dirname(__file__)))
PORT = os.environ.get('PORT', 8080)
LOCAL_WC = os.environ.get('LOCAL_WC', 'false').lower() == 'true'
LOCAL_WC_PORT = os.environ.get('LOCAL_WC_PORT', '5173')
CONTENT_ROOT = os.environ.get('CONTENT_ROOT', BASEDIR)
GH_OWNER = os.environ.get('GH_OWNER', '')
GH_REPOSITORY = os.environ.get('GH_REPOSITORY', '')
GH_BRANCH = os.environ.get('GH_BRANCH', 'main')

from bs4 import BeautifulSoup
import markdown
import yaml
from urllib.parse import quote
from typing import Optional

import uvicorn

from fastapi import FastAPI
from fastapi.responses import Response

from fastapi.middleware.cors import CORSMiddleware

origins = ['*']

app = FastAPI(title='juncture', root_path='/')

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

media_types = {
  'css': 'text/css',
  'html': 'text/html',
  'ico': 'image/vnd. microsoft. icon',
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'js': 'text/javascript',
  'json': 'application/json',
  'md': 'text/markdown',
  'png': 'image/png',
  'svg': 'image/svg+xml',
  'txt': 'text/plain',
  'yaml': 'application/x-yaml'
}

favicon = open(f'{BASEDIR}/favicon.ico', 'rb').read() if os.path.exists(f'{BASEDIR}/favicon.ico') else None

template_path = f'{CONTENT_ROOT}/_layouts/default.html' if os.path.exists(f'{CONTENT_ROOT}/_layouts/default.html') else f'{BASEDIR}/_layouts/default.html'
html_template = open(template_path, 'r').read()

if LOCAL_WC: 
  html_template = re.sub(r'["\'].*/[-\w@]*juncture[-\w.@]+/js/index\.js["\']', f'"http://localhost:{LOCAL_WC_PORT}/main.ts"', html_template)
  html_template = re.sub(r'https:\/\/cdn\.jsdelivr\.net\/npm\/juncture-digital\/css\/index\.css', f'http://localhost:{PORT}/wc/src/index.css', html_template)
  html_template = re.sub(r'https:\/\/cdn\.jsdelivr\.net\/npm\/juncture-digital\/js\/ghp\.js', f'http://localhost:{PORT}/wc/src/ghp.js', html_template)
html_template = html_template.replace('{{ site.baseurl }}', '')
html_template = html_template.replace('{{ site.github.owner_name }}', GH_OWNER)
html_template = html_template.replace('{{ site.github.repository_name }}', GH_REPOSITORY)
html_template = html_template.replace('{{ site.github.source.branch }}', GH_BRANCH)

html_template = html_template.replace('{%- seo -%}', '')

CONFIG = {
  'site': {
    'baseurl': '',
    'github': {
      'owner_name': GH_OWNER or 'rsnyder',
      'repository_name': GH_REPOSITORY or 'gh-test',
      'source': {
        'branch': GH_BRANCH or 'main'
      }
    }
  },
  'page': {},
  'content': ''
}
  
def html_from_markdown(md, baseurl, dir, name, path):
  html = html_template.replace('{{ content }}', markdown.markdown(md, extensions=['extra', 'toc']))
  html = html_template.replace('{{ content }}', markdown.markdown(md, extensions=['extra', 'toc']))
  
  soup = BeautifulSoup(markdown.markdown(md, extensions=['extra', 'toc']), 'html5lib')
      
  for link in soup.find_all('a'):
    href = link.get('href')
    if href and not href.startswith('http') and not href.startswith('#') and not href.startswith('/') and not href.startswith('mailto:'):
      link['href'] = f'{baseurl}{href}'
  
  for img in soup.find_all('img'):
    src = img.get('src')
    if not src.startswith('http') and not src.startswith('/'):
      img['src'] = f'{baseurl}{src}'

  for code in soup.find_all('code'):
    if code.parent.name == 'pre':
      top_div = soup.new_tag('div')
      if code.get('class'): top_div['class'] = code.get('class')
      wrapper_div = soup.new_tag('div')
      top_div.append(wrapper_div)
      pre = soup.new_tag('pre')
      wrapper_div.append(pre)
      new_code = soup.new_tag('code')
      new_code.string = code.string
      pre.append(new_code)
      code.parent.replace_with(top_div)

    
  for param in soup.find_all('param'):
    node = param.parent
    while node.next_sibling and node.next_sibling.name == 'param':
      node = node.next_sibling
    node.insert_after(param)
  for para in soup.find_all('p'):
    if para.renderContents().decode('utf-8').strip() == '':
      para.decompose()
      
  for heading in soup.find_all(re.compile('^h[1-6]$')):
    if not heading.text:
      para = soup.new_tag('p')
      para.string = ''.join(['#' for i in range(int(heading.name[1]))])
      for sibling in heading.next_siblings:
        if sibling.name:
          if sibling.name == 'p' and sibling.code:
            if len([token for token in sibling.code.string.split() if not token[0] in '#.:']) == 0:
              para.append(sibling.code)
              sibling.decompose()
          break
      heading.replace_with(para)
  
  CONFIG['content'] = str(soup.body.decode_contents())
  CONFIG['page'] = {
    'dir': dir,
    'name': name,
    'path': path
  }
  serialized_config = json.dumps(CONFIG)
  
  html = html_template.replace('{{ content }}', CONFIG['content'])
  html = re.sub(r'<script>window\.jekyll=.*>', '', html)
  html += '<script>window.jekyll=' + serialized_config + '</script>'
  
  return html
  
@app.get('{path:path}')
async def serve(path: Optional[str] = None):
  path = [pe for pe in path.split('/') if pe != ''] if path else []
  ext = path[-1].split('.')[-1].lower() if len(path) > 0 and '.' in path[-1] else None
  if len(path) > 0 and CONTENT_ROOT != BASEDIR and path[0] in ['ghp.js', 'index.css', 'index.js', 'favicon.ico', 'css', 'images', 'wc']:
  # if len(path) > 0 and path[0] in ['ghp.js', 'index.css', 'index.js', 'favicon.ico', 'css', 'images', 'wc']:
    local_file_path = f'{BASEDIR}/{"/".join(path)}'
    # logger.info(f'local_file_path: {local_file_path}')

  elif ext:
    local_file_path = f'{CONTENT_ROOT}/{"/".join(path)}'
    if not os.path.exists(local_file_path):
      return Response(status_code=404, content=f'Page "{path}" not found at {local_file_path}', media_type='text/html')
  else:
    for suffix in ('.html', '/index.html'):
      local_file_path = f'{CONTENT_ROOT}/{"/".join(path)}{suffix}'
      if os.path.exists(local_file_path):
        ext = 'html'
        break
    else:
      for mdIndex in ['index.md', 'README.md']:
        if os.path.exists(f'{CONTENT_ROOT}/{"/".join(path)}/{mdIndex}'):
          break
      local_file_path = f'{CONTENT_ROOT}/{"/".join(path)}' if ext else f'{CONTENT_ROOT}/{"/".join(path)}/{mdIndex}'
      if os.path.exists(local_file_path):
        pass
      elif os.path.exists(f'{CONTENT_ROOT}/{"/".join(path)}.md'):
        local_file_path = f'{CONTENT_ROOT}/{"/".join(path)}.md'
      else:
        return Response(status_code=404, content=f'Page "{path}" not found at {local_file_path}', media_type='text/html')
  
  if ext == 'ico':
    content = favicon
  elif ext in ['jpg', 'jpeg', 'png', 'svg']:
    content = open(local_file_path, 'rb').read()
  else:
    content = open(local_file_path, 'r').read()
    if LOCAL_WC and ext == 'html':
      content = re.sub(r'["\'].*/[-\w@]*juncture[-\w.@]+/js/index\.js["\']', f'"http://localhost:{LOCAL_WC_PORT}/main.ts"', content)
      content = re.sub(r'["\'].*/(index|ghp\.(css|js))["\']', f'"http://localhost:{PORT}/wc/src/\\1"', content)

  if ext is None: # markdown file
    if os.path.exists(local_file_path) and not ext:
      local_file_path = [pe for pe in local_file_path.replace(CONTENT_ROOT, '').split('/') if pe != '']
      md_name = local_file_path[-1]
      md_dir = '/' if len(local_file_path) == 1 else f'/{"/".join(local_file_path[:-1])}/'
      md_path = '/'.join(local_file_path)
      logger.debug(f'md_dir={md_dir} md_name={md_name} md_path={md_path}')
    content = html_from_markdown(content, baseurl=f'/{"/".join(path)}/' if len(path) > 0 else '/', dir=md_dir, name=md_name, path=md_path)
    content = content.replace('{{ page.dir }}', md_dir)
    content = content.replace('{{ page.name }}', md_name)
    content = content.replace('{{ page.path }}', md_path)

  media_type = media_types[ext] if ext in media_types else 'text/html'

  logger.debug(f'path: {path} ext: {ext} local_file_path: {local_file_path}')
  return Response(status_code=200, content=content, media_type=media_type)

if __name__ == '__main__':
  logger.setLevel(logging.INFO)
  parser = argparse.ArgumentParser(description='Plant Humanities Lab dev server')  
  parser.add_argument('--reload', type=bool, default=True, help='Reload on change')
  parser.add_argument('--port', type=int, default=8080, help='HTTP port')
  parser.add_argument('--localwc', default=False, action='store_true', help='Use local web components')
  parser.add_argument('--wcport', type=int, default=5173, help='Port used by local WC server')
  parser.add_argument('--content', default=BASEDIR, help='Content root directory')
  parser.add_argument('--owner', default='', help='Github owner')
  parser.add_argument('--repo', default='', help='Github repository')
  parser.add_argument('--branch', default='main', help='Github branch')


  args = vars(parser.parse_args())
  
  os.environ['PORT'] = str(args['port'])
  os.environ['LOCAL_WC'] = str(args['localwc'])
  os.environ['LOCAL_WC_PORT'] = str(args['wcport'])
  os.environ['CONTENT_ROOT'] = os.path.abspath(str(args['content']))
  os.environ['GH_OWNER'] = str(args['owner'])
  os.environ['GH_REPOSITORY'] = str(args['repo'])
  os.environ['GH_BRANCH'] = str(args['branch'])

  logger.info(f'BASEDIR={BASEDIR} CONTENT_ROOT={os.environ["CONTENT_ROOT"]} LOCAL_WC={os.environ["LOCAL_WC"]} LOCAL_WC_PORT={os.environ["LOCAL_WC_PORT"]}')

  uvicorn.run('serve:app', port=args['port'], log_level='info', reload=args['reload'])
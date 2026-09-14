from pathlib import Path
from markdown_it import MarkdownIt
import html, re
root = Path(__file__).resolve().parent.parent
source = (root / 'DSH-DEEPDIVE.md').read_text()
md = MarkdownIt('commonmark', {'html': True}).enable('table')
tokens = md.parse(source)
items=[]
for i,t in enumerate(tokens):
    if t.type=='heading_open':
        title=tokens[i+1].content
        anchor='chapter-'+str(len(items)+1)
        t.attrSet('id',anchor)
        items.append((int(t.tag[1:]),title,anchor))
body=md.renderer.render(tokens,md.options,{})
toc=''.join(f'<a class="level-{level}" href="#{anchor}">{html.escape(title)}</a>' for level,title,anchor in items if level==2)
page='''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>trainng 的 DSH 集成深读</title>
<style>
*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:22px}body{margin:0;color:#242424;background:#fff;font-family:system-ui,"Noto Sans CJK SC","Microsoft YaHei",sans-serif;font-size:17px;line-height:1.9}nav{position:fixed;left:0;top:0;bottom:0;width:268px;overflow:auto;padding:24px 20px;background:#f5f5f5;border-right:1px solid #ddd;font-size:13px;line-height:1.6}nav a{display:block;margin:11px 0;text-decoration:none;color:#444}nav strong{font-size:16px}main{margin-left:268px;max-width:1130px;padding:40px 58px 100px}h1{font-size:32px;line-height:1.45;margin:0 0 30px}h2{font-size:25px;line-height:1.5;margin:58px 0 22px;border-top:1px solid #ddd;padding-top:22px}h3{font-size:20px;line-height:1.6;margin:32px 0 14px}p{margin:16px 0}a{color:#34516d;overflow-wrap:anywhere}code{font-family:"Noto Sans Mono CJK SC",ui-monospace,monospace;font-size:.86em;background:#f3f3f3;padding:1px 4px;overflow-wrap:anywhere}pre{background:#f5f5f5;padding:18px;border:1px solid #e0e0e0;overflow:auto;font-size:13px;line-height:1.65;tab-size:2}pre code{background:none;padding:0;font-size:inherit;overflow-wrap:normal}table{border-collapse:collapse;width:100%;font-size:14px;line-height:1.7;margin:22px 0}th,td{border:1px solid #ddd;padding:9px 11px;vertical-align:top;text-align:left;overflow-wrap:anywhere}th{background:#f0f0f0}li{margin:8px 0}button{background:#fff;border:1px solid #bbb;padding:7px 10px;cursor:pointer;color:#333;margin:5px 0}nav .tools{margin-bottom:20px}::selection{background:#ddd} @media(max-width:900px){nav{position:static;width:100%;max-height:310px;border-right:0;border-bottom:1px solid #ddd}main{margin:0;padding:28px 20px 70px}h1{font-size:27px}h2{font-size:23px}table{font-size:12px}th,td{padding:6px}pre{font-size:12px}}
@media print{@page{size:A4;margin:18mm 16mm}html{scroll-behavior:auto}body{font-size:10pt;line-height:1.7}nav{display:none}main{margin:0;padding:0;max-width:none}h1{font-size:22pt}h2{font-size:17pt;margin-top:24pt;break-before:page}h3{font-size:12pt;break-after:avoid}p{orphans:3;widows:3}pre{font-size:7.5pt;white-space:pre-wrap;overflow-wrap:anywhere;break-inside:avoid}table{font-size:8pt;line-height:1.55}tr{break-inside:avoid}th,td{padding:5pt}a{color:#333;text-decoration:none}code{font-size:.85em}h2+p,h3+p{break-before:avoid}}
</style><nav aria-label="目录"><strong>阅读目录</strong><div class="tools"><button onclick="window.print()">打印 / 保存 PDF</button></div>'''+toc+'''</nav><main>'''+body+'''</main></html>'''
(root/'DSH-DEEPDIVE.html').write_text(page)

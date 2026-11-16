"""Authoring helper (tinycss2): derive color overrides, without copying layout rules.
The generated dark.css is committed; normal build uses only the standard library.
"""
from pathlib import Path
import colorsys
import re
import tinycss2
ROOT=Path(__file__).resolve().parents[1]
HEX=re.compile(r"#[0-9a-fA-F]{3,8}\b")
INK={"192435","243348","253853","243d5e","263d5c","273d59","233e62","203e68","243b29"}
MUTED={"536276","4e6076","526984","536b86","405772","485b72","435a75","34465e","344d6c","607089","65768b","68778b"}
BG={"ffffff":"1b2534","f4f6fa":"111927","f2f6fc":"1a293f","eef3fa":"202e42","edf2f9":"202e42","edf1f6":"202b3c","f5f7fa":"182332","f5f8fc":"182332","f7f9fc":"182332","f5f6f8":"182332","f6f8fc":"182332"}

def color(value,role):
    raw=value[1:].lower()
    if len(raw) in (3,4):raw=''.join(c*2 for c in raw)
    rgb=raw[:6];alpha=raw[6:];r,g,b=(int(rgb[i:i+2],16)/255 for i in (0,2,4));h,l,s=colorsys.rgb_to_hls(r,g,b)
    if role=='shadow':return '#000000'+(alpha or '50')
    if role=='bg':
        if rgb in BG:return '#'+BG[rgb]+alpha
        if l<.5:return '#'+raw
        chroma=max(r,g,b)-min(r,g,b)
        if chroma<.075:result='1c293b'
        elif 60<h*360<180:result='1b352c'
        elif h*360<60:result='392c1f'
        elif h*360>285:result='3b2634'
        elif h*360>245:result='30263e'
        else:result='1b2d47'
        return '#'+result+alpha
    if role=='border':
        if s<.25 or l>.65:return '#586f8e'+alpha
        role='fg'
    if rgb in INK:return '#e5edf7'+alpha
    if rgb in MUTED:return '#b4c2d5'+alpha
    if l>.70:return '#'+raw
    if s<.25:return '#c2cede'+alpha
    rr,gg,bb=colorsys.hls_to_rgb(h,.79,max(.38,min(s,.76)))
    return '#'+''.join(f'{round(c*255):02x}' for c in (rr,gg,bb))+alpha

def role_for(name,selector):
    if 'shadow' in name:return 'shadow'
    if 'border' in name:return 'border'
    if 'outline' in name:return 'fg'
    if name=='fill':return 'fg' if any(x in selector for x in ['text','.oop-title','marker']) else 'bg'
    if name=='stroke':return 'border'
    if 'background' in name:return 'bg'
    if name.startswith('--'):
        if re.search(r'(bg[234]?|paper|surface|panel|card|rail|accent-soft)$',name):return 'bg'
        if name.endswith(('-bg','-line','-soft')) or 'border' in name:return 'bg' if name.endswith(('-bg','-soft')) else 'border'
    return 'fg'

def scoped(selector):
    return ','.join('html[data-theme="dark"]' if s.strip() in (':root','html') else 'html[data-theme="dark"] '+s.strip() for s in selector.split(','))

def convert(rules):
    output=[]
    for rule in rules:
        if rule.type=='at-rule':
            if rule.lower_at_keyword!='media' or 'print' in tinycss2.serialize(rule.prelude):continue
            nested=convert(tinycss2.parse_rule_list(rule.content,skip_comments=True,skip_whitespace=True))
            if nested:output.append('@media '+tinycss2.serialize(rule.prelude).strip()+'{'+nested+'}')
        elif rule.type=='qualified-rule':
            selector=tinycss2.serialize(rule.prelude).strip();declarations=[]
            for decl in tinycss2.parse_declaration_list(rule.content,skip_comments=True,skip_whitespace=True):
                if decl.type!='declaration':continue
                name=decl.lower_name;value=tinycss2.serialize(decl.value).strip()
                if name=='color-scheme':value='dark'
                elif not (HEX.search(value) or name in ['color','background','background-color','background-image','border-color','border-left-color','border-top-color','outline-color','fill','stroke']):continue
                value=HEX.sub(lambda m:color(m[0],role_for(name,selector)),value)
                declarations.append(name+':'+value+('!important' if decl.important else '')+';')
            if declarations:output.append(scoped(selector)+'{'+''.join(declarations)+'}')
    return '\n'.join(output)

source=(ROOT/'dist/light.css').read_text(encoding='utf-8')
css=convert(tinycss2.parse_stylesheet(source,skip_comments=True,skip_whitespace=True))
extra="""
html[data-theme="dark"]{--accent-strong:#2457b6}
html[data-theme="dark"] body[data-course="java"]{--accent-strong:#99460f}
html[data-theme="dark"] body[data-course="it"]{--accent-strong:#146f67}
html[data-theme="dark"] body .solid-button,html[data-theme="dark"] body .primary,html[data-theme="dark"] body .primary-action,html[data-theme="dark"] body .course-tabs a[aria-current],html[data-theme="dark"] body .work-row .card-bottom,html[data-theme="dark"] body .reader-sequence #next-material{background:var(--accent-strong);border-color:var(--accent-strong);color:#fff}
html[data-theme="dark"] body .trace-controls button[data-trace-action=next],html[data-theme="dark"] body .trace-controls button[data-trace-action=play],html[data-theme="dark"] body .oop-controls button[data-oop-action=next],html[data-theme="dark"] body .oop-controls button[data-oop-action=play]{background:#2457b6;border-color:#2457b6;color:#fff}
html[data-theme="dark"] body .trace-controls button:disabled,html[data-theme="dark"] body .oop-controls button:disabled{background:#202b3c;border-color:#586f8e;color:#b4c2d5}
html[data-theme="dark"] body .tb-header .tb-theme-toggle{background:#23334b;border-color:#718cac;color:#e5edf7}
html[data-theme="dark"] body .course-card-image{border-radius:16px}
html[data-theme="dark"] body.tb-legacy-material{--teal:#0e7c7b;--teal-deep:#9cd9d4}
html[data-theme="dark"] body button#run-btn:hover{background:#0a5958;color:#fff}

"""
result='/* Generated color overrides; layout and type scale are shared with light.css. */\n@media screen{\n'+css+'\n'+extra+'\n}\n@media print{html{color-scheme:light!important}}\n'
(ROOT/'dist/dark.css').write_bytes(result.encode('utf-8'))
print('Dark palette:',len(result.encode('utf-8')),'bytes')

from playwright.sync_api import sync_playwright,expect
from pathlib import Path
import json, argparse, threading
from serve_account_fixture import create_server
parser=argparse.ArgumentParser()
parser.add_argument("--axe",type=Path)
args=parser.parse_args()
server=create_server()
threading.Thread(target=server.serve_forever,daemon=True).start()
base="http://127.0.0.1:"+str(server.server_port)
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='C:/Program Files/Google/Chrome/Application/chrome.exe',headless=True)
    ctx=browser.new_context(viewport={'width':1440,'height':1000},reduced_motion='reduce')
    page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(base+'/account/')
    expect(page.locator('#admin-metrics dd').first).to_have_text('31')
    assert page.evaluate("__accountTest.calls.filter(x=>x==='getUser').length")==1
    expect(page.locator('#feedback-section')).not_to_have_attribute('open','')
    page.locator('#feedback-section summary').click()
    page.locator('#admin-users-section summary').click()
    expect(page.locator('#admin-users tr')).to_have_count(25)
    assert page.locator('#admin-users img').count()==0
    page.locator('#admin-next').click();expect(page.locator('#admin-users tr')).to_have_count(6)
    page.locator('#admin-search input').fill('student30@');page.locator('#admin-search button').click()
    expect(page.locator('#admin-users tr')).to_have_count(1)
    page.locator('#profile-form input').fill('Несохранённое имя')
    page.evaluate("window.hiddenMutations=0;new MutationObserver(ms=>{for(const m of ms)if(m.target.hidden)hiddenMutations++}).observe(document.getElementById('dashboard'),{attributes:true,attributeFilter:['hidden']});window.beforeCalls=__accountTest.calls.length;")
    # Same auth events emitted by Supabase on window/tab refocus and rotation.
    page.evaluate("for(let i=0;i<8;i++){__accountTest.emit('SIGNED_IN');__accountTest.emit('TOKEN_REFRESHED');window.dispatchEvent(new Event('focus'));document.dispatchEvent(new Event('visibilitychange'));}")
    other=ctx.new_page();other.goto('about:blank');page.bring_to_front()
    page.wait_for_timeout(200)
    assert page.evaluate('__accountTest.calls.length===beforeCalls')
    assert page.evaluate('hiddenMutations')==0
    expect(page.locator('#profile-form input')).to_have_value('Несохранённое имя')
    expect(page.locator('#feedback-section')).to_have_attribute('open','')
    expect(page.locator('#admin-users-section')).to_have_attribute('open','')
    expect(page.locator('#admin-search input')).to_have_value('student30@')
    print('PASS one initial load; focus/tab/Alt+Tab events cause no data reload, hiding, lost input or collapsed panels',flush=True)
    reports=[]
    for theme in ['light','dark']:
        page.evaluate('(theme)=>textbookTheme.apply(theme,true)',theme)
        if args.axe:
            page.add_script_tag(path=str(args.axe.resolve()))
            violations=page.evaluate("async()=>{let r=await axe.run(document,{runOnly:{type:'rule',values:['color-contrast']}});return r.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))}")
            reports.append({'theme':theme,'violations':violations})
        for width in [320,390,768,1440]:
            page.set_viewport_size({'width':width,'height':1000})
            assert page.evaluate('document.documentElement.scrollWidth')<=width,(theme,width)


    assert not any(r['violations'] for r in reports),reports
    page.evaluate('__accountTest.failStats=true');page.locator('#admin-refresh').click()
    expect(page.locator('#admin-status')).to_contain_text('Не удалось')
    expect(page.locator('#admin-metrics dd')).to_have_count(0)
    page.evaluate('__accountTest.failStats=false');page.locator('#admin-refresh').click()
    expect(page.locator('#admin-metrics dd').first).to_have_text('31')
    page.evaluate("for(const key of ['accounts','confirmed','unconfirmed','new_today','new_7_days','groups','group_members'])__accountTest.stats[key]=0;__accountTest.stats.daily.forEach(day=>day.count=0)")
    page.locator('#admin-refresh').click();expect(page.locator('#admin-metrics dd').first).to_have_text('0')
    assert page.locator('#admin-daily li').count()==14
    assert page.locator('.admin-bar').evaluate_all("nodes=>nodes.every(n=>n.style.height==='0px')")
    page.evaluate('__accountTest.delay=300');page.locator('#admin-search input').fill('student');page.locator('#admin-search button').click()
    page.evaluate("__accountTest.emit('SIGNED_OUT',null)")
    expect(page.locator('#auth')).to_be_visible();page.wait_for_timeout(400)
    expect(page.locator('#admin-section')).to_be_hidden();expect(page.locator('#admin-users tr')).to_have_count(0)
    page.evaluate("__accountTest.emit('SIGNED_IN',{id:'teacher-other',email:'teacher@example.test',user_metadata:{full_name:'Другой преподаватель'}})")
    expect(page.locator('#dashboard')).to_be_visible();expect(page.locator('#admin-section')).to_be_hidden()
    assert page.locator('#admin-metrics dd').count()==0
    page.evaluate("__accountTest.emit('SIGNED_OUT',null)")
    expect(page.locator('#auth')).to_be_visible()
    before=page.evaluate("__accountTest.calls.filter(c=>c==='getUser').length")
    page.locator('#auth-form [name=email]').fill('admin@example.test')
    page.locator('#auth-form [name=password]').fill('local-fixture-password')
    page.locator('#auth-submit').click()
    expect(page.locator('#admin-section')).to_be_visible()
    assert page.evaluate("__accountTest.calls.filter(c=>c==='getUser').length")==before+1
    page.evaluate("__accountTest.emit('PASSWORD_RECOVERY')")
    expect(page.locator('#recovery')).to_be_visible()
    expect(page.locator('#dashboard')).to_be_hidden()
    print('PASS filtering, pagination, escaping, collapse, empty/error/retry, account switch/sign-out racing an old request; light/dark/mobile',flush=True)
    assert not errors,errors
    browser.close()
    server.shutdown()

"""DOM/render integration with explicit LOCAL HTTP transport bridge.
Used when Chromium administrator policy blocks localhost navigation.
Does NOT test native browser network policy, cookie behavior or response-header CSP.
Never changes browser administrator policies; never calls external services.
"""
from pathlib import Path
from datetime import datetime, timezone
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from urllib.parse import urlparse
import json,base64,os,zipfile,io,hashlib
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1];public=root/'apps/web/public';out=root/'reports/browser';out.mkdir(parents=True,exist_ok=True)
base=os.environ.get('E2E_BASE_URL','http://127.0.0.1:3087');assert urlparse(base).hostname in ['127.0.0.1','localhost']
checks=[];errors=[]
def transport(source,path,opts):
    assert path.startswith('/api/') and not path.startswith('//')
    assert len(path)<1024
    method=opts.get('method','GET');data=opts.get('body');headers={'Origin':base,**opts.get('headers',{})}
    request=Request(base+path,data=data.encode() if data is not None else None,method=method,headers=headers)
    try:r=urlopen(request,timeout=15)
    except HTTPError as e:r=e
    payload=r.read();return {'status':r.status,'headers':dict(r.headers),'body':base64.b64encode(payload).decode()}
bridge="""window.fetch=async function(path,options={}) { const r=await window.__localHTTP(String(path),options); const bytes=Uint8Array.from(atob(r.body),c=>c.charCodeAt(0)); return new Response(bytes,{status:r.status,headers:r.headers}); };"""
html=public.joinpath('index.html').read_text().replace('<script src="/app.js" defer></script>','').replace('<link rel="stylesheet" href="/styles.css">','<style>'+public.joinpath('styles.css').read_text()+'</style>').replace('<link rel="icon" href="/favicon.svg" type="image/svg+xml">','')
with sync_playwright() as pw:
    b=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
    def render(width,height):
        c=b.new_context(viewport={'width':width,'height':height},device_scale_factor=1);c.expose_binding('__localHTTP',transport)
        p=c.new_page();p.on('pageerror',lambda e:errors.append(str(e)));p.set_content(html,wait_until='domcontentloaded');p.evaluate("(() => {"+bridge+"})()");p.add_script_tag(content=public.joinpath('app.js').read_text());p.wait_for_function("typeof state!=='undefined' && state.config!==null");return p
    p=render(1440,1100);p.screenshot(path=str(out/'desktop-home.png'),full_page=True)
    assert p.evaluate('document.documentElement.scrollWidth<=innerWidth');checks.append({'name':'desktop rendering','status':'PASS'})
    p.get_by_role('button',name='Prendre des rendez-vous').click()
    answers=['Google Calendar','Validation humaine avant confirmation','Email',None,None,'Europe/Paris','Base PostgreSQL privée','Coordonnées clients seulement','Moins de 100','Auto']
    for i,value in enumerate(answers):
        p.wait_for_function('!state.busy')
        if value is None:
            p.locator('#message').fill({3:'Lundi au vendredi, 09:00 à 18:00',4:'Coupe : 30 minutes ; coloration : 90 minutes'}[i]);p.locator('#send').click()
        else:p.locator('.option').filter(has_text=value).first.click()
    p.wait_for_function("!state.busy && state.question===null")
    assert p.locator('#spec-count').inner_text()=='10 / 10 réponses'
    p.screenshot(path=str(out/'salon-completed.png'),full_page=True)
    spec=p.evaluate('state.spec');response=transport(None,'/api/local/export',{'method':'POST','headers':{'Content-Type':'application/json'},'body':json.dumps({'spec':spec})})
    assert response['status']==200;data=base64.b64decode(response['body']);out.joinpath('SALON_UI_CADRAGE.zip').write_bytes(data)
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        assert z.testzip() is None
        assert json.loads(z.read('reports/PROVENANCE.json'))['code_generated'] is False
        assert json.loads(z.read('reports/BR360_REPORT.json'))['status']=='NOT_AVAILABLE'
    checks.append({'name':'browser DOM interview -> real local HTTP backend -> framing ZIP','status':'PASS','native_browser_download':'NOT_TESTED','artifact_sha256':hashlib.sha256(data).hexdigest()})
    p.locator('[data-page="projects"]').click();assert 'Connecte-toi' in p.locator('#collection-content').inner_text();checks.append({'name':'no invented cloud projects','status':'PASS'})
    p.locator('#new-project').click();p.locator('#message').fill('<img src=x onerror="window.injected=1"> Research assistant');p.locator('#send').click();p.wait_for_function("!state.busy && state.spec!==null")
    assert p.evaluate('window.injected===undefined');assert p.locator('#messages img').count()==0;checks.append({'name':'objective rendered as text not HTML','status':'PASS'})
    mp=render(390,844);assert mp.evaluate('document.documentElement.scrollWidth<=innerWidth');mp.screenshot(path=str(out/'mobile-home.png'),full_page=True);checks.append({'name':'390px mobile rendering without horizontal overflow','status':'PASS'})
    assert not errors,errors;checks.append({'name':'uncaught JS errors','status':'PASS','errors':errors});b.close()
out.joinpath('RENDER_INTEGRATION_REPORT.json').write_text(json.dumps({'scope':'LOCAL_UI_WITH_EXPLICIT_HTTP_TRANSPORT_BRIDGE','executed_at':datetime.now(timezone.utc).isoformat(),'checks':checks,'limitations':['Chromium native localhost navigation blocked by administrator policy','Assets injected from local trusted source files','No native browser cookies, response-header CSP, download navigation, real login or checkout tested','No external service or generated-agent runtime tested']},indent=2))
print(json.dumps(checks,indent=2))

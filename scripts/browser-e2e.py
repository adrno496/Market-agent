"""Local UI tests only. Requires playwright and Chromium; no external accounts or payment mocks."""
from pathlib import Path
import os, json, zipfile, hashlib
from datetime import datetime, timezone
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
base=os.environ.get('E2E_BASE_URL','http://127.0.0.1:3087')
output=root/'reports'/'browser';output.mkdir(parents=True,exist_ok=True)
checks=[];errors=[]
with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
    context=browser.new_context(viewport={'width':1440,'height':1100},device_scale_factor=1,accept_downloads=True)
    page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(base,wait_until='networkidle')
    page.get_by_role('heading',name='Quel agent allons-nous créer ?').wait_for()
    page.screenshot(path=str(output/'desktop-home.png'),full_page=True)
    assert page.locator('#mode-badge').inner_text()=='Atelier local'
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    checks.append({'name':'desktop landing / truthful local mode / no horizontal overflow','status':'PASS'})
    page.get_by_role('button',name='Prendre des rendez-vous').click()
    answers=['Google Calendar','Validation humaine avant confirmation','Email',None,None,'Europe/Paris','Base PostgreSQL privée','Coordonnées clients seulement','Moins de 100','Auto']
    free={3:'Lundi au vendredi, 09:00 à 18:00',4:'Coupe : 30 minutes ; coloration : 90 minutes'}
    for idx,value in enumerate(answers):
        page.wait_for_function("!document.getElementById('message').disabled")
        if value is None:
            page.locator('#message').fill(free[idx]);page.get_by_role('button',name='Continuer',exact=False).click()
        else:
            page.locator('.option').filter(has_text=value).first.click()
    page.get_by_role('button',name='Exporter le cadrage').wait_for()
    page.wait_for_function("!document.getElementById('export-local').disabled")
    assert page.locator('#spec-count').inner_text()=='10 / 10 réponses'
    page.screenshot(path=str(output/'salon-completed.png'),full_page=True)
    with page.expect_download() as info:page.get_by_role('button',name='Exporter le cadrage').click()
    artifact=output/'SALON_UI_CADRAGE.zip';info.value.save_as(artifact)
    with zipfile.ZipFile(artifact) as archive:
        assert archive.testzip() is None
        spec=json.loads(archive.read('PROJECT_SPEC.json'))
        assert spec['fields']['calendar_provider']['value']=='Google Calendar'
        assert spec['fields']['approvals']['confirmed'] is True
        assert json.loads(archive.read('reports/PROVENANCE.json'))['code_generated'] is False
        assert json.loads(archive.read('reports/BR360_REPORT.json'))['status']=='NOT_AVAILABLE'
    checks.append({'name':'salon interview, ten answers and actual ZIP through browser','status':'PASS','artifact_sha256':hashlib.sha256(artifact.read_bytes()).hexdigest(),'scope':'framing_only_no_generated_agent'})
    page.locator('[data-page="projects"]').click();assert 'Connecte-toi' in page.locator('#collection-content').inner_text()
    checks.append({'name':'private pages never display invented projects','status':'PASS'})
    page.get_by_role('button',name='Nouveau projet',exact=True).click()
    page.locator('#message').fill('<img src=x onerror="window.injected=1"> Research assistant')
    page.get_by_role('button',name='Continuer',exact=False).click()
    page.wait_for_function("document.getElementById('project-description').textContent.includes('onerror')")
    assert page.evaluate('window.injected===undefined')
    assert page.locator('#messages img').count()==0
    checks.append({'name':'untrusted objective rendered as text, not HTML','status':'PASS'})
    mobile=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=1,is_mobile=True,has_touch=True)
    mp=mobile.new_page();mp.on('pageerror',lambda e:errors.append(str(e)));mp.goto(base,wait_until='networkidle')
    assert mp.evaluate('document.documentElement.scrollWidth<=innerWidth')
    mp.screenshot(path=str(output/'mobile-home.png'),full_page=True)
    checks.append({'name':'390px mobile layout / no horizontal overflow','status':'PASS'})
    assert not errors, errors
    checks.append({'name':'uncaught browser JavaScript errors','status':'PASS','errors':errors})
    browser.close()
report={'scope':'LOCAL_UI_ONLY','executed_at':datetime.now(timezone.utc).isoformat(),'checks':checks,'external_accounts':'NOT_TESTED','Stripe_checkout':'NOT_TESTED','generated_agent_runtime':'NOT_TESTED','public_deployment':'NOT_TESTED'}
(output/'E2E_REPORT.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps(report,ensure_ascii=False,indent=2))

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
const app = '/root/liuchuan/trainng';
const root = mkdtempSync(join(tmpdir(), 'dsh-config-probe-'));
try {
 const profile = join(root, 'profiles', 'fitness');
 mkdirSync(profile, {recursive:true});
 writeFileSync(join(profile,'package.json'), JSON.stringify({name:'dsh-report-profile',private:true,type:'module',dsh:{profile:{bundles:['@deepseek-ai/dsh-base','@deepseek-ai/dsh-web-app'],patchReload:'startup'}}}));
 writeFileSync(join(profile,'cordis.patch.yml'), readFileSync(join(app,'dsh-fitness/profile/cordis.patch.yml'),'utf8').replace('__FITNESS_DSH_BIND_HOST__','127.0.0.1'));
 const dump = execFileSync(process.execPath,[join(app,'node_modules/@deepseek-ai/dsh/lib/bin.js'),'--profile','fitness','--dump-config'],{cwd:app,env:{...process.env,DSH_HOME:root},encoding:'utf8'});
 const rows = dump.split(/(?=^- id:)/m);
 console.log(rows.filter(row=> /^- id: (agent-instructions|agent-presets)\s*$/m.test(row)).join('\n'));
} finally { rmSync(root,{recursive:true,force:true}); }

import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export function assertReleaseBuild(metadata,label='Mobile assets'){
  if(metadata?.format!==1||typeof metadata.watchTestMode!=='boolean')throw Error(`${label} has no valid build-mode metadata; rebuild before packaging`);
  if(metadata.watchTestMode)throw Error(`${label} is a diagnostic watch test build; restore normal mode and rebuild before packaging`);
}
function verifyBuildFile(file,label){
  if(!fs.existsSync(file))throw Error(`${label} has no build-mode metadata; rebuild before packaging`);
  assertReleaseBuild(JSON.parse(fs.readFileSync(file,'utf8')),label);
}
export function packageMobile(){
  if(process.env.VITE_WATCH_TEST_MODE==='true')throw Error('Diagnostic watch test mode cannot be packaged for release');
  const web=path.join(root,'mobile-www');
  if(!fs.existsSync(path.join(web,'index.html')))throw Error('Run mobile:build before packaging');
  verifyBuildFile(path.join(web,'watch-build.json'),'Mobile assets');
  const app=path.join(root,'mobile-build/ios-1.6/Build/Products/Debug-iphonesimulator/App.app');
  if(fs.existsSync(app))verifyBuildFile(path.join(app,'public/watch-build.json'),'iOS simulator app');
  const apk=path.join(root,'android/app/build/outputs/apk/debug/app-debug.apk');
  if(fs.existsSync(apk)){
    const metadata=spawnSync('unzip',['-p',apk,'assets/public/watch-build.json'],{encoding:'utf8'});
    if(metadata.status!==0)throw Error('Android APK has no build-mode metadata; rebuild before packaging');
    assertReleaseBuild(JSON.parse(metadata.stdout),'Android APK');
  }
  const version=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version;
  const output=path.join(root,'mobile-build/releases',version);
  fs.mkdirSync(output,{recursive:true});
  const run=(command,args)=>{
    const result=spawnSync(command,args,{cwd:root,stdio:'inherit'});
    if(result.status!==0)throw Error(`${command} failed (${result.status})`);
  };
  const source=path.join(output,`silver-bank-${version}-source.zip`);
  fs.rmSync(source,{force:true});
  const files=spawnSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{cwd:root,encoding:'utf8'});
  if(files.status!==0)throw Error('Cannot enumerate source files');
  const paths=[...new Set(files.stdout.split('\0').filter(Boolean))].filter(file=>
    fs.existsSync(path.join(root,file))&&!/(^|\/)(node_modules|mobile-build|mobile-www|dist|build|\.next|\.wrangler|\.sites-runtime|\.git)(\/|$)/.test(file)&&
    !/(^|\/)(\.env(?:\..*)?|\.dev\.vars|local\.properties|.*\.(?:keystore|jks|p12|mobileprovision|sqlite|db))$/.test(file));
  const archived=spawnSync('zip',['-q',source,'-@'],{cwd:root,input:paths.join('\n')+'\n',encoding:'utf8'});
  if(archived.status!==0)throw Error(archived.stderr||'Source ZIP creation failed');
  const artifacts=[source];
  const webZip=path.join(output,`silver-bank-${version}-mobile-assets.zip`);
  run('ditto',['-c','-k','--keepParent',web,webZip]);artifacts.push(webZip);
  if(fs.existsSync(app)){
    const appVersion=spawnSync('/usr/libexec/PlistBuddy',['-c','Print :CFBundleShortVersionString',path.join(app,'Info.plist')],{encoding:'utf8'});
    if(appVersion.status!==0||appVersion.stdout.trim()!==version.split('.').slice(0,2).join('.'))throw Error('Simulator app version differs from the release');
    run('codesign',['--verify','--deep','--strict',app]);
    const simulator=path.join(output,`silver-bank-${version}-ios-simulator.zip`);
    run('ditto',['-c','-k','--keepParent',app,simulator]);artifacts.push(simulator);
  }
  if(fs.existsSync(apk)){
    const target=path.join(output,`silver-bank-${version}-android-debug.apk`);
    fs.copyFileSync(apk,target);artifacts.push(target);
  }
  fs.copyFileSync(path.join(root,'docs/PINETIME_WATCH.md'),path.join(output,'RELEASE-NOTES.md'));
  fs.writeFileSync(path.join(output,'SHA256SUMS'),artifacts.map(file=>`${createHash('sha256').update(fs.readFileSync(file)).digest('hex')}  ${path.basename(file)}`).join('\n')+'\n');
  console.log(`Local app ${version} artifacts: ${output}`);
  for(const file of artifacts)console.log(path.basename(file));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))packageMobile();
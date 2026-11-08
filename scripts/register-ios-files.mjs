import fs from 'node:fs';
import crypto from 'node:crypto';
const file='ios/App/App.xcodeproj/project.pbxproj';
let project=fs.readFileSync(file,'utf8');
const groupId='504EC3061FED79650016851F', sourceId='504EC3001FED79650016851F';
const names=['NetShowNativePlayerPlugin.swift','MoroProtectedPlayerPlugin.swift','MoroEventPlayerPlugin.swift','NetShowBridgeViewController.swift'];
const groupPattern=new RegExp(`(${groupId} /\\* App \\*/ = \\{\\s*isa = PBXGroup;\\s*children = \\(\\n)`);
const sourcePattern=new RegExp(`(${sourceId} /\\* Sources \\*/ = \\{\\s*isa = PBXSourcesBuildPhase;[\\s\\S]*?files = \\(\\n)`);
if(!groupPattern.test(project)||!sourcePattern.test(project))throw new Error('Unsupported Xcode template. Add the four Swift files to the App target in Xcode.');
for(const name of names){
 if(!fs.existsSync('ios/App/App/'+name))throw new Error('Missing Swift file: '+name);
 const refExists=project.includes(`/* ${name} */ = {isa = PBXFileReference;`);
 const buildExists=project.includes(`/* ${name} in Sources */ = {isa = PBXBuildFile;`);
 if(refExists&&buildExists)continue;
 if(refExists||buildExists)throw new Error('Partial Swift registration; fix target membership in Xcode: '+name);
 const id=tag=>crypto.createHash('sha256').update('moroshow-ios-'+tag+'-'+name).digest('hex').slice(0,24).toUpperCase();
 const ref=id('ref'),build=id('build');
 if(project.includes(ref)||project.includes(build))throw new Error('Xcode project ID collision');
 project=project.replace('/* End PBXBuildFile section */',`\t\t${build} /* ${name} in Sources */ = {isa = PBXBuildFile; fileRef = ${ref} /* ${name} */; };\n/* End PBXBuildFile section */`);
 project=project.replace('/* End PBXFileReference section */',`\t\t${ref} /* ${name} */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ${name}; sourceTree = "<group>"; };\n/* End PBXFileReference section */`);
 project=project.replace(groupPattern,`$1\t\t\t\t${ref} /* ${name} */,\n`);
 project=project.replace(sourcePattern,`$1\t\t\t\t${build} /* ${name} in Sources */,\n`);
}
fs.writeFileSync(file,project);
console.log('iOS Swift files registered in App target.');

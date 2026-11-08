import fs from 'node:fs';
import path from 'node:path';
if(fs.existsSync('android/app/src/main/AndroidManifest.xml')){
 const dir='android/app/src/main/java/com/netshow/app';fs.mkdirSync(dir,{recursive:true});
 for(const name of ['PlaybackPolicy.java','MoroProtectedPlayerPlugin.java','MoroEventPlayerPlugin.java','MainActivity.java']){
  const target=path.join(dir,name),source=fs.readFileSync('android-support/'+name,'utf8');
  if(name==='MainActivity.java'&&fs.existsSync(target)){
   let old=fs.readFileSync(target,'utf8');if(!old.includes('MoroProtectedPlayerPlugin.class')){
    if(!/extends\s+BridgeActivity/.test(old))throw Error('Custom Android activity: register MoroProtectedPlayerPlugin before super.onCreate manually.');
    if(old.includes('super.onCreate(savedInstanceState);'))old=old.replace('super.onCreate(savedInstanceState);','registerPlugin(MoroProtectedPlayerPlugin.class);\n        super.onCreate(savedInstanceState);');
    else if(/class MainActivity extends BridgeActivity\s*\{\s*\}/.test(old))old=source;
    else throw Error('Custom Android onCreate: register MoroProtectedPlayerPlugin manually.');
    fs.writeFileSync(target,old);
   }
  }else fs.writeFileSync(target,source);
 }
 const activity=path.join(dir,'MainActivity.java');let current=fs.readFileSync(activity,'utf8');
 if(!current.includes('MoroEventPlayerPlugin.class')){if(!current.includes('super.onCreate(savedInstanceState);'))throw Error('Custom Android activity: register MoroEventPlayerPlugin manually.');current=current.replace('super.onCreate(savedInstanceState);','registerPlugin(MoroEventPlayerPlugin.class);\n        super.onCreate(savedInstanceState);');fs.writeFileSync(activity,current);}
 const file='android/app/src/main/AndroidManifest.xml';let manifest=fs.readFileSync(file,'utf8');
 if(!manifest.includes('android.software.leanback'))manifest=manifest.replace('<application','<uses-feature android:name="android.software.leanback" android:required="false"/>\n    <uses-feature android:name="android.hardware.touchscreen" android:required="false"/>\n    <application');
 if(!manifest.includes('android.intent.category.LEANBACK_LAUNCHER'))manifest=manifest.replace('<category android:name="android.intent.category.LAUNCHER" />','<category android:name="android.intent.category.LAUNCHER" />\n                <category android:name="android.intent.category.LEANBACK_LAUNCHER"/>');
 if(!manifest.includes('android:banner='))manifest=manifest.replace('<application','<application android:banner="@drawable/moroshow_tv_banner"');
 fs.writeFileSync(file,manifest);const drawable='android/app/src/main/res/drawable';fs.mkdirSync(drawable,{recursive:true});fs.writeFileSync(drawable+'/moroshow_tv_banner.xml','<layer-list xmlns:android="http://schemas.android.com/apk/res/android"><item><shape><solid android:color="#080808"/></shape></item><item android:gravity="center" android:width="96dp" android:height="96dp" android:drawable="@drawable/moroshow_launcher"/></layer-list>\n');console.log('Android/Android TV playback protection installed.');
}

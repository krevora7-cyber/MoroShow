import UIKit
import WebKit
import AVFoundation
import Capacitor

private let playerHosts:Set<String>=["player.cinezo.live","vidsrc.mov","vidlink.pro","vidsrc.sh"]
private let reservedHosts=["cinezo.live","vidsrc.mov","vidlink.pro","vidsrc.sh","dramatip.net","vercel.app","supabase.co","themoviedb.org","tmdb.org","trycloudflare.com","localhost"]
private func allowedPlayer(_ url:URL)->Bool { url.scheme?.lowercased()=="https" && url.user==nil && url.password==nil && (url.port==nil || url.port==443) && playerHosts.contains(url.host?.lowercased() ?? "") }
private final class ProtectedPlayerScreen:UIViewController,WKNavigationDelegate,WKUIDelegate {
 var sources:[(String,URL)]=[];var selected=0;var ruleList:WKContentRuleList?;var onClose:(()->Void)?
 private var web:WKWebView?;private let status=UILabel();private var closed=false
 override func viewDidLoad(){
  super.viewDidLoad();view.backgroundColor = .black
  let stack=UIStackView();stack.axis = .vertical;stack.translatesAutoresizingMaskIntoConstraints=false;view.addSubview(stack)
  NSLayoutConstraint.activate([stack.leadingAnchor.constraint(equalTo:view.safeAreaLayoutGuide.leadingAnchor),stack.trailingAnchor.constraint(equalTo:view.safeAreaLayoutGuide.trailingAnchor),stack.topAnchor.constraint(equalTo:view.safeAreaLayoutGuide.topAnchor),stack.bottomAnchor.constraint(equalTo:view.safeAreaLayoutGuide.bottomAnchor)])
  let bar=UIStackView();bar.spacing=12;bar.alignment = .center
  let close=UIButton(type:.system);close.setTitle("Back",for:.normal);close.addTarget(self,action:#selector(closePlayer),for:.touchUpInside);bar.addArrangedSubview(close)
  status.textColor = .white;status.text=title;status.numberOfLines=1;bar.addArrangedSubview(status)
  let reload=UIButton(type:.system);reload.setTitle("Reload",for:.normal);reload.addTarget(self,action:#selector(reloadPlayer),for:.touchUpInside);bar.addArrangedSubview(reload);bar.heightAnchor.constraint(greaterThanOrEqualToConstant:48).isActive=true;stack.addArrangedSubview(bar)
  let scroll=UIScrollView();let switches=UIStackView();switches.spacing=16;switches.translatesAutoresizingMaskIntoConstraints=false;scroll.addSubview(switches)
  NSLayoutConstraint.activate([switches.leadingAnchor.constraint(equalTo:scroll.contentLayoutGuide.leadingAnchor),switches.trailingAnchor.constraint(equalTo:scroll.contentLayoutGuide.trailingAnchor),switches.topAnchor.constraint(equalTo:scroll.contentLayoutGuide.topAnchor),switches.bottomAnchor.constraint(equalTo:scroll.contentLayoutGuide.bottomAnchor),switches.heightAnchor.constraint(equalTo:scroll.frameLayoutGuide.heightAnchor),scroll.heightAnchor.constraint(equalToConstant:48)])
  for(index,source) in sources.enumerated(){let button=UIButton(type:.system);button.setTitle(source.0,for:.normal);button.tag=index;button.addTarget(self,action:#selector(switchSource(_:)),for:.touchUpInside);switches.addArrangedSubview(button)};stack.addArrangedSubview(scroll)
  let config=WKWebViewConfiguration();config.allowsInlineMediaPlayback=true;config.allowsPictureInPictureMediaPlayback=true;config.mediaTypesRequiringUserActionForPlayback = .all;config.websiteDataStore = .nonPersistent()
  if let list=ruleList{config.userContentController.add(list)}
  // Separate from Capacitor: no account bridge or script message handlers.
  let web=WKWebView(frame:.zero,configuration:config);self.web=web;web.navigationDelegate=self;web.uiDelegate=self;web.isOpaque=false;web.backgroundColor = .black;stack.addArrangedSubview(web);web.load(URLRequest(url:sources[selected].1))
  try? AVAudioSession.sharedInstance().setCategory(.playback,mode:.moviePlayback)
 }
 @objc private func reloadPlayer(){web?.reload()}
 @objc private func switchSource(_ button:UIButton){selected=button.tag;status.text=title;web?.stopLoading();web?.load(URLRequest(url:sources[selected].1))}
 @objc private func closePlayer(){dismiss(animated:true){self.finish()}}
 func finish(){guard !closed else{return};closed=true;web?.stopLoading();web?.loadHTMLString("",baseURL:nil);web?.navigationDelegate=nil;web?.uiDelegate=nil;web?.removeFromSuperview();web=nil;onClose?();onClose=nil}
 override func viewDidDisappear(_ animated:Bool){super.viewDidDisappear(animated);if isBeingDismissed{finish()}}
 func webView(_ webView:WKWebView,createWebViewWith configuration:WKWebViewConfiguration,for navigationAction:WKNavigationAction,windowFeatures:WKWindowFeatures)->WKWebView?{nil}
 func webView(_ webView:WKWebView,decidePolicyFor navigationAction:WKNavigationAction,decisionHandler:@escaping(WKNavigationActionPolicy)->Void){guard let target=navigationAction.targetFrame else{decisionHandler(.cancel);return};if target.isMainFrame{guard let url=navigationAction.request.url,allowedPlayer(url) else{decisionHandler(.cancel);return}};decisionHandler(.allow)}
 func webView(_ webView:WKWebView,didFailProvisionalNavigation navigation:WKNavigation!,withError error:Error){if(error as NSError).code != NSURLErrorCancelled{status.text="Player unavailable. Try another server."}}
}
@objc(MoroProtectedPlayerPlugin)
public class MoroProtectedPlayerPlugin:CAPPlugin,CAPBridgedPlugin {
 public let identifier="MoroProtectedPlayerPlugin";public let jsName="MoroProtectedPlayer"
 public let pluginMethods:[CAPPluginMethod]=[CAPPluginMethod(name:"open",returnType:CAPPluginReturnPromise),CAPPluginMethod(name:"close",returnType:CAPPluginReturnPromise)]
 private var screen:ProtectedPlayerScreen?;private var preparing=false;private var generation=0
 @objc func open(_ call:CAPPluginCall){
  guard let raw=call.getArray("sources",JSObject.self),!raw.isEmpty,raw.count<=4,let hosts=call.getArray("blockedHosts",String.self),hosts.count<=2000 else{call.reject("Invalid player options");return}
  var sources:[(String,URL)]=[]
  for source in raw{guard let address=source["url"] as? String,let url=URL(string:address),allowedPlayer(url) else{call.reject("Unsupported player address");return};sources.append((source["label"] as? String ?? "Server",url))}
  var rules:[[String:Any]]=[]
  for host in hosts{
   guard host.count<=253,host.range(of:"^([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.)+[a-z]{2,63}$",options:.regularExpression) != nil,!reservedHosts.contains(where:{host==$0 || host.hasSuffix("."+$0) || $0.hasSuffix("."+host)}) else{call.reject("Invalid blocking host");return}
   rules.append(["trigger":["url-filter":"^https?://([^/]+\\.)?"+host.replacingOccurrences(of:".",with:"\\.")+"[:/]"],"action":["type":"block"]])
  }
  DispatchQueue.main.async{
   guard self.screen==nil,!self.preparing else{call.reject("Close the current player first");return};self.preparing=true;self.generation+=1;let generation=self.generation
   let present:(WKContentRuleList?)->Void={list in
    guard self.generation==generation else{call.resolve(["closed":true]);return};self.preparing=false
    guard let presenter=self.bridge?.viewController,presenter.presentedViewController==nil else{call.reject("Player cannot be presented right now");return}
    let screen=ProtectedPlayerScreen();screen.sources=sources;screen.selected=max(0,min(call.getInt("selected") ?? 0,sources.count-1));screen.title=call.getString("title") ?? "MoroShow";screen.ruleList=list;screen.modalPresentationStyle = .fullScreen
    screen.onClose={ [weak self] in self?.screen=nil;call.resolve(["closed":true]) };self.screen=screen;presenter.present(screen,animated:true)
   }
   if !(call.getBool("protectionEnabled") ?? true) || rules.isEmpty{present(nil);return}
   guard let bytes=try? JSONSerialization.data(withJSONObject:rules),let json=String(data:bytes,encoding:.utf8) else{self.preparing=false;call.reject("Invalid content rules");return}
   WKContentRuleListStore.default().compileContentRuleList(forIdentifier:"moro-playback-domains",encodedContentRuleList:json){list,error in DispatchQueue.main.async{guard self.generation==generation else{call.resolve(["closed":true]);return};if error != nil || list==nil{self.preparing=false;call.reject("Playback protection could not load");return};present(list)}}
  }
 }
 @objc func close(_ call:CAPPluginCall){DispatchQueue.main.async{self.generation+=1;self.preparing=false;guard let screen=self.screen else{call.resolve();return};screen.dismiss(animated:true){screen.finish();call.resolve()}}}
}

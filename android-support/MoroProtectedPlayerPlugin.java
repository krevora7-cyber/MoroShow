package com.netshow.app;
import android.app.Dialog;
import android.graphics.Color;
import android.os.Message;
import android.view.*;
import android.webkit.*;
import android.widget.*;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.*;
import java.io.ByteArrayInputStream;
import java.util.*;

@CapacitorPlugin(name="MoroProtectedPlayer")
public class MoroProtectedPlayerPlugin extends Plugin {
 private Dialog dialog;private WebView player;private PluginCall pending;private View customView;private WebChromeClient.CustomViewCallback fullscreenCallback;private FrameLayout videoContainer;
 @PluginMethod public void open(PluginCall call){
  JSArray sources=call.getArray("sources"),hosts=call.getArray("blockedHosts");final List<String> urls=new ArrayList<>(),labels=new ArrayList<>(),rules=new ArrayList<>();final PlaybackPolicy policy;
  try{if(sources==null||sources.length()==0||sources.length()>4||hosts==null)throw new Exception("Missing playback options");for(int i=0;i<sources.length();i++){JSONObject source=sources.getJSONObject(i);String url=source.getString("url");if(!PlaybackPolicy.allowedPage(url))throw new Exception("Unsupported player address");urls.add(url);labels.add(source.optString("label","Server "+(i+1)));}for(int i=0;i<hosts.length();i++)rules.add(hosts.getString(i));policy=new PlaybackPolicy(rules);}catch(Exception e){call.reject(e.getMessage());return;}
  final boolean filtering=call.getBoolean("protectionEnabled",true);
  getActivity().runOnUiThread(()->{
   if(dialog!=null){call.reject("Close the current player first");return;}pending=call;dialog=new Dialog(getActivity(),android.R.style.Theme_Material_NoActionBar);
   LinearLayout layout=new LinearLayout(getActivity());layout.setOrientation(LinearLayout.VERTICAL);layout.setBackgroundColor(Color.BLACK);
   LinearLayout toolbar=new LinearLayout(getActivity());toolbar.setGravity(Gravity.CENTER_VERTICAL);
   Button close=new Button(getActivity());close.setText("Back");close.setOnClickListener(v->dismiss());toolbar.addView(close);
   TextView title=new TextView(getActivity());title.setText(call.getString("title","MoroShow"));title.setTextColor(Color.WHITE);title.setMaxLines(1);toolbar.addView(title,new LinearLayout.LayoutParams(0,56,1));
   Button reload=new Button(getActivity());reload.setText("Reload");reload.setOnClickListener(v->{if(player!=null)player.reload();});toolbar.addView(reload);layout.addView(toolbar);
   HorizontalScrollView scroller=new HorizontalScrollView(getActivity());LinearLayout switches=new LinearLayout(getActivity());scroller.addView(switches);
   player=new WebView(getActivity());player.setBackgroundColor(Color.BLACK);WebSettings settings=player.getSettings();settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);settings.setMediaPlaybackRequiresUserGesture(true);settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);settings.setSupportMultipleWindows(true);settings.setJavaScriptCanOpenWindowsAutomatically(false);settings.setAllowFileAccess(false);settings.setAllowContentAccess(false);
   // Isolated WebView: no Capacitor/account/device JavaScript bridge is attached.
   player.setWebViewClient(new WebViewClient(){
    @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){if(filtering&&policy.blocks(request.getUrl().toString()))return new WebResourceResponse("text/plain","UTF-8",200,"OK",Collections.singletonMap("Cache-Control","no-store"),new ByteArrayInputStream(new byte[0]));return null;}
    @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){String scheme=request.getUrl().getScheme();if(!"https".equals(scheme)&&!"about".equals(scheme)&&!"blob".equals(scheme))return true;return request.isForMainFrame()&&!PlaybackPolicy.allowedPage(request.getUrl().toString());}
    @Override public void onReceivedError(WebView view,WebResourceRequest request,WebResourceError error){if(request.isForMainFrame())title.setText("Player unavailable. Try another server.");}
   });
   player.setWebChromeClient(new WebChromeClient(){
    @Override public boolean onCreateWindow(WebView view,boolean isDialog,boolean isUserGesture,Message resultMsg){return false;}
    @Override public void onShowCustomView(View view,CustomViewCallback callback){if(customView!=null){callback.onCustomViewHidden();return;}customView=view;fullscreenCallback=callback;videoContainer.addView(view,new FrameLayout.LayoutParams(-1,-1));}
    @Override public void onHideCustomView(){leaveFullscreen();}
   });
   for(int i=0;i<urls.size();i++){final String url=urls.get(i);Button button=new Button(getActivity());button.setText(labels.get(i));button.setOnClickListener(v->{leaveFullscreen();player.stopLoading();player.loadUrl(url);title.setText(call.getString("title","MoroShow"));});switches.addView(button);}
   layout.addView(scroller);videoContainer=new FrameLayout(getActivity());videoContainer.addView(player,new FrameLayout.LayoutParams(-1,-1));layout.addView(videoContainer,new LinearLayout.LayoutParams(-1,0,1));dialog.setContentView(layout);dialog.setOnDismissListener(d->cleanUp());
   dialog.setOnKeyListener((d,key,event)->{if(key==KeyEvent.KEYCODE_BACK&&event.getAction()==KeyEvent.ACTION_UP){if(customView!=null)leaveFullscreen();else dismiss();return true;}return false;});
   dialog.show();dialog.getWindow().setLayout(-1,-1);dialog.getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);player.loadUrl(urls.get(Math.max(0,Math.min(call.getInt("selected",0),urls.size()-1))));close.requestFocus();
  });
 }
 private void leaveFullscreen(){if(customView!=null){videoContainer.removeView(customView);customView=null;if(fullscreenCallback!=null)fullscreenCallback.onCustomViewHidden();fullscreenCallback=null;}}
 private void dismiss(){if(dialog!=null)dialog.dismiss();}
 private void cleanUp(){leaveFullscreen();if(player!=null){player.stopLoading();player.loadUrl("about:blank");videoContainer.removeView(player);player.destroy();player=null;}dialog=null;if(pending!=null){pending.resolve(new JSObject().put("closed",true));pending=null;}}
 @PluginMethod public void close(PluginCall call){getActivity().runOnUiThread(()->{dismiss();call.resolve();});}
 @Override protected void handleOnPause(){if(player!=null)player.onPause();}
 @Override protected void handleOnResume(){if(player!=null)player.onResume();}
 @Override protected void handleOnDestroy(){dismiss();}
}

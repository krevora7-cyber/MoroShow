package com.netshow.app;

import android.app.Dialog;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.Locale;

@CapacitorPlugin(name="MoroEventPlayer")
public class MoroEventPlayerPlugin extends Plugin {
 private Dialog dialog; private WebView web; private FrameLayout videoContainer; private View customView; private WebChromeClient.CustomViewCallback fullscreenCallback; private PluginCall pending;
 private int dp(int n){return (int)(n*getContext().getResources().getDisplayMetrics().density+0.5f);}
 private boolean allowed(String raw){try{Uri u=Uri.parse(raw);String host=u.getHost();if(host==null||u.getUserInfo()!=null||!"https".equalsIgnoreCase(u.getScheme())||(u.getPort()!=-1&&u.getPort()!=443))return false;host=host.toLowerCase(Locale.ROOT);return (host.equals("goo4goalz.com")&&"/ch.html".equals(u.getPath()))||(host.equals("redirectus.net")&&("/streame.html".equals(u.getPath())||"/streamlat.html".equals(u.getPath())));}catch(Exception e){return false;}}
 private TextView action(String text){TextView b=new TextView(getContext());b.setText(text);b.setTextColor(Color.WHITE);b.setTextSize(15);b.setGravity(Gravity.CENTER);b.setPadding(dp(14),dp(10),dp(14),dp(10));b.setFocusable(true);b.setClickable(true);GradientDrawable bg=new GradientDrawable();bg.setColor(Color.rgb(39,39,42));bg.setCornerRadius(dp(10));b.setBackground(bg);return b;}
 @PluginMethod public void open(PluginCall call){String url=call.getString("url"),title=call.getString("title","Event");if(url==null||!allowed(url)){call.reject("Unsupported event source.");return;} final String safeTitle=title==null?"Event":title.substring(0,Math.min(title.length(),120));
  getActivity().runOnUiThread(()->{
   if(dialog!=null){call.reject("Close the current player first.");return;}pending=call;
   dialog=new Dialog(getActivity(),android.R.style.Theme_Material_NoActionBar);LinearLayout layout=new LinearLayout(getContext());layout.setOrientation(LinearLayout.VERTICAL);layout.setBackgroundColor(Color.rgb(9,9,11));
   LinearLayout bar=new LinearLayout(getContext());bar.setGravity(Gravity.CENTER_VERTICAL);bar.setPadding(dp(14),dp(8),dp(14),dp(8));bar.setBackgroundColor(Color.rgb(19,19,21));
   TextView back=action("‹  Back");back.setContentDescription("Back to events");back.setOnClickListener(v->dismiss());bar.addView(back);
   TextView heading=new TextView(getContext());heading.setText(safeTitle);heading.setTextColor(Color.WHITE);heading.setTypeface(Typeface.DEFAULT,Typeface.BOLD);heading.setSingleLine(true);heading.setEllipsize(android.text.TextUtils.TruncateAt.END);heading.setTextSize(15);heading.setPadding(dp(12),0,dp(12),0);bar.addView(heading,new LinearLayout.LayoutParams(0,dp(48),1));heading.setGravity(Gravity.CENTER_VERTICAL);
   TextView reload=action("Reload");reload.setOnClickListener(v->{if(web!=null)web.reload();});bar.addView(reload);layout.addView(bar);
   web=new WebView(getContext());web.setBackgroundColor(Color.BLACK);WebSettings settings=web.getSettings();settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);settings.setMediaPlaybackRequiresUserGesture(false);settings.setAllowFileAccess(false);settings.setAllowContentAccess(false);settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);settings.setJavaScriptCanOpenWindowsAutomatically(false);settings.setSupportMultipleWindows(false);
   web.setWebViewClient(new WebViewClient(){@Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest r){String scheme=r.getUrl().getScheme();if(scheme==null||(!scheme.equalsIgnoreCase("https")&&!scheme.equalsIgnoreCase("about")&&!scheme.equalsIgnoreCase("blob")))return true;return r.isForMainFrame()&&!allowed(r.getUrl().toString());}@Override public void onReceivedError(WebView v,WebResourceRequest r,WebResourceError e){if(r.isForMainFrame())heading.setText("Source unavailable. Go back and try another.");}});
   videoContainer=new FrameLayout(getContext());videoContainer.setBackgroundColor(Color.BLACK);videoContainer.addView(web,new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,ViewGroup.LayoutParams.MATCH_PARENT));layout.addView(videoContainer,new LinearLayout.LayoutParams(-1,0,1));
   web.setWebChromeClient(new WebChromeClient(){@Override public void onShowCustomView(View v,CustomViewCallback cb){if(customView!=null){cb.onCustomViewHidden();return;}customView=v;fullscreenCallback=cb;videoContainer.addView(v,new FrameLayout.LayoutParams(-1,-1));}@Override public void onHideCustomView(){leaveFullscreen();}});
   dialog.setContentView(layout);dialog.setOnDismissListener(d->cleanUp());dialog.setOnKeyListener((d,key,event)->{if(key==KeyEvent.KEYCODE_BACK&&event.getAction()==KeyEvent.ACTION_UP){if(customView!=null)leaveFullscreen();else dismiss();return true;}return false;});dialog.show();if(dialog.getWindow()!=null){dialog.getWindow().setLayout(-1,-1);dialog.getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);}web.loadUrl(url);
  });
 }
 private void leaveFullscreen(){if(customView!=null){videoContainer.removeView(customView);customView=null;if(fullscreenCallback!=null)fullscreenCallback.onCustomViewHidden();fullscreenCallback=null;}}
 private void dismiss(){if(dialog!=null)dialog.dismiss();}
 private void cleanUp(){leaveFullscreen();if(web!=null){web.stopLoading();web.loadUrl("about:blank");videoContainer.removeView(web);web.destroy();web=null;}dialog=null;if(pending!=null){pending.resolve(new JSObject().put("closed",true));pending=null;}}
 @Override protected void handleOnPause(){if(web!=null)web.onPause();}
 @Override protected void handleOnResume(){if(web!=null)web.onResume();}
 @Override protected void handleOnDestroy(){dismiss();}
}
